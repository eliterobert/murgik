import { baseCards, baseCardById } from './library'
import type { Playstyle, BaseCardDefinition } from './library'
export const DECK_SIZE = 30
export const MAX_CARD_COPIES = 2
export type DeckChoice = 'random' | Playstyle
export interface DeckDefinition { id: string; style: Playstyle; name: string; description: string; cardIds: string[] }
export const deckStyles: Record<Playstyle, { name: string; description: string }> = {
  aggro:{name:'Glödens anstormning',description:'Billiga hot, Hast och skada. Vinn innan försvaret hinner växa.'},
  defense:{name:'Gryningens bastion',description:'Vakter och Sköld köper tid åt tåliga avslutare.'},
  control:{name:'Frostens dom',description:'Bedövning och skadebesvärjelser styr vilka strider som får ske.'},
  healing:{name:'Urskogens löfte',description:'Läkning och Livsstöld håller hjälten och vakterna vid liv.'},
  sacrifice:{name:'Skymningens blodspakt',description:'Betala eget liv för tempo och kort. Planera din återhämtning.'},
  empower:{name:'Runornas förbund',description:'Bygg en bred här och förstärk flera varelser samtidigt.'},
  combo:{name:'Stormens väv',description:'Kortdragning och tillfällig mana länkar huvudfasens drag.'}
}
export const styleIds = Object.keys(deckStyles) as Playstyle[]
function random(seed: number) { let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let value=state;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return((value^(value>>>14))>>>0)/4294967296} }
export function shuffle<T>(values: readonly T[], next: ()=>number) { const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[result[i],result[j]]=[result[j]!,result[i]!]}return result }
// Joint curve/type quotas guarantee 18 creatures, 12 spells, 10 early / 12 mid / 8 late cards.
const slots = [
  {type:'creature',min:1,max:2,count:6},{type:'creature',min:3,max:4,count:8},{type:'creature',min:5,max:8,count:4},
  {type:'spell',min:1,max:2,count:4},{type:'spell',min:3,max:4,count:4},{type:'spell',min:5,max:8,count:4}
] as const
export const deckComposition = {
  creatures:slots.filter(slot=>slot.type==='creature').reduce((total,slot)=>total+slot.count,0),
  spells:slots.filter(slot=>slot.type==='spell').reduce((total,slot)=>total+slot.count,0)
}
export function generateDeck(seed: number, selectedStyle?: Playstyle): DeckDefinition {
  const next=random(seed), style=selectedStyle??styleIds[Math.floor(next()*styleIds.length)]!, counts=new Map<string,number>(), ids:string[]=[]
  function take(pool: BaseCardDefinition[]) {
    const eligible=pool.filter(entry=>(counts.get(entry.id)??0)<MAX_CARD_COPIES)
    const thematic=eligible.filter(entry=>entry.styles.includes(style))
    const themedCount=ids.filter(id=>baseCardById.get(id)!.styles.includes(style)).length
    const candidates=themedCount<10&&thematic.length?thematic:eligible
    const weights=candidates.map(entry=>entry.styles.includes(style)?8:1)
    let ticket=next()*weights.reduce((a,b)=>a+b,0), chosen=candidates[candidates.length-1]!
    if(!chosen)throw new Error('Not enough base cards for the deck curve')
    for(let i=0;i<candidates.length;i++){ticket-=weights[i]!;if(ticket<0){chosen=candidates[i]!;break}}
    ids.push(chosen.id);counts.set(chosen.id,(counts.get(chosen.id)??0)+1)
  }
  for(const slot of slots) for(let i=0;i<slot.count;i++)take(baseCards.filter(entry=>entry.card.type===slot.type && entry.card.cost>=slot.min && entry.card.cost<=slot.max && (ids.length!==0||entry.card.cost===1)))
  return {id:`generated:${style}:${seed>>>0}`,style,...deckStyles[style],cardIds:shuffle(ids,next)}
}
// Separate stable preset definitions: the same thirty collection IDs every time, shuffled per match.
export const presetDecks: Record<Playstyle,DeckDefinition> = Object.fromEntries(styleIds.map((style,index)=>[style,{...generateDeck(4700+index*97,style),id:`preset:${style}`}])) as Record<Playstyle,DeckDefinition>
export function buildDeck(choice: DeckChoice, seed: number) { return choice==='random'?generateDeck(seed):{...presetDecks[choice],cardIds:[...presetDecks[choice].cardIds]} }
export function openingOrder(cardIds: readonly string[], seed: number): string[] {
  const shuffled=shuffle(cardIds,random(seed)), opening:string[]=[]
  for(const predicate of [
    (entry:BaseCardDefinition)=>entry.card.type==='creature'&&entry.card.cost===1,
    (entry:BaseCardDefinition)=>entry.card.type==='creature'&&entry.card.cost<=2,
    (entry:BaseCardDefinition)=>entry.card.type==='spell'&&entry.card.cost<=2
  ]) { const index=shuffled.findIndex(id=>predicate(baseCardById.get(id)!));if(index<0)throw new Error('Deck has no playable opening');opening.push(shuffled.splice(index,1)[0]!) }
  opening.push(shuffled.shift()!)
  return [...opening,...shuffled]
}
