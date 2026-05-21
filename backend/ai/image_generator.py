"""
image_generator.py — Geração de imagens editoriais via AI
Cascade: DALL-E 3 → Replicate (Flux Schnell) → Stability AI → skip
"""

import hashlib
import logging
import os
import time
from pathlib import Path
from typing import Optional
import httpx
import asyncio

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR   = PROJECT_ROOT / "output"
MEDIA_DIR    = PROJECT_ROOT / "output" / "media"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

DALLE_API_KEY     = os.getenv("OPENAI_API_KEY", "")
REPLICATE_API_KEY = os.getenv("REPLICATE_API_KEY", "")
STABILITY_API_KEY = os.getenv("STABILITY_API_KEY", "")
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")

# Detectar se o keyword é uma figura pública (vs conceito genérico)
GENERIC_KEYWORDS = {
    "money", "growth", "chart", "crypto", "bitcoin", "briefcase",
    "newspaper", "bar chart", "line chart", "pie chart", "dollar", "reais"
}

def is_public_figure(keyword: str) -> bool:
    """Retorna True se parece ser o nome de uma pessoa ou organização real."""
    kw = keyword.lower().strip()
    if not kw:
        return False
    if "logo" in kw:
        return False
    return not any(generic in kw for generic in GENERIC_KEYWORDS)

def _get_localhost_base() -> str:
    port = os.getenv("PORT", "8765")
    return f"http://localhost:{port}"

async def remove_background(image_path: Path) -> Path:
    """Remove fundo branco/genérico para criar cutout editorial transparente."""
    try:
        from rembg import remove
        
        def _process():
            with open(image_path, "rb") as f:
                input_data = f.read()
            output_data = remove(input_data)
            
            # Salvar como PNG para preservar a transparência
            out_path = image_path.with_suffix(".png")
            out_path.write_bytes(output_data)
            logger.info(f"Fundo removido com sucesso: {out_path.name}")
            return out_path

        return await asyncio.to_thread(_process)
    except ImportError:
        logger.warning("rembg não instalado — imagem usada sem remoção de fundo")
        return image_path
    except Exception as e:
        logger.error(f"Erro ao remover o fundo da imagem {image_path}: {e}")
        return image_path

async def generate_cutout_image(
    keyword: str,
    context: str = "",
    category: str = "general",
    salt: Optional[str] = None
) -> Optional[str]:
    """
    Gera imagem editorial para uso como cutout.
    - Se for figura pública: retrato editorial com fundo branco (para rembg depois)
    - Se for conceito: ilustração editorial abstrata
    Retorna URL localhost ou None.
    """
    if not keyword:
        return None

    is_person = is_public_figure(keyword)
    salt_str = f"_{salt}" if salt else ""
    qhash = hashlib.md5(f"gen_{keyword}_{category}{salt_str}".encode()).hexdigest()[:12]
    
    # Se já existir uma imagem transparente gerada, retornar ela
    existing_png = MEDIA_DIR / f"generated_{qhash}.png"
    if existing_png.exists():
        logger.info(f"Imagem gerada já em cache: {existing_png.name}")
        return f"{_get_localhost_base()}/output/media/{existing_png.name}"
        
    dest_img = MEDIA_DIR / f"generated_{qhash}.jpg"
    
    is_logo = "logo" in keyword.lower().strip()
    
    if is_logo:
        prompt = (
            f"Flat vector icon of {keyword}, minimalist logo design, clean solid white background, "
            f"high contrast, corporate branding logo, professional style, no text"
        )
        negative_prompt = "photorealistic, realistic portrait, face, photograph, 3d, gradient, text, watermark, signature, frame, background scene"
    elif is_person:
        prompt = (
            f"Editorial portrait photograph of {keyword}, "
            f"professional headshot style, clean white background, "
            f"high resolution, journalistic quality, no text, no watermarks, realistic lighting"
        )
        negative_prompt = "cartoon, illustration, text, watermark, busy background, logo, frame, borders"
    else:
        prompt = (
            f"Editorial infographic illustration of {keyword}. "
            f"Clean modern style, minimalist, flat vector design, white background, no text, "
            f"category {category}. Context: {context[:60]}"
        )
        negative_prompt = "photorealistic, faces, text, watermark, signature, frame"

    # --- CASCADE DE PROVEDORES ---
    image_bytes = None

    # 1. NanoBanana (Google Imagen 3 via google-genai)
    if GEMINI_API_KEY:
        try:
            logger.info(f"Tentando gerar imagem via NanoBanana (Google Imagen 3) para: '{keyword}'...")
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=GEMINI_API_KEY)
            def _gen_imagen():
                return client.models.generate_images(
                    model='imagen-3.0-generate-002',
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        aspect_ratio="1:1"
                    )
                )
            response = await asyncio.to_thread(_gen_imagen)
            if response and response.generated_images:
                image_bytes = response.generated_images[0].image.image_bytes
                logger.info("NanoBanana (Google Imagen 3): Imagem obtida com sucesso.")
        except Exception as e:
            logger.warning(f"NanoBanana (Google Imagen 3) falhou: {e}. Passando para o próximo da cascata.")

    # 2. DALL-E 3
    if not image_bytes and DALLE_API_KEY:
        try:
            logger.info(f"Tentando gerar imagem via DALL-E 3 para: '{keyword}'...")
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=DALLE_API_KEY)
            response = await client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url
            if image_url:
                async with httpx.AsyncClient() as http_client:
                    img_resp = await http_client.get(image_url, timeout=20.0)
                    if img_resp.status_code == 200:
                        image_bytes = img_resp.content
                        logger.info("DALL-E 3: Imagem obtida com sucesso.")
        except Exception as e:
            logger.warning(f"DALL-E 3 falhou: {e}. Passando para o próximo da cascata.")

    # 3. Replicate (Flux Schnell)
    if not image_bytes and REPLICATE_API_KEY:
        try:
            logger.info(f"Tentando gerar imagem via Replicate (black-forest-labs/flux-schnell) para: '{keyword}'...")
            os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_KEY
            import replicate
            
            def _run_replicate():
                return replicate.run(
                    "black-forest-labs/flux-schnell",
                    input={
                        "prompt": prompt,
                        "go_fast": True,
                        "megapixels": "1",
                        "num_outputs": 1,
                        "aspect_ratio": "1:1",
                        "output_format": "jpg",
                        "output_quality": 85,
                        "num_inference_steps": 4
                    }
                )
            
            output = await asyncio.to_thread(_run_replicate)
            if output and len(output) > 0:
                image_url = output[0]
                async with httpx.AsyncClient() as http_client:
                    img_resp = await http_client.get(image_url, timeout=20.0)
                    if img_resp.status_code == 200:
                        image_bytes = img_resp.content
                        logger.info("Replicate Flux Schnell: Imagem obtida com sucesso.")
        except Exception as e:
            logger.warning(f"Replicate Flux Schnell falhou: {e}. Passando para o próximo da cascata.")

    # 4. Stability AI (SDXL Direct API)
    if not image_bytes and STABILITY_API_KEY:
        try:
            logger.info(f"Tentando gerar imagem via Stability AI (SDXL) para: '{keyword}'...")
            url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {STABILITY_API_KEY}"
            }
            body = {
                "text_prompts": [
                    {"text": prompt, "weight": 1.0},
                    {"text": negative_prompt, "weight": -1.0}
                ],
                "cfg_scale": 7,
                "height": 1024,
                "width": 1024,
                "samples": 1,
                "steps": 30,
            }
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.post(url, json=body, headers=headers, timeout=25.0)
                if resp.status_code == 200:
                    import base64
                    data = resp.json()
                    image_base64 = data["artifacts"][0]["base64"]
                    image_bytes = base64.b64decode(image_base64)
                    logger.info("Stability AI SDXL: Imagem obtida com sucesso.")
                else:
                    logger.warning(f"Stability AI erro {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Stability AI falhou: {e}.")

    # Se obtivemos sucesso em algum provedor
    if image_bytes:
        try:
            dest_img.write_bytes(image_bytes)
            
            # Sempre remove o fundo para cutouts, permitindo que navios, logos e objetos virem stickers transparentes
            final_path = await remove_background(dest_img)
            if final_path != dest_img and dest_img.exists():
                dest_img.unlink()
                
            return f"{_get_localhost_base()}/output/media/{final_path.name}"
        except Exception as e:
            logger.error(f"Erro ao salvar imagem gerada: {e}")
            
    logger.warning("Cascata de geração de imagem falhou 100%. Retornando None.")
    return None
