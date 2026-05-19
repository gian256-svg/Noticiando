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

        # ── Narração ElevenLabs — concatenar subtexts de todas as cenas ──
        subtexts = [s.get("subtext") or s.get("headline", "") for s in scenes if s.get("subtext") or s.get("headline")]
        full_script = ". ".join(subtexts)
        narration_url = await generate_narration(full_script)

        # ── Trilha Epidemic Sound (download local garantido) ──
        music_url = await get_epidemic_soundtrack(req.category)

        result["narration_url"] = narration_url
        result["music_url"] = music_url

        return result

    except Exception as e:
        logger.error(f"Video scene generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
