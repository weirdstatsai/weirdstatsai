from typing import Any, Optional

from pydantic import BaseModel


class GenerateRequest(BaseModel):
    prompt: str
    preferredType: Optional[str] = None


class Dataset(BaseModel):
    label: str
    data: list[Any]


class UiMeta(BaseModel):
    category: str
    visualTheme: str
    accentColor: str
    backgroundPattern: str
    icon: str
    cardType: str
    insightBadge: str
    shareTitle: str


class ChartResponse(BaseModel):
    title: str
    type: str
    theme: str
    labels: list[str]
    datasets: list[Dataset]
    insight: str
    tags: list[str]
    weirdScore: int
    uiMeta: Optional[UiMeta] = None
    alternatives: Optional[list[Any]] = None
