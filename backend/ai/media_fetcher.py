"""
media_fetcher.py — Download de B-roll (YouTube via yt-dlp) e fotos (artigo + fallback)
para enriquecer visualmente as cenas dos Reels.
"""

import asyncio
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




async def _ensure_fallback_video(category: str, scene_index: int = 0) -> str:
    fallback_queries_rotation = {
        "investments": [
            "stock market trading chart loop",
            "financial charts analysis trading",
            "wall street bulls bears background",
            "corporate finance office loop"
        ],
        "economy_br": [
            "sao paulo avenue traffic aerial",
            "avenida paulista movimento carros",
            "brazilian bank real currency cash",
            "rio de janeiro aerial cityscape"
        ],
        "economy_int": [
            "new york wall street pedestrians",
            "federal reserve building outside",
            "global market trading screens",
            "london financial city district"
        ],
        "geopolitics": [
            "spinning earth globe map",
            "world map geopolitics blue background",
            "united nations flags assembly",
            "international airport airplanes cargo"
        ],
        "crypto": [
            "bitcoin blockchain network loop",
            "cryptocurrency mining farm server",
            "ethereum logo rotating technology",
            "digital currency graphs neon"
        ],
        "general": [
            "newsroom abstract background",
            "business finance office corporate",
            "news broadcast studio lights",
            "documentary B-roll office work"
        ]
    }
    queries = fallback_queries_rotation.get(category, fallback_queries_rotation["general"])
    query = queries[scene_index % len(queries)]
    qhash = _query_hash(f"fallback_{query}")
    
    dest = MEDIA_DIR / f"fallback_{qhash}.mp4"
    if dest.exists() and dest.stat().st_size > 10_000:
        return f"{_get_localhost_base()}/output/media/fallback_{qhash}.mp4"
    
    try:
        import yt_dlp
        logger.info(f"Baixando video de fallback local ({category}, index {scene_index}): '{query}'…")
        ydl_opts = {
            "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
            "outtmpl": str(MEDIA_DIR / f"fallback_{qhash}.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "max_filesize": 40 * 1024 * 1024,
            "download_ranges": lambda info_dict, self: [{"start_time": 0, "end_time": 10}],
            "match_filter": yt_dlp.utils.match_filter_func("duration < 120"),
            "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
        }
        import asyncio
        def _run_ydl():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"ytsearch1:{query} -playlist"])
        await asyncio.to_thread(_run_ydl)
        
        if dest.exists():
            return f"{_get_localhost_base()}/output/media/fallback_{qhash}.mp4"
    except Exception as e:
        logger.warning(f"Falha ao baixar video de fallback local: {e}")
        
    return f"{_get_localhost_base()}/output/media/fallback_{qhash}.mp4"
 
async def fetch_youtube_broll(
    search_query: str,
    category: str = "general",
    salt: Optional[str] = None,
    scene_index: int = 0
) -> Optional[str]:
    """
    Baixa um clip de B-roll do YouTube via yt-dlp para uso como fundo de cena.
    Retorna URL localhost ou URL de fallback. Usa scene_index para garantir B-roll único.
    """
    try:
        import yt_dlp  # noqa: PLC0415
    except ImportError:
        logger.warning("yt-dlp não instalado. Pulando download de B-roll.")
        return await _ensure_fallback_video(category, scene_index)
 
    queries_to_try = [search_query] + CATEGORY_FALLBACK_QUERIES.get(category, CATEGORY_FALLBACK_QUERIES["general"])

    for attempt, query in enumerate(queries_to_try[:3]):
        try:
            import asyncio
            
            logger.info(f"Buscando B-roll do YouTube para: '{query}' (cena {scene_index})")
            
            def _extract_urls():
                with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": True}) as ydl:
                    info = ydl.extract_info(f"ytsearch5:{query} -playlist", download=False)
                    if info and "entries" in info and info["entries"]:
                        return [entry["url"] for entry in info["entries"] if entry.get("url")]
                    return []
            
            urls = await asyncio.to_thread(_extract_urls)
            
            # Seleciona URL baseada no scene_index
            if urls:
                chosen_url = urls[scene_index % len(urls)]
                logger.info(f"Selecionada URL indexada {scene_index % len(urls)}: {chosen_url}")
                search_url = chosen_url
            else:
                logger.warning("Nenhuma URL extraída via busca flat. Fazendo busca direta.")
                search_url = f"ytsearch1:{query} -playlist"

            # qhash baseado na URL escolhida ou na query se não houver URL
            url_for_hash = search_url if urls else query
            qhash = _query_hash(f"{url_for_hash}_{salt}" if salt else url_for_hash)
            
            cached = _find_cached_video(qhash)
            if cached:
                logger.info(f"B-roll em cache: {cached.name}")
                return f"{_get_localhost_base()}/output/media/{cached.name}"

            output_template = str(MEDIA_DIR / f"broll_{qhash}.%(ext)s")
            ydl_opts = {
                "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
                "outtmpl": output_template,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "max_filesize": 40 * 1024 * 1024,  # 40 MB
                "download_ranges": lambda info_dict, self: [{"start_time": 0, "end_time": 10}],
                "match_filter": yt_dlp.utils.match_filter_func("duration < 120"),
                "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
            }

            logger.info(f"Baixando B-roll do YouTube (tentativa {attempt + 1}): '{query}' de {search_url}")
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
    return await _ensure_fallback_video(category, scene_index)


async def fetch_youtube_thumbnail(search_query: str) -> Optional[str]:
    """
    Busca um vídeo no YouTube baseado na query e baixa a sua miniatura (thumbnail) de alta resolução.
    Retorna URL local do arquivo ou None.
    """
    try:
        import yt_dlp
    except ImportError:
        logger.warning("yt-dlp não instalado. Pulando download de thumbnail do YouTube.")
        return None

    qhash = _query_hash(f"thumb_{search_query}")
    cached = _find_cached_photo(qhash)
    if cached:
        logger.info(f"Thumbnail em cache: {cached.name}")
        return f"{_get_localhost_base()}/output/media/{cached.name}"

    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
        }
        import asyncio
        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch1:{search_query} -playlist", download=False)
                if not info or "entries" not in info or not info["entries"]:
                    return None
                entry = info["entries"][0]
                return entry.get("thumbnail")
        
        thumb_url = await asyncio.to_thread(_extract)
        if not thumb_url:
            logger.warning(f"Nenhum thumbnail encontrado para query '{search_query}'")
            return None

        ext = "jpg"
        dest = MEDIA_DIR / f"photo_{qhash}.{ext}"
        async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(thumb_url)
            if resp.status_code != 200 or len(resp.content) < 5_000:
                return None
            dest.write_bytes(resp.content)
        
        logger.info(f"Thumbnail do YouTube baixado: {dest.name}")
        return f"{_get_localhost_base()}/output/media/{dest.name}"
    except Exception as e:
        logger.warning(f"Falha ao obter thumbnail do YouTube para '{search_query}': {e}")
        return None


async def fetch_person_photo(person_name: str) -> Optional[str]:
    """
    Busca a foto oficial de uma figura pública usando Wikipedia REST API.
    Fallback: DuckDuckGo Images search. Remove fundo via rembg se disponível.
    Retorna URL local do arquivo PNG transparente ou None.
    """
    if not person_name or not person_name.strip():
        return None

    # Normalize name for cache key
    name_key = person_name.strip().lower().replace(" ", "_")
    qhash = _query_hash(f"person_{name_key}")

    # Check cache first
    for ext in ("png", "jpg", "jpeg", "webp"):
        cached = MEDIA_DIR / f"person_{qhash}.{ext}"
        if cached.exists() and cached.stat().st_size > 5_000:
            logger.info(f"Foto de pessoa em cache: {cached.name} ({person_name})")
            return f"{_get_localhost_base()}/output/media/{cached.name}"

    photo_url: Optional[str] = None

    # ── 1. Wikipedia REST API ──────────────────────────────────────────────
    try:
        wiki_name = person_name.strip().replace(" ", "_")
        wiki_api = f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_name}"
        async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(wiki_api)
            if resp.status_code == 200:
                data = resp.json()
                thumb = data.get("thumbnail") or data.get("originalimage")
                if thumb and thumb.get("source"):
                    photo_url = thumb["source"]
                    logger.info(f"Foto via Wikipedia para '{person_name}': {photo_url}")
    except Exception as e:
        logger.debug(f"Wikipedia falhou para '{person_name}': {e}")

    # ── 2. DuckDuckGo Images fallback ──────────────────────────────────────
    if not photo_url:
        try:
            ddg_query = f"{person_name} official portrait headshot"
            ddg_url = f"https://duckduckgo.com/?q={ddg_query.replace(' ', '+')}&iax=images&ia=images"
            ddg_api  = f"https://api.duckduckgo.com/?q={ddg_query.replace(' ', '+')}&format=json&ia=images"
            async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(ddg_api)
                if resp.status_code == 200:
                    data = resp.json()
                    # RelatedTopics may contain image
                    if data.get("Image"):
                        photo_url = data["Image"]
                        logger.info(f"Foto via DuckDuckGo DDG API para '{person_name}': {photo_url}")
                    elif data.get("RelatedTopics"):
                        for topic in data["RelatedTopics"][:3]:
                            icon = topic.get("Icon", {})
                            if icon.get("URL") and icon["URL"].startswith("http"):
                                photo_url = icon["URL"]
                                break
        except Exception as e:
            logger.debug(f"DuckDuckGo falhou para '{person_name}': {e}")

    # ── 3. Wikipedia PT fallback ───────────────────────────────────────────
    if not photo_url:
        try:
            wiki_name = person_name.strip().replace(" ", "_")
            wiki_pt = f"https://pt.wikipedia.org/api/rest_v1/page/summary/{wiki_name}"
            async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(wiki_pt)
                if resp.status_code == 200:
                    data = resp.json()
                    thumb = data.get("thumbnail") or data.get("originalimage")
                    if thumb and thumb.get("source"):
                        photo_url = thumb["source"]
                        logger.info(f"Foto via Wikipedia PT para '{person_name}': {photo_url}")
        except Exception as e:
            logger.debug(f"Wikipedia PT falhou para '{person_name}': {e}")

    if not photo_url:
        logger.warning(f"Nenhuma foto encontrada para '{person_name}'")
        return None

    # ── 4. Download + remover fundo via rembg ──────────────────────────────
    try:
        dest_raw = MEDIA_DIR / f"person_raw_{qhash}.jpg"
        async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(photo_url)
            if resp.status_code != 200 or len(resp.content) < 5_000:
                return None
            dest_raw.write_bytes(resp.content)

        dest_final = MEDIA_DIR / f"person_{qhash}.png"

        # Try rembg background removal
        try:
            from rembg import remove as rembg_remove
            from PIL import Image as PILImage
            import io

            def _remove_bg():
                with open(dest_raw, "rb") as f:
                    raw_bytes = f.read()
                result_bytes = rembg_remove(raw_bytes)
                img = PILImage.open(io.BytesIO(result_bytes)).convert("RGBA")
                # Crop to portrait: take center 60% width, full height
                w, h = img.size
                crop_w = int(w * 0.85)
                crop_x = (w - crop_w) // 2
                img = img.crop((crop_x, 0, crop_x + crop_w, h))
                img.save(str(dest_final), "PNG")

            await asyncio.to_thread(_remove_bg)
            # Clean up raw file
            try:
                dest_raw.unlink()
            except Exception:
                pass
            logger.info(f"Foto de pessoa com fundo removido: {dest_final.name}")
        except ImportError:
            # rembg not installed — use raw photo without background removal
            import shutil
            shutil.copy(str(dest_raw), str(dest_final))
            logger.info(f"Foto de pessoa sem remoção de fundo (rembg não instalado): {dest_final.name}")
        except Exception as e:
            logger.warning(f"rembg falhou para '{person_name}': {e} — usando foto bruta")
            import shutil
            shutil.copy(str(dest_raw), str(dest_final))

        if dest_final.exists() and dest_final.stat().st_size > 3_000:
            return f"{_get_localhost_base()}/output/media/{dest_final.name}"

    except Exception as e:
        logger.warning(f"Falha ao baixar foto de '{person_name}': {e}")

    return None


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
