"""
Aqui no meu bairro — Vitória Régia
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


def create_app(config_name: str | None = None) -> Flask:
    """
    Application Factory Pattern.
    Cria e configura a instância do Flask.
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "production")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # ─── Extensions ────────────────────────────────────────
    db.init_app(app)
    Migrate(app, db)
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

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
        except Exception:
            duration = 0
        if "/denuncias" not in request.path:
            logger.info(f"{request.method} {request.path} → {response.status_code} ({duration:.0f}ms)")
        else:
            logger.info(f"[ANÔNIMO] {request.method} /denuncias → {response.status_code} ({duration:.0f}ms)")
        return response

    # ─── Error Handlers ───────────────────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Requisição inválida.", "detail": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Não autorizado. Faça login."}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Acesso negado."}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Recurso não encontrado."}), 404

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Muitas requisições. Tente novamente em alguns instantes."}), 429

    @app.errorhandler(500)
    def server_error(e):
        logger.error(f"Erro interno: {e}")
        return jsonify({"error": "Erro interno do servidor."}), 500

    # ─── Health Check ─────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health_check():
        try:
            db.session.execute(db.text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"
        return jsonify({
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": db_status,
            "version": "1.0.0",
        }), 200

    # ─── Root ─────────────────────────────────────────────
    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "name": "Aqui no meu bairro — API",
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
    app.run(host="0.0.0.0", port=5000, debug=True)
