"""
Rotas do Mural — Eventos e avisos comunitários.
GET    /api/events               — Listar eventos (filtros)
POST   /api/events               — Publicar evento
GET    /api/events/<id>          — Detalhe
DELETE /api/events/<id>          — Remover (dono)
"""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validate, ValidationError
from datetime import date

from models import db, Event
from middleware import auth_required, get_current_user_id, sanitize_string

mural_bp = Blueprint("mural", __name__, url_prefix="/api/events")

VALID_TYPES = ["feira", "saude", "reuniao", "cultura", "esporte", "campanha", "outros"]


class CreateEventSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=3, max=255))
    description = fields.Str(required=True, validate=validate.Length(min=5))
    date = fields.Date(required=True, format="%Y-%m-%d")
    location = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    type = fields.Str(required=True, validate=validate.OneOf(VALID_TYPES))


# ─── GET /api/events ───────────────────────────────────────
@mural_bp.route("", methods=["GET"])
def list_events():
    """
    Lista eventos com filtros.
    Query: ?type=feira&upcoming=true&page=1
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    event_type = request.args.get("type")
    upcoming = request.args.get("upcoming", "false").lower() == "true"

    query = Event.query

    if event_type and event_type in VALID_TYPES:
        query = query.filter(Event.type == event_type)

    if upcoming:
        query = query.filter(Event.event_date >= date.today())

    query = query.order_by(Event.event_date.asc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "events": [e.to_dict() for e in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    }), 200


# ─── POST /api/events ──────────────────────────────────────
@mural_bp.route("", methods=["POST"])
@auth_required
def create_event():
    """Publica um novo evento no mural."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo vazio."}), 400

    schema = CreateEventSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    user_id = get_current_user_id()
    event = Event(
        title=sanitize_string(validated["title"]),
        description=validated["description"].strip(),
        event_date=validated["date"],
        location=sanitize_string(validated["location"]),
        type=validated["type"],
        created_by=user_id,
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"message": "Evento publicado com sucesso.", "event": event.to_dict()}), 201


# ─── GET /api/events/<id> ──────────────────────────────────
@mural_bp.route("/<event_id>", methods=["GET"])
def get_event(event_id: str):
    """Detalhe de um evento."""
    event = Event.query.get(event_id)
    if not event:
        return jsonify({"error": "Evento não encontrado."}), 404
    return jsonify({"event": event.to_dict()}), 200


# ─── DELETE /api/events/<id> ───────────────────────────────
@mural_bp.route("/<event_id>", methods=["DELETE"])
@auth_required
def delete_event(event_id: str):
    """Remove um evento (apenas o criador)."""
    user_id = get_current_user_id()
    event = Event.query.get(event_id)
    if not event:
        return jsonify({"error": "Evento não encontrado."}), 404
    if str(event.created_by) != user_id:
        return jsonify({"error": "Sem permissão para remover este evento."}), 403

    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Evento removido."}), 200
