import { z } from 'zod'
import { cardSchema } from '../../shared/game/schema'
import { cardNameSchema } from '../../shared/game/card-name'
import { safeEqual, signature } from './forge-security'
import type { CardDraft } from '../../shared/game/types'

export const DRAFT_LIFETIME = 30 * 60 * 1000
const draftSchema = z.object({ v:z.literal(1), card:cardSchema, matchId:z.string().uuid(), requestId:z.string().uuid(), accessId:z.string().uuid(), expires:z.number().int() }).strict()
export const confirmForgeSchema = z.object({ token:z.string().min(1).max(6144), matchId:z.string().uuid(), name:cardNameSchema }).strict()

/** Stateless, session-bound receipt. Issued only after the existing quota-protected
 * generation succeeds. Confirmation can change the name, never the mechanics. */
export function issueForgeDraft(card:CardDraft, matchId:string, requestId:string, accessId:string, secret:string, now=Date.now()) {
  const payload=Buffer.from(JSON.stringify(draftSchema.parse({v:1,card,matchId,requestId,accessId,expires:now+DRAFT_LIFETIME}))).toString('base64url')
  return `${payload}.${signature(`forge-draft:${payload}`,secret)}`
}
export function confirmForgeDraft(input:unknown, accessId:string, secret:string, now=Date.now()):CardDraft {
  const request=confirmForgeSchema.parse(input), parts=request.token.split('.')
  if(parts.length!==2 || !safeEqual(parts[1]!,signature(`forge-draft:${parts[0]}`,secret)))throw new Error('Invalid draft')
  const draft=draftSchema.parse(JSON.parse(Buffer.from(parts[0]!,'base64url').toString('utf8')))
  if(draft.accessId!==accessId || draft.matchId!==request.matchId || draft.expires<=now || draft.expires>now+DRAFT_LIFETIME)throw new Error('Expired or mismatched draft')
  return {...draft.card,name:request.name}
}
