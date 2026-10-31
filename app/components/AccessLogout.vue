<script setup lang="ts">
const props = defineProps<{ csrf: string }>()
const pending = ref(false), error = ref(false)
async function logout() {
  if (pending.value) return
  pending.value = true; error.value = false
  try {
    await $fetch('/api/auth/logout', { method: 'POST', retry: 0, headers: { 'X-Murgik-Access-CSRF': props.csrf } })
    window.location.assign('/')
  } catch { error.value = true; pending.value = false }
}
</script>
<template><button class="text-button access-logout" :disabled="pending" :title="error ? 'Utloggningen misslyckades. Försök igen.' : 'Logga ut'" @click="logout"><RuneIcon name="arrow" :size="16"/>{{ error ? 'Försök logga ut igen' : pending ? 'Loggar ut…' : 'Logga ut' }}</button></template>
