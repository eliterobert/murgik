import { availableAttackers, canBlock, canPlay, validTargets } from './engine'
import type { Action, GameState, Side } from './types'
import { other } from './types'

/** One bounded decision per step. Also powers the complete-game simulation tests. */
export function botAction(s: GameState, side: Side = 'bot'): Action {
  const p = s.players[side], enemy = s.players[other(side)]
  if (s.combat && s.combat.side !== side) {
    const blocks: Record<string, string> = {}
    for (const id of [...s.combat.attackers].sort((a, b) => (enemy.board.find(c => c.id === b)?.attack ?? 0) - (enemy.board.find(c => c.id === a)?.attack ?? 0))) {
      const a = enemy.board.find(c => c.id === id)!
      const candidates = p.board.filter(b => canBlock(a, b) && !Object.values(blocks).includes(b.id))
      candidates.sort((a, b) => (b.keywords.includes('guard') ? 10 : 0) - (a.keywords.includes('guard') ? 10 : 0) || a.attack - b.attack)
      const b = candidates.find(b => b.keywords.includes('guard') || b.attack >= a.currentHealth || b.currentHealth > a.attack || p.life <= a.attack + 4)
      if (b) blocks[id] = b.id
    }
    for (const [attackerId, blockerId] of Object.entries(blocks)) {
      if (s.combat.blocks[attackerId] !== blockerId) return { type: 'block', side, attackerId, blockerId }
    }
    return { type: 'resolve', side }
  }
  if (s.phase === 'main') {
    const cards = p.hand.filter(c => canPlay(s, side, c) && c.effects.filter(e => e.kind === 'damage' && e.target === 'player').reduce((total,e) => total+e.amount,0) < p.life).sort((a, b) => {
      const score = (c: typeof a) => c.cost + (c.type === 'creature' ? 2 : 0) - (c.effects.some(e => e.kind === 'healPlayer') && p.life > 15 ? 10 : 0)
      return score(b) - score(a)
    })
    for (const card of cards) {
      const targets = validTargets(s, side, card)
      targets.sort((a, b) => {
        const priority = (id: string) => {
          if (id === other(side)) return card.effects.some(e => e.kind === 'damage' && e.amount >= enemy.life) ? 100 : 0
          const c = enemy.board.find(c => c.id === id)
          if (c) return c.attack + (card.effects.some(e => e.kind === 'damage' && e.amount >= c.currentHealth) ? 10 : 0)
          const ally = p.board.find(c => c.id === id)
          return ally ? ally.attack + ally.maxHealth - ally.currentHealth : 0
        }
        return priority(b) - priority(a)
      })
      return { type: 'play', side, cardId: card.id, targetId: targets[0] }
    }
  }
  if (s.phase === 'combat') {
    const attackers = availableAttackers(s, side).filter(a => {
      const blockers = enemy.board.filter(b => canBlock(a, b))
      return !blockers.length || enemy.life <= a.attack || blockers.every(b => a.attack >= b.currentHealth || a.currentHealth > b.attack)
    }).map(c => c.id)
    if (attackers.length) return { type: 'attack', side, attackers }
  }
  return { type: 'next', side }
}
