import asyncio
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

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
    pasted_script: str | None = None


class RenderVideoRequest(BaseModel):
    composition_props: dict
    news_title: str
    total_frames: int
    output_path: str | None = None  # Optional: if set by frontend (Save Dialog), use it


@router.post("/render-video")
async def render_video_endpoint(req: RenderVideoRequest):
    """Render a Reels MP4 via the Remotion CLI."""
    if req.output_path:
        output_path = req.output_path
    else:
        safe = re.sub(r"[^\w\s]", "", req.news_title).strip()
        safe = re.sub(r"\s+", "_", safe)[:40]
        output_path = str(_PROJECT_ROOT / "output" / f"Reels_{safe}.mp4")
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
        "--crf=16",              # Near-lossless quality (lower = better, 0-51)
        "--videoBitrate=12M",    # Target 12 Mbps — broadcast-quality for 1080x1920
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


def clean_script_text(val: str) -> str:
    val = val.strip()
    return re.sub(r'^["\'\\“‘”’]+|["\'\\“‘”’]+$', '', val).strip()


def parse_custom_script(text: str, category: str) -> dict[str, Any]:
    text = text.strip()

    # ── Strip footer section (hashtags, images, music style) before any parsing ──
    # This prevents footer lines from leaking into the last scene's subtext.
    # Strategy: find the LAST separator block (═══ / ---) that is followed by emoji/keyword sections,
    # or find the first emoji-section header (📋 / 🖼 / 🎵 / HASHTAGS) that comes AFTER a timestamp.
    timestamp_pat = re.compile(r'\[\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\]')
    last_ts = list(timestamp_pat.finditer(text))
    footer_search_start = last_ts[-1].end() if last_ts else 0

    footer_match = re.search(
        r'\n[ \t]*[═─━=\-]{5,}|'          # separator line (any ═/─/= style)
        r'\n[ \t]*📋|'                      # hashtags block
        r'\n[ \t]*🖼|'                      # images block
        r'\n[ \t]*🎵|'                      # music block
        r'\n[ \t]*HASHTAGS[ \t]*:|'         # text fallback
        r'\n[ \t]*ACERVO[ \t]|'
        r'\n[ \t]*ESTILO DE TRILHA',
        text[footer_search_start:],
        re.IGNORECASE,
    )
    if footer_match:
        text = text[:footer_search_start + footer_match.start()].rstrip()

    # If it is JSON, parse directly
    if text.startswith("{") or (text.startswith("```") and "{" in text):
        try:
            clean_text = text.strip()
            if "```" in clean_text:
                match = re.search(r"```(?:json)?\s*([\s\S]+?)```", clean_text)
                if match:
                    clean_text = match.group(1).strip()
            return json.loads(clean_text)
        except Exception as e:
            logger.warning(f"Failed to parse pasted script as JSON: {e}")
            
    # Regular parsing of timestamp-based text format
    pattern = r'\[(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\]'
    matches = list(re.finditer(pattern, text))
    
    scenes = []
    
    for i, match in enumerate(matches):
        start_min, start_sec, end_min, end_sec = map(int, match.groups())
        start_time = start_min * 60 + start_sec
        end_time = end_min * 60 + end_sec
        duration = float(end_time - start_time)
        if duration <= 0:
            duration = 5.0
            
        start_idx = match.end()
        end_idx_raw = matches[i+1].start() if i + 1 < len(matches) else len(text)
        # Stop at separator line or metadata section (hashtags, images, music)
        stop_match = re.search(
            r'[═=]{3,}|^[📋🖼️🎵]\s|^##|^---',
            text[start_idx:end_idx_raw],
            re.MULTILINE
        )
        end_idx = start_idx + stop_match.start() if stop_match else end_idx_raw
        scene_body = text[start_idx:end_idx].strip()
        
        visual_type = "video"
        decorator_type = "none"
        headline = ""
        subtext = ""
        youtube_search = ""
        media_keyword = ""
        person_name = None
        brand_domain = None
        timeline_points = None
        tag_badge = None
        secondary_assets: list[str] = []

        for line in scene_body.split("\n"):
            line = line.strip()
            if not line:
                continue

            lower_line = line.lower()
            if "tipo visual:" in lower_line or "visual_type:" in lower_line or "visual type:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_types = ["hook", "video", "cutout", "illustration", "data", "map", "timeline", "collage", "split_video", "newspaper_clip"]
                for vt in valid_types:
                    if vt in val:
                        visual_type = vt
                        break
            elif "decorador:" in lower_line or "decorator_type:" in lower_line or "decorator:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_decorators = ["arrow", "circle", "stripes", "star", "none"]
                for dec in valid_decorators:
                    if dec in val:
                        decorator_type = dec
                        break
            elif "texto na tela:" in lower_line or "headline:" in lower_line or "texto:" in lower_line:
                headline = clean_script_text(line.split(":", 1)[1])
            elif "narração" in lower_line or "narracao" in lower_line or "subtext:" in lower_line or "voz:" in lower_line:
                subtext = clean_script_text(line.split(":", 1)[1])
            elif "youtube search:" in lower_line or "youtube:" in lower_line or "busca:" in lower_line:
                youtube_search = clean_script_text(line.split(":", 1)[1])
            elif "brand domain:" in lower_line or "brand:" in lower_line or "marca:" in lower_line:
                brand_domain = clean_script_text(line.split(":", 1)[1])
            elif "personagem:" in lower_line or "person_name:" in lower_line or "figura:" in lower_line or "character:" in lower_line:
                person_name = clean_script_text(line.split(":", 1)[1])
            elif "tag_badge:" in lower_line or "tag badge:" in lower_line or "etiqueta:" in lower_line:
                raw_badge = clean_script_text(line.split(":", 1)[1])
                if raw_badge.lower() not in ("null", "none", ""):
                    tag_badge = raw_badge.upper()
            elif "keyword:" in lower_line or "media_keyword:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_keywords = ["money", "growth", "crypto", "chart", "bitcoin", "briefcase", "newspaper"]
                for kw in valid_keywords:
                    if kw in val:
                        media_keyword = kw
                        break
                
        if visual_type == "timeline" or "timeline" in scene_body.lower():
            points = []
            for line in scene_body.split("\n"):
                line = line.strip()
                match_pt = re.match(r'^(?:[-•*\s]+)?([^:]+?)\s*:\s*["\']?([^"\']+)["\']?$', line)
                if match_pt:
                    label, val_pt = match_pt.groups()
                    if label.lower() in ["tipo visual", "decorador", "texto na tela", "narração", "narraca", "narraçao", "áudio/sfx", "sfx", "audio/sfx", "brand domain"]:
                        continue
                    points.append({"label": clean_script_text(label), "value": clean_script_text(val_pt)})
            if len(points) == 3:
                timeline_points = points
            elif len(points) > 0:
                while len(points) < 3:
                    points.append({"label": "PROJEÇÃO", "value": "Dados futuros"})
                timeline_points = points[:3]
                
        if not headline and subtext:
            headline = subtext[:30].upper()
        if not subtext and headline:
            subtext = headline
            
        scenes.append({
            "id": f"scene_{i+1}",
            "headline": headline,
            "subtext": subtext,
            "duration_seconds": duration,
            "visual_type": visual_type,
            "decorator_type": decorator_type,
            "youtube_search": youtube_search or None,
            "media_keyword": media_keyword or None,
            "person_name": person_name,
            "brand_domain": brand_domain,
            "timeline_points": timeline_points,
            "tag_badge": tag_badge,
            "secondary_assets": secondary_assets,
        })
        
    return {"scenes": scenes}


@router.post("/generate-video-scenes")
async def generate_scenes_endpoint(req: VideoSceneRequest):
    try:
        import uuid
        generation_id = str(uuid.uuid4())[:8]

        if req.pasted_script:
            logger.info("Parsing custom script from pasted script...")
            result = parse_custom_script(req.pasted_script, req.category)
        else:
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

        from ai.media_fetcher import fetch_article_photos, fetch_youtube_broll, fetch_youtube_thumbnail, fetch_person_photo
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
            yt_query = scene.get("youtube_search")
            if not yt_query:
                person = scene.get("person_name")
                if person:
                    yt_query = f"{person} interview news B-roll footage"
                else:
                    yt_query = scene.get("media_search_query") or req.title
            bg_video = await fetch_youtube_broll(yt_query, req.category, salt=generation_id, scene_index=scene_idx)
            scene["background_video_url"] = bg_video
            scene["media_url"] = bg_video

            # 2. Resolver cutouts
            if v_type == "cutout":
                kw = (scene.get("media_keyword") or "").lower().strip()
                if kw == "newspaper":
                    scene["cutout_url"] = "newspaper"
                else:
                    person_name_raw = scene.get("person_name") or ""
                    static_asset = _resolve_static_asset(kw)

                    # ── Prioridade 1: Foto real da pessoa via Wikipedia / DuckDuckGo ──
                    person_photo = None
                    if person_name_raw.strip() and person_name_raw.lower() not in ("null", "none", ""):
                        person_photo = await fetch_person_photo(person_name_raw.strip())

                    if person_photo:
                        scene["cutout_url"] = person_photo
                        scene["person_photo_fetched"] = True
                        logger.info(f"Foto da pessoa '{person_name_raw}' usada como cutout.")
                    elif static_asset:
                        scene["cutout_url"] = static_asset
                    elif idx_for_photo is not None and idx_for_photo < len(article_photos):
                        scene["cutout_url"] = article_photos[idx_for_photo]
                    else:
                        # Tentar gerar imagem por IA usando person_name se disponível, ou media_keyword / headline
                        from ai.image_generator import generate_cutout_image
                        target_kw = person_name_raw or scene.get("media_keyword") or scene.get("headline") or ""
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
                                fallbacks = [
                                    f"{_get_localhost()}/output/assets/cutout_money.png",
                                    f"{_get_localhost()}/output/assets/cutout_nigro.png",
                                    f"{_get_localhost()}/output/assets/cutout_perini.png"
                                ]
                                scene["cutout_url"] = fallbacks[scene_idx % len(fallbacks)]

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

            # 6. Resolver secondary_assets (elementos decorativos flutuantes)
            secondary_kws = scene.get("secondary_assets") or []
            if v_type in ("cutout", "illustration") and secondary_kws:
                secondary_urls: list[str] = []
                for sec_kw in secondary_kws[:3]:  # máximo 3 decorativos
                    if not sec_kw or not sec_kw.strip():
                        continue
                    try:
                        sec_thumb = await fetch_youtube_thumbnail(sec_kw.strip())
                        if sec_thumb:
                            secondary_urls.append(sec_thumb)
                    except Exception as e:
                        logger.debug(f"Falha ao buscar secondary asset '{sec_kw}': {e}")
                if secondary_urls:
                    scene["secondary_asset_urls"] = secondary_urls

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

        # 2. Distribuir a duração exata por cena baseada em alinhamento de palavras
        if total_audio_duration > 0:
            def clean_word(w: str) -> str:
                return re.sub(r'[^\w\s]', '', w.lower().strip())

            def word_similarity(w1: str, w2: str) -> float:
                w1_c = clean_word(w1)
                w2_c = clean_word(w2)
                if not w1_c or not w2_c:
                    return 0.0
                if w1_c == w2_c:
                    return 1.0
                if len(w1_c) >= 3 and len(w2_c) >= 3:
                    if w1_c in w2_c or w2_c in w1_c:
                        return 0.8
                num_map = {
                    "10": ["dez"],
                    "20": ["vinte"],
                    "2007": ["dois", "mil", "sete", "duas", "mil"],
                    "eua": ["estados", "unidos"],
                    "usd": ["dólares", "dolar", "dolares"],
                    "bilhões": ["bilhoes", "bilhão", "bilhao"],
                    "milhões": ["milhoes", "milhão", "milhao"],
                }
                if w1_c in num_map:
                    for val in num_map[w1_c]:
                        if val in w2_c or w2_c in val:
                            return 0.7
                if w2_c in num_map:
                    for val in num_map[w2_c]:
                        if val in w1_c or w1_c in val:
                            return 0.7
                return 0.0

            aligned = []
            current_index = 0
            num_captions = len(all_captions)
            
            for i, s in enumerate(scenes):
                if i == len(scenes) - 1:
                    aligned.append(all_captions[current_index:])
                    break
                    
                next_text = scenes[i+1].get("subtext") or scenes[i+1].get("headline", "") or ""
                next_words = [w for w in next_text.split() if clean_word(w)]
                next_compare = next_words[:4]
                
                curr_text = s.get("subtext") or s.get("headline", "") or ""
                curr_words = [w for w in curr_text.split() if clean_word(w)]
                curr_compare = curr_words[-4:]
                
                curr_words_count = len(curr_words)
                
                search_start = max(current_index + 2, current_index + curr_words_count - 10)
                search_end = min(num_captions - 1, current_index + curr_words_count + 15)
                
                best_match_idx = -1
                best_match_score = -1.0
                
                for j in range(search_start, search_end):
                    next_score = 0.0
                    for k, w_next in enumerate(next_compare):
                        if j + k < num_captions:
                            cap_w = all_captions[j + k]["word"]
                            sim = word_similarity(w_next, cap_w)
                            weight = 1.2 if k == 0 else (1.0 if k == 1 else 0.8)
                            next_score += sim * weight
                    
                    curr_score = 0.0
                    for k, w_curr in enumerate(reversed(curr_compare)):
                        cap_idx = j - 1 - k
                        if cap_idx >= current_index:
                            cap_w = all_captions[cap_idx]["word"]
                            sim = word_similarity(w_curr, cap_w)
                            weight = 1.2 if k == 0 else (1.0 if k == 1 else 0.8)
                            curr_score += sim * weight
                    
                    total_score = next_score + curr_score
                    if total_score > best_match_score:
                        best_match_score = total_score
                        best_match_idx = j
                        
                if best_match_score < 1.0:
                    best_match_idx = min(num_captions, current_index + curr_words_count)
                    
                aligned.append(all_captions[current_index:best_match_idx])
                current_index = best_match_idx

            # Calculate transition midpoints T_i
            T = [0.0] * (len(scenes) + 1)
            T[0] = 0.0
            for i in range(1, len(scenes)):
                prev_caps = aligned[i - 1]
                curr_caps = aligned[i]
                if prev_caps and curr_caps:
                    T[i] = (prev_caps[-1]["end"] + curr_caps[0]["start"]) / 2.0
                elif prev_caps:
                    T[i] = prev_caps[-1]["end"] + 0.2
                else:
                    T[i] = T[i - 1] + 5.0
                    
            T[len(scenes)] = total_audio_duration
            
            # Ensure strictly increasing
            for i in range(1, len(scenes) + 1):
                if T[i] <= T[i - 1]:
                    T[i] = T[i - 1] + 1.0

            # Map durations and relative word timestamps
            for i, s in enumerate(scenes):
                start_time = T[i]
                end_time = T[i + 1]
                s["duration_seconds"] = round(end_time - start_time, 2)
                s["audio_url"] = None  # Play global narration continuously
                
                slice_words = aligned[i]
                s["caption_words"] = []
                for w in slice_words:
                    rel_start = round(max(0.0, w["start"] - start_time), 3)
                    rel_end = round(max(0.0, w["end"] - start_time), 3)
                    s["caption_words"].append({
                        "word": w["word"],
                        "start": rel_start,
                        "end": rel_end
                    })
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
