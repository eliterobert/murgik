import { randomUUID } from 'node:crypto'
import { generateCard, ForgeError } from './forge-service'
import type { ForgeRequest } from './forge-service'
import { generateIllustration } from './forge-illustration'
import { redisRest, type RedisCommand } from './quota-store'

const active=new Set<string>(), consumed=new Map<string,number>()
const RELEASE="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end"
/** No generation quotas in private play. Redis, when configured, adds a shared
 * cross-instance lock. Otherwise the client lock and a bounded local guard apply. */
export async function privateForge(request:ForgeRequest, sid:string, generate=generateCard, illustrate=generateIllustration) {
  const now=Date.now(),key=`${sid}:${request.requestId}`
  for(const[id,expires]of consumed)if(expires<=now)consumed.delete(id)
  if(active.has(sid))throw new ForgeError(409,'Ett smide pågår redan. Vänta tills det är färdigt.')
  if(consumed.has(key))throw new ForgeError(409,'Det här smidesförsöket har redan startats. Inget nytt API-anrop görs.')
  if(consumed.size>=10_000)throw new ForgeError(503,'Smedjans tillfälliga skydd är upptaget. Försök senare.')
  active.add(sid)
  let command:RedisCommand|undefined,lockKey='',lockToken=''
  try {
    const upstash=process.env.UPSTASH_REDIS_REST_URL||process.env.UPSTASH_REDIS_REST_TOKEN
    const url=upstash?process.env.UPSTASH_REDIS_REST_URL:process.env.KV_REST_API_URL,token=upstash?process.env.UPSTASH_REDIS_REST_TOKEN:process.env.KV_REST_API_TOKEN
    if(url||token){
      if(!url||!token)throw new Error('Incomplete storage')
      command=redisRest(url,token);lockKey=`murgik:private:v1:active:${sid}`;lockToken=randomUUID()
      if(await command(['SET',lockKey,lockToken,'NX','PX',300_000])!=='OK')throw new ForgeError(409,'Ett smide pågår redan i en annan serverinstans.')
      if(await command(['SET',`murgik:private:v1:attempt:${key}`,'started','NX','EX',86400])!=='OK')throw new ForgeError(409,'Det här smidesförsöket har redan startats. Inget nytt API-anrop görs.')
    }
    consumed.set(key,now+30*60_000)
    const result=await generate(request,'ai')
    const illustration=await illustrate(request.prompt,result.card)
    return{...result,illustration}
  }catch(error){
    if(error instanceof ForgeError)throw error
    throw new ForgeError(503,'Smidet kunde inte genomföras säkert. Inget automatiskt återförsök görs.')
  }finally{
    active.delete(sid)
    if(command&&lockKey&&lockToken){try{await command(['EVAL',RELEASE,1,lockKey,lockToken])}catch{/* No retry; a stale lock expires. */}}
  }
}
