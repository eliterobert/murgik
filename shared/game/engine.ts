import { catalog } from './catalog'
import { balanceCard } from './balance'
import { MAX_BOARD, MAX_HAND, other } from './types'
import type { Action, ActionResult, Card, CardDraft, Creature, Effect, GameState, Player, Side } from './types'

const label = (side: Side) => side === 'you' ? 'Du' : 'Veyra'
function log(s: GameState, text: string, kind: 'info' | 'damage' | 'forge' = 'info') {
  s.log.push({ id: ++s.sequence, text, kind }); s.log = s.log.slice(-60)
}
function rng(s: GameState): number {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0
  return s.seed / 4294967296
}
function newCard(s: GameState, draft: CardDraft, forged = false): Card {
  return { ...structuredClone(draft), id: `${s.id}-${++s.sequence}`, forged }
}
function emptyPlayer(): Player {
  return { life: 20, mana: 0, maxMana: 0, deck: [], hand: [], board: [], graveyard: [], charges: 3, fatigue: 0 }
}
export function createGame(id = 'murgik', seed = 2026): GameState {
  const s: GameState = { id, seed, sequence: 0, turn: 1, active: 'you', phase: 'draw', players: { you: emptyPlayer(), bot: emptyPlayer() }, combat: null, winner: null, log: [] }
  for (const side of ['you', 'bot'] as const) {
    // A curated opening teaches mana, targeted spells and guarding; the remaining deck is seeded.
    const opening = [0, 1, 2, 3]
    const rest = [...catalog, ...catalog].map(d => newCard(s, d))
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng(s) * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!] }
    s.players[side].hand = opening.map(i => newCard(s, catalog[i]!))
    s.players[side].deck = rest
  }
  startTurn(s, 'you', false)
  log(s, 'Duellen börjar. Smid ditt eget öde.')
  return s
}
function draw(s: GameState, side: Side, count = 1) {
  const p = s.players[side]
  for (let i = 0; i < count; i++) {
    const card = p.deck.shift()
    if (!card) { p.fatigue++; p.life -= p.fatigue; log(s, `${label(side)} tar ${p.fatigue} utmattningsskada.`, 'damage') }
    else if (p.hand.length < MAX_HAND) { p.hand.push(card); log(s, `${label(side)} drar ett kort.`) }
    else { p.graveyard.push(card); log(s, `${card.name} bränns: handen är full.`) }
  }
}
function startTurn(s: GameState, side: Side, increment = true) {
  if (increment) s.turn++
  s.active = side; s.phase = 'draw'; s.combat = null
  const p = s.players[side]
  p.maxMana = Math.min(10, p.maxMana + 1); p.mana = p.maxMana
  for (const c of p.board) { c.ready = !c.stunned; c.stunned = false }
  draw(s, side); cleanup(s)
}
function cleanup(s: GameState) {
  for (const side of ['you', 'bot'] as const) {
    const p = s.players[side]
    for (const c of p.board.filter(c => c.currentHealth <= 0)) { p.graveyard.push(c); log(s, `${c.name} faller.`, 'damage') }
    p.board = p.board.filter(c => c.currentHealth > 0)
    p.life = Math.max(0, Math.min(20, p.life))
    p.mana = Math.max(0, Math.min(10, p.mana))
  }
  const youDead = s.players.you.life <= 0, botDead = s.players.bot.life <= 0
  if (youDead || botDead) s.winner = youDead && botDead ? 'draw' : youDead ? 'bot' : 'you'
}
function creature(s: GameState, id: string | undefined): Creature | undefined {
  return id ? [...s.players.you.board, ...s.players.bot.board].find(c => c.id === id) : undefined
}
export function needsTarget(card: CardDraft): boolean { return card.effects.some(e => ['enemy', 'enemyCreature', 'allyCreature'].includes(e.target)) }
function effectValid(s: GameState, side: Side, e: Effect, targetId?: string): boolean {
  const enemy = s.players[other(side)].board, allies = s.players[side].board
  if (e.target === 'enemy' && targetId === other(side)) return true
  if (e.target === 'enemy' || e.target === 'enemyCreature') {
    const c = enemy.find(c => c.id === targetId)
    return !!c && (e.kind !== 'destroyDamaged' || c.currentHealth < c.maxHealth)
  }
  if (e.target === 'allyCreature') return allies.some(c => c.id === targetId)
  return true
}
export function validTargets(s: GameState, side: Side, card: CardDraft): string[] {
  if (!needsTarget(card)) return []
  return [other(side), ...s.players[other(side)].board.map(c => c.id), ...s.players[side].board.map(c => c.id)]
    .filter(id => card.effects.every(e => effectValid(s, side, e, id)))
}
export function canPlay(s: GameState, side: Side, card: CardDraft): boolean {
  const p = s.players[side]
  return !s.winner && s.active === side && s.phase === 'main' && !s.combat && card.cost <= p.mana
    && (card.type !== 'creature' || p.board.length < MAX_BOARD)
    && (!needsTarget(card) || validTargets(s, side, card).length > 0)
    && (!card.effects.some(e => e.kind === 'summon') || p.board.length + (card.type === 'creature' ? 1 : 0) < MAX_BOARD)
}
function spawn(s: GameState, side: Side, card: Card): Creature {
  const c: Creature = { ...card, currentHealth: card.health, maxHealth: card.health, ready: card.keywords.includes('haste'), shield: false, stunned: false }
  s.players[side].board.push(c)
  return c
}
function hit(s: GameState, targetId: string, amount: number): number {
  if (targetId === 'you' || targetId === 'bot') {
    const p = s.players[targetId]; const actual = Math.min(Math.max(p.life, 0), amount); p.life -= amount; return actual
  }
  const c = creature(s, targetId)
  if (!c || c.currentHealth <= 0) return 0
  if (c.shield) { c.shield = false; log(s, `${c.name}: skölden absorberar skadan.`); return 0 }
  const actual = Math.min(c.currentHealth, amount); c.currentHealth -= amount; return actual
}
function applyEffect(s: GameState, side: Side, e: Effect, sourceId: string, targetId?: string) {
  const p = s.players[side], enemy = other(side)
  const targets = e.target === 'allAllies' ? p.board : e.target === 'allEnemies' ? s.players[enemy].board.filter(c => e.filter !== 'flying' || c.keywords.includes('flying')) : [creature(s, e.target === 'self' ? sourceId : targetId)].filter((c): c is Creature => !!c)
  switch (e.kind) {
    case 'damage': {
      const target = e.target === 'player' ? side : e.target === 'opponent' ? enemy : targetId!
      hit(s, target, e.amount); log(s, `${e.amount} magisk skada.`, 'damage'); break
    }
    case 'damageAll': for (const c of targets) hit(s, c.id, e.amount); log(s, `Askstormen gör ${e.amount} områdesskada.`, 'damage'); break
    case 'healPlayer': p.life = Math.min(20, p.life + e.amount); break
    case 'healCreature': for (const c of targets) c.currentHealth = Math.min(c.maxHealth, c.currentHealth + e.amount); break
    case 'draw': draw(s, side, e.amount); break
    case 'summon': {
      for (let i = 0; i < e.amount && p.board.length < MAX_BOARD; i++) spawn(s, side, newCard(s, { name: 'Glödande', type: 'creature', cost: 1, attack: 1, health: 1, theme: 'ember', keywords: [], effects: [], flavor: 'En gnista med egen vilja.', artPrompt: 'ember spirit' }))
      break
    }
    case 'buff': for (const c of targets) {
      c.attack = Math.min(10, c.attack + e.amount)
      const gain = Math.min(10 - c.maxHealth, e.secondary); c.maxHealth += gain; c.currentHealth += gain
    } break
    case 'shield': for (const c of targets) c.shield = true; break
    case 'destroyDamaged': for (const c of targets) if (c.currentHealth < c.maxHealth) c.currentHealth = 0; break
    case 'stun': for (const c of targets) { c.stunned = true; c.ready = false }; break
    case 'gainMana': p.mana = Math.min(10, p.mana + e.amount); break
  }
  cleanup(s)
}
export function canAttack(c: Creature): boolean { return c.ready && !c.stunned && c.attack > 0 }
export function canBlock(attacker: Creature, blocker: Creature): boolean {
  return !blocker.stunned && (!attacker.keywords.includes('flying') || blocker.keywords.includes('flying'))
}
function resolveCombat(s: GameState) {
  const combat = s.combat!
  const attacking = s.players[combat.side], defending = s.players[other(combat.side)]
  // Guard is mandatory when eligible; fill missing assignments deterministically.
  for (const aId of combat.attackers) {
    if (combat.blocks[aId]) continue
    const a = attacking.board.find(c => c.id === aId)
    const guard = a && defending.board.find(c => c.keywords.includes('guard') && canBlock(a, c) && !Object.values(combat.blocks).includes(c.id))
    if (guard) combat.blocks[aId] = guard.id
  }
  for (const aId of combat.attackers) {
    const a = attacking.board.find(c => c.id === aId)
    if (!a || a.currentHealth <= 0) continue
    const b = defending.board.find(c => c.id === combat.blocks[aId])
    if (b) {
      const dealt = hit(s, b.id, a.attack), returned = hit(s, a.id, b.attack)
      if (a.keywords.includes('lifesteal')) attacking.life = Math.min(20, attacking.life + dealt)
      if (b.keywords.includes('lifesteal')) defending.life = Math.min(20, defending.life + returned)
      log(s, `${a.name} möter ${b.name}.`, 'damage')
    } else {
      const dealt = hit(s, other(combat.side), a.attack)
      if (a.keywords.includes('lifesteal')) attacking.life = Math.min(20, attacking.life + dealt)
      log(s, `${a.name} gör ${a.attack} skada på ${combat.side === 'you' ? 'Veyra' : 'dig'}.`, 'damage')
    }
  }
  cleanup(s); s.combat = null; s.phase = 'end'
}
export function act(original: GameState, action: Action): ActionResult {
  const fail = (error: string): ActionResult => ({ state: original, error })
  if (original.winner) return fail('Duellen är redan avgjord.')
  const s = structuredClone(original)
  const p = s.players[action.side]
  if (action.type === 'concede') { s.winner = other(action.side); log(s, `${label(action.side)} lämnar duellen.`); return { state: s } }
  if (action.type === 'block' || action.type === 'resolve') {
    const combat = s.combat
    if (!combat || action.side === combat.side) return fail('Du kan inte blockera nu.')
    if (action.type === 'resolve') { resolveCombat(s); return { state: s } }
    const a = s.players[combat.side].board.find(c => c.id === action.attackerId)
    if (!a || !combat.attackers.includes(a.id)) return fail('Ogiltig attackerare.')
    if (!action.blockerId) { delete combat.blocks[action.attackerId]; return { state: s } }
    const b = p.board.find(c => c.id === action.blockerId)
    if (!b || !canBlock(a, b)) return fail('Den varelsen kan inte blockera attacken.')
    for (const [id, blocker] of Object.entries(combat.blocks)) if (blocker === b.id) delete combat.blocks[id]
    combat.blocks[a.id] = b.id; return { state: s }
  }
  if (s.active !== action.side || s.combat) return fail('Vänta på din tur.')
  switch (action.type) {
    case 'next': {
      if (s.phase === 'draw') s.phase = 'main'
      else if (s.phase === 'main') s.phase = 'combat'
      else if (s.phase === 'combat') s.phase = 'end'
      else startTurn(s, other(action.side))
      return { state: s }
    }
    case 'play': {
      const card = p.hand.find(c => c.id === action.cardId)
      if (!card || !canPlay(s, action.side, card)) return fail('Kortet kan inte spelas nu. Kontrollera mana, fas, mål och plats.')
      if (!card.effects.every(e => effectValid(s, action.side, e, action.targetId))) return fail('Välj ett giltigt mål för kortets effekter.')
      p.mana -= card.cost; p.hand = p.hand.filter(c => c.id !== card.id)
      if (card.type === 'creature') spawn(s, action.side, card)
      else p.graveyard.push(card)
      log(s, `${label(action.side)} spelar ${card.name}.`)
      for (const e of card.effects) { applyEffect(s, action.side, e, card.id, action.targetId); if (s.winner) break }
      cleanup(s); return { state: s }
    }
    case 'attack': {
      if (s.phase !== 'combat') return fail('Du kan bara attackera i stridsfasen.')
      const ids = [...new Set(action.attackers)]
      if (!ids.length || ids.length !== action.attackers.length || ids.some(id => !p.board.some(c => c.id === id && canAttack(c)))) return fail('Välj varelser som är redo att attackera.')
      for (const c of p.board) if (ids.includes(c.id)) c.ready = false
      s.combat = { side: action.side, attackers: ids, blocks: {} }; log(s, `${label(action.side)} anfaller med ${ids.length} varelser.`)
      return { state: s }
    }
    case 'forge': {
      if (s.phase !== 'main' || p.charges <= 0 || p.hand.length >= MAX_HAND) return fail('Smidet kräver huvudfas, en laddning och plats i handen.')
      try {
        const { card } = balanceCard(action.card)
        p.hand.push(newCard(s, card, true)); p.charges--; log(s, `${label(action.side)} smider ${card.name}.`, 'forge')
        return { state: s }
      } catch { return fail('Kortet klarade inte smedjans validering.') }
    }
  }
}

/** Runtime invariant check used by the simulation suite. */
export function invariant(s: GameState): boolean {
  const ids = new Set<string>()
  return (['you', 'bot'] as const).every(side => {
    const p = s.players[side]
    return p.life >= 0 && p.life <= 20 && p.mana >= 0 && p.mana <= 10 && p.maxMana <= 10 && p.charges >= 0 && p.charges <= 3
      && p.board.length <= MAX_BOARD && p.hand.length <= MAX_HAND
      && p.board.every(c => c.currentHealth > 0 && c.currentHealth <= c.maxHealth && c.maxHealth <= 10 && c.attack <= 10)
      && [...p.deck, ...p.hand, ...p.board, ...p.graveyard].every(c => { if (ids.has(c.id)) return false; ids.add(c.id); return c.cost >= 1 && c.cost <= 10 })
  })
}
