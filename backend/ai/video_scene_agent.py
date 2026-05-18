import json
import logging
from typing import Any

import anthropic

logger = logging.getLogger(__name__)
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1024

SYSTEM_PROMPT = """\
Você é um diretor criativo especializado em Reels virais de finanças e economia para redes sociais.
Sua missão: transformar uma notícia em um roteiro de cenas para vídeo vertical 9:16.

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

Regras de roteiro:
- visual_type: "hook" (1ª cena, 2-2.5s, frase-gancho) | "context" (contexto, 3-4s) | "data" (dado/número, 3s) | "cta" (última cena, 2.5s)
- headline: TUDO MAIÚSCULAS, máx 6 palavras, visceral, direto, sem pontuação final
- subtext: caixa normal, máx 12 palavras, complementa o headline
- accent_word_indices: índices (base 0) das palavras do headline para destacar em laranja — max 2 por cena
- Total de cenas: 8-10 para 45s, escale proporcionalmente para outras durações
- A soma de duration_seconds deve ser aproximadamente o total solicitado
- Prefira números concretos, percentuais, datas e nomes de empresas nos subtextos"""


async def generate_video_scenes(
    api_key: str,
    title: str,
    summary: str,
    category: str,
    duration: int = 45,
) -> dict[str, Any]:
    client = anthropic.AsyncAnthropic(api_key=api_key)

    user_msg = (
        f"Crie roteiro visual de {duration}s para Reels sobre esta notícia:\n\n"
        f"Título: {title}\n"
        f"Categoria: {category}\n"
        f"Resumo: {summary or title}\n\n"
        f"Retorne apenas o JSON."
    )

    response = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = response.content[0].text.strip()

    # Strip markdown code blocks if model wraps in ```
    if "```" in text:
        for part in text.split("```"):
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                try:
                    return json.loads(part)
                except json.JSONDecodeError:
                    continue

    return json.loads(text)
