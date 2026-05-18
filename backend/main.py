import argparse
import os
import sys
import logging

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
    return {"status": "ok", "version": "0.1.0"}


from ai.cerebro import cerebro

@app.on_event("startup")
async def on_startup():
    # Executa a auditoria geral do CEREBRO (regras, bugs e APIs) na inicialização
    cerebro.run_startup_audit()
    init_db()
    logger.info("Database initialized")
    start_scheduler()
    logger.info("Crawler scheduler started")


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
