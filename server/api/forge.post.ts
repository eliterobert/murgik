import { forgeRequestSchema } from '../../shared/game/schema'
import { ForgeError, generateCard } from '../utils/forge-service'
import { aiConfiguration, csrfToken, readSession, safeEqual, signature, verifyChallenge } from '../utils/forge-security'
import { QuotaStore, redisRest } from '../utils/quota-store'
import { publicForge } from '../utils/public-forge'
import { accessConfiguration, privateForgeEnabled, privateForgeMode, requireAccessCsrf } from '../utils/access'
import { issueForgeDraft } from '../utils/forge-draft'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const config = aiConfiguration()
  const origin = getHeader(event, 'origin')
  const expected = process.env.MURGIK_PUBLIC_ORIGIN || config.origin || getRequestURL(event).origin
  if (!origin || origin !== expected || getHeader(event, 'sec-fetch-site') === 'cross-site') throw createError({ statusCode: 403, statusMessage: 'Ogiltigt ursprung.' })
  if (!/^application\/json(?:;|$)/i.test(getHeader(event, 'content-type') || '')) throw createError({ statusCode: 415, statusMessage: 'JSON krävs.' })
  if (Number(getHeader(event, 'content-length') || 0) > 8192) throw createError({ statusCode: 413, statusMessage: 'För stor förfrågan.' })
  // Bound bytes while reading, including chunked requests without Content-Length.
  const chunks: Buffer[] = []; let bytes = 0
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 8192) throw createError({ statusCode: 413, statusMessage: 'För stor förfrågan.' })
    chunks.push(buffer)
  }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw createError({ statusCode: 400, statusMessage: 'Ogiltig JSON.' }) }
  const request = forgeRequestSchema.safeParse(body)
  if (!request.success) throw createError({ statusCode: 400, statusMessage: 'Kontrollera beskrivningen (3–500 tecken) och matchkontexten.' })
  const access = requireAccessCsrf(event)
  try {
    let result
    if (privateForgeEnabled()) {
      const privateMode = privateForgeMode()
      result = { ...await generateCard(request.data, request.data.demo ? 'demo' : privateMode.mode), reason: privateMode.reason }
    }
    else if (config.reason || request.data.demo) result = { ...await generateCard(request.data, 'demo'), reason: config.reason || 'Lokalt demoläge är valt.' }
    else {
      const sid = readSession(getCookie(event, 'murgik-session'), config.secret!)
      const csrf = getHeader(event, 'x-murgik-csrf') || ''
      if (!sid || !safeEqual(csrf, csrfToken(sid, config.secret!))) throw new ForgeError(403, 'Ladda om sidan för att starta en säker demosession.')
      const ip = process.env.VERCEL ? getHeader(event, 'x-vercel-forwarded-for')?.split(',')[0]?.trim() : event.node.req.socket.remoteAddress
      const ipHash = signature(`ip:${ip || 'unknown'}`, config.secret!)
      result = await publicForge(request.data, sid, ipHash, new QuotaStore(redisRest(config.url!, config.token!)), () => verifyChallenge(request.data.challengeToken, config.origin!))
    }
    const draftToken = issueForgeDraft(result.card, request.data.matchId, request.data.requestId, access.id, accessConfiguration()!.secret)
    return { ...result, draftToken, illustration: { status: 'disabled', message: 'Återanvänd originalillustration; motivet kan avvika från din idé.' } }
  } catch (error) {
    if (error instanceof ForgeError) throw createError({ statusCode: error.status, statusMessage: error.message })
    throw createError({ statusCode: 503, statusMessage: 'Smedjan kunde inte bekräfta förfrågan. Inget ytterligare AI-anrop görs.' })
  }
})
