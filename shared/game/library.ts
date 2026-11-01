import { catalog } from './catalog'
import type { CardDraft } from './types'
export const playstyles = { aggro:'Aggressiv', defense:'Defensiv', control:'Kontroll', healing:'Läkning', sacrifice:'Blodspakter', empower:'Förstärkning', combo:'Kombinationer' } as const
export type Playstyle = keyof typeof playstyles
export interface BaseCardDefinition { id: string; card: CardDraft; styles: Playstyle[]; role: string; synergy: string }
// Stable collection IDs are separate from mutable display names and match-instance IDs.
const entries: [string,string,Playstyle[],string,string][] = [
  ['glodvarg','Glödvarg',['aggro'],'Tidig varelse','Billigt tryck som förstärks av Krigssång.'],
  ['mossvaktare','Mossväktare',['defense','healing'],'Tidig vakt','Hög hälsa ger tid åt läkande kort.'],
  ['stjarngnista','Stjärngnista',['aggro','control'],'Flexibel skada','Välj en fiendevarelse eller avsluta motståndarens sista liv.'],
  ['nattvinge','Nattvinge',['aggro','combo'],'Flygande hot','Förstärkningar gör det svårt att stoppa dess anfall.'],
  ['livskalla','Livskälla',['healing','sacrifice'],'Hjälteläkning','Återvinn liv efter en blodspakt.'],
  ['stormlopare','Stormlöpare',['aggro','combo'],'Omedelbart anfall','Hast låter dig utnyttja en öppning direkt.'],
  ['askregn','Askregn',['control'],'Områdesskada','Städar bort små varelser innan din här anfaller.'],
  ['skymningsjagare','Skymningsjägare',['healing','sacrifice'],'Livsstöld','Högre attack ger mer läkning i strid.'],
  ['frostkoloss','Frostkoloss',['defense','control'],'Stor vakt','Skydda kolossen med Sköld så att den kan blockera igen.'],
  ['runinsikt','Runinsikt',['combo'],'Kortfördel','Fyll handen inför en tur med tillfällig mana.'],
  ['askdrake','Askdrake',['aggro','control'],'Flygande avslutare','Inträdesskadan öppnar för flygande anfall nästa tur.'],
  ['frostgrepp','Frostgrepp',['control'],'Tempo','Hindrar en blockerare och ger en anfallsmöjlighet.'],
  ['gryningsskold','Gryningssköld',['defense','empower'],'Skydda hela hären','Särskilt bra med flera små glödandar.'],
  ['skuggans-dom','Skuggans dom',['control'],'Avsluta skadad varelse','Fungerar efter strid eller en tidigare skadebesvärjelse.'],
  ['gnistjagare','Gnistjägare',['aggro'],'Offensiv öppning','Hög tidig attack; Sköld kompenserar för låg hälsa.'],
  ['rotling','Rotling',['defense','empower'],'Seg liten varelse','En tålig mottagare för Växkraft.'],
  ['gryningsnovis','Gryningsnovis',['healing','sacrifice'],'Läkande öppning','Återställer liv och lämnar en varelse för förstärkningar.'],
  ['rimvaktare','Rimväktare',['defense','control'],'Passivt försvar','Saknar attack tills en förstärkning ger den kraft.'],
  ['runlarling','Runlärling',['combo'],'Varelse och kortdragning','Bygger slagfält utan att tömma handen.'],
  ['vindfalk','Vindfalk',['aggro','empower'],'Liten flygare','Bär riktade förstärkningar över markförsvaret.'],
  ['blodsvuren-spejare','Blodsvuren spejare',['aggro','sacrifice'],'Billig blodspakt','Betala ett liv för ett effektivt tidigt hot.'],
  ['skoldbarare','Sköldbärare',['defense'],'Vakt med Sköld','Köp tid mot en stor anfallare.'],
  ['askryttare','Askryttare',['aggro'],'Snabb anfallare','Utnyttjar en bedövad fiende direkt.'],
  ['kallans-adept','Källans adept',['healing','defense'],'Varelseläkare','Läk en skadad vakt innan nästa strid.'],
  ['glodandarnas-kallare','Glödandarnas kallare',['empower','combo'],'Bred här','Ger två glödandar om slagfältet har plats.'],
  ['rimsejdare','Rimsejdare',['control'],'Varelse med bedövning','Kräver en fiendevarelse som mål.'],
  ['solsvuren-riddare','Solsvuren riddare',['defense','healing'],'Försvar och liv','En vakt som också lindrar trycket på hjälten.'],
  ['skuggmunk','Skuggmunk',['healing','sacrifice'],'Tålig livsstöld','Förstärk attacken för att återvinna mer liv.'],
  ['vildmarkens-fanbarare','Vildmarkens fanbärare',['empower'],'Riktad förstärkning','Stärk en flygare eller läk genom extra maxhälsa.'],
  ['askspjutare','Åskspjutare',['aggro','control'],'Varelse med skada','Lämnar ett sår som Skuggans dom kan utnyttja.'],
  ['blodets-bibliotekarie','Blodets bibliotekarie',['sacrifice','combo'],'Liv mot kort','Kombinera med hjälteläkning för en längre match.'],
  ['frostuggla','Frostuggla',['defense','control'],'Skyddad flygare','Kan blockera flygande och absorbera första träffen.'],
  ['granitvaktare','Granitväktare',['defense','healing'],'Uthållig vakt','Behåller skada mellan turer och gynnas av läkning.'],
  ['glodklanens-hovding','Glödklanens hövding',['aggro','empower'],'Hela härens attack','Spela efter att du byggt flera små varelser.'],
  ['vindens-budbarare','Vindens budbärare',['combo','aggro'],'Flygare och kort','Ett rörligt hot som hittar nästa drag.'],
  ['manens-helare','Månens helare',['healing','sacrifice'],'Läkande förstärkning','Återställ liv efter flera blodspakter.'],
  ['blodspaktsdemon','Blodspaktsdemon',['sacrifice','aggro'],'Riskfylld flygare','Spela först när du har liv att betala.'],
  ['gryningsmarskalk','Gryningsmarskalk',['defense','empower'],'Vakt och beskydd','Skydda en viktig egen varelse vid inträdet.'],
  ['vinterhaxa','Vinterhäxa',['control'],'Skada och bedövning','Båda effekterna träffar samma fiendevarelse.'],
  ['runornas-arkivarie','Runornas arkivarie',['combo'],'Stor kortfördel','Se till att det finns plats i handen för två kort.'],
  ['urskogens-moder','Urskogens moder',['healing','defense'],'Återhämtning och försvar','Tar över försvaret när små vakter faller.'],
  ['asksmedens-mastare','Asksmedens mästare',['empower','combo'],'Åkalla och förstärk','Skapar glödandar före förstärkningen, om det finns plats.'],
  ['skymningens-greve','Skymningens greve',['healing','sacrifice'],'Avslutare med livsstöld','Sköld håller greven vid liv genom svåra strider.'],
  ['stormdrake','Stormdrake',['aggro','combo'],'Flygande avslutare','Riktad inträdesskada kan röja en blockerare.'],
  ['gryningens-koloss','Gryningens koloss',['defense'],'Sista försvarslinjen','Vakt och Sköld stoppar stora anfall.'],
  ['rimkront-drake','Rimkrönt drake',['control'],'Flygare med tempo','Bedöva en fiende innan nästa flygande anfall.'],
  ['blodvingad-furste','Blodvingad furste',['sacrifice','healing'],'Stor risk och återhämtning','Betala liv vid inträdet och vinn tillbaka det i strid.'],
  ['solens-fenix','Solens fenix',['aggro','healing'],'Snabb avslutare','Flygande och Hast ger omedelbart tryck; återuppstår inte.'],
  ['rotornas-urjatte','Rotornas urjätte',['defense','empower'],'Förstärk hela hären','Extra hälsa ökar även varelsernas nuvarande hälsa.'],
  ['askhjarta','Askhjärta',['aggro'],'Sista trycket','Hjälteskada vid inträdet följs av ett möjligt Hast-anfall.'],
  ['skogsbunden-riddare','Skogsbunden riddare',['healing','defense'],'Läkande vakt','Räddar en skadad kamrat och håller linjen.'],
  ['skymningsalkemist','Skymningsalkemist',['sacrifice','combo'],'Liv mot tempo','Den tillfälliga manan måste användas denna tur.'],
  ['runbunden-beskyddare','Runbunden beskyddare',['defense','combo'],'Skydd och kort','Sköld på sig själv och ett nytt kort vid inträdet.'],
  ['stormens-smed','Stormens smed',['combo'],'Varelse som länkar drag','Mana och kort kan låta dig fortsätta huvudfasen.'],
  ['flamkast','Flamkast',['aggro','control'],'Varelseskada','Kan inte riktas mot hjälten.'],
  ['skogsviskning','Skogsviskning',['healing','combo'],'Läkning utan kortförlust','Ett litet steg mot både nytt liv och nästa kort.'],
  ['tillfallig-runkraft','Tillfällig runkraft',['combo'],'Manaburst','Använd under en tur där extra mana låser upp nästa kort.'],
  ['rotskold','Rotsköld',['defense','empower'],'Billigt beskydd','Skydda en stor varelse eller en bräcklig flygare.'],
  ['blod-for-kunskap','Blod för kunskap',['sacrifice','combo'],'Kort för eget liv','Priset betalas först; kan besegra dig vid för lågt liv.'],
  ['hamndens-gnista','Hämndens gnista',['control'],'Skada och tempo','Ett sår kan följas av Skuggans dom senare.'],
  ['vaxkraft','Växkraft',['empower','healing'],'Varaktig förstärkning','Extra maxhälsa fyller på lika mycket nuvarande hälsa.'],
  ['glodens-folje','Glödens följe',['empower','combo'],'Två små varelser','Spela före Krigssång eller Vildmarkens välsignelse.'],
  ['lakande-sigill','Läkande sigill',['healing','defense'],'Läk och skydda','Båda effekterna riktas mot samma egen varelse.'],
  ['skuggdranage','Skuggdränage',['sacrifice','healing'],'Skada och liv','Skada en fiende och läk din hjälte.'],
  ['frostring','Frostring',['control','combo'],'Bred skada och kort','Skapar skadade mål utan att minska handen.'],
  ['stormens-minne','Stormens minne',['combo'],'Bygg nästa kombination','Dra två kort och få tillbaka en mana denna tur.'],
  ['blodsoffer','Blodsoffer',['sacrifice','empower'],'Liv blir en här','Glödandar skapas före förstärkningen; inga varelser offras.'],
  ['krigssang','Krigssång',['aggro','empower'],'Bred attackökning','Blir starkare ju fler varelser du redan har.'],
  ['runans-dom','Runans dom',['control'],'Tung riktad skada','Tar hand om ett stort hot, men träffar inte hjälten.'],
  ['gryningens-vila','Gryningens vila',['healing','defense'],'Återhämtning och skydd','Behöver en egen varelse för Sköld-effekten.'],
  ['vingbrytare','Vingbrytare',['control'],'Svar på flygare','Skadar bara flygande fiendevarelser och drar ett kort.'],
  ['vildmarkens-valsignelse','Vildmarkens välsignelse',['empower'],'Bred styrkeökning','Glödandar blir ett verkligt stridshot.'],
  ['askans-aterklang','Askans återklang',['aggro','control'],'Skada på två fronter','Skadar fiendens varelser och därefter hjälten.'],
  ['skuggpakt','Skuggpakt',['sacrifice','combo'],'Liv, kort och mana','Länkar flera kort när du har liv att avvara.'],
  ['solens-lofte','Solens löfte',['defense','healing'],'Skydda och återhämta','Hjälper både en bred här och en pressad hjälte.'],
  ['urskogens-uppvaknande','Urskogens uppvaknande',['empower','combo'],'Åkalla före förstärkning','Nya glödandar får också +1/+1.'],
  ['vinterns-tystnad','Vinterns tystnad',['control','combo'],'Tre effekter på ett kort','Skada och bedövning väljer samma mål; dra sedan ett kort.'],
  ['stjarnfall','Stjärnfall',['control','healing'],'Vänd ett pressat läge','Skadar fiendehären och läker din hjälte.'],
  ['stormens-crescendo','Stormens crescendo',['combo'],'Resurser och avslut','Två kort, tillfällig mana och skada på motståndaren.'],
  ['nattens-sista-lofte','Nattens sista löfte',['sacrifice'],'Riskfyllt avslut','Du måste överleva den första självskadan; effekterna sker i ordning.']
]
const byName = new Map(catalog.map(card => [card.name, card]))
export const baseCards: BaseCardDefinition[] = entries.map(([id,name,styles,role,synergy]) => {
  const card = byName.get(name)
  if (!card) throw new Error(`Unknown base card: ${id}`)
  return { id:`base:${id}`, card, styles, role, synergy }
})
export const baseCardById = new Map(baseCards.map(entry => [entry.id, entry]))
export interface LibraryFilters { search: string; type: 'all' | CardDraft['type']; mana: 'all'|'1-2'|'3-4'|'5+'|`${number}`; style: 'all' | Playstyle }
export function filterLibrary(filters: LibraryFilters) {
  const query = filters.search.trim().toLocaleLowerCase('sv')
  return baseCards.filter(({card,styles}) => (!query || card.name.toLocaleLowerCase('sv').includes(query)) && (filters.type==='all'||card.type===filters.type) && (filters.style==='all'||styles.includes(filters.style)) && (filters.mana==='all'||(filters.mana==='1-2'?card.cost<=2:filters.mana==='3-4'?card.cost>=3&&card.cost<=4:filters.mana==='5+'?card.cost>=5:card.cost===Number(filters.mana))))
}
