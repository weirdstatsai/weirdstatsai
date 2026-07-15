from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("uvicorn.error")

# In-memory prompt cache — O(1) lookup, avoids Firestore round-trip on repeated prompts
_prompt_cache: dict[str, dict] = {}
_CACHE_MAX = 256


def normalize_prompt(prompt: str) -> str:
    """Lowercase, trim, collapse whitespace, strip trailing punctuation —
    so 'Deadliest animals?' and 'deadliest animals' hash the same."""
    s = prompt.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.rstrip("?.! ")
    return s


def prompt_hash(prompt: str) -> str:
    return hashlib.sha256(normalize_prompt(prompt).encode("utf-8")).hexdigest()

_db = None


def _get_db():
    global _db
    if _db is not None:
        return _db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "")
            if key_path and not os.path.isabs(key_path):
                key_path = os.path.abspath(
                    os.path.join(os.path.dirname(__file__), '..', key_path)
                )
            logger.info(f"Loading service account key from: {key_path}")
            if key_path and os.path.exists(key_path):
                cred = credentials.Certificate(key_path)
                logger.info("Using service account credentials")
            else:
                logger.warning(f"Key file not found at {key_path}, using ApplicationDefault")
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                "projectId": os.getenv("FIREBASE_PROJECT_ID", "weirdstatsai-aaaf7"),
            })

        _db = firestore.client()
        logger.info("Firestore client initialised")
    except Exception as e:
        logger.warning(f"Firestore unavailable — graphs will not be persisted: {e}")
        _db = None

    return _db


def find_cached_card(prompt: str) -> dict | None:
    """Dedup: return an existing card for this normalized prompt, or None.
    Checks in-memory cache first (O(1)), falls back to Firestore."""
    phash = prompt_hash(prompt)

    # L1: in-memory cache hit — no network round-trip
    if phash in _prompt_cache:
        logger.info(f"Memory cache hit {phash[:12]}")
        return _prompt_cache[phash]

    # L2: Firestore cache
    db = _get_db()
    if db is None:
        return None
    try:
        docs = (
            db.collection("stats")
            .where("promptHash", "==", phash)
            .where("status", "==", "completed")
            .limit(1)
            .get()
        )
        for doc in docs:
            card = doc.to_dict().get("data")
            if card:
                logger.info(f"Firestore cache hit {phash[:12]} -> stats/{doc.id}")
                _cache_put(phash, card)
                return card
    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")
    return None


def _cache_put(phash: str, card: dict) -> None:
    """Insert into memory cache, evict oldest if over limit."""
    if len(_prompt_cache) >= _CACHE_MAX:
        _prompt_cache.pop(next(iter(_prompt_cache)))
    _prompt_cache[phash] = card


def get_stored_card(card_id: str) -> dict | None:
    """Fetch a full stored card doc (top-level fields + `data`) by document id.
    Used by the SEO bot-snapshot + OG-image routes. Returns None if missing."""
    db = _get_db()
    if db is None:
        return None
    try:
        snap = db.collection("stats").document(card_id).get()
        if not snap.exists:
            return None
        return snap.to_dict()
    except Exception as e:
        logger.warning(f"get_stored_card failed for {card_id}: {e}")
        return None


def list_published_cards(limit: int = 5000) -> list[dict]:
    """Return published card docs for the dynamic sitemap: [{id, updatedAt}].
    Only cards a user explicitly published (not drafts/private/cache-only)."""
    db = _get_db()
    if db is None:
        return []
    try:
        docs = (
            db.collection("stats")
            .where("publishStatus", "==", "published")
            .limit(limit)
            .get()
        )
        out: list[dict] = []
        for doc in docs:
            d = doc.to_dict() or {}
            out.append({
                "id": doc.id,
                "updatedAt": d.get("updatedAt") or d.get("createdAt") or "",
            })
        return out
    except Exception as e:
        logger.warning(f"list_published_cards failed: {e}")
        return []


def save_graph(
    card: dict,
    prompt: str,
    uid: str | None = None,
    created_by_name: str | None = None,
) -> str:
    """Persist a generated WeirdCard to stats/{id}.

    Top-level fields: id, status, createdBy, createdAt, prompt, promptHash.
    All card content lives in the `data` map.
    """
    graph_id = str(uuid.uuid4())
    db = _get_db()
    if db is None:
        return graph_id

    try:
        now = datetime.now(timezone.utc).isoformat()
        doc_ref = db.collection("stats").document(graph_id)

        doc = {
            "id": graph_id,
            "status": "completed",
            "publishStatus": "draft",
            "createdBy": uid or created_by_name or "Anonymous",
            "createdByName": created_by_name or "",
            "createdAt": now,
            "prompt": prompt,
            "promptHash": prompt_hash(prompt),
            "data": card,  # full WeirdCard JSON lives here
        }
        doc_ref.set(doc)
        _cache_put(prompt_hash(prompt), card)
        logger.info(f"Card saved: stats/{graph_id} ({card.get('cardType')})")
    except Exception as e:
        logger.warning(f"Failed to save card to Firestore: {e}")

    return graph_id
