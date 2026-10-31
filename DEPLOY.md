# Murgik på Vercel

## Privat lösenordsskyddad POC

Konfigurera `MURGIK_ACCESS_PASSWORD` (ett starkt gemensamt lösenord), `MURGIK_SESSION_SECRET` (slumpmässig stabil hemlighet, minst 32 tecken) och `OPENAI_API_KEY` i Vercels servermiljö. Ta bort `MURGIK_DEMO` för riktig AI. `MURGIK_PUBLIC_ORIGIN` kan ange den exakta HTTPS-adressen; annars används samma origin som begäran.

Spelet visar en inloggningssida. Lösenordet verifieras på servern och en signerad HttpOnly/Secure/SameSite-session gäller i 12 timmar. Byte av lösenord eller signeringshemlighet ogiltigförklarar gamla sessioner. Saknad åtkomstkonfiguration stänger grinden. Logga ut finns i sidhuvudet på desktop och i ljud-/inställningsmenyn på mobil.

**Privat Forge är standard:** inloggade kan använda AI utan Redis eller Turnstile. Zod, deterministisk balans, origin/CSRF, body-/promptgränser, tokenbudget, timeout och avsaknad av automatiska retries kvarstår. Den publika Redis-/Turnstile-/kvotkoden är bevarad. Dess globala budget, rate limiting och persistenta deduplicering används inte i privatläget; håll därför lösenordet privat och begränsa `/api/auth/login` och `/api/forge` med Vercel Firewall vid behov. Sätt valfritt `MURGIK_PRIVATE_FORGE` till `false` för att använda den befintliga publika grenen bakom samma inloggning.

Vercel-inställningar: Nuxt, Node.js 24, `npm ci`, `npm run build`, automatisk output. Testa fel/rätt lösenord, omladdning, Forge och utloggning privat före delning. En verklig AI-nyckel och API-åtkomst behöver verifieras av dig; testerna använder simulerat AI-svar. Ingen deploy har gjorts.

## Befintlig publik gren

**Publika grenen: BLOCKED tills riktiga OpenAI-, Upstash- och Turnstile-tjänster har verifierats.** Ingen deploy eller tjänst har skapats. Utan fungerande konfiguration används tydligt märkt demoläge.

## Miljövariabler

Lägg dessa namn i Vercel → Project Settings → Environment Variables för rätt miljö. Värden ska bara finnas i tjänsternas privata inställningar.

| Namn | Ska innehålla |
| --- | --- |
| `OPENAI_API_KEY` | Servernyckel från ett OpenAI API-projekt med betalningsåtkomst. |
| `UPSTASH_REDIS_REST_URL` | Databasens HTTPS REST-adress. |
| `UPSTASH_REDIS_REST_TOKEN` | Databasens skrivbehöriga REST-token. |
| `MURGIK_SESSION_SECRET` | Slumpmässig stabil hemlighet, minst 32 tecken; generera med lösenordshanterare. Behåll mellan deployer. |
| `MURGIK_PUBLIC_ORIGIN` | Exakt publik HTTPS-origin utan sökväg eller avslutande snedstreck. |
| `TURNSTILE_SITE_KEY` | Widgetens publika site key. |
| `TURNSTILE_SECRET_KEY` | Widgetens privata Siteverify-nyckel. |

Alternativt stöds det kompletta paret `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Blanda inte paren. Ta bort `MURGIK_DEMO` från Vercels runtime för AI. Inga `NUXT_PUBLIC_`-hemligheter behövs. `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL` och `MURGIK_IMAGE_GENERATION` används inte: modellen är låst till `gpt-4o-mini` och bildgenerering är avstängd.

## Exakta steg före deploy

1. Granska den riktiga Git-kopian och historiken med en secretscanner. Den här arbetsmappen saknar `.git`, så historiken är overifierad. `.gitignore` och `.vercelignore` utesluter privata miljöfiler, loggar och testfixtures. `.env.demo` innehåller inga credentials.
2. Skapa/anslut själv en beständig **Upstash Redis**-databas via Upstash eller Vercel Marketplace. Stäng av eviction och automatisk rensning. Använd separat testdatabas för gräns-/raceprov. Preview och Production delar budget endast om de medvetet använder samma databas.
3. Initiera budgeten **en gång** i privata Redis Console:

```redis
HSET murgik:poc:v1:ledger enabled 1 attempts 0
PERSIST murgik:poc:v1:ledger
TTL murgik:poc:v1:ledger
```

TTL ska vara `-1`. Kör aldrig initieringen igen på en använd budget. Saknad, utgången eller avstängd ledger blockerar AI.

4. Skapa själv en **Cloudflare Turnstile Managed-widget**. Tillåt endast avsedda hostname. Använd riktiga nycklar, inga always-pass testnycklar. Lägg in variablerna ovan.
5. När du själv skapar Vercel-projektet: välj **Nuxt**, projektroten, **Node.js 24**, install command `npm ci`, build command `npm run build` och automatisk framework-output. Använd inte `nuxt generate`. Nitro väljer Vercel-preset och Node Functions med 60 sekunders maxDuration. Inga bestående filer skrivs av serverkoden.
6. Behåll **Deployment Protection** under privat verifiering. Lägg en Vercel Firewall-rate-limit på `/api/forge` där planen stöder det; AI-kvoten skyddar inte Vercels trafik-/funktionskostnader. Kontrollera utgående åtkomst till Upstash, Cloudflare och OpenAI.
7. Verifiera privat: `/api/mode` visar AI och kvarvarande kvot. Widgeten fungerar. Smid en ovanlig kortkombination, spela kortet och genomför attack, blockering och en hel match. Kontrollera att Redis `attempts` ökar exakt en gång. En upprepad identisk förfrågan får inte öka räknaren. Omladdning och ny match ska behålla sessionskvoten. Detta använder den riktiga budgeten.
8. Testa saknad nyckel, lagringsavbrott, gränser och parallellitet i separat testmiljö. Kontrollera att demoläge används utan OpenAI-anrop. Kör `npm test`, `npm run typecheck`, `npm run build` och `npm run security:check`. Publicera först efter verkliga tjänste- och Vercelkontroller. Ingen deploy ingår här.

## Kvoter och manuell återställning

Signerad HttpOnly/Secure/SameSite-cookie identifierar sessionen även efter omladdning. Atomiska Redis Lua-operationer ger högst **10 lyckade AI-kort per session**, **3 per match** och **50 globala API-reservationer**. Reservationen sker före OpenAI. Försök återbetalas aldrig efter fel/timeout. Sessionsplatser hålls även vid osäkra kraschutfall. Request-ID och innehållsfingeravtryck förhindrar dubbla API-anrop; färdiga resultat återanvänds.

Ett pågående smide per session, två globalt; 45 sekunders kraschlease. Minst sex sekunder mellan reservationer. Högst tolv POST-försök per session och 24 per hashad IP under 60 sekunder. Prompt högst 500 tecken, body högst 8192 bytes, högst 1200 outputtokens, 25 sekunders OpenAI-timeout och inga automatiska retries. Origin, CSRF och Turnstile kontrolleras server-side. Zod och den oförändrade deterministiska motorn validerar och balanserar kort. Saknad konfiguration, slut kvot eller lagringsavbrott ger demoläge; oklara kvittenser ger säkert fel utan nytt AI-anrop.

För nödstopp: kör `HSET murgik:poc:v1:ledger enabled 0` i privata Redis Console. Vänta minst 60 sekunder. För att uttryckligen godkänna ytterligare högst 50 försök:

```redis
HSET murgik:poc:v1:ledger attempts 0 enabled 1
PERSIST murgik:poc:v1:ledger
```

Sessioner och idempotensposter ligger kvar. Använd inte `FLUSHDB`, byt inte nyckelnamn och radera inte ledgern som normal återställning. Ingen publik reset-endpoint finns. Dokumentera återställningen manuellt.

## Verifiering och kvarvarande risker

72 tester, typecheck samt Node- och Vercel-build passerar. En hel match till seger och HTTP-skydd har testats lokalt mot den byggda Vercel-adaptern med simulerade externa tjänster. Lua-testerna kör riktig Lua med simulerade Redis-primitiver. Secretskanningen har inga fynd. Audit: inga höga/kritiska fynd; 12 medel och 3 låga transitiva fynd återstår.

Riktiga tjänster och Verceldrift är overifierade utan credentials. Cookies kan rensas för en ny anonym identitet; den globala 50-gränsen består. Ett kraschat anrop kan förbruka budget utan att leverera kort. Matchstate återställs som tidigare vid omladdning; AI-kvoten består. Full granskning och officiella referenser finns i [docs/production-review.md](docs/production-review.md).

