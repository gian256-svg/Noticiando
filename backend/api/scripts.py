import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ai.script_agent import generate_script_stream

router = APIRouter()
logger = logging.getLogger(__name__)


class ScriptRequest(BaseModel):
    news_id: str
    title: str
    summary: str = ""
    sources: list[str] = []
    published_at: str = ""
    viral_score: float = 0.0
    category: str = "general"
    format_type: str = "animated"
    duration: int = 45
    api_key: str


@router.post("/generate-script")
async def generate_script(req: ScriptRequest):
    if not req.api_key or not req.api_key.startswith("sk-ant-"):
        raise HTTPException(status_code=400, detail="API key inválida")

    async def stream():
        async for chunk in generate_script_stream(
            api_key=req.api_key,
            title=req.title,
            sources=req.sources,
            published_at=req.published_at,
            viral_score=req.viral_score,
            category=req.category,
            summary=req.summary,
            format_type=req.format_type,
            duration=req.duration,
        ):
            payload = json.dumps({"text": chunk})
            yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
