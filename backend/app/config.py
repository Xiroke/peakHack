from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class Settings:
    database_url: str
    admin_token: str | None
    cors_origins: tuple[str, ...]
    cors_origin_regex: str | None


def load_settings() -> Settings:
    origins = getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return Settings(
        database_url=getenv("DATABASE_URL", "sqlite:///./data/sweet_bridge.db"),
        admin_token=getenv("ADMIN_TOKEN", "admin") or None,
        cors_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
        cors_origin_regex=getenv("CORS_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1):\d+$") or None,
    )


settings = load_settings()
