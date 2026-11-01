export type Side = 'you' | 'bot'
export type TurnPhase = 'draw' | 'main' | 'combat' | 'end'
export type Keyword = 'flying' | 'guard' | 'haste' | 'lifesteal' | 'enrage'
export type EffectKind = 'damage' | 'damageAll' | 'healPlayer' | 'healCreature' | 'draw' | 'summon' | 'buff' | 'shield' | 'destroyDamaged' | 'stun' | 'gainMana'
export type Target = 'enemy' | 'enemyCreature' | 'allyCreature' | 'opponent' | 'player' | 'allEnemies' | 'allAllies' | 'self' | 'none'
export interface Effect { kind: EffectKind; target: Target; amount: number; secondary: number; filter: 'any' | 'flying' }
export interface CardDraft {
  name: string; type: 'creature' | 'spell'; flavor: string; cost: number
  attack: number; health: number; keywords: Keyword[]; effects: Effect[]
  artPrompt: string; theme: 'ember' | 'forest' | 'void' | 'storm' | 'frost' | 'gold'
}
export interface Card extends CardDraft { id: string; forged: boolean; baseId?: string }
export interface Creature extends Card { currentHealth: number; maxHealth: number; ready: boolean; shield: boolean; stunned: boolean }
export interface Player { life: number; mana: number; maxMana: number; deck: Card[]; hand: Card[]; board: Creature[]; graveyard: Card[]; charges: number; fatigue: number; deckStyle?: import('./library').Playstyle }
export interface Combat { side: Side; attackers: string[]; blocks: Record<string, string> }
export interface GameState {
  id: string; seed: number; sequence: number; turn: number; active: Side; phase: TurnPhase
  players: Record<Side, Player>; combat: Combat | null; winner: Side | 'draw' | null
  log: { id: number; text: string; kind: 'info' | 'damage' | 'forge' }[]
}
export type Action =
  | { type: 'next'; side: Side }
  | { type: 'play'; side: Side; cardId: string; targetId?: string }
  | { type: 'attack'; side: Side; attackers: string[] }
  | { type: 'block'; side: Side; attackerId: string; blockerId?: string }
  | { type: 'resolve'; side: Side }
  | { type: 'forge'; side: Side; card: CardDraft }
  | { type: 'concede'; side: Side }
export interface ActionResult { state: GameState; error?: string }
export const other = (side: Side): Side => side === 'you' ? 'bot' : 'you'
export const MAX_BOARD = 6
export const MAX_HAND = 10
