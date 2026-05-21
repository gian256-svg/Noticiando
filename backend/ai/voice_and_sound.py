"""
voice_and_sound.py — Locução (ElevenLabs), trilhas (Epidemic Sound) e assets (Envato Elements)
"""

import hashlib
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

ELEVENLABS_API_KEY    = os.getenv("ELEVENLABS_API_KEY", "")
ENVATO_API_KEY        = os.getenv("ENVATO_API_KEY", "")
EPIDEMIC_SOUND_TOKEN  = os.getenv("EPIDEMIC_SOUND_TOKEN", "")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR   = PROJECT_ROOT / "output"
MEDIA_DIR    = PROJECT_ROOT / "output" / "media"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

def _get_localhost_base() -> str:
    port = os.getenv("PORT", "8765")
    return f"http://localhost:{port}"

# Voz premium para português brasileiro (Beto)
DEFAULT_BR_VOICE_ID = "xNGAXaCH8MaasNuo7Hr7"

# Mapeamento de categorias para tags Epidemic Sound e queries de fallback YouTube
CATEGORY_MUSIC_CONFIG: dict[str, dict[str, Any]] = {
    "investments": {
        "tags": ["corporate", "upbeat", "motivational"],
        "mood": "uplifting",
        "yt_fallback": "ytsearch1:corporate upbeat instrumental background loop",
    },
    "economy_br": {
        "tags": ["cinematic", "news", "documentary"],
        "mood": "neutral",
        "yt_fallback": "ytsearch1:news documentary cinematic instrumental background",
    },
    "economy_int": {
        "tags": ["investigative", "tension", "documentary"],
        "mood": "serious",
        "yt_fallback": "ytsearch1:investigative journalism tension instrumental background",
    },
    "geopolitics": {
        "tags": ["cinematic", "tension", "dramatic"],
        "mood": "dramatic",
        "yt_fallback": "ytsearch1:cinematic tension dramatic instrumental background loop",
    },
    "crypto": {
        "tags": ["futuristic", "electronic", "minimal"],
        "mood": "tech",
        "yt_fallback": "ytsearch1:futuristic electronic ambient instrumental background",
    },
    "general": {
        "tags": ["corporate", "modern", "news"],
        "mood": "neutral",
        "yt_fallback": "ytsearch1:modern corporate instrumental background loop",
    },
}

MUSIC_CACHE_DAYS = 7


import re

def sanitize_narration_text(text: str) -> str:
    """
    Sanitiza e normaliza o texto para evitar pronúncias incorretas ou truncadas no ElevenLabs.
    """
    # 1. Normaliza "77k" / "77K" -> "77 mil"
    text = re.sub(r'\b(\d+)\s*[kK]\b', r'\1 mil', text)
    
    # 2. Normaliza abreviações de escalas de dinheiro (mi, bi, tri)
    text = re.sub(r'\b(\d+)\s*mi\b', r'\1 milhões', text)
    text = re.sub(r'\b(\d+)\s*bi\b', r'\1 bilhões', text)
    text = re.sub(r'\b(\d+)\s*tri\b', r'\1 trilhões', text)
    
    # 3. Remove pontos de milhares soltos (ex: 77.000 -> 77000)
    while True:
        new_text = re.sub(r'\b(\d+)\.(\d{3})\b', r'\1\2', text)
        if new_text == text:
            break
        text = new_text

    # 4. Normaliza reais (R$ 100 ou R$ 100,50 ou R$ 77.000,00)
    def replace_real(m):
        val = m.group(1).replace(".", "")
        cents = m.group(2)
        if cents and int(cents) > 0:
            return f"{val} reais e {int(cents)} centavos"
        return f"{val} reais"
    text = re.sub(r'R\$\s*([\d\.]+)(?:,(\d+))?\b', replace_real, text)
    
    # 5. Normaliza dólares ($ 100 ou $ 100,50 ou US$ 100)
    def replace_dollar(m):
        val = m.group(1).replace(".", "")
        cents = m.group(2)
        if cents and int(cents) > 0:
            return f"{val} dólares e {int(cents)} centavos"
        return f"{val} dólares"
    text = re.sub(r'(?:US)?\$\s*([\d\.]+)(?:,(\d+))?\b', replace_dollar, text)
    
    # 6. Normaliza porcentagem (%) -> "por cento" (suporta decimais como 1,5% ou 1.5%)
    text = re.sub(r'(\d+(?:[.,]\d+)?)\s*%', r'\1 por cento', text)
    
    # 7. Normaliza versus
    text = re.sub(r'\bvs\.\b', 'versus', text, flags=re.IGNORECASE)
    text = re.sub(r'\bvs\b', 'versus', text, flags=re.IGNORECASE)
    
    # 8. Transforma pontos decimais remanescentes em vírgulas para leitura em PT-BR (ex: 1.5 -> 1,5)
    text = re.sub(r'\b(\d+)\.(\d+)\b', r'\1,\2', text)

    # 9. Remove espaços extras
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _build_word_timestamps(alignment: dict) -> list[dict]:
    """Converte character-level alignment do ElevenLabs em word-level."""
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])

    words = []
    current_word = []
    word_start = None
    word_start_idx = None

    for idx, (char, start, end) in enumerate(zip(chars, starts, ends)):
        if char == " " or char == "":
            if current_word:
                last_idx = idx - 1
                word_end = ends[last_idx] if last_idx < len(ends) else end
                words.append({
                    "word": "".join(current_word),
                    "start": word_start,
                    "end": word_end
                })
                current_word = []
                word_start = None
                word_start_idx = None
        else:
            if word_start is None:
                word_start = start
                word_start_idx = idx
            current_word.append(char)

    if current_word and word_start_idx is not None:
        last_idx = len(chars) - 1
        word_end = ends[last_idx] if last_idx < len(ends) else ends[-1]
        words.append({
            "word": "".join(current_word),
            "start": word_start,
            "end": word_end
        })

    return words


async def generate_narration(text: str, voice_id: str = DEFAULT_BR_VOICE_ID) -> Optional[dict]:
    """
    Gera narração via ElevenLabs API com timestamps de alinhamento de palavras.
    Retorna dicionário contendo as URLs do áudio e das legendas ou None.
    """
    if not ELEVENLABS_API_KEY:
        logger.warning("ELEVENLABS_API_KEY não configurada. Pulando locução.")
        return None

    sanitized = sanitize_narration_text(text)
    url     = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {
        "text": sanitized,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.40,  # 35% a 45% (aplica emoção sem perder estabilidade)
            "similarity_boost": 0.80,  # 75% a 85% (fidelidade sem distorções)
            "style": 0.10,  # 0% a 15% (evita emoção artificial)
            "use_speaker_boost": True,  # Textura natural
        },
    }

    try:
        logger.info(f"Gerando narração com timestamps no ElevenLabs (Beto)... original: '{text[:60]}...' | sanitized: '{sanitized[:60]}...'")
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=60.0)
            if resp.status_code != 200:
                logger.error(f"ElevenLabs erro {resp.status_code}: {resp.text[:300]}")
                return None
            
            data = resp.json()
            audio_base64 = data.get("audio_base64", "")
            if not audio_base64:
                logger.error("ElevenLabs response did not contain audio_base64.")
                return None
            
            import base64
            import json
            audio_bytes = base64.b64decode(audio_base64)
            ts = int(time.time())
            filename = f"narration_{ts}.mp3"
            filepath = OUTPUT_DIR / filename
            filepath.write_bytes(audio_bytes)
            
            alignment = data.get("alignment") or data.get("normalized_alignment")
            captions = []
            captions_filename = f"narration_{ts}_captions.json"
            captions_filepath = OUTPUT_DIR / captions_filename
            
            if alignment:
                captions = _build_word_timestamps(alignment)
                captions_filepath.write_text(json.dumps(captions, ensure_ascii=False), encoding="utf-8")
                logger.info(f"Legendas salvas: {captions_filepath.name}")
            else:
                captions_filepath.write_text("[]", encoding="utf-8")
                logger.warning("Nenhum alinhamento retornado pelo ElevenLabs.")

            logger.info(f"Narração salva: {filepath.name} ({len(audio_bytes) // 1024}KB)")
            return {
                "audio_url": f"{_get_localhost_base()}/output/{filename}",
                "captions_url": f"{_get_localhost_base()}/output/{captions_filename}"
            }
    except Exception as e:
        logger.error(f"ElevenLabs falhou: {e}", exc_info=True)
        return None



async def get_epidemic_soundtrack(category: str) -> Optional[str]:
    """
    Busca trilha no Epidemic Sound (Bearer JWT parceiro).
    Fallback: download via yt-dlp de música royalty-free.
    Retorna URL localhost do arquivo local ou None.
    """
    cfg = CATEGORY_MUSIC_CONFIG.get(category, CATEGORY_MUSIC_CONFIG["general"])

    # Verificar cache recente (< 7 dias)
    cached = _find_cached_music(category)
    if cached:
        logger.info(f"Trilha em cache para '{category}': {cached.name}")
        return f"{_get_localhost_base()}/output/media/{cached.name}"

    # 1. Tentar Epidemic Sound API real (Temporariamente Desativado a pedido do usuário)
    # if EPIDEMIC_SOUND_TOKEN:
    #     result = await _fetch_epidemic_track(category, cfg)
    #     if result:
    #         return result

    # 2. Fallback: yt-dlp download de música royalty-free limpa
    return await _download_music_ytdlp(category, cfg)


def _find_cached_music(category: str) -> Optional[Path]:
    cutoff = time.time() - MUSIC_CACHE_DAYS * 86400
    for p in MEDIA_DIR.glob(f"music_{category}_*.mp3"):
        if p.stat().st_mtime > cutoff:
            return p
    return None


async def _fetch_epidemic_track(category: str, cfg: dict) -> Optional[str]:
    """Tenta buscar e baixar uma trilha da API do Epidemic Sound."""
    tags = ",".join(cfg["tags"])
    endpoints_to_try = [
        f"https://api.epidemicsound.com/v2/tracks?soundTypes=MUSIC&tags={tags}&pageSize=5&page=1",
        f"https://api.epidemicsound.com/api/v2/tracks?soundTypes=MUSIC&tags={tags}&pageSize=5",
        f"https://api.epidemicsound.com/v2/search?q={cfg['mood']}&type=track&pageSize=5",
    ]
    headers = {"Authorization": f"Bearer {EPIDEMIC_SOUND_TOKEN}", "Accept": "application/json"}

    for endpoint in endpoints_to_try:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(endpoint, headers=headers)
                logger.debug(f"Epidemic Sound {endpoint}: HTTP {resp.status_code}")
                if resp.status_code != 200:
                    continue

                data = resp.json()
                tracks = (
                    data.get("tracks")
                    or data.get("results")
                    or data.get("data", {}).get("tracks")
                    or []
                )
                if not tracks:
                    continue

                track = tracks[0]
                audio_url = (
                    track.get("downloadUrl")
                    or track.get("audioUrl")
                    or track.get("streamUrl")
                    or (track.get("stems", [{}])[0] if track.get("stems") else {}).get("audioUrl")
                )
                if not audio_url:
                    logger.warning("Epidemic Sound track sem audioUrl.")
                    continue

                track_id = str(track.get("id", "track"))[:8]
                filename  = f"music_{category}_{track_id}.mp3"
                dest      = MEDIA_DIR / filename
                dl_resp   = await client.get(audio_url, headers=headers, timeout=30.0)
                if dl_resp.status_code == 200 and len(dl_resp.content) > 50_000:
                    dest.write_bytes(dl_resp.content)
                    logger.info(f"Trilha Epidemic Sound salva: {filename} ({len(dl_resp.content) // 1024}KB)")
                    return f"{_get_localhost_base()}/output/media/{filename}"

        except Exception as e:
            logger.debug(f"Epidemic Sound {endpoint} falhou: {e}")

    logger.warning("Epidemic Sound API sem trilha utilizável. Usando fallback yt-dlp.")
    return None


async def _download_music_ytdlp(category: str, cfg: dict) -> Optional[str]:
    """Baixa música royalty-free do YouTube como fallback."""
    try:
        import yt_dlp  # noqa: PLC0415
    except ImportError:
        logger.warning("yt-dlp não disponível para fallback de música.")
        return None

    search_url = cfg["yt_fallback"]
    cat_hash   = hashlib.md5(category.encode()).hexdigest()[:8]
    filename   = f"music_{category}_{cat_hash}"
    output_tpl = str(MEDIA_DIR / f"{filename}.%(ext)s")
    dest_mp3   = MEDIA_DIR / f"{filename}.mp3"

    ydl_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": output_tpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "max_filesize": 20 * 1024 * 1024,
        "match_filter": yt_dlp.utils.match_filter_func("duration > 60 & duration < 600"),
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ],
    }

    try:
        import asyncio
        logger.info(f"Baixando trilha via yt-dlp para categoria '{category}'...")
        def _run_ydl():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([search_url])
        await asyncio.to_thread(_run_ydl)

        if dest_mp3.exists() and dest_mp3.stat().st_size > 50_000:
            logger.info(f"Trilha fallback salva: {dest_mp3.name}")
            return f"{_get_localhost_base()}/output/media/{dest_mp3.name}"

        for p in MEDIA_DIR.glob(f"{filename}.*"):
            if p.suffix in (".mp3", ".m4a", ".webm") and p.stat().st_size > 50_000:
                logger.info(f"Trilha fallback (formato alternativo): {p.name}")
                return f"{_get_localhost_base()}/output/media/{p.name}"

    except Exception as e:
        logger.error(f"yt-dlp fallback de música falhou para '{category}': {e}")

    return None


async def search_envato_footage(query: str = "") -> list[dict[str, Any]]:  # noqa: ARG001
    """
    Busca stock footage no Envato Elements.
    Retorna lista de assets (skeleton — mídia principal agora vem do media_fetcher).
    """
    if not ENVATO_API_KEY:
        return []

    headers = {"Authorization": f"Bearer {ENVATO_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.envato.com/v1/market/categories",
                headers=headers,
            )
            if resp.status_code == 200:
                logger.info("Envato API acessível.")
    except Exception as e:
        logger.debug(f"Envato API: {e}")

    return []
