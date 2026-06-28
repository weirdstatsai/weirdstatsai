"""Seed one card per type into the stats Firestore collection."""

import hashlib
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Make sure we can import app modules
sys.path.insert(0, str(Path(__file__).parent))

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "firebase-adminsdk.json")
if not os.path.isabs(key_path):
    key_path = str(Path(__file__).parent / key_path)

cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred, {
    "projectId": os.getenv("FIREBASE_PROJECT_ID", "weirdstatsai-aaaf7"),
})
db = firestore.client()

now = datetime.now(timezone.utc).isoformat()


def make_doc(card: dict, prompt: str) -> dict:
    gid = str(uuid.uuid4())
    h = hashlib.sha256(prompt.strip().lower().encode()).hexdigest()
    return {
        "id": gid,
        "status": "completed",
        "publishStatus": "published",
        "createdBy": "seed",
        "createdByName": "WeirdStats",
        "createdAt": now,
        "prompt": prompt,
        "promptHash": h,
        "data": {**card, "status": "success"},
    }


CARDS = [
    # ── FACT ────────────────────────────────────────────────────────────────
    (
        "Which animal has the most hearts?",
        {
            "title": "Octopuses Have Three Hearts and Blue Blood",
            "cardType": "fact",
            "presentationType": "fact",
            "chartType": None,
            "theme": "animals",
            "metric": {"name": "", "unit": "", "value": None, "description": ""},
            "labels": [],
            "datasets": [],
            "rows": [],
            "insight": "Two hearts pump blood to the gills, one to the body — and it stops completely when they swim, which is why octopuses prefer crawling.",
            "tags": ["animals", "biology", "weird"],
            "weirdScore": 9,
            "uiMeta": {
                "category": "Animals",
                "visualTheme": "ocean",
                "accentColor": "#378ADD",
                "gradientFrom": "#e3f2fd",
                "gradientTo": "#e8eaf6",
                "backgroundPattern": "waves",
                "icon": "🐙",
                "insightBadge": "Unexpected",
                "shareTitle": "Octopuses Have 3 Hearts!",
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "Marine Biology Research", "sources": []},
        },
    ),
    # ── RANKING ─────────────────────────────────────────────────────────────
    (
        "Which country drinks the most beer per person?",
        {
            "title": "Top Beer-Drinking Countries Per Capita (2024)",
            "cardType": "ranking",
            "presentationType": "top-5",
            "chartType": None,
            "theme": "food",
            "metric": {"name": "Per Capita Beer Consumption", "unit": "litres/person/year", "value": None, "description": "Annual beer consumption per person"},
            "labels": ["Czech Republic", "Lithuania", "Austria", "Ireland", "Croatia"],
            "datasets": [{"label": "Litres per person", "data": [148.8, 110.6, 104.6, 99.0, 95.1]}],
            "rows": [
                {"rank": 1, "label": "Czech Republic", "value": 148.8, "unit": "L", "extra": "Reigning champ since forever!"},
                {"rank": 2, "label": "Lithuania",      "value": 110.6, "unit": "L", "extra": "Not far behind!"},
                {"rank": 3, "label": "Austria",        "value": 104.6, "unit": "L", "extra": "Waltzing in with beer steins"},
                {"rank": 4, "label": "Ireland",        "value": 99.0,  "unit": "L", "extra": "Still holding strong"},
                {"rank": 5, "label": "Croatia",        "value": 95.1,  "unit": "L", "extra": "A toast to the sunny coast!"},
            ],
            "insight": "Czech Republic drinks nearly 150 litres per person per year — that's almost a pint every single day.",
            "tags": ["beer", "countries", "drinking"],
            "weirdScore": 7,
            "uiMeta": {
                "category": "Food",
                "visualTheme": "warm",
                "accentColor": "#BA7517",
                "gradientFrom": "#fff8e1",
                "gradientTo": "#fce4ec",
                "backgroundPattern": "none",
                "icon": "🍺",
                "insightBadge": "Top 5",
                "shareTitle": "Who Drinks the Most Beer?",
                "rankStyles": ["pill", "percent", "vertical", "circular"],
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "Kirin Holdings 2024 Report", "sources": []},
        },
    ),
    # ── KPI ─────────────────────────────────────────────────────────────────
    (
        "How many legs does the animal with the most legs have?",
        {
            "title": "The Animal With the Most Legs on Earth",
            "cardType": "kpi",
            "presentationType": "kpi-single",
            "chartType": None,
            "theme": "animals",
            "metric": {"name": "Maximum Legs", "unit": "legs", "value": 1306.0, "description": "Eumillipes persephone — a millipede found 60m underground in Australia"},
            "labels": [],
            "datasets": [],
            "rows": [{"rank": 1, "label": "Eumillipes persephone", "value": 1306.0, "unit": "legs", "extra": "Found 60m underground in Western Australia"}],
            "insight": "Discovered in 2021, this Australian millipede shattered the previous record of 750 legs. It lives 60 metres underground and has no eyes.",
            "tags": ["animals", "records", "biology"],
            "weirdScore": 10,
            "uiMeta": {
                "category": "Animals",
                "visualTheme": "minimal",
                "accentColor": "#1D9E75",
                "gradientFrom": "#e8f5e9",
                "gradientTo": "#f1f8e9",
                "backgroundPattern": "none",
                "icon": "🐛",
                "insightBadge": "World Record",
                "shareTitle": "1,306 Legs — A World Record!",
                "rankStyles": ["pill", "vertical", "circular"],
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "2021", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "Scientific Reports (Nature), 2021", "sources": []},
        },
    ),
    # ── VERSUS ──────────────────────────────────────────────────────────────
    (
        "How fast can Usain Bolt run compared to a house cat?",
        {
            "title": "Usain Bolt vs. House Cat — Top Speed",
            "cardType": "versus",
            "presentationType": "versus",
            "chartType": None,
            "theme": "sports",
            "metric": {"name": "Top Speed", "unit": "km/h", "value": None, "description": "Maximum recorded top speed"},
            "labels": ["Usain Bolt", "House Cat"],
            "datasets": [],
            "rows": [
                {"rank": 1, "label": "Usain Bolt",  "value": 44.7, "unit": "km/h", "extra": "100m world record holder"},
                {"rank": 2, "label": "House Cat",   "value": 48.0, "unit": "km/h", "extra": "Your average tabby"},
            ],
            "insight": "Your lazy sofa cat is faster than the fastest human alive. The cat wins by 3.3 km/h.",
            "tags": ["sports", "animals", "speed", "versus"],
            "weirdScore": 9,
            "uiMeta": {
                "category": "Sports",
                "visualTheme": "bold",
                "accentColor": "#D85A30",
                "gradientFrom": "#fbe9e7",
                "gradientTo": "#fff3e0",
                "backgroundPattern": "none",
                "icon": "🐱",
                "insightBadge": "Surprising",
                "shareTitle": "Your Cat Is Faster Than Usain Bolt!",
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "2009", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "IAAF / National Geographic", "sources": []},
        },
    ),
    # ── CHART ───────────────────────────────────────────────────────────────
    (
        "How has global average temperature changed over the last 140 years?",
        {
            "title": "Earth's Temperature Anomaly Since 1880",
            "cardType": "chart",
            "presentationType": "line-chart",
            "chartType": "line",
            "theme": "science",
            "metric": {"name": "Temperature Anomaly", "unit": "°C vs 1951–1980 avg", "value": 1.2, "description": "Global surface temperature change"},
            "labels": ["1880", "1900", "1920", "1940", "1960", "1980", "2000", "2010", "2020", "2023"],
            "datasets": [{"label": "Temp anomaly (°C)", "data": [-0.2, -0.1, -0.27, 0.09, -0.01, 0.26, 0.42, 0.72, 0.98, 1.2]}],
            "rows": [],
            "insight": "The last decade is the hottest in recorded history. 2023 was +1.2°C above the pre-industrial baseline.",
            "tags": ["climate", "science", "temperature", "global"],
            "weirdScore": 8,
            "uiMeta": {
                "category": "Science",
                "visualTheme": "warm",
                "accentColor": "#D85A30",
                "gradientFrom": "#fbe9e7",
                "gradientTo": "#fff3e0",
                "backgroundPattern": "none",
                "icon": "🌡️",
                "insightBadge": "Historic",
                "shareTitle": "Earth Is Getting Hotter Every Decade",
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "1880–2023", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "NASA GISS Surface Temperature Analysis", "sources": []},
        },
    ),
    # ── TABLE ───────────────────────────────────────────────────────────────
    (
        "What are the fastest animals on Earth?",
        {
            "title": "The 5 Fastest Animals on Earth",
            "cardType": "table",
            "presentationType": "table",
            "chartType": None,
            "theme": "animals",
            "metric": {"name": "Top Speed", "unit": "km/h", "value": 389.0, "description": "Maximum speed recorded"},
            "labels": ["Animal", "Speed", "Type"],
            "datasets": [],
            "rows": [
                {"rank": 1, "label": "Peregrine Falcon", "value": 389.0, "unit": "km/h", "extra": "Bird (diving)"},
                {"rank": 2, "label": "Golden Eagle",     "value": 320.0, "unit": "km/h", "extra": "Bird (diving)"},
                {"rank": 3, "label": "Cheetah",          "value": 120.0, "unit": "km/h", "extra": "Land mammal"},
                {"rank": 4, "label": "Sailfish",         "value": 110.0, "unit": "km/h", "extra": "Ocean fish"},
                {"rank": 5, "label": "Pronghorn",        "value": 98.0,  "unit": "km/h", "extra": "Land mammal"},
            ],
            "insight": "The Peregrine Falcon hits 389 km/h in a dive — faster than a Formula 1 car.",
            "tags": ["animals", "speed", "records"],
            "weirdScore": 7,
            "uiMeta": {
                "category": "Animals",
                "visualTheme": "minimal",
                "accentColor": "#6C5CE7",
                "gradientFrom": "#e8f5e9",
                "gradientTo": "#f1f8e9",
                "backgroundPattern": "none",
                "icon": "🦅",
                "insightBadge": "Top 5",
                "shareTitle": "The 5 Fastest Animals on Earth",
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "National Geographic / Smithsonian", "sources": []},
        },
    ),
    # ── MAP ─────────────────────────────────────────────────────────────────
    (
        "Which countries have the most UNESCO World Heritage Sites?",
        {
            "title": "Countries With the Most UNESCO World Heritage Sites",
            "cardType": "map",
            "presentationType": "map-region",
            "chartType": None,
            "theme": "geography",
            "metric": {"name": "UNESCO Sites", "unit": "sites", "value": 58.0, "description": "Total UNESCO World Heritage Sites by country"},
            "labels": ["Italy", "China", "Germany", "France", "Spain"],
            "datasets": [{"label": "UNESCO Sites", "data": [58.0, 57.0, 52.0, 52.0, 50.0]}],
            "rows": [
                {"rank": 1, "label": "Italy",   "value": 58.0, "unit": "sites", "extra": "🇮🇹"},
                {"rank": 2, "label": "China",   "value": 57.0, "unit": "sites", "extra": "🇨🇳"},
                {"rank": 3, "label": "Germany", "value": 52.0, "unit": "sites", "extra": "🇩🇪"},
                {"rank": 4, "label": "France",  "value": 52.0, "unit": "sites", "extra": "🇫🇷"},
                {"rank": 5, "label": "Spain",   "value": 50.0, "unit": "sites", "extra": "🇪🇸"},
            ],
            "insight": "Italy edges out China by just one site. Europe dominates the top 5 — with 3 of the top 4 spots.",
            "tags": ["geography", "countries", "culture", "UNESCO"],
            "weirdScore": 6,
            "uiMeta": {
                "category": "Geography",
                "visualTheme": "minimal",
                "accentColor": "#378ADD",
                "gradientFrom": "#e3f2fd",
                "gradientTo": "#e8eaf6",
                "backgroundPattern": "none",
                "icon": "🌍",
                "insightBadge": "Global",
                "shareTitle": "Italy Has the Most UNESCO Sites!",
            },
            "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
            "sourceMeta": {"primarySourceName": "UNESCO World Heritage List 2024", "sources": []},
        },
    ),
]


def main():
    col = db.collection("stats")
    for prompt, card in CARDS:
        doc = make_doc(card, prompt)
        col.document(doc["id"]).set(doc)
        print(f"✓  {card['cardType']:10s}  {card['title'][:55]}")
    print(f"\nSeeded {len(CARDS)} cards into stats collection.")


if __name__ == "__main__":
    main()
