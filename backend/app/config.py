from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    openrouter_api_key: str = Field(validation_alias="math_buddy_openrouter_api_key")
    openrouter_model: str = Field(default="google/gemini-2.0-flash-001", validation_alias="math_buddy_openrouter_model")
    cors_origins: str = "http://localhost:5173"
    langsmith_api_key: str | None = Field(default=None, validation_alias="math_buddy_langsmith_api_key")

    # Logging
    # log_level: DEBUG | INFO | WARNING | ERROR | CRITICAL
    log_level: str = "INFO"
    # log_format: "text" for local dev, "json" for cloud deployment
    log_format: str = "text"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "populate_by_name": True}


@lru_cache
def get_settings() -> Settings:
    return Settings()
