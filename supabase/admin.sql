-- Define a conta do administrador como plano Enterprise (acesso total)
UPDATE organizations
SET plan = 'enterprise'
WHERE id = (
  SELECT org_id FROM profiles WHERE email = 'bkpimenta81@gmail.com'
);

SELECT o.name, o.plan, p.email
FROM organizations o
JOIN profiles p ON p.org_id = o.id
WHERE p.email = 'bkpimenta81@gmail.com';
