import os

import pytest
import pytest_asyncio

# Set required environment variables before any app imports
os.environ.setdefault("OPENROUTER_API_KEY", "test-placeholder")
os.environ.setdefault("MATH_BUDDY_OPENROUTER_API_KEY", "test-placeholder")

ADMIN_TOKEN = "test-admin-token-0123456789abcdef"


@pytest_asyncio.fixture
async def client():
    """httpx client against the real app, backed by an in-memory SQLite database."""
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool

    from app.db import get_session
    from app.main import app
    from app.models.tables import Base

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
def admin_token(monkeypatch):
    """Configure the server-side admin token and return it."""
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.api.deps.get_settings", lambda: SimpleNamespace(admin_token=ADMIN_TOKEN)
    )
    return ADMIN_TOKEN
