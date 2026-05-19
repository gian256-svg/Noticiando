"""
media_fetcher.py — Download de B-roll (YouTube via yt-dlp) e fotos (artigo + fallback)
para enriquecer visualmente as cenas dos Reels.
"""

import hashlib
import logging
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MEDIA_DIR = PROJECT_ROOT / "output" / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

import os

def _get_localhost_base() -> str:
    port = os.getenv("PORT", "8765")
    return f"http://localhost:{port}"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# Queries de fallback por categoria caso yt-dlp falhe com a query original
CATEGORY_FALLBACK_QUERIES: dict[str, list[str]] = {
    "investments": ["stock market trading", "financial charts analysis", "wall street bulls bears"],
    "economy_br": ["brazil economy business", "sao paulo financial district", "brazilian real currency"],
    "economy_int": ["global economy finance", "federal reserve interest rates", "world trade economics"],
    "geopolitics": ["world map geopolitics", "international diplomacy", "global conflict news"],
    "crypto": ["bitcoin cryptocurrency trading", "blockchain technology", "digital currency crypto"],
    "general": ["business finance office", "economic news analysis", "market trading floor"],
}


def _query_hash(query: str) -> str:
    return hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]


def _find_cached_video(query_hash: str) -> Optional[Path]:
    for p in MEDIA_DIR.glob(f"broll_{query_hash}*.mp4"):
        return p
    return None


def _find_cached_photo(url_hash: str) -> Optional[Path]:
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = MEDIA_DIR / f"photo_{url_hash}.{ext}"
        if p.exists():
            return p
    return None






async def _ensure_fallback_video() -> str:
    dest = PROJECT_ROOT / "output" / "assets" / "fallback_video.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 10_000:
        return f"{_get_localhost_base()}/output/assets/fallback_video.mp4"
        
    url = "https://assets.mixkit.co/videos/preview/mixkit-financial-growth-charts-on-a-screen-41716-large.mp4"
    try:
        logger.info(f"Baixando video de fallback local em {dest}…")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                dest.write_bytes(resp.content)
                return f"{_get_localhost_base()}/output/assets/fallback_video.mp4"
    except Exception as e:
        logger.warning(f"Falha ao baixar video de fallback local: {e}")
        
    return url


async def fetch_youtube_broll(search_query: str, category: str = "general") -> Optional[str]:
    """
    Baixa um clip de B-roll do YouTube via yt-dlp para uso como fundo de cena.
    Retorna URL localhost ou URL de fallback.
    """
    try:
        import yt_dlp  # noqa: PLC0415
    except ImportError:
        logger.warning("yt-dlp não instalado. Pulando download de B-roll.")
        return await _ensure_fallback_video()

    queries_to_try = [search_query] + CATEGORY_FALLBACK_QUERIES.get(category, CATEGORY_FALLBACK_QUERIES["general"])

    for attempt, query in enumerate(queries_to_try[:3]):
        qhash = _query_hash(query)
        cached = _find_cached_video(qhash)
        if cached:
            logger.info(f"B-roll em cache: {cached.name}")
            return f"{_get_localhost_base()}/output/media/{cached.name}"

        output_template = str(MEDIA_DIR / f"broll_{qhash}.%(ext)s")
        # Usar --download-sections para pegar apenas 5 segundos (segundos 15 a 20) de forma super rápida!
        ydl_opts = {
            "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
            "outtmpl": output_template,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "max_filesize": 40 * 1024 * 1024,  # 40 MB
            "download_ranges": lambda info_dict, self: [{"start_time": 15, "end_time": 20}],
            "match_filter": yt_dlp.utils.match_filter_func("duration < 120"),
            "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
        }

        search_url = f"ytsearch1:{query} -playlist"
        try:
            import asyncio
            logger.info(f"Baixando B-roll do YouTube (tentativa {attempt + 1}): '{query}'")
            def _run_ydl():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([search_url])
            await asyncio.to_thread(_run_ydl)

            # Procurar arquivo baixado
            result_file = _find_cached_video(qhash)
            if result_file and result_file.stat().st_size > 10_000:
                logger.info(f"B-roll baixado: {result_file.name} ({result_file.stat().st_size // 1024}KB)")
                return f"{_get_localhost_base()}/output/media/{result_file.name}"
            logger.warning(f"Arquivo B-roll muito pequeno ou não encontrado para '{query}'")
        except Exception as e:
            logger.warning(f"yt-dlp falhou para '{query}': {e}")

    logger.error("Todas as tentativas de B-roll falharam. Retornando fallback video.")
    return await _ensure_fallback_video()


async def fetch_article_photos(
    article_url: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
) -> list[str]:
    """
    Busca até 2 fotos para usar como photo cutouts nas cenas.
    Prioridade: thumbnail_url → og:image do artigo → primeira <img> larga do HTML.
    Retorna lista de URLs localhost.
    """
    candidates: list[str] = []

    if thumbnail_url and _looks_like_real_image(thumbnail_url):
        candidates.append(thumbnail_url)

    if article_url and len(candidates) < 2:
        try:
            og_images = await _extract_og_images(article_url)
            for img in og_images:
                if img not in candidates and _looks_like_real_image(img):
                    candidates.append(img)
                    if len(candidates) >= 2:
                        break
        except Exception as e:
            logger.debug(f"Falha ao extrair og:image de {article_url}: {e}")

    downloaded: list[str] = []
    for url in candidates[:2]:
        local_path = await _download_image(url)
        if local_path:
            downloaded.append(f"{_get_localhost_base()}/output/media/{local_path.name}")

    return downloaded


def _looks_like_real_image(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    lower = url.lower()
    # Rejeitar placeholders genéricos e SVGs
    bad_patterns = ["placeholder", "logo", "favicon", "icon", "1x1", "pixel", ".svg", "spacer"]
    return not any(p in lower for p in bad_patterns)


async def _extract_og_images(article_url: str) -> list[str]:
    blocked_domains = {"bloomberg.com", "wsj.com", "ft.com", "investing.com"}
    domain = urlparse(article_url).netloc.replace("www.", "")
    if domain in blocked_domains:
        return []

    async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(article_url)
        if resp.status_code != 200:
            return []
        html = resp.text

    images: list[str] = []
    # og:image
    import re
    for match in re.finditer(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html):
        images.append(match.group(1))
    for match in re.finditer(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html):
        images.append(match.group(1))

    # twitter:image fallback
    if not images:
        for match in re.finditer(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']', html):
            images.append(match.group(1))

    # Primeira <img> com width indicativa de foto real
    if not images:
        for match in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', html):
            src = match.group(1)
            if _looks_like_real_image(src) and (src.startswith("http") or src.startswith("//")):
                images.append(src if src.startswith("http") else f"https:{src}")
                break

    return images[:2]


async def _download_image(url: str) -> Optional[Path]:
    url_hash = _query_hash(url)
    cached = _find_cached_photo(url_hash)
    if cached:
        return cached

    try:
        ext = "jpg"
        parsed_path = urlparse(url).path.lower()
        for candidate_ext in ("png", "webp", "jpeg", "jpg"):
            if f".{candidate_ext}" in parsed_path:
                ext = "jpg" if candidate_ext == "jpeg" else candidate_ext
                break

        dest = MEDIA_DIR / f"photo_{url_hash}.{ext}"
        async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200 or len(resp.content) < 5_000:
                return None
            dest.write_bytes(resp.content)
        logger.info(f"Foto baixada: {dest.name} ({len(resp.content) // 1024}KB)")
        return dest
    except Exception as e:
        logger.warning(f"Falha ao baixar imagem {url}: {e}")
        return None


async def cleanup_old_media(max_age_days: int = 7) -> None:
    """Remove arquivos de mídia mais antigos que max_age_days para economizar disco."""
    cutoff = time.time() - max_age_days * 86400
    removed = 0
    for f in MEDIA_DIR.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            try:
                f.unlink()
                removed += 1
            except OSError:
                pass
    if removed:
        logger.info(f"Limpeza de mídia: {removed} arquivo(s) removido(s).")
