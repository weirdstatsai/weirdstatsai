import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent_client import request_chart_from_agent, research_agent, format_agent
from app.firestore_client import save_graph, find_cached_card
from app.validator import validate_card
from app.schemas import WeirdCard, GenerateRequest

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="WeirdStats Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200", "http://localhost:8100",
        "http://localhost:8080", "capacitor://localhost", "ionic://localhost",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


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

        # Step 2: format
        yield _sse("status", {"message": "Building your card…", "step": 2})
        try:
            raw = await format_agent(brief)
            card = validate_card(raw)
        except Exception as e:
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
