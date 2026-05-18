import logging
from typing import AsyncGenerator

import anthropic

from ai.prompts import build_messages

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048


async def generate_script_stream(
    api_key: str,
    title: str,
    sources: list[str],
    published_at: str,
    viral_score: float,
    category: str,
    summary: str,
    format_type: str = "animated",
    duration: int = 45,
) -> AsyncGenerator[str, None]:
    """
    Streams the generated script token by token.
    Yields text chunks as they arrive from Claude.
    """
    system_prompt, user_message = build_messages(
        title=title,
        sources=sources,
        published_at=published_at,
        viral_score=viral_score,
        category=category,
        summary=summary,
        format_type=format_type,
        duration=duration,
    )

    client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except anthropic.AuthenticationError:
        yield "\n\n[ERRO: API Key inválida. Verifique nas configurações.]"
    except anthropic.RateLimitError:
        yield "\n\n[ERRO: Limite de requisições atingido. Tente novamente em alguns segundos.]"
    except Exception as e:
        logger.error(f"Script generation error: {e}")
        yield f"\n\n[ERRO: {str(e)}]"
