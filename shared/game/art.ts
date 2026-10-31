import type { CardDraft } from './types'
export interface Illustration {
  id?: string
  status: 'disabled' | 'queued' | 'generating' | 'ready' | 'failed'
  url?: string
  message?: string
}
export function artIdentity(card: Pick<CardDraft, 'name' | 'artPrompt' | 'theme' | 'type'>): string {
  return [card.name, card.artPrompt, card.theme, card.type].join('|')
}
/** Bundled original artwork: offline, no API cost. */
export function localArtwork(card: Pick<CardDraft, 'name' | 'theme' | 'type' | 'artPrompt'>): string {
  const text = `${card.name} ${card.artPrompt}`.toLocaleLowerCase('sv')
  if (/drak|dragon/.test(text)) return '/art/ember-dragon.jpg'
  if (/varg|wolf|gnistlöpare|glödande/.test(text)) return '/art/ember-wolf.jpg'
  if (/moss|treant|skogsväkt|forest guardian/.test(text)) return '/art/forest-guardian.jpg'
  if (/frostkoloss|giant|jätte|koloss|monster/.test(text)) return '/art/frost-giant.jpg'
  if (/nattving|demon|winged/.test(text)) return '/art/night-demon.jpg'
  if (/jägare|assassin|lönnmörd|skuggans|sista skuggan|blod/.test(text)) return '/art/void-assassin.jpg'
  if (/insikt|scholar|minne|dra kort/.test(text)) return '/art/arcane-scholar.jpg'
  if (/läk|heal|livskälla|rotvävar|druid/.test(text)) return '/art/forest-healer.jpg'
  if (/riddar|knight|sköld|shield|löfte/.test(text)) return '/art/dawn-knight.jpg'
  return ({ ember: '/art/ember-dragon.jpg', forest: '/art/forest-guardian.jpg', void: '/art/night-demon.jpg', storm: '/art/storm-mage.jpg', frost: '/art/frost-giant.jpg', gold: '/art/dawn-knight.jpg' })[card.theme]
}
