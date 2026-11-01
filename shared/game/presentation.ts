import type { Action, Card, CardDraft, GameState, Side } from './types'
export interface BattleEvent {
  kind: 'attack' | 'damage' | 'heal' | 'buff' | 'shield' | 'death' | 'summon' | 'spell' | 'block' | 'draw' | 'forge'
  entityId: string
  side: Side
  theme: CardDraft['theme']
  amount?: number
  secondary?: number
  sourceId?: string
  card?: Card
}
/** Presentation is derived from real, resolved snapshots. It never changes or delays rules. */
export function battleEvents(before: GameState, after: GameState, action: Action): BattleEvent[] {
  const events: BattleEvent[] = []
  const played = action.type === 'play' ? before.players[action.side].hand.find(c => c.id === action.cardId) : undefined
  const theme = played?.theme ?? 'gold'
  if (action.type === 'resolve' && before.combat) {
    for (const id of before.combat.attackers) {
      const c = before.players[before.combat.side].board.find(c => c.id === id)
      if (c) events.push({ kind: 'attack', entityId: id, side: before.combat.side, theme: c.theme })
    }
  }
  if (action.type === 'play' && played) events.push({ kind: played.type === 'spell' ? 'spell' : 'summon', entityId: action.targetId ?? (played.type === 'creature' ? played.id : action.side === 'you' ? 'bot' : 'you'), sourceId: played.id, side: action.side, theme, card: played })
  if (action.type === 'block' && action.blockerId) events.push({ kind: 'block', entityId: action.blockerId, side: action.side, theme: 'gold' })
  for (const side of ['you', 'bot'] as const) {
    const old = before.players[side], next = after.players[side]
    const lifeDelta = next.life - old.life
    if (lifeDelta) events.push({ kind: lifeDelta < 0 ? 'damage' : 'heal', entityId: side, side, theme: lifeDelta < 0 ? theme : 'forest', amount: Math.abs(lifeDelta) })
    for (const c of old.board) {
      const survivor = next.board.find(x => x.id === c.id)
      if (!survivor) {
        events.push({ kind: 'death', entityId: c.id, side, theme: c.theme, card: c })
        const dead = next.graveyard.find(x => x.id === c.id)
        if (dead && 'currentHealth' in dead) events.push({ kind: 'damage', entityId: c.id, side, theme, amount: c.currentHealth })
      } else {
        const attackGain = survivor.attack - c.attack, healthGain = survivor.maxHealth - c.maxHealth
        if (attackGain > 0 || healthGain > 0) events.push({ kind:'buff', entityId:c.id, side, theme:'forest', amount:attackGain, secondary:healthGain })
        const delta = survivor.currentHealth - c.currentHealth - Math.max(0, healthGain)
        if (delta) events.push({ kind: delta < 0 ? 'damage' : 'heal', entityId: c.id, side, theme: delta < 0 ? theme : 'forest', amount: Math.abs(delta) })
        if (c.shield !== survivor.shield) events.push({ kind: 'shield', entityId: c.id, side, theme: 'gold' })
      }
    }
    for (const c of next.hand) if (!old.hand.some(x => x.id === c.id)) events.push({ kind: action.type === 'forge' ? 'forge' : 'draw', entityId: c.id, side, theme: c.theme })
  }
  return events
}
