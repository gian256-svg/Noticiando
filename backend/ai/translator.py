"""
translator.py — Tradução de qualquer idioma→PT-BR de títulos e resumos de notícias.
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
GEMINI_MODEL     = "gemini-2.5-flash"

GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL       = "llama-3.3-70b-versatile"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "openrouter/free")
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL", "llama3.1")

_LANG_NAMES = {
    "en": "inglês",
    "fr": "francês",
    "de": "alemão",
    "es": "espanhol",
    "it": "italiano",
    "zh": "chinês",
    "ja": "japonês",
    "ar": "árabe",
    "ko": "coreano",
    "ru": "russo",
}

_PROMPT_TEMPLATE = (
    "Traduza o texto abaixo do {source_lang} para português brasileiro natural e fluente, "
    "mantendo termos técnicos financeiros e geopolíticos (ex: Fed, yield, S&P 500, IPO, OTAN, G7). "
    "Retorne APENAS JSON válido, sem markdown:\n"
    '{{"title": "...", "summary": "..."}}'
)


def _parse(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
        if m:
            text = m.group(1).strip()
    return json.loads(text)


async def translate_article(title: str, summary: str, source_language: str = "en") -> tuple[str, str]:
    """
    Returns (translated_title, translated_summary) in PT-BR.
    Cascade fallback: Gemini (Key 1) -> Gemini (Key 2) -> Groq -> Ollama -> Original
    """
    if not title:
        return title, summary

    lang_name = _LANG_NAMES.get(source_language, source_language)
    prompt = _PROMPT_TEMPLATE.format(source_lang=lang_name)
    user_msg = f'Título: "{title}"\nResumo: "{summary or title}"'

    # 1. Gemini
    for key in (GEMINI_API_KEY, GEMINI_API_KEY_2):
        if not key:
            continue
        try:
            import asyncio
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=key)
            cfg = types.GenerateContentConfig(temperature=0.3, max_output_tokens=512)
            full_prompt = f"{prompt}\n\n{user_msg}"

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
            logger.debug(f"translate_article via Gemini failed (key={key[:8]}…): {e}")

    # 2. Groq Fallback
    if GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=GROQ_API_KEY)
            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=512,
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            result = _parse(response.choices[0].message.content or "")
            t = result.get("title", "").strip() or title
            s = result.get("summary", "").strip() or summary
            return t, s
        except Exception as e:
            logger.debug(f"translate_article via Groq failed: {e}")

    # 2.5 OpenRouter Fallback
    if OPENROUTER_API_KEY:
        try:
            import httpx
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://noticiando.app",
                "X-Title": "Noticiando",
                "Content-Type": "application/json",
            }
            payload = {
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.3,
                "max_tokens": 512,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()
            if data.get("choices"):
                content = data["choices"][0]["message"]["content"]
                if content:
                    result = _parse(content)
                    t = result.get("title", "").strip() or title
                    s = result.get("summary", "").strip() or summary
                    return t, s
        except Exception as e:
            logger.debug(f"translate_article via OpenRouter failed: {e}")

    # 3. Ollama Fallback
    if OLLAMA_BASE_URL:
        try:
            import httpx
            model_to_use = OLLAMA_MODEL
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                    if res.is_success:
                        models = [m["name"] for m in res.json().get("models", [])]
                        if OLLAMA_MODEL in models:
                            model_to_use = OLLAMA_MODEL
                        elif f"{OLLAMA_MODEL}:latest" in models:
                            model_to_use = f"{OLLAMA_MODEL}:latest"
                        else:
                            matched = next((m for m in models if OLLAMA_MODEL in m), None)
                            if matched:
                                model_to_use = matched
                            elif models:
                                chosen = None
                                for pref in ["llama3.2-vision", "qwen2.5-coder", "llava", "llama3.2", "llama3", "llama", "qwen", "mistral", "phi"]:
                                    matched_pref = next((m for m in models if pref in m.lower()), None)
                                    if matched_pref:
                                        chosen = matched_pref
                                        break
                                model_to_use = chosen or models[0]
                                logger.info(f"Ollama model '{OLLAMA_MODEL}' not found for translation. Using installed model '{model_to_use}'")
            except Exception as e:
                logger.warning(f"Error querying Ollama models for translation: {e}")

            payload = {
                "model": model_to_use,
                "messages": [
                    {"role": "system", "content": prompt},
                    {"role": "user",   "content": user_msg},
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.3, "num_predict": 512},
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
                res.raise_for_status()
                data = res.json()
            content = data.get("message", {}).get("content", "")
            if content:
                result = _parse(content)
                t = result.get("title", "").strip() or title
                s = result.get("summary", "").strip() or summary
                return t, s
        except Exception as e:
            logger.debug(f"translate_article via Ollama failed: {e}")

    # Fallback: originals unchanged
    return title, summary


async def translate_batch(items: list[dict], max_concurrent: int = 5) -> None:
    """
    Translates title+summary in-place for all non-PT items (any language → PT-BR).
    Uses a semaphore to cap concurrent Gemini requests.
    """
    import asyncio

    targets = [item for item in items if item.get("language", "pt") != "pt"]
    if not targets:
        return

    sem = asyncio.Semaphore(max_concurrent)

    async def _translate_one(item: dict) -> None:
        async with sem:
            lang = item.get("language", "en")
            try:
                t, s = await asyncio.wait_for(
                    translate_article(item["title"], item.get("summary", ""), source_language=lang),
                    timeout=7.0
                )
                item["title"] = t
                item["summary"] = s
            except asyncio.TimeoutError:
                logger.warning(f"Translation timed out (7s cap) for: {item['title'][:50]}")
            except Exception as e:
                logger.warning(f"Translation failed for: {item['title'][:50]} - {e}")

    await asyncio.gather(*[_translate_one(item) for item in targets], return_exceptions=True)
    logger.info(f"Translation done — {len(targets)} articles translated to PT-BR")

