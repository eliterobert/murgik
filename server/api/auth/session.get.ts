import { accessConfiguration, accessCsrf, getAccess, privateForgeEnabled } from '../../utils/access'
export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = accessConfiguration(), session = getAccess(event)
  return { configured: !!config, authenticated: !!session, csrf: session && config ? accessCsrf(session, config.secret) : undefined, privateForge: privateForgeEnabled() }
})
