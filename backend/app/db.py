"""Async SQLAlchemy engine/session plumbing.

The engine is created lazily on first use so the app (and the existing
LLM-only endpoints) still start when no database is configured.
"""

import uuid
from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

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
    """Turn a provider-style Postgres URL (Neon, Supabase, Cloud SQL...) into one asyncpg accepts.

    - postgres:// and postgresql:// get the asyncpg driver.
    - asyncpg takes `ssl=...`, not libpq's `sslmode=...`, and has no `channel_binding`
      option, but providers hand out URLs ending `?sslmode=require&channel_binding=require`.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break
    parts = urlsplit(url)
    if parts.query:
        query = []
        for key, value in parse_qsl(parts.query, keep_blank_values=True):
            if key == "channel_binding":
                continue
            query.append(("ssl" if key == "sslmode" else key, value))
        url = urlunsplit(parts._replace(query=urlencode(query)))
    return url


def connect_args_for(url: str) -> dict:
    """Extra driver settings. A PgBouncer pooler (Neon's `-pooler` hosts) runs in transaction
    mode, which breaks asyncpg's prepared-statement cache, so switch the cache off there."""
    if "-pooler" in (urlsplit(url).hostname or ""):
        return {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }
    return {}


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _engine, _sessionmaker
    if _sessionmaker is None:
        url = get_settings().database_url
        if not url:
            raise HTTPException(status_code=503, detail="Database is not configured.")
        url = normalize_database_url(url)
        # pool_pre_ping: serverless hosts (Neon) drop idle connections when they scale to zero.
        _engine = create_async_engine(url, pool_pre_ping=True, connect_args=connect_args_for(url))
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
