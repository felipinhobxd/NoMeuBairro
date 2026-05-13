"""
Blueprints das rotas API — Registro centralizado.
"""
from .auth import auth_bp
from .feed import feed_bp
from .guia import guia_bp
from .mural import mural_bp
from .denuncias import denuncias_bp

all_blueprints = [auth_bp, feed_bp, guia_bp, mural_bp, denuncias_bp]
