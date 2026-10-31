import { describe, expect, it } from 'vitest'
import { act, createGame } from '../shared/game/engine'
import { catalog } from '../shared/game/catalog'
import { battleEvents } from '../shared/game/presentation'
import { artIdentity, localArtwork } from '../shared/game/art'
import { guideCards, phaseLabels, rulesChapters } from '../shared/game/rules'
import type { Creature } from '../shared/game/types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
const unit = (id: string): Creature => ({ ...catalog[0]!, id, ready: true, forged: false, shield: false, stunned: false, currentHealth: 2, maxHealth: 2 })
describe('presentation follows actual rules', () => {
  it('derives attack, damage and death feedback without mutating snapshots', () => {
    let before = createGame(); before.phase = 'combat'; before.players.you.board = [unit('attacker')]; before.players.bot.board = []
    before = act(before, { type: 'attack', side: 'you', attackers: ['attacker'] }).state
    const action = { type: 'resolve', side: 'bot' } as const, after = act(before, action).state
    const copy = structuredClone(before), events = battleEvents(before, after, action)
    expect(events.some(e => e.kind === 'attack' && e.entityId === 'attacker')).toBe(true)
    expect(events.some(e => e.kind === 'damage' && e.entityId === 'bot' && e.amount === 1)).toBe(true)
    expect(before).toEqual(copy)
  })
  it('derives simultaneous blocked deaths from actual graveyard results', () => {
    let s = createGame(); s.phase = 'combat'; s.players.you.board = [unit('a')]; s.players.bot.board = [unit('b')]
    s.players.you.board[0]!.attack = 2; s.players.bot.board[0]!.attack = 2
    s = act(s, { type: 'attack', side: 'you', attackers: ['a'] }).state
    s = act(s, { type: 'block', side: 'bot', attackerId: 'a', blockerId: 'b' }).state
    const action = { type: 'resolve', side: 'bot' } as const
    const events = battleEvents(s, act(s, action).state, action)
    expect(events.filter(e => e.kind === 'death')).toHaveLength(2)
    expect(events.filter(e => e.kind === 'damage').map(e => e.amount)).toEqual([2, 2])
  })
  it('every catalog card and guide example has a real bundled raster illustration', () => {
    for (const card of [...catalog, guideCards.forged]) {
      const path = localArtwork(card)
      expect(path).toMatch(/^\/art\/[a-z-]+\.jpg$/)
      expect(existsSync(resolve('public', path.slice(1))), path).toBe(true)
      expect(artIdentity(card)).toBe(artIdentity(structuredClone(card)))
    }
  })
  it('guide phases and example stats match the actual engine', () => {
    const game = createGame()
    expect(Object.keys(phaseLabels)).toEqual(['draw', 'main', 'combat', 'end'])
    expect(rulesChapters).toHaveLength(9); expect(game.players.you.life).toBe(20); expect(game.players.you.charges).toBe(3)
    expect(guideCards.forged).toMatchObject({ name: 'Gnistlöpare', cost: 2, attack: 1, health: 1, keywords: ['haste'] })
    let s = act(game, { type: 'next', side: 'you' }).state; s.players.you.mana = 2
    s = act(s, { type: 'forge', side: 'you', card: guideCards.forged }).state
    const forged = s.players.you.hand.find(c => c.forged)!
    s = act(s, { type: 'play', side: 'you', cardId: forged.id }).state
    expect(s.players.you.board[0]!.ready).toBe(true); expect(s.players.you.mana).toBe(0)
  })
})
