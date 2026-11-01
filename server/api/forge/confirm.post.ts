import { accessConfiguration, requireAccessCsrf, requireSameOrigin } from '../../utils/access'
import { confirmForgeDraft } from '../../utils/forge-draft'
import { CARD_NAME_HELP } from '../../../shared/game/card-name'

export default defineEventHandler(async event=>{
  setResponseHeader(event,'Cache-Control','private, no-store')
  requireSameOrigin(event)
  const access=requireAccessCsrf(event)
  if(!/^application\/json(?:;|$)/i.test(getHeader(event,'content-type')||''))throw createError({statusCode:415,statusMessage:'JSON krävs.'})
  if(Number(getHeader(event,'content-length')||0)>8192)throw createError({statusCode:413,statusMessage:'För stor förfrågan.'})
  const chunks:Buffer[]=[];let bytes=0
  for await(const chunk of event.node.req){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buffer.length;if(bytes>8192)throw createError({statusCode:413,statusMessage:'För stor förfrågan.'});chunks.push(buffer)}
  try {
    const card=confirmForgeDraft(JSON.parse(Buffer.concat(chunks).toString('utf8')),access.id,accessConfiguration()!.secret)
    return {card}
  }catch{throw createError({statusCode:400,statusMessage:`Kontrollera namnet och förhandsvisningen. ${CARD_NAME_HELP} En förhandsvisning gäller i 30 minuter och för samma inloggning och match.`})}
})
