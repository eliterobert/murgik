import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { localArtwork } from '../shared/game/art'
import { baseArtwork } from '../shared/game/base-art'
import { baseCards } from '../shared/game/library'
import type { CardDraft } from '../shared/game/types'

describe('general illustrations without text interpretation',()=>{
  it('retains one existing local illustration for every stable base-card ID',()=>{
    expect(Object.keys(baseArtwork).sort()).toEqual(baseCards.map(entry=>entry.id).sort())
    for(const entry of baseCards){
      const expected=baseArtwork[entry.id]!
      expect(existsSync(`public${expected}`),entry.id).toBe(true)
      expect(localArtwork(entry.card)).toBe(expected)
      expect(localArtwork({...entry.card,baseId:entry.id})).toBe(expected)
      expect(localArtwork({...entry.card,baseId:entry.id,name:'Ändrat visningsnamn',artPrompt:'Ändrad beskrivning'})).toBe(expected)
    }
  })
  it('chooses forged-card placeholders only from the visual palette, independent of names and descriptions',()=>{
    const themes:CardDraft['theme'][]=['ember','forest','void','storm','frost','gold']
    for(const theme of themes){
      const card={name:'',artPrompt:'',type:'creature' as const,theme},expected=localArtwork(card)
      expect(existsSync(`public${expected}`)).toBe(true)
      for(let index=0;index<20;index++){
        expect(localArtwork({...card,name:`Valfri identitet ${index}`,artPrompt:`自由な発想 ${index}`})).toBe(expected)
      }
    }
  })
})
