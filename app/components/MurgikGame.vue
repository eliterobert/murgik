<script setup lang="ts">
import { sv } from '@nuxt/ui/locale'
import { act, availableAttackers, canBlock, canPlay, createGame, isPreparationTurn, needsTarget, validTargets } from '#shared/game/engine'
import { botAction } from '#shared/game/bot'
import { catalog } from '#shared/game/catalog'
import { cardText, keywordHelp, keywordNames } from '#shared/game/text'
import type { Action, Card, CardDraft, Creature, GameState } from '#shared/game/types'
import type { Illustration } from '#shared/game/art'
import { phaseLabels } from '#shared/game/rules'
import { actionSounds } from '#shared/audio/cues'
import { deckStyles } from '#shared/game/decks'
import type { DeckChoice } from '#shared/game/decks'
import { CARD_NAME_HELP, CARD_NAME_MAX, cardNameSchema } from '#shared/game/card-name'
const props = defineProps<{ accessCsrf: string }>()

// Engine snapshots are immutable. Keep them plain so structuredClone never receives a Vue proxy.
const game = shallowRef<GameState | null>(null)
const you = computed(() => game.value?.players.you)
const enemy = computed(() => game.value?.players.bot)
interface ForgeMode { mode: 'unavailable' | 'ai'; images?: boolean; privateForge?: boolean; reason?: string; csrf?: string; siteKey?: string; quota?: { sessionRemaining: number; globalRemaining: number } }
// Bootstrap the HttpOnly session in the browser; an internal SSR fetch would lose Set-Cookie.
const { data: modeData, error: modeError } = await useFetch<ForgeMode>('/api/mode', { server: false, retry: 0 })
const demoRequested = ref(false)
const mode = computed(() => demoRequested.value ? 'demo' : modeData.value?.mode ?? 'unavailable')
const modeReason = computed(() => modeData.value?.reason || (modeError.value ? 'AI-status kunde inte läsas. Försök ladda om sidan eller välj övningsläge uttryckligen.' : 'AI-status laddas.'))
const tutorial = ref(false)
const libraryOpen = ref(false)
const deckChoice = ref<DeckChoice>('random')
const yourDeck = computed(() => you.value?.deckStyle ? deckStyles[you.value.deckStyle] : null)
const enemyDeck = computed(() => enemy.value?.deckStyle ? deckStyles[enemy.value.deckStyle] : null)
const clientReady = ref(false)
const forgeOpen = ref(false)
const forgeBusy = ref(false)
const forgePrompt = ref('')
const forgeError = ref('')
const challengeToken = ref('')
const challengeVersion = ref(0)
const forgeResult = ref<{ card: CardDraft; adjustments: string[]; mode: string; draftToken: string; illustration: Illustration } | null>(null)
const forgeName = ref('')
const forgeDescription = ref('')
const forgeNameValid = computed(() => cardNameSchema.safeParse(forgeName.value).success)
const previewCard = computed(() => forgeResult.value ? { ...forgeResult.value.card, name: forgeName.value.trim() || forgeResult.value.card.name } : null)
const forgeTicket = ref<{ id: string; prompt: string; context: { turn: number; life: number; opponentLife: number; maxMana: number; allies: number; enemies: number } } | null>(null)
const selectedCard = ref<string | null>(null)
const attackers = ref<string[]>([])
const selectedBlocker = ref<string | null>(null)
const inspected = ref<CardDraft | null>(null)
const liveInspected = computed(() => {
  const initial = inspected.value
  const id = initial && 'id' in initial ? initial.id : undefined
  if (typeof id === 'string' && game.value) {
    for (const player of Object.values(game.value.players)) {
      const current = [...player.hand, ...player.board, ...player.graveyard].find(c => c.id === id)
      if (current) return current
    }
  }
  return initial ?? catalog[0]!
})
const notice = ref('')
const restartOpen = ref(false)
const matchVersion = ref(0)
const { muted, toggle: toggleSound, play: playSound, stopAll: stopAudio, stop: stopSound, masterVolume, effectsVolume, unavailable: audioUnavailable } = useGameAudio()
function hoverSound(event: PointerEvent | FocusEvent) {
  const card = (event.target as HTMLElement | null)?.closest('button.game-card')
  if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return
  playSound('hover')
}
const { effects, turnBanner, botCard, botMessage, capture, clear: clearEffects } = useBattleEffects()
const { remember: rememberArt, clear: clearArt } = useIllustrations()
watch(previewCard, card => { if (card && forgeResult.value) rememberArt(card, forgeResult.value.illustration) })
const introVisible = ref(false)
const introSeen = ref(true)
function dismissIntro() {
  introVisible.value = false; introSeen.value = true
  try { localStorage.setItem('murgik-intro-seen', 'true') } catch { /* Storage is optional. */ }
}
const suggestions = [
  { name: 'Tryck och kontroll', text: 'Ett kort som skadar fiendevarelser och hindrar ett valt hot från att anfalla.', icon: 'sword' },
  { name: 'Skydd och styrka', text: 'Ett kort som förstärker en egen varelse och skyddar den mot en träff.', icon: 'shield' },
  { name: 'Resurser med risk', text: 'Ett kort som betalar eget liv för kortdragning och tillfällig mana.', icon: 'heart' },
  { name: 'Återhämtning', text: 'Ett kort som återställer hälsa till mina skadade varelser.', icon: 'spark' }
]
const phaseNames = phaseLabels
const preparation = computed(() => !!game.value && isPreparationTurn(game.value))
const visiblePhases = computed(() => Object.entries(phaseNames).filter(([key]) => !preparation.value || key !== 'combat'))
const yourAttackers = computed(() => game.value ? availableAttackers(game.value, 'you') : [])
const selected = computed(() => you.value?.hand.find(c => c.id === selectedCard.value))
const targets = computed(() => game.value && selected.value ? validTargets(game.value, 'you', selected.value) : [])
const humanMain = computed(() => game.value?.active === 'you' && game.value?.phase === 'main' && !game.value.combat && !game.value.winner)
const defending = computed(() => game.value?.combat?.side === 'bot')
const busy = computed(() => forgeBusy.value || !!game.value?.winner)
const forgeAvailable = computed(() => humanMain.value && !forgeBusy.value && (you.value?.charges ?? 0) > 0 && (you.value?.hand.length ?? 10) < 10)
const nextLabel = computed(() => {
  if (defending.value) return 'Bekräfta försvar'
  if (game.value?.active === 'bot' || game.value?.combat) return 'Veyra tänker…'
  return ({ draw: 'Till huvudfas', main: yourAttackers.value.length ? 'Gå till attack' : 'Avsluta tur', combat: !yourAttackers.value.length ? 'Avsluta tur' : attackers.value.length ? `Anfall med ${attackers.value.length}` : 'Avstå anfall', end: 'Avsluta tur' })[game.value?.phase ?? 'main']
})
const hint = computed(() => {
  if (selected.value) return `Välj ett markerat mål för ${selected.value.name}. Esc avbryter.`
  if (defending.value) return selectedBlocker.value ? 'Välj en anfallande fiende att blockera.' : 'Välj en egen varelse, sedan en anfallare. Vakter blockerar automatiskt.'
  if (game.value?.active === 'bot') return 'Veyra väver sin nästa plan.'
  if (preparation.value) return 'Bygg ditt slagfält. Båda får en förberedelsetur innan anfall tillåts.'
  if (game.value?.phase === 'combat') return 'Markera dina redo varelser och bekräfta anfallet.'
  if (game.value?.phase === 'end') return 'Striden är över. Lämna över turen när du är redo.'
  return 'Spela ett kort ur handen eller smid något ingen sett förut.'
})
let timer: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function toast(text: string) {
  notice.value = text; clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 4500)
}
function start() {
  clearTimeout(timer); matchVersion.value++
  clearEffects(); clearArt(); stopAudio(); playSound('turn'); playSound('draw', .1)
  game.value = createGame(crypto.randomUUID(), Math.floor(Math.random() * 0xFFFFFFFF), { deck: deckChoice.value })
  selectedCard.value = null; selectedBlocker.value = null; attackers.value = []
  forgeResult.value = null; forgeName.value = ''; forgeTicket.value = null; forgeError.value = ''; forgeOpen.value = false; restartOpen.value = false
  inspected.value = null
  introVisible.value = !introSeen.value
}
function dispatch(action: Action) {
  if (!game.value) return false
  const result = act(game.value, action)
  if (result.error) { toast(result.error); return false }
  const events = capture(game.value, result.state, action)
  for (const cue of actionSounds(game.value, result.state, action, events)) playSound(cue.sound, cue.delay)
  game.value = result.state
  return true
}
function play(card: Card) {
  if (!game.value || busy.value) return
  if (!canPlay(game.value, 'you', card)) {
    toast(game.value.phase !== 'main' || game.value.active !== 'you' ? 'Kort spelas under din huvudfas.' : card.cost > (you.value?.mana ?? 0) ? 'Du har inte tillräckligt med mana.' : 'Kortet saknar giltiga mål eller plats på slagfältet.')
    return
  }
  if (needsTarget(card)) { selectedCard.value = selectedCard.value === card.id ? null : card.id; playSound('select') }
  else { dispatch({ type: 'play', side: 'you', cardId: card.id }); selectedCard.value = null }
}
function target(id: string) {
  if (forgeBusy.value) return
  if (selected.value && targets.value.includes(id)) {
    if (dispatch({ type: 'play', side: 'you', cardId: selected.value.id, targetId: id })) selectedCard.value = null
  }
}
function unitClick(unit: Creature, side: 'you' | 'bot') {
  if (!game.value || busy.value) return
  if (selected.value) { target(unit.id); return }
  if (defending.value) {
    if (side === 'you') {
      if (unit.stunned) { toast('En bedövad varelse kan inte blockera.'); return }
      selectedBlocker.value = selectedBlocker.value === unit.id ? null : unit.id
      playSound('select')
    } else if (selectedBlocker.value && game.value.combat?.attackers.includes(unit.id)) {
      if (dispatch({ type: 'block', side: 'you', attackerId: unit.id, blockerId: selectedBlocker.value })) selectedBlocker.value = null
    }
    return
  }
  if (side === 'you' && game.value.active === 'you' && game.value.phase === 'combat' && !game.value.combat) {
    if (!yourAttackers.value.some(c => c.id === unit.id)) { toast('Varelsen kan inte attackera nu. Nya varelser måste vänta en tur, om de saknar Hast.'); return }
    attackers.value = attackers.value.includes(unit.id) ? attackers.value.filter(id => id !== unit.id) : [...attackers.value, unit.id]
    playSound('select')
  }
}
function next() {
  if (!game.value || busy.value) return
  selectedCard.value = null
  if (defending.value) { dispatch({ type: 'resolve', side: 'you' }); selectedBlocker.value = null }
  else if (game.value.active === 'you' && !game.value.combat) {
    if (game.value.phase === 'combat' && yourAttackers.value.length && attackers.value.length) dispatch({ type: 'attack', side: 'you', attackers: attackers.value })
    else dispatch({ type: 'next', side: 'you' })
    attackers.value = []
  }
}
function openForge() {
  if (!forgeAvailable.value) return
  if (!forgeTicket.value) forgeError.value = ''
  forgeOpen.value = true
}
async function forge() {
  if (!game.value || forgeResult.value || !forgeAvailable.value || forgePrompt.value.trim().length < 3) return
  if (mode.value === 'unavailable') { forgeError.value = modeReason.value; return }
  if (mode.value === 'ai' && !modeData.value?.privateForge && !challengeToken.value) { forgeError.value = 'Bekräfta säkerhetskontrollen först.'; return }
  forgeBusy.value = true; forgeError.value = ''
  playSound('forge')
  const version = matchVersion.value
  const p = game.value.players.you
  forgeTicket.value ??= { id: crypto.randomUUID(), prompt: forgePrompt.value.trim(), context: { turn: game.value.turn, life: p.life, opponentLife: game.value.players.bot.life, maxMana: p.maxMana, allies: p.board.length, enemies: game.value.players.bot.board.length } }
  try {
    const result = await $fetch<{ card: CardDraft; adjustments: string[]; mode: 'demo' | 'ai'; reason?: string; quota?: { sessionRemaining: number; globalRemaining: number }; illustration: Illustration; draftToken: string }>('/api/forge', {
      method: 'POST', timeout: 260_000, retry: 0,
      headers: { 'X-Murgik-CSRF': modeData.value?.csrf || '', 'X-Murgik-Access-CSRF': props.accessCsrf },
      body: { matchId: game.value.id, requestId: forgeTicket.value.id, prompt: forgeTicket.value.prompt,
        challengeToken: challengeToken.value, demo: mode.value === 'demo',
        context: forgeTicket.value.context }
    })
    await new Promise(resolve => setTimeout(resolve, 900))
    if (version !== matchVersion.value) return
    if (result.mode === 'ai') modeData.value = { ...modeData.value, mode: 'ai', reason: result.reason, quota: result.quota ?? modeData.value?.quota }
    rememberArt(result.card, result.illustration)
    forgeDescription.value = forgeTicket.value.prompt
    forgeResult.value = result; forgeName.value = result.card.name; forgeTicket.value = null; forgePrompt.value = ''
    stopSound('forge')
  } catch (error: unknown) {
    stopSound('forge')
    const e = error as { statusCode?: number; data?: { statusMessage?: string } }
    forgeError.value = e.data?.statusMessage ?? (modeData.value?.privateForge ? 'Kontakten med smedjan bröts. Inget automatiskt återförsök görs. Ett nytt försök kan ge ett nytt AI-anrop.' : 'Kontakten med smedjan bröts. Försök igen med samma beskrivning; samma förfrågan kostar aldrig dubbelt.')
    if (modeData.value?.privateForge) forgeTicket.value = null // A new private attempt requires another explicit click.
  } finally { forgeBusy.value = false; challengeToken.value = ''; challengeVersion.value++ }
}
async function confirmForge() {
  if (!game.value || !forgeResult.value || !forgeNameValid.value || !forgeAvailable.value) return
  const version = matchVersion.value, draft = forgeResult.value
  forgeBusy.value = true; forgeError.value = ''
  try {
    const result = await $fetch<{ card: CardDraft }>('/api/forge/confirm', {
      method: 'POST', retry: 0, timeout: 10_000, headers: { 'X-Murgik-Access-CSRF': props.accessCsrf },
      body: { token: draft.draftToken, matchId: game.value.id, name: forgeName.value }
    })
    if (version !== matchVersion.value) return
    if (dispatch({ type: 'forge', side: 'you', card: result.card })) {
      rememberArt(result.card, draft.illustration)
      forgeResult.value = null; forgeName.value = ''; forgeOpen.value = false
    }
  } catch (error: unknown) {
    const e = error as { data?: { statusMessage?: string } }
    forgeError.value = e.data?.statusMessage ?? 'Bekräftelsen kunde inte skickas. Förhandsvisningen finns kvar; inget nytt AI-anrop görs.'
  } finally { forgeBusy.value = false }
}
// Reconcile one bounded bot action at a time. No unbounded game loop in the UI.
watch([game, tutorial, introVisible, restartOpen, libraryOpen], ([value]) => {
  clearTimeout(timer)
  if (!value || value.winner || tutorial.value || introVisible.value || restartOpen.value || libraryOpen.value) return
  const version = matchVersion.value
  const botTurn = value.active === 'bot' && !defending.value
  const botDefends = value.combat?.side === 'you'
  if (botTurn || botDefends) timer = setTimeout(() => {
    if (version === matchVersion.value && game.value) dispatch(botAction(game.value))
  }, value.phase === 'main' ? 1100 : 700)
  else if (value.active === 'you' && value.phase === 'draw') timer = setTimeout(() => dispatch({ type: 'next', side: 'you' }), 650)
})
function escape(event: KeyboardEvent) { if (event.key === 'Escape') { selectedCard.value = null; attackers.value = []; selectedBlocker.value = null } }
onMounted(() => {
  clientReady.value = true
  window.addEventListener('keydown', escape)
  try { introSeen.value = localStorage.getItem('murgik-intro-seen') === 'true' } catch { introSeen.value = false }
})
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(noticeTimer); window.removeEventListener('keydown', escape) })
const blockLabel = (id: string) => {
  const combat = game.value?.combat
  if (!combat) return ''
  const blocker = combat.blocks[id]
  return blocker ? you.value?.board.find(c => c.id === blocker)?.name || '' : ''
}
const heroFlash = ref(false)
watch(() => you.value?.life, (life, old) => { if (life !== undefined && old !== undefined && life < old) { heroFlash.value = true; setTimeout(() => { heroFlash.value = false }, 600) } })
</script>

<template>
  <UApp :locale="sv">
    <div class="world" :class="{ 'in-game': game }" @pointerover="hoverSound" @focusin="hoverSound">
      <div class="world-background"/><div class="vignette"/>
      <div class="embers" aria-hidden="true"><i v-for="n in 14" :key="n" :style="{ left: `${n * 7}%`, animationDelay: `${n * -.9}s`, animationDuration: `${9 + n % 5}s` }"/></div>
      <header class="site-header">
        <a href="/" class="brand" :aria-label="game ? 'Murgik, starta ny match' : 'Murgik startsida'" @click.prevent="game ? restartOpen = true : null"><span class="brand-rune">ᛗ</span><span>MURGIK<small>SKRIV DITT ÖDE</small></span></a>
        <div class="header-center"><span class="live-dot"/> {{ game ? 'ASKLUNDENS ARENA' : 'EN NY SORTS KORTDUELL' }}</div>
        <div class="header-actions"><span class="mode-badge" :class="mode">{{ mode === 'demo' ? 'DEMO · UTAN AI' : mode === 'ai' ? 'OPENAI · AI-SMIDE' : 'AI · EJ TILLGÄNGLIG' }}</span><button class="rules-button" :disabled="!clientReady" @click="tutorial = true"><RuneIcon name="book" :size="23"/> SPELREGLER</button><button class="icon-button sound-button" :aria-label="muted ? 'Aktivera ljud' : 'Stäng av ljud'" :aria-pressed="!muted" @click="toggleSound"><RuneIcon :name="muted ? 'muted' : 'sound'" :size="21"/></button><UPopover :content="{ align: 'end', sideOffset: 12 }"><button class="icon-button sound-settings-button" aria-label="Ljudinställningar"><RuneIcon name="chevron" :size="12"/></button><template #content><section class="sound-settings" aria-label="Ljudinställningar"><h3>Ljud &amp; volym</h3><label for="master-volume">Master <span>{{ masterVolume }}%</span></label><input id="master-volume" v-model.number="masterVolume" type="range" min="0" max="100" step="1"/><label for="effects-volume">Ljudeffekter <span>{{ effectsVolume }}%</span></label><input id="effects-volume" v-model.number="effectsVolume" type="range" min="0" max="100" step="1"/><p>{{ audioUnavailable ? 'Ett ljud kunde inte laddas. Du kan fortsätta spela.' : muted ? 'Ljudet är avstängt. Slå på det med högtalaren.' : 'Lokala fantasy- och foleyljud. Inställningarna sparas.' }}</p><a href="/audio/LICENSES.md" target="_blank" rel="noopener">Ljudlicenser &amp; skapare ↗</a><AccessLogout class="mobile-access-logout" :csrf="accessCsrf"/></section></template></UPopover><button v-if="game" class="icon-button" aria-label="Starta om matchen" :disabled="forgeBusy" @click="restartOpen = true"><RuneIcon name="restart" :size="19"/></button><AccessLogout class="desktop-access-logout" :csrf="accessCsrf"/></div>
      </header>

      <main v-if="!game" class="landing">
        <div class="landing-copy"><div class="eyebrow"><span/> TAKTIK MÖTER FANTASI <span/></div><h1>Världen är skriven.<br><em>Ändra den.</em></h1><p>En tanke. En gnista. Ett kort som aldrig funnits.<br>Smid din egen magi och vänd duellen.</p><DeckSelection v-model="deckChoice"/><div class="landing-cta"><button class="gold-button" :disabled="!clientReady" @click="start">Påbörja duell <RuneIcon name="arrow" :size="20"/></button><button class="text-button" @click="tutorial = true"><RuneIcon name="book" :size="17"/> Så spelar du</button><button class="text-button" @click="libraryOpen = true"><RuneIcon name="book" :size="17"/> Kortbibliotek</button></div><div class="landing-facts"><span><b>20</b> liv att försvara</span><span><b>3</b> kort att smida</span><span><b>∞</b> idéer att utforska</span></div></div>
        <div class="landing-showcase"><div class="showcase-ring"/><div class="floating-card left"><GameCard :card="catalog[1]!" display-only/></div><div class="floating-card right"><GameCard :card="catalog[3]!" display-only/></div><div class="floating-card front"><GameCard :card="{ ...catalog[10]!, name: 'Smedjans askdrake', forged: true, id: 'showcase' }" display-only/></div><div class="showcase-caption"><RuneIcon name="forge" :size="18"/><span>FÖDD UR DIN FANTASI</span></div></div>
        <footer class="landing-footer"><span>ETT ORIGINALSPEL AV MURGIK <i>◆</i> PROOF OF CONCEPT</span><span>{{ mode === 'demo' ? 'Övningsläge valt. Inga AI-anrop.' : 'AI skapar kort. Spelmotorn bestämmer reglerna.' }}</span></footer>
      </main>

      <main v-else class="game-layout">
        <aside class="left-rail">
          <div class="arena-title"><span class="eyebrow">DUELL 01</span><h2>Asklunden</h2><p>Där gamla löften brinner.</p><p v-if="yourDeck" class="deck-style-note">{{ yourDeck.name }}</p><button class="text-button library-arena-button" :disabled="forgeBusy" @click="libraryOpen = true"><RuneIcon name="book" :size="17"/>Kortbibliotek</button></div>
          <div class="turn-panel"><span class="eyebrow">TUR {{ game.turn }}</span><strong>{{ game.active === 'you' ? 'Din tur' : 'Veyras tur' }}</strong><span v-if="preparation" class="preparation-note">Förberedelserunda</span><div class="phase-list"><div v-for="([key, label], i) in visiblePhases" :key="key" :class="{ current: game.phase === key }"><span>{{ i + 1 }}</span>{{ label }}<i v-if="game.phase === key"/></div></div></div>
          <div class="forge-panel"><div class="forge-heading"><RuneIcon name="forge" :size="25"/><span>Runornas smedja</span></div><p>Det bästa kortet finns kanske<br>inte ännu.</p><div class="charges"><span v-for="i in 3" :key="i" :class="{ charged: i <= (you?.charges ?? 0) }">◆</span><small>{{ you?.charges }} / 3 laddningar</small></div><button class="forge-button" :disabled="!forgeAvailable" @click="openForge"><RuneIcon name="forge" :size="19"/> SMID ETT KORT <span>↗</span></button><small>Ingen mana. Bara din fantasi.</small></div>
          <div v-if="inspected" class="inspect-panel"><span class="eyebrow">{{ inspected.type === 'creature' ? 'VARELSE' : 'BESVÄRJELSE' }}</span><h3>{{ inspected.name }}</h3><p>{{ cardText(inspected) }}</p><p class="inspector-ruletext">{{ cardText(liveInspected) }}</p><div v-for="k in inspected.keywords" :key="k" class="keyword-help"><b>{{ keywordNames[k] }}</b> {{ keywordHelp[k] }}</div></div>
          <div v-else class="rail-note"><RuneIcon name="eye" :size="18"/><span>Håll pekaren över ett kort<br>för att läsa dess förmågor.</span></div>
        </aside>

        <section class="battlefield" aria-label="Slagfält">
          <Transition name="turn"><div v-if="turnBanner" :key="turnBanner" class="turn-announcement" role="status"><RuneIcon name="mana" :size="25"/>{{ turnBanner }}</div></Transition>
          <div v-if="introVisible" class="first-duel-intro"><div class="eyebrow">VÄLKOMMEN, RUNSMED</div><h3>Din första gnista.</h3><p>Spela kort i huvudfasen. Välj dina anfallare i strid. Smid det kort du saknar.</p><div><button class="text-button" @click="dismissIntro(); tutorial = true"><RuneIcon name="book" :size="18"/>Visa spelregler</button><button class="gold-button" @click="dismissIntro">Jag börjar<RuneIcon name="arrow" :size="18"/></button></div></div>
          <div class="opponent-zone"><button class="hero enemy-hero" data-entity-id="bot" :class="{ targetable: targets.includes('bot') }" :disabled="!targets.includes('bot')" aria-label="Veyra, motståndare. Välj som mål" @click="target('bot')"><div class="portrait enemy-portrait"><img src="/art/night-demon.jpg" alt="" width="64" height="64"/></div><div class="hero-name"><strong>Veyra</strong><small>SKYMNINGENS VÄKTARE</small></div><div class="life"><RuneIcon name="heart" :size="16"/><b>{{ enemy?.life }}</b></div></button><div class="enemy-resources"><span><RuneIcon name="mana" :size="14"/> {{ enemy?.mana }} / {{ enemy?.maxMana }}</span><span>{{ enemy?.deck.length }} i leken</span></div><div class="opponent-hand" :aria-label="`Motståndaren har ${enemy?.hand.length} kort`"><div v-for="n in enemy?.hand.length" :key="n" class="card-back" :style="{ transform: `rotate(${(n - ((enemy?.hand.length ?? 0) + 1) / 2) * 3}deg)` }"><span>ᛗ</span></div></div></div>
          <div class="unit-row enemy-row" :class="{ 'row-targetable': selected && targets.some(id => enemy?.board.some(c => c.id === id)) }"><div class="field-slots" aria-hidden="true"><i v-for="n in 6" :key="n">◇</i></div><span class="row-label">MOTSTÅNDARENS SLAGFÄLT</span><TransitionGroup name="unit"><div v-for="unit in enemy?.board" :key="unit.id" class="unit-wrap" :class="{ attacking: game.combat?.attackers.includes(unit.id) }"><GameCard :card="unit" compact :targetable="targets.includes(unit.id) || !!(defending && selectedBlocker && game.combat?.attackers.includes(unit.id) && canBlock(unit, you!.board.find(c => c.id === selectedBlocker)!))" @click="unitClick(unit, 'bot')" @mouseenter="inspected = unit" @focus="inspected = unit"/><span v-if="blockLabel(unit.id)" class="block-tag">⛨ {{ blockLabel(unit.id) }}</span></div></TransitionGroup><div v-if="!enemy?.board.length" class="empty-field"><span>◇</span> Skuggorna väntar</div></div>
          <div class="battle-divider"><span/><div class="arena-sigil">ᛗ</div><span/><div class="battle-status" aria-live="polite">{{ defending ? 'FÖRSVARA DIG' : game.combat ? 'STRID PÅGÅR' : game.active === 'you' ? 'DITT DRAG' : 'MOTSTÅNDARENS DRAG' }}</div></div>
          <div class="unit-row player-row" :class="{ 'row-targetable': selected && targets.some(id => you?.board.some(c => c.id === id)) }"><div class="field-slots" aria-hidden="true"><i v-for="n in 6" :key="n">◇</i></div><span class="row-label">DITT SLAGFÄLT <span>{{ you?.board.length }} / 6</span></span><TransitionGroup name="unit"><div v-for="unit in you?.board" :key="unit.id" class="unit-wrap" :class="{ attacking: game.combat?.attackers.includes(unit.id) }"><GameCard :card="unit" compact :selected="attackers.includes(unit.id) || selectedBlocker === unit.id || !!(game.combat && Object.values(game.combat.blocks).includes(unit.id))" :playable="game.phase === 'combat' && yourAttackers.some(c => c.id === unit.id)" :targetable="targets.includes(unit.id) || !!(defending && !unit.stunned)" @click="unitClick(unit, 'you')" @mouseenter="inspected = unit" @focus="inspected = unit"/></div></TransitionGroup><div v-if="!you?.board.length" class="empty-field"><span>◇</span> Din berättelse börjar här</div></div>
          <div class="player-zone"><div class="hero player-hero" data-entity-id="you" :class="{ 'damage-flash': heroFlash }"><div class="portrait player-portrait"><img src="/art/dawn-knight.jpg" alt="" width="64" height="64"/></div><div class="hero-name"><strong>Runsmeden</strong><small>DIN FANTASI. DINA REGLER.</small></div><div class="life"><RuneIcon name="heart" :size="16"/><b>{{ you?.life }}</b></div></div><div class="mana-panel"><div class="mana-caption"><RuneIcon name="mana" :size="16"/><strong>{{ you?.mana }} <span>/ {{ you?.maxMana }}</span></strong><small>MANA</small></div><div class="mana-crystals"><i v-for="i in 10" :key="i" :class="{ unlocked: i <= (you?.maxMana ?? 0), filled: i <= (you?.mana ?? 0) }"/></div></div><div class="deck-indicator"><RuneIcon name="book" :size="18"/><b>{{ you?.deck.length }}</b><small>KORT I LEKEN</small></div></div>
          <div class="hand-zone"><span class="hand-label">DIN HAND <i>{{ you?.hand.length }} / 10</i></span><TransitionGroup name="hand"><GameCard v-for="card in you?.hand" :key="card.id" :card="card" :selected="selectedCard === card.id" :playable="canPlay(game, 'you', card)" :disabled="forgeBusy" :data-card-id="card.id" :data-forged="card.forged || undefined" @click="play(card)" @mouseenter="inspected = card" @focus="inspected = card"/></TransitionGroup><div v-if="!you?.hand.length" class="empty-hand">Handen är tom. Nästa tur ger nya möjligheter.</div></div>
        </section>

        <aside class="right-rail"><div class="duel-info"><span class="eyebrow">DIN MOTSTÅNDARE</span><h3>Veyra</h3><p>En uråldrig väktare.<br>En obeveklig vilja.</p><p v-if="enemyDeck" class="deck-style-note">{{ enemyDeck.name }}</p><span class="bot-label"><span class="live-dot"/> REGELSTYRD BOT</span></div><div v-if="inspected" class="card-inspector"><div class="eyebrow">KORTETS FÖRMÅGOR</div><GameCard :card="{ ...liveInspected, id: 'inspector-preview' }" display-only/><p class="inspector-ruletext">{{ cardText(liveInspected) }}</p><div v-for="k in inspected.keywords" :key="k" class="keyword-help"><b>{{ keywordNames[k] }}</b> {{ keywordHelp[k] }}</div></div><div class="chronicle"><div class="chronicle-heading"><RuneIcon name="book" :size="17"/><span>DUELLENS KRÖNIKA</span></div><div class="log-list" aria-live="polite" aria-relevant="additions"><div v-for="entry in [...game.log].reverse().slice(0, 10)" :key="entry.id" class="log-entry" :class="entry.kind"><i/>{{ entry.text }}</div></div></div><div class="action-panel"><div v-if="game.active === 'bot' || game.combat?.side === 'you'" class="bot-action-status" role="status"><i/><span>{{ botMessage || 'Veyra betraktar slagfältet…' }}</span></div><div class="action-hint">{{ hint }}</div><button v-if="selected" class="cancel-target" @click="selectedCard = null">Avbryt målval <span>ESC</span></button><button class="next-button" :class="{ 'defend-button': defending }" :disabled="forgeBusy || !!game.winner || (game.active === 'bot' && !defending) || (!!game.combat && !defending)" @click="next">{{ nextLabel }}<RuneIcon :name="defending ? 'shield' : 'arrow'" :size="18"/></button><span class="phase-caption">{{ defending ? 'Varje varelse kan blockera en fiende.' : phaseNames[game.phase] }}</span></div></aside>
          <div v-if="notice" class="toast" role="status"><RuneIcon name="spark" :size="17"/>{{ notice }}</div>
        </main>
      <UModal v-model:open="forgeOpen" title="Runornas smedja" description="Sätt ord på din magi. Smedjan ger den form." :dismissible="!forgeBusy" :close="!forgeBusy" :ui="{ content: 'forge-modal' }">
        <template #body>
          <div v-if="forgeResult && previewCard" class="forge-success">
            <div class="eyebrow">{{ forgeResult.mode === 'demo' ? 'ÖVNINGSKORT · UTAN FRITEXTTOLKNING' : 'DIN IDÉ HAR FÅTT FORM' }}</div><p class="forge-original-idea">”{{ forgeDescription }}”</p>
            <p class="forge-art-notice">{{ forgeResult.illustration.status === 'ready' ? 'AI-illustration skapad för din idé.' : 'En befintlig illustration används som fallback.' }}</p>
            <div class="forged-reveal"><GameCard :card="{ ...previewCard, id: 'preview', forged: true }" display-only/></div>
            <div class="forge-name-editor"><label for="forge-card-name">Kortets namn <span>{{ forgeName.length }} / {{ CARD_NAME_MAX }}</span></label><input id="forge-card-name" v-model="forgeName" :maxlength="CARD_NAME_MAX" :disabled="forgeBusy" :aria-invalid="!forgeNameValid" aria-describedby="forge-name-help" autocomplete="off"/><p id="forge-name-help" :class="{ 'error-message': !forgeNameValid }">{{ CARD_NAME_HELP }} Namnet ändras utan nytt AI-anrop.</p><button class="text-button" :disabled="forgeBusy || forgeName === forgeResult.card.name" @click="forgeName = forgeResult.card.name">Återställ föreslaget namn</button></div>
            <p class="forge-identity">{{ previewCard.flavor }}</p>
            <div class="forge-preview-facts"><span>{{ previewCard.type === 'creature' ? 'Varelse' : 'Besvärjelse' }}</span><span>{{ previewCard.cost }} mana</span><span v-if="previewCard.type === 'creature'">{{ previewCard.attack }} attack / {{ previewCard.health }} hälsa</span></div>
            <div class="forge-interpretation"><h4>Kortets faktiska effekt</h4><p>{{ cardText(previewCard) }}</p><p v-for="keyword in previewCard.keywords" :key="keyword"><b>{{ keywordNames[keyword] }}:</b> {{ keywordHelp[keyword] }}</p></div>
            <div class="balance-note"><RuneIcon name="shield" :size="17"/><div><b>Tolkning & anpassningar</b><ul><li v-for="(adjustment, index) in forgeResult.adjustments" :key="index">{{ adjustment }}</li><li v-if="!forgeResult.adjustments.length">Validerat och balanserat av Murgiks regelmotor.</li></ul></div></div>
            <div class="art-summary" :role="forgeResult.illustration.status === 'failed' ? 'alert' : 'status'"><RuneIcon name="eye" :size="17"/><span>{{ forgeResult.illustration.message }}</span></div>
            <p>Bekräfta för att lägga kortet i handen och använda en smidesladdning. Namnbyte och bekräftelse startar inga AI-anrop.</p>
            <p v-if="forgeError" class="error-message" role="alert">{{ forgeError }}</p>
          </div>
          <div v-else class="forge-form"><label class="forge-demo-choice"><input v-model="demoRequested" type="checkbox" :disabled="forgeBusy"/> Välj övningsläge utan AI (fast övningskort)</label><p v-if="mode === 'unavailable'" class="error-message" role="alert">{{ modeReason }}</p><p v-if="mode === 'ai' && modeData?.quota" class="modal-footnote">{{ modeData.quota.sessionRemaining }} AI-kort kvar i sessionen · {{ modeData.quota.globalRemaining }} försök kvar i POC:en.</p><ForgeChallenge v-if="mode === 'ai' && modeData?.siteKey" :key="challengeVersion" :site-key="modeData.siteKey" @token="challengeToken = $event"/><div class="mode-notice"><span class="live-dot"/><span>{{ mode === 'demo' ? 'DEMONSTRATION · FAST ÖVNINGSKORT, INGEN AI' : modeData?.images ? 'OPENAI · KORT OCH ILLUSTRATION' : 'OPENAI · STRUKTURERAT OCH SERVERVALIDERAT' }}</span></div><label for="forge-prompt">Vilket kort behöver du?</label><textarea id="forge-prompt" v-model="forgePrompt" :disabled="forgeBusy || !!forgeTicket" placeholder="Beskriv din idé, vad den gör och vilka den påverkar…" maxlength="500" rows="4" @keydown.ctrl.enter.prevent="forge"/><div class="prompt-meta"><span>En idé räcker. Balansen sköter smedjan.</span><span>{{ forgePrompt.length }} / 500</span></div><div class="suggestions"><button v-for="s in suggestions" :key="s.name" :disabled="forgeBusy || !!forgeTicket" @click="forgePrompt = s.text"><RuneIcon :name="s.icon" :size="16"/>{{ s.name }}</button></div><div class="forge-rules"><RuneIcon name="forge" :size="24"/><p><b>1 laddning. Ingen mana.</b><br>Du betalar kortets mana när du spelar det. {{ you?.charges }} laddningar kvar.</p></div><div v-if="forgeBusy" class="forging-progress" role="status"><div class="forge-vortex"><i/><i/><i/><span>ᛗ</span><b v-for="n in 12" :key="n" :style="{ '--spark': n }"/></div><strong>Din tanke får liv</strong><span>{{ mode === 'ai' && modeData?.images ? 'Kortet balanseras och illustrationen skapas. Det kan ta några minuter.' : 'Runorna binds. Kraften balanseras.' }}</span></div><p v-if="forgeError" class="error-message" role="alert">{{ forgeError }}</p></div>
        </template>
        <template #footer><template v-if="forgeResult"><button class="text-button" :disabled="forgeBusy" @click="forgePrompt = forgeDescription; forgeResult = null; forgeName = ''; forgeError = ''">Ändra idén</button><button class="gold-button modal-primary" :disabled="forgeBusy || !forgeNameValid || !forgeAvailable" @click="confirmForge">{{ forgeBusy ? 'Bekräftar…' : 'Till min hand' }} <RuneIcon name="arrow" :size="18"/></button></template><template v-else><span class="modal-footnote">{{ mode === 'demo' ? 'Inga AI-anrop görs.' : modeData?.images ? 'Högst ett text- och ett bildförsök per klick. Inga automatiska återförsök.' : 'Högst ett textförsök per klick. Inga automatiska återförsök.' }}</span><button class="gold-button" :disabled="forgeBusy || mode === 'unavailable' || forgePrompt.trim().length < 3 || !forgeAvailable || (mode === 'ai' && !modeData?.privateForge && !challengeToken)" @click="forge"><RuneIcon name="forge" :size="18"/>{{ forgeBusy ? 'Smider…' : forgeTicket ? 'Försök igen' : 'Smid kortet' }}</button></template></template>
      </UModal>
      <RulesGuide v-model:open="tutorial" :in-match="!!game"/>
      <CardLibrary v-model:open="libraryOpen"/>
      <UModal v-model:open="restartOpen" title="En ny berättelse?" :description="game?.winner ? 'Välj kortlek för nästa duell.' : 'Din nuvarande duell avslutas och en ny match börjar.'" :ui="{ content: 'small-modal' }"><template #body><DeckSelection id="restart-deck-choice" v-model="deckChoice"/></template><template #footer><button class="text-button" @click="restartOpen = false">{{ game?.winner ? 'Tillbaka' : 'Fortsätt duellen' }}</button><button class="gold-button" :disabled="forgeBusy" @click="start">Starta ny match</button></template></UModal>
      <div v-if="game?.winner && !restartOpen" class="game-over-backdrop"><section class="game-over" role="dialog" aria-modal="true" aria-labelledby="winner-title" tabindex="-1"><div class="victory-rune"><RuneIcon :name="game.winner === 'you' ? 'crown' : 'shield'" :size="52"/></div><div class="eyebrow">DUELLEN ÄR AVGJORD</div><h2 id="winner-title">{{ game.winner === 'you' ? 'Ditt öde. Din seger.' : game.winner === 'draw' ? 'Två öden. En aska.' : 'Även aska kan glöda.' }}</h2><p>{{ game.winner === 'you' ? 'Veyra faller. En ny berättelse börjar med ditt namn.' : game.winner === 'draw' ? 'Båda hjältarna föll i samma ögonblick.' : 'Veyra vann denna gång. Smedjan väntar på din återkomst.' }}</p><div class="result-stats"><span><b>{{ game.turn }}</b> TURER</span><span><b>{{ 3 - game.players.you.charges }}</b> KORT SMIDDA</span><span><b>{{ game.players.you.life }}</b> LIV KVAR</span></div><button class="gold-button" autofocus @click="restartOpen = true">Spela igen <RuneIcon name="restart" :size="18"/></button></section></div>
      <BattleEffects :effects="effects"/><Transition name="bot-reveal"><div v-if="botCard && !tutorial && !libraryOpen" class="bot-card-reveal" aria-hidden="true"><span>VEYRA SPELAR</span><GameCard :card="{ ...botCard, id: 'bot-preview' }" display-only/></div></Transition>
    </div>
  </UApp>
</template>
