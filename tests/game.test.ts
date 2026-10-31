import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { act, canAttack, canPlay, createGame, invariant, validTargets } from '../shared/game/engine'
import { botAction } from '../shared/game/bot'
import { balanceCard, powerCost } from '../shared/game/balance'
import { catalog, effect } from '../shared/game/catalog'
import { demoForge } from '../shared/game/forge'
import { cardSchema, forgeRequestSchema } from '../shared/game/schema'
import type { Action, Card, CardDraft, Creature, GameState, Side } from '../shared/game/types'

function main(): GameState { return act(createGame('test', 42), { type: 'next', side: 'you' }).state }
function unit(id: string, overrides: Partial<Creature> = {}): Creature {
  return { ...structuredClone(catalog[0]!), id, forged: false, currentHealth: 2, maxHealth: 2, ready: true, shield: false, stunned: false, ...overrides }
}
function addSpell(s: GameState, effects: CardDraft['effects'], cost = 1): Card {
  const card: Card = { ...structuredClone(catalog[2]!), id: `spell-${s.sequence++}`, effects, cost, forged: false }
  s.players.you.hand.push(card); s.players.you.mana = 10
  return card
}
function play(s: GameState, card: Card, targetId?: string) { return act(s, { type: 'play', side: 'you', cardId: card.id, targetId }) }
function fight(s: GameState, attacker = 'a', blocker?: string): GameState {
  s.phase = 'combat'
  let result = act(s, { type: 'attack', side: 'you', attackers: [attacker] })
  expect(result.error).toBeUndefined()
  if (blocker) result = act(result.state, { type: 'block', side: 'bot', attackerId: attacker, blockerId: blocker })
  expect(result.error).toBeUndefined()
  return act(result.state, { type: 'resolve', side: 'bot' }).state
}
describe('deterministic rules', () => {
  it('accepts immutable snapshots from Vue shallowRef without reactive clone failures', () => {
    const state = shallowRef(main())
    const result = act(state.value, { type: 'play', side: 'you', cardId: state.value.players.you.hand[0]!.id })
    expect(result.error).toBeUndefined(); state.value = result.state
    expect(act(state.value, { type: 'next', side: 'you' }).error).toBeUndefined()
  })
  it('starts at 20 life with seeded decks, hands, three charges and one mana', () => {
    const s = createGame('same', 42)
    expect(s).toEqual(createGame('same', 42)); expect(s.players.you.life).toBe(20)
    expect(s.players.you.charges).toBe(3); expect(s.players.bot.charges).toBe(3)
    expect(s.players.you.hand).toHaveLength(5); expect(s.players.you.mana).toBe(1); expect(invariant(s)).toBe(true)
  })
  it('rejects invalid actions without mutating the original state', () => {
    const s = main(), before = structuredClone(s)
    const result = act(s, { type: 'play', side: 'bot', cardId: s.players.bot.hand[0]!.id })
    expect(result.state).toBe(s); expect(result.error).toBeTruthy(); expect(s).toEqual(before)
  })
  it('pays mana and gives new creatures summoning sickness', () => {
    const s = main(), c = s.players.you.hand[0]!
    const r = play(s, c)
    expect(r.error).toBeUndefined(); expect(r.state.players.you.mana).toBe(0)
    expect(canAttack(r.state.players.you.board[0]!)).toBe(false)
    expect(r.state.players.you.hand.some(x => x.id === c.id)).toBe(false)
  })
  it('rejects insufficient mana, non-main play and full creature boards', () => {
    const s = main(), expensive = s.players.you.hand[1]!
    expect(play(s, expensive).error).toBeTruthy()
    s.phase = 'combat'; expect(play(s, s.players.you.hand[0]!).error).toBeTruthy()
    s.phase = 'main'; s.players.you.board = Array.from({ length: 6 }, (_, i) => unit(`full${i}`))
    expect(play(s, s.players.you.hand[0]!).error).toBeTruthy()
  })
  it('haste permits attacking immediately', () => {
    const s = main(); s.players.you.mana = 10
    const c: Card = { ...catalog[5]!, id: 'haste', forged: false }; s.players.you.hand.push(c)
    expect(canAttack(play(s, c).state.players.you.board[0]!)).toBe(true)
  })
  it('refreshes mana and readiness at next own turn', () => {
    let s = main(); s.players.you.board = [unit('a', { ready: false })]
    for (let i = 0; i < 8; i++) s = act(s, { type: 'next', side: s.active }).state
    expect(s.active).toBe('you'); expect(s.players.you.maxMana).toBe(2); expect(s.players.you.mana).toBe(2)
    expect(s.players.you.board[0]!.ready).toBe(true)
  })
  it('draws from an empty deck as increasing fatigue and ends a match', () => {
    let s = main(); s.players.you.deck = []; s.players.bot.deck = []
    for (let i = 0; i < 150 && !s.winner; i++) s = act(s, { type: 'next', side: s.active }).state
    expect(s.winner).toBeTruthy(); expect(s.players.you.fatigue).toBeGreaterThan(1); expect(invariant(s)).toBe(true)
  })
  it('burns excess drawn cards instead of exceeding hand capacity', () => {
    const s = main(); s.players.you.hand = Array.from({ length: 9 }, (_, i) => ({ ...catalog[0]!, id: `h${i}`, forged: false }))
    const c = addSpell(s, [effect('draw', 'none', 2)])
    const r = play(s, c).state
    expect(r.players.you.hand).toHaveLength(10); expect(r.players.you.graveyard.length).toBeGreaterThan(1)
  })
})
describe('combat and blocking', () => {
  it('unblocked attacks damage the enemy and exhaust the attacker', () => {
    const s = main(); s.players.you.board = [unit('a', { attack: 3 })]
    const r = fight(s); expect(r.players.bot.life).toBe(17); expect(r.players.you.board[0]!.ready).toBe(false)
  })
  it('blocked damage is simultaneous, kills both units and never spills over', () => {
    const s = main(); s.players.you.board = [unit('a', { attack: 3 })]; s.players.bot.board = [unit('b', { attack: 2 })]
    const r = fight(s, 'a', 'b')
    expect(r.players.you.board).toHaveLength(0); expect(r.players.bot.board).toHaveLength(0)
    expect(r.players.bot.life).toBe(20); expect(r.players.you.graveyard.some(c => c.id === 'a')).toBe(true)
  })
  it('guard automatically blocks and flying bypasses ground guards', () => {
    const s = main(); s.players.you.board = [unit('a')]; s.players.bot.board = [unit('b', { keywords: ['guard'], attack: 0 })]
    expect(fight(s).players.bot.life).toBe(20)
    s.players.you.board[0]!.keywords = ['flying']
    expect(fight(s).players.bot.life).toBe(19)
  })
  it('rejects ground blocking flying and duplicate attackers', () => {
    const s = main(); s.phase = 'combat'; s.players.you.board = [unit('a', { keywords: ['flying'] })]; s.players.bot.board = [unit('b')]
    expect(act(s, { type: 'attack', side: 'you', attackers: ['a', 'a'] }).error).toBeTruthy()
    const r = act(s, { type: 'attack', side: 'you', attackers: ['a'] }).state
    expect(act(r, { type: 'block', side: 'bot', attackerId: 'a', blockerId: 'b' }).error).toBeTruthy()
  })
  it('one blocker can only cover one attacker', () => {
    const s = main(); s.phase = 'combat'; s.players.you.board = [unit('a'), unit('c')]; s.players.bot.board = [unit('b')]
    let r = act(s, { type: 'attack', side: 'you', attackers: ['a', 'c'] }).state
    r = act(r, { type: 'block', side: 'bot', attackerId: 'a', blockerId: 'b' }).state
    r = act(r, { type: 'block', side: 'bot', attackerId: 'c', blockerId: 'b' }).state
    expect(r.combat!.blocks).toEqual({ c: 'b' })
  })
  it('lifesteal restores actual damage, respects shields and caps life at twenty', () => {
    const s = main(); s.players.you.life = 10; s.players.you.board = [unit('a', { attack: 10, keywords: ['lifesteal'] })]
    s.players.bot.board = [unit('b', { currentHealth: 2, maxHealth: 2, attack: 0 })]
    expect(fight(s, 'a', 'b').players.you.life).toBe(12)
    s.players.bot.board[0]!.shield = true
    expect(fight(s, 'a', 'b').players.you.life).toBe(10)
  })
  it('recognizes victory and rejects actions after game over', () => {
    const s = main(); s.players.bot.life = 1; s.players.you.board = [unit('a')]
    const r = fight(s); expect(r.winner).toBe('you'); expect(act(r, { type: 'next', side: 'you' }).error).toBeTruthy()
  })
  it('allows concession before game over', () => {
    const s = main(); expect(act(s, { type: 'concede', side: 'you' }).state.winner).toBe('bot')
  })
})
describe('implemented effect DSL', () => {
  it('damage validates enemy hero/creature targets and rejects allies', () => {
    const s = main(); s.players.you.board = [unit('a')]; s.players.bot.board = [unit('b', { currentHealth: 4, maxHealth: 4 })]
    const c = addSpell(s, [effect('damage', 'enemy', 2)])
    expect(validTargets(s, 'you', c)).toEqual(['bot', 'b']); expect(play(s, c).error).toBeTruthy()
    expect(play(s, c, 'a').error).toBeTruthy(); expect(play(s, c, 'b').state.players.bot.board[0]!.currentHealth).toBe(2)
    expect(play(s, c, 'bot').state.players.bot.life).toBe(18)
  })
  it('area damage filters flying and leaves allies untouched', () => {
    const s = main(); s.players.you.board = [unit('a')]; s.players.bot.board = [unit('b', { keywords: ['flying'] }), unit('c')]
    const c = addSpell(s, [effect('damageAll', 'allEnemies', 2, 0, 'flying')]); const r = play(s, c).state
    expect(r.players.bot.board.map(c => c.id)).toEqual(['c']); expect(r.players.you.board).toHaveLength(1)
  })
  it('heals the hero and caps creature healing at max health', () => {
    const s = main(); s.players.you.life = 18; s.players.you.board = [unit('a', { currentHealth: 1 })]
    const c = addSpell(s, [effect('healPlayer', 'player', 5), effect('healCreature', 'allyCreature', 5)])
    const r = play(s, c, 'a').state
    expect(r.players.you.life).toBe(20); expect(r.players.you.board[0]!.currentHealth).toBe(2)
  })
  it('summons bounded tokens and rejects summoning onto a full board', () => {
    const s = main(); s.players.you.board = Array.from({ length: 5 }, (_, i) => unit(`a${i}`))
    const c = addSpell(s, [effect('summon', 'none', 2)])
    const r = play(s, c).state; expect(r.players.you.board).toHaveLength(6); expect(r.players.you.board[5]!.attack).toBe(1)
    const full = addSpell(r, [effect('summon', 'none', 1)]); expect(play(r, full).error).toBeTruthy()
  })
  it('buff increases current/max health, caps stats and applies to all allies', () => {
    const s = main(); s.players.you.board = [unit('a', { attack: 9, currentHealth: 8, maxHealth: 9 }), unit('b')]
    const c = addSpell(s, [effect('buff', 'allAllies', 3, 3)]); const r = play(s, c).state
    expect(r.players.you.board[0]).toMatchObject({ attack: 10, currentHealth: 9, maxHealth: 10 })
    expect(r.players.you.board[1]).toMatchObject({ attack: 4, currentHealth: 5, maxHealth: 5 })
  })
  it('shield absorbs exactly one damage event', () => {
    const s = main(); s.players.bot.board = [unit('b', { shield: true })]
    const c = addSpell(s, [effect('damage', 'enemyCreature', 1), effect('damage', 'enemyCreature', 1)])
    const r = play(s, c, 'b').state
    expect(r.players.bot.board[0]).toMatchObject({ currentHealth: 1, shield: false })
  })
  it('grants shields to allies and creatures can shield themselves on entry', () => {
    const s = main(); s.players.you.board = [unit('a')]
    const c = addSpell(s, [effect('shield', 'allAllies')]); expect(play(s, c).state.players.you.board[0]!.shield).toBe(true)
    const self: Card = { ...catalog[0]!, id: 'self', effects: [effect('shield', 'self')], forged: false }; s.players.you.hand.push(self)
    expect(play(s, self).state.players.you.board.find(c => c.id === 'self')!.shield).toBe(true)
  })
  it('destroyDamaged requires an actually damaged enemy', () => {
    const s = main(); s.players.bot.board = [unit('b')]
    const c = addSpell(s, [effect('destroyDamaged', 'enemyCreature')]); expect(canPlay(s, 'you', c)).toBe(false)
    s.players.bot.board[0]!.currentHealth = 1
    expect(play(s, c, 'b').state.players.bot.board).toHaveLength(0)
  })
  it('stun stops attacks/blocks and skips readiness on the next turn', () => {
    const s = main(); s.players.bot.board = [unit('b')]
    const c = addSpell(s, [effect('stun', 'enemyCreature')]); let r = play(s, c, 'b').state
    expect(r.players.bot.board[0]).toMatchObject({ stunned: true, ready: false })
    for (let i = 0; i < 3; i++) r = act(r, { type: 'next', side: r.active }).state
    expect(r.active).toBe('bot'); expect(r.players.bot.board[0]).toMatchObject({ stunned: false, ready: false })
  })
  it('temporary mana respects the ten-mana cap', () => {
    const s = main(); const c = addSpell(s, [effect('gainMana', 'none', 2)])
    expect(play(s, c).state.players.you.mana).toBe(10)
  })
  it('risk spells damage both heroes and can cause self defeat', () => {
    const s = main(); const c = addSpell(s, [effect('damage', 'player', 2), effect('damage', 'opponent', 4)])
    const r = play(s, c).state; expect(r.players.you.life).toBe(18); expect(r.players.bot.life).toBe(16)
    s.players.you.life = 2; expect(play(s, c).state.winner).toBe('bot')
  })
})
describe('forging, schemas and balance', () => {
  it('rejects unknown effects, executable fields, extra properties and huge prompts', () => {
    expect(cardSchema.safeParse({ ...catalog[0]!, effects: [{ kind: 'instantWin' }] }).success).toBe(false)
    expect(cardSchema.safeParse({ ...catalog[0]!, code: 'alert(1)' }).success).toBe(false)
    expect(forgeRequestSchema.safeParse({ prompt: 'x'.repeat(501) }).success).toBe(false)
  })
  it('normalizes oversized stats/effects and prices actual power at ten mana or less', () => {
    const { card } = balanceCard({ ...catalog[10]!, cost: 1, attack: 100, health: 100, effects: [effect('damageAll', 'allEnemies', 100), effect('draw', 'none', 100), effect('summon', 'none', 100)] })
    expect(card.cost).toBeLessThanOrEqual(10); expect(card.attack).toBeLessThanOrEqual(10); expect(card.health).toBeLessThanOrEqual(10)
    expect(powerCost(card)).toBeLessThanOrEqual(10); expect(balanceCard(card).card).toEqual(card)
  })
  it('corrects spell keywords, invalid targets and incompatible target combinations', () => {
    const { card } = balanceCard({ ...catalog[2]!, attack: 9, health: 9, keywords: ['flying'], effects: [effect('damage', 'allAllies', 4), effect('healCreature', 'allyCreature', 5)] })
    expect(card.attack).toBe(0); expect(card.health).toBe(0); expect(card.keywords).toEqual([])
    expect(card.effects).toHaveLength(1); expect(card.effects[0]!.target).toBe('enemy')
  })
  it('provides deterministic, schema-valid Swedish and English demo recipes', () => {
    for (const prompt of ['eld drake', 'protect shield', 'damaged assassin', 'storm flying', 'risk blood', 'heal life', 'draw cards', 'quick wolf', 'frost stun', 'mana', 'summon token', 'buff strong', 'damage spark', 'något okänt']) {
      const result = demoForge(prompt)
      expect(result).toEqual(demoForge(prompt)); expect(cardSchema.safeParse(result.card).success).toBe(true)
      expect(result.card.cost).toBeGreaterThan(0); expect(result.card.cost).toBeLessThanOrEqual(10)
    }
  })
  it('forges exactly three cards, charges atomically and generated cards execute in the engine', () => {
    let s = main(); s.players.you.maxMana = 10; s.players.you.mana = 10
    const draft = demoForge('snabb liten glödvarg med hast').card
    for (let i = 0; i < 3; i++) { const r = act(s, { type: 'forge', side: 'you', card: draft }); expect(r.error).toBeUndefined(); s = r.state }
    expect(s.players.you.charges).toBe(0); expect(act(s, { type: 'forge', side: 'you', card: draft }).error).toBeTruthy()
    const forged = s.players.you.hand.find(c => c.forged)!
    const r = play(s, forged); expect(r.error).toBeUndefined(); expect(r.state.players.you.board.find(c => c.id === forged.id)!.ready).toBe(true)
  })
  it('rejects forge in the wrong phase, with full hand or invalid draft without charge loss', () => {
    const s = main(); const draft = demoForge('dragon').card
    s.phase = 'combat'; expect(act(s, { type: 'forge', side: 'you', card: draft }).error).toBeTruthy()
    s.phase = 'main'; expect(act(s, { type: 'forge', side: 'you', card: {} as CardDraft }).error).toBeTruthy(); expect(s.players.you.charges).toBe(3)
  })
  it('simulates 60 complete matches, preserving invariants and bounding bot progress', () => {
    const winners = new Set()
    for (let seed = 1; seed <= 60; seed++) {
      let s = createGame(`simulation-${seed}`, seed), actions = 0
      while (!s.winner && actions++ < 1500) {
        const side: Side = s.combat ? (s.combat.side === 'you' ? 'bot' : 'you') : s.active
        if (s.phase === 'main' && !s.combat && s.players[side].charges > 0 && s.players[side].hand.length < 9 && actions % 4 === 0) {
          s = act(s, { type: 'forge', side, card: demoForge(seed % 2 ? 'shield protect' : 'eld drake').card }).state
        }
        const action: Action = botAction(s, side)
        const result = act(s, action)
        expect(result.error, `seed ${seed}, ${JSON.stringify(action)}`).toBeUndefined()
        s = result.state; expect(invariant(s), `seed ${seed}, action ${actions}`).toBe(true)
      }
      expect(s.winner, `seed ${seed} stalled`).toBeTruthy(); expect(actions).toBeLessThan(1500); winners.add(s.winner)
    }
    expect(winners.size).toBeGreaterThan(0)
  })
})
