import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuotaStore, redisRest, StorageUnavailable } from '../server/utils/quota-store'
import { LEDGER } from '../server/utils/quota-scripts'
import { publicForge } from '../server/utils/public-forge'
import { aiConfiguration, csrfToken, newSession, readSession, safeEqual, verifyChallenge } from '../server/utils/forge-security'
import { forgeRequestSchema } from '../shared/game/schema'
import { demoForge } from '../shared/game/forge'
import { act, createGame, validTargets, canPlay } from '../shared/game/engine'
import { LuaRedis } from './redis-lua'
const request = () => forgeRequestSchema.parse({ matchId: crypto.randomUUID(), requestId: crypto.randomUUID(), prompt: 'Ett kort som kombinerar åkallan med beskydd', context: { turn: 1, life: 20, opponentLife: 20, maxMana: 1, allies: 0, enemies: 0 } })
const response = () => ({ ...demoForge(), mode: 'ai' as const })
const setup = () => { const redis = new LuaRedis(); return { redis, store: new QuotaStore(redis.command) } }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('persistent public Forge, production Lua scripts', () => {
  it('requires an explicitly initialized non-expiring ledger', async () => {
    const { redis, store } = setup(); redis.hashes.clear()
    await expect(store.status('a')).rejects.toBeInstanceOf(StorageUnavailable)
    redis.hashes.set(LEDGER, new Map([['enabled','1'], ['attempts','0']]))
    redis.expires.set(LEDGER, redis.now+1000)
    await expect(store.status('a')).rejects.toBeInstanceOf(StorageUnavailable)
  })
  it('caches success across new store instances without another API call or challenge', async () => {
    const { redis, store } = setup(), r = request(), generate = vi.fn(async () => response()), challenge = vi.fn(async () => {})
    const first = await publicForge(r, 'a', 'ip', store, challenge, generate)
    const cached = await publicForge(r, 'a', 'ip', new QuotaStore(redis.command), challenge, generate)
    expect(first.card).toEqual(cached.card); expect(generate).toHaveBeenCalledTimes(1); expect(challenge).toHaveBeenCalledTimes(1)
    expect(await store.status('a')).toEqual({ globalRemaining: 49, sessionRemaining: 9 })
    await expect(store.lookup('a', { ...r, prompt: 'annat innehåll' })).rejects.toThrow('annat innehåll')
  })
  it('bounds parallel requests per session and globally across function instances', async () => {
    const { redis, store } = setup(), r = request()
    const simultaneous = await Promise.allSettled(Array.from({ length: 20 }, () => new QuotaStore(redis.command).reserve('a', request())))
    expect(simultaneous.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    await store.reserve('b', r)
    await expect(store.reserve('c', request())).rejects.toThrow('upptagen')
    expect((await store.status('d')).globalRemaining).toBe(48)
  })
  it('enforces ten successes per session across matches and store reconstruction', async () => {
    const { redis } = setup()
    for (let i=0; i<10; i++) { const store = new QuotaStore(redis.command), r = request(); await store.reserve('a', r); await store.finish('a', r, response()); redis.now += 6100 }
    const store = new QuotaStore(redis.command)
    expect((await store.status('a')).sessionRemaining).toBe(0)
    await expect(store.reserve('a', request())).rejects.toThrow('tio')
    expect((await store.status('b')).sessionRemaining).toBe(10)
  })
  it('preserves the three-charges match rule server-side for real AI', async () => {
    const { redis, store } = setup(), r = request()
    for (let i=0; i<3; i++) { const next = { ...r, requestId: crypto.randomUUID() }; await store.reserve('a', next); await store.finish('a', next, response()); redis.now += 6100 }
    await expect(store.reserve('a', { ...r, requestId: crypto.randomUUID() })).rejects.toThrow('tre')
  })
  it('reserves at most 50 attempts including failures, without refunds or automatic retries', async () => {
    const { redis, store } = setup()
    for (let i=0; i<50; i++) { const r = request(); await store.reserve(`s${i}`, r); await store.finish(`s${i}`, r, null); redis.now += 6100 }
    expect((await store.status('a')).globalRemaining).toBe(0)
    await expect(store.reserve('new-session', request())).rejects.toThrow('50')
    expect(redis.hashes.get(LEDGER)!.get('attempts')).toBe('50')
  })
  it('races at the last global attempt without exceeding 50', async () => {
    const { redis, store } = setup(); redis.hashes.get(LEDGER)!.set('attempts','49')
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => new QuotaStore(redis.command).reserve(`s${i}`, request())))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await store.status('a')).globalRemaining).toBe(0)
  })
  it('never reissues pending or failed request IDs, even after a crashed function lease expires', async () => {
    const { redis, store } = setup(), r = request()
    await store.reserve('a', r); redis.now += 46000
    await expect(store.lookup('a', r)).rejects.toThrow('kunde inte slutföras')
    await expect(store.reserve('a', r)).rejects.toThrow('behandlas')
    const next = request(); await store.reserve('a', next)
    await expect(store.finish('a', r, response())).rejects.toThrow('innehåll')
    await store.finish('a', next, null)
    await expect(store.reserve('a', next)).rejects.toThrow('misslyckades')
    expect((await store.status('a')).sessionRemaining).toBe(9)
  })
  it('rate-limits a session and hashed IP atomically, including across new sessions', async () => {
    const { redis, store } = setup()
    for (let i=0; i<12; i++) await store.rate('a','ip')
    await expect(store.rate('a','other-ip')).rejects.toThrow('många')
    for (let i=0; i<12; i++) await store.rate(`s${i}`,'ip')
    await expect(store.rate('fresh','ip')).rejects.toThrow('många')
    redis.now += 61000; await store.rate('a','ip')
  })
  it('retains uncertain session slots across repeated function crashes', async () => {
    const { redis, store } = setup()
    for (let i=0; i<10; i++) { await store.reserve('a', request()); redis.now += 46000 }
    expect((await store.status('a')).sessionRemaining).toBe(0)
    await expect(store.reserve('a',request())).rejects.toThrow('tio')
    expect((await store.status('a')).globalRemaining).toBe(40)
  })
  it('fails closed to demo before reservation when storage is unavailable', async () => {
    const { redis, store } = setup(); redis.available = false
    const generate = vi.fn(async (r, mode) => ({ ...demoForge(r.prompt), mode })), challenge = vi.fn()
    expect((await publicForge(request(),'a','ip',store,challenge,generate)).mode).toBe('demo')
    expect(generate).toHaveBeenCalledWith(expect.anything(),'demo'); expect(challenge).not.toHaveBeenCalled()
  })
  it('does not call OpenAI when reservation confirmation is lost', async () => {
    const { store } = setup(), generate = vi.fn()
    vi.spyOn(store,'reserve').mockRejectedValue(new StorageUnavailable())
    await expect(publicForge(request(),'a','ip',store,async()=>{},generate)).rejects.toThrow('reservationen')
    expect(generate).not.toHaveBeenCalled()
  })
  it('replays a committed result after a lost completion response', async () => {
    const { redis, store } = setup(), r = request(), generate = vi.fn(async () => response())
    const original = store.finish.bind(store)
    vi.spyOn(store,'finish').mockImplementation(async (...args) => { await original(...args); throw new StorageUnavailable() })
    await expect(publicForge(r,'a','ip',store,async()=>{},generate)).rejects.toThrow('kvittens')
    expect((await publicForge(r,'a','ip',new QuotaStore(redis.command),async()=>{},generate)).mode).toBe('ai')
    expect(generate).toHaveBeenCalledTimes(1)
  })
  it('leaves failed upstream attempts spent and rejects invalid challenges before reservation', async () => {
    const { store } = setup(), r = request(), generate = vi.fn(async () => { throw new Error('upstream') })
    await expect(publicForge(r,'a','ip',store,async()=>{throw new Error('captcha')},generate)).rejects.toThrow('captcha')
    expect((await store.status('a')).globalRemaining).toBe(50)
    await expect(publicForge(r,'a','ip',store,async()=>{},generate)).rejects.toThrow('misslyckades')
    expect((await store.status('a')).globalRemaining).toBe(49); expect((await store.status('a')).sessionRemaining).toBe(10)
  })
  it('uses local demo after a budget is exhausted, making no paid attempt', async () => {
    const { redis, store } = setup(); redis.hashes.get(LEDGER)!.set('attempts','50')
    const generate = vi.fn(async (r, mode) => ({ ...demoForge(r.prompt), mode }))
    expect((await publicForge(request(),'a','ip',store,async()=>{},generate)).mode).toBe('demo')
    expect(generate).toHaveBeenCalledWith(expect.anything(),'demo')
  })
})
describe('anonymous session and AI configuration', () => {
  it('signs cookies, rejects tampering and separates CSRF and session signatures', () => {
    const secret = 'test-secret-at-least-thirty-two-characters', session = newSession(secret)
    expect(readSession(session.cookie, secret)).toBe(session.id)
    expect(readSession(session.cookie+'x',secret)).toBeNull(); expect(readSession(session.cookie,'other')).toBeNull()
    expect(readSession(session.cookie+'.extra',secret)).toBeNull()
    expect(readSession(undefined,secret)).toBeNull(); expect(safeEqual(csrfToken(session.id, secret), session.cookie.split('.')[1]!)).toBe(false)
  })
  it('disables AI without a key, persistent storage, signing secret, bot protection or HTTPS origin', () => {
    const env = { OPENAI_API_KEY: 'test', UPSTASH_REDIS_REST_URL: 'https://example.test', UPSTASH_REDIS_REST_TOKEN: 'test', MURGIK_SESSION_SECRET: 'test-secret-at-least-thirty-two-characters', TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret', MURGIK_PUBLIC_ORIGIN: 'https://murgik.example' }
    expect(aiConfiguration(env).reason).toBeUndefined()
    for (const key of Object.keys(env)) expect(aiConfiguration({ ...env, [key]: undefined }).reason).toBeTruthy()
    expect(aiConfiguration({ ...env, MURGIK_DEMO:'true' }).reason).toBeTruthy()
    expect(aiConfiguration({ ...env, MURGIK_PUBLIC_ORIGIN:'http://example.test' }).reason).toBeTruthy()
  })
  it('validates Turnstile success, hostname and action server-side; rejects service failures', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY','test')
    for (const data of [{ success:false }, { success:true,hostname:'evil.test',action:'murgik-forge' }, { success:true,hostname:'murgik.example',action:'other' }]) {
      vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>data})))
      await expect(verifyChallenge('token','https://murgik.example')).rejects.toThrow('kontrollen')
    }
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({success:true,hostname:'murgik.example',action:'murgik-forge'})})))
    await expect(verifyChallenge('token','https://murgik.example')).resolves.toBeUndefined()
    await expect(verifyChallenge(undefined,'https://murgik.example')).rejects.toThrow('kontrollen')
  })
  it('limits input and rejects client-invented fields and mechanisms', () => {
    expect(forgeRequestSchema.safeParse({ ...request(), prompt:'x'.repeat(501) }).success).toBe(false)
    expect(forgeRequestSchema.safeParse({ ...request(), quota:999 }).success).toBe(false)
    expect(forgeRequestSchema.safeParse({ ...request(), challengeToken:'x'.repeat(2049) }).success).toBe(false)
  })
  it('never leaks upstream response bodies and refuses invalid Redis endpoints', async () => {
    expect(()=>redisRest('http://example.test','test')).toThrow(StorageUnavailable)
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:401,text:async()=>'private upstream data'})))
    await expect(redisRest('https://example.test','test')(['PING'])).rejects.toThrow('Persistent storage unavailable')
  })
})
