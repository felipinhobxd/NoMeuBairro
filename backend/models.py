"""
Modelos SQLAlchemy — Mapeamento objeto-relacional completo.
Todos os models correspondem ao schema.sql.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, ForeignKey,
    Enum, UniqueConstraint, BigInteger,
)
from sqlalchemy.dialects.postgresql import UUID, BYTEA
from sqlalchemy.orm import relationship, validates
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _utcnow():
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════
# Enums (espelham os ENUMs do PostgreSQL)
# ═══════════════════════════════════════════════════════════
POST_STATUS = ("pending", "in_progress", "resolved")
POST_CATEGORY = ("buraco", "iluminacao", "fios", "limpeza", "transporte", "seguranca", "outros")
BUSINESS_CATEGORY = ("alimentacao", "saude", "servicos", "educacao", "comercio", "beleza", "outros")
EVENT_TYPE = ("feira", "saude", "reuniao", "cultura", "esporte", "campanha", "outros")
BADGE_TYPE = ("vizinho_engajado", "guardiao", "voz_ativa", "construtor", "embaixador")
REPORT_TYPE = ("abuso", "assedio", "violencia_domestica", "exploracao",
               "discriminacao", "crime_ambiental", "corrupcao", "outros")


# ═══════════════════════════════════════════════════════════
# Model: User
# ═══════════════════════════════════════════════════════════
class User(db.Model):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    reputation = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    posts = relationship("Post", backref="author", lazy="dynamic")
    comments = relationship("Comment", backref="author", lazy="dynamic")
    supports = relationship("PostSupport", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    badges = relationship("Badge", backref="user", lazy="dynamic", cascade="all, delete-orphan")

    @validates("email")
    def validate_email(self, _, value):
        return value.strip().lower()

    def to_dict(self, include_badges=False):
        data = {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "reputation": self.reputation,
            "posts_count": self.posts.count(),
            "supports_received": sum(p.supports_count for p in self.posts),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_badges:
            data["badges"] = [b.to_dict() for b in self.badges]
        return data


# ═══════════════════════════════════════════════════════════
# Model: Post (Relato Comunitário)
# ═══════════════════════════════════════════════════════════
class Post(db.Model):
    __tablename__ = "posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    category = Column(Enum(*POST_CATEGORY, name="post_category_enum"), nullable=False)
    status = Column(Enum(*POST_STATUS, name="post_status_enum"), default="pending", nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(Text)
    location = Column(String(255))
    supports_count = Column(Integer, default=0, nullable=False)
    comments_count = Column(Integer, default=0, nullable=False)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    comments = relationship("Comment", backref="post", lazy="dynamic",
                            order_by="Comment.created_at.asc()")
    supports_rel = relationship("PostSupport", backref="post", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, include_author=True):
        data = {
            "id": str(self.id),
            "authorId": str(self.author_id) if self.author_id else "anonymous",
            "authorName": self._get_author_name() if include_author else None,
            "category": self.category,
            "status": self.status,
            "title": self.title,
            "description": self.description,
            "imageUrl": self.image_url,
            "location": self.location,
            "supports": self.supports_count,
            "commentsCount": self.comments_count,
            "isAnonymous": self.is_anonymous,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
        return data

    def _get_author_name(self):
        if self.is_anonymous:
            return "Denúncia Anônima"
        return self.author.name if self.author else "Usuário removido"


# ═══════════════════════════════════════════════════════════
# Model: PostSupport (Apoio / Curtida)
# ═══════════════════════════════════════════════════════════
class PostSupport(db.Model):
    __tablename__ = "post_supports"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_user_post_support"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ═══════════════════════════════════════════════════════════
# Model: Comment (Encadeado)
# ═══════════════════════════════════════════════════════════
class Comment(db.Model):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    # Self-referential relationship for replies
    replies = relationship("Comment", backref=db.backref("parent", remote_side="Comment.id"), lazy="dynamic")

    @validates("content")
    def validate_content(self, _, value):
        if not value or not value.strip():
            raise ValueError("Comentário não pode estar vazio.")
        return value.strip()

    def to_dict(self):
        return {
            "id": str(self.id),
            "postId": str(self.post_id),
            "authorId": str(self.author_id) if self.author_id else "anonymous",
            "authorName": self.author.name if self.author else "Usuário removido",
            "parentId": str(self.parent_id) if self.parent_id else None,
            "content": self.content,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════
# Model: Business (Negócio Local)
# ═══════════════════════════════════════════════════════════
class Business(db.Model):
    __tablename__ = "businesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(*BUSINESS_CATEGORY, name="business_category_enum"), nullable=False)
    phone = Column(String(20))
    whatsapp = Column(String(20))
    address = Column(String(255))
    image_url = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "phone": self.phone,
            "whatsapp": self.whatsapp,
            "address": self.address,
            "imageUrl": self.image_url,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════
# Model: Event (Evento Comunitário)
# ═══════════════════════════════════════════════════════════
class Event(db.Model):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    event_date = Column(db.Date, nullable=False, index=True)
    location = Column(String(255), nullable=False)
    type = Column(Enum(*EVENT_TYPE, name="event_type_enum"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "date": self.event_date.isoformat() if self.event_date else None,
            "location": self.location,
            "type": self.type,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════
# Model: Badge (Gamificação)
# ═══════════════════════════════════════════════════════════
class Badge(db.Model):
    __tablename__ = "badges"
    __table_args__ = (UniqueConstraint("user_id", "badge", name="uq_user_badge"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge = Column(Enum(*BADGE_TYPE, name="badge_type_enum"), nullable=False)
    awarded_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    BADGE_INFO = {
        "vizinho_engajado": {"name": "Vizinho Engajado", "description": "10 relatos criados", "emoji": "🏅"},
        "guardiao": {"name": "Guardião do Bairro", "description": "25 relatos criados", "emoji": "🛡️"},
        "voz_ativa": {"name": "Voz Ativa", "description": "50 apoios dados", "emoji": "📢"},
        "construtor": {"name": "Construtor", "description": "Primeiro relato resolvido", "emoji": "🏗️"},
        "embaixador": {"name": "Embaixador", "description": "100 interações", "emoji": "⭐"},
    }

    def to_dict(self):
        info = self.BADGE_INFO.get(self.badge, {})
        return {
            "id": str(self.id),
            "name": info.get("name", self.badge),
            "description": info.get("description", ""),
            "emoji": info.get("emoji", "🎖️"),
            "awardedAt": self.awarded_at.isoformat() if self.awarded_at else None,
        }


# ═══════════════════════════════════════════════════════════
# Model: AnonymousReport (Denúncia E2EE)
# ═══════════════════════════════════════════════════════════
class AnonymousReport(db.Model):
    __tablename__ = "anonymous_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type = Column(Enum(*REPORT_TYPE, name="report_type_enum"), nullable=False)
    encrypted_content = Column(BYTEA, nullable=False)
    content_hash = Column(String(64), nullable=False)
    public_key_fingerprint = Column(String(64))
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "reportType": self.report_type,
            "publicKeyFingerprint": self.public_key_fingerprint,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            # encrypted_content NUNCA é exposto via API
        }
