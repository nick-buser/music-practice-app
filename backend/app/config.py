"""Typed application settings — the 12-factor config surface.

Everything the app needs to run comes from the environment (validated here), so
the same image behaves identically across the homelab, CI, and any future cloud.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    env: str = Field(default="dev", description="dev | test | prod")
    service_name: str = "soundings-backend"

    # Postgres in prod; tests fall back to in-memory SQLite when this is unset.
    database_url: str = "sqlite+pysqlite:///:memory:"

    # CORS for the Vite SPA (comma-separated origins).
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # OpenTelemetry → SigNoz. Tracing is wired only when an endpoint is set, so
    # the app runs fine with no collector in front of it.
    otel_exporter_otlp_endpoint: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        # Accept a comma-separated string (compose-friendly) or a JSON list.
        if isinstance(v, str) and not v.strip().startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
