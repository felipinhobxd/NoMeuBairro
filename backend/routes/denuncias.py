"""
Rotas de Denúncias Seguras — 100% anônimas com E2EE.
POST /api/denuncias   — Enviar denúncia criptografada
GET  /api/denuncias   — Listar tipos disponíveis (metadata apenas)

⚠️ NENHUM dado de identificação é coletado ou armazenado.
   - Sem IP no log
   - Sem user_agent
   - Sem sessão
   - Conteúdo criptografado E2EE com chaves assimétricas
"""
import hashlib
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validate, ValidationError

from models import db, Post, AnonymousReport
from middleware import compute_content_hash, sanitize_string

denuncias_bp = Blueprint("denuncias", __name__, url_prefix="/api/denuncias")

VALID_REPORT_TYPES = [
    "abuso", "assedio", "violencia_domestica", "exploracao",
    "discriminacao", "crime_ambiental", "corrupcao", "outros",
]


class DenunciaSchema(Schema):
    reportType = fields.Str(required=True, validate=validate.OneOf(VALID_REPORT_TYPES))
    encryptedContent = fields.Str(required=True, validate=validate.Length(min=10))
    contentHash = fields.Str(required=True, validate=validate.Length(equal=64))
    publicKeyFingerprint = fields.Str(load_default=None)


# ─── POST /api/denuncias ───────────────────────────────────
@denuncias_bp.route("", methods=["POST"])
def create_denuncia():
    """
    Recebe uma denúncia criptografada E2EE.

    O fluxo de segurança:
    1. Client gera par de chaves RSA/ECDH no browser
    2. Conteúdo é criptografado com a chave pública do servidor
    3. Hash SHA-256 do conteúdo original é enviado para verificação
    4. Servidor armazena apenas o blob criptografado + hash
    5. Nenhum IP, user_agent ou metadado é registrado

    Rate limiting aplicado via Flask-Limiter (config.py: RATE_LIMIT_DENUNCIAS).
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo vazio."}), 400

    schema = DenunciaSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    encrypted_content = validated["encryptedContent"].encode("utf-8")
    content_hash = validated["contentHash"]

    # Criar registro anônimo
    report = AnonymousReport(
        report_type=validated["reportType"],
        encrypted_content=encrypted_content,
        content_hash=content_hash,
        public_key_fingerprint=validated.get("publicKeyFingerprint"),
    )
    db.session.add(report)

    # Criar post anônimo no feed (sem conteúdo real — apenas indicação)
    post = Post(
        author_id=None,
        category="seguranca",
        status="pending",
        title=_get_type_label(validated["reportType"]),
        description="Denúncia anônima registrada. O conteúdo está protegido por criptografia end-to-end.",
        is_anonymous=True,
    )
    db.session.add(post)

    # Vincular report ao post
    report.post_id = post.id

    db.session.commit()

    return jsonify({
        "message": "Denúncia registrada com sucesso.",
        "reportId": str(report.id),
        "postId": str(post.id),
    }), 201


# ─── GET /api/denuncias/types ──────────────────────────────
@denuncias_bp.route("/types", methods=["GET"])
def list_types():
    """Lista tipos de denúncia disponíveis (metadata apenas)."""
    types = [
        {"value": "abuso", "label": "Abuso físico ou psicológico"},
        {"value": "assedio", "label": "Assédio moral ou sexual"},
        {"value": "violencia_domestica", "label": "Violência doméstica"},
        {"value": "exploracao", "label": "Exploração de menores"},
        {"value": "discriminacao", "label": "Discriminação ou racismo"},
        {"value": "crime_ambiental", "label": "Crime ambiental"},
        {"value": "corrupcao", "label": "Corrupção ou fraude"},
        {"value": "outros", "label": "Outros"},
    ]
    return jsonify({"types": types}), 200


def _get_type_label(report_type: str) -> str:
    """Converte tipo técnico em label legível."""
    labels = {
        "abuso": "Abuso físico ou psicológico",
        "assedio": "Assédio moral ou sexual",
        "violencia_domestica": "Violência doméstica",
        "exploracao": "Exploração de menores",
        "discriminacao": "Discriminação ou racismo",
        "crime_ambiental": "Crime ambiental",
        "corrupcao": "Corrupção ou fraude",
        "outros": "Outros",
    }
    return labels.get(report_type, "Denúncia Anônima")
