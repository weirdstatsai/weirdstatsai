"""Seed a rich, diverse set of WeirdStats cards into Firestore `graphs` so the
Explore feed looks like a real product. Run: .venv/bin/python seed_sample.py

Hand-built with real, sourced stats — no OpenAI key needed. Every card runs
through the same validator the live pipeline uses.
"""

from dotenv import load_dotenv
load_dotenv()

from app.validator import validate_card
from app.firestore_client import save_graph


def src(name, url, stype="official", date="2026-06-19"):
    return {"name": name, "url": url, "sourceType": stype, "retrievedAt": date}


def rows(items, unit):
    # items: list of (label, value, extra)
    return [{"rank": i + 1, "label": l, "value": v, "unit": unit, "extra": e}
            for i, (l, v, e) in enumerate(items)]


CARDS = [
    # 1. RANKING — deadliest animals
    {
        "title": "Mosquitoes: Tiny Flying Death Bosses", "cardType": "ranking", "presentationType": "top-5",
        "chartType": "bar", "theme": "animals",
        "metric": {"name": "Human deaths/year", "unit": "deaths", "value": 725000, "description": "Annual human deaths by animal."},
        "labels": ["Mosquitoes", "Snakes", "Dogs", "Freshwater snails", "Kissing bugs"],
        "datasets": [{"label": "Deaths/year", "data": [725000, 100000, 40000, 14000, 8000]}],
        "rows": rows([("Mosquitoes", 725000, "Malaria, dengue, Zika"), ("Snakes", 100000, "Venomous bites"),
                      ("Dogs", 40000, "Rabies"), ("Freshwater snails", 14000, "Schistosomiasis"),
                      ("Kissing bugs", 8000, "Chagas disease")], "deaths/year"),
        "insight": "A cursed syringe with wings out-kills every predator on Earth combined.",
        "tags": ["animals", "health", "global"], "weirdScore": 10,
        "uiMeta": {"category": "Animals", "visualTheme": "jungle", "accentColor": "#D85A30", "backgroundPattern": "leaf", "icon": "🦟", "insightBadge": "Weird Gap", "shareTitle": "The deadliest animal is tiny and buzzy"},
        "dataMeta": {"geoScope": "global", "timePeriod": "latest estimates", "dataMode": "researched", "isProxy": True, "proxyExplanation": "Synthesizes vector-disease and direct-attack estimates.", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "WHO", "sources": [src("WHO — Vector-borne diseases", "https://www.who.int/news-room/fact-sheets/detail/vector-borne-diseases")]},
    },
    # 2. KPI — internet access
    {
        "title": "Most of Humanity Is Now Online", "cardType": "kpi", "presentationType": "kpi-single",
        "theme": "tech",
        "metric": {"name": "World population using the internet", "unit": "% of people", "value": 68, "description": "Share of the global population online."},
        "labels": ["Internet users"], "datasets": [{"label": "%", "data": [68]}],
        "rows": [{"rank": 1, "label": "Online", "value": 68, "unit": "%", "extra": "~5.5 billion people"}],
        "insight": "In 2005 it was 16%. In 20 years the world went from mostly offline to mostly online.",
        "tags": ["tech", "internet", "global"], "weirdScore": 6,
        "uiMeta": {"category": "Internet", "visualTheme": "cyber", "accentColor": "#378ADD", "backgroundPattern": "grid", "icon": "🌐", "insightBadge": "Fast Rising", "shareTitle": "68% of humanity is online"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "ITU", "sources": [src("ITU — Facts and Figures 2024", "https://www.itu.int/itu-d/reports/statistics/", "official")]},
    },
    # 3. VERSUS — iOS vs Android
    {
        "title": "Android Quietly Owns the Planet", "cardType": "versus", "presentationType": "versus",
        "theme": "tech",
        "metric": {"name": "Mobile OS market share", "unit": "%", "value": None, "description": "Global smartphone OS share."},
        "labels": ["Android", "iOS"], "datasets": [{"label": "%", "data": [71, 28]}],
        "rows": rows([("Android", 71, "Global share"), ("iOS", 28, "Global share")], "%"),
        "insight": "iOS dominates headlines and profits, but Android runs ~7 of every 10 phones worldwide.",
        "tags": ["tech", "mobile", "global"], "weirdScore": 5,
        "uiMeta": {"category": "Technology", "visualTheme": "minimal", "accentColor": "#1D9E75", "backgroundPattern": "none", "icon": "📱", "insightBadge": "Big Difference", "shareTitle": "Android vs iOS: 71% vs 28%"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2025", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "StatCounter", "sources": [src("StatCounter Global Stats", "https://gs.statcounter.com/os-market-share/mobile", "database")]},
    },
    # 4. TABLE — most populous countries
    {
        "title": "The 10 Countries Where Most Humans Live", "cardType": "table", "presentationType": "top-10",
        "theme": "countries",
        "metric": {"name": "Population", "unit": "people", "value": 1428000000, "description": "Population by country."},
        "labels": ["India", "China", "USA", "Indonesia", "Pakistan"],
        "datasets": [{"label": "Population (M)", "data": [1428, 1425, 340, 277, 240]}],
        "rows": rows([("India", 1428, "Now #1"), ("China", 1425, "Declining"), ("United States", 340, ""),
                      ("Indonesia", 277, ""), ("Pakistan", 240, ""), ("Nigeria", 223, "Fastest growing"),
                      ("Brazil", 216, ""), ("Bangladesh", 173, ""), ("Russia", 144, ""), ("Mexico", 128, "")], "million"),
        "insight": "India passed China in 2023 — the first change at the top in over 300 years.",
        "tags": ["countries", "global", "population"], "weirdScore": 6,
        "uiMeta": {"category": "Countries", "visualTheme": "map", "accentColor": "#6C5CE7", "backgroundPattern": "map-lines", "icon": "🌍", "insightBadge": "Historic", "shareTitle": "The 10 most populous countries"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "UN", "sources": [src("UN World Population Prospects", "https://population.un.org/wpp/", "official")]},
    },
    # 5. CHART line — global temperature anomaly
    {
        "title": "The Planet's Fever Chart", "cardType": "chart", "presentationType": "line-chart",
        "chartType": "line", "theme": "weather",
        "metric": {"name": "Global temperature anomaly", "unit": "°C vs 1900", "value": 1.45, "description": "Warming above pre-industrial."},
        "labels": ["1900", "1940", "1970", "2000", "2010", "2024"],
        "datasets": [{"label": "°C", "data": [0.0, 0.1, 0.0, 0.4, 0.7, 1.45]}],
        "rows": [], "insight": "2024 was the hottest year on record at ~1.45°C above pre-industrial levels.",
        "tags": ["weather", "climate", "trend"], "weirdScore": 7,
        "uiMeta": {"category": "Environment", "visualTheme": "lab", "accentColor": "#D85A30", "backgroundPattern": "waves", "icon": "🌡️", "insightBadge": "Trending", "shareTitle": "Earth just had its hottest year"},
        "dataMeta": {"geoScope": "global", "timePeriod": "1900–2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "NASA GISS", "sources": [src("NASA GISTEMP", "https://data.giss.nasa.gov/gistemp/", "official")]},
    },
    # 6. FACT — honey
    {
        "title": "Honey Literally Never Goes Bad", "cardType": "fact", "presentationType": "fact",
        "theme": "food",
        "metric": {"name": "Shelf life of honey", "unit": "years", "value": None, "description": "Honey does not spoil if sealed."},
        "labels": [], "datasets": [], "rows": [],
        "insight": "Archaeologists found 3,000-year-old honey in Egyptian tombs — still edible. Low water + acidity make it immortal.",
        "tags": ["food", "science", "weird"], "weirdScore": 9,
        "uiMeta": {"category": "Food", "visualTheme": "luxury", "accentColor": "#BA7517", "backgroundPattern": "dots", "icon": "🍯", "insightBadge": "Unexpected", "shareTitle": "Honey never expires — ever"},
        "dataMeta": {"geoScope": "global", "timePeriod": "n/a", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "Smithsonian", "sources": [src("Smithsonian Magazine", "https://www.smithsonianmag.com/science-nature/the-science-behind-honeys-eternal-shelf-life-1218690/", "news")]},
    },
    # 7. RANKING — most spoken languages
    {
        "title": "The World's Most Spoken Languages", "cardType": "ranking", "presentationType": "top-5",
        "chartType": "bar", "theme": "general",
        "metric": {"name": "Total speakers", "unit": "people", "value": 1500000000, "description": "Speakers (native + second language)."},
        "labels": ["English", "Mandarin", "Hindi", "Spanish", "Arabic"],
        "datasets": [{"label": "Speakers (M)", "data": [1500, 1140, 610, 560, 420]}],
        "rows": rows([("English", 1500, "Most learned"), ("Mandarin Chinese", 1140, "Most native"),
                      ("Hindi", 610, ""), ("Spanish", 560, ""), ("Arabic", 420, "")], "million"),
        "insight": "English wins on total speakers, but Mandarin has the most native speakers by far.",
        "tags": ["culture", "global", "language"], "weirdScore": 4,
        "uiMeta": {"category": "Culture", "visualTheme": "paper", "accentColor": "#378ADD", "backgroundPattern": "none", "icon": "🗣️", "insightBadge": "Global", "shareTitle": "Top 5 most spoken languages"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "Ethnologue", "sources": [src("Ethnologue 2024", "https://www.ethnologue.com/insights/most-spoken-language/", "database")]},
    },
    # 8. KPI — Switzerland healthcare
    {
        "title": "Switzerland Quietly Owns the World's Best Healthcare", "cardType": "kpi", "presentationType": "kpi-single",
        "theme": "health",
        "metric": {"name": "Healthcare system score", "unit": "/ 100", "value": 91, "description": "Top-ranked national healthcare score."},
        "labels": ["Switzerland"], "datasets": [{"label": "Score", "data": [91]}],
        "rows": [{"rank": 1, "label": "Switzerland", "value": 91, "unit": "/100", "extra": "World's best"}],
        "insight": "The US spends the most per person but ranks 11th — Switzerland wins on quality, not cost.",
        "tags": ["health", "countries", "global"], "weirdScore": 7,
        "uiMeta": {"category": "Health", "visualTheme": "minimal", "accentColor": "#1D9E75", "backgroundPattern": "none", "icon": "🏥", "insightBadge": "Global", "shareTitle": "Switzerland has the world's best healthcare"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "Euro Health Consumer Index", "sources": [src("Health Consumer Powerhouse", "https://healthpowerhouse.com/", "research")]},
    },
    # 9. CHART bar — coffee consumption
    {
        "title": "The Countries That Run on Caffeine", "cardType": "chart", "presentationType": "bar-chart",
        "chartType": "bar", "theme": "coffee",
        "metric": {"name": "Coffee per capita", "unit": "kg/year", "value": 12, "description": "Coffee consumed per person yearly."},
        "labels": ["Finland", "Norway", "Iceland", "Denmark", "Netherlands"],
        "datasets": [{"label": "kg/person/yr", "data": [12.0, 9.9, 9.0, 8.7, 8.4]}],
        "rows": [], "insight": "Finland drinks roughly 4× more coffee per person than the global average.",
        "tags": ["food", "trend", "global"], "weirdScore": 5,
        "uiMeta": {"category": "Food", "visualTheme": "street-food", "accentColor": "#BA7517", "backgroundPattern": "circles", "icon": "☕", "insightBadge": "Surprising", "shareTitle": "Finland is the world's coffee champion"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2023", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "ICO", "sources": [src("International Coffee Organization", "https://www.ico.org/", "official")]},
    },
    # 10. TABLE — highest grossing films
    {
        "title": "The 10 Biggest Box-Office Monsters", "cardType": "table", "presentationType": "top-10",
        "theme": "movies",
        "metric": {"name": "Worldwide gross", "unit": "USD", "value": 2923000000, "description": "Lifetime worldwide box office."},
        "labels": ["Avatar", "Avengers: Endgame", "Avatar 2", "Titanic", "Star Wars VII"],
        "datasets": [{"label": "Gross ($B)", "data": [2.92, 2.80, 2.32, 2.26, 2.07]}],
        "rows": rows([("Avatar", 2.92, "2009"), ("Avengers: Endgame", 2.80, "2019"), ("Avatar: The Way of Water", 2.32, "2022"),
                      ("Titanic", 2.26, "1997"), ("Star Wars: The Force Awakens", 2.07, "2015"), ("Avengers: Infinity War", 2.05, "2018"),
                      ("Spider-Man: No Way Home", 1.92, "2021"), ("Inside Out 2", 1.70, "2024"), ("Jurassic World", 1.67, "2015"),
                      ("The Lion King", 1.66, "2019")], "billion USD"),
        "insight": "James Cameron directed 3 of the top 4 — and 2 of them are Avatar films.",
        "tags": ["entertainment", "money", "global"], "weirdScore": 5,
        "uiMeta": {"category": "Entertainment", "visualTheme": "neon", "accentColor": "#6C5CE7", "backgroundPattern": "stars", "icon": "🎬", "insightBadge": "Top 5", "shareTitle": "The 10 highest-grossing films ever"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "Box Office Mojo", "sources": [src("Box Office Mojo", "https://www.boxofficemojo.com/chart/top_lifetime_gross/", "database")]},
    },
    # 11. FACT — octopus hearts
    {
        "title": "Octopuses Have Three Hearts and Blue Blood", "cardType": "fact", "presentationType": "fact",
        "theme": "animals",
        "metric": {"name": "Octopus hearts", "unit": "hearts", "value": 3, "description": "Octopuses have three hearts."},
        "labels": [], "datasets": [], "rows": [],
        "insight": "Two hearts pump blood to the gills, one to the body — and it stops when they swim, so they prefer crawling.",
        "tags": ["animals", "science", "weird"], "weirdScore": 9,
        "uiMeta": {"category": "Animals", "visualTheme": "ocean", "accentColor": "#378ADD", "backgroundPattern": "bubbles", "icon": "🐙", "insightBadge": "Unexpected", "shareTitle": "Octopuses have 3 hearts"},
        "dataMeta": {"geoScope": "global", "timePeriod": "n/a", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "Natural History Museum", "sources": [src("Natural History Museum", "https://www.nhm.ac.uk/discover/octopuses-keep-surprising-us.html", "official")]},
    },
    # 12. MAP — CO2 emissions by country
    {
        "title": "Who Pumps Out the Most CO₂", "cardType": "map", "presentationType": "map-region",
        "chartType": "bar", "theme": "countries",
        "metric": {"name": "Annual CO₂ emissions", "unit": "Gt", "value": 11.9, "description": "Annual CO2 emissions by country."},
        "labels": ["China", "USA", "India", "Russia", "Japan"],
        "datasets": [{"label": "Gt CO₂", "data": [11.9, 4.9, 2.9, 1.8, 1.1]}],
        "rows": rows([("China", 11.9, "31% of global"), ("United States", 4.9, "14%"), ("India", 2.9, "8%"),
                      ("Russia", 1.8, "5%"), ("Japan", 1.1, "3%")], "Gt CO₂"),
        "insight": "China emits more than the next three combined — but per person, the average American emits ~2× a Chinese citizen.",
        "tags": ["environment", "global", "countries"], "weirdScore": 6,
        "uiMeta": {"category": "Environment", "visualTheme": "map", "accentColor": "#1D9E75", "backgroundPattern": "map-lines", "icon": "🏭", "insightBadge": "Big Difference", "shareTitle": "Top CO₂-emitting countries"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2023", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "Global Carbon Project", "sources": [src("Our World in Data — CO₂", "https://ourworldindata.org/co2-emissions", "research")]},
    },
    # 13. RANKING — most visited countries
    {
        "title": "The Most Visited Countries on Earth", "cardType": "ranking", "presentationType": "top-5",
        "chartType": "bar", "theme": "countries",
        "metric": {"name": "International tourist arrivals", "unit": "people", "value": 100000000, "description": "Annual tourist arrivals."},
        "labels": ["France", "Spain", "USA", "Italy", "Turkey"],
        "datasets": [{"label": "Arrivals (M)", "data": [100, 85, 66, 57, 55]}],
        "rows": rows([("France", 100, "Eiffel effect"), ("Spain", 85, ""), ("United States", 66, ""),
                      ("Italy", 57, ""), ("Turkey", 55, "Fast rising")], "million"),
        "insight": "France gets more annual visitors than its entire population — by a lot.",
        "tags": ["travel", "global", "countries"], "weirdScore": 5,
        "uiMeta": {"category": "Travel", "visualTheme": "city", "accentColor": "#D85A30", "backgroundPattern": "diagonal-lines", "icon": "✈️", "insightBadge": "Global", "shareTitle": "The 5 most visited countries"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2023", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "UN Tourism", "sources": [src("UN Tourism Barometer", "https://www.unwto.org/tourism-data/global-and-regional-tourism-performance", "official")]},
    },
    # 14. CHART doughnut — global electricity sources
    {
        "title": "What Actually Powers the World", "cardType": "chart", "presentationType": "doughnut-chart",
        "chartType": "doughnut", "theme": "tech",
        "metric": {"name": "Global electricity mix", "unit": "%", "value": None, "description": "Share of electricity generation."},
        "labels": ["Coal", "Gas", "Hydro", "Nuclear", "Wind", "Solar"],
        "datasets": [{"label": "%", "data": [35, 23, 14, 9, 8, 6]}],
        "rows": [], "insight": "Fossil fuels still generate ~60% of the world's electricity — but solar is the fastest-growing slice.",
        "tags": ["environment", "tech", "trend"], "weirdScore": 5,
        "uiMeta": {"category": "Environment", "visualTheme": "lab", "accentColor": "#BA7517", "backgroundPattern": "none", "icon": "⚡", "insightBadge": "Trending", "shareTitle": "What powers the world's electricity"},
        "dataMeta": {"geoScope": "global", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "high"},
        "sourceMeta": {"primarySourceName": "Ember", "sources": [src("Ember Global Electricity Review", "https://ember-energy.org/", "research")]},
    },
    # 15. VERSUS — cats vs dogs (US households)
    {
        "title": "Cats vs Dogs: America's Pet Cold War", "cardType": "versus", "presentationType": "versus",
        "theme": "animals",
        "metric": {"name": "US households owning", "unit": "million", "value": None, "description": "US households with each pet."},
        "labels": ["Dogs", "Cats"], "datasets": [{"label": "Households (M)", "data": [65, 47]}],
        "rows": rows([("Dogs", 65, "More households"), ("Cats", 47, "But more total cats")], "million households"),
        "insight": "More US homes have dogs — but cat owners tend to own more than one, so total cats nearly tie.",
        "tags": ["animals", "relationships", "data"], "weirdScore": 4,
        "uiMeta": {"category": "Animals", "visualTheme": "minimal", "accentColor": "#6C5CE7", "backgroundPattern": "none", "icon": "🐾", "insightBadge": "Big Difference", "shareTitle": "Cats vs dogs in US homes"},
        "dataMeta": {"geoScope": "United States", "timePeriod": "2024", "dataMode": "researched", "isProxy": False, "proxyExplanation": "", "confidence": "medium"},
        "sourceMeta": {"primarySourceName": "AVMA", "sources": [src("AVMA Pet Ownership Survey", "https://www.avma.org/resources-tools/reports-statistics", "research")]},
    },
]


def main():
    for raw in CARDS:
        raw.setdefault("status", "success")
        card = validate_card(raw)
        gid = save_graph(card, prompt=raw["title"])
        print(f"  {card['cardType']:8} w{card['weirdScore']:>2}  {card['title'][:50]}")
    print(f"\nSeeded {len(CARDS)} cards.")


if __name__ == "__main__":
    main()
