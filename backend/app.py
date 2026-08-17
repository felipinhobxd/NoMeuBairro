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

    origins = [
        str(origin).strip()
        for origin in app.config.get("CORS_ORIGINS", [])
        if str(origin).strip()
    ]
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

    # Rate Limiter (memória — para produção com múltiplas instâncias, use Redis)
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[app.config.get("RATE_LIMIT_DEFAULT", "100/hour")],
        storage_uri="memory://",
    )
    limiter.init_app(app)

    # ─── Register Blueprints ──────────────────────────────
    for bp in all_blueprints:
        app.register_blueprint(bp)

    # ─── Rate limits por endpoint ─────────────────────────
    # Os decorators precisam substituir a função registrada no Flask; apenas
    # chamar limiter.limit(...)(view) sem reatribuir deixava margem para que o
    # wrapper não fosse o callable efetivamente executado.
    for rule in list(app.url_map.iter_rules()):
        view = app.view_functions.get(rule.endpoint)
        if view is None:
            continue
        if "/api/auth/login" in rule.rule or "/api/auth/register" in rule.rule:
            app.view_functions[rule.endpoint] = limiter.limit(
                app.config.get("RATE_LIMIT_AUTH", "5/minute")
            )(view)
        elif "/api/denuncias" in rule.rule and rule.methods and "POST" in rule.methods:
            app.view_functions[rule.endpoint] = limiter.limit(
                app.config.get("RATE_LIMIT_DENUNCIAS", "3/hour")
            )(view)

    # ─── Request Hooks ────────────────────────────────────
    @app.before_request
    def before_request():
        g.start_time = datetime.now(timezone.utc)

    @app.after_request
    def after_request(response):
        try:
            duration = (datetime.now(timezone.utc) - g.start_time).total_seconds() * 1000
        except Exception:
            duration = 0
        if "/denuncias" not in request.path:
            logger.info(
                "%s %s → %s (%.0fms)",
                request.method,
                request.path,
                response.status_code,
                duration,
            )
        else:
            # Não registra conteúdo/identidade nas rotas sensíveis.
            logger.info(
                "[ANÔNIMO] %s /denuncias → %s (%.0fms)",
                request.method,
                response.status_code,
                duration,
            )
        return response

    # ─── Error Handlers ───────────────────────────────────
    @app.errorhandler(400)
    def bad_request(_error):
        return jsonify({"error": "Requisição inválida."}), 400

    @app.errorhandler(401)
    def unauthorized(_error):
        return jsonify({"error": "Não autorizado. Faça login."}), 401

    @app.errorhandler(403)
    def forbidden(_error):
        return jsonify({"error": "Acesso negado."}), 403

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Recurso não encontrado."}), 404

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify({"error": "Muitas requisições. Tente novamente em alguns instantes."}), 429

    @app.errorhandler(500)
    def server_error(error):
        db.session.rollback()
        logger.error("Erro interno: %s", error)
        return jsonify({"error": "Erro interno do servidor."}), 500

    # ─── Health Check ─────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health_check():
        try:
            db.session.execute(db.text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db.session.rollback()
            db_status = "error"
        return jsonify({
            "status": "ok" if db_status == "ok" else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": db_status,
            "version": "1.0.0",
        }), 200 if db_status == "ok" else 503

    # ─── Root ─────────────────────────────────────────────
    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "name": "No Meu Bairro — API",
            "bairro": "Vitória Régia",
            "cidade": "Curitiba",
            "version": "1.0.0",
            "docs": "/api/health",
        }), 200

    return app


# ═══════════════════════════════════════════════════════════
# ENTRY POINT — Flask CLI encontra o app aqui
# ═══════════════════════════════════════════════════════════
# Isto permite que `flask run`, `flask db migrate`, etc.
# encontrem a app automaticamente via FLASK_APP=app.py

env_name = os.environ.get("FLASK_ENV", "development")
app = create_app(env_name)

if __name__ == "__main__":
    logger.info("🏁 API rodando em http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=app.debug)
