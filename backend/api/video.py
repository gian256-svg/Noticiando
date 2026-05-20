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

        from ai.media_fetcher import fetch_article_photos, fetch_youtube_broll, fetch_youtube_thumbnail
        from ai.voice_and_sound import generate_narration, get_epidemic_soundtrack

        scenes = result.get("scenes", [])

        # ── Enriquecer cenas com fotos da matéria para cutouts ──
        article_photos = await fetch_article_photos(
            article_url=req.article_url,
            thumbnail_url=req.thumbnail_url,
        )

        # ── Resolver mídia por cena (paralelizado com asyncio.gather) ──
        async def resolve_single_scene(scene, idx_for_photo):
            v_type = scene.get("visual_type", "context")
            if not scene.get("decorator_type"):
                scene["decorator_type"] = "none"

            # 1. Resolver vídeo de fundo (background_video_url)
            yt_query = scene.get("youtube_search") or scene.get("media_search_query") or req.title
            bg_video = await fetch_youtube_broll(yt_query, req.category)
            scene["background_video_url"] = bg_video
            scene["media_url"] = bg_video

            # 2. Resolver cutouts
            if v_type == "cutout":
                kw = (scene.get("media_keyword") or "").lower().strip()
                if kw == "newspaper":
                    scene["cutout_url"] = "newspaper"
                else:
                    static_asset = _resolve_static_asset(kw)
                    if static_asset:
                        scene["cutout_url"] = static_asset
                    elif idx_for_photo is not None and idx_for_photo < len(article_photos):
                        scene["cutout_url"] = article_photos[idx_for_photo]
                    else:
                        # Tentar gerar imagem por IA usando person_name se disponível, ou media_keyword / headline
                        from ai.image_generator import generate_cutout_image
                        target_kw = scene.get("person_name") or scene.get("media_keyword") or scene.get("headline") or ""
                        context = scene.get("subtext") or scene.get("headline") or ""
                        generated = await generate_cutout_image(target_kw, context, req.category)
                        if generated:
                            scene["cutout_url"] = generated
                            scene["image_generated"] = True
                        else:
                            # Tentar fallback do YouTube thumbnail
                            search_term = scene.get("media_keyword") or scene.get("headline") or req.title
                            yt_thumb = await fetch_youtube_thumbnail(search_term)
                            if yt_thumb:
                                scene["cutout_url"] = yt_thumb
                            elif req.thumbnail_url:
                                scene["cutout_url"] = req.thumbnail_url
                            else:
                                scene["cutout_url"] = f"{_get_localhost()}/output/assets/cutout_money.png"

            # 3. Resolver ilustrações
            elif v_type == "illustration":
                kw = (scene.get("media_keyword") or "").lower().strip()
                static_asset = _resolve_static_asset(kw)
                if static_asset:
                    scene["illustration_url"] = static_asset
                    scene["media_url"] = static_asset
                else:
                    from ai.image_generator import generate_cutout_image
                    target_kw = scene.get("media_keyword") or scene.get("headline") or ""
                    context = scene.get("subtext") or scene.get("headline") or ""
                    generated = await generate_cutout_image(target_kw, context, req.category)
                    if generated:
                        scene["illustration_url"] = generated
                        scene["media_url"] = generated
                    else:
                        # Tentar fallback do YouTube thumbnail
                        search_term = scene.get("media_keyword") or scene.get("headline") or req.title
                        yt_thumb = await fetch_youtube_thumbnail(search_term)
                        if yt_thumb:
                            scene["illustration_url"] = yt_thumb
                            scene["media_url"] = yt_thumb
                        else:
                            fallback_ill = f"{_get_localhost()}/output/assets/illustration_growth.png"
                            scene["illustration_url"] = fallback_ill
                            scene["media_url"] = fallback_ill

            # 4. Caso de jornal impresso tradicional
            elif v_type == "newspaper_clip":
                scene["cutout_url"] = "newspaper"

        # Organizar as tasks para rodar em paralelo
        tasks = []
        cutout_count = 0
        for scene in scenes:
            if scene.get("visual_type") == "cutout":
                photo_idx = cutout_count
                cutout_count += 1
            else:
                photo_idx = None
            tasks.append(resolve_single_scene(scene, photo_idx))

        await asyncio.gather(*tasks)

        # ── Narração ElevenLabs Global (Script Inteiro) ──
        from ai.voice_and_sound import ELEVENLABS_API_KEY, generate_narration
        
        # 1. Concatenar todo o roteiro para manter a fluidez e prosódia correta
        full_script_texts = []
        for s in scenes:
            text = s.get("subtext") or s.get("headline", "")
            full_script_texts.append(text.strip())
        
        full_script = " ".join(full_script_texts)
        total_words = len(full_script.split()) or 1
        
        narration_result = await generate_narration(full_script) if ELEVENLABS_API_KEY else None
        global_audio_url = None
        captions_url = None
        total_audio_duration = 0.0
        
        if narration_result:
            global_audio_url = narration_result.get("audio_url")
            captions_url = narration_result.get("captions_url")
            result["narration_url"] = global_audio_url
            if captions_url:
                result["captions_url"] = captions_url
                
            filename = global_audio_url.split("/")[-1]
            local_audio_path = _PROJECT_ROOT / "output" / filename
            if local_audio_path.exists():
                total_audio_duration = get_audio_duration(local_audio_path)
        
        # Carregar as legendas globais se existirem
        all_captions = []
        if captions_url:
            try:
                captions_filename = captions_url.split("/")[-1]
                captions_path = _PROJECT_ROOT / "output" / captions_filename
                if captions_path.exists():
                    all_captions = json.loads(captions_path.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error(f"Erro ao carregar legendas do ElevenLabs: {e}")

        # 2. Distribuir a duração exata proporcionalmente por cena
        # E também distribuir as captions correspondentes à janela de tempo de cada cena
        scene_start_time = 0.0
        for s in scenes:
            text = s.get("subtext") or s.get("headline", "")
            words = len(text.split())
            v_type = s.get("visual_type", "context")
            if total_audio_duration > 0:
                scene_duration = (words / total_words) * total_audio_duration
                s["duration_seconds"] = round(scene_duration + 0.2, 2)
            else:
                if v_type == "hook":
                    s["duration_seconds"] = round(max(2.2, words * 0.45 + 0.4), 1)
                else:
                    s["duration_seconds"] = round(max(2.0, words * 0.45 + 0.5), 1)

            # Fatiar as legendas correspondentes
            scene_end_time = scene_start_time + s["duration_seconds"]
            scene_words = []
            for w in all_captions:
                if w["start"] >= scene_start_time and w["start"] < scene_end_time:
                    scene_words.append({
                        "word": w["word"],
                        "start": round(w["start"] - scene_start_time, 3),
                        "end": round(w["end"] - scene_start_time, 3)
                    })
            s["caption_words"] = scene_words
            scene_start_time = scene_end_time

        # Atualizar a duração total no JSON gerado como a soma de todas as cenas
        total_duration = sum(s["duration_seconds"] for s in scenes)
        result["duration"] = round(total_duration, 1)

        # ── Trilha Epidemic Sound (download local garantido) ──
        music_url = await get_epidemic_soundtrack(req.category)

        # result["narration_url"] mantido como global
        result["music_url"] = music_url

        return result

    except Exception as e:
        logger.error(f"Video scene generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
