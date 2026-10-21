"""Provider-style Postgres URLs (Neon etc.) must be turned into something asyncpg accepts."""

from sqlalchemy.engine import make_url

from app.db import connect_args_for, normalize_database_url

NEON = (
    "postgresql://neondb_owner:p%40ss%2Fword@ep-cool-name-123456.us-east-2.aws.neon.tech"
    "/neondb?sslmode=require&channel_binding=require"
)


def test_neon_url_gets_asyncpg_driver_and_ssl_param():
    url = make_url(normalize_database_url(NEON))
    assert url.drivername == "postgresql+asyncpg"
    assert url.query == {"ssl": "require"}  # sslmode renamed, channel_binding dropped
    assert url.host == "ep-cool-name-123456.us-east-2.aws.neon.tech"
    assert url.database == "neondb"


def test_credentials_with_special_characters_survive():
    url = make_url(normalize_database_url(NEON))
    assert url.username == "neondb_owner"
    assert url.password == "p@ss/word"


def test_postgres_scheme_alias():
    assert normalize_database_url("postgres://u:p@host/db").startswith("postgresql+asyncpg://u:p@host/db")


def test_already_asyncpg_style_url_is_unchanged():
    url = "postgresql+asyncpg://u:p@host:5432/db?ssl=require"
    assert normalize_database_url(url) == url


def test_url_without_query_and_sqlite_are_unchanged():
    assert normalize_database_url("postgresql+asyncpg://u:p@host/db") == "postgresql+asyncpg://u:p@host/db"
    assert normalize_database_url("sqlite+aiosqlite:///./dev.db") == "sqlite+aiosqlite:///./dev.db"


def test_other_query_params_are_kept():
    url = make_url(normalize_database_url("postgresql://u:p@h/db?sslmode=verify-full&application_name=mb"))
    assert url.query == {"ssl": "verify-full", "application_name": "mb"}


def test_direct_host_needs_no_extra_connect_args():
    assert connect_args_for(normalize_database_url(NEON)) == {}
    assert connect_args_for("sqlite+aiosqlite:///./dev.db") == {}


def test_pooler_host_disables_the_prepared_statement_cache():
    pooled = normalize_database_url(NEON.replace("ep-cool-name-123456", "ep-cool-name-123456-pooler"))
    args = connect_args_for(pooled)
    assert args["statement_cache_size"] == 0
    assert args["prepared_statement_cache_size"] == 0
    assert args["prepared_statement_name_func"]() != args["prepared_statement_name_func"]()
