import type { Action, GameState } from '../game/types'
import type { BattleEvent } from '../game/presentation'
export type Sound = 'draw' | 'card' | 'attack' | 'damage' | 'death' | 'magic' | 'forge' | 'reveal' | 'turn' | 'hover' | 'select' | 'block' | 'victory' | 'defeat'
export interface SoundCue { sound: Sound; delay?: number }
/** At most one of each sound per resolved action: area effects never make six simultaneous hits. */
export function actionSounds(before: GameState, after: GameState, action: Action, events: BattleEvent[]): SoundCue[] {
  const cues: SoundCue[] = []
  if (action.type === 'play') {
    const card = before.players[action.side].hand.find(c => c.id === action.cardId)
    cues.push({ sound: card?.type === 'spell' ? 'magic' : 'card' })
  } else if (action.type === 'resolve') cues.push({ sound: 'attack' })
  else if (action.type === 'forge') cues.push({ sound: 'reveal' })
  else if (action.type === 'block') cues.push({ sound: 'block' })
  if (before.active !== after.active) cues.push({ sound: 'turn' })
  if (events.some(e => e.kind === 'draw')) cues.push({ sound: 'draw', delay: .08 })
  if (events.some(e => e.kind === 'damage')) cues.push({ sound: 'damage', delay: action.type === 'resolve' ? .15 : .08 })
  if (events.some(e => e.kind === 'death')) cues.push({ sound: 'death', delay: .2 })
  if (!before.winner && after.winner) cues.push({ sound: after.winner === 'you' ? 'victory' : after.winner === 'bot' ? 'defeat' : 'turn', delay: .3 })
  return cues.filter((cue, index) => cues.findIndex(c => c.sound === cue.sound) === index)
}
