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


def get_min_duration_for_scene(scene: dict, sources_count: int) -> float:
    v_type = scene.get("visual_type", "context")
    kw = (scene.get("media_keyword") or "").lower().strip()
    cutout = (scene.get("cutout_url") or "").lower().strip()
    
    if v_type in ["newspaper_clip", "collage"] or cutout == "newspaper" or kw == "newspaper":
        return 3.5 * max(1, sources_count)
    elif v_type == "data":
        return 10.0
    elif v_type == "timeline":
        return 6.0
    elif v_type in ["video", "split_video"]:
        return 4.0
    elif v_type == "map":
        return 4.0
    else:
        return 3.0


def slice_audio(input_file: Path, start: float, end: float, output_file: Path) -> bool:
    import subprocess
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start:.3f}",
        "-to", f"{end:.3f}",
        "-i", str(input_file),
        "-b:a", "192k",
        str(output_file)
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, check=True)
        return True
    except Exception as e:
        logger.error(f"FFmpeg slice audio failed: {e}")
        return False


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
        import uuid
        generation_id = str(uuid.uuid4())[:8]

        result = await generate_video_scenes(
            title=req.title,
            summary=req.summary,
            category=req.category,
            duration=req.duration,
        )
        result["news_id"] = req.news_id
        if req.thumbnail_url:
            result["thumbnail_url"] = req.thumbnail_url

        # ── Obter as fontes reais da notícia do banco de dados ──
        from db.database import SessionLocal
        from models.news import NewsItem
        db_sources = []
        with SessionLocal() as db:
            news_item = db.query(NewsItem).filter(NewsItem.id == req.news_id).first()
            if news_item:
                db_sources = news_item.sources or []

        # Normalizar fontes
        clean_sources = []
        for s in db_sources:
            if isinstance(s, dict):
                clean_sources.append(s)
            elif isinstance(s, str):
                clean_sources.append({"source": s, "title": "", "url": ""})
        sources_count = len(clean_sources)
        result["sources"] = clean_sources

        from ai.media_fetcher import fetch_article_photos, fetch_youtube_broll, fetch_youtube_thumbnail
        from ai.voice_and_sound import generate_narration, get_epidemic_soundtrack

        scenes = result.get("scenes", [])

        # ── Enriquecer cenas com fotos da matéria para cutouts ──
        article_photos = await fetch_article_photos(
            article_url=req.article_url,
            thumbnail_url=req.thumbnail_url,
        )

        # ── Resolver mídia por cena (paralelizado com asyncio.gather) ──
        async def resolve_single_scene(scene, idx_for_photo, scene_idx):
            v_type = scene.get("visual_type", "context")
            if not scene.get("decorator_type"):
                scene["decorator_type"] = "none"

            # Resolver logo_url a partir do brand_domain
            brand_domain = scene.get("brand_domain")
            if brand_domain:
                scene["logo_url"] = f"https://logo.clearbit.com/{brand_domain}"

            # Interceptar termos de gráficos/tabelas/dados estáticos para abolir gráficos feios
            kw = (scene.get("media_keyword") or "").lower().strip()
            headline_text = (scene.get("headline") or "").lower().strip()
            subtext_text = (scene.get("subtext") or "").lower().strip()
            
            chart_terms = ["chart", "grafico", "gráfico", "graph", "dashboard", "diagram", "tabela", "table", "stats"]
            is_chart = any(term in kw or term in headline_text or term in subtext_text for term in chart_terms)
            
            if v_type in ["cutout", "illustration"] and is_chart:
                text_to_search = f"{scene.get('headline', '')} {scene.get('subtext', '')}"
                has_numbers = bool(re.search(r'\d', text_to_search))
                if has_numbers:
                    logger.info(f"Interceptado gráfico estático. Convertendo para 'data' (nativo do Remotion). Keyword: {kw}")
                    v_type = "data"
                    scene["visual_type"] = "data"
                else:
                    logger.info(f"Interceptado gráfico estático sem números. Convertendo para 'video' loop. Keyword: {kw}")
                    v_type = "video"
                    scene["visual_type"] = "video"
                    scene["youtube_search"] = "financial market chart analysis motion background loop"

            # 1. Resolver vídeo de fundo (background_video_url)
            yt_query = scene.get("youtube_search") or scene.get("media_search_query") or req.title
            bg_video = await fetch_youtube_broll(yt_query, req.category, salt=generation_id, scene_index=scene_idx)
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
                        generated = await generate_cutout_image(target_kw, context, req.category, salt=generation_id)
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
                    generated = await generate_cutout_image(target_kw, context, req.category, salt=generation_id)
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

            # 5. Caso de mapa geográfico real
            elif v_type == "map":
                from ai.image_generator import generate_cutout_image
                target_kw = scene.get("media_keyword") or scene.get("headline") or req.title
                map_kw = f"geographic atlas map showing {target_kw}"
                context = scene.get("subtext") or scene.get("headline") or ""
                generated = await generate_cutout_image(map_kw, context, req.category, salt=generation_id)
                if generated:
                    scene["map_image_url"] = generated

        # Organizar as tasks para rodar em paralelo
        tasks = []
        cutout_count = 0
        for idx, scene in enumerate(scenes):
            if scene.get("visual_type") == "cutout":
                photo_idx = cutout_count
                cutout_count += 1
            else:
                photo_idx = None
            tasks.append(resolve_single_scene(scene, photo_idx, idx))

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
        # E fatiar o áudio global em clipes por cena para esticar o visual de forma independente
        if total_audio_duration > 0:
            # Pass 0: Partition all_captions sequentially based on word counts of each scene's script
            scene_captions = []
            caption_index = 0
            num_captions = len(all_captions)
            for i, s in enumerate(scenes):
                text = s.get("subtext") or s.get("headline", "")
                words_count = len(text.split())
                if i == len(scenes) - 1:
                    slice_words = all_captions[caption_index:]
                else:
                    end_idx = min(caption_index + words_count, num_captions)
                    slice_words = all_captions[caption_index:end_idx]
                    caption_index = end_idx
                scene_captions.append(slice_words)

            # Para cada cena, calcular start, end e fatiar o áudio
            for i, s in enumerate(scenes):
                slice_words = scene_captions[i]
                if slice_words:
                    spoken_start = slice_words[0]["start"]
                    spoken_end = slice_words[-1]["end"]
                else:
                    # fallback se não houver palavras mapeadas
                    words_before = sum(len((prev.get("subtext") or prev.get("headline", "")).split()) for prev in scenes[:i])
                    words_count = len((s.get("subtext") or s.get("headline", "")).split())
                    spoken_start = (words_before / total_words) * total_audio_duration
                    spoken_end = ((words_before + words_count) / total_words) * total_audio_duration

                spoken_dur = spoken_end - spoken_start
                min_dur = get_min_duration_for_scene(s, sources_count)
                
                # Fórmula de duração: max(duração_áudio + 0.5s, duração_mínima_por_tipo)
                duration = max(spoken_dur + 0.5, min_dur)
                s["duration_seconds"] = round(duration, 1)

                # Fatiar o áudio com ffmpeg
                scene_filename = f"scene_{generation_id}_{i}.mp3"
                scene_audio_path = _PROJECT_ROOT / "output" / scene_filename
                
                # Adicionar margem de segurança no final para não cortar ElevenLabs de repente
                slice_end = min(total_audio_duration, spoken_end + 0.15)
                
                success = slice_audio(local_audio_path, spoken_start, slice_end, scene_audio_path)
                if success:
                    s["audio_url"] = f"{_get_localhost()}/output/{scene_filename}"
                else:
                    s["audio_url"] = None

                # Mapear captions_words relativas ao início desta cena
                s["caption_words"] = []
                for w in slice_words:
                    rel_start = round(max(0.0, w["start"] - spoken_start), 3)
                    rel_end = round(max(0.0, w["end"] - spoken_start), 3)
                    s["caption_words"].append({
                        "word": w["word"],
                        "start": rel_start,
                        "end": rel_end
                    })

            # Anular a narração global no retorno para o player usar apenas a local por cena
            result["narration_url"] = None
        else:
            # Fallback when there is no audio duration
            for s in scenes:
                v_type = s.get("visual_type", "context")
                text = s.get("subtext") or s.get("headline", "")
                words = len(text.split())
                if v_type == "hook":
                    spoken_dur = max(2.2, words * 0.45 + 0.4)
                else:
                    spoken_dur = max(2.0, words * 0.45 + 0.5)
                
                min_dur = get_min_duration_for_scene(s, sources_count)
                s["duration_seconds"] = round(max(spoken_dur + 0.5, min_dur), 1)
                s["caption_words"] = []

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
