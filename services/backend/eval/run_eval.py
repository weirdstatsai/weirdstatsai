#!/usr/bin/env python3
"""Pre-deploy check: run one prompt per card shape through the real pipeline and
assert the output is renderable and honest.

    python eval/run_eval.py                 # against prod
    python eval/run_eval.py --local         # against http://localhost:8000
    python eval/run_eval.py --offline       # re-check saved cards, no API spend
    python eval/run_eval.py --only map kpi  # just those shapes

Exits non-zero if any card fails, so it can gate a deploy. Every response is
saved to eval/out/<shape>.json — a failure can then be re-checked offline for
free while you iterate on the fix.

Costs roughly one web-search-backed generation per prompt (~$0.02-0.04 each),
so a full run is well under a dollar. Cached prompts return instantly and free.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from invariants import check_card                                   # noqa: E402

PROD = "https://weirdstats-api-636419392315.us-central1.run.app"
LOCAL = "http://localhost:8000"
OUT = pathlib.Path(__file__).resolve().parent / "out"

# One prompt per shape the pipeline can produce. Keep this list small and broad:
# the point is coverage of SHAPES, not of topics.
CASES: list[tuple[str, str, str | None]] = [
    # (shape, prompt, expected cardType or None if the classifier may reasonably vary)
    ("kpi",          "How many bones are in the human foot?",              "kpi"),
    ("chart",        "World population growth since 1950",                 "chart"),
    ("ranking",      "Top 5 fastest animals on Earth",                     "ranking"),
    ("curated-list", "Top family SUVs for 2026",                           None),
    ("table",        "Top 10 most spoken languages in the world",          "table"),
    ("map",          "Which country drinks the most coffee?",              "map"),
    ("versus",       "Ronaldo vs Messi career goals",                      "versus"),
    ("fact",         "Why do cats purr?",                                  None),
    ("opinion",      "Who is the best PM of India?",                       None),
    ("breakdown",    "Members of Parliament in India by age group",        None),
]


def generate(base: str, prompt: str, timeout: int = 180) -> tuple[dict | None, str | None]:
    """POST the prompt and read the SSE stream. Returns (card, error)."""
    req = urllib.request.Request(
        f"{base}/api/generate/stream",
        data=json.dumps({"prompt": prompt}).encode(),
        headers={"Content-Type": "application/json"},
    )
    card = err = None
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data: "):
                continue
            try:
                ev = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "card":
                card = ev.get("data")
            elif ev.get("type") == "error":
                err = ev.get("message")
    return card, err


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="hit localhost:8000")
    ap.add_argument("--base", help="explicit base URL")
    ap.add_argument("--offline", action="store_true", help="re-check saved cards only")
    ap.add_argument("--only", nargs="*", help="limit to these shapes")
    args = ap.parse_args()

    base = args.base or (LOCAL if args.local else PROD)
    cases = [c for c in CASES if not args.only or c[0] in args.only]
    OUT.mkdir(exist_ok=True)

    failures: list[tuple[str, list[str]]] = []
    print(f"{'offline' if args.offline else base}  —  {len(cases)} case(s)\n")

    for shape, prompt, want_type in cases:
        path = OUT / f"{shape}.json"
        started = time.time()

        if args.offline:
            if not path.exists():
                print(f"  SKIP  {shape:<13} no saved card at {path.name}")
                continue
            card, err = json.loads(path.read_text()), None
        else:
            try:
                card, err = generate(base, prompt)
            except Exception as e:
                card, err = None, f"{type(e).__name__}: {e}"

        if err or card is None:
            failures.append((shape, [f"generation failed: {err or 'no card returned'}"]))
            print(f"  FAIL  {shape:<13} generation failed: {err}")
            continue

        if not args.offline:
            path.write_text(json.dumps(card, indent=1, ensure_ascii=False))

        problems = check_card(card)
        if want_type and card.get("cardType") != want_type:
            # A soft signal: the classifier is allowed judgment, but a surprise
            # here is usually why a card looks wrong.
            problems.append(f"expected cardType {want_type!r}, got {card.get('cardType')!r}")

        secs = time.time() - started
        if problems:
            failures.append((shape, problems))
            print(f"  FAIL  {shape:<13} {card.get('cardType'):<8} {secs:5.1f}s")
            for p in problems:
                print(f"          - {p}")
        else:
            print(f"  ok    {shape:<13} {card.get('cardType'):<8} {secs:5.1f}s")

    print()
    if failures:
        print(f"{len(failures)} of {len(cases)} case(s) failed. Saved cards are in {OUT}")
        print("Re-check without spending API calls:  python eval/run_eval.py --offline")
        return 1
    print(f"All {len(cases)} case(s) passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
