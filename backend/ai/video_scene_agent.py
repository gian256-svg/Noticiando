"""
video_scene_agent.py — Gerador de cenas para Reels
Cascade de provedores: Gemini (x2) → Groq → Ollama
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

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_2 = os.getenv("GEMINI_API_KEY_2", "")
GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL", "llama3.1")

GEMINI_MODEL = "gemini-2.5-flash"
GROQ_MODEL   = "llama-3.3-70b-versatile"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")

SYSTEM_PROMPT = """\
Você é um diretor criativo de motion design sênior especializado em Reels virais de finanças e economia (estilo editorial The Economist / Paulo Guedes Reels).
Sua missão: transformar uma notícia de mercado financeiro em um roteiro híbrido vertical 9:16 altamente dinâmico.

Retorne APENAS JSON válido, sem markdown, sem explicações.

Schema obrigatório:
{
  "scenes": [
    {
      "id": "scene_1",
      "headline": "TEXTO CURTO IMPACTANTE EM CAIXA ALTA",
      "subtext": "Texto completo que será narrado nesta cena. Deve ser fluído, informativo e conter dados.",
      "duration_seconds": 3.0,
      "visual_type": "hook" | "video" | "cutout" | "illustration" | "data",
      "accent_word_indices": [0, 2],
      "decorator_type": "star" | "arrow" | "circle" | "stripes",
      "youtube_search": "Termo de busca bem curto para extrair um corte de vídeo do YouTube no yt-dlp (ex: 'bolsa de valores caindo', 'primo rico investimentos', 'empresa fabrica')",
      "media_keyword": "money" | "growth" | "crypto" | "nigro" | "perini" | "chart" | "bitcoin" | "briefcase" | "primo" | "newspaper"
    }
  ]
}

REGRAS OBRIGATÓRIAS DE DIREÇÃO DE ARTE — VIOLÁ-LAS INVALIDA O OUTPUT:

VISUAL_TYPE — distribuição mínima obrigatória por reel:
  * "hook": Sempre a cena 1 (2 a 2,5s). Gancho agressivo, 3-5 palavras na headline.
  * "video": MÍNIMO 2 cenas. B-roll de vídeo ao fundo. OBRIGATÓRIO: preencher "youtube_search" em inglês (4-6 palavras) buscando footages REAIS relevantes (noticiários, pessoas, ações ou situações reais que se encaixem no roteiro e momento exato da narração).
  * "cutout": MÍNIMO 2 cenas. Foto editorial flutuante. OBRIGATÓRIO: preencher "media_keyword".
  * "illustration": MÍNIMO 1 cena. Gráfico animado. OBRIGATÓRIO: preencher "media_keyword".
  * "data": MÍNIMO 1 cena. Métrica, percentual ou número com barra animada.
  * NÃO crie nenhuma cena de CTA (Call to Action), encerramento, agradecimento ou pedido de curtir/seguir no final. O roteiro deve focar 100% no conteúdo da notícia e terminar de forma informativa natural.

NÃO REPETIR MÍDIAS/IMAGENS:
  * É expressamente proibido repetir a mesma media_keyword ou imagens similares em várias cenas (exceto se for extremamente necessário, como uma bandeira nacional ou uma figura pública central da matéria). Garanta que cada cena de cutout ou illustration traga elementos novos para manter o interesse.

TEXTOS CURTOS E GRAMÁTICA DINÂMICA:
  * As headlines e textos em tela devem ser extremamente curtos e dinâmicos para não poluir a tela.
  * Você PODE e DEVE ignorar regras estritas de parágrafos/pontuação nos textos em tela. Prefira palavras soltas de impacto ou frases curtas de 2-4 palavras para reforçar as falas da narração.

DECORATOR_TYPE — OBRIGATÓRIO EM TODA CENA, PROIBIDO "none":
  * "star"   → breaking news, choque, urgência
  * "arrow"  → crescimento, direção, tendência
  * "circle" → análise, contexto, dado circular
  * "stripes" → energia, momentum, impacto visual

MEDIA_KEYWORD — obrigatório em cenas cutout e illustration:
  * "nigro" | "perini" | "money" | "briefcase" | "growth" | "chart" | "crypto" | "bitcoin" | "newspaper"

YOUTUBE_SEARCH — obrigatório em cenas video:
  * Em inglês, 4-6 palavras, buscando trechos reais e precisos de noticiários, mercado financeiro, pessoas ou locais específicos da notícia. Ex: "brazil stock market trading", "federal reserve interest rates", "bitcoin price surge"

- Cada subtext deve ser envolvente e narrável em voz alta. O conjunto dos subtexts forma o roteiro da locução ElevenLabs.
- TODAS as headlines e subtexts DEVEM ser geradas em português brasileiro natural, envolvente e fluente para o público brasileiro, mesmo que o Título ou Resumo originais estejam em inglês. A única exceção é o campo 'youtube_search', que deve ser escrito em inglês para melhor busca no YouTube.
- Máximo 3.5 segundos por cena para garantir dinamismo. Somar aproximadamente a duração pedida."""



def _build_user_msg(title: str, summary: str, category: str, duration: int) -> str:
    if duration <= 30:
        scene_count = "6 a 8"
    elif duration <= 45:
        scene_count = "9 a 11"
    else:
        scene_count = "12 a 14"

    return (
        f"Crie roteiro visual de exatamente {duration} segundos para Reels sobre esta notícia.\n"
        f"Gere entre {scene_count} cenas no total para cobrir esse tempo de forma equilibrada.\n\n"
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


async def _generate_with_gemini(user_msg: str, api_key: str) -> dict[str, Any]:
    import asyncio
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    full_prompt = f"{SYSTEM_PROMPT}\n\n{user_msg}"
    cfg = types.GenerateContentConfig(
        temperature=0.7,
        max_output_tokens=2048,
        response_mime_type="application/json"
    )

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=GEMINI_MODEL,
        contents=full_prompt,
        config=cfg,
    )
    if not response.text:
        raise ValueError("Gemini retornou uma resposta vazia ou nula")
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


async def _generate_with_openrouter(user_msg: str) -> dict[str, Any]:
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
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
    if not data.get("choices"):
        raise ValueError(f"OpenRouter retornou resposta sem choices: {data}")
    content = data["choices"][0]["message"]["content"]
    if not content:
        raise ValueError("OpenRouter retornou resposta vazia")
    return _parse_json(content)


async def _generate_with_ollama(user_msg: str) -> dict[str, Any]:
    import httpx
    model_to_use = OLLAMA_MODEL
    if OLLAMA_BASE_URL:
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
                            logger.info(f"Ollama model '{OLLAMA_MODEL}' not found. Using installed model '{model_to_use}'")
        except Exception as e:
            logger.warning(f"Error querying Ollama models: {e}")

    payload = {
        "model": model_to_use,
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


def _adjust_scene_durations(scenes: list[dict[str, Any]], target_duration: int) -> list[dict[str, Any]]:
    if not scenes:
        return scenes

    total_generated = sum(s.get("duration_seconds", 0.0) for s in scenes)
    if total_generated <= 0:
        avg = target_duration / len(scenes)
        for s in scenes:
            s["duration_seconds"] = round(avg, 1)
        total_generated = sum(s["duration_seconds"] for s in scenes)

    scale = target_duration / total_generated
    for s in scenes:
        curr = s.get("duration_seconds", 0.0)
        s["duration_seconds"] = round(curr * scale, 1)

    current_sum = sum(s["duration_seconds"] for s in scenes)
    diff = round(target_duration - current_sum, 1)
    if diff != 0:
        idx = 0
        max_dur = -1.0
        for i, s in enumerate(scenes):
            if s["duration_seconds"] > max_dur:
                max_dur = s["duration_seconds"]
                idx = i
        scenes[idx]["duration_seconds"] = round(scenes[idx]["duration_seconds"] + diff, 1)

    return scenes


async def generate_video_scenes(
    title: str,
    summary: str,
    category: str,
    duration: int = 45,
    api_key: str = "",  # kept for backward compat only
) -> dict[str, Any]:
    """
    Generate Reels scene data.
    Cascade: Gemini (key 1) → Gemini (key 2) → Groq → OpenRouter → Ollama
    """
    user_msg = _build_user_msg(title, summary, category, duration)
    errors: list[str] = []

    def _validate(result: dict[str, Any], provider: str) -> dict[str, Any]:
        if not result.get("scenes"):
            raise ValueError(f"Resposta sem campo 'scenes' (chaves recebidas: {list(result.keys())})")
        result["scenes"] = _adjust_scene_durations(result["scenes"], duration)
        return result

    # 1. Gemini — primary key
    if GEMINI_API_KEY:
        try:
            logger.info("Generating scenes via Gemini (primary key)…")
            return _validate(await _generate_with_gemini(user_msg, GEMINI_API_KEY), "Gemini-1")
        except Exception as e:
            logger.warning(f"Gemini primary key failed: {e}")
            errors.append(f"Gemini-1: {e}")

    # 2. Gemini — secondary key
    if GEMINI_API_KEY_2:
        try:
            logger.info("Generating scenes via Gemini (secondary key)…")
            return _validate(await _generate_with_gemini(user_msg, GEMINI_API_KEY_2), "Gemini-2")
        except Exception as e:
            logger.warning(f"Gemini secondary key failed: {e}")
            errors.append(f"Gemini-2: {e}")

    # 3. Groq
    if GROQ_API_KEY:
        try:
            logger.info("Generating scenes via Groq…")
            return _validate(await _generate_with_groq(user_msg), "Groq")
        except Exception as e:
            logger.warning(f"Groq failed: {e}")
            errors.append(f"Groq: {e}")

    # 4. OpenRouter
    if OPENROUTER_API_KEY:
        try:
            logger.info(f"Generating scenes via OpenRouter ({OPENROUTER_MODEL})…")
            return _validate(await _generate_with_openrouter(user_msg), "OpenRouter")
        except Exception as e:
            logger.warning(f"OpenRouter failed: {e}")
            errors.append(f"OpenRouter: {e}")

    # 5. Ollama (local) — last resort
    try:
        logger.info(f"Generating scenes via Ollama local ({OLLAMA_MODEL})…")
        return _validate(await _generate_with_ollama(user_msg), "Ollama")
    except Exception as e:
        logger.error(f"Ollama fallback failed: {e}")
        errors.append(f"Ollama: {e}")

    summary_msg = " | ".join(errors) if errors else "Nenhum provedor configurado (configure GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY em backend/.env)"
    raise RuntimeError(f"Todos os provedores falharam: {summary_msg}")
