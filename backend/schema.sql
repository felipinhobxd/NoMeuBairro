-- ═══════════════════════════════════════════════════════════════════════
-- AQUI NO MEU BAIRRO — Vitória Régia
-- Schema SQL (PostgreSQL 15+) — SUPABASE READY
-- ═══════════════════════════════════════════════════════════════════════

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS (Criação Segura) ───────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
        CREATE TYPE post_status AS ENUM ('pending', 'in_progress', 'resolved');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_category') THEN
        CREATE TYPE post_category AS ENUM ('buraco', 'iluminacao', 'fios', 'limpeza', 'transporte', 'seguranca', 'outros');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_category') THEN
        CREATE TYPE business_category AS ENUM ('alimentacao', 'saude', 'servicos', 'educacao', 'comercio', 'beleza', 'outros');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE event_type AS ENUM ('feira', 'saude', 'reuniao', 'cultura', 'esporte', 'campanha', 'outros');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_type') THEN
        CREATE TYPE badge_type AS ENUM ('vizinho_engajado', 'guardiao', 'voz_ativa', 'construtor', 'embaixador');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
        CREATE TYPE report_type AS ENUM (
            'abuso', 'assedio', 'violencia_domestica', 'exploracao',
            'discriminacao', 'crime_ambiental', 'corrupcao', 'outros'
        );
    END IF;
END $$;

-- ─── TABELA: usuários ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    avatar_url      TEXT,
    password_hash   VARCHAR(255) NOT NULL,
    reputation      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: relatos comunitários ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    category        post_category NOT NULL,
    status          post_status DEFAULT 'pending',
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    image_url       TEXT,
    location        VARCHAR(255),
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    supports_count  INTEGER DEFAULT 0,
    comments_count  INTEGER DEFAULT 0,
    is_anonymous    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: apoios (curtidas) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_supports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- ─── TABELA: comentários (encadeados) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: negócios locais ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    category        business_category NOT NULL,
    phone           VARCHAR(20),
    whatsapp        VARCHAR(20),
    address         VARCHAR(255),
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    image_url       TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: eventos comunitários ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    event_date      DATE NOT NULL,
    location        VARCHAR(255) NOT NULL,
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    type            event_type NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: selos/gamificação ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge           badge_type NOT NULL,
    awarded_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge)
);

-- ─── TABELA: denúncias anônimas (E2EE) ────────────────────────────────
CREATE TABLE IF NOT EXISTS anonymous_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type         report_type NOT NULL,
    encrypted_content   BYTEA NOT NULL,
    content_hash        VARCHAR(64) NOT NULL,
    public_key_fingerprint VARCHAR(64),
    post_id             UUID REFERENCES posts(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- POLÍTICAS DE SEGURANÇA (RLS) - FORÇANDO ATIVAÇÃO
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Limpar políticas antigas para evitar erros de duplicata ao rodar novamente
DROP POLICY IF EXISTS "Profiles are public" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Posts are public" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Authors can update own posts" ON posts;
DROP POLICY IF EXISTS "Authors can delete own posts" ON posts;
DROP POLICY IF EXISTS "Businesses are public" ON businesses;
DROP POLICY IF EXISTS "Users can create businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can delete own businesses" ON businesses;
DROP POLICY IF EXISTS "Events are public" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Owners can update own events" ON events;
DROP POLICY IF EXISTS "Owners can delete own events" ON events;
DROP POLICY IF EXISTS "Comments are public" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Authors can delete own comments" ON comments;
DROP POLICY IF EXISTS "Supports are public" ON post_supports;
DROP POLICY IF EXISTS "Users can support posts" ON post_supports;

-- Criar políticas atualizadas
CREATE POLICY "Profiles are public" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Posts are public" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own posts" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own posts" ON posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Businesses are public" ON businesses FOR SELECT USING (true);
CREATE POLICY "Users can create businesses" ON businesses FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update own businesses" ON businesses FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Owners can delete own businesses" ON businesses FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Events are public" ON events FOR SELECT USING (true);
CREATE POLICY "Users can create events" ON events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update own events" ON events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Owners can delete own events" ON events FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Comments are public" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete own comments" ON comments FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Supports are public" ON post_supports FOR SELECT USING (true);
CREATE POLICY "Users can support posts" ON post_supports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- ÍNDICES (Criação Segura)
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_posts_author      ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category    ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_status      ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created     ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_anonymous   ON posts(is_anonymous) WHERE is_anonymous = TRUE;
CREATE INDEX IF NOT EXISTS idx_comments_post     ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent   ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created  ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supports_post     ON post_supports(post_id);
CREATE INDEX IF NOT EXISTS idx_supports_user     ON post_supports(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_cat    ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_events_date       ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type       ON events(type);
CREATE INDEX IF NOT EXISTS idx_badges_user       ON badges(user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- FUNÇÕES AUXILIARES
-- ═══════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated ON posts;
CREATE TRIGGER trg_posts_updated  BEFORE UPDATE ON posts    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-increment comments_count
CREATE OR REPLACE FUNCTION increment_comments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_insert ON comments;
CREATE TRIGGER trg_comment_insert AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION increment_comments();

-- Auto-increment supports_count
CREATE OR REPLACE FUNCTION increment_supports()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET supports_count = supports_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_insert ON post_supports;
CREATE TRIGGER trg_support_insert AFTER INSERT ON post_supports FOR EACH ROW EXECUTE FUNCTION increment_supports();

-- Auto-decrement supports_count
CREATE OR REPLACE FUNCTION decrement_supports()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET supports_count = GREATEST(supports_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_delete ON post_supports;
CREATE TRIGGER trg_support_delete AFTER DELETE ON post_supports FOR EACH ROW EXECUTE FUNCTION decrement_supports();
