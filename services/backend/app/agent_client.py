"""Two-step Metrics pipeline (Option A — direct OpenAI calls, no Agent Builder).

Step 1: Research Agent — Responses API + web_search -> plain-text brief.
Step 2: Format Agent   — Responses API, no tools     -> strict WeirdCard JSON.

The backend orchestrates both, then validates. Workflows (wf_ ids) are not used
because Agent Builder workflows can't be invoked via API.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from openai import AsyncOpenAI

import base64

from app.prompts import RESEARCH_PROMPT, FORMAT_PROMPT, CLASSIFY_PROMPT, DOC_EXTRACT_PROMPT

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None

RESEARCH_MODEL = os.getenv("RESEARCH_MODEL", "gpt-4o")
FORMAT_MODEL = os.getenv("FORMAT_MODEL", "gpt-4o-mini")
# Map cards must transcribe a full 30-40 country table into rows. gpt-4o-mini
# does this unreliably (it truncates to ~5 or emits zero-value rows), so map
# formatting uses the stronger model. Other card types stay on the cheap one.
FORMAT_MAP_MODEL = os.getenv("FORMAT_MAP_MODEL", "gpt-4o")
CLASSIFY_MODEL = os.getenv("CLASSIFY_MODEL", "gpt-4o-mini")
# Document extraction reads tables/charts/scans via native PDF (vision) input —
# worth the bigger model. It runs once per import; the per-card formatting
# stays on the cheap model.
DOC_MODEL = os.getenv("DOC_MODEL", "gpt-4o")

MAX_DOC_FINDINGS = int(os.getenv("MAX_DOC_FINDINGS", "8"))

VALID_CARD_TYPES = {"chart", "ranking", "kpi", "versus", "fact", "table", "map"}


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


async def classify_card_type(prompt: str, brief: str | None = None) -> str | None:
    """Step 1.5 — dedicated cardType decision (temperature 0, tiny + cheap).

    Splitting this out of the big Format prompt makes the type choice far more
    reliable: one model, one job. Returns a valid cardType or None on any
    failure — callers must treat None as "let the Format Agent decide" so the
    pipeline never breaks on a classifier hiccup.
    """
    client = _get_client()
    # The API requires the word "JSON" in the input when text.format is json_object.
    user_msg = f"Classify into the cardType JSON.\nQ: {prompt.strip()}"
    if brief:
        # Give the classifier the researched row shape — row count and whether
        # labels are geographic decide ranking vs table vs map.
        user_msg += f"\n\nDATA (from research):\n{brief[:2000]}"
    try:
        response = await client.responses.create(
            model=CLASSIFY_MODEL,
            instructions=CLASSIFY_PROMPT,
            input=user_msg,
            temperature=0,
            text={"format": {"type": "json_object"}},
        )
        card_type = _parse_json(response.output_text or "").get("cardType")
        return card_type if card_type in VALID_CARD_TYPES else None
    except Exception:
        return None


async def format_agent(brief: str, card_type: str | None = None) -> dict:
    """Step 2 — turn the brief into strict WeirdCard JSON (no tools).

    When the classify step supplied a cardType, it is passed as a constraint
    rather than left to this agent's judgment.
    """
    client = _get_client()
    user_msg = (
        "Here is the verified research brief. Turn it into one WeirdStats card as raw JSON.\n\n"
        f"<<<\n{brief}\n>>>"
    )
    if card_type in VALID_CARD_TYPES:
        user_msg += (
            f"\n\nREQUIRED CARD TYPE: cardType MUST be \"{card_type}\" — it was chosen by a "
            "dedicated classification step. Pick presentationType, chartType, and row count "
            "consistent with it. Deviate ONLY if the brief's data makes this type impossible "
            "(and then follow the ROW-COUNT and MAP rules)."
        )

    response = await client.responses.create(
        # Map cards need reliable multi-row transcription → stronger model.
        model=FORMAT_MAP_MODEL if card_type == "map" else FORMAT_MODEL,
        instructions=FORMAT_PROMPT,
        input=user_msg,
        # Low but non-zero: the data-fill step should be near-deterministic so it
        # doesn't occasionally emit hollow labels/datasets, while keeping a little
        # room for the insight's wording.
        temperature=0.3,
        text={"format": {"type": "json_object"}},
    )
    return _parse_json(response.output_text or "")


async def format_validated(brief: str, card_type: str | None = None) -> dict:
    """Format → validate → guarantee the card actually has renderable data.

    The Format Agent occasionally returns a well-formed but hollow card (a rich
    story with empty labels/datasets/rows). Schema validation alone never caught
    this, so it reached the UI as a "No data available" shell. Here we gate on
    card_data_ok: if the first attempt is hollow we retry the format step once,
    and if it's still hollow we degrade to the richest type the present data
    supports. The returned card is always validated and always renderable.
    """
    from app.validator import validate_card, card_data_ok, degrade_card

    raw = await format_agent(brief, card_type)
    card = validate_card(raw)
    if card_data_ok(card):
        return card

    logger.info("format_validated: hollow %s card, repairing", card.get("cardType"))
    raw = await format_agent(brief, card_type)
    card = validate_card(raw)
    if card_data_ok(card):
        return card

    logger.warning("format_validated: still hollow after retry, degrading %s", card.get("cardType"))
    return degrade_card(card)


def _parse_json(raw: str) -> dict:
    """Defensive parse — strip whitespace and any stray code fences."""
    s = (raw or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.lstrip().lower().startswith("json"):
            s = s.lstrip()[4:]
        s = s.strip()
    return json.loads(s)


# Bound the tokens a text-based document can consume (~15k tokens).
MAX_DOC_TEXT_CHARS = int(os.getenv("MAX_DOC_TEXT_CHARS", "60000"))


async def doc_agent(
    filename: str,
    pdf_bytes: bytes | None = None,
    text: str | None = None,
    max_findings: int | None = None,
) -> dict:
    """Document Stats Agent — reads a document and returns:
        {"documentTitle": str, "findings": [{"question", "shape", "brief"}, ...]}

    PDFs are sent natively (text + vision, so tables, charts, and scanned pages
    all work). Word/CSV/Excel/plain-text arrive as pre-extracted `text`.
    Each finding's `brief` uses the same labeled-sections format the Format
    Agent already consumes, so downstream is classify -> format -> validate,
    identical to the single-prompt pipeline. Raises on failure.
    """
    client = _get_client()
    today = datetime.now(timezone.utc).date().isoformat()
    # A client-supplied cap (project's remaining space) can lower the ceiling,
    # never raise it.
    limit = min(MAX_DOC_FINDINGS, max_findings) if max_findings else MAX_DOC_FINDINGS
    instructions = DOC_EXTRACT_PROMPT.format(
        max_findings=limit,
        doc_name=filename,
        today=today,
    )

    if pdf_bytes is not None:
        data_url = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode()
        content = [
            {"type": "input_file", "filename": filename, "file_data": data_url},
            {"type": "input_text",
             "text": "Extract the stat-worthy findings from this document as the JSON described."},
        ]
    else:
        content = [
            {"type": "input_text",
             "text": "Document contents below. Extract the stat-worthy findings as the JSON described.\n\n"
                     f"<<<\n{(text or '')[:MAX_DOC_TEXT_CHARS]}\n>>>"},
        ]

    response = await client.responses.create(
        model=DOC_MODEL,
        instructions=instructions,
        input=[{"role": "user", "content": content}],
        text={"format": {"type": "json_object"}},
    )
    result = _parse_json(response.output_text or "")
    findings = result.get("findings")
    if not isinstance(findings, list):
        raise ValueError("doc_agent returned no findings list")
    # Defensive cap + shape filter so one bad extraction can't flood the import.
    result["findings"] = [
        f for f in findings
        if isinstance(f, dict) and f.get("brief") and f.get("question")
    ][:limit]
    return result


async def request_chart_from_agent(prompt: str, preferred_type: str | None = None) -> dict:
    """Full pipeline: research -> classify -> format -> validated, renderable card.
    Raises on failure so the caller can fall back to the mock generator."""
    brief = await research_agent(prompt)
    card_type = await classify_card_type(prompt, brief)
    return await format_validated(brief, card_type)
