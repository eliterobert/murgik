import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCard } from '../server/utils/forge-service'
import { forgeInstructions } from '../server/utils/forge-instructions'
import { DRAFT_LIFETIME, confirmForgeDraft, issueForgeDraft } from '../server/utils/forge-draft'
import { cardNameSchema } from '../shared/game/card-name'
import { act, createGame, invariant, validTargets } from '../shared/game/engine'
import { balanceCard, powerCost } from '../shared/game/balance'
import { catalog, effect } from '../shared/game/catalog'
import { cardText } from '../shared/game/text'
import type { CardDraft, Creature, GameState } from '../shared/game/types'

const secret='TEST_ONLY_draft_signing_secret_longer_than_32_characters'
const body=(extra:Partial<CardDraft>={}):CardDraft=>({name:'Föreslaget namn',type:'creature',cost:1,attack:2,health:4,keywords:[],effects:[],flavor:'En egen identitet och ton.',artPrompt:'An original visual identity',theme:'gold',...extra})
const unit=(id:string,extra:Partial<Creature>={}):Creature=>({...catalog[0]!,id,forged:false,ready:true,stunned:false,shield:false,currentHealth:4,maxHealth:4,...extra})
const request=(prompt:string)=>({matchId:crypto.randomUUID(),requestId:crypto.randomUUID(),prompt,context:{turn:1,life:20,opponentLife:20,maxMana:1,allies:0,enemies:0}})
const provider=(card:CardDraft,adaptations:string[]=[])=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({card,adaptations})}]}]})

function playGenerated(card:CardDraft) {
 let s=createGame('creative',71);s.turn=3;s.phase='main';s.players.you.life=12;s.players.you.maxMana=10;s.players.you.mana=10;s.players.you.hand=[]
 s.players.you.board=[unit('ally-a',{currentHealth:1,maxHealth:4}),unit('ally-b',{currentHealth:2,maxHealth:5})];s.players.bot.board=[unit('enemy-a'),unit('enemy-b')]
 s=act(s,{type:'forge',side:'you',card}).state
 const generated=s.players.you.hand[0]!,result=act(s,{type:'play',side:'you',cardId:generated.id,targetId:validTargets(s,'you',generated)[0]})
 expect(result.error).toBeUndefined();expect(invariant(result.state)).toBe(true)
 return{state:result.state,id:generated.id}
}
function damage(s:GameState,targetId:string,amount:number) {
 s=structuredClone(s);s.active='bot';s.phase='main';s.players.bot.mana=10
 s.players.bot.hand=[{...catalog[2]!,id:'test-damage',forged:false,cost:1,effects:[effect('damage','enemyCreature',amount)]}]
 const result=act(s,{type:'play',side:'bot',cardId:'test-damage',targetId});expect(result.error).toBeUndefined();return result.state
}
interface Behavior {
 label:string; prompt:string; rules:Partial<CardDraft>
 verify:(state:GameState,id:string,card:CardDraft)=>void
}
const behaviors:Behavior[]=[
 {label:'area damage and targeted control',prompt:'Påverka alla fiendevarelser och hindra ett valt hot från att anfalla.',rules:{effects:[effect('damageAll','allEnemies',1),effect('stun','enemyCreature')]},verify:s=>{expect(s.players.bot.board.map(c=>c.currentHealth)).toEqual([3,3]);expect(s.players.bot.board[0]!.stunned).toBe(true);expect(s.players.you.board[0]!.currentHealth).toBe(1)}},
 {label:'growth after surviving damage',prompt:'Låt varelsen få ökande attack när den överlever skada.',rules:{keywords:['enrage']},verify:(s,id,c)=>{expect(damage(s,id,1).players.you.board.find(unit=>unit.id===id)?.attack).toBe(c.attack+1)}},
 {label:'restoration of all allies',prompt:'Återställ hälsa till alla egna skadade varelser vid inträdet.',rules:{effects:[effect('healCreature','allAllies',2)]},verify:(s,_id,c)=>{expect(s.players.you.board.slice(0,2).map(c=>c.currentHealth)).toEqual([3,4]);expect(s.players.you.life).toBe(12);expect(cardText(c)).toContain('alla dina varelser')}},
 {label:'ordered life-for-resources payment',prompt:'Betala eget liv först och få sedan kortdragning och tillfällig mana.',rules:{effects:[effect('damage','player',2),effect('draw','none',1),effect('gainMana','none',2)]},verify:(s,_id,c)=>{expect(s.players.you.life).toBe(10);expect(s.players.you.hand).toHaveLength(1);expect(s.players.you.mana).toBe(Math.min(10,10-c.cost+2))}},
 {label:'summoning followed by protection',prompt:'Skapa en följeslagare och skydda källvarelsen mot en träff.',rules:{effects:[effect('summon','none',1),effect('shield','self')]},verify:(s,id)=>{expect(s.players.you.board).toHaveLength(4);expect(s.players.you.board.find(c=>c.id===id)?.shield).toBe(true)}}
]
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})

describe('general creative composition',()=>{
 it.each(behaviors)('preserves and executes $label independently of identity',async test=>{
  vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_NOT_REAL')
  for(let variation=0;variation<3;variation++){
   const card=body({...test.rules,name:`Förslag ${variation}`,flavor:`Egen särprägel ${variation}.`,artPrompt:`Visual identity ${variation}`})
   const input=request(`${test.prompt} Särprägel: ${variation}.`),network=vi.fn(async()=>provider(card));vi.stubGlobal('fetch',network)
   const result=await generateCard(input,'ai')
   expect(result.card.name).toBe(card.name);expect(result.card.flavor).toBe(card.flavor);expect(result.card.artPrompt).toBe(card.artPrompt)
   expect(result.card.effects).toEqual(card.effects);expect(result.card.keywords).toEqual(card.keywords);expect(powerCost(result.card)).toBeLessThanOrEqual(10)
   const {state,id}=playGenerated(result.card);test.verify(state,id,result.card)
   expect(network).toHaveBeenCalledTimes(1)
   const payload=JSON.parse((network.mock.calls[0] as unknown as [string,{body:string}])[1].body)
   expect(payload.instructions).toBe(forgeInstructions);expect(JSON.parse(payload.input).description).toBe(input.prompt)
  }
 })
 it('accepts different valid semantic proposals without selecting a local recipe for the input',async()=>{
  vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_NOT_REAL')
  const input=request('En oväntad tolkning med två samverkande beteenden.'),outputs=[body({effects:[effect('healPlayer','player',2),effect('draw','none',1)]}),body({effects:[effect('buff','allAllies',1,1),effect('shield','allAllies')]})]
  const network=vi.fn().mockImplementationOnce(async()=>provider(outputs[0]!)).mockImplementationOnce(async()=>provider(outputs[1]!));vi.stubGlobal('fetch',network)
  for(const expected of outputs){const result=await generateCard(input,'ai');expect(result.card.effects).toEqual(expected.effects);playGenerated(result.card)}
  expect(network).toHaveBeenCalledTimes(2)
 })
 it('shows semantic adaptation notes even when the description contains no recognizable rule terminology',async()=>{
  vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_NOT_REAL')
  const adaptation='Det önskade villkoret stöds inte; istället sker den visade effekten en gång när kortet spelas.'
  vi.stubGlobal('fetch',vi.fn(async()=>provider(body({effects:[effect('draw','none',1)]}),[adaptation])))
  const result=await generateCard(request('Låt min idé påverka förloppet på ett sätt som går utanför det vanliga.'),'ai')
  expect(result.adjustments).toContain(`Tolkning: ${adaptation}`);expect(result.card.effects).toEqual([effect('draw','none',1)])
 })
 it('keeps identity and defining mechanics while reducing an oversized proposal',()=>{
  const original=body({attack:100,health:100,keywords:['enrage','flying'],effects:[effect('healCreature','allAllies',5),effect('draw','none',2)]})
  const {card}=balanceCard(original,{preserveMechanics:true})
  expect(card.name).toBe(original.name);expect(card.flavor).toBe(original.flavor);expect(card.artPrompt).toBe(original.artPrompt)
  expect(card.keywords).toContain('enrage');expect(card.health).toBeGreaterThanOrEqual(2);expect(powerCost(card)).toBeLessThanOrEqual(10);expect(balanceCard(card).card).toEqual(card)
  const crowded=balanceCard({...original,keywords:['guard','flying','haste','enrage']},{preserveMechanics:true}).card
  expect(crowded.keywords).toContain('enrage');expect(crowded.keywords).toHaveLength(2);expect(crowded.health).toBeGreaterThanOrEqual(2)
 })
 it('does not turn unsupported output into invented rules or a generic replacement',async()=>{
  vi.stubEnv('OPENAI_API_KEY','TEST_ONLY_NOT_REAL')
  for(const extra of [{effects:[{...effect('draw','none',1),kind:'customRule'}]},{execute:'arbitrary code'},{name:'<script>'}]){
   vi.stubGlobal('fetch',vi.fn(async()=>provider({...body(),...extra} as CardDraft)))
   await expect(generateCard(request('En fri idé.'),'ai')).rejects.toThrow(/valideringen/)
  }
 })
 it('triggers Raseri only after surviving real damage, caps attack and keeps combat simultaneous',()=>{
  const s=createGame('rage',2);s.turn=3;s.phase='combat';s.players.you.board=[unit('attacker',{attack:2,currentHealth:6,maxHealth:6,keywords:['enrage']})];s.players.bot.board=[unit('defender',{attack:1,keywords:['enrage']})]
  let fight=act(s,{type:'attack',side:'you',attackers:['attacker']}).state;fight=act(fight,{type:'block',side:'bot',attackerId:'attacker',blockerId:'defender'}).state;fight=act(fight,{type:'resolve',side:'bot'}).state
  expect(fight.players.you.board[0]).toMatchObject({attack:3,currentHealth:5});expect(fight.players.bot.board[0]).toMatchObject({attack:2,currentHealth:2})
  const shielded=structuredClone(s);shielded.players.you.board[0]!.shield=true
  expect(damage(shielded,'attacker',1).players.you.board[0]).toMatchObject({attack:2,currentHealth:6,shield:false})
  expect(damage(s,'attacker',6).players.you.graveyard.find(c=>c.id==='attacker')?.attack).toBe(2)
  const capped=structuredClone(s);capped.players.you.board[0]!.attack=10
  expect(damage(capped,'attacker',1).players.you.board[0]!.attack).toBe(10)
  expect(damage(damage(s,'attacker',1),'attacker',1).players.you.board[0]!.attack).toBe(4)
 })
})

describe('server-authorized name editing',()=>{
 it('normalizes names and refuses markup, controls, invisible characters and excessive length',()=>{
  const customName='Mitt egna kortnamn!'
  expect(cardNameSchema.parse(`  ${customName}  `)).toBe(customName)
  for(const name of ['', ' ', 'x'.repeat(49), '<script>alert(1)</script>', 'a\nb','a\u202eb','a\u200bb','---'])expect(cardNameSchema.safeParse(name).success,name).toBe(false)
 })
 it('changes only the name without a provider or store and rejects tampering/session/match/expiry',()=>{
  const matchId=crypto.randomUUID(),requestId=crypto.randomUUID(),accessId=crypto.randomUUID(),now=100000,card=balanceCard(body({effects:[effect('draw','none',1)]}),{preserveMechanics:true}).card
  const token=issueForgeDraft(card,matchId,requestId,accessId,secret,now),network=vi.fn();vi.stubGlobal('fetch',network)
  const input={token,matchId,name:'Mitt egna kortnamn'},renamed=confirmForgeDraft(input,accessId,secret,now)
  expect(renamed).toEqual({...card,name:input.name});expect(network).not.toHaveBeenCalled()
  expect(()=>confirmForgeDraft({...input,card:{...card,cost:0}},accessId,secret,now)).toThrow()
  for(const [request,session,key,time] of [[{...input,token:token+'x'},accessId,secret,now],[{...input,matchId:crypto.randomUUID()},accessId,secret,now],[input,crypto.randomUUID(),secret,now],[input,accessId,'changed',now],[input,accessId,secret,now+DRAFT_LIFETIME],[{...input,name:'<img>'},accessId,secret,now]] as const)expect(()=>confirmForgeDraft(request,session,key,time)).toThrow()
  const {state,id}=playGenerated(renamed);expect(state.players.you.board.find(c=>c.id===id)?.name).toBe(input.name)
 })
 it('fits a maximum-length Unicode card in the bounded confirmation request',()=>{
  const card=balanceCard(body({name:'Å'.repeat(48),flavor:'森'.repeat(180),artPrompt:'森'.repeat(240),effects:[effect('healCreature','allAllies',5),effect('summon','none',2),effect('shield','allAllies')]}),{preserveMechanics:true}).card
  const matchId=crypto.randomUUID(),accessId=crypto.randomUUID(),token=issueForgeDraft(card,matchId,crypto.randomUUID(),accessId,secret)
  const input={token,matchId,name:'Å'.repeat(48)}
  expect(token.length).toBeLessThanOrEqual(6144);expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(8192)
  expect(confirmForgeDraft(input,accessId,secret)).toEqual(card)
 })
})
