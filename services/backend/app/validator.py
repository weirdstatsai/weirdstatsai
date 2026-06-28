"""Validator / normalizer for cards from the Format Agent.

Encodes the auto-fixes identified during testing so every card is frontend-safe
before it reaches Firestore. Returns a clean dict matching the WeirdCard schema.
"""

from __future__ import annotations

import re
from datetime import datetime

from app.schemas import WeirdCard

ACCENT_COLORS = ["#6C5CE7", "#378ADD", "#1D9E75", "#D85A30", "#BA7517"]
CARD_TYPES = {"chart", "ranking", "kpi", "versus", "fact", "table", "map"}
SOURCE_TYPES = {"official", "research", "company", "database", "news", "other"}
ROW_TYPES = {"ranking", "table", "map", "versus", "kpi"}

# Known country/territory names — used to auto-detect geographic cards
COUNTRY_NAMES = {
    "afghanistan","albania","algeria","angola","argentina","armenia","australia","austria",
    "azerbaijan","bahamas","bahrain","bangladesh","barbados","belarus","belgium","belize",
    "bhutan","bolivia","bosnia","botswana","brazil","brunei","bulgaria","burkina faso",
    "cambodia","cameroon","canada","central african republic","chad","chile","china",
    "colombia","congo","cook islands","costa rica","croatia","cuba","cyprus","czechia",
    "czech republic","denmark","democratic republic of congo","democratic republic of the congo",
    "djibouti","dominican republic","ecuador","egypt","el salvador","eritrea","estonia",
    "ethiopia","fiji","finland","france","georgia","germany","ghana","greece","guatemala",
    "guyana","haiti","honduras","hungary","iceland","india","indonesia","iran","iraq",
    "ireland","israel","italy","jamaica","japan","jordan","kazakhstan","kenya","kiribati",
    "north korea","south korea","kuwait","laos","latvia","lebanon","libya","lithuania",
    "luxembourg","madagascar","malaysia","maldives","mali","malta","marshall islands",
    "mauritius","mexico","micronesia","federated states of micronesia","moldova","mongolia",
    "morocco","mozambique","myanmar","namibia","nauru","nepal","netherlands","new zealand",
    "nicaragua","niger","nigeria","niue","norway","oman","pakistan","palau","panama",
    "papua new guinea","paraguay","peru","philippines","poland","portugal","qatar",
    "republic of congo","romania","russia","rwanda","saudi arabia","senegal","serbia",
    "sierra leone","singapore","slovakia","solomon islands","somalia","south africa",
    "south korea","south sudan","spain","sri lanka","sudan","suriname","sweden",
    "switzerland","syria","taiwan","tajikistan","tanzania","thailand","timor-leste",
    "tokelau","tonga","trinidad and tobago","tunisia","turkey","turkiye","tuvalu",
    "uganda","ukraine","united arab emirates","uae","united kingdom","uk","great britain",
    "united states","usa","us","united states of america","uruguay","uzbekistan",
    "vanuatu","venezuela","vietnam","american samoa","samoa","new caledonia",
    "french polynesia","guam","puerto rico","yemen","zambia","zimbabwe",
}


def _is_geographic_rows(rows: list) -> bool:
    """Return True if the majority of row labels are country/territory names."""
    if not rows:
        return False
    matches = sum(
        1 for r in rows
        if str(r.get("label", "")).lower().strip() in COUNTRY_NAMES
    )
    return matches >= max(1, len(rows) * 0.6)


def _iso_date(raw: str) -> str:
    """Coerce any date string to YYYY-MM-DD; leave empty if unparseable."""
    if not raw:
        return ""
    raw = raw.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw  # keep original if we can't parse it


def validate_card(card: dict) -> dict:
    """Normalize a raw agent card into a clean, schema-valid dict."""
    c = dict(card or {})

    # cardType
    ctype = str(c.get("cardType", "fact")).lower()
    if ctype not in CARD_TYPES:
        ctype = "fact"

    rows = c.get("rows") or []

    # Geographic override: if rows are country names, force map regardless of what agent said
    if isinstance(rows, list) and ctype in ("ranking", "table") and _is_geographic_rows(rows):
        ctype = "map"

    # Row-count rule: >5 non-geographic rows must be a table
    if isinstance(rows, list) and len(rows) > 5 and ctype == "ranking":
        ctype = "table"
        c["presentationType"] = "top-10" if len(rows) <= 10 else "top-25"

    c["cardType"] = ctype

    # chartType only for chart/ranking/map
    if ctype not in ("chart", "ranking", "map"):
        c["chartType"] = None

    # accentColor must be one of the palette
    ui = dict(c.get("uiMeta") or {})
    accent = str(ui.get("accentColor", "")).upper()
    if accent not in ACCENT_COLORS:
        accent = ACCENT_COLORS[0]
    ui["accentColor"] = accent
    c["uiMeta"] = ui

    # weirdScore clamp to int 0-10
    try:
        score = int(round(float(c.get("weirdScore", 5))))
    except (TypeError, ValueError):
        score = 5
    c["weirdScore"] = max(0, min(10, score))

    # labels/data length must match (truncate to the shorter)
    labels = c.get("labels") or []
    datasets = c.get("datasets") or []
    if labels and datasets:
        for ds in datasets:
            data = ds.get("data") or []
            n = min(len(labels), len(data))
            if len(data) != len(labels):
                ds["data"] = data[:n]
        c["labels"] = labels[: min(len(labels), max((len(d.get("data") or []) for d in datasets), default=0))] or labels
    c["datasets"] = datasets

    # dataMeta: isProxy false => proxyExplanation ""
    dm = dict(c.get("dataMeta") or {})
    if not dm.get("isProxy"):
        dm["proxyExplanation"] = ""
    if dm.get("confidence") not in ("high", "medium", "low"):
        dm["confidence"] = "medium"
    c["dataMeta"] = dm

    # sourceMeta: coerce unknown source types, ISO-normalize dates
    sm = dict(c.get("sourceMeta") or {})
    sources = []
    for s in sm.get("sources") or []:
        s = dict(s)
        if s.get("sourceType") not in SOURCE_TYPES:
            s["sourceType"] = "other"
        s["retrievedAt"] = _iso_date(str(s.get("retrievedAt", "")))
        sources.append(s)
    sm["sources"] = sources
    c["sourceMeta"] = sm

    # ── MAP card: normalise rows ──────────────────────────────────────────
    # If agent produced labels+datasets instead of rows (old format), convert.
    if ctype == "map":
        existing_rows = c.get("rows") or []
        if not existing_rows and labels and datasets:
            data = (datasets[0].get("data") or []) if datasets else []
            unit_str = (datasets[0].get("label") or "") if datasets else ""
            existing_rows = [
                {"rank": i + 1, "label": lbl, "value": data[i] if i < len(data) else 0,
                 "unit": unit_str, "extra": ""}
                for i, lbl in enumerate(labels)
            ]
        # Ensure extra is always a string (ISO numeric id)
        for row in existing_rows:
            row["extra"] = str(row.get("extra") or "")
        c["rows"] = existing_rows

    # status sanity: success requires at least one source
    status = c.get("status", "success")
    if status == "success" and not sources:
        status = "needs_review"
    c["status"] = status

    # Run through Pydantic to fill defaults and guarantee shape, then dump.
    return WeirdCard(**c).model_dump()
