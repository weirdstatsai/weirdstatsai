"""Eval: does the classify step pick the cardType a human would expect?

Runs classify_card_type(prompt) over a labeled prompt set (prompt-only — in
production the classifier also sees the research brief, so live accuracy
should be >= this number). Prints accuracy, per-type breakdown, and misses.

Usage:  cd services/backend && .venv/bin/python -m eval.card_type_eval
"""

from __future__ import annotations

import asyncio
import sys
from collections import defaultdict

from dotenv import load_dotenv
load_dotenv()

from app.agent_client import classify_card_type

# (prompt, expected cardType). Deliberately weighted toward the confusable
# boundaries: ranking/table/map, kpi/fact, chart-vs-others.
CASES: list[tuple[str, str]] = [
    # versus
    ("Ronaldo vs Messi career goals", "versus"),
    ("iPhone or Samsung — who sells more phones?", "versus"),
    ("Coke vs Pepsi global market share", "versus"),
    ("Cats vs dogs: which pet is more popular in the US?", "versus"),
    ("Chicken vs beef protein content", "versus"),
    ("Netflix vs Disney+ subscribers", "versus"),
    ("Usain Bolt vs a house cat: who is faster?", "versus"),
    ("Tea versus coffee caffeine content", "versus"),

    # map — countries only (the world-atlas renderer can't draw sub-national regions)
    ("Which country drinks the most coffee?", "map"),
    ("Average sleep hours by country", "map"),
    ("Smartphone penetration by country", "map"),
    ("Obesity rates across Pacific island nations", "map"),
    ("Top 5 countries by GDP", "map"),
    ("Which European country has the most public holidays?", "map"),

    # sub-national geography — must NOT be map
    ("Top 10 most populated districts of Telangana", "table"),
    ("Which US state has the highest minimum wage?", "ranking"),
    ("Literacy rate by Indian state", "table"),
    ("Crime rate by city in the US", "table"),

    # chart
    ("Coffee consumption over the years", "chart"),
    ("World population growth since 1950", "chart"),
    ("Bitcoin price history over the last decade", "chart"),
    ("How has global life expectancy changed since 1900?", "chart"),
    ("Electric car sales trend 2015-2025", "chart"),
    ("Global temperature rise over the last century", "chart"),
    ("Netflix subscriber growth by year", "chart"),
    ("Smartphone sales over time", "chart"),

    # ranking
    ("Top 5 fastest animals on Earth", "ranking"),
    ("Most common pet names", "ranking"),
    ("Top 3 most expensive paintings ever sold", "ranking"),
    ("Deadliest animals on Earth", "ranking"),
    ("Biggest mobile carriers in India", "ranking"),
    ("Top 5 most streamed artists on Spotify", "ranking"),
    ("Most popular pizza toppings", "ranking"),
    ("Top 4 tallest buildings in the world", "ranking"),

    # table
    ("Top 10 programming languages by popularity", "table"),
    ("Top 25 highest grossing movies of all time", "table"),
    ("Top 10 most followed Instagram accounts", "table"),
    ("The 15 biggest tech companies by revenue", "table"),
    ("Top 10 best selling video games ever", "table"),
    ("Top 20 universities in the world", "table"),
    ("The 10 longest rivers on Earth", "table"),
    ("Top 10 richest people alive", "table"),

    # kpi
    ("How many legs does a millipede have?", "kpi"),
    ("What share of Germany's energy is renewable?", "kpi"),
    ("How much does the average wedding cost in the US?", "kpi"),
    ("How fast can a cheetah run?", "kpi"),
    ("How many plastic bottles are sold every minute?", "kpi"),
    ("What percentage of the ocean is unexplored?", "kpi"),
    ("How many hours does the average person spend on their phone?", "kpi"),
    ("How much coffee does one barista make per day?", "kpi"),

    # fact
    ("Is there a higher power?", "fact"),
    ("Why do cats purr?", "fact"),
    ("Is cereal a soup?", "fact"),
    ("What is the weirdest law still in effect?", "fact"),
    ("Do fish sleep?", "fact"),
    ("Can money buy happiness?", "fact"),
    ("What's the strangest thing ever sold on eBay?", "fact"),
    ("Is a hotdog a sandwich?", "fact"),
]

CONCURRENCY = 8


async def run() -> int:
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(prompt: str, expected: str) -> tuple[str, str, str | None]:
        async with sem:
            got = await classify_card_type(prompt)
            return prompt, expected, got

    results = await asyncio.gather(*(one(p, e) for p, e in CASES))

    per_type: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # [hits, total]
    misses: list[tuple[str, str, str | None]] = []
    for prompt, expected, got in results:
        per_type[expected][1] += 1
        if got == expected:
            per_type[expected][0] += 1
        else:
            misses.append((prompt, expected, got))

    total = len(results)
    hits = total - len(misses)
    print(f"\ncardType classifier accuracy: {hits}/{total} = {hits / total:.0%}\n")
    for t in sorted(per_type):
        h, n = per_type[t]
        print(f"  {t:<8} {h}/{n}")
    if misses:
        print("\nMisses (prompt | expected -> got):")
        for prompt, expected, got in misses:
            print(f"  {prompt!r} | {expected} -> {got}")
    return 0 if hits / total >= 0.9 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
