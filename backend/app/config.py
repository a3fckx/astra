"""
Application configuration management

Loads settings from:
1. Environment variables (.env file)
2. config.json (for non-secret config)
Priority: Environment variables > config.json > defaults
"""

from __future__ import annotations

import json
import os
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure local .env is loaded when running from repo root
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULTS_PATH = PROJECT_ROOT / "shared" / "config" / "defaults.json"


class ConfigLoader:
    """Loads configuration from config.json with environment overrides."""

    def __init__(self, config_path: Optional[str | Path] = None) -> None:
        self.config_path = (
            Path(config_path)
            if config_path is not None
            else DEFAULTS_PATH
        )
        self._config: Dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.config_path.exists():
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._config = json.load(f)

    def get(self, key: str, default: Any = None) -> Any:
        env_key = key.upper()
        env_value = os.getenv(env_key)
        if env_value is not None:
            try:
                return json.loads(env_value)
            except (json.JSONDecodeError, TypeError):
                return env_value
        return self._config.get(key, default)

    def get_nested(self, *keys: str, default: Any = None) -> Any:
        value: Any = self._config
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return default
            if value is None:
                return default
        return value

    @property
    def config(self) -> Dict[str, Any]:
        return self._config


@lru_cache()
def get_config() -> ConfigLoader:
    return ConfigLoader()


config = get_config()


def _default_secret_key() -> str:
    return (
        os.getenv("SECRET_KEY")
        or os.getenv("JWT_SECRET")
        or secrets.token_hex(32)
    )


def _config_value(key: str, default: Any = None) -> Any:
    return config.get(key, default)


def _config_nested(*keys: str, default: Any = None) -> Any:
    return config.get_nested(*keys, default=default)


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    app_name: str = "Astra"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # MongoDB
    mongodb_username: str
    mongodb_password: str
    mongodb_cluster: str = "astra.ethgite"
    mongodb_db: str = "astra"

    @property
    def mongodb_uri(self) -> str:
        return (
            f"mongodb+srv://{self.mongodb_username}:{self.mongodb_password}"
            f"@{self.mongodb_cluster}.mongodb.net/?retryWrites=true&w=majority&appName=astra"
        )

    # ElevenLabs
    elevenlabs_api_key: str = Field(default_factory=lambda: _config_value("elevenlabs_api_key", ""))
    elevenlabs_agent_id: str = Field(default_factory=lambda: _config_value("agent_id", ""))
    elevenlabs_voice_id: Optional[str] = None
    elevenlabs_language: str = Field(default_factory=lambda: _config_value("language", "en"))

    # Google OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str = Field(
        default_factory=lambda: _config_nested(
            "google_auth", "redirect_uri", "http://localhost:3000/api/auth/callback/google"
        )
    )
    google_enable_birthday_scope: bool = Field(
        default_factory=lambda: _config_nested("google_auth", "enable_birthday_scope", True)
    )
    google_enable_gmail_read_scope: bool = Field(
        default_factory=lambda: _config_nested("google_auth", "enable_gmail_read_scope", False)
    )
    google_include_granted_scopes: bool = Field(
        default_factory=lambda: _config_nested("google_auth", "include_granted_scopes", False)
    )
    google_access_type: Optional[str] = Field(
        default_factory=lambda: _config_nested("google_auth", "access_type")
    )
    google_prompt: Optional[str] = Field(
        default_factory=lambda: _config_nested("google_auth", "prompt")
    )

    # Security
    secret_key: str = Field(default_factory=_default_secret_key)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # Frontend
    frontend_url: str = "http://localhost:3000"

    # Paths
    project_root: Path = Path(__file__).parent.parent.parent
    prompt_template_path: str = "shared/prompts/responder.md"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
