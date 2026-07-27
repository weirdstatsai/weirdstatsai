"""Invariants every generated card must satisfy to be renderable and honest.

Pure functions over a card dict — no network, no OpenAI. `run_eval.py` fetches
cards and feeds them here; you can also re-check saved fixtures offline for free.

Each check returns a list of failure strings (empty == passed). They encode the
rules that live in prompts.py and the frontend renderers, so a drift between the
two shows up here instead of on a user's screen.
"""

from __future__ import annotations

CARD_TYPES = {"chart", "ranking", "kpi", "versus", "fact", "table", "map"}
DATA_MODES = {"researched", "cached", "estimated", "proxy", "unsupported"}
CONFIDENCE = {"high", "medium", "low"}
STATUSES = {"success", "needs_review", "unsupported"}
SOURCE_TYPES = {"official", "research", "company", "database", "news", "other"}

# Names the agent reaches for when it has no real datum. Any of these means the
# card is padded rather than researched.
PLACEHOLDERS = {
    "country a", "country b", "country c", "item 1", "item 2", "item 3",
    "n/a", "na", "unknown", "tbd", "example", "placeholder", "lorem ipsum",
}

_YEARISH = tuple(str(y) for y in range(1600, 2101))


def _rows(card: dict) -> list:
    return [r for r in (card.get("rows") or []) if isinstance(r, dict)]


def _labelled(card: dict) -> list:
    return [r for r in _rows(card) if str(r.get("label") or "").strip()]


def _values(card: dict) -> list:
    out = []
    for r in _labelled(card):
        try:
            out.append(float(r.get("value")))
        except (TypeError, ValueError):
            pass
    return out


def check_enums(card: dict) -> list[str]:
    """Every constrained field parses. A miss here is what crashed generation for
    every opinion question (dataMode='unsupported' wasn't in the enum)."""
    f = []
    if card.get("cardType") not in CARD_TYPES:
        f.append(f"cardType {card.get('cardType')!r} not a known type")
    if card.get("status") not in STATUSES:
        f.append(f"status {card.get('status')!r} not a known status")
    dm = card.get("dataMeta") or {}
    if dm.get("dataMode") not in DATA_MODES:
        f.append(f"dataMeta.dataMode {dm.get('dataMode')!r} not a known mode")
    if dm.get("confidence") not in CONFIDENCE:
        f.append(f"dataMeta.confidence {dm.get('confidence')!r} not a known level")
    for s in (card.get("sourceMeta") or {}).get("sources") or []:
        if s.get("sourceType") not in SOURCE_TYPES:
            f.append(f"source {s.get('name')!r} has sourceType {s.get('sourceType')!r}")
    return f


def check_renderable(card: dict) -> list[str]:
    """The card carries the data its own type needs to draw. Mirrors the
    backend's card_data_ok and the frontend's cardHasData."""
    t = card.get("cardType")
    rows, f = _labelled(card), []
    if t == "chart":
        labels = card.get("labels") or []
        sets = card.get("datasets") or []
        if not labels:
            f.append("chart has no labels")
        if not any((d.get("data") or []) for d in sets):
            f.append("chart has no data points")
        for d in sets:
            if labels and len(d.get("data") or []) != len(labels):
                f.append(f"labels ({len(labels)}) != data ({len(d.get('data') or [])})")
    elif t in ("ranking", "table", "map"):
        if not rows:
            f.append(f"{t} has no labelled rows")
    elif t == "versus":
        if len(rows) != 2:
            f.append(f"versus needs exactly 2 rows, has {len(rows)}")
    elif t == "kpi":
        if (card.get("metric") or {}).get("value") is None and not rows:
            f.append("kpi has neither metric.value nor a row")
    elif t == "fact":
        if not str(card.get("insight") or "").strip():
            f.append("fact has no insight")
    return f


def check_no_placeholders(card: dict) -> list[str]:
    """No invented filler standing in for research."""
    f = []
    for r in _rows(card):
        label = str(r.get("label") or "").strip()
        if not label:
            f.append("a row has an empty label")
        elif label.lower() in PLACEHOLDERS:
            f.append(f"placeholder row label {label!r}")
    for lbl in card.get("labels") or []:
        if str(lbl).strip().lower() in PLACEHOLDERS:
            f.append(f"placeholder chart label {lbl!r}")
    return f


def check_row_counts(card: dict) -> list[str]:
    """ROW-COUNT RULE: ranking is short, table is long. map is exempt."""
    t, n, f = card.get("cardType"), len(_labelled(card)), []
    if t == "ranking" and n > 5:
        f.append(f"ranking has {n} rows (max 5 — should be a table)")
    if t == "table" and 0 < n < 6:
        f.append(f"table has {n} rows (min 6 — should be a ranking)")
    return f


def check_curated_list_has_notes(card: dict) -> list[str]:
    """LIST-vs-METRIC RULE. When there's no honest metric the agent may emit
    all-zeros, echo the rank, or repeat one figure — all fine, but only if each
    row carries a qualitative note, or the card renders as a column of 0s."""
    if card.get("cardType") not in ("ranking", "table"):
        return []
    vals, rows = _values(card), _labelled(card)
    if len(vals) < 2 or len(vals) != len(rows):
        return []
    all_zero = all(v == 0 for v in vals)
    rank_echo = all(v == i + 1 for i, v in enumerate(vals))
    identical = len(set(vals)) == 1
    if not (all_zero or rank_echo or identical):
        return []
    shape = "all-zero" if all_zero else "rank-as-value" if rank_echo else "identical values"
    missing = [r.get("label") for r in rows if not str(r.get("extra") or "").strip()]
    if missing:
        return [f"no real metric ({shape}) but {len(missing)} row(s) have no `extra` note: {missing[:3]}"]
    return []


def check_time_series_chart_type(card: dict) -> list[str]:
    """TIME SERIES RULE: years are not parts of a whole, so never pie/doughnut."""
    if card.get("cardType") != "chart":
        return []
    labels = [str(x) for x in (card.get("labels") or [])]
    if len(labels) < 2:
        return []
    yearish = sum(1 for l in labels if any(y in l for y in _YEARISH))
    if yearish >= len(labels) * 0.6 and card.get("chartType") in ("pie", "doughnut"):
        return [f"time series drawn as {card.get('chartType')}"]
    return []


def check_copy(card: dict) -> list[str]:
    f = []
    if not str(card.get("title") or "").strip():
        f.append("card has no title")
    if card.get("status") == "success" and not (card.get("sourceMeta") or {}).get("sources"):
        f.append("status=success but no sources")
    return f


ALL_CHECKS = [
    check_enums,
    check_renderable,
    check_no_placeholders,
    check_row_counts,
    check_curated_list_has_notes,
    check_time_series_chart_type,
    check_copy,
]


def check_card(card: dict) -> list[str]:
    """Every failure for one card, as human-readable strings."""
    out: list[str] = []
    for fn in ALL_CHECKS:
        try:
            out.extend(fn(card))
        except Exception as e:                      # a check must never mask a card
            out.append(f"{fn.__name__} raised {type(e).__name__}: {e}")
    return out
