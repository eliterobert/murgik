import { createHash } from 'node:crypto'
import { ACTIVE, LEDGER, STATUS, LOOKUP, RESERVE, FINISH, RATE } from './quota-scripts'
import { ForgeError } from './forge-service'
import type { ForgeRequest, ForgeResponse } from './forge-service'
import { cardSchema } from '../../shared/game/schema'
export type RedisCommand = (command: (string | number)[]) => Promise<unknown>
export class StorageUnavailable extends Error { constructor() { super('Persistent storage unavailable') } }
export function redisRest(url: string, token: string): RedisCommand {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new StorageUnavailable()
  return async command => {
    try {
      const response = await fetch(parsed, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
      if (!response.ok) throw new StorageUnavailable()
      const text = await response.text()
      if (text.length > 64_000) throw new StorageUnavailable()
      const data = JSON.parse(text)
      if (data.error || !('result' in data)) throw new StorageUnavailable()
      return data.result
    } catch { throw new StorageUnavailable() }
  }
}
export const fingerprint = (request: ForgeRequest) => createHash('sha256').update(JSON.stringify({ matchId: request.matchId, prompt: request.prompt, context: request.context })).digest('hex')
export class QuotaStore {
  constructor(private command: RedisCommand) {}
  private async eval(script: string, keys: string[], args: string[] = []): Promise<string[]> {
    try {
      const result = await this.command(['EVAL', script, keys.length, ...keys, ...args])
      if (!Array.isArray(result) || !result.length || result.some(v => typeof v !== 'string') || result[0] === 'unavailable') throw new StorageUnavailable()
      return result as string[]
    } catch { throw new StorageUnavailable() }
  }
  async status(sid: string) {
    const result = await this.eval(STATUS, [LEDGER], [sid])
    const globalRemaining = Number(result[1]), sessionRemaining = Number(result[2])
    if (result[0] !== 'ok' || !Number.isInteger(globalRemaining) || globalRemaining < 0 || globalRemaining > 50 || !Number.isInteger(sessionRemaining) || sessionRemaining < 0 || sessionRemaining > 10) throw new StorageUnavailable()
    return { globalRemaining, sessionRemaining }
  }
  private interpret(result: string[]): ForgeResponse | null {
    if (result[0] === 'new' || result[0] === 'reserved' || result[0] === 'ok') return null
    if (result[0] === 'cached') {
      try {
        const stored = JSON.parse(result[1]!)
        if (stored.mode !== 'ai' || !Array.isArray(stored.adjustments) || stored.adjustments.length > 8 || stored.adjustments.some((text: unknown) => typeof text !== 'string' || text.length > 512)) throw new StorageUnavailable()
        return { card: cardSchema.parse(stored.card), adjustments: stored.adjustments, mode: 'ai' }
      } catch { throw new StorageUnavailable() }
    }
    const messages: Record<string, string> = {
      conflict: 'Förfrågans ID har redan använts med annat innehåll.', pending: 'Kortet behandlas redan. Samma förfrågan skickas aldrig till AI två gånger.',
      failed: 'Detta AI-försök misslyckades. Skicka en ny beskrivning för ett nytt försök.', busy: 'Smedjan är upptagen. Vänta en stund.',
      expired: 'Det tidigare försöket kunde inte slutföras. Beskriv ett nytt kort. Det gamla API-försöket räknas fortfarande.',
      session_limit: 'Demosessionens tio AI-kort är använda. Lokalt demoläge finns kvar.', global_limit: 'POC:ens 50 AI-försök är använda. Lokalt demoläge finns kvar.',
      match_limit: 'Alla tre smidesladdningar är använda.', rate_limit: 'För många försök. Vänta en minut.'
    }
    if (!messages[result[0]!]) throw new StorageUnavailable()
    throw new ForgeError(['rate_limit', 'session_limit', 'global_limit'].includes(result[0]!) ? 429 : ['failed', 'conflict', 'expired'].includes(result[0]!) ? 422 : 409, messages[result[0]!]!)
  }
  async rate(sid: string, ipHash: string) { this.interpret(await this.eval(RATE, [`murgik:poc:v1:rate:s:${sid}`, `murgik:poc:v1:rate:ip:${ipHash}`])) }
  async lookup(sid: string, request: ForgeRequest) { return this.interpret(await this.eval(LOOKUP, [LEDGER], [sid, request.requestId, fingerprint(request)])) }
  async reserve(sid: string, request: ForgeRequest) { return this.interpret(await this.eval(RESERVE, [LEDGER, ACTIVE], [sid, request.requestId, fingerprint(request), request.matchId])) }
  async finish(sid: string, request: ForgeRequest, response: ForgeResponse | null) {
    this.interpret(await this.eval(FINISH, [LEDGER, ACTIVE], [sid, request.requestId, fingerprint(request), response ? 'done' : 'failed', response ? JSON.stringify(response) : '']))
  }
}
