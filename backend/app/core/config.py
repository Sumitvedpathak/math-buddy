from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str = Field(validation_alias="math_buddy_openrouter_api_key")
    openrouter_model: str = Field(default="google/gemini-2.0-flash-001", validation_alias="math_buddy_openrouter_model")
    cors_origins: str = "http://localhost:5173"
    langsmith_api_key: str | None = Field(default=None, validation_alias="math_buddy_langsmith_api_key")

    # Postgres, e.g. postgresql+asyncpg://user:pass@host:5432/dbname.
    # Optional so the LLM-only endpoints still run without a database.
    database_url: str | None = Field(default=None, validation_alias="math_buddy_database_url")
    # Fixed secret for /api/v1/admin/*. Unset = admin API always returns 404.
    admin_token: str | None = Field(default=None, validation_alias="math_buddy_admin_token")

    # Parent sign-in. Our Google OAuth client IDs (comma-separated: web now, apps later)
    # and the secret that signs Math Buddy access tokens. Unset = sign-in returns 503.
    google_client_ids: str = Field(default="", validation_alias="math_buddy_google_client_ids")
    jwt_secret: str | None = Field(default=None, validation_alias="math_buddy_jwt_secret")
    # Terms/privacy version a new parent must accept before their account is created.
    terms_version: str = Field(default="2026-11-draft", validation_alias="math_buddy_terms_version")
    # The refresh cookie is Secure (HTTPS only). Browsers treat http://localhost as secure,
    # so leave this on; turn it off only for a plain-http host that is not localhost.
    cookie_secure: bool = Field(default=True, validation_alias="math_buddy_cookie_secure")

    # Logging
    # log_level: DEBUG | INFO | WARNING | ERROR | CRITICAL
    log_level: str = "INFO"
    # log_format: "text" for local dev, "json" for cloud deployment
    log_format: str = "text"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def google_client_ids_list(self) -> list[str]:
        return [c.strip() for c in self.google_client_ids.split(",") if c.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "populate_by_name": True}


@lru_cache
def get_settings() -> Settings:
    return Settings()
