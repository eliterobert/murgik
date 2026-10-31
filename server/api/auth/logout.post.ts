import { ACCESS_COOKIE, getAccess, requireAccessCsrf, requireSameOrigin } from '../../utils/access'
export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  requireSameOrigin(event)
  if (getAccess(event)) requireAccessCsrf(event)
  deleteCookie(event, ACCESS_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || getRequestURL(event).protocol === 'https:', sameSite: 'strict', path: '/' })
  return { authenticated: false }
})
