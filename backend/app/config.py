from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "Inventory Snap"
    app_version: str = "0.1.0"
    debug: bool = False
    log_level: str = "INFO"

    # Database
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "inventory_snap"
    postgres_user: str = "inventory"
    postgres_password: str = "changeme"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Celery
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "changeme_minio"
    minio_secure: bool = False
    minio_bucket_photos: str = "photos"
    minio_bucket_thumbnails: str = "thumbnails"
    minio_bucket_documents: str = "documents"
    minio_bucket_exports: str = "exports"
    minio_bucket_backups: str = "backups"
    public_minio_url: str = "http://localhost:9000"

    # JWT / Auth
    secret_key: str = "changeme-insecure-dev-key"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 30

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:80,http://localhost"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # AI
    ai_provider: str = "ollama"
    ai_fallback_chain: str = "ollama"
    ai_confidence_threshold: float = 0.6
    ai_max_objects_per_photo: int = 20

    @property
    def ai_fallback_chain_list(self) -> list[str]:
        return [p.strip() for p in self.ai_fallback_chain.split(",") if p.strip()]

    # Ollama
    ollama_base_url: str = "http://ollama:11434"
    ollama_vision_model: str = "llava:13b"

    # OpenAI
    openai_api_key: str = ""
    openai_vision_model: str = "gpt-4o"

    # Claude
    claude_api_key: str = ""
    claude_vision_model: str = "claude-3-5-sonnet-20241022"


settings = Settings()
