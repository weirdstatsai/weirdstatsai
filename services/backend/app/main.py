import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, Response, StreamingResponse

from app.agent_client import request_chart_from_agent, research_agent, format_agent
from app.firestore_client import (
    save_graph, find_cached_card, get_stored_card, list_published_cards,
)
from app.validator import validate_card
from app.schemas import WeirdCard, GenerateRequest
from app import seo

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="WeirdStats Backend")

import os

# Local dev + hosted frontend origins. Add extras via CORS_ORIGINS (comma-separated).
_default_origins = [
    "http://localhost:4200", "http://localhost:8100",
    "http://localhost:8080", "capacitor://localhost", "ionic://localhost",
    # Custom domain + new project hosting
    "https://weirdstats.ai", "https://www.weirdstats.ai",
    "https://weirdstats-ai.web.app", "https://weirdstats-ai.firebaseapp.com",
    # Legacy project (kept until fully retired)
    "https://weirdstatsai-aaaf7.web.app",
    "https://weirdstatsai-aaaf7.firebaseapp.com",
]
_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# ── SEO: bot-snapshot rendering for shareable card URLs ─────────────────────
# Firebase Hosting rewrites /card/**, /share/**, /og/**, /sitemap-cards.xml to
# this service. Bots get purpose-built HTML/images; humans get the SPA shell.

async def _card_route(card_id: str, request: Request) -> Response:
    # These responses branch on User-Agent (bot snapshot vs SPA shell). Firebase's
    # CDN caches by URL, NOT by UA, so a cached bot snapshot would be served to
    # humans (and vice-versa). Force `no-store` so every request reaches Cloud Run
    # and gets UA-correct content. The og-image + sitemap routes below don't
    # branch on UA, so they stay publicly cacheable.
    no_store = {"Cache-Control": "private, no-store"}
    ua = request.headers.get("user-agent", "")
    if seo.is_bot(ua):
        doc = get_stored_card(card_id)
        html = seo.build_snapshot_html(card_id, doc)
        return HTMLResponse(html, headers=no_store)
    shell = await seo.get_spa_shell()
    return HTMLResponse(shell, headers=no_store)


@app.get("/card/{card_id}")
async def card_page(card_id: str, request: Request) -> Response:
    return await _card_route(card_id, request)


@app.get("/share/{card_id}")
async def share_page(card_id: str, request: Request) -> Response:
    return await _card_route(card_id, request)


@app.get("/og/card/{ref}")
async def og_card_image(ref: str) -> Response:
    card_id = ref[:-4] if ref.endswith(".png") else ref
    doc = get_stored_card(card_id)
    png = seo.compose_og_image(doc)
    if png is None:
        return RedirectResponse(seo.DEFAULT_OG_IMAGE, status_code=307)
    return Response(png, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/sitemap-cards.xml")
async def sitemap_cards() -> Response:
    xml = seo.build_cards_sitemap(list_published_cards())
    return Response(xml, media_type="application/xml",
                    headers={"Cache-Control": "public, max-age=3600"})


def _fallback_card(prompt: str, reason: str) -> dict:
    """Minimal valid card when the pipeline fails — keeps the app responsive."""
    return validate_card({
        "status": "needs_review",
        "title": prompt.strip()[:80] or "Couldn't generate a card",
        "cardType": "fact",
        "presentationType": "fact",
        "insight": f"We couldn't verify data for this one right now. ({reason})",
        "tags": ["stats"],
        "weirdScore": 3,
        "uiMeta": {"category": "Other", "icon": "🤔", "accentColor": "#6C5CE7"},
        "dataMeta": {"dataMode": "estimated", "confidence": "low"},
    })


def _sse(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **payload})}\n\n"


@app.post("/api/generate/stream")
async def generate_stream(req: GenerateRequest) -> StreamingResponse:
    async def stream() -> AsyncGenerator[str, None]:
        # Cache hit — return instantly
        cached = find_cached_card(req.prompt)
        if cached:
            yield _sse("card", {"data": cached})
            return

        # Step 1: research
        yield _sse("status", {"message": "Searching the web…", "step": 1})
        try:
            brief = await research_agent(req.prompt)
        except Exception as e:
            yield _sse("error", {"message": "Research failed. Try again."})
            return

        # Step 2: format — retry once before surfacing an error, since the
        # format/validate step occasionally fails transiently on the first try.
        yield _sse("status", {"message": "Building your card…", "step": 2})
        try:
            raw = await format_agent(brief)
            card = validate_card(raw)
        except Exception:
            logger.warning("Stream format failed, retrying once", exc_info=True)
            try:
                raw = await format_agent(brief)
                card = validate_card(raw)
            except Exception:
                logger.warning("Stream format failed twice", exc_info=True)
                yield _sse("error", {"message": "Could not format card. Try again."})
                return

        # Step 3: save a cache-only copy (not user-owned) + return.
        # Drafts live on the device; a card only enters a user's collection
        # when they explicitly Save publicly/privately from the app.
        yield _sse("status", {"message": "Almost done…", "step": 3})
        graph_id = save_graph(card, req.prompt, uid=None)
        result = {
            **card,
            "id": graph_id,
            "prompt": req.prompt,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        yield _sse("card", {"data": result})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/generate", response_model=WeirdCard)
async def generate(req: GenerateRequest) -> dict:
    # 1. Dedup — serve an existing card for this question if we have one.
    cached = find_cached_card(req.prompt)
    if cached:
        return cached

    # 2. Run the two-step pipeline, validate. Retry once, then fall back.
    card: dict
    try:
        raw = await request_chart_from_agent(req.prompt, req.preferredType)
        card = validate_card(raw)
    except Exception:
        logger.warning("Pipeline failed (attempt 1), retrying once", exc_info=True)
        try:
            raw = await request_chart_from_agent(req.prompt, req.preferredType)
            card = validate_card(raw)
        except Exception as e:
            logger.warning("Pipeline failed (attempt 2), using fallback", exc_info=True)
            card = _fallback_card(req.prompt, str(e)[:80])

    # 3. Persist a cache-only copy (not user-owned) and return.
    graph_id = save_graph(card, req.prompt, uid=None)
    return {
        **card,
        "id": graph_id,
        "prompt": req.prompt,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
