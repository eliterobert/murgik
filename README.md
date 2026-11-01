# Murgik

En fantasykortduell byggd med Nuxt 4, Vue, TypeScript och en deterministisk spelmotor. The Living Arsenal innehåller 80 handdesignade baskort, sju spelstilar, varierade 30-kortslekar, färdiga temalekar och ett sökbart kortbibliotek. AI Forge skapar validerade kombinationer av motorns befintliga effekter.

## Lokalt

```sh
npm install
npm run dev
```

`dev` läser `.env`. Privat inloggning kräver servervariablerna `MURGIK_ACCESS_PASSWORD` och `MURGIK_SESSION_SECRET` (minst 32 tecken). Med `OPENAI_API_KEY` används riktig AI Forge inklusive en kortillustration per uttryckligt Skapa-klick. `dev:ai` är ett likvärdigt alias. Saknad nyckel eller API-fel visas som fel; övningskort kräver spelarens uttryckliga val. Den äldre variabeln `MURGIK_DEMO` ignoreras. Inga hemligheter ska läggas i klientkod eller Git. Se [DEPLOY.md](DEPLOY.md) för modellval och Vercel.

## Kontrollera

```sh
npm test
npm run typecheck
npm run build
npm run security:check
```

Sätt `VERCEL=1` i byggmiljön för att kontrollera Vercel-preseten. Bygget väljer automatiskt rätt preset på Vercel.

Se [The Living Arsenal](docs/living-arsenal.md) för kort, lekbygge, Forge och begränsningar, [DEPLOY.md](DEPLOY.md) för konfiguration av privat/publik POC och [ljudlicenser](docs/audio-sources.md) för källor och licenser.
