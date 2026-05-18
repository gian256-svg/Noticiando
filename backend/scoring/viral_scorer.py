"""
Sistema de scoring viral para notícias — Grupo Primo.

Score composto 0–100:
  1. Cruzamento de fontes   (0–30 pts)
  2. Frescor                (0–25 pts)
  3. Keywords engajamento   (0–20 pts)
  4. Velocidade propagação  (0–15 pts)
  5. Peso da categoria      (0–10 pts)
"""

import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from scoring.keywords import (
    HIGH_ENGAGEMENT_KEYWORDS,
    HIGH_ENGAGEMENT_KEYWORDS_EN,
    PENALTY_KEYWORDS,
    PENALTY_KEYWORDS_EN,
)

if TYPE_CHECKING:
    from models.news import NewsItem

# Pesos por categoria (configurável pelo usuário no futuro)
CATEGORY_WEIGHTS: dict[str, float] = {
    "investments": 10.0,
    "economy_int": 9.0,
    "geopolitics": 9.0,
    "economy_br": 8.0,
    "crypto": 7.0,
    "general": 3.0,
}

_BIG_NUMBER_RE = re.compile(
    r"R\$\s*[\d,\.]+\s*(bilh[õo]es?|trilh[õo]es?)|"
    r"\$[\d,\.]+\s*(billion|trillion)|"
    r"[\d,\.]+\s*%\s*(de\s*)?(alta|queda|queda|crescimento|recuo)",
    re.IGNORECASE,
)


def _freshness_score(published_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_min = (now - published_at).total_seconds() / 60

    if age_min < 30:
        return 25.0
    if age_min < 60:
        return 20.0
    if age_min < 180:
        return 15.0
    if age_min < 360:
        return 10.0
    if age_min < 720:
        return 5.0
    return 0.0


def _source_score(source_count: int) -> float:
    if source_count >= 5:
        return 30.0
    if source_count >= 3:
        return 25.0
    if source_count >= 2:
        return 15.0
    return 5.0


def _keyword_score(text: str) -> float:
    text_lower = text.lower()
    score = 0.0
    max_score = 20.0

    all_keywords = HIGH_ENGAGEMENT_KEYWORDS + HIGH_ENGAGEMENT_KEYWORDS_EN
    for kw, weight in all_keywords:
        if kw in text_lower:
            score += weight

    # Bonus for big numbers
    if _BIG_NUMBER_RE.search(text):
        score += 4.0

    return min(score, max_score)


def _propagation_velocity(item: "NewsItem", all_items: list["NewsItem"]) -> float:
    """
    Bonus if similar news appeared from multiple sources within the last 30 minutes.
    """
    if not item.published_at:
        return 0.0

    pub = item.published_at
    if pub.tzinfo is None:
        pub = pub.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    if (now - pub).total_seconds() > 1800:
        return 0.0

    # Count other items with same title_hash or high source count
    similar_recent = [
        x for x in all_items
        if x.id != item.id
        and x.source_count > 1
        and x.published_at
        and abs(((x.published_at.replace(tzinfo=timezone.utc) if x.published_at.tzinfo is None else x.published_at) - pub).total_seconds()) < 1800
    ]

    if len(similar_recent) >= 3:
        return 15.0
    if len(similar_recent) >= 1:
        return 8.0
    return 0.0


def _penalty_score(text: str) -> float:
    text_lower = text.lower()
    all_penalty = PENALTY_KEYWORDS + PENALTY_KEYWORDS_EN
    for kw in all_penalty:
        if kw in text_lower:
            return -60.0
    return 0.0


def score_news(item: "NewsItem", all_items: list["NewsItem"]) -> float:
    text = f"{item.title} {item.summary or ''}"

    s = (
        _source_score(item.source_count or 1)
        + _freshness_score(item.published_at or datetime.now(timezone.utc))
        + _keyword_score(text)
        + _propagation_velocity(item, all_items)
        + CATEGORY_WEIGHTS.get(item.category or "general", 3.0)
        + _penalty_score(text)
    )

    return round(max(min(s, 100.0), 0.0), 1)


def score_all(items: list["NewsItem"]) -> dict[str, float]:
    """Returns {item_id: score} for all items."""
    return {item.id: score_news(item, items) for item in items}
