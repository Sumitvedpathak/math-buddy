"""Async SQLAlchemy engine/session plumbing.

The engine is created lazily on first use so the app (and the existing
LLM-only endpoints) still start when no database is configured.
"""

from collections.abc import AsyncIterator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def normalize_database_url(url: str) -> str:
    """Accept plain postgres:// and postgresql:// URLs and force the asyncpg driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _engine, _sessionmaker
    if _sessionmaker is None:
        url = get_settings().database_url
        if not url:
            raise HTTPException(status_code=503, detail="Database is not configured.")
        _engine = create_async_engine(normalize_database_url(url), pool_pre_ping=True)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
