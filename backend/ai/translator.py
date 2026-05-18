"""
translator.py — Tradução EN→PT-BR de títulos e resumos de notícias.
Usa Gemini Flash (chave já configurada no .env) por ser rápido e barato.
Fallback silencioso: em caso de falha, retorna o texto original.
"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_2 = os.getenv("GEMINI_API_KEY_2", "")
GEMINI_MODEL     = "gemini-2.0-flash"

_PROMPT = (
    "Traduza para português brasileiro natural e fluente, "
    "mantendo termos técnicos financeiros (ex: Fed, yield, S&P 500, IPO). "
    "Retorne APENAS JSON válido, sem markdown:\n"
    '{"title": "...", "summary": "..."}'
)


def _parse(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
        if m:
            text = m.group(1).strip()
    return json.loads(text)


async def translate_article(title: str, summary: str) -> tuple[str, str]:
    """
    Returns (translated_title, translated_summary).
    On any failure returns the originals unchanged.
    """
    if not title:
        return title, summary

    user_msg = f'Título: "{title}"\nResumo: "{summary or title}"'

    for key in (GEMINI_API_KEY, GEMINI_API_KEY_2):
        if not key:
            continue
        try:
            import asyncio
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=key)
            cfg = types.GenerateContentConfig(temperature=0.3, max_output_tokens=512)
            full_prompt = f"{_PROMPT}\n\n{user_msg}"

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=GEMINI_MODEL,
                contents=full_prompt,
                config=cfg,
            )
            result = _parse(response.text)
            t = result.get("title", "").strip() or title
            s = result.get("summary", "").strip() or summary
            return t, s
        except Exception as e:
            logger.debug(f"translate_article failed (key={key[:8]}…): {e}")

    # Fallback: originals unchanged
    return title, summary


async def translate_batch(items: list[dict], max_concurrent: int = 5) -> None:
    """
    Translates title+summary in-place for all items with language == "en".
    Uses a semaphore to cap concurrent Gemini requests.
    """
    import asyncio

    targets = [item for item in items if item.get("language") == "en"]
    if not targets:
        return

    sem = asyncio.Semaphore(max_concurrent)

    async def _translate_one(item: dict) -> None:
        async with sem:
            t, s = await translate_article(item["title"], item.get("summary", ""))
            item["title"] = t
            item["summary"] = s

    await asyncio.gather(*[_translate_one(item) for item in targets], return_exceptions=True)
    logger.info(f"Translation done — {len(targets)} EN articles translated to PT-BR")
