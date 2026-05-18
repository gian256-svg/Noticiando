import asyncio
import logging
import os
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from crawler.rss_crawler import crawl_all_sources
from crawler.sources import DEFAULT_SOURCES

from db.database import SessionLocal
from models.news import NewsItem
from scoring.viral_scorer import score_all

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

_sse_listeners: list[asyncio.Queue] = []


def register_sse_listener(q: asyncio.Queue):
    _sse_listeners.append(q)


def unregister_sse_listener(q: asyncio.Queue):
    _sse_listeners.discard(q) if hasattr(_sse_listeners, "discard") else None
    try:
        _sse_listeners.remove(q)
    except ValueError:
        pass


async def _notify_sse(items: list[dict]):
    for q in list(_sse_listeners):
        try:
            await q.put(items)
        except Exception:
            pass


async def run_crawl():
    logger.info("Starting crawl cycle")
    # Notify crawling state
    await _notify_sse({"event": "crawling"})

    raw_items = await crawl_all_sources(DEFAULT_SOURCES)
    if not raw_items:
        logger.warning("Crawl returned 0 items")
        return

    db = SessionLocal()
    try:
        # Group by title_hash to detect cross-source items
        hash_groups: dict[str, list[dict]] = {}
        for item in raw_items:
            h = item["title_hash"]
            if h not in hash_groups:
                hash_groups[h] = []
            hash_groups[h].append(item)

        new_items: list[NewsItem] = []
        updated_items: list[NewsItem] = []

        for h, group in hash_groups.items():
            existing = db.query(NewsItem).filter_by(title_hash=h).first()
            merged_sources = list({s for item in group for s in item["sources"]})

            if existing:
                changed = False
                # Update source count if new sources found
                existing_sources = set(existing.sources or [])
                new_sources = set(merged_sources) - existing_sources
                if new_sources:
                    existing.sources = list(existing_sources | new_sources)
                    existing.source_count = len(existing.sources)
                    changed = True
                # Backfill thumbnail if still missing
                if not existing.thumbnail_url:
                    candidate = next(
                        (item.get("thumbnail_url") for item in group if item.get("thumbnail_url")),
                        None,
                    )
                    if candidate:
                        existing.thumbnail_url = candidate
                        changed = True
                if changed:
                    updated_items.append(existing)
            else:
                base = group[0]
                news = NewsItem(
                    title=base["title"],
                    title_hash=h,
                    url=base["url"],
                    summary=base.get("summary", ""),
                    sources=merged_sources,
                    source_count=len(merged_sources),
                    category=base["category"],
                    thumbnail_url=base.get("thumbnail_url"),
                    published_at=base["published_at"],
                )
                db.add(news)
                new_items.append(news)

        db.commit()

        # Re-score all recent news
        all_recent = db.query(NewsItem).filter(NewsItem.is_active == True).all()
        scores = score_all(all_recent)
        for item_id, score in scores.items():
            item = db.get(NewsItem, item_id)
            if item:
                item.viral_score = score
        db.commit()

        logger.info(f"Crawl complete: {len(new_items)} new, {len(updated_items)} updated")

        if new_items:
            await _notify_sse([item.to_dict() for item in new_items])

    except Exception as e:
        logger.error(f"Crawl error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    interval = int(os.getenv("CRAWL_INTERVAL_MINUTES", "2"))
    scheduler.add_job(
        run_crawl,
        trigger=IntervalTrigger(minutes=interval),
        id="crawl",
        replace_existing=True,
        next_run_time=datetime.now(),  # run immediately on startup
    )
    scheduler.start()
    logger.info(f"Scheduler started — interval: {interval} min")
