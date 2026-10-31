<script setup lang="ts">
import { sv } from '@nuxt/ui/locale'
defineProps<{ configured: boolean }>()
const emit = defineEmits<{ signedIn: [] }>()
const password = ref(''), pending = ref(false), error = ref('')
async function login() {
  if (pending.value || !password.value) return
  pending.value = true; error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', retry: 0, body: { password: password.value } })
    password.value = ''; emit('signedIn')
  } catch (failure) {
    const status = (failure as { statusCode?: number }).statusCode
    error.value = status === 401 ? 'Fel lösenord. Försök igen.' : status === 503 ? 'Åtkomsten är inte konfigurerad ännu.' : 'Inloggningen kunde inte slutföras. Försök igen.'
    password.value = ''
  } finally { pending.value = false }
}
</script>
<template>
  <UApp :locale="sv"><div class="world access-world"><div class="world-background"/><div class="vignette"/>
    <header class="site-header"><a href="/" class="brand" aria-label="Murgik"><span class="brand-rune">ᛗ</span><span>MURGIK<small>SKRIV DITT ÖDE</small></span></a><span class="eyebrow">PRIVAT POC</span></header>
    <main class="access-main"><section class="access-panel" aria-labelledby="access-title"><span class="access-rune" aria-hidden="true">ᛗ</span><div class="eyebrow">EN BERÄTTELSE VÄNTAR</div><h1 id="access-title">Stig in i Murgik.</h1><p>Ange det gemensamma lösenordet<br>för att öppna porten till Asklunden.</p>
      <form @submit.prevent="login"><label for="access-password">Lösenord</label><input id="access-password" v-model="password" type="password" name="password" autocomplete="current-password" maxlength="512" required :disabled="pending || !configured" autofocus/><p v-if="!configured" class="access-error" role="status">Privat åtkomst är inte konfigurerad ännu.</p><p v-else-if="error" class="access-error" role="alert">{{ error }}</p><button type="submit" class="gold-button" :disabled="pending || !configured || !password">{{ pending ? 'Öppnar porten…' : 'Logga in' }}<RuneIcon name="arrow" :size="20"/></button></form>
      <small>Din tillgång till smedjan börjar här.</small></section></main>
  </div></UApp>
</template>
