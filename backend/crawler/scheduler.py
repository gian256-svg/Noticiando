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
from scoring.keywords import PENALTY_KEYWORDS, PENALTY_KEYWORDS_EN

_ALL_PENALTY = [kw.lower() for kw in PENALTY_KEYWORDS + PENALTY_KEYWORDS_EN]


def _is_off_topic(title: str, summary: str, sources: list[str] = None) -> bool:
    text = f"{title} {summary}".lower()
    
    # 1. Strict penalty keyword check
    if any(kw in text for kw in _ALL_PENALTY):
        return True

    # 2. Mixed-content source relevance check
    if sources:
        mixed_identifiers = {"exame", "forbes", "cnn", "g1"}
        is_mixed = any(any(m in s.lower() for m in mixed_identifiers) for s in sources)
        if is_mixed:
            # Must contain at least one positive financial term to be relevant
            from scoring.keywords import HIGH_ENGAGEMENT_KEYWORDS, HIGH_ENGAGEMENT_KEYWORDS_EN
            finance_kws = [kw.lower() for kw, _ in HIGH_ENGAGEMENT_KEYWORDS + HIGH_ENGAGEMENT_KEYWORDS_EN]
            has_finance = any(kw in text for kw in finance_kws)

            # Simple check for numbers, percentages, or money symbols
            has_numbers = any(c.isdigit() for c in title) or "%" in text or "r$" in text or "$" in text

            if not has_finance and not has_numbers:
                return True # Off-topic due to lack of financial relevance in mixed source

    return False

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


async def _notify_sse(payload):
    for q in list(_sse_listeners):
        try:
            await q.put(payload)
        except Exception:
            pass


def _process_crawl_results(raw_items: list[dict]) -> list[dict]:
    """
    Synchronous DB phase — runs in a thread to avoid blocking the event loop.
    Returns a list of item.to_dict() payloads to push via SSE.
    """
    from crawler.deduplicator import normalize_title
    from scoring.viral_scorer import score_news

    db = SessionLocal()
    try:
        hash_groups: dict[str, list[dict]] = {}
        for item in raw_items:
            h = item["title_hash"]
            hash_groups.setdefault(h, []).append(item)

        new_items: list[NewsItem] = []
        updated_items: list[NewsItem] = []

        existing_active = db.query(NewsItem).filter(NewsItem.is_active == True).all()

        def _bigrams(title: str) -> set[str]:
            words = normalize_title(title).split()
            return {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)} if len(words) > 1 else set(words)

        active_candidates = [(it.thumbnail_url, _bigrams(it.title)) for it in existing_active if it.thumbnail_url]
        raw_candidates = [(it["thumbnail_url"], _bigrams(it["title"])) for it in raw_items if it.get("thumbnail_url")]

        def _borrow_thumb(title: str) -> str | None:
            bg_a = _bigrams(title)
            if not bg_a:
                return None
            for thumb_url, bg_b in raw_candidates:
                u = len(bg_a | bg_b)
                if u and len(bg_a & bg_b) / u >= 0.75:
                    return thumb_url
            for thumb_url, bg_b in active_candidates:
                u = len(bg_a | bg_b)
                if u and len(bg_a & bg_b) / u >= 0.75:
                    return thumb_url
            return None

        for h, group in hash_groups.items():
            existing = db.query(NewsItem).filter_by(title_hash=h).first()
            merged_sources = list({s for it in group for s in it["sources"]})
            best_thumb = next((it.get("thumbnail_url") for it in group if it.get("thumbnail_url")), None)
            if not best_thumb:
                base_title = existing.title if existing else group[0]["title"]
                best_thumb = _borrow_thumb(base_title)

            if existing:
                changed = False
                existing_sources = set(existing.sources or [])
                new_src = set(merged_sources) - existing_sources
                if new_src:
                    existing.sources = list(existing_sources | new_src)
                    existing.source_count = len(existing.sources)
                    changed = True
                if not existing.thumbnail_url and best_thumb:
                    existing.thumbnail_url = best_thumb
                    changed = True
                if changed:
                    updated_items.append(existing)
            else:
                base = group[0]
                if _is_off_topic(base["title"], base.get("summary", ""), merged_sources):
                    logger.debug(f"Off-topic rejected: {base['title'][:80]}")
                    continue
                # Dedup por URL: evita inserir o mesmo artigo com título levemente diferente
                url_existing = db.query(NewsItem).filter_by(url=base["url"]).first()
                if url_existing:
                    logger.debug(f"URL duplicate skipped: {base['url'][:80]}")
                    continue
                temp_item = NewsItem(
                    title=base["title"],
                    title_hash=h,
                    url=base["url"],
                    summary=base.get("summary", ""),
                    sources=merged_sources,
                    source_count=len(merged_sources),
                    category=base["category"],
                    thumbnail_url=best_thumb,
                    published_at=base["published_at"],
                )
                prelim_score = score_news(temp_item, existing_active + new_items)
                if prelim_score < 10.0:
                    logger.info(f"Relevance rejected (score {prelim_score:.1f}): {base['title'][:80]}")
                    continue
                temp_item.viral_score = prelim_score
                db.add(temp_item)
                new_items.append(temp_item)

        db.commit()

        all_recent = db.query(NewsItem).filter(NewsItem.is_active == True).all()
        scores = score_all(all_recent)
        for item_id, score in scores.items():
            it = db.get(NewsItem, item_id)
            if it:
                if score < 10.0:
                    it.is_active = False
                else:
                    it.viral_score = score
        db.commit()

        logger.info(f"Crawl complete: {len(new_items)} new, {len(updated_items)} updated")
        push_items = new_items + [u for u in updated_items if u.thumbnail_url]
        return [it.to_dict() for it in push_items]

    except Exception as e:
        logger.error(f"Crawl DB error: {e}", exc_info=True)
        db.rollback()
        return []
    finally:
        db.close()


async def run_crawl():
    logger.info("Starting crawl cycle")
    await _notify_sse({"event": "crawling"})

    raw_items = await crawl_all_sources(DEFAULT_SOURCES)
    if not raw_items:
        logger.warning("Crawl returned 0 items")
        await _notify_sse({"event": "idle"})
        return

    # Run the sync DB phase in a thread so it never blocks the event loop
    push_payloads = await asyncio.to_thread(_process_crawl_results, raw_items)

    if push_payloads:
        await _notify_sse(push_payloads)
    await _notify_sse({"event": "idle"})


def reschedule_crawler(minutes: int):
    scheduler.reschedule_job(
        "crawl",
        trigger=IntervalTrigger(minutes=minutes),
    )
    # Run immediately after reschedule instead of waiting a full interval
    scheduler.modify_job("crawl", next_run_time=datetime.now())
    logger.info(f"Rescheduled crawler to run every {minutes} minutes")


def start_scheduler():
    interval = int(os.getenv("CRAWL_INTERVAL_MINUTES", "2"))
    scheduler.add_job(
        run_crawl,
        trigger=IntervalTrigger(minutes=interval),
        id="crawl",
        replace_existing=True,
        next_run_time=datetime.now(),  # run immediately on startup
        max_instances=1,
        coalesce=True,          # collapse missed runs into one instead of skipping
        misfire_grace_time=120, # allow up to 2-min delay before marking as misfired
    )
    scheduler.start()
    logger.info(f"Scheduler started — interval: {interval} min")
