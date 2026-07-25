"""
Stripe billing — the trusted, server-side half of the premium flow.

Why this exists: the frontend must NEVER be able to grant itself premium. So the
only thing the client does is ask this module for a Stripe Checkout URL; the
actual `plan='premium'` flip happens here, in a webhook, only after Stripe
confirms real money moved. Everything runs on the Firebase Admin SDK, which
bypasses Firestore rules — and the rules are hardened so clients can't self-set
the billing fields.

Three purchase options (Stripe Prices you create in the dashboard, wired via env):
  monthly_auto  — recurring monthly subscription   ($9.99/mo)   STRIPE_PRICE_MONTHLY
  monthly_once  — one-time 30-day pass, no renewal  ($9.99)      STRIPE_PRICE_MONTHLY_ONCE
  yearly_auto   — recurring yearly subscription     ($100/yr)    STRIPE_PRICE_YEARLY
  yearly_once   — one-time 365-day pass             ($100 once)  STRIPE_PRICE_YEARLY_ONCE

Env vars (all required for billing to work; absent = billing endpoints 503):
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY, STRIPE_PRICE_MONTHLY_ONCE, STRIPE_PRICE_YEARLY,
  FRONTEND_URL (fallback for success/cancel redirects; default https://weirdstats.ai)
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

logger = logging.getLogger("uvicorn.error")
router = APIRouter()

# stripe is an optional dependency at import time so the app still boots (and all
# non-billing routes work) even if the package or keys aren't present yet.
try:
    import stripe  # type: ignore
except Exception:  # pragma: no cover
    stripe = None

_STRIPE_KEY = os.getenv("STRIPE_SECRET_KEY", "")
if stripe and _STRIPE_KEY:
    stripe.api_key = _STRIPE_KEY

WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://weirdstats.ai").rstrip("/")

# Origins we're willing to bounce a Checkout redirect back to (mirrors CORS).
_ALLOWED_RETURN_ORIGINS = {
    "http://localhost:4200", "http://localhost:8100", "http://localhost:8080",
    "https://weirdstats.ai", "https://www.weirdstats.ai",
    "https://weirdstats-ai.web.app", "https://weirdstats-ai.firebaseapp.com",
}

# plan key -> Stripe Price env var + checkout mode (+ pass length for one-time).
PLANS = {
    "monthly_auto": {"price_env": "STRIPE_PRICE_MONTHLY",      "mode": "subscription"},
    "monthly_once": {"price_env": "STRIPE_PRICE_MONTHLY_ONCE", "mode": "payment", "days": 30},
    "yearly_auto":  {"price_env": "STRIPE_PRICE_YEARLY",       "mode": "subscription"},
    "yearly_once":  {"price_env": "STRIPE_PRICE_YEARLY_ONCE",  "mode": "payment", "days": 365},
}


def _price_id(plan_key: str) -> str:
    return os.getenv(PLANS[plan_key]["price_env"], "")


def _billing_ready() -> bool:
    return bool(stripe and _STRIPE_KEY)


def _iso(ts: float) -> str:
    """Unix seconds -> ISO-8601 UTC string (how planExpiry is stored)."""
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


# ── Firestore helpers (Admin SDK — bypasses rules) ──────────────────────────
def _db():
    from app.firestore_client import _get_db
    return _get_db()


def _user_ref(uid: str):
    return _db().collection("users").document(uid)


def _uid_for_customer(customer_id: str) -> str | None:
    """Reverse-lookup the app user from a Stripe customer id (for webhook
    events like invoice.paid that only carry the customer)."""
    if not customer_id:
        return None
    docs = list(
        _db().collection("users").where("stripeCustomerId", "==", customer_id).limit(1).stream()
    )
    return docs[0].id if docs else None


def _set_plan(uid: str, **fields) -> None:
    fields["planUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    _user_ref(uid).set(fields, merge=True)
    logger.info(f"billing: updated plan for {uid}: {list(fields)}")


# ── Auth: verify the caller's Firebase ID token ─────────────────────────────
def _verify_bearer(request: Request) -> tuple[str, str]:
    """Returns (uid, email). Raises 401 on a missing/invalid token. Payment
    endpoints must trust the token, never a client-sent uid."""
    from firebase_admin import auth as fb_auth

    # firebase_admin init is lazy (inside _get_db). A billing request that lands
    # on a fresh Cloud Run instance before any Firestore call would otherwise hit
    # "default app does not exist" and 401 — so make sure the SDK is up first.
    _db()

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = header.split(" ", 1)[1].strip()
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception as e:
        logger.warning(f"billing: token verify failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return decoded["uid"], decoded.get("email", "") or ""


def _get_or_create_customer(uid: str, email: str) -> str:
    """One Stripe customer per app user (needed for the portal + renewals).
    Cached on users/{uid}.stripeCustomerId."""
    snap = _user_ref(uid).get()
    existing = (snap.to_dict() or {}).get("stripeCustomerId") if snap.exists else None
    if existing:
        return existing
    customer = stripe.Customer.create(email=email or None, metadata={"uid": uid})
    _user_ref(uid).set({"stripeCustomerId": customer.id}, merge=True)
    return customer.id


def _as_dict(obj) -> dict:
    """stripe-python >=15 returns StripeObjects whose .get() no longer behaves
    like a dict (it raises AttributeError). Round-trip through JSON to a plain
    nested dict so the handler code (all .get()/[]) keeps working."""
    return json.loads(str(obj))


def _has_active_subscription(uid: str) -> bool:
    """True when the user already has a live Stripe subscription — used to stop a
    second subscription checkout (double-charge). The stored subscriptionId is
    verified against Stripe, so a churned user whose id wasn't cleared can still
    re-subscribe; if Stripe can't be reached we err toward blocking rather than
    risk charging twice."""
    snap = _user_ref(uid).get()
    sub_id = (snap.to_dict() or {}).get("subscriptionId") if snap.exists else None
    if not sub_id:
        return False
    try:
        status = _as_dict(stripe.Subscription.retrieve(sub_id)).get("status")
    except Exception:
        return True
    return status in ("active", "trialing", "past_due", "unpaid")


def _return_base(origin: str | None) -> str:
    return origin if origin in _ALLOWED_RETURN_ORIGINS else FRONTEND_URL


# ── Endpoints ───────────────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan: str                     # one of PLANS
    origin: Optional[str] = None  # window.location.origin, for the return redirects


@router.post("/api/billing/checkout")
async def create_checkout(req: CheckoutRequest, request: Request) -> dict:
    if not _billing_ready():
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    price = _price_id(req.plan)
    if not price:
        raise HTTPException(status_code=503, detail=f"No Stripe price configured for {req.plan}.")

    uid, email = _verify_bearer(request)
    cfg = PLANS[req.plan]
    base = _return_base(req.origin)

    def _create() -> str:
        # Don't let an already-subscribed user buy anything more: a second
        # subscription double-charges on renewal, and a one-time pass would
        # orphan the still-live subscription (it keeps charging while the app
        # loses track of it). Send them to the portal to manage what they have.
        if _has_active_subscription(uid):
            raise HTTPException(
                status_code=409,
                detail="You already have an active subscription. Manage it from the billing portal.",
            )
        customer = _get_or_create_customer(uid, email)
        params = dict(
            mode=cfg["mode"],
            customer=customer,
            line_items=[{"price": price, "quantity": 1}],
            client_reference_id=uid,
            metadata={"uid": uid, "plan": req.plan},
            success_url=f"{base}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base}/billing/cancel",
        )
        # Stripe Tax has to be activated in the dashboard before automatic_tax
        # can be used, otherwise checkout errors. Off by default so checkout
        # works out of the box; set STRIPE_AUTOMATIC_TAX=1 once Tax is set up to
        # add "+ tax" at checkout.
        if os.getenv("STRIPE_AUTOMATIC_TAX", "").lower() in ("1", "true", "yes"):
            params["automatic_tax"] = {"enabled": True}
            params["customer_update"] = {"address": "auto"}
        if cfg["mode"] == "subscription":
            params["subscription_data"] = {"metadata": {"uid": uid, "plan": req.plan}}
        else:
            params["payment_intent_data"] = {"metadata": {"uid": uid, "plan": req.plan}}
        session = stripe.checkout.Session.create(**params)
        return session.url

    try:
        url = await run_in_threadpool(_create)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"billing: checkout failed for {uid}: {e}")
        raise HTTPException(status_code=502, detail="Could not start checkout.")
    return {"url": url}


@router.post("/api/billing/portal")
async def create_portal(request: Request) -> dict:
    """Stripe-hosted customer portal to manage/cancel a subscription."""
    if not _billing_ready():
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    uid, _ = _verify_bearer(request)
    origin = request.headers.get("origin")
    base = _return_base(origin)

    def _create() -> str | None:
        snap = _user_ref(uid).get()
        customer = (snap.to_dict() or {}).get("stripeCustomerId") if snap.exists else None
        if not customer:
            return None
        sess = stripe.billing_portal.Session.create(
            customer=customer, return_url=f"{base}/profile"
        )
        return sess.url

    try:
        url = await run_in_threadpool(_create)
    except Exception as e:
        logger.error(f"billing: portal failed for {uid}: {e}")
        raise HTTPException(status_code=502, detail="Could not open the billing portal.")
    if not url:
        raise HTTPException(status_code=404, detail="No billing account yet.")
    return {"url": url}


@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request) -> dict:
    """Stripe -> us. The ONLY place premium is granted. Signature-verified."""
    if not _billing_ready() or not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured.")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception as e:
        logger.warning(f"billing: bad webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    # Signature verified above; hand the handler a plain dict of the same JSON.
    # (stripe-python >=15 StripeObjects don't support .get() like a dict.)
    event = json.loads(payload)
    await run_in_threadpool(_handle_event, event)
    return {"received": True}


def _stored_field(uid: str, field: str):
    snap = _user_ref(uid).get()
    return (snap.to_dict() or {}).get(field) if snap.exists else None


def _subscription_period_end(sub: dict, plan: str) -> str:
    """When a subscription's paid period ends. In Stripe API 2025-03-31.basil
    `current_period_end` moved from the Subscription top-level onto its items —
    read both. NEVER return None for a premium sub (the frontend treats a null
    expiry as 'never expires', which would grant lifetime premium for a monthly
    charge), so fall back to a plan-length grace and log."""
    ts = sub.get("current_period_end")
    if not ts:
        items = (sub.get("items") or {}).get("data") or []
        if items:
            ts = items[0].get("current_period_end")
    if ts:
        return _iso(ts)
    days = 366 if plan == "yearly_auto" else 32
    logger.warning(f"billing: no current_period_end on sub {sub.get('id')} — fallback +{days}d")
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _invoice_subscription_id(inv: dict):
    """Invoice.subscription also moved under invoice.parent.subscription_details
    in 2025-03-31.basil — read both."""
    sid = inv.get("subscription")
    if sid:
        return sid
    details = (inv.get("parent") or {}).get("subscription_details") or {}
    return details.get("subscription")


def _handle_event(event: dict) -> None:
    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        uid = (obj.get("metadata") or {}).get("uid") or obj.get("client_reference_id")
        plan = (obj.get("metadata") or {}).get("plan", "")
        if not uid:
            uid = _uid_for_customer(obj.get("customer", ""))
        if not uid:
            logger.warning("billing: checkout.completed with no resolvable uid")
            return
        if obj.get("mode") == "subscription" and obj.get("subscription"):
            sub = _as_dict(stripe.Subscription.retrieve(obj["subscription"]))
            _activate_subscription(uid, plan, sub)
        else:
            # One-time pass. Idempotent on the session id so a redelivered event
            # can't keep resetting the 30-day clock forward.
            session_id = obj.get("id")
            if session_id and _stored_field(uid, "lastPassSessionId") == session_id:
                return
            days = PLANS.get(plan, {}).get("days", 30)
            expiry = datetime.now(timezone.utc) + timedelta(days=days)
            # NOTE: do NOT null subscriptionId here. A one-time pass is only ever
            # for a non-subscriber (the checkout guard blocks it otherwise), so
            # there is no subscription to clear — and blindly clearing it would
            # orphan a still-live subscription that keeps charging.
            _set_plan(
                uid, plan="premium", planType=plan or "monthly_once",
                planExpiry=expiry.isoformat(), autoRenew=False,
                lastPassSessionId=session_id,
                planChosenAt=datetime.now(timezone.utc).isoformat(),
            )

    elif etype == "invoice.paid":
        # Subscription renewal — extend to the new period end.
        sub_id = _invoice_subscription_id(obj)
        uid = _uid_for_customer(obj.get("customer", ""))
        if not (uid and sub_id):
            logger.warning(
                f"billing: invoice.paid unresolved (uid={uid} sub={sub_id} "
                f"cust={obj.get('customer')}) — renewal not applied")
            return
        sub = _as_dict(stripe.Subscription.retrieve(sub_id))
        _activate_subscription(uid, (sub.get("metadata") or {}).get("plan", ""), sub)

    elif etype == "customer.subscription.updated":
        uid = (obj.get("metadata") or {}).get("uid") or _uid_for_customer(obj.get("customer", ""))
        # Only act on the user's CURRENT subscription — ignore stale/superseded ones.
        if uid and _stored_field(uid, "subscriptionId") == obj.get("id"):
            _set_plan(uid, autoRenew=not bool(obj.get("cancel_at_period_end")))

    elif etype == "customer.subscription.deleted":
        uid = (obj.get("metadata") or {}).get("uid") or _uid_for_customer(obj.get("customer", ""))
        # Downgrade ONLY if this is still their active subscription. A stale /
        # out-of-order deletion of a superseded sub must not revoke premium from
        # someone who has since re-subscribed or bought a one-time pass.
        if uid and _stored_field(uid, "subscriptionId") == obj.get("id"):
            _set_plan(uid, plan="free", autoRenew=False, subscriptionId=None, planExpiry=None)


def _activate_subscription(uid: str, plan: str, sub: dict) -> None:
    _set_plan(
        uid, plan="premium", planType=plan or "subscription",
        planExpiry=_subscription_period_end(sub, plan),
        autoRenew=not bool(sub.get("cancel_at_period_end")),
        subscriptionId=sub.get("id"),
        planChosenAt=datetime.now(timezone.utc).isoformat(),
    )
