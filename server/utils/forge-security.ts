import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { ForgeError } from './forge-service'
export function aiConfiguration(env = process.env) {
  if (!env.OPENAI_API_KEY?.trim()) return { reason: 'OPENAI_API_KEY saknas på servern. AI kan inte användas.' }
  const upstash = !!(env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN)
  const url = upstash ? env.UPSTASH_REDIS_REST_URL : env.KV_REST_API_URL, token = upstash ? env.UPSTASH_REDIS_REST_TOKEN : env.KV_REST_API_TOKEN
  if (!url || !token || !env.MURGIK_SESSION_SECRET || env.MURGIK_SESSION_SECRET.length < 32) return { reason: 'Publik AI:s kostnadsskydd är inte konfigurerat. Välj övningsläge eller konfigurera skyddet.' }
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY || !env.MURGIK_PUBLIC_ORIGIN) return { reason: 'Publik AI:s åtkomstskydd är inte konfigurerat. Välj övningsläge eller konfigurera skyddet.' }
  try { const origin = new URL(env.MURGIK_PUBLIC_ORIGIN); if (origin.protocol !== 'https:' || origin.origin !== env.MURGIK_PUBLIC_ORIGIN) throw new Error() } catch { return { reason: 'AI:s publika adress är inte konfigurerad. Lokalt demoläge används.' } }
  return { url, token, secret: env.MURGIK_SESSION_SECRET, siteKey: env.TURNSTILE_SITE_KEY, origin: env.MURGIK_PUBLIC_ORIGIN }
}
export const signature = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url')
export function safeEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
export function readSession(cookie: string | undefined, secret: string): string | null {
  if (!cookie || cookie.length > 150) return null
  if (cookie.split('.').length !== 2) return null
  const [id, mac] = cookie.split('.')
  return id && /^[a-f0-9-]{36}$/.test(id) && mac && safeEqual(mac, signature(`session:${id}`, secret)) ? id : null
}
export function newSession(secret: string) { const id = randomUUID(); return { id, cookie: `${id}.${signature(`session:${id}`, secret)}` } }
export const csrfToken = (id: string, secret: string) => signature(`csrf:${id}`, secret)
export async function verifyChallenge(token: string | undefined, origin: string) {
  if (!token || token.length > 2048) throw new ForgeError(403, 'Bekräfta säkerhetskontrollen före AI-smidet.')
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token })
    })
    if (!response.ok) throw new Error()
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string }
    if (!result.success || result.hostname !== new URL(origin).hostname || result.action !== 'murgik-forge') throw new Error()
  } catch { throw new ForgeError(403, 'Säkerhetskontrollen kunde inte bekräftas. Gör om kontrollen.') }
}
