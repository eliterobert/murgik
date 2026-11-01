import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { shallowRef } from 'vue'
import { generateCard } from '../server/utils/forge-service'
import { generateIllustration, illustrationPrompt } from '../server/utils/forge-illustration'
import { privateForge } from '../server/utils/private-forge'
import { privateForgeMode } from '../server/utils/access'
import { demoForge } from '../shared/game/forge'
import { useIllustrations } from '../app/composables/useIllustrations'
const card=demoForge().card
const jpeg=readFileSync('public/art/dawn-knight.jpg').toString('base64')
const request=()=>({matchId:crypto.randomUUID(),requestId:crypto.randomUUID(),prompt:'En fri idé med tydlig egen identitet och avsikt.',context:{turn:3,life:20,opponentLife:20,maxMana:2,allies:0,enemies:0}})
const text=()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({card,adaptations:[]})}]}]})
const image=()=>Response.json({data:[{b64_json:jpeg}]})
beforeEach(()=>{
 vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_not_real');vi.stubEnv('OPENAI_MODEL','');vi.stubEnv('OPENAI_IMAGE_MODEL','')
 for(const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'])vi.stubEnv(key,'')
})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
describe('explicit one-shot private Forge',()=>{
 it('defaults to AI even with a legacy demo flag and reports a missing key as unavailable',()=>{
  vi.stubEnv('MURGIK_DEMO','true');expect(privateForgeMode().mode).toBe('ai')
  vi.stubEnv('OPENAI_API_KEY','');expect(privateForgeMode().mode).toBe('unavailable')
 })
 it('makes one text and one image request, preserving identity and returning a displayable inline JPEG',async()=>{
  const network=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/responses')?text():image());vi.stubGlobal('fetch',network)
  const input=request(),result=await privateForge(input,crypto.randomUUID())
  expect(result.mode).toBe('ai');expect(result.illustration.status).toBe('ready');expect(result.illustration.url).toBe(`data:image/jpeg;base64,${jpeg}`)
  expect(network.mock.calls.map(call=>String(call[0]))).toEqual(['https://api.openai.com/v1/responses','https://api.openai.com/v1/images/generations'])
  const calls=network.mock.calls as unknown as [string,RequestInit][]
  const textBody=JSON.parse(String(calls[0]![1].body)),imageBody=JSON.parse(String(calls[1]![1].body))
  expect(textBody.model).toBe('gpt-5.4');expect(textBody.max_output_tokens).toBe(4096);expect(textBody.store).toBe(false)
  expect(imageBody).toMatchObject({n:1,quality:'high',output_format:'jpeg',size:'1536x1024'})
  expect(imageBody.prompt).toContain(input.prompt);expect(imageBody.prompt).toContain(result.card.flavor);expect(imageBody.prompt).toContain(result.card.artPrompt)
  expect(calls.every(([,options])=>options.redirect==='error')).toBe(true)
 })
 it('respects model overrides without another provider request',async()=>{
  vi.stubEnv('OPENAI_MODEL','custom-text-model');vi.stubEnv('OPENAI_IMAGE_MODEL','custom-image-model')
  const network=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/responses')?text():image());vi.stubGlobal('fetch',network)
  await privateForge(request(),crypto.randomUUID())
  const calls=network.mock.calls as unknown as [string,RequestInit][]
  expect(JSON.parse(String(calls[0]![1].body)).model).toBe('custom-text-model');expect(JSON.parse(String(calls[1]![1].body)).model).toBe('custom-image-model');expect(network).toHaveBeenCalledTimes(2)
 })
 it('rejects a double submission and a replay; a new explicit attempt remains allowed',async()=>{
  const sid=crypto.randomUUID(),input=request();let complete!:(value:{card:typeof card;adjustments:string[];mode:'ai'})=>void
  const generate=vi.fn(()=>new Promise<{card:typeof card;adjustments:string[];mode:'ai'}>(resolve=>{complete=resolve})),illustrate=vi.fn(async()=>({status:'ready' as const,url:`data:image/jpeg;base64,${jpeg}`}))
  const first=privateForge(input,sid,generate,illustrate)
  await expect(privateForge(input,sid,generate,illustrate)).rejects.toThrow('pågår')
  await expect(privateForge(request(),sid,generate,illustrate)).rejects.toThrow('pågår')
  complete({card,adjustments:[],mode:'ai'});await first
  await expect(privateForge(input,sid,generate,illustrate)).rejects.toThrow('redan startats')
  expect(generate).toHaveBeenCalledTimes(1);expect(illustrate).toHaveBeenCalledTimes(1)
  const second=privateForge(request(),sid,generate,illustrate);complete({card,adjustments:[],mode:'ai'});await second
  expect(generate).toHaveBeenCalledTimes(2);expect(illustrate).toHaveBeenCalledTimes(2)
 })
 it('does not impose the old public session/global quotas on private play',async()=>{
  const sid=crypto.randomUUID(),generate=vi.fn(async()=>({card,adjustments:[],mode:'ai' as const})),illustrate=vi.fn(async()=>({status:'ready' as const,url:'data:image/jpeg;base64,'+jpeg}))
  for(let index=0;index<55;index++)await privateForge(request(),sid,generate,illustrate)
  expect(generate).toHaveBeenCalledTimes(55);expect(illustrate).toHaveBeenCalledTimes(55)
 })
 it('never retries text failures, creates no image and never replaces the idea with a practice card',async()=>{
  for(const response of [new Response('',{status:429}),new Response('',{status:401}),Response.json({status:'incomplete'})]){
   const network=vi.fn(async()=>response);vi.stubGlobal('fetch',network)
   await expect(privateForge(request(),crypto.randomUUID())).rejects.toThrow();expect(network).toHaveBeenCalledTimes(1)
  }
  const network=vi.fn(async()=>{throw new Error('TEST_ONLY_private_upstream_data')});vi.stubGlobal('fetch',network)
  await expect(privateForge(request(),crypto.randomUUID())).rejects.toThrow('Inget automatiskt återförsök')
  expect(network).toHaveBeenCalledTimes(1)
 })
 it('keeps the validated card after one failed image attempt and shows a safe error',async()=>{
  const network=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/responses')?text():new Response('TEST_ONLY_private_upstream_data',{status:403}));vi.stubGlobal('fetch',network)
  const result=await privateForge(request(),crypto.randomUUID())
  expect(result.card).toEqual(card);expect(result.mode).toBe('ai');expect(result.illustration.status).toBe('failed');expect(result.illustration.message).toContain('Inget automatiskt återförsök');expect(JSON.stringify(result)).not.toContain('TEST_ONLY_private_upstream_data');expect(network).toHaveBeenCalledTimes(2)
 })
 it('requires an explicit demo selection to return the offline exercise and never calls the provider for it',async()=>{
  vi.stubEnv('OPENAI_API_KEY','');const network=vi.fn();vi.stubGlobal('fetch',network)
  await expect(generateCard(request(),'ai')).rejects.toThrow('OPENAI_API_KEY')
  expect((await generateCard(request(),'demo')).mode).toBe('demo');expect(network).not.toHaveBeenCalled()
 })
 it('does not generate images while remembering, renaming, rendering or clearing the illustration cache',()=>{
  const network=vi.fn();vi.stubGlobal('fetch',network);vi.stubGlobal('$fetch',network);vi.stubGlobal('useState',()=>shallowRef({}))
  const illustrations=useIllustrations(),art={status:'ready' as const,url:`data:image/jpeg;base64,${jpeg}`}
  illustrations.remember(card,art);illustrations.remember({...card,name:'Ändrat namn'},art)
  expect(Object.values(illustrations.library.value).every(value=>value.url===art.url)).toBe(true)
  illustrations.clear();expect(illustrations.library.value).toEqual({});expect(network).not.toHaveBeenCalled()
 })
 it('fails closed before either provider call when configured private lock storage is unavailable',async()=>{
  vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.test');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','TEST_ONLY_token');vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('offline')}))
  const generate=vi.fn(),illustrate=vi.fn();await expect(privateForge(request(),crypto.randomUUID(),generate,illustrate)).rejects.toThrow('säkert');expect(generate).not.toHaveBeenCalled();expect(illustrate).not.toHaveBeenCalled()
 })
 it('uses shared atomic locks and consumed request IDs across independent server instances',async()=>{
  vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.test');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','TEST_ONLY_token')
  const records=new Map<string,string>()
  vi.stubGlobal('fetch',vi.fn(async(_url:unknown,options:RequestInit)=>{
   const args=JSON.parse(String(options.body)) as (string|number)[]
   let result:unknown
   if(args[0]==='SET'){
    const key=String(args[1]);result=records.has(key)?null:'OK';if(result==='OK')records.set(key,String(args[2]))
   }else if(args[0]==='EVAL'){
    const key=String(args[3]);result=records.get(key)===args[4]?1:0;if(result===1)records.delete(key)
   }else throw new Error('Unexpected storage command')
   return Response.json({result})
  }))
  vi.resetModules();const secondInstance=await import('../server/utils/private-forge')
  const sid=crypto.randomUUID(),input=request();let complete!:(value:{card:typeof card;adjustments:string[];mode:'ai'})=>void
  const generate=vi.fn(()=>new Promise<{card:typeof card;adjustments:string[];mode:'ai'}>(resolve=>{complete=resolve})),illustrate=vi.fn(async()=>({status:'ready' as const,url:'data:image/jpeg;base64,'+jpeg}))
  const first=privateForge(input,sid,generate,illustrate)
  await vi.waitFor(()=>expect(generate).toHaveBeenCalledTimes(1))
  await expect(secondInstance.privateForge(request(),sid,generate,illustrate)).rejects.toThrow('annan serverinstans')
  complete({card,adjustments:[],mode:'ai'});await first
  await expect(secondInstance.privateForge(input,sid,generate,illustrate)).rejects.toThrow('redan startats')
  expect(generate).toHaveBeenCalledTimes(1);expect(illustrate).toHaveBeenCalledTimes(1)
 })
 it('never mixes incomplete Redis credential pairs',async()=>{
  vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.test');vi.stubEnv('KV_REST_API_TOKEN','TEST_ONLY_other_pair')
  const network=vi.fn(),generate=vi.fn(),illustrate=vi.fn();vi.stubGlobal('fetch',network)
  await expect(privateForge(request(),crypto.randomUUID(),generate,illustrate)).rejects.toThrow('säkert')
  expect(network).not.toHaveBeenCalled();expect(generate).not.toHaveBeenCalled();expect(illustrate).not.toHaveBeenCalled()
 })
})
describe('bounded single image generation',()=>{
 it('includes complete player input and final balanced identity without subject-specific substitutions',()=>{
  const prompt=illustrationPrompt('En helt fri idé.',card);expect(prompt).toContain('En helt fri idé.');expect(prompt).toContain(card.name);expect(prompt).toContain(card.flavor);expect(prompt).toContain('no card frame')
 })
 it('rejects oversized, multiple, non-JPEG and URL-only output without fetching another image',async()=>{
  for(const output of [{data:[{b64_json:jpeg},{b64_json:jpeg}]},{data:[{b64_json:'a'.repeat(4_000_000)}]},{data:[{b64_json:Buffer.from('<svg/>').toString('base64')}]},{data:[{url:'https://untrusted.test/image'}]}]){
   const network=vi.fn(async()=>Response.json(output));vi.stubGlobal('fetch',network)
   expect((await generateIllustration('En idé.',card)).status).toBe('failed');expect(network).toHaveBeenCalledTimes(1)
  }
 })
 it('does not retry image timeouts or make any request without a key',async()=>{
  const network=vi.fn(async()=>{throw new Error('timeout')});vi.stubGlobal('fetch',network)
  expect((await generateIllustration('En idé.',card)).status).toBe('failed');expect(network).toHaveBeenCalledTimes(1)
  vi.stubEnv('OPENAI_API_KEY','');await generateIllustration('En idé.',card);expect(network).toHaveBeenCalledTimes(1)
 })
})
