"""Two-step Metrics pipeline (Option A — direct OpenAI calls, no Agent Builder).

Step 1: Research Agent — Responses API + web_search -> plain-text brief.
Step 2: Format Agent   — Responses API, no tools     -> strict WeirdCard JSON.

The backend orchestrates both, then validates. Workflows (wf_ ids) are not used
because Agent Builder workflows can't be invoked via API.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from openai import AsyncOpenAI

from app.prompts import RESEARCH_PROMPT, FORMAT_PROMPT

_client: AsyncOpenAI | None = None

RESEARCH_MODEL = os.getenv("RESEARCH_MODEL", "gpt-4o")
FORMAT_MODEL = os.getenv("FORMAT_MODEL", "gpt-4o-mini")


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _today_line() -> str:
    now = datetime.now(timezone.utc).isoformat()
    return f"Current runtime date/time: {now}\nUse this for retrieval dates and freshness.\n"


MAX_WEB_SEARCHES = int(os.getenv("MAX_WEB_SEARCHES", "2"))


async def research_agent(prompt: str) -> str:
    """Step 1 — research with web_search. Returns a plain-text brief."""
    client = _get_client()
    user_msg = f"{_today_line()}\nQuestion: {prompt}"

    response = await client.responses.create(
        model=RESEARCH_MODEL,
        tools=[{"type": "web_search"}],
        instructions=RESEARCH_PROMPT,
        input=user_msg,
        max_tool_calls=MAX_WEB_SEARCHES,
    )
    return (response.output_text or "").strip()


async def format_agent(brief: str) -> dict:
    """Step 2 — turn the brief into strict WeirdCard JSON (no tools)."""
    client = _get_client()
    user_msg = (
        "Here is the verified research brief. Turn it into one WeirdStats card as raw JSON.\n\n"
        f"<<<\n{brief}\n>>>"
    )

    response = await client.responses.create(
        model=FORMAT_MODEL,
        instructions=FORMAT_PROMPT,
        input=user_msg,
        text={"format": {"type": "json_object"}},
    )
    return _parse_json(response.output_text or "")


def _parse_json(raw: str) -> dict:
    """Defensive parse — strip whitespace and any stray code fences."""
    s = (raw or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.lstrip().lower().startswith("json"):
            s = s.lstrip()[4:]
        s = s.strip()
    return json.loads(s)


async def request_chart_from_agent(prompt: str, preferred_type: str | None = None) -> dict:
    """Full pipeline: research -> format -> raw card dict (pre-validation).
    Raises on failure so the caller can fall back to the mock generator."""
    brief = await research_agent(prompt)
    card = await format_agent(brief)
    return card
