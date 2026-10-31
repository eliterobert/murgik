<script setup lang="ts">
import { artIdentity, localArtwork } from '#shared/game/art'
import type { CardDraft } from '#shared/game/types'
const props = defineProps<{ card: CardDraft }>()
const { library } = useIllustrations()
const illustration = computed(() => library.value[artIdentity(props.card)])
const primary = computed(() => illustration.value?.status === 'ready' && illustration.value.url ? illustration.value.url : localArtwork(props.card))
const failedPrimary = ref(false)
const failedLocal = ref(false)
const loaded = ref(false)
const imageElement = ref<HTMLImageElement | null>(null)
const source = computed(() => failedPrimary.value ? localArtwork(props.card) : primary.value)
const pending = computed(() => ['queued', 'generating'].includes(illustration.value?.status ?? ''))
watch(primary, () => { failedPrimary.value = false; failedLocal.value = false; loaded.value = false })
function syncCachedImage() {
  if (imageElement.value?.complete) {
    if (imageElement.value.naturalWidth > 0) loaded.value = true
    else imageError()
  }
}
onMounted(syncCachedImage)
onUpdated(syncCachedImage)
function imageError() {
  if (source.value !== localArtwork(props.card)) { failedPrimary.value = true; loaded.value = false }
  else failedLocal.value = true
}
</script>
<template>
  <div class="art-surface" :class="[card.theme, { 'art-loading': !loaded, 'art-generating': pending }]">
    <div class="art-fallback" aria-hidden="true"><span>ᛗ</span><i/><i/><i/></div>
    <img v-if="!failedLocal" ref="imageElement" :key="source" :src="source" :alt="`${card.name} – fantasyillustration`" class="card-art" :class="{ 'art-loaded': loaded }" width="768" height="512" loading="eager" decoding="async" draggable="false" @load="loaded = true" @error="imageError"/>
    <span v-if="pending" class="art-status"><i/>Illustrationen växer fram</span>
    <span v-else-if="illustration?.status === 'failed'" class="art-status art-status-fallback" :title="illustration.message">Originalillustration</span>
    <span v-else-if="failedLocal" class="art-status">Runorna finner en ny form</span>
  </div>
</template>
