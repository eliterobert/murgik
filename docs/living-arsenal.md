# Murgik – The Living Arsenal

## Kort och lekar

Samlingen innehåller **80 handdesignade baskort**. De tidigare 14 korten behåller sina regler och priser. De nya korten använder samma schema, illustrationer och deterministiska spelmotor. Kortens samlings-ID:n, roller och synergier finns separat från kortens strikta regelschema i `shared/game/library.ts`.

Sju spelstilar stöds: aggressiv, defensiv, kontroll, läkning, blodspakter, förstärkning och kombinationer. Blodspakter betalar **hjältens eget liv**; de offrar inte varelser.

En lek innehåller exakt 30 kort, högst två kopior av varje samlings-ID, 18 varelser och 12 besvärjelser. Manakurvan är 10 kort för 1–2 mana, 12 för 3–4 och 8 för 5–8. Slumplekar väger tematiska kort högre och innehåller minst tio kort från sin valda spelstil. Urvalet rangordnar inte kort efter styrka.

Spelaren kan välja slump eller sju fasta temalekar före matchstart och vid omstart. Temalekarnas separata definitioner ligger i `shared/game/decks.ts`. Boten får normalt en annan spelstil. Seedad blandning gör fel reproducerbara. Öppningen innehåller en enmanavarelse, ytterligare en billig varelse och en billig besvärjelse. Det är avsiktlig öppningshjälp, inte helt fri blandning. Startturens vanliga kortdragning ger spelaren fem kort; boten börjar med fyra.

Kortbiblioteket kan öppnas från startsidan eller under matchen utan återställning. Sökning och filter kan kombineras. Detaljvyn visar samtliga faktiska effekter, förmågor, roll och synergier. Boten väntar medan biblioteket är öppet.

## Forge

Serverinstruktionerna prioriterar **avsikt, identitet, handling och konsekvens**. Modellen tolkar hela beskrivningens mål, villkor, ordning och ton semantiskt och komponerar stödda effekter. Det finns inga motivspecifika promptundantag, exempelrecept eller lokala listor som kopplar ord i beskrivningen till effekter. Riktig AI väljer fritt bland tillåtna kombinationer utan katalog- eller kortmallval. Strukturerad output innehåller ett strikt validerat kort och högst tre förklaringar av anpassningar.

Balansmotorn minskar i första hand grundstats för att behålla effekterna. Namn, beskrivning och visuell identitet skrivs inte om av balanseringen. Raseri får minst två grundhälsa så att förmågan kan utlösas. Styrka och förmågor kan fortfarande begränsas inom tio mana; justeringar redovisas. **Kortets faktiska effekt**, typ, mana och attack/hälsa visas utanför kortets begränsade textruta.

AI:s namn föreslås i ett redigerbart fält. Gemensam klient-/servervalidering tillåter 1–48 tecken med bokstäver, siffror, blanksteg och enkla skiljetecken; markup, kontrolltecken och osynliga riktningsmarkörer nekas. Namnbytet påverkar inga effekter och kräver inget nytt AI-anrop. Det slutliga namnet följer kortet i hand, strid och gravhög. Någon beständig samling av smidda kort finns inte ännu.

Generering skapar först en **signerad förhandsvisning**, inte ett kort i handen. `/api/forge/confirm` verifierar inloggning, CSRF, ursprung, requeststorlek och namnet samt kvittots signatur, match, session och giltighetstid (30 minuter). Endast namnet får ändras. Kvittot innehåller det servervaliderade kortet och fungerar mellan Vercel-instanser utan lokal lagring. Signeringen använder befintliga `MURGIK_SESSION_SECRET`; inga nya miljövariabler behövs. Bekräftelsen lägger kortet i handen och förbrukar en av matchens tre laddningar. Genereringsförsök och publika kvoter räknas redan när förhandsvisningen skapas; att ändra namnet eller bekräfta räknar inget ytterligare försök. Stängning bevarar utkastet. Ändra idén återgår till beskrivningen; ett nytt smide gör ett nytt försök.

Två avgränsade stöd har lagts till i den befintliga motorn: **Raseri** (`enrage`) ger permanent +1 attack när varelsen överlever ett skadeevent, högst 10; Sköld och dödlig skada utlöser det inte. Samtidiga stridsträffar använder stats före ökningen. **Varelseläkning på alla egna varelser** använder befintlig `healCreature` med `allAllies` och är en engångseffekt. Övriga effekter kombineras som tidigare: skada, områdesskada, hjälte-/varelseläkning, kortdragning, åkallan, förstärkning, sköld, förgör skadad varelse, bedövning och tillfällig mana. Hast, Flygande, Vakt och Livsstöld är oförändrade. Effekterna sker i ordning när kortet spelas. Livsbetalning kan därför döda hjälten innan senare effekter utförs. Förberedelserundan gäller även smidda kort.

Återuppståndelse, gravhögseffekter, återkommande tureffekter, dödstriggers, varelseoffer, skada över tid, kvarliggande områdeseffekter, osynlighet och extraturer stöds inte. Modellens semantiska tolkning ska redovisa ändrade mål, villkor, tidpunkter och beteenden i `adaptations`; de visas i förhandsvisningen. Balansmotorns ändringar läggs till separat. Regeltexten byggs alltid av det balanserade kortets faktiska DSL, inte av modellens fria beskrivning.

Demoläget visar ett fast, neutralt övningskort och säger uttryckligen att beskrivningen inte tolkas. Det kräver varken AI-nyckel eller nätverksanrop. Det fungerar som övning för förhandsvisning, namnbyte, bekräftelse och spelbarhet; det låtsas inte ersätta semantisk AI-tolkning.

Baskortens tidigare illustrationer är explicit kopplade till stabila samlings-ID:n i `shared/game/base-art.ts`. Smidda kort använder endast en generell bild för sin visuella palett. Namn, artPrompt och ämnesord väljer aldrig motiv. Den tidigare motivspecifika bilden och dess CSS-effekt är borttagna. Ingen ny bildgenerering eller extern bildhämtning görs.

Autentisering, Forge Charges, nyckelhantering, Redis, Turnstile och serverstyrda kvoter är bevarade, liksom samtliga 80 baskort, lekar, förberedelserunda, ljud och animationer.

## Verifiering och begränsningar

- Alla 80 kort valideras mot Zod, har unika spelmässiga definitioner och spelas med giltiga mål i motorn.
- 400 slumpade lekar kontrolleras för kopiegräns, manakurva, variation, teman och öppningshänder.
- 147 kompletta matcher täcker alla 49 par av spelstilar med tre seeds. Samtliga avslutas utan ogiltiga botdrag eller brutna motorinvarianter.
- Forge testas med simulerade API-svar för generella beteenden: kombinerad skada/kontroll, överlevnadsreaktion, gruppåterhämtning, ordnad resursbetalning och kombinerat beskydd. Identiteten varieras utan att ändra mekaniken. Kortens faktiska beteende spelas i motorn.
- Befintliga säkerhets-, kvot-, autentiserings-, ljud- och spelmotortester ingår fortsatt.

Kontroller för den generaliserade Forge-versionen: 123 tester, TypeScript-kontrollen och Vercel-produktionsbygget passerar. Generella tester verifierar bevarad identitet, korrekt effektordning, sammansättning, balansering och spelbarhet utan särskilda motiv eller kortnamn. HTTP-tester verifierar namnbyte utan ytterligare AI-anrop, autentisering, CSRF, ursprung, storleksgräns och avvisning av manipulerade utkast. Bildtesterna verifierar samtliga baskorts bildkopplingar och att smidda korts namn eller beskrivning inte styr bildvalet. Kvot- och regressionstesterna ingår fortsatt.

Webbläsarkontrollen efter städningen laddar samtliga 80 baskort och jämför deras bildadresser med en ögonblicksbild från före ändringen. Alla behåller sina illustrationer. Demolägets tydliga märkning, namnredigering, mobilvy och signerad bekräftelse fungerar utan JavaScript-fel eller externa anrop. Den borttagna motivbilden finns inte i produktionsbygget.

Förhandsvisningens tidigare webbläsarkontroller omfattade giltigt/ogiltigt namn, direkt namnuppdatering, stängning/återöppning, serverbekräftelse, exakt ett nytt handkort och exakt en förbrukad laddning. Namnbyte och bekräftelse gav inget extra AI-anrop.

Tidigare layoutkontroller har laddat alla 80 kortillustrationer; filter och kortdetaljer är verifierade på desktop och mobil. Startsidan ryms inom 1366×768, 1920×1080 och 2560×1440 utan överströmning.

En komplett match i Edge mot den lokala Vercel-funktionen testade inloggning, simulerat AI-smide, spel av det genererade kortet, tio anfallsomgångar, elva manuella blockeringar, alla nio regelkapitel och paus/återupptagning via biblioteket fram till matchens avgörande. Inga JavaScript-fel uppstod. En separat DOM-fixture med tio handkort och sex kort per slagfältsrad kontrollerar layoutens gränser; detta är inte en manipulerad spelmatch. Desktop ryms utan scroll; mobil använder befintlig vertikal scroll och interna kortlistor utan horisontell sidöverströmning.

Simuleringarna verifierar spelbarhet och frånvaro av låsningar, inte perfekt tävlingsbalans. Långsiktig balans och synergier behöver fortsatt speltestning. Riktiga modellens tolkning har inte provats med betalda API-anrop i denna iteration; mockade svar bevisar genomförandet, inte att modellen alltid tolkar varje idé rätt. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) används för det strikta serverschemat; [OpenAI Docs om promptutformning](https://developers.openai.com/api/docs/guides/prompt-engineering) ligger till grund för den explicita prioriteringen av identitet och beteende.

För lokal start och privata/publika miljövariabler, se [DEPLOY.md](../DEPLOY.md). Inga hemlighetsvärden hör hemma i dokumentation eller klientkod.
