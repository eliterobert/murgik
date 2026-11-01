<script setup lang="ts">
import { deckStyles } from '#shared/game/decks'
import type { DeckChoice } from '#shared/game/decks'
const choice=defineModel<DeckChoice>({required:true})
withDefaults(defineProps<{ id?:string }>(),{id:'deck-choice'})
</script>
<template><div class="deck-selection"><label :for="id"><RuneIcon name="book" :size="17"/>VÄLJ DIN ARSENAL</label><select :id="id" v-model="choice"><option value="random">Slumpmässig lek · en ny berättelse</option><option v-for="(deck,key) in deckStyles" :key="key" :value="key">{{ deck.name }}</option></select><p>{{ choice==='random'?'En ny balanserad 30-kortslek. Veyra får en annan strategi.':deckStyles[choice].description }}</p><small>30 kort · högst 2 kopior · 3 smidesladdningar</small></div></template>
