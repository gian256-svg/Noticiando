import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    title_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    sources: Mapped[list] = mapped_column(JSON, default=list)
    source_count: Mapped[int] = mapped_column(Integer, default=1)
    category: Mapped[str] = mapped_column(String(50), default="general", index=True)
    viral_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "summary": self.summary,
            "sources": self.sources or [],
            "source_count": self.source_count,
            "category": self.category,
            "viral_score": round(self.viral_score, 1),
            "thumbnail_url": self.thumbnail_url,
            "published_at": (self.published_at.isoformat() + "Z") if self.published_at else None,
            "created_at": (self.created_at.isoformat() + "Z") if self.created_at else None,
        }
