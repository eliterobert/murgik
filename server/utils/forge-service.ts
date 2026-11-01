import { z } from 'zod'
import { forgeRequestSchema } from '../../shared/game/schema'
import { balanceCard } from '../../shared/game/balance'
import { demoForge } from '../../shared/game/forge'
import type { CardDraft } from '../../shared/game/types'
import { forgeInstructions, forgeOutputSchema } from './forge-instructions'

export type ForgeRequest = z.infer<typeof forgeRequestSchema>
export interface ForgeResponse { card: CardDraft; adjustments: string[]; mode: 'demo' | 'ai'; reason?: string; quota?: { sessionRemaining: number; globalRemaining: number } }
export class ForgeError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function generateCard(request: ForgeRequest, mode: 'demo' | 'ai', timeoutMs = 60_000): Promise<ForgeResponse> {
  if (mode === 'demo') return { ...demoForge(), mode }
  // The secret is only accessed here, after an explicitly requested real-AI Forge.
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) throw new ForgeError(503, 'OPENAI_API_KEY saknas på servern. Inget AI-kort har skapats. Övningsläge måste väljas uttryckligen.')
  const schema = z.toJSONSchema(forgeOutputSchema)
  let response: Response
  try { response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4',
      store: false,
      max_output_tokens: 4096,
      instructions: forgeInstructions,
      input: JSON.stringify({ description: request.prompt, context: request.context }),
      text: { format: { type: 'json_schema', name: 'murgik_card', strict: true, schema } }
    })
  }) } catch { throw new ForgeError(502, 'AI-anropet misslyckades eller tog för lång tid. Inget automatiskt återförsök görs och inget övningskort ersätter din idé.') }
  if (!response.ok) throw new ForgeError(502, response.status === 429 ? 'AI-tjänsten har nått sin gräns. Ingen laddning har förbrukats.' : 'AI-tjänsten kunde inte smida kortet. Ingen laddning har förbrukats.')
  let data: { status: string; output?: { type: string; content?: { type: string; text?: string }[] }[] }
  try { data = await response.json() } catch { throw new ForgeError(502, 'AI-tjänsten gav ett ogiltigt svar. Inget automatiskt återförsök görs.') }
  if (data.status !== 'completed') throw new ForgeError(502, 'AI-svaret blev inte färdigt. Försök igen; din laddning finns kvar.')
  const output = data.output?.flatMap(item => item.content ?? []).find(part => part.type === 'output_text')?.text
  if (!output) throw new ForgeError(502, 'AI:n kunde inte skapa detta kort. Prova en annan beskrivning.')
  try {
    const parsed = forgeOutputSchema.parse(JSON.parse(output))
    const balanced = balanceCard(parsed.card, { preserveMechanics: true })
    return { ...balanced, adjustments:[...parsed.adaptations.map(note=>`Tolkning: ${note}`),...balanced.adjustments].slice(0,8), mode }
  }
  catch { throw new ForgeError(502, 'Kortet klarade inte valideringen. Ingen laddning har förbrukats.') }
}
