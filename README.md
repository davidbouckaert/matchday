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

## Laag 8 (deze versie)

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
