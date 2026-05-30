export const LIMITES = {
  trial:      { profissionais: 1, servicos: 5,  clientes: 10,  agendamentos_mes: 20  },
  starter:    { profissionais: 1, servicos: 10, clientes: 50,  agendamentos_mes: 50  },
  pro:        { profissionais: 5, servicos: 50, clientes: 300, agendamentos_mes: 500 },
  enterprise: { profissionais: 99, servicos: 99, clientes: 9999, agendamentos_mes: 9999 },
}
export type Plano = keyof typeof LIMITES
export function getLimite(plano: string, recurso: keyof typeof LIMITES.trial): number {
  const p = (plano as Plano) in LIMITES ? (plano as Plano) : 'trial'
  return LIMITES[p][recurso]
}
