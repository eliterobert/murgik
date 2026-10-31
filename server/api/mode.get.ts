import { aiConfiguration, csrfToken, newSession, readSession } from '../utils/forge-security'
import { QuotaStore, redisRest } from '../utils/quota-store'
import { accessConfiguration, accessCsrf, privateForgeEnabled, privateForgeMode, requireAccess } from '../utils/access'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const access = requireAccess(event)
  if (privateForgeEnabled()) return { ...privateForgeMode(), images: false, privateForge: true, accessCsrf: accessCsrf(access, accessConfiguration()!.secret) }
  const config = aiConfiguration()
  if (config.reason) return { mode: 'demo' as const, images: false, reason: config.reason }
  let sid = readSession(getCookie(event, 'murgik-session'), config.secret!)
  if (!sid) {
    const session = newSession(config.secret!); sid = session.id
    setCookie(event, 'murgik-session', session.cookie, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 365 * 86400 })
  }
  try {
    const quota = await new QuotaStore(redisRest(config.url!, config.token!)).status(sid)
    if (!quota.globalRemaining || !quota.sessionRemaining) return { mode: 'demo' as const, images: false, quota, reason: 'AI-kvoten är slut. Lokalt demoläge används.' }
    return { mode: 'ai' as const, images: false, csrf: csrfToken(sid, config.secret!), siteKey: config.siteKey, quota }
  } catch { return { mode: 'demo' as const, images: false, reason: 'AI:s kostnadsskydd är otillgängligt. Lokalt demoläge används.' } }
})
