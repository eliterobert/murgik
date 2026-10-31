import { balanceCard } from './balance'
import { effect } from './catalog'
import type { CardDraft } from './types'

/** Explicitly non-AI, deterministic Swedish/English demo recipes. */
export function demoForge(prompt: string) {
  const p = prompt.toLocaleLowerCase('sv')
  const base: CardDraft = { name: 'Runbunden väktare', type: 'creature', cost: 2, attack: 1, health: 2, keywords: [], effects: [], flavor: 'Din tanke blev en gnista. Gnistan fann en form.', theme: 'gold', artPrompt: prompt.slice(0, 240) }
  if (/drak|dragon|eld|fire/.test(p)) Object.assign(base, { name: 'Smedjans askdrake', attack: 3, health: 3, theme: 'ember', keywords: ['flying'], effects: [effect('damageAll', 'allEnemies', 1)] })
  else if (/skydd|shield|protect/.test(p)) Object.assign(base, { name: 'Gryningens löfte', type: 'spell', theme: 'gold', effects: [effect('shield', 'allAllies')] })
  else if (/lönnmörd|assassin|skadad|damaged/.test(p)) Object.assign(base, { name: 'Sista skuggan', type: 'spell', theme: 'void', effects: [effect('destroyDamaged', 'enemyCreature')] })
  else if (/storm|flyg|flying/.test(p)) Object.assign(base, { name: 'Vingbrytarens storm', type: 'spell', theme: 'storm', effects: [effect('damageAll', 'allEnemies', 2, 0, 'flying')] })
  else if (/risk|blod|blood/.test(p)) Object.assign(base, { name: 'Blodspakten', type: 'spell', theme: 'void', effects: [effect('damage', 'player', 2), effect('damage', 'opponent', 4)] })
  else if (/läk|heal|liv|life/.test(p)) Object.assign(base, { name: 'Rotvävarens gåva', type: 'spell', theme: 'forest', effects: [effect('healPlayer', 'player', 5)] })
  else if (/dra|draw|kort|card/.test(p)) Object.assign(base, { name: 'Stjärnornas minne', type: 'spell', theme: 'storm', effects: [effect('draw', 'none', 2)] })
  else if (/snabb|hast|quick|varg|wolf/.test(p)) Object.assign(base, { name: 'Gnistlöpare', attack: 1, health: 1, theme: 'ember', keywords: ['haste'] })
  else if (/frys|stun|frost/.test(p)) Object.assign(base, { name: 'Stillhetens sigill', type: 'spell', theme: 'frost', effects: [effect('stun', 'enemyCreature')] })
  else if (/mana/.test(p)) Object.assign(base, { name: 'Runreservoar', type: 'spell', theme: 'storm', effects: [effect('gainMana', 'none', 2)] })
  else if (/åkalla|token|summon/.test(p)) Object.assign(base, { name: 'Glödens följe', type: 'spell', theme: 'ember', effects: [effect('summon', 'none', 2)] })
  else if (/stärk|buff|strong/.test(p)) Object.assign(base, { name: 'Urskogens kraft', type: 'spell', theme: 'forest', effects: [effect('buff', 'allyCreature', 2, 2)] })
  else if (/skada|damage|gnista|spark/.test(p)) Object.assign(base, { name: 'Runans gnista', type: 'spell', theme: 'gold', effects: [effect('damage', 'enemy', 2)] })
  const result = balanceCard(base)
  return { ...result, adjustments: ['Demoläge: en lokal receptgenerator tolkar nyckelord. Ingen AI eller API-nyckel används.', ...result.adjustments] }
}
