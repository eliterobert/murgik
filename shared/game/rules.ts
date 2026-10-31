import { catalog } from './catalog'
import { demoForge } from './forge'
import { MAX_BOARD, MAX_HAND } from './types'
import type { TurnPhase } from './types'

/** Copy is deliberately tied to implemented constants and actual catalog/demo cards. */
export const phaseLabels: Record<TurnPhase, string> = { draw: 'Kortdragning', main: 'Huvudfas', combat: 'Strid', end: 'Turens slut' }
export const rulesChapters = [
  { id: 'win', title: 'Skriv din seger', icon: 'crown', kicker: '01 · MÅLET', text: 'Du är Runsmeden. Din motståndare är Veyra. Båda börjar med 20 liv. Få motståndarens liv till noll för att vinna.', tip: 'Dina varelser och besvärjelser använder samma regler som Veyras. Kreativiteten finns i vilka kort du smider.' },
  { id: 'turn', title: 'En tur, fyra ögonblick', icon: 'restart', kicker: '02 · TURER', text: 'Ni turas om. Kortdragningen sker automatiskt. Spela kort i huvudfasen, välj anfallare i strid och lämna sedan över turen.', tip: 'Spelreglerna pausar botens beslut medan du läser. Stäng guiden och fortsätt precis där du var.' },
  { id: 'mana', title: 'Varje gnista har ett pris', icon: 'mana', kicker: '03 · MANA', text: 'Din första tur ger 1 mana. Varje egen tur ökar maxmana med 1, upp till 10, och fylls på. Kortets blå kristall visar kostnaden.', tip: 'Oanvänd mana sparas inte mellan turer. Effekten Få mana kan ge tillfällig mana denna tur, högst 10.' },
  { id: 'cards', title: 'Följeslagare & förtrollningar', icon: 'spark', kicker: '04 · KORTTYPER', text: `Varelser stannar på slagfältet med attack och hälsa. Besvärjelser gör sina effekter en gång och går till gravhögen. Alla kort spelas i huvudfasen. Högst ${MAX_BOARD} varelser och ${MAX_HAND} kort i handen.`, tip: 'Varelsers inträdeseffekter sker också en gång, när kortet spelas. Extra dragna kort bränns om handen är full.' },
  { id: 'combat', title: 'Välj vad du vågar förlora', icon: 'sword', kicker: '05 · STRID', text: 'Markera redo varelser och bekräfta anfallet. Motståndaren väljer en blockerare per anfallare. Blockerade varelser skadar varandra samtidigt. Oblockerade anfall skadar hjälten.', tip: 'Skada ligger kvar mellan turer. Ingen skada spiller över från en blockerare till hjälten. Nya varelser måste vänta en egen tur om de saknar Hast.' },
  { id: 'keywords', title: 'Små ord, stora möjligheter', icon: 'shield', kicker: '06 · FÖRMÅGOR', text: 'Keywords ändrar hur en varelse strider. Klicka på en förmåga för att se vad den faktiskt gör.', tip: 'En varelse kan blockera även om den anföll under förra turen. Bedövade varelser kan däremot inte blockera.' },
  { id: 'forge', title: 'Det bästa kortet finns inte ännu', icon: 'forge', kicker: '07 · AI FORGE', text: 'Beskriv ett kort under din huvudfas. AI:n föreslår namn, stats och implementerade effekter. Servern validerar och balanserar kortet innan det hamnar i handen.', tip: 'Demoläget använder lokala recept och inga API-anrop. Riktig AI kräver serverkonfiguration och ledig AI-kvot. Korten använder Murgiks befintliga illustrationer.' },
  { id: 'limits', title: 'Tre chanser att ändra ödet', icon: 'mana', kicker: '08 · LADDNINGAR', text: 'Du har 3 smidesladdningar per match. Smidet kostar 1 laddning men ingen mana. Kortet kostar däremot mana att spela. Ett misslyckat smide förbrukar ingen laddning.', tip: 'Smidda kort har högst 10 mana, attack och hälsa, högst 3 effekter och 2 keywords. Motorn tillåter inga nya regler eller oändliga resurser. Tom lek ger ökande utmattningsskada: 1, 2, 3…' },
  { id: 'example', title: 'Från tanke till taktiskt drag', icon: 'eye', kicker: '09 · EXEMPEL', text: '”En snabb liten glödvarg med hast.” Det här riktiga demoreceptet skapar Gnistlöpare. Kortet kostar 2 mana, har 1 attack och 1 hälsa och kan attackera samma tur.', tip: 'Det här exemplet kommer från samma generator och balansering som används i spelet. En riktig AI kan skapa andra balanserade varianter av din idé.' }
] as const
export const guideCards = { creature: catalog[1]!, spell: catalog[2]!, forged: demoForge('En snabb liten glödvarg med hast.').card }
export const phaseDescriptions: Record<TurnPhase, string> = {
  draw: 'Maxmana ökar, manan fylls och du drar ett kort. Redo varelser återhämtar sig. Den här fasen går automatiskt vidare.',
  main: 'Spela varelser och besvärjelser. Välj giltiga markerade mål för riktade effekter. Här kan du också använda smedjan.',
  combat: 'Välj vilka redo varelser som anfaller. Försvararen tilldelar blockerare och bekräftar striden. Du kan också avstå från anfall.',
  end: 'Striden är avslutad. Klicka Avsluta tur för att lämna över till motståndaren.'
}
