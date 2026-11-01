import { balanceCard } from './balance'
import type { CardDraft } from './types'

/** Offline UI exercise only. It deliberately does not interpret free text. */
export function demoForge(_description?: string) {
  const card: CardDraft = {
    name: 'Övningskort', type: 'creature', cost: 2, attack: 1, health: 1,
    keywords: ['haste'], effects: [], theme: 'gold',
    flavor: 'Ett neutralt övningskort för att prova smedjans flöde.',
    artPrompt: ''
  }
  const balanced = balanceCard(card, { preserveMechanics: true })
  return { ...balanced, adjustments: [
    'Demoläge: ett fast övningskort visas. Din beskrivning tolkas inte utan AI.',
    ...balanced.adjustments
  ] }
}
