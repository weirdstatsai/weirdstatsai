"""Stripe billing — checkout sessions, customer portal, and webhook handling.

Premium is granted ONLY here, server-side, after Stripe confirms payment via a
signed webhook. The client can never mark itself premium (see firestore.rules).

Required env vars:
  STRIPE_SECRET_KEY       sk_live_… / sk_test_…
  STRIPE_WEBHOOK_SECRET   whsec_…  (from `stripe listen` or the dashboard endpoint)
  STRIPE_PRICE_ID         price_…  (the recurring Premium price)
Optional:
  BILLING_RETURN_URL      fallback return URL when the client doesn't send one
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from app.firestore_client import get_user, set_user_plan, verify_id_token

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _stripe():
    """Lazily configure and return the stripe module, or None if unconfigured."""
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        return None
    import stripe

    stripe.api_key = key
    return stripe


def _claims_from_auth(authorization: str | None) -> dict:
    """Verify the `Authorization: Bearer <firebase-id-token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    claims = verify_id_token(token)
    if not claims or "uid" not in claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return claims


def _return_base(return_url: str | None) -> str:
    """The app URL Stripe redirects back to, minus any query string."""
    base = (return_url or os.getenv("BILLING_RETURN_URL", "")).split("?")[0].rstrip("/")
    if not base:
        raise HTTPException(status_code=400, detail="No return URL provided")
    return base


def _iso_from_period_end(sub) -> str | None:
    ts = sub.get("current_period_end")
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


class CheckoutRequest(BaseModel):
    returnUrl: str | None = None


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    stripe = _stripe()
    if stripe is None:
        raise HTTPException(status_code=503, detail="Billing is not configured")
    price_id = os.getenv("STRIPE_PRICE_ID", "")
    if not price_id:
        raise HTTPException(status_code=503, detail="STRIPE_PRICE_ID is not set")

    claims = _claims_from_auth(authorization)
    uid = claims["uid"]
    base = _return_base(body.returnUrl)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            client_reference_id=uid,
            customer_email=claims.get("email") or None,
            success_url=f"{base}?checkout=success",
            cancel_url=f"{base}?checkout=cancelled",
            metadata={"uid": uid},
            subscription_data={"metadata": {"uid": uid}},
            allow_promotion_codes=True,
        )
    except Exception as e:
        logger.warning(f"Stripe checkout session failed: {e}")
        raise HTTPException(status_code=502, detail="Could not start checkout")

    return {"url": session.url, "id": session.id}


@router.post("/portal")
async def create_portal_session(
    body: CheckoutRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    """Open the Stripe customer portal so a member can manage/cancel their plan."""
    stripe = _stripe()
    if stripe is None:
        raise HTTPException(status_code=503, detail="Billing is not configured")

    claims = _claims_from_auth(authorization)
    user = get_user(claims["uid"]) or {}
    customer_id = user.get("stripeCustomerId")
    if not customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer for this account")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=_return_base(body.returnUrl),
        )
    except Exception as e:
        logger.warning(f"Stripe portal session failed: {e}")
        raise HTTPException(status_code=502, detail="Could not open billing portal")

    return {"url": session.url}


@router.post("/webhook")
async def webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict:
    """Stripe -> us. The ONLY place premium is granted or revoked."""
    stripe = _stripe()
    if stripe is None:
        raise HTTPException(status_code=503, detail="Billing is not configured")

    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        # Without the signing secret we can't trust the payload — refuse rather
        # than let anyone POST themselves premium.
        logger.warning("STRIPE_WEBHOOK_SECRET not set — rejecting webhook")
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, secret)
    except Exception as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event["type"]
    obj = event["data"]["object"]
    logger.info(f"Stripe webhook: {etype}")

    if etype == "checkout.session.completed":
        uid = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("uid")
        subscription_id = obj.get("subscription")
        if uid:
            expiry = None
            if subscription_id:
                try:
                    expiry = _iso_from_period_end(stripe.Subscription.retrieve(subscription_id))
                except Exception as e:
                    logger.warning(f"Could not retrieve subscription {subscription_id}: {e}")
            set_user_plan(uid, {
                "plan": "premium",
                "planExpiry": expiry,
                "stripeCustomerId": obj.get("customer"),
                "stripeSubscriptionId": subscription_id,
            })

    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        uid = (obj.get("metadata") or {}).get("uid")
        if uid:
            active = obj.get("status") in ("active", "trialing", "past_due")
            set_user_plan(uid, {
                "plan": "premium" if active else "free",
                "planExpiry": _iso_from_period_end(obj) if active else None,
            })

    elif etype == "customer.subscription.deleted":
        uid = (obj.get("metadata") or {}).get("uid")
        if uid:
            set_user_plan(uid, {"plan": "free", "planExpiry": None})

    return {"received": True}
