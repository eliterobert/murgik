import { cardSchema } from './schema'
import { cardNameSchema } from './card-name'
import type { CardDraft, Effect, Target } from './types'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))
const targets: Record<Effect['kind'], Target[]> = {
  damage: ['enemy', 'enemyCreature', 'opponent', 'player'], damageAll: ['allEnemies'],
  healPlayer: ['player'], healCreature: ['allyCreature', 'allAllies'], draw: ['none'], summon: ['none'],
  buff: ['self', 'allyCreature', 'allAllies'], shield: ['self', 'allyCreature', 'allAllies'],
  destroyDamaged: ['enemyCreature'], stun: ['enemyCreature'], gainMana: ['none']
}
function effectPower(e: Effect): number {
  switch (e.kind) {
    case 'damage': return e.target === 'player' ? 0 : e.amount * 0.8
    case 'damageAll': return e.amount * (e.filter === 'flying' ? 1.1 : 1.8)
    case 'healPlayer': return e.amount * 0.4
    case 'healCreature': return e.amount * (e.target === 'allAllies' ? 1.2 : 0.4)
    case 'draw': return e.amount * 1.6
    case 'summon': return e.amount * 1.7
    case 'buff': return (e.amount + e.secondary) * (e.target === 'allAllies' ? 1.5 : 0.65)
    case 'shield': return e.target === 'allAllies' ? 3.5 : 1.2
    case 'destroyDamaged': return 2.8
    case 'stun': return 1.3
    case 'gainMana': return e.amount * 1.5
  }
}
export function powerCost(card: CardDraft): number {
  const body = card.type === 'creature' ? (card.attack + card.health) * 0.43 : 0
  const keywords = card.keywords.reduce((n, k) => n + ({ flying: 1.1, guard: 0.6, haste: 1, lifesteal: 1.2, enrage: 1.5 }[k]), 0)
  return clamp(Math.ceil(body + keywords + card.effects.reduce((n, e) => n + effectPower(e), 0)), 1, 99)
}
export function balanceCard(input: unknown, options: { preserveMechanics?: boolean } = {}): { card: CardDraft; adjustments: string[] } {
  const parsed = cardSchema.parse(input)
  const card: CardDraft = structuredClone(parsed)
  card.name = cardNameSchema.parse(card.name)
  const adjustments: string[] = []
  card.attack = card.type === 'creature' ? clamp(card.attack, 0, 10) : 0
  card.health = card.type === 'creature' ? clamp(card.health, 1, 10) : 0
  const keywords = [...new Set(card.keywords)]
  if (options.preserveMechanics && keywords.includes('enrage')) keywords.sort((a, b) => Number(b === 'enrage') - Number(a === 'enrage'))
  card.keywords = card.type === 'creature' ? keywords.slice(0, 2) : []
  if (card.keywords.includes('enrage')) card.health = Math.max(2, card.health)
  let chosen: 'enemy' | 'ally' | null = null
  card.effects = card.effects.map((e) => {
    const copy = { ...e }
    if (!targets[e.kind].includes(e.target)) copy.target = targets[e.kind][0]!
    if (card.type === 'spell' && copy.target === 'self') copy.target = 'allyCreature'
    copy.amount = clamp(e.amount, 1, ({ damage: 4, damageAll: 2, healPlayer: 6, healCreature: 5, draw: 2, summon: 2, buff: 3, shield: 1, destroyDamaged: 1, stun: 1, gainMana: 2 })[e.kind])
    copy.secondary = e.kind === 'buff' ? clamp(e.secondary, 0, 3) : 0
    if (e.kind !== 'damageAll') copy.filter = 'any'
    return copy
  }).filter((e) => {
    const group = ['enemy', 'enemyCreature'].includes(e.target) ? 'enemy' : e.target === 'allyCreature' ? 'ally' : null
    if (group && chosen && group !== chosen) { adjustments.push('Effekter med oförenliga mål togs bort.'); return false }
    if (group) chosen = group
    return true
  })
  // Shrink over-budget cards until their actual power fits ten mana. Never merely cap the price.
  for (let i = 0; powerCost(card) > 10 && i < 40; i++) {
    if (options.preserveMechanics && card.attack > 1) card.attack--
    else if (options.preserveMechanics && card.health > (card.keywords.includes('enrage') ? 2 : 1)) card.health--
    else if (card.effects.length) {
      const strongest = [...card.effects].sort((a, b) => effectPower(b) - effectPower(a))[0]!
      if (strongest.amount > 1) strongest.amount--
      else if (strongest.kind === 'buff' && strongest.secondary > 0) strongest.secondary--
      else if (options.preserveMechanics && card.keywords.some(k => k !== 'enrage')) card.keywords.splice(card.keywords.findLastIndex(k => k !== 'enrage'), 1)
      else card.effects.splice(card.effects.indexOf(strongest), 1)
    } else if (card.attack > 1) card.attack--
    else if (card.health > 1) card.health--
    else card.keywords.pop()
  }
  // Zero-output spells still have an implemented, useful effect.
  if (card.type === 'spell' && !card.effects.length) card.effects = [{ kind: 'draw', target: 'none', amount: 1, secondary: 0, filter: 'any' }]
  card.cost = clamp(powerCost(card), 1, 10)
  if (card.effects.length < parsed.effects.length) adjustments.push('Någon önskad effekt kunde inte behållas med giltiga mål inom tio mana. Läs kortets faktiska effekt innan du spelar det.')
  if (parsed.keywords.some(keyword => !card.keywords.includes(keyword))) adjustments.push('En önskad förmåga togs bort av typ- eller balansreglerna.')
  if (JSON.stringify(parsed) !== JSON.stringify(card)) adjustments.push('Manakostnad, egenskaper och effektstyrka har anpassats till Murgiks balansregler.')
  return { card, adjustments: [...new Set(adjustments)] }
}
