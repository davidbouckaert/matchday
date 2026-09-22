# Clubeigenaar ⚽

Een turn-based simulatiegame in de browser. Jij bent de **eigenaar** van een kleine Belgische voetbalclub die net naar 3de nationale is gepromoveerd. Je bent geen trainer en speelt zelf geen wedstrijden: jij beslist over het geld. Denk aan Coffee Inc, maar dan met een voetbalclub.

## Starten

```bash
npm install
npm run dev        # speel op http://localhost:5173
npm test           # unit tests (Mocha + Chai)
npm run typecheck  # TypeScript-controle
npm run balance    # simuleert passief spel voor elke club/investeerder
npm run build      # productieversie in dist/
```

Sneltoets in het spel: **spatie** = volgende week.

## Hoe de code in elkaar zit

```
src/
  engine/          ← de simulatie. Geen DOM, deterministisch, volledig testbaar
    types.ts       ← alle datatypes; GameState = het volledige spel als één JSON-object
    turn.ts        ← advanceWeek(): één beurt verwerken (het hart van het spel)
    actions.ts     ← alles wat de speler kan doen (kopen, verkopen, lenen, bouwen, ...)
    newGame.ts     ← nieuw spel opzetten (club, investeerder, avatar)
    players.ts     ← kwaliteit, marktwaarde, opstelling, teamsterkte, ontwikkeling
    league.ts      ← competitie, kalender, wedstrijdsimulatie (Poisson)
    finance.ts     ← toeschouwers, kantine, vaste kosten
    loans.ts       ← bankleningen (annuïteiten)
    sponsors.ts    ← sponsorcontracten, werving, tevredenheid
    merch.ts       ← fanshop: assortiment, prijzen en wekelijkse verkoop
    canteen.ts     ← kantineprijzen en horecaconcessies
    popularity.ts  ← populariteit: één vermenigvuldiger op alle inkomsten
    stats.ts       ← cijfers per seizoen (tickets, consumpties, artikelen, leden)
    market.ts      ← volatiele transfermarkt, transferlijst, staffmarkt
    events.ts      ← meevallers, tegenslagen, biedingen, blessures, faillissement
    discipline.ts  ← gele en rode kaarten, schorsingen, tuchtboetes
    delegation.ts  ← taken die staff van je overneemt en automatisch uitvoert
    strategy.ts    ← training, mentaliteit, spelplannen en hun sterkte/zwakte-tabel, scouting
    factors.ts     ← vermenigvuldigers als lijsten (sponsors, toeschouwers, kantine, vermoeidheid, blessures)
    modifiers.ts   ← overzicht van alle invloeden voor de tab Invloeden
    ratings.ts     ← clubrating: sportief, financieel, gemeenschap
    calendar.ts    ← weken, transferperiodes, vaste momenten in het jaar
    rng.ts         ← voorspelbare toevalsgenerator (zelfde seed = zelfde spel)
    data/          ← spelwaarden: reeksen, clubs, investeerders, namen, catalogus
  storage/save.ts  ← IndexedDB + export/import (interface klaar voor online opslag)
  ui/              ← schermen als HTML-templates, geen framework
    screens/report.ts   ← animatie en weekrapport na elke gespeelde week
    screens/calendar.ts ← seizoenskalender (Club › Kalender)
    screens/merch.ts    ← fanshop (Club › Fanshop)
    screens/horeca.ts   ← kantine en concessies (Club › Horeca)
    screens/numbers.ts  ← cijfers per seizoen (Club › Cijfers)
    screens/contracts.ts← contracten en loononderhandeling (Ploeg › Contracten)
  version.ts       ← versienummer en changelog (onderaan elke pagina)
test/              ← Mocha + Chai
scripts/balance.ts ← balanstest over meerdere seizoenen
```

**Ontwerpregel: breed maar ondiep.** Elk systeem heeft maar een handvol knoppen, en elke beslissing heeft een zichtbaar effect. Alle cijfers zitten in `src/engine/data/` en zijn bedoeld om bij te stellen.

**Werkwijze:** `advanceWeek(state)` geeft een nieuwe toestand terug zonder de oude te veranderen. Acties passen de toestand van de huidige week aan. Omdat het toeval uit een seed komt, kun je in tests exact dezelfde seizoenen opnieuw laten lopen.

## Wat zit er in laag 1

- **Start:** rudimentaire avatar met achtergrond (ex-speler, ondernemer, lokale figuur), keuze uit 2 clubs, keuze uit 3 investeerders
- **Kalender:** 1 beurt = 1 week, 30 speeldagen, winterstop, transferperiodes (zomer en januari), seizoenseinde met promotie en degradatie
- **Inkomsten:** tickets, kantine en kraampjes, sponsors (borden, shirt, hoofdsponsor, stadionnaam), tv-rechten (hogere reeksen), lidgelden jeugd, subsidies, verhuur kunstgras, evenementen, transfers
- **Kosten:** lonen spelers en staff, onderhoud en energie (meer in de winter), jeugdwerking, bond en verzekering, scheidsrechter en busvervoer, afbetalingen, opleidingen
- **Spelers:** techniek, fysiek, potentieel, karakter, moraal, vorm, blessures, spelers die goed samenwerken, contracten, ontwikkeling en veroudering, eigen jeugd die doorstroomt
- **Markt:** altijd schommelende marktindex plus een wekelijks bod per speler. Profclubs doen biedingen op talenten
- **Staff:** hoofdtrainer (met EUFA-diploma's via opleiding), kinesist, afgevaardigde, scout, kantineverantwoordelijke, commercieel medewerker, jeugdcoördinator
- **Infrastructuur:** tribune, kantine, kunstgras, verlichting (bouwtijd, één project tegelijk)
- **Bank:** 3 soorten leningen, rente afhankelijk van je schuldgraad, noodlening, vervroegd aflossen
- **Licentie-audit** van Voetbal Vlaanderland (week 38): diploma, afgevaardigde, verlichting, capaciteit
- **Meevallers en tegenslagen:** storm, inbraak, influencer, erfenis, griepgolf, vrijwilligers die stoppen, ...
- **Faillissement:** 8 weken onder nul = game over, met escalerende waarschuwingen
- **Opslaan:** automatisch in IndexedDB + back-up als JSON-bestand

## Laag 2

- **Ploegsterkte per linie** (doel, verdediging, middenveld, aanval) en aparte aanvals- en verdedigingskracht
- **Opstelling en tactiek:** 5 formaties, 5 speelstijlen, zelf basisspelers vastzetten of alles automatisch
- **Nieuwe staff:** assistent-trainer (T2), conditietrainer (T3), keepertrainer, data-analist; bijscholing voor iedereen
- **Delegeren:** klik een staflid aan en vink taken aan (opstelling, contracten, transfers, sponsorwerving, ticketprijs, evenementen, vrijwilligers)
- **Sponsors:** eigen tab met bedrijven om te benaderen, netwerkavond, sponsorbureau, tevredenheid, extra bijdrage vragen, verlengen, stopzetten
- **Evenementen:** kost, prognose van de opbrengst, vereist aantal vrijwilligers, uitbetaling na enkele weken
- **Vrijwilligers werven:** oproep, infoavond, vrijwilligersfeest
- **Jeugdopleidingscentrum** (3 niveaus) als infrastructuur
- **Sorteerbare tabellen** (klik op een kolomkop) en een uitgebreide kopbalk
- Oude opslagbestanden (versie 1) worden automatisch omgezet

## Laag 3

- **Tab Strategie:** trainingen per week (2-5), trainingsfocus (conditie, techniek, tactiek, spelhervattingen, herstel), formatie, mentaliteit en spelplan
- **Spelplannen met sterktes en zwaktes** (zoals Pokémon-types): balbezit, lange bal, vleugelspel, counter en pressing. Elk plan wint van twee andere en verliest van twee andere. Tegenstanders hebben een eigen spelplan; een data-analist toont wat ze echt spelen
- **Plan past bij je spelers:** elk spelplan vraagt ander spelersmateriaal (techniek, fysiek, formatie)
- **Delegeren aan de T1:** alle keuzes op Strategie worden uitgegrijsd met uitleg bij het aanwijzen; de trainer bereidt elke wedstrijd voor
- **Lidgeld jeugd zelf bepalen:** prijsgevoelig aantal inschrijvingen (elk seizoen in week 10), met prognose op korte en lange termijn

## Laag 4

- **Vermoeidheid** per speler: stijgt door trainingen en wedstrijden (pressing extra), daalt door rust, conditietrainer, kinesist en focus herstel. Werkt als vermenigvuldiger op aanval en verdediging en verhoogt het blessurerisico; de computer laat uitgeputte spelers rusten
- **Wedstrijdberekening:** aanval = (spelerskwaliteit + bonussen) × vermoeidheid + tactiek + voordeel/nadeel spelplan, tegen de verdediging van de tegenstander (en omgekeerd), met Poisson voor de doelpunten
- **Scoutingrapport:** stand, vorm (laatste 5), aanval/verdediging, gespeelde spelplannen en tips voor de volgende tegenstander
- **Tab Opleiding:** diploma's en bijscholing voor alle staff
- **Operationeel per week** in Financiën: grafiek en tabel per categorie, zonder leningen, investeringen en transfers
- **Tab Invloeden:** alle vermenigvuldigers en bonussen, berekend met dezelfde functies als het spel (`src/engine/factors.ts`, `src/engine/modifiers.ts`)

## Laag 5

- **Kaarten en schorsingen** voor alle ploegen: elke 5de gele kaart = 1 wedstrijd, 2x geel = rood (1 wedstrijd), direct rood = 1 tot 3 wedstrijden, tuchtboetes, overzicht "Tuchtzaken" bij Competitie. Pressing, derby's en lastpakken geven meer kaarten; een mentale coach minder
- **Forfait:** minder dan 11 beschikbare spelers (geblesseerd of geschorst) = 0-5 verlies, €1.000 boete, minder sfeer en tevreden sponsors
- **Oververmoeidheid:** hoger blessurerisico in wedstrijden, boven 50 ook op training
- **Herstel:** natuurlijk herstel (40% per week) plus extra herstel door kinesist (preventief én herstellend), verzorger, voedingsdeskundige (ook minder opbouw), conditietrainer, recuperatieruimte en focus herstel
- **Nieuwe staff:** voedingsdeskundige, verzorger/masseur, mentale coach; nieuwe infrastructuur: recuperatieruimte
- **Evenementen:** maximaal één per week en een maximum per seizoen per evenement

## Laag 6

- **Kopbalk:** twee rijen met meer ruimte: club, datum van vandaag (bv. woensdag 2 september 2026), fase van het seizoen (competitie start over X weken, speeldag, winterstop) en de knop; daaronder teamsterkte, klassement (of de startdatum van de competitie), hoofdsponsor, vorige week en saldo
- **Navigatie in groepen:** Overzicht, Ploeg (Selectie, Strategie, Transfers), Staff (Staff, Opleiding), Club (Kalender, Financiën, Sponsors, Evenementen, Infrastructuur, Clubinfo), Competitie, Invloeden, Opslaan
- **Week spelen:** korte animatie (bal naar doel), daarna een weekrapport met wedstrijd, financiën, nieuws en wat nog in afwachting is (sponsorvoorstellen, biedingen, uitbetalingen, bouwwerken, opleidingen, blessures, schorsingen). Spatie = volgende week of rapport sluiten, Esc = sluiten. Animatie uitzetten kan bij Opslaan
- **Kalender:** alle 52 weken per maand met wedstrijden (en uitslagen), transferperiodes, vaste momenten, jouw evenementen, uitbetalingen en aflopende contracten
- **Transfers:** spelers meteen verkopen, te koop zetten met een vraagprijs (clubs doen biedingen tijdens de transferperiode), uitlenen (andere club betaalt een deel van het loon) en jonge spelers huren van profclubs (tot het einde van het seizoen)
- **Spelersevolutie om de 4 weken:** verandering = leeftijd en trainer + speeltijd + trainingen. Speeltijd = aandeel basisplaatsen in die 4 weken (meer dan 40% is winst, jongeren winnen het meest); trainingen boven 3 per week helpen, eronder kost het. Kolommen Trend en Basis in de selectie

## Laag 7

- **Leeftijdscurve van de evolutie:** groei loopt vloeiend af met de leeftijd in plaats van in blokken. 17 jaar = volle groei (factor 1,00), 20 jaar 0,79, 24 jaar 0,50, 28 jaar 0,21, en **vanaf 31 jaar groeit niemand nog** (factor 0). De achteruitgang begint rond 27 en versnelt daarna. Speeltijd weegt ook zwaarder bij jonge spelers (0,40 op 17 jaar, 0,14 vanaf 31). Hoe dichter een speler bij zijn potentieel zit, hoe trager het nog gaat
- **Fanshop (Club › Fanshop):**
  - **Opstart:** €3.500 voor rekken, kassasysteem en webshop. Sjaals liggen er meteen in
  - **Assortiment:** sjaal, wedstrijdshirt, T-shirt, hoodie, pet, mok en vlag. Elk artikel heeft een eenmalige kost (drukwerk en eerste voorraad), een inkoopprijs, een richtprijs en een populariteit. Je kunt artikelen ook weer uit de shop halen; de restvoorraad verkoop je dan met verlies
  - **Prijszetting:** jij zet de prijs per artikel. Verkoop = supporters × populariteit × (sfeer, reputatie, klassement, wedstrijddag, kantineniveau, winter, staff) × prijsgevoeligheid (richtprijs / jouw prijs)^1,5. Het scherm toont de ideale prijs, je marge en de verwachte verkoop
  - **Kosten:** €70 per week werking plus €10 per artikel in het assortiment, en de inkoop van wat je verkoopt
  - **Staff:** een merchandisingverantwoordelijke (€140/week) verkoopt meer, koopt goedkoper in en drukt de werkingskosten. Je kunt de taak "Fanshop en merchandising" aan hem, de commercieel medewerker of de kantineverantwoordelijke delegeren; dan zet hij zelf de prijzen en breidt hij het assortiment uit
  - Een thuiswedstrijd is goed voor ongeveer 3,4 keer de normale verkoop. Een goed draaiende shop levert ruwweg €10.000 tot €20.000 per seizoen op

## Laag 8

- **Kern beschermen:** je kunt je laatste doelman niet verkopen of uitlenen, elke linie houdt minstens één reserve en je zakt nooit onder 16 spelers. Ook de scout houdt zich daaraan. In Transfers zie je met een ★ wie tot je kern hoort en met een slotje wie deze week niet weg mag
- **Contracten (Ploeg › Contracten):** aflopende contracten op één plek, met wat de speler vraagt, jouw loonvoorstel, de kans op een akkoord en het effect op zijn moraal
- **Spelersrollen:** kapitein, strafschop- en hoekschopnemer, elk met een effect op de ploeg
- **Delegeren per deeltaak:** trainingen, opstelling, wedstrijdtactiek en spelersrollen staan los van elkaar, en ook transfers en de kantine kun je uitbesteden
- **Kantine en concessies (Club › Horeca):** prijs per artikel (pils, frisdrank, water, koffie, chips, soep) met inkoopprijs en marge, plus standhouders (hotdog, hamburger, frituur, pasta) waarmee je over jouw percentage onderhandelt
- **Cijfers (Club › Cijfers):** tickets, gemiddeld publiek, consumpties per artikel, porties per kraam, artikelen per soort en het aantal jeugdleden en vrijwilligers, per seizoen naast elkaar
- **Populariteit:** clubrating, klassement en recente resultaten vormen één vermenigvuldiger op toeschouwers, kantine, concessies en fanshop. Ze bepaalt ook wat mensen voor een shirt willen betalen en hoeveel jeugdspelers zich inschrijven
- **Onderhoud en energie:** kies basis, normaal of premium onderhoud (goedkoper = meer defecten en minder volk) en investeer in zonnepanelen voor 18% lagere energiekosten
- **Nieuwe infrastructuur:** wifi, toiletten en kleedkamers, parking. Een kinesist of verzorger kun je pas aanwerven met een recuperatieruimte
- **Vrijwilligers:** hun tevredenheid hangt af van sfeer, reputatie, je kantineverantwoordelijke en hoeveel evenementen je kort na elkaar plant. Ze haken af of sluiten aan, en evenementen vragen meer volk dan vroeger
- **Interface:** de menubalk blijft staan, elk invoerveld wordt meteen toegepast (geen opslaan-knop), een teller toont 11/11 speelklare spelers en blokkeert de knop "Volgende week" als je er te weinig hebt, thuis en uit staan overal met een icoon, winst en verlies krijgen een symbool, en er staan tooltips bij tevredenheid, prijzen, kaarten en klassement
- **Logboek:** elke beslissing en elk antwoord (zoals een extra sponsorbijdrage, die nu pas een week later komt) staat op de tab Overzicht
- **Klein maar fijn:** klassement als echte competitiestand met doelpunten voor, tegen en saldo; een logokeuze bij de start; sponsornamen die bij hun sector passen; twee clubs kunnen tegelijk op dezelfde speler bieden; het versienummer staat onderaan elke pagina

## Laag 9 (deze versie)

### 0.10.3

- **Nieuws rolt binnen:** de berichten onder "Nieuws en berichten" en de lijst "In afwachting" verschijnen nu regel per regel, met ongeveer 150 milliseconden tussen elke regel (samen nooit langer dan de cijfertellers, dus het blijft rond de 1,5 seconde). Hele regels tegelijk, geen letter-per-letter getik
- **Netjes bij hertekenen:** klik je in het rapport, dan begint de reeks niet opnieuw; ze loopt maar één keer per week
- **Uitzetbaar:** met de animatie uit bij Opslaan, of met "minder beweging" in je systeeminstellingen, staat alles er meteen

### 0.10.2

- **Trager en spannender:** de animatie voor het weekrapport duurt nu 3,6 seconden in plaats van 1,8. De bal rolt trager naar het doel, de voortgangsbalk loopt mee en de drie tussentitels ("De scheidsrechter fluit af", "De kassa wordt geteld", "Affluiten!") blijven elk 1,2 seconde staan; de laatste blijft staan tot het rapport opengaat. Klikken slaat de animatie nog altijd over en bij Opslaan kun je ze helemaal uitzetten
- **Rustiger tellers:** de cijferrollers in het weekrapport tellen ongeveer 20% trager op en starten post per post, zodat je ziet wat elke bron opbracht voor het saldo verschijnt
- **Premie apart geboekt:** de kampioenen- en promotiepremie stond tussen de "meevallers" en viel daardoor niet op. Ze heeft nu een eigen categorie **premies**, met de reeks in de omschrijving, en het bedrag staat ook in het nieuwsbericht
- **Overal terug te vinden:** de premie staat in de financiën van het weekrapport, als eigen vakje in het seizoensrapport, bij Club › Cijfers (opbrengst per bron) en als kolom in je clubgeschiedenis. De kalender toont in week 44 vooraf wat de titel en plaats twee in jouw reeks waard zijn
- **Bedragen (premies van sponsors, receptie en tombola — de bond betaalt in de amateurreeksen geen prijzengeld):** 1ste Provinciale €2.000 / €1.000 · 3de Nationale €4.500 / €2.500 · 2de Nationale €7.000 / €4.000 · 1ste Nationale €40.000 / €25.000 · Challenger Pro Liga €160.000 / €95.000 (kampioen / plaats 2)

### 0.10.1

- **Bugfix:** opslagbestanden die door versie 0.9.5 of 0.9.6 als versie 12 waren weggeschreven, misten de clubrecords die pas in 0.9.7 aan diezelfde migratie werden toegevoegd. Daardoor liep het spelen van een week stuk en deed de knop "Volgende week" niets
- **Vangnet:** bij het laden wordt elk bestand aangevuld met alles wat het nog niet kent, ongeacht zijn versienummer
- **Zichtbare fouten:** loopt een week toch vast, dan krijg je nu een melding met de reden in plaats van een knop die niets doet

### 0.10.0

- **Premies:** kampioen worden levert in de amateurreeksen €2.000 tot €7.000 op van sponsors en supporters (een receptie, een tombola, een premie van de hoofdsponsor); promotie via plaats twee de helft daarvan. Vanaf de Challenger Pro Liga is het echt prijzengeld: €40.000 tot ruim €150.000
- **Kosten schalen mee:** na promotie vragen spelers ongeveer 14% en staff 10% meer; na degradatie zakken die lonen met 10% en 7%. Aansluiting bij de bond en de verzekeringen stijgen met 35% per niveau, de gemeentesubsidie met 12%
- **Fanshop volgt de reeks:** de richtprijzen schalen met de normale ticketprijs van je niveau (×1 in 3de nationale, ×2,2 in de Pro Liga)
- **Geen dubbele voorstellen** meer van dezelfde sponsor na promotie

### 0.9.9

- **Wedstrijdpremies:** 30% van de spelersvergoeding hangt aan een wedstrijd. In de winterstop, de zomerstop en elke vrije week betaal je alleen het vaste deel. Staff wordt wel het hele jaar door betaald
- **Winstpremie:** een zege kost 12% extra aan de basiself; succes heeft dus ook een prijs
- **Sponsors na promotie:** hun tevredenheid stijgt met 10 (14 bij een titel) en de tevredensten bieden spontaan een hoger contract aan, berekend op het niveau van je nieuwe reeks. Een extra bijdrage vragen lukt daardoor ook makkelijker
- **Sponsors na degradatie:** tevredenheid −12, dus verlengen wordt lastiger
- Inflatie bijgesteld naar 7% per seizoen om de lagere loonlast te compenseren

### 0.9.8

- **Teller post per post:** elke regel in het weekrapport start ongeveer 150 ms na de vorige en telt in 650 ms naar zijn bedrag, met een klein accent als hij landt. Het hele overzicht staat er na ongeveer twee seconden
- **Jong talent groeit sneller:** tot 19 jaar +30% groei, tot 21 jaar +15%, en de basisgroei ging omhoog. Een jonge basisspeler wint nu ongeveer 5,9 punten per seizoen (was 4,2), een jonge invaller 2,5
- **Vermoeidheid naar leeftijd:** tot 19 jaar 78% van de belasting, tot 23 jaar 88%, 30 tot 32 jaar 112%, daarboven 122%
- **Seizoensrapport** toont het echte resultaat uit je clubgeschiedenis: kampioen, promotie, degradatie of behoud, met de naam van de reeks waarin je volgend seizoen speelt

### 0.9.7

- **De week bouwt op:** de animatie toont drie momenten (de bal rolt, tweede helft, affluiten) met een voortgangsbalk, daarna springt de uitslag eruit en lopen de bedragen op als een teller
- **Clubrecords:** recordopkomst, beste week qua inkomsten, langste reeks zonder nederlaag, meeste overwinningen op rij en het hoogste aantal supporters. Sneuvelt er een, dan krijg je een melding en een blok in het weekrapport
- **Reeksen:** vanaf drie zeges of vier wedstrijden ongeslagen staat dat onder de uitslag
- **Gemeten groei (actieve club, gedelegeerd):** seizoen 1 ongeveer €680.000 werkingsinkomsten in 3de nationale, seizoen 6 €3,8 tot €6,4 miljoen in de Pro Liga; supporters van 700 naar 14.500

### 0.9.6

- **Fanshopmarge klopt nu op het scherm:** "inkoop shop" bevatte ook de vaste werkingskosten en het drukwerk van nieuwe artikelen. Dat staat nu apart als "werking shop", en het fanshopscherm toont omzet, inkoop, werking en winst per week en per seizoen
- **Seizoenseinde:** de knop heet "Laatste speeldag" op de slotspeeldag en "Seizoen afsluiten" in week 44, met een gouden accent en uitleg in de tooltip
- **Seizoensrapport:** eindstand en promotie of degradatie, W/G/V en doelpunten, inkomsten en kosten met groei tegenover vorig seizoen, supporters, jeugdleden, consumpties, behaalde mijlpalen en wie het meest speelde

### 0.9.5

- **Geschiktheid in sterren:** bij elke taak zie je per staflid 1 tot 5 sterren (vaardigheid × hoe goed de taak bij zijn functie past × zijn werklast)
- **Mijlpalen:** elf momenten om naar toe te werken (500, 1.000 en 2.500 supporters, €250.000 en een miljoen op de rekening, promotie, uitverkocht huis, 1.000 artikelen, 300 jeugdleden, tien wedstrijden ongeslagen, €5.000 sponsorgeld per week). Elke mijlpaal geeft reputatie of sfeer, een geldbedrag dat meeschaalt met je reeks, en een gouden blok bovenaan het weekrapport
- **Jaaroverzicht** in het weekrapport van week 44: inkomsten tegenover vorig seizoen, supporters, jeugdleden, tickets en consumpties
- **Tellers:** de bedragen in het weekrapport lopen op als een casinoteller (uit te zetten bij Opslaan, samen met de animatie)
- **Thuisvoordeel:** de thuisploeg speelt met +1,6 aanval en +1 verdediging, de uitploeg met −0,6 aanval
- **Groei bouwt op zichzelf:** supporters groeien 1 tot 3% per week richting hun plafond, afhankelijk van je recente resultaten en de sfeer

### 0.9.4

- **Krediet:** een lening aanvragen doet de bank er een week over. Ze kijkt naar je kredietruimte, je kaspositie en je reputatie en kan weigeren. Een noodlening die de bank zelf aanbiedt, staat er wel meteen op
- **Terugverdientijd:** zonnepanelen kosten nu wat bij jouw complex past (ongeveer 156 weken × de wekelijkse besparing van 20%), dus altijd ongeveer drie seizoenen. De ploegbus kost €32.000 en maakt verplaatsingen 55% goedkoper, plus de bussponsor
- **Moeilijker voetbal:** staff, sfeer, vorm, training en spelersrollen wegen samen nog voor 45% door in plaats van 100%, en tegenstanders krijgen +4,5 sterkte omdat zij ook een trainer hebben. Met een topstaf win je nu ongeveer 60% van je wedstrijden in plaats van 93%
- **Aandacht met links:** elke melding op het overzicht brengt je naar het juiste scherm

### 0.9.3

- **Specialisatie bij delegeren:** elke taak heeft een vakgebied (de eerste functie in de lijst). Wie ze buiten zijn vakgebied doet, werkt op 82% of 68% van zijn niveau en beslist dus vaker verkeerd. Je ziet dat bij elke keuze staan
- **Werklast:** een staflid kan 1 tot 4 taken aan, afhankelijk van zijn vaardigheid (<40 = 1, <65 = 2, <85 = 3, daarboven 4). Elke extra taak kost hem ook een beetje scherpte
- **Hamburgermenu** rechtsboven met de handleiding en het opslaan; die twee staan niet meer als gewone tabs in de balk
- **Handleiding met FAQ:** hoe je geld verdient, waarom een week zonder wedstrijd pijn doet, hoe verlengen werkt, waarom iets op slot staat
- **Eerste stappen:** een checklist op het overzicht voor een nieuwe eigenaar, die zichzelf afvinkt en na week 20 verdwijnt
- **Kantine realistischer:** ongeveer 2 consumpties per bezoeker in plaats van 6; de kraampjes idem. De vaste kosten zijn navenant bijgesteld
- **Ploegbus** is nu een investering (€58.000, 2 weken). Ze maakt verplaatsingen 45% goedkoper en ontgrendelt pas dan de bussponsor

### 0.9.2

- **Clubrating naast de clubnaam** in de kopbalk (drie regels met sterren en score), in plaats van eronder
- **Winterstop duidelijk zichtbaar:** een blauwe melding op het overzicht, een label in de kopbalk en een regel in het weekrapport. Tijdens de stop draait de kantine op 45%: geen jeugdwedstrijden, weinig volk
- **"Concessies" heet nu "horeca concessies"** in alle overzichten, ook in bestaande opslagbestanden
- **Wedstrijdkosten** benoemen of het om een thuis- of uitwedstrijd gaat (scheidsrechter en organisatie tegenover busvervoer)

### 0.9.1

- **Delegeren:** bij Staff staat per taak een keuzelijst met iedereen die ze kan overnemen; je hoeft niet meer via het detailscherm van een staflid. Drie nieuwe taken: jeugdwerking (lidgeld), belasting en blessurepreventie (kinesist, verzorger of voedingsdeskundige) en onderhoud en bouwprojecten (afgevaardigde of commercieel medewerker)
- **Tickets:** de opbrengst staat nu bruto in de boeken (toeschouwers × prijs), met het aandeel van de bezoekende club en de bond (8%) als aparte regel bij wedstrijdkosten
- **Kopbalk:** klassement, hoofdsponsor, saldo, teamsterkte, clubrating en datum zijn links naar het bijbehorende scherm
- **Sponsoring:** nieuwe plaatsen (mouwsponsor, ploegbus, evenementensponsor, schermen in de kantine, wedstrijdbal) en een evenwichtigere verdeling over de sectoren. Sommige plaatsen ontgrendelen pas met de juiste kantine, jeugdwerking of een georganiseerd evenement
- **Uitgeleende spelers** kun je een nieuw contract geven zolang ze van jou zijn

### 0.9.0

- **Transferperiode** staat als banner bovenaan Transfers: open tot welke week, of wanneer ze weer opengaat
- **Loononderhandelen:** blijven laagbieden werkt niet meer. Elk afgewezen bod kost moraal (steeds meer), verhoogt zijn vraag met 7% en na drie pogingen wil hij dit seizoen niet meer praten
- **Cijfers per week** naast per seizoen, met de opbrengst per bron; kantine en concessies staan nu ook bij de opbrengsten per seizoen
- **Clubrating in de kopbalk** naast de clubnaam (sterren per categorie, met de opbouw in de tooltip)
- **Eigen clubnaam** kiezen bij de start, naast het logo
- **Scorebord** als bouwproject: meer sfeer en bordsponsors betalen meer
- **Meer ontgrendelingen:** een data-analist vraagt wifi, een kantineverantwoordelijke een kantine van niveau 2, een voedingsdeskundige niveau 3, een keeperstrainer twee doelmannen en een conditietrainer degelijke verlichting of kunstgras
- **Vrijwilligers op een menselijke schaal:** ongeveer 12 in plaats van 28, evenementen vragen er 3 tot 14 (14 = mosselfeest, daar moet je dus echt voor werven)
- **Sponsornaam en sector** kloppen nu ook in bestaande opslagbestanden (de bedrijvenlijst heeft één sector per naam)
- **Inflatie:** alle vaste kosten stijgen 6% per seizoen. Sponsors en ticketprijzen volgen alleen als jij ze aanpast, dus niets doen kost geld
- **Balans:** passief spelen loopt nu veel vaker slecht af (Zuidrand met de coöperatie 13/20, Heidebeke met de coöperatie 14/20 faillissementen in drie seizoenen)

## Volgende lagen (voorstel)

3. **Middenkader en directie:** HR-manager, sportief directeur, CFO, CTO, CMO die taken van andere staf coördineren
4. **Uitgebreidere jeugdopleiding:** U7 tot U21, jeugdtrainers, opleidingsvergoedingen, doorverkooppercentages
5. **Extra inkomsten:** merchandising, shirts, trainingskampen, horeca-uitbaters met een percentage
6. **Tech:** club-app, loyaliteitsprogramma, online ticketing (vrijgespeeld via CTO)
7. **Activa:** investeren in lokale handelaars, verkoopbare activa met schommelende waarde
8. **Beker van Belgenland**, media en sociale media
9. **Online opslaan** via een kleine API (bv. serverless functie met MongoDB Atlas of Supabase)

## Publiceren

Bij elke push naar `main` draait GitHub Actions de tests en zet de build op GitHub Pages. Verplaats daarvoor eerst `ci/github-actions.yml` naar `.github/workflows/ci.yml`:

```bash
mkdir -p .github/workflows && mv ci/github-actions.yml .github/workflows/ci.yml && rmdir ci
```

Zet in je repository onder *Settings → Pages* de bron op **GitHub Actions**.
