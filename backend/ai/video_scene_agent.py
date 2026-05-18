"""
video_scene_agent.py — Gerador de cenas para Reels
Cascade de provedores: Claude (Anthropic) → Gemini (x2) → Groq → Ollama
Chaves lidas do backend/.env — NUNCA hardcodar aqui.
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_2  = os.getenv("GEMINI_API_KEY_2", "")
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
OLLAMA_BASE_URL   = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL      = os.getenv("OLLAMA_MODEL", "llama3.1")

CLAUDE_MODEL = "claude-sonnet-4-6"
GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL   = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
Você é um diretor criativo especializado em Reels virais de finanças e economia.
Sua missão: transformar uma notícia em roteiro de cenas para vídeo vertical 9:16.

Retorne APENAS JSON válido, sem markdown, sem explicações.

Schema obrigatório:
{
  "scenes": [
    {
      "id": "scene_1",
      "headline": "TEXTO IMPACTANTE",
      "subtext": "texto de suporte curto",
      "duration_seconds": 3.0,
      "visual_type": "hook",
      "accent_word_indices": [0, 2]
    }
  ]
}

Regras:
- visual_type: "hook" (1ª cena, 2-2.5s) | "context" (3-4s) | "data" (3s) | "cta" (última, 2.5s)
- headline: TUDO MAIÚSCULAS, máx 6 palavras, sem pontuação final
- subtext: caixa normal, máx 12 palavras
- accent_word_indices: índices (base 0) das palavras a destacar em laranja — max 2
- Total de cenas: 8-10 para 45s, proporcional para outras durações
- A soma de duration_seconds deve ser aproximadamente o total solicitado
- Prefira números concretos, percentuais e nomes de empresas nos subtextos"""


def _build_user_msg(title: str, summary: str, category: str, duration: int) -> str:
    return (
        f"Crie roteiro visual de {duration}s para Reels sobre esta notícia:\n\n"
        f"Título: {title}\n"
        f"Categoria: {category}\n"
        f"Resumo: {summary or title}\n\n"
        "Retorne apenas o JSON."
    )


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
        if match:
            text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | raw: {text[:300]}")
        raise ValueError(f"Resposta inválida do modelo: {e}")


async def _generate_with_claude(user_msg: str) -> dict[str, Any]:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = message.content[0].text if message.content else ""
    if not text:
        raise ValueError("Claude retornou resposta vazia")
    return _parse_json(text)


async def _generate_with_gemini(user_msg: str, api_key: str) -> dict[str, Any]:
    import asyncio
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    full_prompt = f"{SYSTEM_PROMPT}\n\n{user_msg}"
    cfg = types.GenerateContentConfig(temperature=0.7, max_output_tokens=2048)

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=GEMINI_MODEL,
        contents=full_prompt,
        config=cfg,
    )
    return _parse_json(response.text)


async def _generate_with_groq(user_msg: str) -> dict[str, Any]:
    from groq import AsyncGroq
    client = AsyncGroq(api_key=GROQ_API_KEY)
    response = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=2048,
        temperature=0.7,
    )
    return _parse_json(response.choices[0].message.content or "")


async def _generate_with_ollama(user_msg: str) -> dict[str, Any]:
    import httpx
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 2048},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        res.raise_for_status()
        data = res.json()
    content = data.get("message", {}).get("content", "")
    if not content:
        raise ValueError("Ollama retornou resposta vazia")
    return _parse_json(content)


async def generate_video_scenes(
    title: str,
    summary: str,
    category: str,
    duration: int = 45,
    api_key: str = "",  # kept for backward compat only
) -> dict[str, Any]:
    """
    Generate Reels scene data.
    Cascade: Claude → Gemini (key 1) → Gemini (key 2) → Groq → Ollama
    """
    user_msg = _build_user_msg(title, summary, category, duration)
    errors: list[str] = []

    # 1. Claude (Anthropic) — primary, most reliable
    if ANTHROPIC_API_KEY:
        try:
            logger.info("Generating scenes via Claude (Anthropic)…")
            return await _generate_with_claude(user_msg)
        except Exception as e:
            logger.warning(f"Claude failed: {e}")
            errors.append(f"Claude: {e}")

    # 2. Gemini — primary key
    if GEMINI_API_KEY:
        try:
            logger.info("Generating scenes via Gemini (primary key)…")
            return await _generate_with_gemini(user_msg, GEMINI_API_KEY)
        except Exception as e:
            logger.warning(f"Gemini primary key failed: {e}")
            errors.append(f"Gemini-1: {e}")

    # 3. Gemini — secondary key
    if GEMINI_API_KEY_2:
        try:
            logger.info("Generating scenes via Gemini (secondary key)…")
            return await _generate_with_gemini(user_msg, GEMINI_API_KEY_2)
        except Exception as e:
            logger.warning(f"Gemini secondary key failed: {e}")
            errors.append(f"Gemini-2: {e}")

    # 4. Groq
    if GROQ_API_KEY:
        try:
            logger.info("Generating scenes via Groq…")
            return await _generate_with_groq(user_msg)
        except Exception as e:
            logger.warning(f"Groq failed: {e}")
            errors.append(f"Groq: {e}")

    # 5. Ollama (local) — last resort
    try:
        logger.info(f"Generating scenes via Ollama local ({OLLAMA_MODEL})…")
        return await _generate_with_ollama(user_msg)
    except Exception as e:
        logger.error(f"Ollama fallback failed: {e}")
        errors.append(f"Ollama: {e}")

    summary_msg = " | ".join(errors) if errors else "Nenhum provedor configurado"
    raise RuntimeError(
        f"Todos os provedores falharam: {summary_msg}. "
        "Configure ANTHROPIC_API_KEY em backend/.env"
    )
