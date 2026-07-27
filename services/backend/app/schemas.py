"""WeirdCard schema — the single source of truth for a generated metric card.

This MUST stay in sync with the frontend interface in
weird-stats-app/src/app/models/weird-card.model.ts. It mirrors exactly the JSON
the Metrics pipeline produces (Research Agent -> Format Agent -> validator).
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    prompt: str
    preferredType: Optional[str] = None
    uid: Optional[str] = None


# ── Card sub-objects ──────────────────────────────────────────────────────

class CardMetric(BaseModel):
    name: str = ""
    unit: str = ""
    value: Optional[float] = None
    description: str = ""


class CardDataset(BaseModel):
    label: str = ""
    data: list[float] = Field(default_factory=list)


class CardRow(BaseModel):
    rank: Optional[int] = None
    label: str = ""
    value: float = 0
    unit: str = ""
    extra: str = ""


class CardUiMeta(BaseModel):
    category: str = "Other"
    visualTheme: str = "minimal"
    accentColor: str = "#6C5CE7"
    gradientFrom: str = "#f0eeff"
    gradientTo: str = "#ffffff"
    backgroundPattern: str = "none"
    icon: str = "📊"
    insightBadge: str = ""
    shareTitle: str = ""
    rankStyles: list[str] = []
    versusStyles: list[str] = []
    mapStyles: list[str] = []
    selectedStyle: str = ""


class CardDataMeta(BaseModel):
    geoScope: str = ""
    timePeriod: str = ""
    # "unsupported" is required: FORMAT_PROMPT tells the agent to return an
    # unsupported card for an unanswerable/opinion question ("who is the BEST
    # X?"), and it sets dataMode to match. Without this member every such card
    # died in validation and the whole generation surfaced a generic error,
    # instead of the graceful "we couldn't verify this" card the prompt intends.
    dataMode: Literal["researched", "cached", "estimated", "proxy", "unsupported"] = "researched"
    isProxy: bool = False
    proxyExplanation: str = ""
    confidence: Literal["high", "medium", "low"] = "medium"


class CardSource(BaseModel):
    name: str = ""
    url: str = ""
    sourceType: Literal["official", "research", "company", "database", "news", "other"] = "other"
    retrievedAt: str = ""


class CardSourceMeta(BaseModel):
    primarySourceName: str = ""
    sources: list[CardSource] = Field(default_factory=list)


# ── The full card ─────────────────────────────────────────────────────────

CardType = Literal["chart", "ranking", "kpi", "versus", "fact", "table", "map"]


class WeirdCard(BaseModel):
    status: Literal["success", "needs_review", "unsupported"] = "success"
    title: str
    cardType: CardType = "fact"
    presentationType: str = "fact"
    chartType: Optional[str] = None
    theme: str = "general"
    metric: CardMetric = Field(default_factory=CardMetric)
    labels: list[str] = Field(default_factory=list)
    datasets: list[CardDataset] = Field(default_factory=list)
    rows: list[CardRow] = Field(default_factory=list)
    insight: str = ""
    tags: list[str] = Field(default_factory=list)
    weirdScore: int = 5
    uiMeta: CardUiMeta = Field(default_factory=CardUiMeta)
    dataMeta: CardDataMeta = Field(default_factory=CardDataMeta)
    sourceMeta: CardSourceMeta = Field(default_factory=CardSourceMeta)

    # Storage metadata — added by the backend when persisting; optional on input.
    id: Optional[str] = None
    uid: Optional[str] = None
    createdByName: Optional[str] = None
    prompt: Optional[str] = None
    promptHash: Optional[str] = None
    createdAt: Optional[str] = None
    editedAt: Optional[str] = None


# Backwards-compatible alias — old code imports ChartResponse.
ChartResponse = WeirdCard
