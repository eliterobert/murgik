import { describe, expect, it } from 'vitest'
import { catalog } from '../shared/game/catalog'
import { baseCards, baseCardById, filterLibrary } from '../shared/game/library'
import { buildDeck, generateDeck, openingOrder, presetDecks, styleIds } from '../shared/game/decks'
import { cardSchema } from '../shared/game/schema'
import { balanceCard } from '../shared/game/balance'
import { act, canPlay, createGame, invariant, validTargets } from '../shared/game/engine'
import { botAction } from '../shared/game/bot'
import type { Creature, Side } from '../shared/game/types'
const unit = (id:string):Creature=>({...catalog[1]!,id,forged:false,currentHealth:3,maxHealth:4,ready:true,shield:false,stunned:false})
function checkDeck(ids:readonly string[]) {
  expect(ids).toHaveLength(30)
  const counts=new Map<string,number>();for(const id of ids){expect(baseCardById.has(id)).toBe(true);counts.set(id,(counts.get(id)??0)+1)}
  expect([...counts.values()].every(n=>n<=2)).toBe(true)
  const cards=ids.map(id=>baseCardById.get(id)!.card)
  expect(cards.filter(c=>c.type==='creature')).toHaveLength(18);expect(cards.filter(c=>c.type==='spell')).toHaveLength(12)
  expect(cards.filter(c=>c.cost<=2)).toHaveLength(10);expect(cards.filter(c=>c.cost>=3&&c.cost<=4)).toHaveLength(12);expect(cards.filter(c=>c.cost>=5)).toHaveLength(8)
}
describe('The Living Arsenal',()=>{
  it('has exactly 80 unique schema-valid base cards with stable IDs and supported mechanics',()=>{
    expect(catalog).toHaveLength(80);expect(baseCards).toHaveLength(80)
    expect(new Set(baseCards.map(c=>c.id)).size).toBe(80);expect(new Set(catalog.map(c=>c.name)).size).toBe(80)
    const identities=catalog.map(({type,cost,attack,health,keywords,effects})=>JSON.stringify({type,cost,attack,health,keywords,effects}))
    expect(new Set(identities).size).toBe(80)
    for(const entry of baseCards){expect(cardSchema.safeParse(entry.card).success,entry.id).toBe(true);expect(entry.role.length).toBeGreaterThan(3);expect(entry.synergy.length).toBeGreaterThan(10);expect(entry.styles.length).toBeGreaterThan(0)
      const balanced=balanceCard(entry.card).card
      // Authored prices are retained; every other rule field already obeys engine limits.
      expect({...balanced,cost:entry.card.cost},entry.card.name).toEqual(entry.card)
    }
  })
  it('actually plays every base card in the deterministic engine with legal targets',()=>{
    for(const entry of baseCards){const s=createGame('card-validation',1);s.phase='main';s.players.you.mana=10;s.players.you.maxMana=10;s.players.you.board=[unit('ally')];s.players.bot.board=[unit('enemy')]
      const card={...entry.card,id:'test-card',baseId:entry.id,forged:false};s.players.you.hand=[card]
      expect(canPlay(s,'you',card),entry.card.name).toBe(true)
      const result=act(s,{type:'play',side:'you',cardId:card.id,targetId:validTargets(s,'you',card)[0]})
      expect(result.error,entry.card.name).toBeUndefined();expect(invariant(result.state),entry.card.name).toBe(true)
    }
  })
  it('generates 400 varied, reproducible decks with the complete curve, identity and playable openings',()=>{
    const variants=new Set<string>(), profiles=new Set<string>()
    for(let seed=0;seed<400;seed++){const deck=generateDeck(seed);checkDeck(deck.cardIds);profiles.add(deck.style);variants.add([...deck.cardIds].sort().join(','));expect(deck).toEqual(generateDeck(seed))
      expect(deck.cardIds.filter(id=>baseCardById.get(id)!.styles.includes(deck.style)).length).toBeGreaterThanOrEqual(10)
      const ordered=openingOrder(deck.cardIds,seed+123);expect([...ordered].sort()).toEqual([...deck.cardIds].sort())
      expect(baseCardById.get(ordered[0]!)!.card).toMatchObject({type:'creature',cost:1})
      expect(baseCardById.get(ordered[1]!)!.card.type).toBe('creature');expect(baseCardById.get(ordered[1]!)!.card.cost).toBeLessThanOrEqual(2)
      expect(baseCardById.get(ordered[2]!)!.card.type).toBe('spell');expect(baseCardById.get(ordered[2]!)!.card.cost).toBeLessThanOrEqual(2)
    }
    expect(variants.size).toBeGreaterThan(350);expect(profiles.size).toBe(7)
  })
  it('keeps preset definitions separate and gives player/bot different random strategies',()=>{
    for(const style of styleIds){checkDeck(presetDecks[style].cardIds);expect(buildDeck(style,2).cardIds).toEqual(buildDeck(style,999).cardIds)
      const state=createGame('preset',42,{deck:style});expect(state.players.you.deckStyle).toBe(style);expect(state.players.bot.deckStyle).not.toBe(style)
      for(const side of ['you','bot'] as const){const all=[...state.players[side].hand,...state.players[side].deck];checkDeck(all.map(card=>card.baseId!));expect(new Set(all.map(card=>card.id)).size).toBe(30)}
    }
  })
  it('filters the collection by name, cost, type and playstyle together',()=>{
    expect(filterLibrary({search:'  blod ',type:'spell',mana:'1-2',style:'sacrifice'}).map(c=>c.card.name)).toEqual(['Blod för kunskap'])
    expect(filterLibrary({search:'',type:'all',mana:'all',style:'all'})).toHaveLength(80)
    expect(filterLibrary({search:'saknas helt',type:'all',mana:'all',style:'all'})).toHaveLength(0)
    expect(filterLibrary({search:'',type:'all',mana:'2',style:'all'}).every(entry=>entry.card.cost===2)).toBe(true)
  })
  it('does not make the bot pay a lethal blood-pact cost',()=>{
    const s=createGame('blood-bot',3);s.phase='main';s.players.you.life=2;s.players.you.mana=10
    s.players.you.hand=[{...baseCardById.get('base:blod-for-kunskap')!.card,id:'blood',forged:false}]
    expect(botAction(s,'you').type).toBe('next')
    s.players.you.life=3;expect(botAction(s,'you').type).toBe('play')
  })
  it('completes 147 matches across all 49 archetype pairings without invalid bot actions or invariant failures',()=>{
    const winners=new Set<string>()
    for(const you of styleIds)for(const bot of styleIds)for(let seed=1;seed<=3;seed++){
      let state=createGame(`arena-${you}-${bot}-${seed}`,seed*997,{deck:you,botDeck:bot}),steps=0
      while(!state.winner&&steps++<1500){const side:Side=state.combat?(state.combat.side==='you'?'bot':'you'):state.active;const action=botAction(state,side),result=act(state,action)
        expect(result.error,`${you}/${bot}: ${JSON.stringify(action)}`).toBeUndefined();state=result.state;expect(invariant(state),`${you}/${bot}`).toBe(true)
      }
      expect(state.winner,`${you}/${bot} stalled`).toBeTruthy();expect(steps).toBeLessThan(1500);winners.add(state.winner!)
    }
    expect(winners.has('you')).toBe(true);expect(winners.has('bot')).toBe(true)
  },30000)
})
