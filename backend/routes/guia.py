"""
Rotas do Guia Comercial — Negócios locais.
GET    /api/businesses           — Listar negócios (filtros, busca)
POST   /api/businesses           — Cadastrar negócio
GET    /api/businesses/<id>      — Detalhe
DELETE /api/businesses/<id>      — Remover (dono ou admin)
"""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validate, ValidationError

from models import db, Business
from middleware import auth_required, get_current_user_id, sanitize_string

guia_bp = Blueprint("guia", __name__, url_prefix="/api/businesses")

VALID_CATEGORIES = ["alimentacao", "saude", "servicos", "educacao", "comercio", "beleza", "outros"]


class CreateBusinessSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(required=True, validate=validate.Length(min=5))
    category = fields.Str(required=True, validate=validate.OneOf(VALID_CATEGORIES))
    phone = fields.Str(load_default=None)
    whatsapp = fields.Str(load_default=None)
    address = fields.Str(load_default=None)
    imageUrl = fields.Str(load_default=None)


# ─── GET /api/businesses ───────────────────────────────────
@guia_bp.route("", methods=["GET"])
def list_businesses():
    """
    Lista negócios com filtros e busca textual.
    Query: ?category=alimentacao&search=padaria&page=1
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    category = request.args.get("category")
    search = request.args.get("search", "").strip()

    query = Business.query

    if category and category in VALID_CATEGORIES:
        query = query.filter(Business.category == category)

    if search:
        query = query.filter(
            db.or_(
                Business.name.ilike(f"%{search}%"),
                Business.description.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(Business.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "businesses": [b.to_dict() for b in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    }), 200


# ─── POST /api/businesses ──────────────────────────────────
@guia_bp.route("", methods=["POST"])
@auth_required
def create_business():
    """Cadastra um novo negócio local."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo vazio."}), 400

    schema = CreateBusinessSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    user_id = get_current_user_id()
    business = Business(
        name=sanitize_string(validated["name"]),
        description=validated["description"].strip(),
        category=validated["category"],
        phone=validated.get("phone"),
        whatsapp=validated.get("whatsapp"),
        address=validated.get("address"),
        image_url=validated.get("imageUrl"),
        created_by=user_id,
    )
    db.session.add(business)
    db.session.commit()

    return jsonify({"message": "Negócio cadastrado com sucesso.", "business": business.to_dict()}), 201


# ─── GET /api/businesses/<id> ──────────────────────────────
@guia_bp.route("/<business_id>", methods=["GET"])
def get_business(business_id: str):
    """Detalhe de um negócio."""
    business = Business.query.get(business_id)
    if not business:
        return jsonify({"error": "Negócio não encontrado."}), 404
    return jsonify({"business": business.to_dict()}), 200


# ─── DELETE /api/businesses/<id> ───────────────────────────
@guia_bp.route("/<business_id>", methods=["DELETE"])
@auth_required
def delete_business(business_id: str):
    """Remove um negócio (apenas o criador)."""
    user_id = get_current_user_id()
    business = Business.query.get(business_id)
    if not business:
        return jsonify({"error": "Negócio não encontrado."}), 404
    if str(business.created_by) != user_id:
        return jsonify({"error": "Sem permissão para remover este negócio."}), 403

    db.session.delete(business)
    db.session.commit()
    return jsonify({"message": "Negócio removido."}), 200
