import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.database import get_db
from models.news import NewsItem
from crawler.scheduler import register_sse_listener, unregister_sse_listener

router = APIRouter()
logger = logging.getLogger(__name__)

PERIOD_HOURS = {"1h": 1, "6h": 6, "24h": 24, "7d": 168}


@router.get("")
async def list_news(
    db: Session = Depends(get_db),
    limit: int = Query(100, le=200),
    offset: int = Query(0, ge=0),
    category: Optional[str] = None,
    min_score: float = Query(10.0, ge=0, le=100),
    period: str = Query("6h"),
    sort: str = Query("viral_score"),
):
    from datetime import datetime, timezone, timedelta

    hours = PERIOD_HOURS.get(period, 6)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    q = db.query(NewsItem).filter(
        NewsItem.is_active == True,
        NewsItem.created_at >= cutoff,
        NewsItem.viral_score >= min_score,
    )

    if category and category != "all":
        q = q.filter(NewsItem.category == category)

    if sort == "viral_score":
        q = q.order_by(NewsItem.viral_score.desc())
    else:
        q = q.order_by(NewsItem.created_at.desc())

    total = q.count()
    items = q.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [item.to_dict() for item in items],
    }


@router.get("/feed")
async def news_feed():
    """Server-Sent Events endpoint for real-time news updates."""

    queue: asyncio.Queue = asyncio.Queue()
    register_sse_listener(queue)

    async def event_stream():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if isinstance(data, dict):
                        event = data.get("event", "")
                        if event == "crawling":
                            yield f"event: crawling\ndata: {{}}\n\n"
                        elif event == "idle":
                            yield f"event: idle\ndata: {{}}\n\n"
                        # else: ignore unknown dict events
                    else:
                        yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unregister_sse_listener(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
