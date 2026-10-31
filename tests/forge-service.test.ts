import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCard } from '../server/utils/forge-service'
import { demoForge } from '../shared/game/forge'
import { forgeRequestSchema } from '../shared/game/schema'
import { act, canPlay, createGame } from '../shared/game/engine'

const request = () => forgeRequestSchema.parse({ matchId: crypto.randomUUID(), requestId: crypto.randomUUID(), prompt: 'En snabb liten glödvarg med hast', context: { turn: 1, life: 20, opponentLife: 20, maxMana: 1, allies: 0, enemies: 0 } })
const generated = async () => ({ ...demoForge('haste wolf'), mode: 'demo' as const })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('server Forge transaction', () => {
  it('demo never makes a network request or needs credentials', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network)
    const result = await generateCard(request(), 'demo')
    expect(result.mode).toBe('demo'); expect(network).not.toHaveBeenCalled()
  })
  it('validates and balances a mocked real-AI structured response', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key')
    const card = demoForge('dragon').card
    const network = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(card) }] }] }) })
    vi.stubGlobal('fetch', network)
    const result = await generateCard(request(), 'ai')
    expect(result.card).toEqual(card); expect(result.mode).toBe('ai')
    const body = JSON.parse(network.mock.calls[0]![1].body)
    expect(body.text.format.strict).toBe(true); expect(body.store).toBe(false); expect(body.max_output_tokens).toBe(1200)
  })
  it('accepts a novel combination of implemented mechanics and plays the generated card', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key')
    const card = { name:'Korparnas runriddare',type:'creature',flavor:'En sköld av lånade vingar.',cost:0,attack:2,health:3,keywords:['flying'],effects:[{kind:'summon',target:'none',amount:1,secondary:0,filter:'any'},{kind:'shield',target:'self',amount:1,secondary:0,filter:'any'}],artPrompt:'A raven knight with a spectral companion',theme:'void' }
    const network = vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(card)}]}]})})
    vi.stubGlobal('fetch',network)
    const result = await generateCard(request(),'ai')
    const state = createGame(); state.phase = 'main'; state.players.you.mana = 10; state.players.you.maxMana = 10
    const forged = act(state,{type:'forge',side:'you',card:result.card}); expect(forged.error).toBeUndefined()
    const playable = forged.state.players.you.hand.find(c=>c.name === card.name)!
    expect(canPlay(forged.state,'you',playable)).toBe(true)
    const played = act(forged.state,{type:'play',side:'you',cardId:playable.id})
    expect(played.error).toBeUndefined(); expect(played.state.players.you.board).toHaveLength(2)
    expect(played.state.players.you.board.find(c=>c.name === card.name)?.shield).toBe(true)
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('rejects upstream errors and malformed/unfinished outputs', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key')
    for (const response of [
      { ok: false, status: 429 },
      { ok: true, json: async () => ({ status: 'incomplete' }) },
      { ok: true, json: async () => ({ status: 'completed', output: [] }) },
      { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"code":"evil"}' }] }] }) }
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      await expect(generateCard(request(), 'ai')).rejects.toThrow()
    }
  })
})

