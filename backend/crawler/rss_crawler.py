"""
RSS Crawler usando xml.etree.ElementTree (built-in) — sem dependências externas.
Compatível com RSS 2.0 e Atom 1.0.
"""
import asyncio
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional
from xml.etree import ElementTree as ET

import httpx
from bs4 import BeautifulSoup

from crawler.sources import Source
from crawler.deduplicator import title_hash

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Noticiando/0.1; +https://grupoprimo.com)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# Domínios que bloqueiam og:image (paywall, 403, redirects infinitos)
# Para esses, o GenerativeThumbnail do frontend faz o fallback visual
BLOCKED_OG_DOMAINS = {
    "bloomberg.com", "www.bloomberg.com",
    "wsj.com", "www.wsj.com", "online.wsj.com",
    "ft.com", "www.ft.com",
    "economist.com", "www.economist.com",
    "br.investing.com", "investing.com", "www.investing.com",
    "marketwatch.com", "www.marketwatch.com",
    "project-syndicate.org", "www.project-syndicate.org",
}

# Browser-like headers for og:image page fetches (avoids 403 blocks)
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# XML namespaces comuns em feeds
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def _parse_date(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    # ISO 8601 fallback
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _text(el: Optional[ET.Element]) -> str:
    if el is None:
        return ""
    return (el.text or "").strip()


def _clean_html(raw: str) -> str:
    if not raw:
        return ""
    soup = BeautifulSoup(raw, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    return text[:500]


def _extract_thumbnail(item: ET.Element, description: str) -> Optional[str]:
    """Try every possible RSS thumbnail source in priority order."""

    def _valid(url: Optional[str]) -> Optional[str]:
        """Return url if it looks like an image URL, else None."""
        if not url:
            return None
        url = url.strip()
        if url.startswith("//"):
            url = "https:" + url
        if not url.startswith("http"):
            return None

        # Descartar imagens genéricas de placeholder da Investing.com
        url_lower = url.lower()
        if "world_news_" in url_lower or "news_headline_" in url_lower:
            return None

        # Accept anything that isn't obviously a tracking pixel (< 5 chars ext)
        ext = url.split("?")[0].split(".")[-1].lower()
        if ext in ("js", "css", "html", "htm", "xml", "json", "txt"):
            return None
        return url

    # 1. media:thumbnail (Yahoo Media RSS)
    for tag in ("media:thumbnail", "{http://search.yahoo.com/mrss/}thumbnail"):
        thumb = item.find(tag) if ":" not in tag else item.find(tag, NS)
        if thumb is not None:
            u = _valid(thumb.get("url"))
            if u:
                return u

    # 2. media:content — accept any URL (many feeds omit type="image/...")
    for mc in item.findall("media:content", NS):
        t = mc.get("type", "")
        medium = mc.get("medium", "")
        url_attr = _valid(mc.get("url"))
        # Prefer explicit image type, but fall back to any non-video URL
        if t.startswith("image/") or medium == "image":
            if url_attr:
                return url_attr
        elif url_attr and not t.startswith("video/") and not t.startswith("audio/"):
            # Store as candidate, prefer explicit hits above
            pass
    # Second pass — accept any media:content URL that isn't video/audio
    for mc in item.findall("media:content", NS):
        t = mc.get("type", "")
        if not t.startswith("video/") and not t.startswith("audio/"):
            u = _valid(mc.get("url"))
            if u:
                return u

    # 3. media:group children (G1/Globo use this)
    for group in item.findall("media:group", NS):
        for mc in group.findall("media:content", NS):
            u = _valid(mc.get("url"))
            if u:
                return u

    # 4. enclosure
    enc = item.find("enclosure")
    if enc is not None:
        t = enc.get("type", "")
        if "image" in t or not t:  # accept missing type too
            u = _valid(enc.get("url"))
            if u:
                return u

    # 5. content:encoded — first <img> with src or data-src
    content_enc = item.find("content:encoded", NS)
    if content_enc is not None and content_enc.text:
        soup = BeautifulSoup(content_enc.text, "html.parser")
        for img in soup.find_all("img"):
            for attr in ("src", "data-src", "data-original", "data-lazy-src"):
                u = _valid(img.get(attr, ""))
                if u and "pixel" not in u and "tracking" not in u:
                    return u

    # 6. description HTML — first <img>
    if description:
        soup = BeautifulSoup(description, "html.parser")
        for img in soup.find_all("img"):
            for attr in ("src", "data-src", "data-original"):
                u = _valid(img.get(attr, ""))
                if u and "pixel" not in u:
                    return u

    return None


def _parse_rss2(root: ET.Element, source_name: str, category: str) -> list[dict]:
    """Parse RSS 2.0 feed."""
    items = []
    channel = root.find("channel")
    if channel is None:
        channel = root

    for item in channel.findall("item")[:20]:
        title = _text(item.find("title"))
        link = _text(item.find("link"))
        description = _text(item.find("description"))
        pub_date = _text(item.find("pubDate"))

        media_url = _extract_thumbnail(item, description)

        summary = _clean_html(description)

        if not title or not link:
            continue

        items.append({
            "title": title,
            "title_hash": title_hash(title),
            "url": link,
            "summary": summary,
            "sources": [source_name],
            "source_count": 1,
            "category": category,
            "thumbnail_url": media_url,
            "published_at": _parse_date(pub_date),
        })
    return items


def _parse_atom(root: ET.Element, source_name: str, category: str) -> list[dict]:
    """Parse Atom 1.0 feed."""
    items = []
    for entry in root.findall("atom:entry", NS)[:20]:
        title_el = entry.find("atom:title", NS)
        title = _text(title_el)

        link_el = entry.find("atom:link[@rel='alternate']", NS)
        if link_el is None:
            link_el = entry.find("atom:link", NS)
        link = link_el.get("href", "") if link_el is not None else ""

        summary_el = entry.find("atom:summary", NS) or entry.find("atom:content", NS)
        summary_raw = _text(summary_el)
        summary = _clean_html(summary_raw)

        updated = _text(entry.find("atom:updated", NS)) or _text(entry.find("atom:published", NS))

        if not title or not link:
            continue

        items.append({
            "title": title,
            "title_hash": title_hash(title),
            "url": link,
            "summary": summary,
            "sources": [source_name],
            "source_count": 1,
            "category": category,
            "thumbnail_url": _extract_thumbnail(entry, summary_raw),
            "published_at": _parse_date(updated),
        })
    return items


async def crawl_source(source: Source, client: httpx.AsyncClient) -> list[dict]:
    """Crawls a single RSS/Atom source and returns normalized news dicts."""
    try:
        response = await client.get(source.url, headers=HEADERS, timeout=15.0, follow_redirects=True)
        response.raise_for_status()
        content = response.text
    except Exception as e:
        logger.warning(f"Failed to fetch {source.name}: {e}")
        return []

    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        logger.warning(f"XML parse error for {source.name}: {e}")
        return []

    tag = root.tag.lower()
    if "rss" in tag or root.tag == "rss":
        items = _parse_rss2(root, source.name, source.category)
    elif "feed" in tag or "atom" in tag:
        items = _parse_atom(root, source.name, source.category)
    else:
        # Try RSS2 as fallback
        items = _parse_rss2(root, source.name, source.category)
        if not items:
            items = _parse_atom(root, source.name, source.category)

    # Attach language so Phase 3 (translation) can identify EN articles
    for item in items:
        item["language"] = source.language

    logger.debug(f"Crawled {len(items)} items from {source.name}")
    return items


async def _fetch_og_image(url: str, client: httpx.AsyncClient) -> Optional[str]:
    """Fetches og:image / twitter:image from an article page using browser headers."""
    from urllib.parse import urlparse
    domain = urlparse(url).netloc
    try:
        resp = await client.get(url, headers=BROWSER_HEADERS, timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        candidates = [
            soup.find("meta", property="og:image"),
            soup.find("meta", attrs={"name": "og:image"}),
            soup.find("meta", property="twitter:image"),
            soup.find("meta", attrs={"name": "twitter:image"}),
            soup.find("meta", attrs={"name": "twitter:image:src"}),
        ]
        for tag in candidates:
            if tag is None:
                continue
            content = tag.get("content", "").strip()
            if not content:
                continue
            if content.startswith("//"):
                content = "https:" + content
            elif content.startswith("/"):
                parsed = urlparse(url)
                content = f"{parsed.scheme}://{parsed.netloc}{content}"
            if content.startswith("http"):
                logger.debug(f"og:image hit {domain}: {content}")
                return content
    except Exception as e:
        logger.debug(f"og:image miss {domain}: {type(e).__name__}")
    return None


async def crawl_all_sources(sources: list[Source]) -> list[dict]:
    """Crawls all enabled sources concurrently, then enriches missing thumbnails via og:image."""
    enabled = [s for s in sources if s.enabled]

    # ── Phase 1: RSS crawl ──────────────────────────────────────────────────
    async with httpx.AsyncClient() as rss_client:
        tasks = [crawl_source(src, rss_client) for src in enabled]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    for result in results:
        if isinstance(result, list):
            items.extend(result)

    # ── Phase 1.5: Query existing DB hashes to prevent redundant work ───────
    try:
        from db.database import SessionLocal
        from models.news import NewsItem
        from datetime import datetime, timedelta
        db = SessionLocal()
        # Query existing hashes from the last 7 days
        cutoff = datetime.now() - timedelta(days=7)
        existing_hashes = {
            h[0] for h in db.query(NewsItem.title_hash)
            .filter(NewsItem.published_at >= cutoff)
            .all()
        }
        db.close()
    except Exception as e:
        logger.warning(f"Failed to pre-query existing hashes: {e}")
        existing_hashes = set()

    # ── Phase 2: og:image enrichment (NEW client — the RSS one is closed) ──
    def _og_blocked(url: str) -> bool:
        from urllib.parse import urlparse
        netloc = urlparse(url).netloc.lower()
        blocked_bases = {
            "bloomberg.com", "wsj.com", "ft.com", "economist.com",
            "investing.com", "marketwatch.com", "project-syndicate.org"
        }
        return any(netloc == base or netloc.endswith("." + base) for base in blocked_bases)

    # Only attempt og:image enrichment for genuinely new items (not in DB)
    missing = [
        item for item in items
        if not item.get("thumbnail_url")
        and item.get("url")
        and not _og_blocked(item["url"])
        and item["title_hash"] not in existing_hashes
    ]
    if missing:
        sem = asyncio.Semaphore(8)
        async with httpx.AsyncClient() as enrich_client:
            async def enrich(item: dict) -> None:
                async with sem:
                    og = await _fetch_og_image(item["url"], enrich_client)
                    if og:
                        item["thumbnail_url"] = og

            await asyncio.gather(*[enrich(item) for item in missing], return_exceptions=True)

    # ── Phase 3: any-lang→PT-BR translation ────────────────────────────────
    # Translate all genuinely new items that are not already in PT-BR
    non_pt_targets = [
        item for item in items
        if item.get("language", "pt") != "pt"
        and item["title_hash"] not in existing_hashes
    ]
    translate_count = len(non_pt_targets)
    if translate_count:
        try:
            from ai.translator import translate_batch
            await translate_batch(non_pt_targets)
        except Exception as e:
            logger.warning(f"Translation phase failed (non-blocking): {e}")

    logger.info(f"crawl_all_sources done — {len(items)} items ({len(items) - len(existing_hashes)} new), "
                f"{sum(1 for i in items if i.get('thumbnail_url'))} with thumbnails, "
                f"{translate_count} translated to PT-BR")
    return items

