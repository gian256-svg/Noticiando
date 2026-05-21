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
      "duration_seconds": 2.5,
      "visual_type": "hook" | "video" | "cutout" | "illustration" | "data" | "map" | "timeline" | "collage" | "split_video" | "newspaper_clip",
      "accent_word_indices": [0, 2],
      "decorator_type": "arrow" | "circle" | "stripes",
      "youtube_search": "Termo de busca bem curto para extrair um corte de vídeo do YouTube no yt-dlp (ex: 'bolsa de valores caindo', 'investimentos grafico', 'empresa fabrica')",
      "media_keyword": "money" | "growth" | "crypto" | "chart" | "bitcoin" | "briefcase" | "newspaper",
      "person_name": "Nome da figura pública a ser gerada ou null"
    }
  ]
}

REGRAS OBRIGATÓRIAS DE DIREÇÃO DE ARTE — VIOLÁ-LAS INVALIDA O OUTPUT:

PACING ACELERADO (REGRA DE OURO):
  * NADA PODE FICAR MAIS DE 3 SEGUNDOS NA TELA.
  * A duração de cada cena deve ser de no máximo 3.0 segundos (idealmente entre 2.0 e 3.0 segundos).
  * Para cumprir isso, cada frase da narração (subtext) DEVE ser extremamente curta: no máximo 10 a 12 palavras por cena.
  * O roteiro deve conter muitas cenas (15 a 18 cenas para um vídeo de 45 segundos) para manter cortes rápidos e dinâmicos.

VISUAL_TYPE — distribuição mínima obrigatória por reel:
  * "hook": Sempre a cena 1 (2 a 2,5s). Gancho agressivo, 3-5 palavras na headline. OBRIGATÓRIO: preencher o "subtext" com o início da locução (ex: a frase introdutória do vídeo).
  * "video": MÍNIMO 2 cenas. B-roll de vídeo ao fundo. OBRIGATÓRIO: preencher "youtube_search" in inglês com queries mais específicas e contextuais (pessoa + evento + ano quando possível). Ex: "Gabriel Galipolo Banco Central audiencia senado 2025", "oil pump jack field aerial", "Dubai skyline night aerial 4k". A youtube_search DEVE descrever exatamente o que aparece na narração naquele momento — não um tema geral.
  * "cutout": MÍNIMO 2 cenas. Foto editorial flutuante. OBRIGATÓRIO: preencher "media_keyword" com o nome exato da pessoa, corporação, logo ou objeto (ex: "Elon Musk", "Petrobras logo", "Saudi Arabia flag", "dollar bills"). Evite termos genéricos como "money" ou "briefcase" repetidamente.
  * "illustration": MÍNIMO 1 cena. Gráfico animado. OBRIGATÓRIO: preencher "media_keyword" detalhando o tipo de gráfico (ex: "bar chart inflation", "line chart stock price", "pie chart budget").
  * "newspaper_clip": MÍNIMO 1 cena. Recorte de jornal impresso tradicional exibindo uma notícia de veracidade. OBRIGATÓRIO: preencher "headline" com o título do jornal simulado (ex: "THE WALL STREET JOURNAL", "VALOR ECONÔMICO") e "media_keyword" com a frase exata da narração que deve ser grifada com marca-texto amarelo.
  * "data": MÍNIMO 1 cena. Métrica, percentual ou número com barra animada.
  * "map": USE quando a notícia envolver países, conflitos internacionais, rotas de exportação/petróleo ou regiões geográficas específicas.
  * "timeline": USE quando a narração referenciar um ano marcante (ex: 1840, 2024), marcos temporais históricos ou prazos futuros. Na `headline` escreva apenas o ano numérico ou um valor de alto impacto (ex: "1840" ou "$5B").
  * "collage": USE quando quiser destacar múltiplas pessoas ou grupos (ex: milionários da IA, corporações), compondo um estilo jornalístico sujo.
  * "split_video": USE quando a narração enumerar 3 coisas, lugares ou conceitos diferentes simultâneos (ex: "Dubai, Doha, Riyadh" ou "Inflação, Desemprego, Juros"). Requer `youtube_search` válido assim como a cena de `video`.
  * NÃO crie nenhuma cena de CTA (Call to Action), encerramento, agradecimento ou pedido de curtir/seguir no final. O roteiro deve focar 100% no conteúdo da notícia e terminar de forma informativa natural.

PERSON_NAME — obrigatório em cenas "cutout" com figuras públicas:
  * Preencher com o nome completo + cargo/empresa da figura pública real citada (ex: "Jerome Powell Federal Reserve chairman", "Elon Musk Tesla CEO", "Lula presidente do Brasil").
  * Para cutouts sem figura humana ou com temas abstratos, preencher como null ou omitir.

NUNCA REPETIR FRASES OU MÍDIAS (REGRA DE OURO):
  * É expressamente proibido repetir a mesma imagem, pessoa ou conceito visual em duas cenas consecutivas. A imagem da próxima cena DEVE ser alterada para variar e não cansar a tela.
  * É expressamente proibido repetir a mesma frase de narração (`subtext`) ou a mesma `headline` em várias cenas. Cada cena DEVE ter um texto de narração único que progride linearmente na história. Se a cena anterior terminou com "o mercado desabou", a próxima cena deve dar sequência, por exemplo "com as ações caindo 12%".
  * É expressamente proibido repetir a mesma media_keyword ou imagens similares em várias cenas. Garanta que cada cena de cutout ou illustration traga elementos novos para manter o interesse.

TEXTOS CURTOS E GRAMÁTICA DINÂMICA:
  * As headlines e textos em tela devem ser extremamente curtos e dinâmicos para não poluir a tela.
  * OBRIGATÓRIO: A headline e as palavras selecionadas devem seguir exatamente o que está no roteiro falado (subtext). Por exemplo, se na narração se diz "24 horas", a headline/texto na tela deve conter "24 horas" (não abrevie para "24").
  * NUNCA inclua referências escritas ao nome do canal ou termos como "Noticiando" ou "Breaking" nas headlines, subtexts ou legendas dos vídeos.
  * Você PODE e DEVE ignorar regras estritas de parágrafos/pontuação nos textos em tela. Prefira palavras soltas de impacto ou frases curtas de 2-4 palavras para reforçar as falas da narração.

DIRETRIZES DE FLUXO, MÉTRICAS E ÚLTIMA CENA:
  * EVITE EXCESSO DE TEXTO ESCURO: Não crie cenas escuras com apenas textos de baixo contraste que dificultem a leitura. Sempre insira ilustrações vibrantes, logos ou stock footage relevantes ao tema falado (ex: "Hyperliquid logo" em vez de imagens sem sentido).
  * EVITE DUPLICAÇÃO DE MÉTRICAS: Se a métrica (ex: "77 mil") já estiver na headline ou subtext, garanta uma melhor diagramação para evitar que o mesmo valor apareça duplicado ou triplicado de forma desnecessária na mesma tela.
  * ÚLTIMA CENA DE ALTO IMPACTO: A última cena deve encerrar o vídeo com um impacto forte sobre o tema abordado (ex: uma conclusão relevante ou projeção futura). NUNCA termine com um texto genérico fraco como "INVESTIMENTOS" ou "MERCADO".
  * DECORATOR_TYPE — OBRIGATÓRIO EM TODA CENA, PROIBIDO "none":
    * "arrow"  → crescimento, direção, tendência
    * "circle" → análise, contexto, dado circular ou destaque
    * "stripes" → energia, momentum, impacto visual

MEDIA_KEYWORD — obrigatório em cenas cutout, newspaper_clip e illustration:
  * Detalhe exatamente o que deve ser buscado ou exibido (ex: "Elon Musk", "Nvidia logo", "American flag", "bar chart inflation").

YOUTUBE_SEARCH — obrigatório em cenas video:
  * Em inglês, buscando trechos reais e precisos de noticiários, mercado financeiro, pessoas ou locais específicos da notícia.

- Cada subtext deve ser envolvente e narrável em voz alta. O conjunto dos subtexts forma o roteiro da locução ElevenLabs.
- TODAS as headlines e subtexts DEVEM ser geradas em português brasileiro natural, envolvente e fluente para o público brasileiro, mesmo que o Título ou Resumo originais estejam em inglês. A única exceção é o campo 'youtube_search', que deve ser escrito em inglês para melhor busca no YouTube.
- Variar visual_type com mais equilíbrio — não concentrar todos os "video" no início ou no fim.
- Estime duration_seconds com base no texto da narração (subtext): ~0.2s por palavra. A duração por cena DEVE ser de no máximo 3.0s (exceto para cenas de visual_type 'video' e 'split_video', que podem ter a duração real correspondente sem o teto de 3 segundos).
"""


def _build_user_msg(title: str, summary: str, category: str, duration: int) -> str:
    if duration <= 30:
        scene_count = "10 a 12"
    elif duration <= 45:
        scene_count = "15 a 18"
    else:
        scene_count = "20 a 24"

    return (
        f"Crie roteiro visual de exatamente {duration} segundos para Reels sobre esta notícia.\n"
        f"Gere entre {scene_count} cenas no total para cobrir esse tempo de forma extremamente rápida e dinâmica (máximo de 3.0s por cena).\n\n"
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
