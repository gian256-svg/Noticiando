import argparse
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Carrega as variaveis do arquivo .env na raiz do backend
load_dotenv(Path(__file__).resolve().parent / ".env")

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from api.news import router as news_router
from api.scripts import router as scripts_router
from api.config import router as config_router
from api.video import router as video_router
from crawler.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("noticiando")

app = FastAPI(title="Noticiando Backend", version="0.1.0", docs_url=None)

from fastapi.staticfiles import StaticFiles
from pathlib import Path

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Mount output folder statically
app.mount("/output", StaticFiles(directory=str(_PROJECT_ROOT / "output")), name="output")

app.include_router(news_router, prefix="/news", tags=["news"])
app.include_router(scripts_router, tags=["scripts"])
app.include_router(config_router, prefix="/config", tags=["config"])
app.include_router(video_router, tags=["video"])


@app.get("/cerebro/status")
async def get_cerebro_status():
    from ai.cerebro import cerebro
    return cerebro.get_status_dict()


@app.get("/health")
async def health():
    from crawler.scheduler import scheduler
    job = scheduler.get_job("crawl")
    return {
        "status": "ok",
        "version": "0.1.0",
        "scheduler_running": scheduler.running,
        "next_crawl": str(job.next_run_time) if job else None,
    }


@app.post("/crawl/trigger")
async def trigger_crawl():
    """Manually trigger a crawl cycle (useful for debugging and forcing immediate refresh)."""
    from crawler.scheduler import run_crawl
    import asyncio
    asyncio.create_task(run_crawl())
    return {"status": "triggered"}


from ai.cerebro import cerebro

@app.on_event("startup")
async def on_startup():
    init_db()
    logger.info("Database initialized")
    start_scheduler()
    logger.info("Crawler scheduler started")
    cerebro.run_startup_audit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8765")))
    args = parser.parse_args()

    logger.info(f"Starting backend on port {args.port}")
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=args.port,
        log_level="warning",
        access_log=False,
    )
