import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import * as h3 from 'h3'
import { ACCESS_COOKIE, ACCESS_LIFETIME, accessConfiguration, accessCsrf, issueAccess, passwordMatches, verifyAccess, privateForgeEnabled } from '../server/utils/access'
import { demoForge } from '../shared/game/forge'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { basename, dirname, resolve, join } from 'node:path'
import { loadDotenv } from 'c12'
const password = 'TEST_ONLY_access_password', secret = 'TEST_ONLY_session_secret_longer_than_32_characters'
const nativeFetch = globalThis.fetch
const request = () => ({ matchId: crypto.randomUUID(), requestId: crypto.randomUUID(), prompt: 'En snabb liten glödvarg med hast', context: { turn:1, life:20, opponentLife:20, maxMana:1, allies:0, enemies:0 } })
let server: Server, base: string
function globals() { for (const [name, value] of Object.entries(h3)) vi.stubGlobal(name,value) }
beforeAll(async () => {
  globals()
  const [middleware, login, logout, session, mode, forge] = await Promise.all([
    import('../server/middleware/access'), import('../server/api/auth/login.post'), import('../server/api/auth/logout.post'),
    import('../server/api/auth/session.get'), import('../server/api/mode.get'), import('../server/api/forge.post')
  ])
  const app = h3.createApp(), router = h3.createRouter()
  router.post('/api/auth/login',login.default).post('/api/auth/logout',logout.default).get('/api/auth/session',session.default).get('/api/mode',mode.default).post('/api/forge',forge.default)
  app.use(middleware.default); app.use(router)
  server = createServer(h3.toNodeListener(app)); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  base = `http://127.0.0.1:${(server.address() as {port:number}).port}`
})
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))})
beforeEach(()=>{
  globals(); vi.stubEnv('MURGIK_ACCESS_PASSWORD',password);vi.stubEnv('MURGIK_SESSION_SECRET',secret);vi.stubEnv('MURGIK_DEMO','false');vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_not_real');vi.stubEnv('MURGIK_PUBLIC_ORIGIN',base);vi.stubEnv('MURGIK_PRIVATE_FORGE','')
  for (const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY']) vi.stubEnv(key,'')
})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
const post = (path: string, body: unknown, headers: Record<string,string> = {}) => nativeFetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
async function authenticated() {
  const response = await post('/api/auth/login',{password}), cookie = response.headers.get('set-cookie')!.split(';')[0]!
  const state = await (await nativeFetch(base+'/api/auth/session',{headers:{Cookie:cookie}})).json()
  return { cookie, csrf: state.csrf as string }
}
describe('signed private access',()=>{
  it('loads login configuration through the actual dev dotenv selection without enabling paid AI',async()=>{
    // Use only generated fixture files. Never open the project's private .env.
    const {scripts}=JSON.parse(await readFile('package.json','utf8'))
    const files=[...scripts.dev.matchAll(/--dotenv\s+(\S+)/g)].map(match=>match[1])
    const cacheDirectory=resolve('node_modules/.cache/')
    await mkdir(cacheDirectory,{recursive:true})
    const directory=await mkdtemp(join(cacheDirectory,'murgik-access-env-'))
    try {
      await writeFile(join(directory,'.env'),`MURGIK_ACCESS_PASSWORD=${password}\nMURGIK_SESSION_SECRET=${secret}\nMURGIK_DEMO=false\n`)
      await writeFile(join(directory,'.env.demo'),await readFile('.env.demo','utf8'))
      // c12 is the actual dotenv loader used by the installed Nuxt CLI.
      const loaded=await loadDotenv({cwd:directory,fileName:files,env:{},interpolate:true})
      expect(accessConfiguration(loaded)).not.toBeNull()
      expect(loaded.MURGIK_DEMO).toBe('true')
      for(const name of ['MURGIK_ACCESS_PASSWORD','MURGIK_SESSION_SECRET']) vi.stubEnv(name,loaded[name])
      const result=await(await nativeFetch(base+'/api/auth/session')).json()
      expect(result).toEqual({configured:true,authenticated:false,privateForge:true})
      expect(JSON.stringify(result)).not.toContain(password)
      expect(JSON.stringify(result)).not.toContain(secret)
    } finally {
      if(dirname(directory)!==cacheDirectory || !basename(directory).startsWith('murgik-access-env-')) throw new Error('Unsafe test fixture cleanup path')
      await rm(directory,{recursive:true,force:true})
    }
  })
  it('reads deployment-injected credentials at request time and exposes only status booleans',async()=>{
    vi.stubEnv('MURGIK_ACCESS_PASSWORD','')
    expect((await(await nativeFetch(base+'/api/auth/session')).json()).configured).toBe(false)
    vi.stubEnv('MURGIK_ACCESS_PASSWORD',password)
    expect(await(await nativeFetch(base+'/api/auth/session')).json()).toEqual({configured:true,authenticated:false,privateForge:true})
  })
  it('checks passwords and rejects missing or short signing configuration',()=>{
    expect(passwordMatches(password,password)).toBe(true);expect(passwordMatches('wrong',password)).toBe(false)
    expect(accessConfiguration({})).toBeNull();expect(accessConfiguration({MURGIK_ACCESS_PASSWORD:password,MURGIK_SESSION_SECRET:'short'})).toBeNull()
  })
  it('signs an expiring session and invalidates tampering, password changes and secret rotation',()=>{
    const now=Date.now(), issued=issueAccess(password,secret,now)
    expect(verifyAccess(issued.cookie,password,secret,now)?.id).toBe(issued.session.id)
    expect(verifyAccess(issued.cookie,password,secret,now-1000)).toBeTruthy()
    expect(verifyAccess(issued.cookie+'x',password,secret,now)).toBeNull()
    expect(verifyAccess(issued.cookie+'.extra',password,secret,now)).toBeNull()
    expect(verifyAccess(issued.cookie,'changed',secret,now)).toBeNull()
    expect(verifyAccess(issued.cookie,password,'changed',now)).toBeNull()
    expect(verifyAccess(issued.cookie,password,secret,now+ACCESS_LIFETIME*1000)).toBeNull()
    expect(accessCsrf(issued.session,secret)).not.toBe(issued.cookie.split('.')[1])
  })
  it('keeps public quota mode available through an explicit opt-out',()=>{
    expect(privateForgeEnabled()).toBe(true);vi.stubEnv('MURGIK_PRIVATE_FORGE','false');expect(privateForgeEnabled()).toBe(false)
  })
  it('denies anonymous access to Forge, mode, art and case/encoding variants before routing',async()=>{
    for(const path of ['/api/mode','/api/forge','/api/art/test','/API/forge','/api/%66orge','/__nuxt_island/test']) expect((await nativeFetch(base+path)).status).toBe(401)
    expect((await post('/api/forge',request())).status).toBe(401)
    expect((await (await nativeFetch(base+'/api/auth/session')).json()).authenticated).toBe(false)
  })
  it('fails closed if access is not configured',async()=>{
    vi.stubEnv('MURGIK_ACCESS_PASSWORD','')
    expect((await post('/api/auth/login',{password})).status).toBe(503)
    expect((await nativeFetch(base+'/api/mode')).status).toBe(503)
    expect((await (await nativeFetch(base+'/api/auth/session')).json()).configured).toBe(false)
  })
  it('reports unconfigured access when both variables exist but the session secret is too short',async()=>{
    vi.stubEnv('MURGIK_SESSION_SECRET','TEST_ONLY_short')
    const result=await(await nativeFetch(base+'/api/auth/session')).json()
    expect(result).toEqual({configured:false,authenticated:false,privateForge:false})
    expect((await post('/api/auth/login',{password})).status).toBe(503)
    expect(JSON.stringify(result)).not.toContain(password)
    expect(JSON.stringify(result)).not.toContain('TEST_ONLY_short')
  })
  it('rejects wrong passwords and sets an HttpOnly SameSite cookie on login',async()=>{
    const wrong=await post('/api/auth/login',{password:'wrong'});expect(wrong.status).toBe(401);expect(wrong.headers.get('set-cookie')).toBeNull()
    const success=await post('/api/auth/login',{password});expect(success.status).toBe(200)
    const cookie=success.headers.get('set-cookie')!;expect(cookie).toContain(ACCESS_COOKIE);expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Strict')
    expect(cookie).not.toContain(password);expect(await success.text()).not.toContain(secret)
  })
  it('rejects cross-origin login, oversized input and unknown fields',async()=>{
    expect((await post('/api/auth/login',{password},{Origin:'https://other.test'})).status).toBe(403)
    expect((await post('/api/auth/login',{password:'x'.repeat(5000)})).status).toBe(413)
    expect((await post('/api/auth/login',{password,admin:true})).status).toBe(400)
  })
  it('persists authentication across requests and refuses forged or expired cookies',async()=>{
    const {cookie}=await authenticated()
    expect((await nativeFetch(base+'/api/mode',{headers:{Cookie:cookie}})).status).toBe(200)
    expect((await nativeFetch(base+'/api/mode',{headers:{Cookie:cookie+'x'}})).status).toBe(401)
    const expired=issueAccess(password,secret,Date.now()-ACCESS_LIFETIME*1000-1)
    expect((await nativeFetch(base+'/api/mode',{headers:{Cookie:`${ACCESS_COOKIE}=${expired.cookie}`}})).status).toBe(401)
  })
  it('runs validated AI Forge after login without Redis or Turnstile calls',async()=>{
    const {cookie,csrf}=await authenticated(), card=demoForge('quick wolf').card
    const calls:string[]=[]
    vi.stubGlobal('fetch',async(input: RequestInfo|URL,init?: RequestInit)=>{
      const url=String(input);calls.push(url)
      if(url==='https://api.openai.com/v1/responses') return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(card)}]}]})
      throw new Error('Unexpected external call')
    })
    const mode=await(await nativeFetch(base+'/api/mode',{headers:{Cookie:cookie}})).json();expect(mode.mode).toBe('ai');expect(mode.privateForge).toBe(true);expect(mode.siteKey).toBeUndefined()
    const response=await post('/api/forge',request(),{Cookie:cookie,'X-Murgik-Access-CSRF':csrf})
    expect(response.status).toBe(200);const result=await response.json();expect(result.mode).toBe('ai');expect(result.card).toEqual(card);expect(result.illustration.status).toBe('disabled')
    expect(calls).toEqual(['https://api.openai.com/v1/responses'])
  })
  it('preserves CSRF, origin and prompt validation for private Forge',async()=>{
    const {cookie,csrf}=await authenticated(), calls=vi.fn();vi.stubGlobal('fetch',calls)
    expect((await post('/api/forge',request(),{Cookie:cookie})).status).toBe(403)
    expect((await post('/api/forge',request(),{Cookie:cookie,'X-Murgik-Access-CSRF':csrf,Origin:'https://other.test'})).status).toBe(403)
    expect((await post('/api/forge',{...request(),prompt:'x'.repeat(501)},{Cookie:cookie,'X-Murgik-Access-CSRF':csrf})).status).toBe(400)
    expect(calls).not.toHaveBeenCalled()
  })
  it('uses demo without an API key even for authenticated users',async()=>{
    vi.stubEnv('OPENAI_API_KEY','');const {cookie,csrf}=await authenticated();const calls=vi.fn();vi.stubGlobal('fetch',calls)
    const result=await(await post('/api/forge',request(),{Cookie:cookie,'X-Murgik-Access-CSRF':csrf})).json()
    expect(result.mode).toBe('demo');expect(calls).not.toHaveBeenCalled()
  })
  it('preserves fail-closed public mode when explicitly selected without Redis',async()=>{
    vi.stubEnv('MURGIK_PRIVATE_FORGE','false');const {cookie,csrf}=await authenticated();const calls=vi.fn();vi.stubGlobal('fetch',calls)
    const mode=await(await nativeFetch(base+'/api/mode',{headers:{Cookie:cookie}})).json()
    expect(mode.mode).toBe('demo');expect(mode.privateForge).toBeUndefined()
    const result=await(await post('/api/forge',request(),{Cookie:cookie,'X-Murgik-Access-CSRF':csrf})).json()
    expect(result.mode).toBe('demo');expect(calls).not.toHaveBeenCalled()
  })
  it('clears the cookie on logout, requires CSRF and refuses further anonymous API calls',async()=>{
    const {cookie,csrf}=await authenticated()
    expect((await post('/api/auth/logout',{}, {Cookie:cookie})).status).toBe(403)
    const result=await post('/api/auth/logout',{}, {Cookie:cookie,'X-Murgik-Access-CSRF':csrf})
    expect(result.status).toBe(200);expect(result.headers.get('set-cookie')).toMatch(/Max-Age=0/)
    expect((await nativeFetch(base+'/api/mode')).status).toBe(401)
  })
})
