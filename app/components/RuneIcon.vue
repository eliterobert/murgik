<script setup lang="ts">
withDefaults(defineProps<{ name?: string; size?: number }>(), { name: 'forge', size: 22 })
const paths: Record<string, string> = {
  sound: 'm11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'm11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m-6 0 6-6',
  forge: 'm12 3 7 4-7 4-7-4 7-4Zm0 8v10M5 7v8l7 6 7-6V7M3 12l9 5 9-5',
  sword: 'm16 3 5 0 0 5-11 11-5-5L16 3ZM4 16l4 4M2 22l4-4m7-7 3 3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  mana: 'm12 2 7 10-7 10-7-10 7-10Zm0 0v20M5 12h14',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  book: 'M12 5c-3-3-7-3-10-2v16c3-1 7-1 10 2 3-3 7-3 10-2V3c-3-1-7-1-10 2Zm0 0v16',
  close: 'm6 6 12 12M6 18 18 6',
  restart: 'M3 10a9 9 0 1 1 1 8M3 4v6h6',
  spark: 'm12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  crown: 'm3 6 4 5 5-8 5 8 4-5-2 13H5L3 6Zm2 10h14',
  chevron: 'm9 5 7 7-7 7'
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.spark" /></svg></template>
