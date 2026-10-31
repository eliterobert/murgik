import { generateCard, ForgeError } from './forge-service'
import type { ForgeRequest, ForgeResponse } from './forge-service'
import { QuotaStore, StorageUnavailable } from './quota-store'
// Called only after cookie/CSRF/origin checks. Dependencies are injectable for integration tests.
export async function publicForge(request: ForgeRequest, sid: string, ipHash: string, store: QuotaStore, challenge: () => Promise<void>, generate = generateCard): Promise<ForgeResponse> {
  try {
    await store.rate(sid, ipHash)
    const cached = await store.lookup(sid, request)
    if (cached) return cached
    const quota = await store.status(sid)
    if (!quota.globalRemaining || !quota.sessionRemaining) return { ...await generate(request, 'demo'), quota, reason: 'AI-kvoten är slut. Kortet skapas i lokalt demoläge.' }
  } catch (error) {
    if (!(error instanceof StorageUnavailable)) throw error
    return { ...await generate(request, 'demo'), reason: 'AI:s kostnadsskydd är otillgängligt. Kortet skapas i lokalt demoläge.' }
  }
  await challenge()
  try {
    const cached = await store.reserve(sid, request)
    if (cached) return cached
  } catch (error) {
    if (error instanceof StorageUnavailable) throw new ForgeError(503, 'AI-reservationen kunde inte bekräftas. Inget nytt AI-anrop görs. Försök igen med samma beskrivning.')
    throw error
  }
  let response: ForgeResponse
  try { response = await generate(request, 'ai') }
  catch (error) {
    try { await store.finish(sid, request, null) } catch { /* Reservation remains spent; never refund an API attempt. */ }
    if (error instanceof ForgeError) throw error
    throw new ForgeError(502, 'AI-smidet misslyckades. Ingen smidesladdning förbrukades, men API-försöket räknas.')
  }
  try {
    await store.finish(sid, request, response)
    return { ...response, quota: await store.status(sid) }
  } catch {
    throw new ForgeError(503, 'Kortets kvittens kunde inte bekräftas. Försök igen med samma beskrivning; AI-anropet upprepas inte.')
  }
}
