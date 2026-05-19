import asyncio
import json
import logging
import os
import re
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ai.video_scene_agent import generate_video_scenes

router = APIRouter()
logger = logging.getLogger(__name__)

def _get_localhost() -> str:
    port = os.getenv("PORT", "8765")
    return f"http://localhost:{port}"


def _resolve_static_asset(keyword: str) -> str | None:
    local_base = _get_localhost()
    assets = {
        "nigro":   f"{local_base}/output/assets/cutout_nigro.png",
        "primo":   f"{local_base}/output/assets/cutout_nigro.png",
        "perini":  f"{local_base}/output/assets/cutout_perini.png",
        "money":   f"{local_base}/output/assets/cutout_money.png",
        "briefcase": f"{local_base}/output/assets/cutout_money.png",
        "growth":  f"{local_base}/output/assets/illustration_growth.png",
        "chart":   f"{local_base}/output/assets/illustration_growth.png",
        "crypto":  f"{local_base}/output/assets/illustration_crypto.png",
        "bitcoin": f"{local_base}/output/assets/illustration_crypto.png",
    }
    for key, url in assets.items():
        if key in keyword:
            return url
    return None

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_VIDEO_ENTRY  = str(_PROJECT_ROOT / "src" / "renderer" / "video" / "index.ts")


def get_audio_duration(file_path: Path) -> float:
    import subprocess
    import json
    try:
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", "-show_format", str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        duration = float(data["format"]["duration"])
        return duration
    except Exception as e:
        logger.error(f"Failed to get audio duration via ffprobe: {e}")
        return 0.0


def align_scenes_to_audio(scenes: list[dict], actual_audio_duration: float) -> list[dict]:
    raw_durations = []
    for scene in scenes:
        v_type = scene.get("visual_type", "context")
        subtext = scene.get("subtext", "")
        headline = scene.get("headline", "")

        text_for_weight = subtext or headline
        words = len(text_for_weight.split()) if text_for_weight else 0

        if v_type == "hook":
            raw_dur = max(2.2, words * 0.45 + 0.4)
        else:
            raw_dur = max(2.0, words * 0.45 + 0.5)

        raw_durations.append(raw_dur)

    total_raw = sum(raw_durations)
    if total_raw <= 0.0:
        avg = actual_audio_duration / len(scenes) if scenes else 0.0
        for s in scenes:
            s["duration_seconds"] = round(avg, 1)
        return scenes

    scale = actual_audio_duration / total_raw
    for i, s in enumerate(scenes):
        s["duration_seconds"] = round(raw_durations[i] * scale, 1)

    # Adjust rounding errors
    curr_sum = sum(s["duration_seconds"] for s in scenes)
    diff = round(actual_audio_duration - curr_sum, 1)
    if diff != 0.0 and scenes:
        max_idx = 0
        max_val = -1.0
        for i, s in enumerate(scenes):
            if s["duration_seconds"] > max_val:
                max_val = s["duration_seconds"]
                max_idx = i
        scenes[max_idx]["duration_seconds"] = round(scenes[max_idx]["duration_seconds"] + diff, 1)

    return scenes



class VideoSceneRequest(BaseModel):
    news_id: str
    title: str
    summary: str = ""
    category: str = "general"
    duration: int = 45
    thumbnail_url: str | None = None
    article_url: str | None = None


class RenderVideoRequest(BaseModel):
    composition_props: dict
    news_title: str
    total_frames: int


@router.post("/render-video")
async def render_video_endpoint(req: RenderVideoRequest):
    """Render a Reels MP4 via the Remotion CLI."""
    safe = re.sub(r"[^\w\s]", "", req.news_title).strip()
    safe = re.sub(r"\s+", "_", safe)[:40]
    output_path = str(_PROJECT_ROOT / "output" / f"Reels_{safe}_{int(time.time())}.mp4")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    props_file = str(_PROJECT_ROOT / "output" / f".tmp_props_{int(time.time())}.json")
    with open(props_file, "w", encoding="utf-8") as f:
        json.dump(req.composition_props, f)

    executable = "npx.cmd" if os.name == "nt" else "npx"
    cmd = [
        executable, "remotion", "render",
        _VIDEO_ENTRY,
        "Reels",
        output_path,
        f"--props={props_file}",
        "--codec=h264",
        "--pixel-format=yuv420p",
        "--log=error",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(_PROJECT_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        try:
            os.unlink(props_file)
        except OSError:
            pass

        if proc.returncode != 0:
            raise RuntimeError(stderr.decode(errors="replace").strip() or "Render failed")

        return {"ok": True, "output_path": output_path}

    except Exception as e:
        logger.error(f"Render error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-video-scenes")
async def generate_scenes_endpoint(req: VideoSceneRequest):
    try:
        result = await generate_video_scenes(
            title=req.title,
            summary=req.summary,
            category=req.category,
            duration=req.duration,
        )
        result["news_id"] = req.news_id
        if req.thumbnail_url:
            result["thumbnail_url"] = req.thumbnail_url

        from ai.media_fetcher import fetch_article_photos, fetch_youtube_broll
        from ai.voice_and_sound import generate_narration, get_epidemic_soundtrack

        scenes = result.get("scenes", [])

        # ── Enriquecer cenas com fotos da matéria para cutouts ──
        article_photos = await fetch_article_photos(
            article_url=req.article_url,
            thumbnail_url=req.thumbnail_url,
        )
        photo_idx = 0

        # ── Resolver mídia por cena (video B-roll, cutout foto, ilustração) ──
        for scene in scenes:
            v_type = scene.get("visual_type", "context")

            if not scene.get("decorator_type"):
                scene["decorator_type"] = "none"

            # 1. Resolver vídeo de fundo (background_video_url) para todas as cenas para garantir dinamismo e movimento contínuo
            yt_query = scene.get("youtube_search") or scene.get("media_search_query") or req.title
            bg_video = await fetch_youtube_broll(yt_query, req.category)
            scene["background_video_url"] = bg_video
            scene["media_url"] = bg_video  # retrocompatibilidade

            # 2. Resolver cutouts (imagens de colagem recortadas)
            if v_type == "cutout":
                kw = (scene.get("media_keyword") or "").lower()
                if kw == "newspaper":
                    scene["cutout_url"] = "newspaper"
                else:
                    static_asset = _resolve_static_asset(kw)
                    if static_asset:
                        scene["cutout_url"] = static_asset
                    elif photo_idx < len(article_photos):
                        scene["cutout_url"] = article_photos[photo_idx]
                        photo_idx += 1
                    elif req.thumbnail_url:
                        scene["cutout_url"] = req.thumbnail_url
                    else:
                        # Garantir que há sempre um cutout no estilo colagem editorial
                        scene["cutout_url"] = f"{_get_localhost()}/output/assets/cutout_money.png"

            # 3. Resolver ilustrações (gráficos ou desenhos estilizados)
            elif v_type == "illustration":
                kw = (scene.get("media_keyword") or "").lower()
                static_asset = _resolve_static_asset(kw)
                if static_asset:
                    scene["illustration_url"] = static_asset
                    scene["media_url"] = static_asset  # retrocompatibilidade
                else:
                    fallback_ill = f"{_get_localhost()}/output/assets/illustration_growth.png"
                    scene["illustration_url"] = fallback_ill
                    scene["media_url"] = fallback_ill  # retrocompatibilidade

        # ── Narração ElevenLabs por cena (paralela para alta velocidade) ──
        from ai.voice_and_sound import ELEVENLABS_API_KEY, generate_narration

        async def process_scene_audio(s):
            text = s.get("subtext") or s.get("headline", "")
            if not text:
                s["duration_seconds"] = 2.5
                return

            audio_url = await generate_narration(text)
            if audio_url:
                s["audio_url"] = audio_url
                filename = audio_url.split("/")[-1]
                local_audio_path = _PROJECT_ROOT / "output" / filename
                if local_audio_path.exists():
                    actual_duration = get_audio_duration(local_audio_path)
                    if actual_duration > 0.0:
                        # Duração exata + 0.4s de respiro para evitar cortes secos e bruscos
                        s["duration_seconds"] = round(actual_duration + 0.4, 2)
                        return

            # Fallback se ElevenLabs falhar ou estiver sem chave: estimar por palavras
            words = len(text.split())
            v_type = s.get("visual_type", "context")
            if v_type == "hook":
                s["duration_seconds"] = round(max(2.2, words * 0.45 + 0.4), 1)
            else:
                s["duration_seconds"] = round(max(2.0, words * 0.45 + 0.5), 1)

        if ELEVENLABS_API_KEY:
            logger.info("Gerando narrações ElevenLabs individuais por cena em paralelo...")
            await asyncio.gather(*(process_scene_audio(s) for s in scenes))
        else:
            logger.info("ElevenLabs API Key não configurada. Estimando durações das cenas...")
            for s in scenes:
                text = s.get("subtext") or s.get("headline", "")
                words = len(text.split()) if text else 0
                v_type = s.get("visual_type", "context")
                if v_type == "hook":
                    s["duration_seconds"] = round(max(2.2, words * 0.45 + 0.4), 1)
                else:
                    s["duration_seconds"] = round(max(2.0, words * 0.45 + 0.5), 1)

        # Atualizar a duração total no JSON gerado como a soma de todas as cenas
        total_duration = sum(s["duration_seconds"] for s in scenes)
        result["duration"] = round(total_duration, 1)

        # ── Trilha Epidemic Sound (download local garantido) ──
        music_url = await get_epidemic_soundtrack(req.category)

        result["narration_url"] = None  # Áudio agora é tocado por cena via scene.audio_url
        result["music_url"] = music_url

        return result

    except Exception as e:
        logger.error(f"Video scene generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
