-- ============================================================
-- AGENDAI — SCHEMA COMPLETO DO BANCO DE DADOS
-- ============================================================
-- COMO USAR:
-- 1. Acesse supabase.com > seu projeto > SQL Editor
-- 2. Cole TODO este conteúdo
-- 3. Clique em "Run"
-- Pronto! Todas as tabelas serão criadas automaticamente.
-- ============================================================

-- Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: organizations (empresas/clientes do SaaS)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  phone         TEXT,
  address       TEXT,
  logo_url      TEXT,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: profiles (usuários do painel admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','professional')),
  phone      TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: professionals (profissionais da empresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS professionals (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  specialty  TEXT,
  phone      TEXT,
  email      TEXT,
  bio        TEXT,
  active     BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: services (serviços oferecidos)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  duration_min INTEGER NOT NULL DEFAULT 60,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  active       BOOLEAN DEFAULT TRUE,
  color        TEXT DEFAULT '#00C896',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: customers (clientes das empresas)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, phone)
);

-- ============================================================
-- TABELA: appointments (agendamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  professional_id       UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id            UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes                 TEXT,
  wa_confirmation_sent  BOOLEAN DEFAULT FALSE,
  wa_reminder_24h_sent  BOOLEAN DEFAULT FALSE,
  wa_reminder_1h_sent   BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: availability (horários de trabalho dos profissionais)
-- ============================================================
CREATE TABLE IF NOT EXISTS availability (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  start_time      TIME NOT NULL DEFAULT '08:00',
  end_time        TIME NOT NULL DEFAULT '18:00',
  active          BOOLEAN DEFAULT TRUE,
  UNIQUE(professional_id, weekday)
);

-- ============================================================
-- TABELA: messages_log (histórico de mensagens WhatsApp)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('confirmation','reminder_24h','reminder_1h','cancellation','rescheduling')),
  phone          TEXT NOT NULL,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_org_id      ON appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at   ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status      ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_professional ON appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_id         ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone          ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_professionals_org_id     ON professionals(org_id);
CREATE INDEX IF NOT EXISTS idx_services_org_id          ON services(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_log_status      ON messages_log(status);
CREATE INDEX IF NOT EXISTS idx_messages_log_appointment ON messages_log(appointment_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — isolamento entre empresas
-- ============================================================
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE services       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_log   ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: retorna o org_id do usuário logado
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Políticas: usuário só vê dados da sua própria empresa
CREATE POLICY "org_profiles"      ON profiles      FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_professionals" ON professionals  FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_services"      ON services       FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_customers"     ON customers      FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_appointments"  ON appointments   FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_availability"  ON availability   FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "org_messages_log"  ON messages_log   FOR ALL USING (org_id = get_my_org_id());
CREATE POLICY "own_organization"  ON organizations  FOR ALL USING (
  id = get_my_org_id()
);

-- ============================================================
-- DADOS DE EXEMPLO (opcional — para testar)
-- ============================================================
-- Descomente o bloco abaixo se quiser dados de demonstração

/*
INSERT INTO organizations (name, slug, plan) VALUES
  ('Salão Beleza Real', 'salao-beleza-real', 'pro');

INSERT INTO services (org_id, name, duration_min, price, color)
SELECT id, 'Corte Feminino', 45, 60.00, '#00C896' FROM organizations WHERE slug = 'salao-beleza-real'
UNION ALL
SELECT id, 'Coloração', 120, 150.00, '#7F77DD' FROM organizations WHERE slug = 'salao-beleza-real'
UNION ALL
SELECT id, 'Manicure', 40, 35.00, '#D4537E' FROM organizations WHERE slug = 'salao-beleza-real'
UNION ALL
SELECT id, 'Escova', 40, 45.00, '#378ADD' FROM organizations WHERE slug = 'salao-beleza-real';
*/

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
SELECT 'Banco de dados criado com sucesso! 🎉' AS resultado;
