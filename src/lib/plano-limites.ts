export const LIMITES = {
  trial:      { profissionais: 1, servicos: 5,    clientes: 10,   agendamentos_mes: 20  },
  starter:    { profissionais: 1, servicos: 9999, clientes: 9999, agendamentos_mes: 50  },
  pro:        { profissionais: 5, servicos: 9999, clientes: 9999, agendamentos_mes: 500 },
  enterprise: { profissionais: 99, servicos: 9999, clientes: 9999, agendamentos_mes: 9999 },
}

export type Plano = keyof typeof LIMITES

// E-mail do administrador com acesso total ao sistema, independente do plano
export const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL
}

// Retorna o plano "efetivo" — admin sempre tem acesso enterprise
export function getEffectivePlan(plano: string, userEmail?: string | null): string {
  if (isAdminEmail(userEmail)) return 'enterprise'
  return plano
}

export function getLimite(plano: string, recurso: keyof typeof LIMITES.trial, userEmail?: string | null): number {
  const effectivePlano = getEffectivePlan(plano, userEmail)
  const p = (effectivePlano as Plano) in LIMITES ? (effectivePlano as Plano) : 'trial'
  return LIMITES[p][recurso]
}
