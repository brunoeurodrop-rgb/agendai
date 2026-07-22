CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'appointments', 'new_clients', 'attendance_rate')),
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'weekly')),
  target_value NUMERIC NOT NULL,
  month TEXT NOT NULL, -- formato YYYY-MM
  is_suggestion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, type, month)
);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select" ON goals FOR SELECT TO authenticated USING (org_id = get_my_org_id());
CREATE POLICY "goals_insert" ON goals FOR INSERT TO authenticated WITH CHECK (org_id = get_my_org_id());
CREATE POLICY "goals_update" ON goals FOR UPDATE TO authenticated USING (org_id = get_my_org_id());
CREATE POLICY "goals_delete" ON goals FOR DELETE TO authenticated USING (org_id = get_my_org_id());

SELECT 'Tabela goals criada!' AS resultado;
