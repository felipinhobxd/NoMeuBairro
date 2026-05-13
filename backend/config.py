"""
Configuração da aplicação — Ambientes: development, testing, production
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int = 0) -> int:
    return int(os.environ.get(key, str(default)))


class BaseConfig:
    """Configuração base compartilhada entre todos os ambientes."""
    SECRET_KEY = _env("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
    }

    # JWT
    JWT_SECRET_KEY = _env("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=_env_int("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=_env_int("JWT_REFRESH_TOKEN_EXPIRES", 2592000))

    # Argon2
    ARGON2_TIME_COST = _env_int("ARGON2_TIME_COST", 2)
    ARGON2_MEMORY_COST = _env_int("ARGON2_MEMORY_COST", 102400)
    ARGON2_PARALLELISM = _env_int("ARGON2_PARALLELISM", 8)

    # Rate Limiting
    RATE_LIMIT_DEFAULT = _env("RATE_LIMIT_DEFAULT", "100/hour")
    RATE_LIMIT_AUTH = _env("RATE_LIMIT_AUTH", "5/minute")
    RATE_LIMIT_DENUNCIAS = _env("RATE_LIMIT_DENUNCIAS", "3/hour")

    # Uploads
    MAX_CONTENT_LENGTH = _env_int("MAX_CONTENT_LENGTH", 10485760)  # 10MB
    UPLOAD_FOLDER = _env("UPLOAD_FOLDER", "./uploads")

    # E2EE
    E2EE_PRIVATE_KEY_PATH = _env("E2EE_PRIVATE_KEY_PATH", "./keys/private.pem")
    E2EE_PUBLIC_KEY_PATH = _env("E2EE_PUBLIC_KEY_PATH", "./keys/public.pem")

    # CORS
    CORS_ORIGINS = _env("CORS_ORIGINS", "*").split(",")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = _env("DATABASE_URL", "postgresql://anb:anb@localhost:5432/anb_dev")


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _env("DATABASE_URL", "postgresql://anb:anb@localhost:5432/anb_test")
    RATE_LIMIT_DEFAULT = "1000/hour"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = _env("DATABASE_URL")
    SECRET_KEY = _env("SECRET_KEY")  # obrigatório em produção
    JWT_SECRET_KEY = _env("JWT_SECRET_KEY")  # obrigatório em produção


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
