"""
Rotas do Feed — Posts (Relatos), Comentários e Apoios.
GET    /api/posts                — Listar posts (com filtros)
POST   /api/posts                — Criar post
GET    /api/posts/<id>            — Detalhe de um post
PATCH  /api/posts/<id>/status     — Atualizar status
POST   /api/posts/<id>/support    — Apoiar (toggle)
GET    /api/posts/<id>/comments   — Listar comentários
POST   /api/posts/<id>/comments   — Criar comentário
"""
import uuid
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validate, ValidationError, validates

from models import db, Post, PostSupport, Comment
from middleware import auth_required, get_current_user_id, sanitize_string

feed_bp = Blueprint("feed", __name__, url_prefix="/api")


# ─── Schemas ───────────────────────────────────────────────
class CreatePostSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=3, max=255))
    description = fields.Str(required=True, validate=validate.Length(min=5))
    category = fields.Str(required=True, validate=validate.OneOf([
        "buraco", "iluminacao", "fios", "limpeza", "transporte", "seguranca", "outros"
    ]))
    location = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    imageUrl = fields.Str(load_default=None)


class CreateCommentSchema(Schema):
    content = fields.Str(required=True, validate=validate.Length(min=1, max=2000))
    parentId = fields.UUID(load_default=None)


# ─── GET /api/posts ────────────────────────────────────────
@feed_bp.route("/posts", methods=["GET"])
def list_posts():
    """
    Lista posts com filtros opcionais.
    Query params: ?category=buraco&status=pending&page=1&per_page=10
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    category = request.args.get("category")
    status = request.args.get("status")

    query = Post.query

    if category:
        query = query.filter(Post.category == category)
    if status:
        query = query.filter(Post.status == status)

    query = query.order_by(Post.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "posts": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
        "hasNext": paginated.has_next,
    }), 200


# ─── POST /api/posts ───────────────────────────────────────
@feed_bp.route("/posts", methods=["POST"])
@auth_required
def create_post():
    """Cria um novo relato comunitário."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo vazio."}), 400

    schema = CreatePostSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    user_id = get_current_user_id()
    post = Post(
        author_id=user_id,
        title=sanitize_string(validated["title"]),
        description=validated["description"].strip(),
        category=validated["category"],
        location=sanitize_string(validated["location"]),
        image_url=validated.get("imageUrl"),
    )
    db.session.add(post)
    db.session.commit()

    return jsonify({"message": "Relato criado com sucesso.", "post": post.to_dict()}), 201


# ─── GET /api/posts/<id> ───────────────────────────────────
@feed_bp.route("/posts/<post_id>", methods=["GET"])
def get_post(post_id: str):
    """Retorna detalhe de um post específico."""
    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": "Relato não encontrado."}), 404

    # Buscar comentários em estrutura de árvore
    all_comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()
    comments_dict = {str(c.id): c.to_dict() for c in all_comments}
    root_comments = []
    for c in all_comments:
        cd = comments_dict[str(c.id)]
        cd["replies"] = []
        if c.parent_id and str(c.parent_id) in comments_dict:
            comments_dict[str(c.parent_id)].setdefault("replies", []).append(cd)
        else:
            root_comments.append(cd)

    result = post.to_dict()
    result["comments"] = root_comments

    return jsonify({"post": result}), 200


# ─── PATCH /api/posts/<id>/status ──────────────────────────
@feed_bp.route("/posts/<post_id>/status", methods=["PATCH"])
@auth_required
def update_status(post_id: str):
    """Atualiza o status de um post (pendente → em andamento → resolvido)."""
    data = request.get_json()
    new_status = data.get("status")
    if new_status not in ("pending", "in_progress", "resolved"):
        return jsonify({"error": "Status inválido."}), 400

    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": "Relato não encontrado."}), 404

    post.status = new_status
    db.session.commit()

    return jsonify({"message": "Status atualizado.", "post": post.to_dict()}), 200


# ─── POST /api/posts/<id>/support ──────────────────────────
@feed_bp.route("/posts/<post_id>/support", methods=["POST"])
@auth_required
def toggle_support(post_id: str):
    """
    Alterna apoio (toggle). Se já apoiou, remove. Se não, adiciona.
    """
    user_id = get_current_user_id()
    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": "Relato não encontrado."}), 404

    existing = PostSupport.query.filter_by(user_id=user_id, post_id=post_id).first()

    if existing:
        db.session.delete(existing)
        # Trigger decrementa supports_count automaticamente
        db.session.commit()
        return jsonify({"message": "Apoio removido.", "supported": False, "supportsCount": post.supports_count}), 200
    else:
        support = PostSupport(user_id=user_id, post_id=post_id)
        db.session.add(support)
        # Trigger incrementa supports_count automaticamente
        db.session.commit()
        return jsonify({"message": "Apoiado!", "supported": True, "supportsCount": post.supports_count}), 201


# ─── GET /api/posts/<id>/comments ──────────────────────────
@feed_bp.route("/posts/<post_id>/comments", methods=["GET"])
def list_comments(post_id: str):
    """Lista comentários de um post em estrutura de árvore."""
    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": "Relato não encontrado."}), 404

    all_comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()

    # Montar árvore
    by_id = {}
    roots = []
    for c in all_comments:
        cd = c.to_dict()
        cd["replies"] = []
        by_id[str(c.id)] = cd
        if c.parent_id and str(c.parent_id) in by_id:
            by_id[str(c.parent_id)]["replies"].append(cd)
        else:
            roots.append(cd)

    return jsonify({"comments": roots, "total": len(all_comments)}), 200


# ─── POST /api/posts/<id>/comments ─────────────────────────
@feed_bp.route("/posts/<post_id>/comments", methods=["POST"])
@auth_required
def create_comment(post_id: str):
    """Cria comentário ou resposta em um post."""
    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": "Relato não encontrado."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Corpo vazio."}), 400

    schema = CreateCommentSchema()
    try:
        validated = schema.load(data)
    except ValidationError as err:
        return jsonify({"error": "Dados inválidos.", "details": err.messages}), 422

    user_id = get_current_user_id()
    parent_id = validated.get("parentId")

    # Validar parent pertence ao mesmo post
    if parent_id:
        parent = Comment.query.get(str(parent_id))
        if not parent or str(parent.post_id) != post_id:
            return jsonify({"error": "Comentário pai inválido."}), 400

    comment = Comment(
        post_id=post_id,
        author_id=user_id,
        parent_id=str(parent_id) if parent_id else None,
        content=validated["content"].strip(),
    )
    db.session.add(comment)
    # Trigger incrementa comments_count automaticamente
    db.session.commit()

    return jsonify({"message": "Comentário adicionado.", "comment": comment.to_dict()}), 201
