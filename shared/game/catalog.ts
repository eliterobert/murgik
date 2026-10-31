import type { CardDraft, Effect, Keyword } from './types'

export const effect = (kind: Effect['kind'], target: Effect['target'], amount = 1, secondary = 0, filter: Effect['filter'] = 'any'): Effect => ({ kind, target, amount, secondary, filter })
function creature(name: string, cost: number, attack: number, health: number, theme: CardDraft['theme'], keywords: Keyword[] = [], effects: Effect[] = [], flavor = ''): CardDraft {
  return { name, type: 'creature', cost, attack, health, theme, keywords, effects, flavor, artPrompt: theme }
}
function spell(name: string, cost: number, theme: CardDraft['theme'], effects: Effect[], flavor: string): CardDraft {
  return { name, type: 'spell', cost, attack: 0, health: 0, keywords: [], effects, flavor, artPrompt: theme, theme }
}
export const catalog: CardDraft[] = [
  creature('Glödvarg', 1, 1, 2, 'ember', [], [], 'Även den minsta gnista minns elden.'),
  creature('Mossväktare', 2, 1, 4, 'forest', ['guard'], [], 'Skogens sista löfte står kvar.'),
  spell('Stjärngnista', 1, 'gold', [effect('damage', 'enemy', 2)], 'Ett litet ljus kan bryta ett stort mörker.'),
  creature('Nattvinge', 2, 2, 1, 'void', ['flying'], [], 'Du hör den först när den redan passerat.'),
  spell('Livskälla', 2, 'forest', [effect('healPlayer', 'player', 5)], 'Rötterna minns ditt namn.'),
  creature('Stormlöpare', 3, 2, 2, 'storm', ['haste'], [], 'Ett hjärtslag före åskan.'),
  spell('Askregn', 3, 'ember', [effect('damageAll', 'allEnemies', 2)], 'Himlen faller i glödande fragment.'),
  creature('Skymningsjägare', 3, 2, 3, 'void', ['lifesteal'], [], 'Varje stulen skugga ger nytt liv.'),
  creature('Frostkoloss', 4, 3, 5, 'frost', ['guard'], [], 'Ett berg som lärt sig vandra.'),
  spell('Runinsikt', 2, 'storm', [effect('draw', 'none', 2)], 'Framtiden viskar. Lyssna.'),
  creature('Askdrake', 6, 4, 4, 'ember', ['flying'], [effect('damageAll', 'allEnemies', 1)], 'Ur askan föds något hungrigare.'),
  spell('Frostgrepp', 1, 'frost', [effect('stun', 'enemyCreature')], 'Tiden tar ett steg tillbaka.'),
  spell('Gryningssköld', 2, 'gold', [effect('shield', 'allAllies')], 'Håll linjen. Gryningen kommer.'),
  spell('Skuggans dom', 2, 'void', [effect('destroyDamaged', 'enemyCreature')], 'Ett sår är allt mörkret behöver.')
]
