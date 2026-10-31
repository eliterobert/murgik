import { createHash, randomUUID } from 'node:crypto'
import { createError, getCookie, getHeader, getRequestURL, type H3Event } from 'h3'
import { safeEqual, signature } from './forge-security'
export const ACCESS_COOKIE = 'murgik-access'
export const ACCESS_LIFETIME = 12 * 60 * 60
export interface AccessSession { id: string; expires: number }
// Resolve only on the server at request time: Nuxt loads local dotenv files,
// while Vercel injects these same names at runtime. Never copy them to public config.
export function accessConfiguration(env = process.env) {
  return env.MURGIK_ACCESS_PASSWORD && env.MURGIK_SESSION_SECRET && env.MURGIK_SESSION_SECRET.length >= 32
    ? { password: env.MURGIK_ACCESS_PASSWORD, secret: env.MURGIK_SESSION_SECRET } : null
}
const digest = (value: string) => createHash('sha256').update(value).digest('base64url')
export function passwordMatches(candidate: string, password: string) { return safeEqual(digest(candidate), digest(password)) }
function mac(payload: string, password: string, secret: string) { return signature(`access:${payload}:${digest(password)}`, secret) }
export function issueAccess(password: string, secret: string, now = Date.now()) {
  const session: AccessSession = { id: randomUUID(), expires: now + ACCESS_LIFETIME * 1000 }
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return { session, cookie: `${payload}.${mac(payload, password, secret)}` }
}
export function verifyAccess(cookie: string | undefined, password: string, secret: string, now = Date.now()): AccessSession | null {
  if (!cookie || cookie.length > 512) return null
  const parts = cookie.split('.')
  if (parts.length !== 2 || !safeEqual(parts[1]!, mac(parts[0]!, password, secret))) return null
  try {
    const session = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8')) as AccessSession
    return /^[a-f0-9-]{36}$/.test(session.id) && Number.isSafeInteger(session.expires) && session.expires > now && session.expires <= now + ACCESS_LIFETIME * 1000 + 60_000 ? session : null
  } catch { return null }
}
export const accessCsrf = (session: AccessSession, secret: string) => signature(`access-csrf:${session.id}:${session.expires}`, secret)
export function getAccess(event: H3Event) {
  const config = accessConfiguration()
  return config ? verifyAccess(getCookie(event, ACCESS_COOKIE), config.password, config.secret) : null
}
export function requireAccess(event: H3Event) {
  if (!accessConfiguration()) throw createError({ statusCode: 503, message: 'Privat åtkomst är inte konfigurerad.' })
  const session = getAccess(event)
  if (!session) throw createError({ statusCode: 401, message: 'Logga in för att fortsätta.' })
  return session
}
export function requireSameOrigin(event: H3Event) {
  const expected = process.env.MURGIK_PUBLIC_ORIGIN || getRequestURL(event).origin
  if (getHeader(event, 'origin') !== expected || getHeader(event, 'sec-fetch-site') === 'cross-site') throw createError({ statusCode: 403, message: 'Ogiltigt ursprung.' })
}
export function requireAccessCsrf(event: H3Event) {
  const session = requireAccess(event), config = accessConfiguration()!
  if (!safeEqual(getHeader(event, 'x-murgik-access-csrf') || '', accessCsrf(session, config.secret))) throw createError({ statusCode: 403, message: 'Ladda om sidan och försök igen.' })
  return session
}
/** Explicit opt-out retains the existing public Redis/Turnstile path without changing it. */
export const privateForgeEnabled = () => !!accessConfiguration() && process.env.MURGIK_PRIVATE_FORGE !== 'false'
export function privateForgeMode() {
  return process.env.MURGIK_DEMO === 'true' || !process.env.OPENAI_API_KEY
    ? { mode: 'demo' as const, reason: 'AI är inte aktiverad. Lokalt demoläge används.' }
    : { mode: 'ai' as const }
}
