# Murgik: publik POC på Vercel

**Status: BLOCKED tills riktiga OpenAI-, Upstash- och Turnstile-credentials har konfigurerats och verifierats.** Ingen deploy har gjorts. Spelet fungerar i tydligt märkt demoläge utan dessa tjänster. Design, spelregler, illustrationer, ljud och animationer är bevarade. AI-bildgenerering är avstängd och bild-endpoints kan inte starta betalda anrop.

## Externa tjänster och miljövariabler

Skapa/anslut själv en beständig Upstash Redis-databas via Vercel Marketplace eller Upstash, ett OpenAI API-projekt med betalningsåtkomst samt en Cloudflare Turnstile-widget. Inga tjänster har skapats automatiskt.

Lägg följande namn i **Vercel → Project Settings → Environment Variables** för rätt miljö. Klistra bara in respektive värde där, aldrig i källkod eller publika variabler.

| Variabel | Användning |
| --- | --- |
| `OPENAI_API_KEY` | Servernyckel från ditt OpenAI API-projekt. |
| `UPSTASH_REDIS_REST_URL` | Redis-databasens HTTPS REST-adress. |
| `UPSTASH_REDIS_REST_TOKEN` | Databasens skrivbehöriga REST-token. |
| `MURGIK_SESSION_SECRET` | Slumpmässig stabil signeringshemlighet, minst 32 tecken. Generera med en lösenordshanterare. Behåll samma hemlighet mellan deployer. |
| `MURGIK_PUBLIC_ORIGIN` | Spelets exakta publika HTTPS-origin, utan avslutande snedstreck eller sökväg. Måste stämma med den adress spelaren besöker. |
| `TURNSTILE_SITE_KEY` | Widgetens publika site key. Levereras via `/api/mode`, inget `NUXT_PUBLIC_` behövs. |
| `TURNSTILE_SECRET_KEY` | Widgetens privata servernyckel för Siteverify. |

`KV_REST_API_URL` och `KV_REST_API_TOKEN` stöds som ett alternativt komplett par till Upstash-namnen. Blanda inte paren. För riktig AI ska `MURGIK_DEMO` **inte** finnas i Vercels runtime. Variabeln kan användas för att uttryckligen låsa demoläge. Modellen är låst i serverkoden till `gpt-4o-mini`, med Structured Outputs, högst 1200 outputtokens, 25 sekunders timeout och inga automatiska retries. `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL` och `MURGIK_IMAGE_GENERATION` används inte.

Använd separata OpenAI-/Redis-/Turnstile-miljöer för Preview och Production. Dela databas endast om de avsiktligt ska dela samma 50-försöksbudget. Saknad konfiguration ger automatiskt demoläge.

## Initiera budgeten manuellt

Använd en beständig Redis-databas med **eviction avstängd**. Kör i databasens privata Redis Console, före första riktiga AI-anropet:

```redis
HSET murgik:poc:v1:ledger enabled 1 attempts 0
PERSIST murgik:poc:v1:ledger
TTL murgik:poc:v1:ledger
```

Det sista kommandot ska returnera `-1`. Kontrollera också att detta är den avsedda databasen. Ledgern får inte automatiskt rensas eller ges TTL. Om den saknas, har TTL, är avstängd eller lagringen inte går att nå blockeras AI. **Kör inte initieringen igen på en använd budget.** Applikationen initierar eller återställer aldrig budgeten själv.

## Hur skyddet fungerar

- En anonym, HMAC-signerad HttpOnly/Secure/SameSite-cookie identifierar demosessionen i upp till ett år. Matchstart och omladdning ändrar inte identiteten. Sessionens högst tio lyckade AI-kort lagras utan TTL i Redis. De tre smidesladdningarna per match behålls och verifieras även server-side för AI.
- En atomisk Redis Lua-reservation kontrollerar kvoter och reserverar **före** OpenAI-anropet. Högst 50 globala reservationer tillåts. Fel, timeout och osäkra nätverksutfall räknas som förbrukade försök och återbetalas aldrig. Ett förlorat reservationssvar leder till noll OpenAI-anrop från den begäran.
- Request-ID, innehållsfingeravtryck, status och färdigt kort sparas i samma ledger. Dubbletter återanvänder resultat eller nekas; samma ID startar aldrig ett nytt OpenAI-anrop, även efter en krasch. En osäker kvittens ger ett fel där klienten behåller samma ID för säker återhämtning.
- Ett pågående smide per session och två globalt, med 45-sekunders kraschlease. Även en sessionsplats reserveras före anropet. En kvitterad framgång omvandlar platsen till förbrukad kvot; ett kvitterat fel släpper platsen. En oklar/kraschad reservation behåller platsen för att aldrig kunna överskrida tio lyckade genereringar. Minst sex sekunder mellan reservationer per session. Högst tolv POST-försök per session och 24 per HMAC-hashad IP under en 60-sekundersperiod. Vercels edge-satta IP-header används på Vercel; godtyckliga forwarded-headers används inte lokalt.
- Verifierad Turnstile krävs före en ny AI-reservation, med rätt hostname och action. Ett sparat resultat kräver inte en ny engångstoken. JSON, origin, cookie, CSRF-header och Zod-schema kontrolleras server-side. Prompt högst 500 tecken och request högst 8192 bytes, även vid chunked överföring.
- Inget verktyg eller kod från modellen körs. Endast fasta effekter/keywords i strikt JSON accepteras, Zod validerar och den befintliga deterministiska balansen beräknar faktisk styrka och pris. Modelltext renderas som text av Vue.
- Nycklar, råa prompts, IP-adresser och upstream-felsvar loggas inte av applikationen. Redis lagrar genererade kort och hashat requestinnehåll, inte råa prompts. Ratelimitnycklar har kort TTL; ledgern är permanent och begränsas av 50 reservationer per manuell budgetperiod.
- Vid uppnådd kvot eller otillgänglig lagring visas ett fast lokalt övningskort med tydlig märkning att beskrivningen inte tolkas. Vid osäker reservation/slutkvittens görs inget nytt AI-anrop. Matchens laddningar räknas av först när ett kort faktiskt förs in av spelmotorn.

## Vercel-inställningar och steg före deploy

1. Kontrollera den riktiga Git-kopian och historiken med en secretscanner innan du ansluter den till Vercel. Den levererade arbetsmappen saknar `.git`, så historiken kan inte verifieras här. `.env` och alla övriga privata miljöfiler är ignorerade. Gör själv eventuell commit/push efter granskning; agenten gör ingen.
2. Konfigurera tjänsterna och variablerna ovan. I Turnstile ska endast avsedda hostname tillåtas, och widgeten ska vara av typen Managed. Använd riktiga produktionsnycklar, inga always-pass testnycklar.
3. Initiera och kontrollera Redis-ledgern enligt ovan. Kontrollera att Vercels funktion har nätverksåtkomst till Upstash, Cloudflare och OpenAI.
4. När du själv skapar Vercel-projektet: välj **Nuxt**, projektroten som Root Directory, **Node.js 24**, install command `npm ci`, build command `npm run build` och behåll frameworkets automatiska outputinställning. Använd inte statisk export eller `nuxt generate`. Nitro väljer Vercel-preset på Vercel och använder Node Functions med 60 sekunders maxDuration. Inga bestående filer skrivs av serverkoden.
5. Aktivera Vercel Deployment Protection för en privat verifiering före publik åtkomst. Lägg också en Firewall rate-limit på `/api/forge` för att begränsa automatiserad trafik innan den når serverfunktionen. Den inbyggda globala AI-budgeten gäller även utan brandväggen, men skyddar inte Vercels trafik-/funktionskostnader.
6. Kontrollera privat: `/api/mode` visar AI med återstående kvot och `images` avstängt. Säkerhetswidgeten laddar. Smid en egen ovanlig kortkombination, kontrollera kortets namn/effekter och spela kortet. Genomför attack, blockering och en hel match. Observera att denna kontroll förbrukar ett av de 50 försöken.
7. Kontrollera i Redis att `attempts` ökade en gång. Upprepa samma request-ID och kontrollera att resultatet återanvänds utan ökning. Testa ny match och omladdning: sessionens återstående kvot ska bestå. Verifiera gräns-/racefall i en separat testdatabas, aldrig genom att belasta den publika budgeten.
8. Gör Redis tillfälligt otillgänglig och testa saknad API-nyckel i en separat privat testmiljö: spelet ska visa demoläge, använda originalbilder och aldrig anropa OpenAI. Återställ konfigurationen. Kontrollera klientbundle och loggar efter hemligheter.
9. Kör lokalt `npm test`, `npm run typecheck`, `npm run build` och `npm run security:check`. Låt sedan Vercels eget bygge och privata funktionstest passera. Publicera först när verklig AI och extern lagring är verifierade. Ingen deploy ingår i denna leverans.

## Manuell global återställning / nödstopp

Kör `HSET murgik:poc:v1:ledger enabled 0` i privata Redis Console för omedelbart stopp av nya AI-reservationer. Vänta minst 60 sekunder så pågående anrop/leases hinner avslutas. Kontrollera verksamhetens budget. För att uttryckligen godkänna ytterligare högst 50 försök:

```redis
HSET murgik:poc:v1:ledger attempts 0 enabled 1
PERSIST murgik:poc:v1:ledger
```

Sessionernas lyckade kort, matchladdningar och idempotensposter ligger kvar. Radera inte ledgern, ändra inte nyckelnamnen och använd inte `FLUSHDB` som normal återställning. Någon offentlig reset/admin-endpoint finns inte. Budgetändringar ska dokumenteras av operatören. OpenAI-projektets egna budgetvarningar är ett extra skydd, inte applikationens kvotkälla.

## Kvarvarande verifiering och risker

Riktig OpenAI/Upstash/Turnstile och Vercels drift har inte verifierats utan credentials och deployment. Lokala tester kör de verkliga Lua-skripten i en Lua-VM med Redis-primitiver; detta ersätter inte ett riktigt Upstash-test. En anonym besökare kan skapa en ny identitet genom att rensa cookies/byta webbläsare; den globala budgeten gäller ändå. Människor kan förbruka den lilla budgeten även med captcha. Efter en krasch kan ett betalt kort gå förlorat om kvittensen aldrig sparades; försöket återbetalas inte och samma ID återanropas inte. Matchstate ligger som tidigare i webbläsarminnet och återställs vid sidomladdning, medan AI-kvoterna består.

Officiella referenser: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini), [Nuxt på Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [Turnstile Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Lokalt granskningsresultat: 72 tester och typecheck passerar. Node- och Vercel-preset bygger. Komplett match till seger har testats med simulerade externa tjänster; origin/CSRF/captcha/kvot/idempotens/fail-closed har kontrollerats via HTTP. Klient-/serverartefakter har secretskannats utan fynd. Säkerhetsuppdateringar tar bort höga/kritiska auditfynd; 12 medel och 3 låga transitiva fynd återstår och är dokumenterade i README. Dessa resultat innebär inte verifierad riktig OpenAI/Upstash eller en genomförd Vercel-deploy.
