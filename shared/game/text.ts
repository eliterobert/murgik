import type { CardDraft, Effect, Keyword } from './types'
export const keywordNames: Record<Keyword, string> = { flying: 'Flygande', guard: 'Vakt', haste: 'Hast', lifesteal: 'Livsstöld', enrage: 'Raseri' }
export const keywordHelp: Record<Keyword, string> = { flying: 'Kan bara blockeras av flygande varelser.', guard: 'Fyller automatiskt ett oblockerat anfall som den kan blockera.', haste: 'Kan attackera samma tur som den spelas, när bådas förberedelseturer är över.', lifesteal: 'Läker din hjälte med faktiskt utdelad stridsskada, högst till 20 liv.', enrage: 'När varelsen överlever ett skadeevent får den permanent +1 attack, högst 10. Sköld och dödlig skada utlöser inte Raseri. Samtidiga stridsträffar använder attacken före ökningen.' }
export function effectText(e: Effect): string {
  const target = e.target === 'allAllies' ? 'alla dina varelser' : e.target === 'self' ? 'denna varelse' : 'en egen varelse'
  switch (e.kind) {
    case 'damage': return `Gör ${e.amount} skada på ${e.target === 'player' ? 'dig själv' : e.target === 'opponent' ? 'motståndaren' : e.target === 'enemyCreature' ? 'en fiendevarelse' : 'valfri fiende'}.`
    case 'damageAll': return `Gör ${e.amount} skada på alla ${e.filter === 'flying' ? 'flygande ' : ''}fiendevarelser.`
    case 'healPlayer': return `Återställ ${e.amount} liv till din hjälte.`
    case 'healCreature': return `Läk ${e.target === 'allAllies' ? 'alla dina varelser' : 'en egen varelse'} med ${e.amount}.`
    case 'draw': return `Dra ${e.amount} kort.`
    case 'summon': return `Åkalla ${e.amount} glödandar (1/1).`
    case 'buff': return `Ge ${target} +${e.amount}/+${e.secondary}.`
    case 'shield': return `Ge ${target} sköld mot nästa skada.`
    case 'destroyDamaged': return 'Förgör en skadad fiendevarelse.'
    case 'stun': return 'Bedöva en fiendevarelse till efter dess nästa tur.'
    case 'gainMana': return `Få ${e.amount} mana denna tur (högst 10).`
  }
}
export function cardText(card: CardDraft): string {
  return [...card.keywords.map(k => k === 'enrage' ? 'Raseri: överlev skada och få +1 attack (högst 10).' : keywordNames[k]), ...card.effects.map(effectText)].join(' · ') || 'Inga specialförmågor.'
}
