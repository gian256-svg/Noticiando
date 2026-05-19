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


async def run_crawl():
    logger.info("Starting crawl cycle")
    # Notify crawling state
    await _notify_sse({"event": "crawling"})

    raw_items = await crawl_all_sources(DEFAULT_SOURCES)
    if not raw_items:
        logger.warning("Crawl returned 0 items")
        await _notify_sse({"event": "idle"})
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

            # 1. Encontrar a melhor miniatura no próprio grupo (match exato de hash)
            best_thumb = next(
                (item.get("thumbnail_url") for item in group if item.get("thumbnail_url")),
                None,
            )

            # 2. Se ainda não temos thumbnail, buscar por similaridade com outros itens
            if not best_thumb:
                from crawler.deduplicator import titles_are_similar
                base_title = existing.title if existing else group[0]["title"]
                
                # Buscar nos outros itens recém-coletados
                for other_item in raw_items:
                    if other_item.get("thumbnail_url") and titles_are_similar(base_title, other_item["title"]):
                        best_thumb = other_item["thumbnail_url"]
                        logger.info(f"Borrowed thumbnail from similar raw item: '{other_item['title'][:50]}' -> '{base_title[:50]}'")
                        break
                
                # Se não encontrou, buscar no banco (itens ativos com miniatura)
                if not best_thumb:
                    active_with_thumb = db.query(NewsItem).filter(
                        NewsItem.is_active == True,
                        NewsItem.thumbnail_url != None
                    ).all()
                    for other_item in active_with_thumb:
                        if titles_are_similar(base_title, other_item.title):
                            best_thumb = other_item.thumbnail_url
                            logger.info(f"Borrowed thumbnail from similar DB item: '{other_item.title[:50]}' -> '{base_title[:50]}'")
                            break

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
                if not existing.thumbnail_url and best_thumb:
                    existing.thumbnail_url = best_thumb
                    changed = True
                if changed:
                    updated_items.append(existing)
            else:
                base = group[0]
                # Rejeitar artigos fora do nicho financeiro antes de salvar
                if _is_off_topic(base["title"], base.get("summary", ""), merged_sources):
                    logger.debug(f"Off-topic rejected (penalty keywords/mixed source relevance): {base['title'][:80]}")
                    continue

                # Crie objeto temporário para fazer scoring de relevância antes de salvar
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

                # Verifica relevância calculando score prévio
                from scoring.viral_scorer import score_news
                existing_active = db.query(NewsItem).filter(NewsItem.is_active == True).all()
                prelim_score = score_news(temp_item, existing_active + new_items)

                if prelim_score < 10.0:
                    logger.info(f"Relevance rejected (preliminary score {prelim_score} < 10.0): {base['title'][:80]}")
                    continue

                temp_item.viral_score = prelim_score
                db.add(temp_item)
                new_items.append(temp_item)

        db.commit()

        # Re-score all recent news, deactivating those that fall below 10.0
        all_recent = db.query(NewsItem).filter(NewsItem.is_active == True).all()
        scores = score_all(all_recent)
        for item_id, score in scores.items():
            item = db.get(NewsItem, item_id)
            if item:
                if score < 10.0:
                    logger.info(f"Deactivating stale item (re-score {score} < 10.0): {item.title[:80]}")
                    item.is_active = False
                else:
                    item.viral_score = score
        db.commit()

        logger.info(f"Crawl complete: {len(new_items)} new, {len(updated_items)} updated")

        # Push new + thumbnail-updated items so the frontend refreshes cards
        push_items = new_items + [u for u in updated_items if u.thumbnail_url]
        if push_items:
            await _notify_sse([item.to_dict() for item in push_items])

        # Always signal idle so the live-dot resets on the frontend
        await _notify_sse({"event": "idle"})

    except Exception as e:
        logger.error(f"Crawl error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def reschedule_crawler(minutes: int):
    scheduler.reschedule_job(
        "crawl",
        trigger=IntervalTrigger(minutes=minutes),
    )
    logger.info(f"Rescheduled crawler to run every {minutes} minutes")


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
