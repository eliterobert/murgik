import { getAccess, accessConfiguration } from '../utils/access'
export default defineEventHandler(event => {
  let path: string
  try { path = decodeURIComponent(getRequestURL(event).pathname).toLowerCase() } catch { throw createError({ statusCode: 400, message: 'Ogiltig adress.' }) }
  if (path === '/') setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!/^\/api(?:\/|$)/.test(path) && !path.startsWith('/__nuxt_island')) return
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (['/api/auth/session', '/api/auth/login', '/api/auth/logout'].includes(path)) return
  if (!accessConfiguration()) throw createError({ statusCode: 503, message: 'Privat åtkomst är inte konfigurerad.' })
  if (!getAccess(event)) throw createError({ statusCode: 401, message: 'Logga in för att fortsätta.' })
})
