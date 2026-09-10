// Sanitização de inputs para prevenir XSS e injeções

export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // remove < e > para prevenir XSS básico
}

export function sanitizePhone(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[^\d\s\-\(\)\+]/g, '').trim().slice(0, 20)
}

export function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return ''
  const email = value.trim().toLowerCase().slice(0, 254)
  // Validação básica de formato
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ''
  return email
}

export function sanitizeNumber(value: unknown, min = 0, max = 999999): number | null {
  const n = Number(value)
  if (isNaN(n)) return null
  if (n < min || n > max) return null
  return n
}

export function sanitizeDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  // Aceitar apenas formato ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return value.slice(0, 30) // limitar tamanho
}
