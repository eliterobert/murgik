import { describe, expect, it } from 'vitest'
import { act, availableAttackers, canAttack, createGame, invariant, isPreparationTurn } from '../shared/game/engine'
import { botAction } from '../shared/game/bot'
import { catalog } from '../shared/game/catalog'
import { other } from '../shared/game/types'
import type { Creature, GameState, Side } from '../shared/game/types'

function unit(overrides: Partial<Creature> = {}): Creature {
  return { ...catalog[0]!, id: 'attacker', forged: false, currentHealth: 2, maxHealth: 2, ready: true, stunned: false, shield: false, ...overrides }
}
function main(turn = 1, side: Side = 'you'): GameState {
  const s = createGame('turn-flow', 42)
  s.turn = turn; s.active = side; s.phase = 'main'
  return s
}
function next(s: GameState): GameState {
  const result = act(s, { type: 'next', side: s.active })
  expect(result.error).toBeUndefined()
  return result.state
}

describe('preparation and smart turn flow', () => {
  it.each(['you', 'bot'] as const)('blocks every attack on %s’s preparation turn, including Haste and forced combat phase', side => {
    const s = main(side === 'you' ? 1 : 2, side)
    s.players[side].board = [unit({ keywords: ['haste'] })]
    expect(canAttack(s.players[side].board[0]!)).toBe(true)
    expect(isPreparationTurn(s)).toBe(true)
    expect(availableAttackers(s, side)).toEqual([])
    for (const phase of ['main', 'combat'] as const) {
      s.phase = phase
      const result = act(s, { type: 'attack', side, attackers: ['attacker'] })
      expect(result.error).toMatch(/tredje turen/)
      expect(result.state).toBe(s)
      expect(botAction(s, side).type).not.toBe('attack')
    }
  })

  it('plays cards and spends mana during both preparation turns, then refreshes the first player on turn three', () => {
    let s = main()
    for (const side of ['you', 'bot'] as const) {
      expect(s.active).toBe(side); expect(s.phase).toBe('main')
      const card = { ...catalog[0]!, id: s.players[side].hand[0]!.id, forged: false }
      s.players[side].hand[0] = card
      const played = act(s, { type: 'play', side, cardId: card.id })
      expect(played.error).toBeUndefined(); s = played.state
      expect(s.players[side].board[0]!.id).toBe(card.id)
      expect(s.players[side].mana).toBe(0)
      s = next(s)
      expect(s.active).toBe(other(side)); expect(s.phase).toBe('draw'); expect(s.combat).toBeNull()
      s = next(s)
    }
    expect(s.turn).toBe(3); expect(s.active).toBe('you'); expect(isPreparationTurn(s)).toBe(false)
    expect(s.players.you).toMatchObject({ maxMana: 2, mana: 2 })
    expect(availableAttackers(s, 'you').map(c => c.id)).toEqual([s.players.you.board[0]!.id])
    expect(s.players.bot.board[0]!.ready).toBe(false)
    s = next(s); expect(s.phase).toBe('combat')
    expect(act(s, { type: 'attack', side: 'you', attackers: [s.players.you.board[0]!.id] }).error).toBeUndefined()
  })

  it.each(['you', 'bot'] as const)('allows %s to attack after preparation and still permits declining an attack', side => {
    let s = main(side === 'you' ? 3 : 4, side)
    s.players[side].hand = []; s.players[side].board = [unit()]; s.players[other(side)].board = []
    expect(availableAttackers(s, other(side))).toEqual([])
    s = next(s); expect(s.phase).toBe('combat')
    expect(botAction(s, side)).toEqual({ type: 'attack', side, attackers: ['attacker'] })
    expect(act(s, { type: 'attack', side, attackers: ['attacker'] }).error).toBeUndefined()
    s = next(s); expect(s.phase).toBe('end'); expect(s.players[other(side)].life).toBe(20)
    s = next(s); expect(s.active).toBe(other(side)); expect(s.phase).toBe('draw')
  })

  it.each([
    { name: 'empty board', board: [] },
    { name: 'summoning sickness', board: [unit({ ready: false })] },
    { name: 'stunned creature', board: [unit({ stunned: true })] },
    { name: 'zero attack', board: [unit({ attack: 0 })] }
  ])('ends directly from main with $name for either player', ({ board }) => {
    for (const side of ['you', 'bot'] as const) {
      const s = main(side === 'you' ? 3 : 4, side)
      s.players[side].hand = []; s.players[side].board = structuredClone(board)
      expect(availableAttackers(s, side)).toEqual([])
      const result = next(s)
      expect(result).toMatchObject({ active: other(side), phase: 'draw', turn: s.turn + 1, combat: null })
      const decision = botAction(s, side)
      expect(decision.type).toBe('next')
      expect(act(s, decision).state).toEqual(result)
    }
  })

  it('Haste enables combat on turn three while newly played ordinary creatures still wait', () => {
    for (const haste of [false, true]) {
      const s = main(3); s.players.you.mana = 10
      const card = { ...catalog[0]!, id: 'new-unit', forged: false, keywords: haste ? ['haste' as const] : [] }
      s.players.you.hand = [card]
      const played = act(s, { type: 'play', side: 'you', cardId: card.id }).state
      expect(availableAttackers(played).length).toBe(haste ? 1 : 0)
      expect(next(played).phase).toBe(haste ? 'combat' : 'draw')
    }
  })

  it('completes a match with both players following preparation, attacking and defending', () => {
    let s = createGame('complete-preparation-match', 91, { deck: 'aggro', botDeck: 'defense' }), steps = 0, blocks = 0
    const attacks = new Set<Side>(), preparation = new Set<Side>()
    while (!s.winner && steps++ < 1500) {
      const side = s.combat ? other(s.combat.side) : s.active
      const action = botAction(s, side)
      if (isPreparationTurn(s)) { preparation.add(side); expect(s.phase).not.toBe('combat'); expect(action.type).not.toBe('attack') }
      if (action.type === 'attack') { expect(s.turn).toBeGreaterThanOrEqual(3); attacks.add(side) }
      if (action.type === 'block') blocks++
      const result = act(s, action)
      expect(result.error).toBeUndefined(); s = result.state; expect(invariant(s)).toBe(true)
    }
    expect([...preparation].sort()).toEqual(['bot', 'you'])
    expect([...attacks].sort()).toEqual(['bot', 'you']); expect(blocks).toBeGreaterThan(0)
    expect(s.winner).toBeTruthy(); expect(steps).toBeLessThan(1500)
  })
})
