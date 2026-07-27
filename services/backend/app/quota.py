"""Server-side identity + generation quota.

Generation costs real money (the OpenAI `web_search` tool dominates at ~$0.01
per call), and `/api/generate/*` used to be completely open: no auth, no limit,
and the caller's `uid` was read straight from the request BODY. Anyone could
curl it in a loop and run up the bill; the "3 cards a day" rule existed only in
the Angular client, which an attacker simply doesn't run.

This module makes the server the authority:
  * `uid_from_request` trusts a verified Firebase ID token and nothing else.
  * `consume_quota` atomically checks-and-increments the caller's window in
    Firestore, so parallel requests can't both slip through on the same slot.

Signed-out visitors are still allowed a small taste (the try-before-signup
funnel is deliberate), metered per client IP instead of per account.
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("uvicorn.error")

# Mirrors FREE_WINDOW_DAYS / FREE_WINDOW_LIMIT in the Angular MembershipService.
FREE_WINDOW_DAYS = int(os.getenv("FREE_WINDOW_DAYS", "1"))
FREE_WINDOW_LIMIT = int(os.getenv("FREE_WINDOW_LIMIT", "3"))
# Signed-out visitors get less: an IP is far weaker identity than an account.
GUEST_WINDOW_LIMIT = int(os.getenv("GUEST_WINDOW_LIMIT", "2"))
# Escape hatch for local development against the emulator/dev server.
QUOTA_ENFORCED = os.getenv("QUOTA_ENFORCED", "1") != "0"
# Shared secret for internal tooling (the pre-deploy eval harness) so a test run
# doesn't burn the guest allowance. UNSET by default — when the env var is
# absent no header value can bypass the gate.
INTERNAL_KEY = os.getenv("INTERNAL_QUOTA_KEY", "")


def is_internal(headers) -> bool:
    """True only when a shared secret is configured AND the caller presents it."""
    if not INTERNAL_KEY:
        return False
    got = headers.get("x-internal-key") or headers.get("X-Internal-Key") or ""
    return bool(got) and got == INTERNAL_KEY


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        d = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def uid_from_request(authorization: str | None) -> str | None:
    """The caller's uid, or None for a signed-out visitor.

    Only a Firebase ID token is trusted — never a uid from the request body,
    which the client controls. A malformed or expired token is treated as
    signed-out rather than an error, so a stale session degrades to the guest
    allowance instead of hard-failing.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        from firebase_admin import auth as fb_auth
        from app.firestore_client import _get_db
        _get_db()                       # ensures firebase_admin is initialised
        return fb_auth.verify_id_token(token).get("uid")
    except Exception:
        logger.info("Rejected an unverifiable ID token", exc_info=False)
        return None


def client_ip(headers: dict, fallback: str | None) -> str:
    """Caller IP. Behind Cloud Run the real address is the first X-Forwarded-For
    entry; the socket peer is Google's front end."""
    fwd = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return fallback or "unknown"


def _is_premium(data: dict) -> bool:
    if (data or {}).get("plan") != "premium":
        return False
    expiry = _parse((data or {}).get("planExpiry"))
    return expiry is None or expiry > _now()


def consume_quota(uid: str | None, ip: str) -> tuple[bool, str]:
    """Atomically consume one generation. Returns (allowed, message).

    Runs in a Firestore transaction so two simultaneous requests can't both read
    "2 used" and both write "3" — the classic way a client-side limit gets
    beaten even without malice.
    """
    if not QUOTA_ENFORCED:
        return True, ""

    try:
        from firebase_admin import firestore
        from app.firestore_client import _get_db

        db = _get_db()
        signed_in = bool(uid)
        if signed_in:
            ref = db.collection("users").document(uid)
            limit = FREE_WINDOW_LIMIT
        else:
            # Hash the IP: we need a stable bucket key, not a record of who.
            key = hashlib.sha256(f"ip:{ip}".encode()).hexdigest()[:32]
            ref = db.collection("rateLimits").document(key)
            limit = GUEST_WINDOW_LIMIT

        window = timedelta(days=FREE_WINDOW_DAYS)
        transaction = db.transaction()

        @firestore.transactional
        def _run(txn) -> tuple[bool, str]:
            snap = ref.get(transaction=txn)
            data = snap.to_dict() if snap.exists else {}

            if signed_in and _is_premium(data):
                txn.set(ref, {"totalGenerated": (data.get("totalGenerated") or 0) + 1},
                        merge=True)
                return True, ""

            start = _parse(data.get("windowStart"))
            used = int(data.get("windowCount") or 0)
            now = _now()
            if start is None or now - start >= window:
                start, used = now, 0        # window elapsed — fresh allowance

            if used >= limit:
                resets = start + window
                mins = max(1, int((resets - now).total_seconds() // 60))
                hrs, rem = divmod(mins, 60)
                when = f"{hrs}h {rem}m" if hrs else f"{rem}m"
                return False, (
                    f"You've used your {limit} free cards. More in {when}."
                    if signed_in else
                    f"You've used your {limit} free cards. Sign in for more."
                )

            txn.set(ref, {
                "windowStart": start.isoformat(),
                "windowCount": used + 1,
                "totalGenerated": (data.get("totalGenerated") or 0) + 1,
            }, merge=True)
            return True, ""

        return _run(transaction)

    except Exception:
        # Never let a metering failure take generation down — log and allow.
        logger.warning("Quota check failed; allowing the request", exc_info=True)
        return True, ""
