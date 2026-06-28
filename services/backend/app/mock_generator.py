"""Fallback chart generator, used when the agent service is unreachable."""

from __future__ import annotations

import random
import re

THEME_DATA = {
    "coffee": (["0 cups", "1 cup", "2 cups", "3 cups", "4 cups", "5+ cups"], [34, 62, 81, 89, 78, 55]),
    "sleep": (["<5h", "5h", "6h", "7h", "8h", "9h", ">10h"], [28, 42, 65, 95, 88, 70, 45]),
    "animals": (["Cats", "Dogs", "Fish", "Birds", "Rabbits", "Reptiles"], [46, 69, 52, 38, 27, 14]),
    "countries": (["USA", "China", "Japan", "Germany", "UK", "Brazil", "India"], [82, 77, 89, 85, 80, 63, 71]),
    "movies": (["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance"], [88, 74, 66, 52, 79, 61]),
    "music": (["Pop", "Hip-Hop", "Rock", "Electronic", "Jazz", "Classical"], [91, 84, 72, 67, 45, 38]),
    "sports": (["Football", "Basketball", "Soccer", "Tennis", "Baseball", "Golf"], [79, 75, 88, 62, 58, 44]),
    "economy": (["2018", "2019", "2020", "2021", "2022", "2023"], [65, 72, 41, 58, 76, 84]),
    "tech": (["Mobile", "Desktop", "Tablet", "Smart TV", "Wearable", "IoT"], [87, 76, 52, 43, 38, 31]),
    "food": (["Pizza", "Burger", "Tacos", "Sushi", "Pasta", "Salad"], [82, 79, 74, 71, 68, 45]),
    "health": (["Exercise", "Diet", "Sleep", "Stress", "Genetics", "Social"], [78, 82, 73, 65, 58, 69]),
    "weather": (
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        [12, 14, 24, 42, 65, 78, 85, 83, 70, 52, 30, 15],
    ),
    "general": (
        ["Category A", "Category B", "Category C", "Category D", "Category E", "Category F"],
        [65, 78, 52, 84, 71, 60],
    ),
}

INSIGHT_TEMPLATES = {
    "coffee": [
        "Peak performance hits at 3-4 cups - after that, the jitters take over.",
        "There's a sweet spot around 3 cups where productivity and chaos are perfectly balanced.",
    ],
    "sleep": [
        "7 hours appears to be the magic number - both fewer and more show similar drop-offs.",
        "Contrary to hustle culture, sleeping more than 6 hours actually correlates with better outcomes.",
    ],
    "general": [
        "Category D is the unexpected overperformer - no obvious reason, just pure data.",
        "The gap between the top and bottom is larger than intuition would suggest.",
        "If you squint at this chart, you can almost see a pattern. Almost.",
    ],
}


def detect_type(prompt: str) -> str:
    s = prompt.lower()
    if re.search(r"pie|donut|doughnut|portion|share|breakdown|percent", s):
        return "doughnut"
    if re.search(r"radar|spider|web|skill|comparison", s):
        return "radar"
    if re.search(r"bubble", s):
        return "bubble"
    if re.search(r"polar", s):
        return "polarArea"
    if re.search(r"scatter|correlation|vs\.?|versus|relationship", s):
        return "scatter"
    if re.search(r"trend|over time|by year|by month|history|growth|decline|line", s):
        return "line"
    return "bar"


def detect_theme(prompt: str) -> str:
    s = prompt.lower()
    checks = [
        ("coffee", r"coffee|caffeine|drink|beer|wine|alcohol"),
        ("sleep", r"sleep|nap|rest|tired|insomnia"),
        ("animals", r"cat|dog|pet|animal|zoo"),
        ("countries", r"country|world|global|nation|continent"),
        ("movies", r"movie|film|cinema|actor|director"),
        ("music", r"music|song|album|band|spotify"),
        ("sports", r"sport|game|score|team|player|nba|nfl"),
        ("economy", r"money|income|salary|wage|gdp|economy"),
        ("tech", r"tech|app|software|code|computer|internet"),
        ("food", r"food|eat|diet|meal|burger|pizza"),
        ("health", r"health|medical|hospital|disease|sick"),
        ("weather", r"weather|rain|temperature|climate|sun"),
    ]
    for theme, pattern in checks:
        if re.search(pattern, s):
            return theme
    return "general"


def build_tags(prompt: str) -> list[str]:
    s = prompt.lower()
    tags = []
    if re.search(r"weird|strange|bizarre|odd|unusual|spurious", s):
        tags.append("weird")
    if re.search(r"correlation|vs|versus|relationship", s):
        tags.append("correlation")
    if re.search(r"country|world|global|nation", s):
        tags.append("global")
    if re.search(r"science|study|research|data", s):
        tags.append("data")
    if re.search(r"trend|growth|decline|over time", s):
        tags.append("trend")
    if not tags:
        tags.append("stats")
    return tags[:3]


def calc_weird_score(prompt: str) -> int:
    s = prompt.lower()
    score = 3
    if re.search(r"weird|bizarre|strange|spurious|random|coincidence", s):
        score += 4
    if re.search(r"nicolas cage|toilet|pizza|moon|cheese|pigeon", s):
        score += 3
    if re.search(r"correlation|vs|versus", s):
        score += 2
    if re.search(r"country|world|global", s):
        score += 1
    return min(score, 10)


def build_title(prompt: str) -> str:
    clean = prompt.strip()
    if len(clean) <= 60:
        return clean[:1].upper() + clean[1:]
    return clean[:57].strip()[:1].upper() + clean[1:57] + "…"


def generate_mock_chart(prompt: str, preferred_type: str | None = None) -> dict:
    chart_type = preferred_type or detect_type(prompt)
    theme = detect_theme(prompt)
    labels, values = THEME_DATA.get(theme, THEME_DATA["general"])
    jittered = [v + random.randint(-6, 6) for v in values]

    templates = INSIGHT_TEMPLATES.get(theme, INSIGHT_TEMPLATES["general"])
    insight = random.choice(templates)

    return {
        "title": build_title(prompt),
        "type": chart_type,
        "theme": theme,
        "labels": labels,
        "datasets": [{"label": "Value", "data": jittered}],
        "insight": insight,
        "tags": build_tags(prompt),
        "weirdScore": calc_weird_score(prompt),
    }
