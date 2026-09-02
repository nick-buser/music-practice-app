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

    # The provenance allow-list (PV1): extractor names a `POST /v1/runs`
    # completed-run body may declare when `executor` is 'client' | 'external'
    # (pure-TS/imported producers). A worker-only extractor name posted this
    # way is a 422, not a silently-accepted row — the allow-list is what
    # keeps "who's allowed to say they finished a run" config-driven rather
    # than something the wire schema alone can express.
    client_extractors: list[str] = Field(
        default_factory=lambda: [
            "midi-matcher",
            "scorer",
            "musicxml-import",
            "reaper-capture-sidecar",
        ]
    )

    # OpenTelemetry → SigNoz. Tracing is wired only when an endpoint is set, so
    # the app runs fine with no collector in front of it.
    otel_exporter_otlp_endpoint: str | None = None

    # Garage (S3-compatible) object storage for media — recordings, idea
    # assets. All optional: unset means `storage_configured` is False and
    # `app.deps.get_media_store` falls back to `MemoryMediaStore`, so dev/test
    # stay usable with no S3 endpoint in reach (this laptop included — it
    # can't route to Garage at all). These names are read straight off the
    # deployed Helm chart's `config:`/`secretKeyRef` — match them exactly, or
    # a fully-configured cluster silently reports "unconfigured".
    s3_endpoint: str | None = None
    s3_region: str | None = None
    s3_bucket: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    # Arrives from the chart as the string "true"; pydantic-settings parses
    # common truthy/falsy strings into bool fields with no extra work.
    s3_force_path_style: bool = False

    @property
    def storage_configured(self) -> bool:
        return bool(
            self.s3_endpoint
            and self.s3_region
            and self.s3_bucket
            and self.s3_access_key_id
            and self.s3_secret_access_key
        )

    @field_validator("cors_origins", "client_extractors", mode="before")
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
