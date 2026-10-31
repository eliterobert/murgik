<script setup lang="ts">
import type { PositionedEvent } from '../composables/useBattleEffects'
defineProps<{ effects: PositionedEvent[] }>()
</script>
<template>
  <div class="battle-effects" aria-hidden="true">
    <template v-for="cue in effects" :key="cue.id">
      <svg v-if="cue.kind === 'spell' && cue.fromX !== undefined" class="spell-trail" :class="cue.theme"><line :x1="cue.fromX" :y1="cue.fromY" :x2="cue.x" :y2="cue.y"/></svg>
      <div class="battle-effect" :class="[`effect-${cue.kind}`, cue.theme]" :style="{ left: `${cue.x}px`, top: `${cue.y}px`, '--effect-width': `${cue.width}px`, '--effect-height': `${cue.height}px` }">
        <template v-if="cue.kind === 'damage' || cue.kind === 'heal'"><div class="hit-ring"/><span class="floating-number">{{ cue.kind === 'heal' ? '+' : '−' }}{{ cue.amount }}</span><i v-for="n in 7" :key="n" :style="{ '--particle': n }"/></template>
        <template v-else-if="cue.kind === 'death'"><div class="death-silhouette"><CardArt v-if="cue.card" :card="cue.card"/></div><i v-for="n in 10" :key="n" :style="{ '--particle': n }"/></template>
        <template v-else><div class="magic-ring"/><RuneIcon :name="cue.kind === 'shield' || cue.kind === 'block' ? 'shield' : 'spark'" :size="42"/><i v-for="n in 9" :key="n" :style="{ '--particle': n }"/></template>
      </div>
    </template>
  </div>
</template>
