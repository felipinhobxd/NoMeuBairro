"""
Rotas de autenticação — Registro, Login, Perfil e Gamificação.
POST /api/auth/register   — Criar conta
POST /api/auth/login      — Login (retorna JWT)
GET  /api/auth/profile    — Perfil do usuário logado
POST /api/auth/logout     — Logout (invalida token no client)
"""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validate, ValidationError

from models import db, User, Badge
from middleware import (
    hash_password, verify_password, generate_access_token,
    generate_refresh_token, auth_required, get_current_user_id,
    sanitize_string,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ─── Schemas de Validação (Marshmallow) ────────────────────
class RegisterSchema(Schema):
    name = fields.Str(required=True, validate=[validate.Length(min=2, max=100)])
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=[validate.Length(min=6, max=128)])


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)


# ─── POST /api/auth/register ───────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register():
    """Registra um novo usuário. Senha hasheada com Argon2id."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo da requisição vazio."}), 400

    # Validar input
    schema = RegisterSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    name = sanitize_string(validated["name"])
    email = validated["email"].strip().lower()
    password = validated["password"]

    # Verificar email único
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Este e-mail já está cadastrado."}), 409

    # Criar usuário
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )
    db.session.add(user)
    db.session.commit()

    # Gerar tokens
    access_token = generate_access_token(str(user.id), user.name)
    refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        "message": "Conta criada com sucesso.",
        "user": user.to_dict(include_badges=True),
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }), 201


# ─── POST /api/auth/login ──────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    """Autentica usuário e retorna JWT."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo da requisição vazio."}), 400

    schema = LoginSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    email = validated["email"].strip().lower()
    password = validated["password"]

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "E-mail não encontrado. Crie uma conta primeiro."}), 404

    if not user.is_active:
        return jsonify({"error": "Conta desativada."}), 403

    if not verify_password(user.password_hash, password):
        return jsonify({"error": "Senha incorreta."}), 401

    # Gerar tokens
    access_token = generate_access_token(str(user.id), user.name)
    refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        "message": "Login realizado com sucesso.",
        "user": user.to_dict(include_badges=True),
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }), 200


# ─── GET /api/auth/profile ─────────────────────────────────
@auth_bp.route("/profile", methods=["GET"])
@auth_required
def profile():
    """Retorna perfil completo do usuário autenticado."""
    user_id = get_current_user_id()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    return jsonify({"user": user.to_dict(include_badges=True)}), 200


# ─── GET /api/auth/badges ──────────────────────────────────
@auth_bp.route("/badges", methods=["GET"])
@auth_required
def get_badges():
    """Lista todos os selos disponíveis e os conquistados pelo usuário."""
    user_id = get_current_user_id()
    earned = {b.badge for b in Badge.query.filter_by(user_id=user_id).all()}
    all_badges = []
    for key, info in Badge.BADGE_INFO.items():
        all_badges.append({
            "id": key,
            "name": info["name"],
            "description": info["description"],
            "emoji": info["emoji"],
            "earned": key in earned,
        })
    return jsonify({"badges": all_badges}), 200


# ─── POST /api/auth/refresh ────────────────────────────────
@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """Renova o access token usando um refresh token válido."""
    from middleware import decode_token
    data = request.get_json()
    refresh_token = data.get("refreshToken")
    if not refresh_token:
        return jsonify({"error": "Refresh token ausente."}), 401

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return jsonify({"error": "Refresh token inválido ou expirado."}), 401

    user = User.query.get(payload["sub"])
    if not user:
        return jsonify({"error": "Usuário não encontrado."}), 404

    new_access = generate_access_token(str(user.id), user.name)
    return jsonify({"accessToken": new_access}), 200
