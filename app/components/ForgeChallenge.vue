<script setup lang="ts">
const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ token: [value: string] }>()
const container = ref<HTMLElement | null>(null)
const failed = ref(false)
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void }
const api = () => (window as unknown as { turnstile?: Turnstile }).turnstile
let widget: string | undefined, disposed = false
onMounted(async () => {
  try {
    if (!api()) await new Promise<void>((resolve, reject) => {
      let script = document.querySelector<HTMLScriptElement>('script[data-murgik-turnstile]')
      if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.dataset.murgikTurnstile = 'true'; document.head.appendChild(script) }
      const timeout = setTimeout(() => reject(new Error('timeout')), 12000)
      script.addEventListener('load', () => { clearTimeout(timeout); resolve() }, { once: true })
      script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('unavailable')) }, { once: true })
    })
    if (!disposed && container.value) widget = api()!.render(container.value, { sitekey: props.siteKey, action: 'murgik-forge', theme: 'dark', size: 'flexible', callback: (token: string) => emit('token', token), 'expired-callback': () => emit('token', ''), 'error-callback': () => { failed.value = true; emit('token', '') } })
  } catch { if (!api()) document.querySelector('script[data-murgik-turnstile]')?.remove(); if (!disposed) failed.value = true }
})
onBeforeUnmount(() => { disposed = true; emit('token', ''); if (widget) api()?.remove(widget) })
</script>
<template><div class="forge-challenge"><div ref="container"/><p v-if="failed" role="status">Säkerhetskontrollen kunde inte laddas. Stäng och öppna smedjan för att försöka igen.</p></div></template>
