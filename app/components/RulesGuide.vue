<script setup lang="ts">
import { rulesChapters, phaseLabels, phaseDescriptions, guideCards } from '#shared/game/rules'
import { keywordHelp, keywordNames } from '#shared/game/text'
import { act, createGame } from '#shared/game/engine'
import { catalog } from '#shared/game/catalog'
import type { Creature, Keyword, TurnPhase } from '#shared/game/types'
defineProps<{ inMatch?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const chapter = ref(0)
const navigation = ref<HTMLElement | null>(null)
watch(chapter, () => { void nextTick(() => navigation.value?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })) })
const current = computed(() => rulesChapters[chapter.value]!)
const phase = ref<TurnPhase>('main')
const mana = ref(2)
const keyword = ref<Keyword>('flying')
const scenario = ref<'open' | 'blocked' | 'flying'>('blocked')
const combat = computed(() => {
  let s = createGame('guide', 42)
  const asUnit = (index: number, id: string): Creature => ({ ...structuredClone(catalog[index]!), id, forged: false, ready: true, shield: false, stunned: false, currentHealth: catalog[index]!.health, maxHealth: catalog[index]!.health })
  s.players.you.board = [asUnit(scenario.value === 'flying' ? 3 : 5, 'guide-attacker')]
  s.players.bot.board = scenario.value === 'open' ? [] : [asUnit(1, 'guide-blocker')]
  s.phase = 'combat'
  const before = structuredClone(s)
  s = act(s, { type: 'attack', side: 'you', attackers: ['guide-attacker'] }).state
  s = act(s, { type: 'resolve', side: 'bot' }).state
  return { before, after: s, damage: 20 - s.players.bot.life }
})
function go(index: number) { chapter.value = Math.max(0, Math.min(rulesChapters.length - 1, index)) }
</script>
<template>
  <UModal v-model:open="open" title="Murgiks spelregler" description="Lär dig duellen. Forma sedan ditt eget öde." :ui="{ content: 'rules-modal' }">
    <template #body>
      <div class="rulebook">
        <nav ref="navigation" class="rules-navigation" aria-label="Regelkapitel"><button v-for="(item, i) in rulesChapters" :key="item.id" :class="{ active: chapter === i }" :aria-label="`${i + 1}. ${item.title}`" :aria-current="chapter === i ? 'step' : undefined" @click="go(i)"><span>{{ String(i + 1).padStart(2, '0') }}</span><RuneIcon :name="item.icon" :size="19"/><b>{{ item.title }}</b></button></nav>
        <section class="rules-chapter" :key="current.id" :aria-labelledby="`chapter-${current.id}`"><div class="eyebrow">{{ current.kicker }}</div><h3 :id="`chapter-${current.id}`">{{ current.title }}</h3><p class="chapter-lead">{{ current.text }}</p>
          <div v-if="current.id === 'win'" class="guide-victory"><CardArt :card="catalog[10]!"/><div class="guide-victory-copy"><RuneIcon name="crown" :size="32"/><strong>20 <span>→</span> 0</strong><span>Skydda ditt liv. Bryt motståndarens försvar.</span></div></div>
          <div v-else-if="current.id === 'turn'" class="guide-phases"><div role="tablist" aria-label="Turens faser"><button v-for="(label, key, i) in phaseLabels" :key="key" role="tab" :aria-selected="phase === key" :class="{ active: phase === key }" @click="phase = key"><span>{{ i + 1 }}</span>{{ label }}</button></div><p role="tabpanel">{{ phaseDescriptions[phase] }}</p></div>
          <div v-else-if="current.id === 'mana'" class="guide-mana"><label for="guide-mana">Din tillgängliga mana <b>{{ mana }} / 10</b></label><input id="guide-mana" v-model.number="mana" type="range" min="1" max="10"/><div class="guide-mana-crystals"><RuneIcon v-for="n in 10" :key="n" name="mana" :size="26" :class="{ filled: n <= mana }"/></div><div class="mana-examples"><div><GameCard :card="guideCards.spell" display-only/><span :class="{ affordable: mana >= guideCards.spell.cost }">{{ mana >= guideCards.spell.cost ? 'Tillräcklig mana' : 'För lite mana' }}</span></div><div><GameCard :card="guideCards.creature" display-only/><span :class="{ affordable: mana >= guideCards.creature.cost }">{{ mana >= guideCards.creature.cost ? 'Tillräcklig mana' : 'För lite mana' }}</span></div></div></div>
          <div v-else-if="current.id === 'cards'" class="guide-card-pair"><div><GameCard :card="guideCards.creature" display-only/><p><RuneIcon name="sword" :size="17"/><b>1 attack</b><RuneIcon name="heart" :size="17"/><b>4 hälsa</b></p><span>Stannar på slagfältet</span></div><div><GameCard :card="guideCards.spell" display-only/><p><RuneIcon name="spark" :size="17"/><b>2 riktad skada</b></p><span>Effekt en gång, sedan gravhög</span></div></div>
          <div v-else-if="current.id === 'combat'" class="guide-combat"><div class="scenario-tabs"><button :class="{ active: scenario === 'open' }" @click="scenario = 'open'">Oblockerat</button><button :class="{ active: scenario === 'blocked' }" @click="scenario = 'blocked'">Blockerat</button><button :class="{ active: scenario === 'flying' }" @click="scenario = 'flying'">Flygande</button></div><div class="combat-example"><div><GameCard :card="combat.before.players.you.board[0]!" display-only/><span>{{ combat.after.players.you.board[0]?.currentHealth ?? 0 }} hälsa efter striden</span></div><RuneIcon name="sword" :size="30"/><div v-if="combat.before.players.bot.board.length"><GameCard :card="combat.before.players.bot.board[0]!" display-only/><span>{{ combat.after.players.bot.board[0]?.currentHealth ?? 0 }} hälsa efter striden</span></div><div v-else class="guide-hero"><RuneIcon name="heart" :size="38"/><strong>Veyra</strong></div></div><p class="combat-outcome"><RuneIcon name="shield" :size="20"/>{{ combat.damage ? `Veyra tar ${combat.damage} skada. ${scenario === 'flying' ? 'Markvakten kan inte blockera flygande.' : 'Ingen varelse blockerade.'}` : 'Vakten blockerar automatiskt. Båda varelserna tar skada; hjälten skyddas.' }}</p><small>Resultatet beräknas direkt av spelets riktiga regelmotor.</small></div>
          <div v-else-if="current.id === 'keywords'" class="guide-keywords"><div role="tablist" aria-label="Keywords"><button v-for="(name, key) in keywordNames" :key="key" role="tab" :aria-selected="keyword === key" :class="{ active: keyword === key }" @click="keyword = key">{{ name }}</button></div><div class="keyword-demo"><CardArt :card="catalog[{ flying: 3, guard: 1, haste: 5, lifesteal: 7 }[keyword]]!"/><section><RuneIcon :name="keyword === 'guard' ? 'shield' : keyword === 'lifesteal' ? 'heart' : 'sword'" :size="30"/><h4>{{ keywordNames[keyword] }}</h4><p>{{ keywordHelp[keyword] }}</p></section></div><div class="extra-keywords"><p><b>Sköld</b> Absorberar nästa skadeevent och förbrukas.</p><p><b>Bedövning</b> Hindrar blockering före nästa egna tur och attack under den turen.</p><p><b>Specialeffekter</b> Healing, kortdragning, tokens, buffar och mer visas i kortets riktiga regeltext.</p></div></div>
          <div v-else-if="current.id === 'forge'" class="guide-forge"><div class="sample-prompt">”Jag behöver en elddrake som skadar fiender när den landar.”</div><div class="forge-journey"><span><RuneIcon name="book" :size="25"/>Beskriv</span><RuneIcon name="arrow" :size="18"/><span><RuneIcon name="shield" :size="25"/>Validera & balansera</span><RuneIcon name="arrow" :size="18"/><span><RuneIcon name="forge" :size="25"/>Spela ditt kort</span></div><p>AI får välja ur spelets befintliga effekter. Regelmotorn, aldrig AI-modellen, avgör vad som händer i duellen.</p></div>
          <div v-else-if="current.id === 'limits'" class="guide-limits"><div class="guide-charge-gems"><span>◆</span><span>◆</span><span>◆</span></div><div class="limit-grid"><div><strong>3</strong><span>smiden per match</span></div><div><strong>0</strong><span>mana för själva smidet</span></div><div><strong>10</strong><span>max mana / attack / hälsa</span></div></div><p>Inget instant win, inga oändliga resurser. Du behöver en ledig plats i handen och det måste vara din huvudfas.</p></div>
          <div v-else class="guide-forged-example"><div class="example-prompt">”En snabb liten glödvarg med hast.”<RuneIcon name="forge" :size="30"/><p>Generator → Zod → balans → din hand</p></div><GameCard :card="{ ...guideCards.forged, id: 'rules-example', forged: true }" display-only/><div class="example-result"><b>2 mana · 1 / 1 · Hast</b><span>Spela i huvudfasen. Anfall redan samma tur.</span></div></div>
          <div class="rule-tip"><RuneIcon name="eye" :size="19"/><p>{{ current.tip }}</p></div>
        </section>
      </div>
    </template>
    <template #footer><span class="rules-progress">{{ chapter + 1 }} / {{ rulesChapters.length }} <span v-if="inMatch">· Duellen är pausad</span></span><button class="text-button" :disabled="chapter === 0" @click="go(chapter - 1)">Föregående</button><button v-if="chapter < rulesChapters.length - 1" class="gold-button" @click="go(chapter + 1)">Nästa kapitel <RuneIcon name="arrow" :size="18"/></button><button v-else class="gold-button" @click="open = false">{{ inMatch ? 'Tillbaka till duellen' : 'Jag är redo' }}<RuneIcon name="sword" :size="18"/></button></template>
  </UModal>
</template>
