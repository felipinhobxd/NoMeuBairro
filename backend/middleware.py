"""
Middleware — Autenticação JWT, proteção de rotas e utilitários.
"""
import functools
import hashlib
from datetime import datetime, timezone

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from flask import request, jsonify, current_app

# ─── Argon2id Password Hasher ──────────────────────────────
ph = PasswordHasher(
    time_cost=2,
    memory_cost=102400,  # 100 MB
    parallelism=8,
    hash_len=32,
    salt_len=16,
    type=Type.ID,  # Argon2id
)


def hash_password(plain: str) -> str:
    """Hashea senha com Argon2id."""
    return ph.hash(plain)


def verify_password(hash_str: str, plain: str) -> bool:
    """Verifica senha contra hash Argon2id sem transformar hash inválido em erro 500."""
    try:
        return ph.verify(hash_str, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ─── JWT Token Helpers ─────────────────────────────────────
def generate_access_token(user_id: str, user_name: str) -> str:
    """Gera JWT access token."""
    payload = {
        "sub": str(user_id),
        "name": user_name,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"],
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def generate_refresh_token(user_id: str) -> str:
    """Gera JWT refresh token."""
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"],
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Decodifica e valida um JWT. Retorna None se inválido."""
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ─── Auth Decorator ────────────────────────────────────────
def auth_required(f):
    """Decorator que exige JWT válido no header Authorization: Bearer <token>."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token de autenticação ausente."}), 401

        token = auth_header[7:]
        payload = decode_token(token)

        if payload is None:
            return jsonify({"error": "Token inválido ou expirado."}), 401

        if payload.get("type") != "access":
            return jsonify({"error": "Tipo de token inválido."}), 401

        request.current_user_id = payload["sub"]
        request.current_user_name = payload.get("name", "")

        return f(*args, **kwargs)
    return decorated


def get_current_user_id() -> str | None:
    """Retorna o ID do usuário autenticado da requisição atual."""
    return getattr(request, "current_user_id", None)


# ─── Input Validation Helpers ──────────────────────────────
def validate_required(data: dict, fields: list[str]) -> tuple[None, None] | tuple[str, int]:
    """
    Valida campos obrigatórios.
    Retorna (None, None) se OK, ou (error_message, status_code) se falhar.
    """
    missing = [f for f in fields if not data.get(f, "").strip()]
    if missing:
        return f"Campos obrigatórios ausentes: {', '.join(missing)}", 400
    return None, None


def sanitize_string(value: str, max_length: int = 255) -> str:
    """Sanitiza string removendo espaços extras e limitando comprimento."""
    if not value:
        return ""
    return value.strip()[:max_length]


# ─── E2EE Helpers ──────────────────────────────────────────
def compute_content_hash(content: str) -> str:
    """Computa SHA-256 hash do conteúdo para verificação de integridade."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
