// Rate limiting simples em memória
// Para produção com múltiplas instâncias, usar Redis

const requests = new Map<string, { count: number; resetAt: number }>()

interface RateLimitOptions {
  windowMs: number  // janela em ms
  max: number       // máximo de requisições na janela
}

export function rateLimit(key: string, options: RateLimitOptions): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = requests.get(key)

  // Limpar entradas expiradas periodicamente
  if (requests.size > 10000) {
    requests.forEach((v, k) => {
      if (v.resetAt < now) requests.delete(k)
    })
  }

  if (!entry || entry.resetAt < now) {
    requests.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: options.max - 1 }
  }

  if (entry.count >= options.max) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: options.max - entry.count }
}

// Limites padrão por tipo de rota
export const LIMITS = {
  // Agendamentos: 30 por hora por IP
  appointments: { windowMs: 60 * 60 * 1000, max: 30 },
  // Login/auth: 10 tentativas por 15 minutos
  auth: { windowMs: 15 * 60 * 1000, max: 10 },
  // API geral: 100 por minuto
  general: { windowMs: 60 * 1000, max: 100 },
  // WhatsApp: 50 por hora
  whatsapp: { windowMs: 60 * 60 * 1000, max: 50 },
  // Cron: 10 por minuto
  cron: { windowMs: 60 * 1000, max: 10 },
}
