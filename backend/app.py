"""
No Meu Bairro — Vitória Régia
Aplicação Flask principal com API RESTful.

Uso:
    Development:  flask run
    Production:   gunicorn "app:create_app('production')"
    Directo:      python app.py
"""
import os
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, g, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

from config import config_by_name
from models import db
from routes import all_blueprints

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _validate_production_config(app: Flask) -> None:
    """Impede que o backend legado suba em produção com configuração insegura."""
    required = {
        "DATABASE_URL": app.config.get("SQLALCHEMY_DATABASE_URI"),
        "SECRET_KEY": app.config.get("SECRET_KEY"),
        "JWT_SECRET_KEY": app.config.get("JWT_SECRET_KEY"),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "Configuração de produção incompleta. Defina: " + ", ".join(missing)
        )

    for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = str(app.config.get(name) or "")
        if len(value) < 32:
            raise RuntimeError(f"{name} precisa ter pelo menos 32 caracteres em produção.")
        if value in {"dev-secret-change-me", "jwt-secret-change-me"}:
            raise RuntimeError(f"{name} está usando uma chave de desenvolvimento.")

    origins = [str(origin).strip() for origin in app.config.get("CORS_ORIGINS", []) if str(origin).strip()]
    if not origins or "*" in origins:
        raise RuntimeError(
            "CORS_ORIGINS precisa listar explicitamente as origens permitidas em produção."
        )


def create_app(config_name: str | None = None) -> Flask:
    """
    Application Factory Pattern.
    Cria e configura a instância do Flask.
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "production")

    if config_name not in config_by_name:
        raise RuntimeError(f"Ambiente inválido: {config_name}")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    if config_name == "production":
        _validate_production_config(app)

    # ─── Extensions ────────────────────────────────────────
    db.init_app(app)
    Migrate(app, db)
    CORS(app, origins=app.config.get("CORS_ORIGINS", []))

    # Rate Limiter (memória — para produção use Redis)
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[app.config.get("RATE_LIMIT_DEFAULT", "100/hour")],
        storage_uri="memory://",
    )
    limiter.init_app(app)

    # ─── Register Blueprints ──────────────────────────────
    for bp in all_blueprints:
        app.register_blueprint(bp)

    # ─── Rate limits por blueprint ────────────────────────
    with app.app_context():
        for rule in app.url_map.iter_rules():
            if "/api/auth/login" in rule.rule or "/api/auth/register" in rule.rule:
                limiter.limit(app.config.get("RATE_LIMIT_AUTH", "5/minute"))(
                    app.view_functions.get(rule.endpoint, lambda: None)
                )
            if "/api/denuncias" in rule.rule and rule.methods and "POST" in rule.methods:
                limiter.limit(app.config.get("RATE_LIMIT_DENUNCIAS", "3/hour"))(
                    app.view_functions.get(rule.endpoint, lambda: None)
                )

    # ─── Request Hooks ────────────────────────────────────
    @app.before_request
    def before_request():
        g.start_time = datetime.now(timezone.utc)

    @app.after_request
    def after_request(response):
        try:
            duration = (datetime.now(timezone.utc) - g.start_time).total_seconds() * 1000
            logger.info(
                "%s %s %s %.1fms",
                request.method,
                request.path,
                response.status_code,
                duration,
            )
        except Exception:
            logger.exception("Falha ao registrar métrica da requisição")
        return response

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Recurso não encontrado."}), 404

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify({"error": "Muitas requisições. Tente novamente mais tarde."}), 429

    @app.errorhandler(500)
    def internal_error(_error):
        db.session.rollback()
        return jsonify({"error": "Erro interno do servidor."}), 500

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    return app


if __name__ == "__main__":
    app = create_app(os.environ.get("FLASK_ENV", "development"))
    app.run(host="0.0.0.0", port=5000, debug=app.debug)
