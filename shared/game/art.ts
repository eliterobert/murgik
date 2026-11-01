import type { CardDraft } from './types'
import { baseCards } from './library'
import { baseArtwork } from './base-art'
export interface Illustration {
  id?: string
  status: 'disabled' | 'queued' | 'generating' | 'ready' | 'failed'
  url?: string
  message?: string
}
export function artIdentity(card: Pick<CardDraft, 'name' | 'artPrompt' | 'theme' | 'type'>): string {
  return [card.name, card.artPrompt, card.theme, card.type].join('|')
}
const artworkForDraft = new WeakMap<object, string>(baseCards.map(entry => [entry.card, baseArtwork[entry.id]!]))
/** Base cards keep authored artwork. Forged cards use a general palette placeholder;
 * their names and descriptions never select a motif or change mechanics. */
export function localArtwork(card: Pick<CardDraft, 'name' | 'theme' | 'type' | 'artPrompt'> & { baseId?: string }): string {
  const authored = card.baseId ? baseArtwork[card.baseId] : artworkForDraft.get(card)
  if (authored) return authored
  return ({ ember: '/art/ember-dragon.jpg', forest: '/art/forest-guardian.jpg', void: '/art/night-demon.jpg', storm: '/art/storm-mage.jpg', frost: '/art/frost-giant.jpg', gold: '/art/dawn-knight.jpg' })[card.theme]
}
