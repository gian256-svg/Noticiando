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

            if v_type == "video":
                yt_query = scene.get("youtube_search") or scene.get("media_search_query") or req.title
                media_url = await fetch_youtube_broll(yt_query, req.category)
                scene["media_url"] = media_url

            elif v_type == "cutout":
                # Priorizar foto da matéria; fallback para thumbnail
                if photo_idx < len(article_photos):
                    scene["cutout_url"] = article_photos[photo_idx]
                    photo_idx += 1
                elif req.thumbnail_url:
                    scene["cutout_url"] = req.thumbnail_url

            elif v_type == "illustration":
                # Ilustrações ficam como None; o frontend usa o fallback SVG interno
                scene.setdefault("media_url", None)

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
