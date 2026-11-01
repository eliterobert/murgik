# Murgik på Vercel

## Privat AI Forge (standard)

Inloggade spelare använder riktig AI när `OPENAI_API_KEY` finns. `MURGIK_DEMO` ignoreras, även om en äldre lokal eller Vercel-konfiguration innehåller den. Saknad nyckel, nekad åtkomst och API-fel ger tydliga fel; inga övningskort ersätter spelarens idé automatiskt. Övningsläge måste väljas uttryckligen i Forge.

| Servervariabel | Krävs / användning |
| --- | --- |
| `MURGIK_ACCESS_PASSWORD` | Krävs: ett starkt gemensamt lösenord. |
| `MURGIK_SESSION_SECRET` | Krävs: stabil slumpmässig hemlighet, minst 32 tecken. |
| `OPENAI_API_KEY` | Krävs för AI: projekt med betalningsåtkomst till både text- och bildmodellen. |
| `MURGIK_PUBLIC_ORIGIN` | Valfri: exakt HTTPS-origin utan avslutande snedstreck; annars används begärans origin. |
| `OPENAI_MODEL` | Valfri: textmodell med Responses + Structured Outputs; standard `gpt-5.4`. |
| `OPENAI_IMAGE_MODEL` | Valfri: kompatibel GPT Image-modell; standard `gpt-image-2.5-sunburst`. |

Inga hemligheter ska ha `NUXT_PUBLIC_`-prefix. Namnen ovan är servervariabler och läses vid körning, så de kan konfigureras på Vercel utan att byggas in i klienten. Den äldre variabeln `MURGIK_IMAGE_GENERATION` används inte; riktig privat Forge inkluderar alltid ett bildförsök efter ett lyckat, validerat textsvar.

Lokalt läser `npm run dev` endast `.env`; `dev:ai` är ett likvärdigt alias. Bygg/typecheck använder den credentialfria `.env.demo`, som inte längre tvingar demoläge. `npm run preview` läser `.env` innan den byggda Node-servern startar; `preview:ai` är ett kompatibilitetsalias.

## Ett uttryckligt klick, högst två API-försök

Skapa/Förhandsgranska gör högst **ett textförsök och ett bildförsök**. Texten valideras med Zod och balanseras deterministiskt innan bildförsöket. Bildprompten innehåller spelarens fullständiga beskrivning och det balanserade kortets identitet. Inga automatiska retries eller bildhämtningar från tredje part görs. Namnändring, rendering och signerad bekräftelse gör inga genereringsanrop. Dubbelklick blockeras direkt i klienten och ett pågående smide per åtkomstsession skyddas även på servern.

Privatläget har ingen sessionskvot på 10 eller global kvot på 50. Spelets befintliga Forge Charges och övriga spelregler är kvar. Inloggning, signerade HttpOnly/Secure/SameSite-cookies, origin/CSRF, 8192-byte requestgräns, 500-teckens promptgräns, Zod, signerat utkast och deterministisk balans kvarstår. Textsvaret har en generös gräns på 4096 outputtokens och 60 sekunders timeout; bilden har 180 sekunder. Endast ett försök görs även vid timeout eller fel.

Bildsvaret är en JPEG (1536×1024, hög kvalitet), högst 2,8 MB före base64, som följer samma Forge-svar. Det ryms inom Vercels 4,5 MB funktionssvar. Ingen beständig filsystemsskrivning eller extra lagringstjänst krävs. Bilden cachas i webbläsarens minne under matchen, följer namnändring och visas på kortet. Ny match/omladdning förlorar match och bild som tidigare; ingen bakgrundsgenerering startar. Bildfel visas tydligt och spelaren kan bekräfta det riktiga AI-kortet med befintlig fallbackillustration. Ett nytt genereringsförsök kräver ett nytt uttryckligt klick.

## Valfritt delat dubbelanropsskydd

Utan Redis fungerar privat Forge med klientlås och serverinstansens tillfälliga lås/request-ID-register. Detta register delas **inte** mellan Vercel-instanser och överlever inte omstarter. För persistent deduplicering mellan instanser: konfigurera hela paret `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, alternativt hela paret `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Blanda inte paren. En atomisk Redis-reservation sker före OpenAI; request-ID behålls i 24 timmar och sessionslåset har fem minuters kraschlease. Ingen privat genereringskvot införs. Om konfigurerad Redis inte fungerar blockeras anropet säkert före generering. Ingen ledger-initiering eller Turnstile krävs för privatläget.

Håll lösenordet privat. Använd Vercel Firewall på `/api/auth/login` och `/api/forge` vid behov; inloggningsskyddet och låsen ersätter inte ett budgettak på OpenAI-projektet. Ett serveravbrott efter ett betalt anrop kan fortfarande innebära kostnad utan levererat kort. Inget automatiskt återförsök görs.

## Manuella steg före deploy

1. Ange de tre obligatoriska servervariablerna ovan i Vercels avsedda Preview/Production-miljöer. Säkerställ projektets åtkomst till text- och bildmodellerna. Modellnamnen kan ändras med de valfria variablerna; välj en bildmodell som stöder Images API, JPEG och angiven storlek/kvalitet.
2. Välj Nuxt, projektroten, Node.js 24, `npm ci`, `npm run build` och automatisk output. Använd Node Functions med Fluid compute och stöd för **300 sekunders maxDuration**, som är konfigurerat i Nitro. Ingen statisk export.
3. Lämna `MURGIK_PRIVATE_FORGE` osatt (standard). Ta gärna bort den obsoleta `MURGIK_DEMO` för tydlighet. Redis och Turnstile krävs inte; konfigurera Redis om deduplicering över instanser behövs.
4. Behåll Deployment Protection under privat kontroll. Testa inloggning, AI-status, ett uttryckligt smide, illustration, namnändring, bekräftelse och utloggning. Ett verkligt smide kostar API-krediter. Automatiserade tester använder bara simulerade svar; riktig provideråtkomst är inte verifierad här.
5. Kör `npm test`, `npm run typecheck`, `npm run build` och `npm run security:check`. Verifiera servervariabler på runtime-miljön. Bygg/aktivera själv en ny deployment efter ändrade Vercel-inställningar. Ingen deploy görs av denna implementation.

## Bevarad publik gren och kvotåterställning

Sätt endast `MURGIK_PRIVATE_FORGE=false` om den tidigare, begränsade publika grenen ska användas bakom inloggningen. Den är fortsatt textbaserad med befintliga illustrationer och kräver Redis-paret, `MURGIK_SESSION_SECRET`, `MURGIK_PUBLIC_ORIGIN`, `TURNSTILE_SITE_KEY` och `TURNSTILE_SECRET_KEY`. Turnstile ska vara en riktig Managed-widget för avsedda hostname. Konfigurationsfel/slut kvot ger fel, aldrig automatisk demo.

Den publika Redis-/Turnstile-/kvotkoden är kvar: högst 10 lyckade AI-kort/session, 3/match och 50 globala textförsök. Atomisk reservation före OpenAI, cache, request-ID/fingeravtryck, sex sekunders cooldown, POST-rate-limit och två samtidiga smiden globalt kvarstår. Texttimeout är 25 sekunder i denna gren, inom dess 45-sekunders kraschlease. Inga automatiska retries.

Initiera den publika ledgern **en gång**, endast i en ny avsedd databas utan eviction/automatisk rensning:

```redis
HSET murgik:poc:v1:ledger enabled 1 attempts 0
PERSIST murgik:poc:v1:ledger
TTL murgik:poc:v1:ledger
```

TTL ska vara `-1`. Saknad/utgången/avstängd ledger blockerar AI. För nödstopp: `HSET murgik:poc:v1:ledger enabled 0`, vänta minst 60 sekunder. Endast efter uttryckligt beslut om ytterligare högst 50 försök:

```redis
HSET murgik:poc:v1:ledger attempts 0 enabled 1
PERSIST murgik:poc:v1:ledger
```

Låt sessions- och idempotensposter ligga kvar. Använd inte `FLUSHDB`. Ingen publik reset-endpoint finns. Privat Forge använder inte denna ledger.

Tekniska API-kontrakt: [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Images](https://developers.openai.com/api/reference/resources/images/methods/generate), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration), [Vercel limits](https://vercel.com/docs/functions/limitations).
