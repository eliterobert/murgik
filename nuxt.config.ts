export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css', '~/assets/css/arena-v2.css', '~/assets/css/access.css', '~/assets/css/arsenal.css'],
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Murgik · Skriv ditt öde',
      htmlAttrs: { lang: 'sv' },
      meta: [{ name: 'description', content: 'En taktisk fantasyduell. Smid egna kort, väck uråldrig magi och skriv ditt öde i Murgik.' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },
  ui: { fonts: false },
  // Nuxt CLI selects .env.demo or .env explicitly; Vite must never load .env independently.
  vite: { envDir: false },
  colorMode: { preference: 'dark' },
  typescript: { strict: true },
  nitro: { preset: process.env.VERCEL ? 'vercel' : 'node-server', vercel: { functions: { maxDuration: 60 } } },
  routeRules: {
    '/**': { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' } },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } },
    '/art/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
    '/audio/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
    '/audio/licenses/**': { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Content-Disposition': 'attachment' } }
  }
})
