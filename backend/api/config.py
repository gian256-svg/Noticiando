import os
import logging

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


class ConfigUpdate(BaseModel):
    crawl_interval_minutes: int | None = None


@router.get("")
async def get_config():
    return {
        "crawl_interval_minutes": int(os.getenv("CRAWL_INTERVAL_MINUTES", "10")),
    }


@router.put("")
async def update_config(body: ConfigUpdate):
    if body.crawl_interval_minutes is not None:
        os.environ["CRAWL_INTERVAL_MINUTES"] = str(body.crawl_interval_minutes)
        from crawler.scheduler import reschedule_crawler
        try:
            reschedule_crawler(body.crawl_interval_minutes)
        except Exception as e:
            logger.error(f"Failed to reschedule crawler: {e}", exc_info=True)
    return {"status": "updated"}
