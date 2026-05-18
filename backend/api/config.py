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
        # TODO: reschedule crawler with new interval
    return {"status": "updated"}
