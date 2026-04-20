from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    # Server
    PORT: int = 3001
    ENVIRONMENT: str = "development"

    # Security
    JWT_SECRET: str = "dev-secret-change-in-production-very-long-secret-key-32-bytes"
    JWT_EXPIRES_HOURS: int = 24

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ALLOW_ELECTRON_ORIGIN: bool = True

    # Room settings
    RECONNECT_GRACE_SECONDS: int = 90
    ROOM_EXPIRY_HOURS: int = 24
    MAX_USERS_PER_ROOM: int = 2

    # ICE/TURN
    STUN_URLS: str = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
    TURN_URL: str = ""
    TURN_SECRET: str = ""
    TURN_TTL_SECONDS: int = 3600

    # Metrics
    ENABLE_METRICS: bool = False
    METRICS_TOKEN: str = ""

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.ALLOW_ELECTRON_ORIGIN:
            origins.append("app://cinepair")
        return origins

    @property
    def stun_urls_list(self) -> List[str]:
        return [u.strip() for u in self.STUN_URLS.split(",") if u.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
