<script setup lang="ts">
import type { Card, CardDraft, Creature } from '#shared/game/types'
import { cardText, keywordNames } from '#shared/game/text'
const props = withDefaults(defineProps<{ card: CardDraft | Card | Creature; compact?: boolean; selected?: boolean; playable?: boolean; targetable?: boolean; disabled?: boolean; displayOnly?: boolean }>(), { compact: false })
const unit = computed(() => 'currentHealth' in props.card ? props.card as Creature : null)
const entityId = computed(() => 'id' in props.card ? props.card.id : undefined)
</script>
<template>
  <component :is="displayOnly ? 'article' : 'button'" :type="displayOnly ? undefined : 'button'" :data-entity-id="entityId" class="game-card" :class="[card.theme, { compact, selected, playable, targetable, forged: 'forged' in card && card.forged, sleeping: unit && !unit.ready, injured: unit && unit.currentHealth < unit.maxHealth }]" :aria-label="`${card.name}, ${card.cost} mana. ${cardText(card)}${card.type === 'creature' ? ` ${card.attack} attack, ${unit?.currentHealth ?? card.health} hälsa.` : ''}`" :aria-pressed="displayOnly ? undefined : selected" :aria-disabled="displayOnly ? undefined : disabled" :title="`${cardText(card)}${unit?.shield ? ' Sköld aktiv.' : ''}${unit?.stunned ? ' Bedövad.' : ''}`">
    <div class="card-cost">{{ card.cost }}</div>
    <div v-if="'forged' in card && card.forged" class="forged-mark"><RuneIcon name="forge" :size="11"/> SMIDD</div>
    <div class="art-window"><CardArt :card="card"/></div>
    <div class="card-heading"><span>{{ card.name }}</span><RuneIcon :name="card.type === 'creature' ? 'sword' : 'spark'" :size="12"/></div>
    <div class="card-type">{{ card.type === 'creature' ? 'Varelse' : 'Besvärjelse' }} <span>· {{ {ember:'Glöd',forest:'Urskog',void:'Skymning',storm:'Storm',frost:'Frost',gold:'Gryning'}[card.theme] }}</span></div>
    <div class="card-rules">{{ cardText(card) }}</div>
    <div v-if="!compact" class="card-flavor">{{ card.flavor }}</div>
    <div v-if="card.type === 'creature'" class="card-stats"><span><RuneIcon name="sword" :size="12"/>{{ card.attack }}</span><i/><span :class="{ wounded: unit && unit.currentHealth < unit.maxHealth }"><RuneIcon name="heart" :size="12"/>{{ unit?.currentHealth ?? card.health }}</span></div>
    <div v-if="unit" class="unit-status"><span v-if="unit.shield" title="Sköld">◇</span><span v-if="unit.stunned">❄</span><span v-else-if="!unit.ready" title="Kan inte attackera nu">z</span><span v-for="k in card.keywords" :key="k" :title="keywordNames[k]">{{ { flying:'↟', guard:'⛨', haste:'ϟ', lifesteal:'♥', enrage:'↗' }[k] }}</span></div>
  </component>
</template>
