<script setup lang="ts">
interface AccessState { configured: boolean; authenticated: boolean; csrf?: string; privateForge: boolean }
const { data: access, refresh } = await useFetch<AccessState>('/api/auth/session')
</script>
<template>
  <MurgikGame v-if="access?.authenticated && access.csrf" :access-csrf="access.csrf"/>
  <AccessGate v-else :configured="access?.configured ?? false" @signed-in="refresh()"/>
</template>
