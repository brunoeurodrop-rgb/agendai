ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ DEFAULT NULL;

SELECT 'Coluna adicionada!' AS resultado;
