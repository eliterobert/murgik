import { z } from 'zod'
import { ACCESS_COOKIE, ACCESS_LIFETIME, accessConfiguration, issueAccess, passwordMatches, requireSameOrigin } from '../../utils/access'
const loginSchema = z.object({ password: z.string().min(1).max(512) }).strict()
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  requireSameOrigin(event)
  const config = accessConfiguration()
  if (!config) throw createError({ statusCode: 503, message: 'Privat åtkomst är inte konfigurerad.' })
  if (!/^application\/json(?:;|$)/i.test(getHeader(event, 'content-type') || '')) throw createError({ statusCode: 415, message: 'JSON krävs.' })
  if (Number(getHeader(event, 'content-length') || 0) > 4096) throw createError({ statusCode: 413, message: 'För stor förfrågan.' })
  const chunks: Buffer[] = []; let bytes = 0
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); bytes += buffer.length
    if (bytes > 4096) throw createError({ statusCode: 413, message: 'För stor förfrågan.' })
    chunks.push(buffer)
  }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw createError({ statusCode: 400, message: 'Ogiltig förfrågan.' }) }
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Ange lösenordet.' })
  if (!passwordMatches(parsed.data.password, config.password)) throw createError({ statusCode: 401, message: 'Fel lösenord. Försök igen.' })
  const { cookie } = issueAccess(config.password, config.secret)
  setCookie(event, ACCESS_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || getRequestURL(event).protocol === 'https:', sameSite: 'strict', path: '/', maxAge: ACCESS_LIFETIME })
  return { authenticated: true }
})
