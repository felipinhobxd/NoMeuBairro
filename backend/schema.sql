-- ═══════════════════════════════════════════════════════════════════════
-- NO MEU BAIRRO — SCHEMA COMPLETO, DEFINITIVO E PERFEITO (SUPABASE)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. PREPARAÇÃO DE PERMISSÕES GLOBAIS
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- 2. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. ENUMS (Definições de Tipos)
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
        CREATE TYPE report_type AS ENUM ('abuso', 'assedio', 'violencia_domestica', 'exploracao', 'discriminacao', 'crime_ambiental', 'corrupcao', 'outros');
    END IF;
END $$;

-- 4. TABELAS DO SISTEMA

-- Usuários (Perfis Públicos)
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY, -- ID vinculado ao auth.users
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    avatar_url      TEXT,
    reputation      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Relatos (Posts)
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

-- Apoios (Post Supports)
CREATE TABLE IF NOT EXISTS post_supports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Comentários
CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Negócios (Guia Comercial)
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

-- Avaliações de Negócios
CREATE TABLE IF NOT EXISTS business_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars           INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, user_id)
);

-- Eventos (Mural)
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

-- Presença em Eventos
CREATE TABLE IF NOT EXISTS event_attendance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Selos (Gamificação)
CREATE TABLE IF NOT EXISTS badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge           badge_type NOT NULL,
    awarded_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge)
);

-- Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    type            TEXT NOT NULL, -- 'support' | 'comment'
    post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id      UUID REFERENCES comments(id) ON DELETE CASCADE,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Denúncias de Conteúdo (Moderação)
CREATE TABLE IF NOT EXISTS content_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id      UUID REFERENCES comments(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    status          TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_created ON businesses(created_by);

-- 6. SEGURANÇA (RLS) E PERMISSÕES

-- Ativa RLS em todas as tabelas
DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Permissões globais para os papéis do Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- POLÍTICAS: Users
DROP POLICY IF EXISTS "Profiles are public" ON users;
CREATE POLICY "Profiles are public" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- POLÍTICAS: Posts
DROP POLICY IF EXISTS "Posts are public" ON posts;
CREATE POLICY "Posts are public" ON posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create posts" ON posts;
CREATE POLICY "Anyone can create posts" ON posts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authors can update own posts" ON posts;
CREATE POLICY "Authors can update own posts" ON posts FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can delete own posts" ON posts;
CREATE POLICY "Authors can delete own posts" ON posts FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'fbc66053-d56c-46f7-a92e-ea40062a216c');

-- POLÍTICAS: Comments
DROP POLICY IF EXISTS "Comments are public" ON comments;
CREATE POLICY "Comments are public" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can comment" ON comments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authors can delete own comments" ON comments;
CREATE POLICY "Authors can delete own comments" ON comments FOR DELETE USING (auth.uid() = author_id OR auth.uid() = 'fbc66053-d56c-46f7-a92e-ea40062a216c');

-- POLÍTICAS: Supports
DROP POLICY IF EXISTS "Supports are public" ON post_supports;
CREATE POLICY "Supports are public" ON post_supports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can support" ON post_supports;
CREATE POLICY "Auth users can support" ON post_supports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can delete own support" ON post_supports;
CREATE POLICY "Users can delete own support" ON post_supports FOR DELETE USING (auth.uid() = user_id);

-- POLÍTICAS: Businesses
DROP POLICY IF EXISTS "Businesses are public" ON businesses;
CREATE POLICY "Businesses are public" ON businesses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth users can create businesses" ON businesses;
CREATE POLICY "Auth users can create businesses" ON businesses FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- POLÍTICAS: Notifications
DROP POLICY IF EXISTS "Notifications are private" ON notifications;
CREATE POLICY "Notifications are private" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- POLÍTICAS: Content Reports
DROP POLICY IF EXISTS "Reports are visible to admin" ON content_reports;
CREATE POLICY "Reports are visible to admin" ON content_reports FOR SELECT USING (auth.uid() = 'fbc66053-d56c-46f7-a92e-ea40062a216c');
DROP POLICY IF EXISTS "Anyone can report content" ON content_reports;
CREATE POLICY "Anyone can report content" ON content_reports FOR INSERT WITH CHECK (true);

-- Outras políticas (Shorthand para o restante)
CREATE POLICY "Badges are public" ON badges FOR SELECT USING (true);
CREATE POLICY "Ratings are public" ON business_ratings FOR SELECT USING (true);
CREATE POLICY "Attendance is public" ON event_attendance FOR SELECT USING (true);

-- 7. FUNÇÕES E TRIGGERS

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sincronização de Usuário (Auth -> Public)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'Morador'),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notificações Automáticas
CREATE OR REPLACE FUNCTION handle_new_notification() RETURNS TRIGGER AS $$
DECLARE post_owner_id UUID; v_actor_id UUID;
BEGIN
    IF (TG_TABLE_NAME = 'comments') THEN v_actor_id := NEW.author_id; ELSE v_actor_id := NEW.user_id; END IF;
    SELECT author_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
    IF post_owner_id IS NOT NULL AND post_owner_id != v_actor_id THEN
        INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id)
        VALUES (post_owner_id, v_actor_id, CASE WHEN TG_TABLE_NAME = 'comments' THEN 'comment' ELSE 'support' END, NEW.post_id, CASE WHEN TG_TABLE_NAME = 'comments' THEN NEW.id ELSE NULL END);
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_comment AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION handle_new_notification();
CREATE TRIGGER trg_notify_support AFTER INSERT ON post_supports FOR EACH ROW EXECUTE FUNCTION handle_new_notification();

-- Contadores Automáticos (Recálculo Real)
CREATE OR REPLACE FUNCTION sync_post_counts() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'DELETE') THEN
        UPDATE posts SET
            comments_count = (SELECT count(*) FROM comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)),
            supports_count = (SELECT count(*) FROM post_supports WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
        WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    END IF;
    RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_count_comments AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION sync_post_counts();
CREATE TRIGGER trg_count_supports AFTER INSERT OR DELETE ON post_supports FOR EACH ROW EXECUTE FUNCTION sync_post_counts();
