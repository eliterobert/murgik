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
export async function generateCard(request: ForgeRequest, mode: 'demo' | 'ai'): Promise<ForgeResponse> {
  if (mode === 'demo') return { ...demoForge(), mode }
  // The secret is only accessed here, after an explicitly requested real-AI Forge.
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ForgeError(503, 'AI är inte konfigurerad. Använd lokalt demoläge.')
  const schema = z.toJSONSchema(forgeOutputSchema)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      store: false,
      max_output_tokens: 1200,
      instructions: forgeInstructions,
      input: JSON.stringify({ description: request.prompt, context: request.context }),
      text: { format: { type: 'json_schema', name: 'murgik_card', strict: true, schema } }
    })
  })
  if (!response.ok) throw new ForgeError(502, response.status === 429 ? 'AI-tjänsten har nått sin gräns. Ingen laddning har förbrukats.' : 'AI-tjänsten kunde inte smida kortet. Ingen laddning har förbrukats.')
  const data = await response.json() as { status: string; output?: { type: string; content?: { type: string; text?: string }[] }[] }
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
