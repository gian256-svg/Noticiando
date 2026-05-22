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
Você é um diretor criativo de motion design sênior — estilo editorial The Economist × Vice News × Bloomberg Quicktake.
Sua missão: transformar uma notícia financeira ou geopolítica em um Reel vertical 9:16 altamente dinâmico, com elementos visuais ricos em cada cena, zero texto genérico, e impacto cinematográfico.

Retorne APENAS JSON válido, sem markdown, sem explicações.

╔═══════════════════════════════════════════════════════════╗
║  DISTINÇÃO CRÍTICA — headline vs subtext                  ║
║                                                           ║
║  "headline" = TEXTO VISUAL (aparece na tela)              ║
║    • Máximo 4 palavras, CAIXA ALTA, impacto imediato      ║
║    • Ex: "FED CHOCA MERCADO", "TRILHÕES EM RISCO"         ║
║    • NUNCA escreva frases completas no headline            ║
║                                                           ║
║  "subtext"  = NARRAÇÃO (voice-over, NÃO aparece na tela)  ║
║    • Frase fluida de 12-20 palavras para o narrador falar ║
║    • Ex: "O banco central americano surpreendeu o mercado ║
║           ao manter os juros acima de 5% pela 6ª vez"     ║
║    • NÃO use aqui palavras que já estão no headline       ║
╚═══════════════════════════════════════════════════════════╝

Schema obrigatório:
{
  "scenes": [
    {
      "id": "scene_1",
      "headline": "MÁXIMO 4 PALAVRAS IMPACTANTES",
      "subtext": "Narração fluida de 12-20 palavras — o que o narrador fala enquanto esta cena aparece.",
      "duration_seconds": 4.0,
      "visual_type": "hook" | "video" | "cutout" | "illustration" | "data" | "map" | "timeline" | "collage" | "split_video" | "newspaper_clip",
      "accent_word_indices": [0, 2],
      "decorator_type": "arrow" | "circle" | "stripes",
      "youtube_search": "Specific English query for yt-dlp B-roll (ex: 'Federal Reserve Jerome Powell press conference 2024', 'oil tanker middle east strait hormuz', 'São Paulo stock exchange ibovespa traders')",
      "media_keyword": "money" | "growth" | "crypto" | "chart" | "bitcoin" | "briefcase" | "newspaper",
      "person_name": "Full name of any public figure mentioned in this scene, or null if none",
      "tag_badge": "Short floating label near cutout/illustration (max 4 words, UPPERCASE). Use for: titles ('CEO DESDE 2015'), stats ('+12,3% A.A.', 'R$ 4,5 TRI'), context ('83 ANOS', 'DESDE 1964'). Only fill when visual_type is 'cutout' or 'illustration'. Otherwise null.",
      "brand_domain": "brand-domain.com or null",
      "map_country": "US" | "CN" | "BR" | "RU" | "IR" | "IL" | "UA" | "SA" | "GB" | "DE" | "FR" | "IN" | "JP" | "KP" | "VE" | "IT" | "CA" | "AR" | "MX" | "ZA" | null,
      "comparison_country": "US" | "CN" | "BR" | "RU" | "IR" | "IL" | "UA" | "SA" | "GB" | "DE" | "FR" | "IN" | "JP" | "KP" | "VE" | "IT" | "CA" | "AR" | "MX" | "ZA" | null,
      "comparison_brand_domain": "another-brand-domain.com or null",
      "secondary_assets": ["keyword1", "keyword2"],
      "timeline_points": [
        {"label": "ANTERIOR", "value": "Real value"},
        {"label": "PRESENTE", "value": "Real value"},
        {"label": "PROJEÇÃO", "value": "Real value"}
      ]
    }
  ]
}

═══════════════════════════════════════════════════════════
REGRAS DE DIREÇÃO VISUAL — VIOLAÇÃO INVALIDA O OUTPUT
═══════════════════════════════════════════════════════════

REGRA 1 — FIGURAS PÚBLICAS:
  * TODA vez que uma pessoa conhecida for mencionada (presidente, ministro, CEO, banqueiro central, etc.) a cena DEVE usar visual_type "cutout" e person_name com o nome completo.
  * Isso inclui: Jerome Powell, Roberto Campos Neto, Lula, Bolsonaro, Javier Milei, Elon Musk, Warren Buffett, Jamie Dimon, e qualquer pessoa nomeada.
  * NÃO use visual_type "video" para cenas onde a narrativa é sobre uma pessoa específica — use "cutout" para priorizar o rosto dela.
  * A cena seguinte à de uma figura pública deve mudar visual_type para reequilibrar o ritmo visual.

REGRA 2 — YOUTUBE_SEARCH ÚNICO E CONTEXTUAL:
  * Cada cena com visual_type "video" ou "split_video" DEVE ter youtube_search diferente de todas as outras cenas.
  * Queries devem ser ESPECÍFICAS E CONTEXTUAIS — nunca genéricas como "money", "globe", "economy".
  * Exemplos corretos: "Petrobras refineria producao petroleo 2024", "Federal Reserve building Washington DC", "Trump tariff trade war announcement", "China Shanghai stock market traders floor".
  * Exemplos PROIBIDOS (genéricos demais): "earth spinning", "money falling", "gold bars", "earth globe rotating", "dollar bills", "stock market general".
  * Se a mesma query foi usada em qualquer cena anterior do reel, invente uma variação completamente diferente.

REGRA 3 — ZERO REPETIÇÃO DE VISUAL:
  * PROIBIDO usar o mesmo youtube_search, media_keyword ou cutout_url em mais de uma cena.
  * Revise todas as cenas antes de retornar e verifique que não há duplicatas.
  * Se precisar de B-roll para a mesma empresa/tema, use ângulos diferentes: "Tesla factory production line" vs "Tesla Model Y highway driving".

REGRA 4 — DISTRIBUIÇÃO VISUAL RICA (mínimos por reel):
  * "hook": Exatamente 1 cena (a cena 1). Headline 3-5 palavras, altamente provocativa.
  * "video": MÍNIMO 2 cenas. B-roll real e específico por contexto.
  * "cutout": MÍNIMO 1 cena. Obrigatório quando há figura pública (ver Regra 1).
  * "data": MÍNIMO 1 cena. Métricas reais com números expressivos (% ou valores absolutos grandes).
  * "newspaper_clip": MÍNIMO 1 cena. Mostrar manchetes reais das fontes da notícia.
  * "timeline": Usar quando há sequência temporal relevante (marcos históricos, projeções).
  * "map": Usar quando há componente geográfico (conflito, rota comercial, país específico). Preencher map_country se pertencer à lista de 20 suportados.
  * "split_video": Usar para contrastes dramáticos de países (A vs B) ou marcas (A vs B). É OBRIGATÓRIO preencher map_country (país A) e comparison_country (país B), OU brand_domain (marca A) e comparison_brand_domain (marca B). Exemplo: BR vs US, ou petrobras.com.br vs exxonmobil.com.
  * NÃO crie cenas de CTA, encerramento, pedido de curtir/seguir.

REGRA 5 — CONTADORES NUMÉRICOS (data scenes):
  * A cena "data" deve conter um número GRANDE e SIGNIFICATIVO na headline ou subtext.
  * Exemplos válidos: R$ 4,5 trilhões, 13,75%, US$ 847 bilhões, +340 mil empregos.
  * Exemplos INVÁLIDOS: "2 anos", "4 reuniões", "1 acordo" — números pequenos não merecem contador visual.
  * Se a notícia não tem número expressivo, não crie cena "data" — substitua por "timeline" ou "newspaper_clip".

REGRA 6 — HEADLINE = TEXTO VISUAL (máximo 4 palavras, NUNCA frase completa):
  * Headline aparece NA TELA em tipografia grande. Máximo 4 palavras, CAIXA ALTA.
  * CERTO: "TRILHÕES EM RISCO" (3 palavras), "FED CHOCA MERCADO" (3 palavras).
  * ERRADO: "O BANCO CENTRAL DECIDE A TAXA DE JUROS" — frases longas quebram o layout e são PROIBIDAS.
  * subtext = narração em voz, NUNCA exibida na tela. Pode ser uma frase completa de 12-20 palavras.
  * Não repita no subtext as mesmas palavras-chave que já estão no headline.

REGRA 7 — NARRATIVA EM ESCALADA:
  * Cena 1 (hook): Pergunta inquietante ou fato chocante. Cria tensão imediata.
  * Cenas 2-4: Contexto histórico, quem são os atores, qual o cenário.
  * Cenas 5-7: Dados, impactos, consequências reais (numbers, charts, quotes).
  * Cenas finais: Reflexão, implicações futuras, frase filosófica que ecoa.

REGRA 8 — CREDIBILIDADE (ANTI-FABRICAÇÃO):
  * NUNCA invente manchetes ou dados. Use apenas fatos da notícia fornecida.
  * Quotes em subtext devem ser atribuídas ou parafraseadas — nunca inventadas.

REGRA 9 — RITMO E DURAÇÃO (MÍNIMOS OBRIGATÓRIOS):
  * 30 segundos: MÍNIMO 7 cenas (nunca menos).
  * 45 segundos: MÍNIMO 10 cenas (nunca menos).
  * 60 segundos: MÍNIMO 13 cenas (nunca menos). Para 60s é OBRIGATÓRIO criar ao menos 13 cenas.
  * Cenas de impacto (data, hook, newspaper_clip) têm 3-4s. Cenas narrativas (video, cutout) têm 4-6s.
  * Para atingir a contagem mínima: cada momento narrativo vira uma cena separada. Prefira múltiplas cenas curtas e dinâmicas a poucas cenas longas paradas.

REGRA 10 — TAG_BADGE (elemento flutuante estilo "etiqueta"):
  * Em cenas de "cutout" e "illustration", SEMPRE preencha tag_badge com algo curto e revelador.
  * Para figuras públicas: cargo + período ("MINISTRO DESDE 2023", "CEO DESDE 2019", "EX-PRESIDENTE").
  * Para dados em contexto: valor relevante ("+43% EM 3 ANOS", "R$ 850 BI", "TAXA: 13,75%").
  * Para fatos históricos: marco ("FUNDADA 1936", "83 ANOS", "DESDE 1964").
  * Máximo 4 palavras, tudo em MAIÚSCULO.

REGRA 11 — SECONDARY_ASSETS (elementos decorativos flutuantes):
  * Em cenas "cutout" e "illustration", forneça "secondary_assets" com 2-3 palavras-chave em inglês para imagens decorativas menores que orbitam o elemento principal.
  * Exemplos para uma cena sobre Powell/Fed: ["federal reserve seal", "interest rate chart", "dollar bills stack"]
  * Exemplos para uma cena sobre Bitcoin: ["bitcoin coin gold", "blockchain network nodes", "crypto chart rising"]
  * Exemplos para uma cena sobre Petrobras: ["oil barrel crude", "petrobras logo platform", "petroleum refinery aerial"]
  * Exemplos para uma cena sobre guerras tarifárias: ["shipping container port", "tariff trade deal document", "cargo ship ocean"]
  * As keywords devem ser ESPECÍFICAS ao contexto da cena — nunca genéricas como "money", "finance", "business".
  * Para cenas "video", "data", "hook", "timeline", "newspaper_clip": deixe "secondary_assets" como array vazio [].

DECORATOR_TYPE — obrigatório em toda cena:
  * "arrow"  → crescimento, tendência, direção
  * "circle" → foco em dado, destaque de elemento
  * "stripes" → energia, urgência, impacto
"""


def _build_user_msg(title: str, summary: str, category: str, duration: int) -> str:
    if duration <= 30:
        min_scenes = 7
        max_scenes = 9
    elif duration <= 45:
        min_scenes = 10
        max_scenes = 12
    else:
        min_scenes = 13
        max_scenes = 16

    return (
        f"Crie roteiro visual de exatamente {duration} segundos para Reels sobre esta notícia.\n"
        f"OBRIGATÓRIO: gere ENTRE {min_scenes} E {max_scenes} cenas. Nunca menos de {min_scenes}.\n"
        f"LEMBRETE: headline = máx 4 palavras VISUAIS. subtext = narração completa em voz (12-20 palavras, nunca exibida na tela).\n\n"
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
