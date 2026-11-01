<script setup lang="ts">
import { baseCards, filterLibrary, playstyles } from '#shared/game/library'
import type { BaseCardDefinition, LibraryFilters } from '#shared/game/library'
import { cardText, effectText, keywordHelp, keywordNames } from '#shared/game/text'
const open=defineModel<boolean>('open',{required:true})
const filters=reactive<LibraryFilters>({search:'',type:'all',mana:'all',style:'all'})
const cards=computed(()=>filterLibrary(filters))
const selected=shallowRef<BaseCardDefinition|null>(null)
const detail=ref<HTMLElement|null>(null)
async function inspect(entry:BaseCardDefinition){selected.value=entry;await nextTick();detail.value?.focus({preventScroll:true})}
function reset(){filters.search='';filters.type='all';filters.mana='all';filters.style='all'}
watch(open,value=>{if(!value)selected.value=null})
</script>
<template>
  <UModal v-model:open="open" title="Kortbibliotek" description="Åttio kort. Sju vägar. Din nästa kombination väntar." :ui="{content:'library-modal'}">
    <template #body><section class="collection-shell" aria-label="Murgiks samling"><div class="collection-heading"><div><div class="eyebrow">THE LIVING ARSENAL</div><h2>Samlingen</h2></div><span>{{ cards.length }} / {{ baseCards.length }} baskort</span></div>
      <div class="library-filters"><label class="library-search" for="library-search">Sök kortnamn<input id="library-search" v-model="filters.search" type="search" placeholder="Sök bland runor och varelser…"/></label><label for="library-type">Korttyp<select id="library-type" v-model="filters.type"><option value="all">Alla kort</option><option value="creature">Varelser</option><option value="spell">Besvärjelser</option></select></label><label for="library-mana">Mana<select id="library-mana" v-model="filters.mana"><option value="all">Alla kostnader</option><option v-for="n in 8" :key="n" :value="String(n)">{{ n }} mana</option></select></label><label for="library-style">Spelstil<select id="library-style" v-model="filters.style"><option value="all">Alla spelstilar</option><option v-for="(label,key) in playstyles" :key="key" :value="key">{{ label }}</option></select></label></div>
      <div class="library-layout"><div class="library-gallery" aria-label="Baskort"><button v-for="entry in cards" :key="entry.id" class="library-card" :class="{chosen:selected?.id===entry.id}" :aria-label="`Visa ${entry.card.name}`" :aria-pressed="selected?.id===entry.id" @click="inspect(entry)"><GameCard :card="entry.card" display-only/><span class="library-card-role">{{ entry.role }}</span></button><div v-if="!cards.length" class="library-empty"><RuneIcon name="book" :size="40"/><h3>Inga runor matchar sökningen.</h3><button class="text-button" @click="reset">Rensa filtren</button></div></div>
        <section v-if="selected" ref="detail" class="library-detail" tabindex="-1" aria-label="Kortdetaljer"><button class="text-button library-back" @click="selected=null">← Tillbaka till korten</button><GameCard :card="selected.card" display-only/><div class="collection-tags"><span v-for="style in selected.styles" :key="style">{{ playstyles[style] }}</span></div><h3>{{ selected.role }}</h3><p class="detail-summary">{{ cardText(selected.card) }}</p><ol v-if="selected.card.effects.length" class="detail-effects"><li v-for="(effect,i) in selected.card.effects" :key="i">{{ effectText(effect) }}</li></ol><p v-for="keyword in selected.card.keywords" :key="keyword" class="detail-keyword"><b>{{ keywordNames[keyword] }}</b> {{ keywordHelp[keyword] }}</p><div class="collection-synergy"><RuneIcon name="forge" :size="20"/><div><h4>Spela tillsammans</h4><p>{{ selected.synergy }}</p></div></div><small>Effekterna sker en gång när kortet spelas, i visad ordning.</small></section>
        <aside v-else class="library-invitation"><RuneIcon name="eye" :size="32"/><h3>Hitta nästa gnista.</h3><p>Välj ett kort för full regeltext, roll och kombinationer.</p><span>Ingen upplåsning. Alla baskort kan finnas i en lek.</span></aside>
      </div></section></template>
    <template #footer><span class="library-footnote">Högst två kopior per lek. AI Forge skapar kort utanför samlingen.</span><button class="gold-button" @click="open=false">Tillbaka<RuneIcon name="arrow" :size="17"/></button></template>
  </UModal>
</template>
