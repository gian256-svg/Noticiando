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
    """Try multiple RSS thumbnail sources in priority order."""
    # media:thumbnail (Yahoo Media RSS)
    thumb = item.find("media:thumbnail", NS)
    if thumb is not None:
        url = thumb.get("url")
        if url:
            return url

    # media:content with image type
    for mc in item.findall("media:content", NS):
        t = mc.get("type", "")
        medium = mc.get("medium", "")
        if t.startswith("image/") or medium == "image":
            url = mc.get("url")
            if url:
                return url

    # enclosure (podcasts use this for images too)
    enc = item.find("enclosure")
    if enc is not None:
        t = enc.get("type", "")
        if t.startswith("image/"):
            url = enc.get("url")
            if url:
                return url

    # content:encoded — look for first <img>
    content_enc = item.find("content:encoded", NS)
    if content_enc is not None and content_enc.text:
        soup = BeautifulSoup(content_enc.text, "html.parser")
        img = soup.find("img")
        if img:
            src = img.get("src", "")
            if src and src.startswith("http"):
                return src

    # img inside description HTML
    if description:
        soup = BeautifulSoup(description, "html.parser")
        img = soup.find("img")
        if img:
            src = img.get("src", "")
            if src and src.startswith("http"):
                return src

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
    async with httpx.AsyncClient() as client:
        tasks = [crawl_source(src, client) for src in enabled]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        items: list[dict] = []
        for result in results:
            if isinstance(result, list):
                items.extend(result)

        # Enrich items missing thumbnails with og:image (max 8 concurrent requests)
        missing = [item for item in items if not item.get("thumbnail_url") and item.get("url")]
        if missing:
            sem = asyncio.Semaphore(8)

            async def enrich(item: dict) -> None:
                async with sem:
                    og = await _fetch_og_image(item["url"], client)
                    if og:
                        item["thumbnail_url"] = og

            await asyncio.gather(*[enrich(item) for item in missing], return_exceptions=True)

    return items
