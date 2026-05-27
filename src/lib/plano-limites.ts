// Limites por plano
export const LIMITES = {
  trial:      { profissionais: 1, servicos: 5,  clientes: 20,  agendamentos_mes: 30  },
  starter:    { profissionais: 1, servicos: 10, clientes: 100, agendamentos_mes: 50  },
  pro:        { profissionais: 5, servicos: 50, clientes: 500, agendamentos_mes: 500 },
  enterprise: { profissionais: 99, servicos: 99, clientes: 9999, agendamentos_mes: 9999 },
}

export type Plano = keyof typeof LIMITES

export function getLimite(plano: string, recurso: keyof typeof LIMITES.trial): number {
  const p = (plano as Plano) in LIMITES ? (plano as Plano) : 'trial'
  return LIMITES[p][recurso]
}

export function getLabelLimite(plano: string, recurso: keyof typeof LIMITES.trial): string {
  const limite = getLimite(plano, recurso)
  if (limite >= 99) return 'Ilimitado'
  return String(limite)
}
