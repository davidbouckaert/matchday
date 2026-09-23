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
  content/         ← de spelinhoud als pure data, zonder logica
    types.ts       ← de taal: voorwaarden, effecten, getallen, plaatshouders
    moments.ts     ← de weekmomenten, inclusief de ketens die op elkaar voortbouwen
    events.ts      ← meevallers en tegenslagen die vanzelf gebeuren
    news.ts        ← nieuwsberichten als sjabloon, met meerdere formuleringen
    careers.ts     ← de acht langetermijndoelen en de vijf eigenaarsniveaus
  engine/          ← de simulatie. Geen DOM, deterministisch, volledig testbaar
    types.ts       ← alle datatypes; GameState = het volledige spel als één JSON-object
    turn.ts        ← advanceWeek(): één beurt verwerken (het hart van het spel)
    content.ts     ← voert de data uit src/content uit: voorwaarden toetsen, effecten toepassen
    world.ts       ← de andere clubs: budget, ambitie, momentum en hun beslissing per seizoen
    career.ts      ← je langetermijndoel, je eigenaarsniveau en wat elk niveau opent
    fastforward.ts ← meerdere rustige weken achter elkaar, met de redenen om te stoppen
    forecast.ts    ← kasprognose: wat er de komende acht weken vastligt
    origins.ts     ← waar de bedragen van de week vandaan kwamen, per factor
    seasontickets.ts ← abonnementen: geld vooraf, een seizoen lang vast
    actions.ts     ← alles wat de speler kan doen (kopen, verkopen, lenen, bouwen, ...)
    newGame.ts     ← nieuw spel opzetten (club, investeerder, avatar)
    players.ts     ← kwaliteit, marktwaarde, opstelling, teamsterkte, ontwikkeling
    league.ts      ← competitie, kalender, wedstrijdsimulatie (Poisson)
    finance.ts     ← toeschouwers, kantine, vaste kosten
    loans.ts       ← bankleningen (annuïteiten)
    sponsors.ts    ← sponsorcontracten, werving, tevredenheid
    merch.ts       ← clubwinkel: assortiment, prijzen en wekelijkse verkoop
    canteen.ts     ← kantineprijzen en horecaconcessies
    popularity.ts  ← populariteit: één vermenigvuldiger op alle inkomsten
    stats.ts       ← cijfers per seizoen (tickets, consumpties, artikelen, leden)
    market.ts      ← volatiele transfermarkt, transferlijst, personeelsmarkt
    events.ts      ← meevallers, tegenslagen, biedingen, blessures, faillissement
    discipline.ts  ← gele en rode kaarten, schorsingen, tuchtboetes
    delegation.ts  ← taken die je personeel van je overneemt en automatisch uitvoert
    strategy.ts    ← training, mentaliteit, spelplannen en hun sterkte/zwakte-tabel, scouting
    factors.ts     ← vermenigvuldigers als lijsten (sponsors, toeschouwers, kantine, vermoeidheid, blessures)
    modifiers.ts   ← overzicht van alle invloeden voor de tab Invloeden
    ratings.ts     ← clubscore: sportief, financieel, gemeenschap
    calendar.ts    ← weken, transferperiodes, vaste momenten in het jaar
    rng.ts         ← voorspelbare toevalsgenerator (zelfde seed = zelfde spel)
    data/          ← spelwaarden: reeksen, clubs, investeerders, namen, catalogus
  storage/save.ts  ← IndexedDB + export/import (interface klaar voor online opslag)
  ui/              ← schermen als HTML-templates, geen framework
    screens/report.ts   ← animatie en weekrapport na elke gespeelde week
    screens/calendar.ts ← seizoenskalender (Club › Kalender)
    screens/merch.ts    ← clubwinkel (Club › Clubwinkel)
    screens/horeca.ts   ← kantine en concessies (Club › Horeca)
    screens/numbers.ts  ← cijfers per seizoen (Club › Cijfers)
    screens/contracts.ts← contracten en loononderhandeling (Ploeg › Contracten)
  version.ts       ← versienummer en changelog (onderaan elke pagina)
test/              ← Mocha + Chai
scripts/balance.ts     ← balanstest over meerdere seizoenen (SEEDS=n SEASONS=n om bij te stellen)
scripts/world-probe.ts ← meet hoe de reeksen over de seizoenen evolueren
```

**Ontwerpregel: inhoud is data, geen code.** Weekmomenten, gebeurtenissen, nieuwsberichten, carrièredoelen en eigenaarsniveaus staan in `src/content/` als gewone data-objecten. `src/engine/content.ts` leest die en voert ze uit. Een nieuwe situatie of gebeurtenis toevoegen vraagt daarom geen enkele wijziging aan de simulatie — en dat wordt ook getest.

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

## Laag 12 (deze versie)

### 0.19.0 — Twee snelheden, vooruitkijken en beslissingen die blijven hangen

**De lus draait nu op twee snelheden.** Naast "Volgende week" staat "Tot de volgende match". Die speelt de rustige stukken achter elkaar — de voorbereiding, de winterstop, de weken na de laatste speeldag — en stopt vlak voor de volgende wedstrijd. Er wordt nooit iets voor je beslist: hij stopt ook bij een weekmoment, een onvolledige basiself, een saldo onder nul of een nieuw seizoen. Daarna volgt één venster met wat er ondertussen gebeurde en waarom er gestopt werd. De knop blijft altijd staan, ook als hij niets te doen heeft — dan uitgeschakeld, met de reden in de tooltip. Hoeveel stappen je per keer zet, blijft dus volledig aan jou.

**Financieel beleid kijkt vooruit in plaats van terug.** Bovenaan Financiën staat een prognose van maximaal acht weken: lonen, onderhoud, jeugdwerking, sponsorcontracten, trainingen, aflossingen, de vaste momenten van het jaar, opbrengsten die al onderweg zijn, en per wedstrijd een raming van de kassa en de kantine (met een ± erbij). Onderaan elke week staat wat er daarna in kas zit, en zou je ergens onder nul duiken, dan staat dat als waarschuwing bovenaan.

**De formules leggen zichzelf uit.** "Waar kwam het vandaan" splitst de grootste posten van de laatste week uit naar factoren, met per factor wat hij opleverde of kostte. Een regel als `Sfeer ×0,81 −€1.562` betekent: zonder die lage sfeer had je €1.562 méér gehad. Het zijn dezelfde factorlijsten waarmee de engine rekent, vastgelegd op het moment van boeken, dus de uitsplitsing kan niets anders zeggen dan wat er echt gebeurde.

**Zesendertig weekmomenten.** Vijftien was te weinig voor een spel van honderden weken. Er zijn er twintig bijgeschreven, van de frietketel die te klein is tot de scout achter het doel. Gemeten over acht partijen van vijf seizoenen komen 33 van de 36 situaties voorbij; de drie andere vragen om iets wat een passieve eigenaar nooit doet. Daarbij kwam een oude bug aan het licht: het moment "Je beste man is op" vroeg vermoeidheid boven 70, terwijl een normale kern nooit boven 33 komt — het stond in de data maar kon nooit gebeuren. Er is nu een test die meet hoeveel situaties er in drie seizoenen echt in beeld komen.

**Twee beslissingen met een lange staart.** Abonnementen verkoop je één keer per seizoen, voor de competitie start: het geld komt ineens binnen, maar die mensen betalen daarna niet meer aan de kassa — ook niet als je je ticketprijs verhoogt, ook niet als het regent. En bij een nieuw sponsorcontract kies je zelf de looptijd: één seizoen tegen het basisbedrag, twee seizoenen voor 8% meer, drie voor 15% meer. Wie lang tekent heeft zekerheid, maar zijn contract schuift niet mee omhoog bij een promotie.

## Laag 11

### 0.18.0 — Een levende reeks en een carrière met een boog

**Inhoud losgemaakt van de simulatie.** Weekmomenten, willekeurige gebeurtenissen en een deel van de nieuwsberichten staan nu als pure data in `src/content/`. De contenttaal kent voorwaarden (vlaggen, metingen, verhaallijnen, eerder opgeleverde waarden), effecten, kansen, gewichten, wachttijden en plaatshouders (`{club}`, `{speler}`, `{bedrag}`, `{tegenstander}`). Getallen schalen mee met inflatie, klasse, jeugdploegen of ticketprijs. Twee tests voegen een moment en een gebeurtenis toe die alleen als data bestaan en toch volledig meedraaien — dat is de garantie dat de scheiding echt is.

**De andere clubs zijn clubs geworden.** Elke club in elke reeks heeft een eigen budget, ambitie, momentum, accommodatie, jeugdwerking en financiële toestand, bewaard over weken en seizoenen heen. Eén keer per zomer neemt elke club één beslissing op basis van haar eindpositie, haar kas en haar ambitie: versterken, bouwen, jeugd uitbreiden, besparen, of in het slechtste geval de boeken neerleggen. Promotie en degradatie gebeuren nu ook in de reeksen waar jij niet speelt. Over twintig seizoenen gemeten blijven de reeksen op sterkte en blijft elke reeks duidelijk boven de reeks eronder (48,8 → 57,3 → 64,3 → 70,1 → 75,9 → 83,3).

**Keuzes werken door.** Wat je beslist opent een verhaallijn die weken of seizoenen blijft openstaan, en latere momenten bouwen daarop voort met dezelfde namen en bedragen. De sponsorruzie loopt over drie stappen met twee takken; een verkochte speler kom je later tegen als tegenstander; een afgerond bouwproject levert weken later nog pers en supporters op; geldzorgen maken sponsors en vrijwilligers nerveus, ook nadat het saldo weer klopt; een ambitieuze rivaal met een sterke jeugdwerking kaapt je mooiste belofte weg.

**Een doel voor de lange termijn.** Je legt één keer vast waar je met deze club naartoe wilt — acht doelen, van "naar 2de nationale" over "een echt stadion" tot "hoog én gezond". Het doel staat de hele carrière op je overzicht met de actuele stand erbij, en het moment waarop je het haalt krijgt een melding, een regel in de clubkroniek en een banner in het museum. Daarbovenop één lichte laag: vijf eigenaarsniveaus die elk één concreet voordeel openen (lagere rente, een derde bouwproject, een extra sponsorprospect, meer subsidie). Wat het volgende niveau oplevert, staat altijd op je overzicht, en geen enkel niveau zet bestaande mogelijkheden achter slot.

**Passief spelen loopt nu altijd slecht af.** Over drie seizoenen gemeten (60 partijen per combinatie): Zuidrand 80% / 32% / 100% failliet, Heidebeke 3% / 0% / 87%. Over zes seizoenen (30 partijen) gaat élke combinatie eraan: 30/30, 30/30, 30/30, 30/30, 29/30, 30/30. De makkelijke club geeft je dus een langere aanloop om het te leren, maar niets wordt vanzelf leefbaar.

**Nieuw in de schermen.** Het competitiescherm toont per club haar sterkte, ambitie, werking en laatste zomerzet. Het overzicht heeft een carrièrekaart met je doel, je voortgang en je eigenaarsniveau. Het museum heeft een clubkroniek met alles wat de moeite is om na te vertellen.

### 0.17.2 — Het weekmoment als venster

**Het kwam elke week terug.** Bij het kiezen van een nieuwe situatie werd alleen de vorige uitgesloten, en die stond op dat moment al op `null` — dus kon dezelfde situatie eindeloos herhalen. Elke situatie heeft nu een wachttijd van 12 weken. Over 30 weken gemeten: ketel → bus → sponsorbezoek → kaartverkoop → scheidsrechter → kernspeler → bus → sponsorbezoek.

**Het viel niet op.** Het weekmoment stond als kaart op je overzicht, tussen de rest. Nu verschijnt het als **venster** zodra je het weekrapport sluit. Je kiest daar, en **in hetzelfde venster** lees je meteen wat je keuze opleverde ("Je koos: Nu herstellen (€900) — Ketel hersteld voor €900. Een zorg minder.") met een knop **Verder**. Geen kort meldinkje onderaan het scherm meer.

Wil je eerst rondkijken, dan klik je op **Later beslissen**. Op je overzicht blijft een kader met een groene rand staan met de knop "Beslissen (2 keuzes)", en bij **Aandacht** staat een link die het venster opnieuw opent.

### 0.17.1 — Jij beslist wie er speelt

**Geen automatische invaller meer.** Haal je iemand uit je basiself (🪑), dan blijft die plaats **open**. Je trainer schuift er niet vanzelf een ander in: de teller zakt naar 10/11, de linie toont "— open, duid zelf iemand aan —", en de knop "Volgende week" gaat op slot met de reden erbij ("Je liet plaatsen open in je basiself (1× doel)"). Je lost het op door zelf iemand aan te duiden met de ster, de speler weer beschikbaar te maken, of op **Alles loslaten** te klikken — dan neemt je trainer het weer over.

Details:
- Een **reservespeler** op de bank zetten verandert niets aan je elf: er ontstaat alleen een gat als je iemand weghaalt die écht speelde.
- Iemand vastzetten met de ster vult een open plaats in die linie meteen op.
- Besteed je de opstelling uit aan een personeelslid, dan wist hij je open plaatsen en je bank: hij stelt gewoon zijn beste elf op.

**Inklapbare tabellen.** Basiself, Bank en reserve en Niet beschikbaar zijn nu uitklapbaar. De bank en de niet-beschikbaren staan standaard dicht, zodat je scherm niet volloopt; wat je openklapt blijft open terwijl je verder speelt.

Opslagversie 21.

### 0.17.0 — Basiself onder controle en evenementen voor elke reeks

**De selectie werkt nu zoals je verwacht.** Elke speler heeft twee knopjes in plaats van één ster met dubbele betekenis:

- **★ vastzetten** — hij staat in de basis en je trainer laat hem staan. Nog eens klikken laat hem los (✓ = door de trainer gekozen).
- **🪑 op de bank** — hij wordt deze week niet opgesteld, ook niet door je trainer. Nog eens klikken maakt hem weer beschikbaar.

Zet je iemand vast terwijl die linie al vol staat met vastgezette spelers, dan **maakt de zwakste van hen plaats** (met melding wie) in plaats van een foutmelding. Vastzetten en bankzitten sluiten elkaar uit. Je kunt niet zoveel spelers op de bank zetten dat er geen elftal overblijft. Spelers springen meteen naar de juiste tabel (basiself / bank / niet beschikbaar), en de tellers — 11/11 speelklaar én per linie 1/1 doel, 4/4 verdediging, 4/4 middenveld, 2/2 aanval — lopen mee. Geblesseerde, geschorste en uitgeleende spelers hebben geen knopjes meer. Opslagversie 20.

**Evenementen schalen mee met je club.** De opbrengst hing al aan je supporters en jeugdleden; daar komen nu je sponsorbedragen en je tribune bij, en alles wordt met de inflatie vermenigvuldigd. De kosten deden dat nog niet en waren dus stilaan gratis geworden: die volgen nu de inflatie plus 12% per reeks. Ook de vrijwilligersacties volgen de inflatie.

**Vijf nieuwe evenementen die vrijkomen als je stijgt:**

| Evenement | Vanaf | Extra eis | Vrijwilligers |
| --- | --- | --- | --- |
| Sponsorontbijt | 2de Nationale | kantine niveau 3 | 4 |
| Galabal van de club | 2de Nationale | — | 12 |
| Gala-oefenwedstrijd tegen een profclub | 1ste Nationale | 1.500 plaatsen | 16 |
| Businessclub-lunch | 1ste Nationale | kantine niveau 4 | 5 |
| Internationaal wintertornooi | Challenger Pro Liga | 4.000 plaatsen | 22 |

Waarom je ze niet kunt organiseren staat er meteen bij ("Pas mogelijk vanaf 1ste Nationale", "Je hebt minstens 1.500 plaatsen nodig").

**Het weekmoment valt beter op.** Die melding over een defecte bus of een lange rij aan de poort kwam uit het weekmoment: de beslissing die bovenaan je overzicht ligt. Speelde je de week zonder te beslissen, dan ging de laatste optie vanzelf door — dat stond er wel, maar te onopvallend. Nu staat een openstaande beslissing ook in het kader **Aandacht**, in de tip op de knop "Volgende week", en het resultaat heet in het rapport en in het nieuws voortaan "Weekmoment — …" met de zin *"Je besliste niets, dus … ging door."*

### 0.16.1 — Scherpere volumekorting

De korting per zitje is agressiever en versnelt nu echt. Wat elke volgende honderd zitjes extra kosten:

| Van → tot | Per extra zitje |
| --- | --- |
| 100 → 200 | €360 |
| 400 → 500 | €290 |
| 900 → 1.000 | €210 |
| 1.400 → 1.500 | €160 |
| 1.900 → 2.000 | €80 |

De uitklapbare prijstabel onder de schuifregelaar is weg: het regeltje onder de slider zegt hetzelfde, live.

### 0.16.0 — Bouwen op jouw maat

**De tribune met een schuifregelaar.** Geen vast blok van 300 plaatsen meer: je kiest zelf tussen 100 en 2.000 plaatsen, in stappen van 50. Terwijl je sleept rekent het scherm live mee — aantal, totaalprijs, prijs per zitje en bouwtijd.

**Volumekorting, en ze versnelt.** De aannemer rekent minder per stoel naarmate je er meer bestelt: dezelfde opstart, dezelfde kraan, dezelfde ploeg. De prijs per zitje volgt `450 − 150 × log10(plaatsen / 100) − 40 × (plaatsen / 2000)²`, maal de inflatie en maal 0,85 als je aannemer-investeerder nog aan boord is. Het kwadratische stuk zorgt dat de korting oploopt in plaats van af te vlakken: één grote tribune is duidelijk voordeliger dan drie kleine blokken.

| Plaatsen | Per zitje | Korting | Totaal | Bouwtijd |
| --- | --- | --- | --- | --- |
| 100 | €450 | — | €45.000 | 4 weken |
| 300 | €378 | −16% | €113.000 | 6 weken |
| 600 | €330 | −27% | €198.000 | 8 weken |
| 1.000 | €290 | −36% | €290.000 | 12 weken |
| 1.500 | €251 | −44% | €377.000 | 17 weken |
| 2.000 | €215 | −52% | €430.000 | 21 weken |

(bedragen zonder aannemerskorting; bouwtijd = `3 + plaatsen / 110`, begrensd op 4 tot 22 weken)

**Zonnepanelen zijn een bouwproject.** Ze stonden bij Onderhoud en energie en waren meteen klaar; nu staan ze tussen de bouwprojecten en duren ze 5 weken. De prijs blijft afhangen van de grootte van je complex (ongeveer drie seizoenen terugverdientijd).

**Twee werven tegelijk.** De limiet van één project is opgetrokken naar twee. Je ziet bovenaan Infrastructuur hoeveel er lopen, per project staat "bezig, nog X weken", en een derde project wordt geweigerd met uitleg. Ook je kalender, het weekrapport en de Clubinfo tonen beide werven.

Opslagversie 19: een lopend project uit een ouder bestand verhuist naar de nieuwe lijst (een tribune in aanbouw wordt gelezen als +300 plaatsen).

### 0.15.0 — Nederlandse termen

Engelse woorden in de interface zijn vervangen door Nederlandse. Typische voetbaltermen blijven staan.

| Was | Is nu | Waar |
| --- | --- | --- |
| Staff | **Personeel** | hoofdtab, subtab, "Eerste stappen", tooltips, handleiding |
| staflid / stafleden | **personeelslid / personeelsleden** | overal |
| lonen staff | **lonen personeel** | boekingscategorie |
| T1, T2, T3 | **hoofdtrainer, assistent-trainer, conditietrainer** | personeelsrollen, opleiding, invloeden |
| Fanshop | **Clubwinkel** | tab Club › Clubwinkel, teksten, links |
| shop / webshop | **winkel / webwinkel** | clubwinkelscherm, cijfers |
| merchandising | **clubartikelen** | boekingscategorie |
| inkoop shop / werking shop | **inkoop winkel / werking winkel** | boekingscategorieën |
| Merchandisingverantwoordelijke | **Winkelverantwoordelijke** | personeelsrol, delegatie |
| Clubrating | **Clubscore** | overzicht, kopbalk, seizoensdoelen |
| dashboard | **overzicht** | knop in het weekrapport, handleiding |
| Vacant | **Niet ingevuld** | personeelstabel |
| FAQ | **veelgestelde vragen** | hamburgermenu |

**Blijft staan (voetbaltaal):** balbezit · counter · pressing · lange bal · vleugelspel · derby · transfer, transferperiode, transfermarkt, transferlijst, transfervrij · keeper · kern, A-kern · scout, scouting · ticket, ticketprijs · mentale coach · EUFA-diploma's · Challenger Pro Liga · forfait · sponsor, shirtsponsor, mouwsponsor · kantine · concessie.

De vier hernoemde boekingscategorieën zijn tegelijk data en zichtbare tekst. Opslagversie 18 verhuist de bedragen mee: seizoenstotalen, vorig seizoen, de weekgeschiedenis, de weekcijfers, de lopende boekingen en wat nog moet binnenkomen. Je cijfers per categorie blijven dus kloppen.

Codenamen (`staffSkill`, `merchScreen`, `s.merch`) blijven Engels — dat is techniek, geen interface.

### 0.14.0 — Sterkere reeksen, duidelijkere selectie en doelpuntenmakers

**Elke reeks ligt nu écht boven de vorige.** De sterkte van een tegenstander wordt bepaald door `teamLevel()`: de bodem van een reeks ligt boven het gemiddelde van de reeks eronder, en de spreiding is smaller (sd 3,4 in plaats van 5,5). Gemeten over vier seizoenen promoveren:

| Reeks | Eigen ploeg | Tegenstanders gemiddeld | Zwakste |
| --- | --- | --- | --- |
| 3de Nationale | 52,9 | 55,6 | 51,5 |
| 2de Nationale | 54,5 | 61,1 | 57,5 |
| 1ste Nationale | 60,6 | 68,3 | 63,5 |
| Challenger Pro Liga | 68,9 | 73,9 | 69,5 |

**Als promovendus hoor je onderaan.** Clubs die net promoveerden krijgen −3,2, clubs die net degradeerden +2,8. Jij bent na een promotie dus zelf de zwakste van de reeks — je moet je plaats verdienen, niet meteen domineren.

**De selectie is opgesplitst.** Drie tabellen in plaats van één lange lijst: **A-kern: de basiself** (de elf die zondag begint), **Bank en reserve** (speelklaar, niet in de basis) en **Niet beschikbaar** (geblesseerd, geschorst, uitgeleend). Daarboven een nieuwe kaart **Basiself: 11/11** met per linie een teller tegenover je formatie — Doel 1/1, Verdediging 4/4, Middenveld 4/4, Aanval 2/2 — plus hoeveel spelers je per linie speelklaar hebt, wie er buiten zijn positie staat en welke plaatsen leeg zijn. Groen = in orde, oranje = iemand uit positie, rood = plaatsen leeg.

**Doelpuntenmakers.** Elk doelpunt krijgt een maker en een minuut. Aanvallers wegen 3,2×, middenvelders 1,4×, verdedigers 0,5×, keepers 0,02×; binnen een linie scoort de betere speler vaker en je strafschopnemer krijgt ×1,35. In het weekrapport staat `⚽ Kobe Trossaert 22'`, met daaronder een uitklapbare lijst van **de elf die begon** (met rating en een balletje bij wie scoorde). De kolom **Goals** staat ook in je spelerstabel; `careerGoals` telt door over seizoenen heen voor het clubmuseum.

**Bankleningen schalen mee** met je reeks (+40% per niveau), je loonmassa (±5.000 euro per week = een club in 3de nationale, gecapt op 2,2×) en de inflatie. Kaskrediet €30k in 3de nationale, €46k in 2de, €112k in de Challenger Pro Liga. De noodlening schaalt maar half mee: dat blijft een reddingsboei, geen kredietlijn.

**Het nieuws rolt trager binnen:** 260 ms per regel in plaats van 150 (samen tot 3,2 seconden), zodat je elke regel kunt lezen terwijl hij verschijnt.

Balanstest na deze wijzigingen: Zuidrand-aannemer 16/20 failliet bij passief spelen, Zuidrand-coöperatie 20/20, Heidebeke 5/2/16. Opslagversie 17.

### 0.13.0 — Derby, weekmoment en clubmuseum

**Elke reeks heeft nu zijn eigen wereld.** Vroeger speelde je in 2de nationale tegen dezelfde ploegen als in 3de. Nu heeft elk niveau zijn eigen clubs — dorpsploegen in 1ste Provinciale (SK Beernehem, VV Ruiseleede), streekclubs in 2de Nationale (KFC Heiste, RC Mechelse), halfprof in 1ste Nationale (RWD Molenbeke), echte profclubs in de Challenger Pro Liga. Twee ploegen komen uit de reeks eronder (net gepromoveerd) en twee uit de reeks erboven (net gedegradeerd), zodat een promotie aanvoelt als een verhuis en niet als hetzelfde seizoen met andere cijfers.

**De derby (idee 2).** Eén club is je aartsrivaal, met naam. Die wedstrijd:

- trekt **75% meer volk** (was 45%) en dus ook meer kantine en kraampjes;
- levert meer kaarten op aan beide kanten;
- weegt **dubbel** op de sfeer in het dorp, en een zege geeft +2 reputatie;
- wordt een week vooraf aangekondigd in het nieuws en staat met 🔥 DERBY op je dashboard, in het klassement en in het weekrapport;
- houdt een **onderlinge balans** bij (W-G-V) die over seizoenen heen blijft staan.

Blijf je in dezelfde reeks, dan blijft hij je rivaal. Promoveer of degradeer je, dan is er 35% kans dat hij dezelfde weg aflegde — met een nieuwsbericht als het zo is.

**Het weekmoment (idee 4).** Elke week ligt er één concrete beslissing op je bureau, bovenaan je dashboard. Drie zinnen, twee of drie knoppen, meteen gevolg:

- het regent al drie dagen: zeil leggen (€450) of erop gokken;
- de huurbus is defect: duurdere bus (€600) of met eigen wagens;
- je beste man loopt op zijn tandvlees: sparen of laten spelen (28% kans op een blessure);
- de scheidsrechter is er niet: wachten (en de kantine draait) of een clubref vragen;
- je hoofdsponsor komt met tien klanten: ontvangst met hapjes of een plaatsje op de tribune;
- plus de derbytent, de verwarmingsketel, het jeugdtornooi, de mopperende speler en de bus bezoekende supporters.

Tien situaties, elk met eigen voorwaarden, zodat je alleen krijgt wat bij jouw club past. Ongeveer twee op de drie wedstrijdweken, af en toe in een vrije week. Beslis je niet voor je op "Volgende week" drukt, dan gaat de laatste optie door. Het resultaat staat in je weekrapport en in je logboek.

**Het clubmuseum (idee 5).** Nieuw scherm onder Club: je titels, promoties en degradaties als trofeeënkast, al je records (grootste opkomst, beste week, langste zegereeks), je hoogtepunten (hoogste reeks, beste plaats, premies verdiend, balans tegen je rivaal), de mensen (sterkste speler, duurste aankoop, eigen jeugd in de A-kern), de lijn van je gemiddelde opkomst per seizoen, de volledige erelijst en een muur met alle elf mijlpalen — behaald of nog op slot. Niets extra om bij te houden: alles stond er al.

**Passief spelen is scherper afgestraft.** Een club waar tien weken lang niets beslist wordt — geen sponsor aangesproken, niets georganiseerd, gebouwd of uitbesteed — verliest langzaam sfeer (tot 45), reputatie (tot 20) en sponsortevredenheid (tot 30), met een nieuwsbericht erover. Eén beslissing zet die klok op nul, dus wie speelt merkt er niets van. Balanstest over 3 seizoenen zonder ook maar één ingreep: Zuidrand-aannemer **16/20 failliet** (was 9/20), Zuidrand-fonds 12/20, Zuidrand-coöperatie 20/20, Heidebeke 1/4/16.

Opslagversie 16.

### 0.12.0 — Een echte jeugdwerking van bij de start

Je club is geen lege doos meer: er draait al een bescheiden jeugdwerking op de dag dat jij de sleutels krijgt.

- **Ploegen in plaats van een getal.** Je jeugd bestaat uit ploegen (U7, U9, U11, U13, …), ongeveer één per 55 leden. KFC Zuidrand start met 4, VV Heidebeke met 5.
- **Een jeugdcoördinator staat er al** (vrijwilligersvergoeding €45/week). Hij telt mee voor je clubrating, voor de instroom van nieuwe leden en voor de tevredenheid van je vrijwilligers.
- **Elke ploeg bindt 2 vrijwilligers** — een jeugdtrainer en een ploegafgevaardigde. Evenementen kunnen alleen de **vrije** vrijwilligers gebruiken: bij Club › Evenementen staat per evenement hoeveel er vrij nodig zijn en hoeveel je er hebt. Dat is de kern van de afweging: elke ploeg erbij is twee mensen minder voor je spaghettiavond.
- **Te weinig begeleiding doet pijn.** Per ontbrekende vrijwilliger: −6% instroom bij de inschrijvingen, −4 punten vrijwilligerstevredenheid en −4 op je jeugdrating.
- **Je complex is het plafond:** 4 ploegen, +2 met kunstgras, +1 met verlichting niveau 2, +2 per niveau opleidingscentrum. Zit je aan dat plafond, dan zakt de instroom naar 85% en haken ouders af. Zo wordt bouwen een echte jeugdbeslissing, niet alleen een A-kernbeslissing.
- **Ploegen schuiven één stap per seizoen** (bij de inschrijvingen in week 10), met een nieuwsbericht als er een bijkomt of verdwijnt.
- **Staffregel:** een jeugdcoördinator aanwerven vraagt minstens 3 ploegen (vroeger 20 leden). Ook de jeugdsponsor vraagt nu 3 ploegen.
- **En het kost geld:** €30 per ploeg per week aan werking (ballen, scheidsrechters, verplaatsingen, tornooien) plus €400 per ploeg bij de aansluiting bij de bond. De jeugd is een investering, geen gratis inkomstenbron — de balanstest bevestigt dat passief spelen er niet makkelijker van wordt.

Alles staat samen op een nieuwe kaart bij **Club › Clubinfo**: je reeksen, leden, begeleiding, coördinator, plaats op het complex, instroompercentage en wat er volgend seizoen bijkomt of wegvalt. Opslagversie 15; bestaande saves krijgen het aantal ploegen dat bij hun ledenaantal past.

### 0.11.0 — De seizoensopening

Week 1 is geen gewone week meer. Voor je iets anders kunt doen, opent de **seizoensopening**:

- **De affiche:** je clublogo, de reeks, het seizoen en de datum van de eerste speeldag
- **De voorbeschouwing:** een (verzonnen) blad of podcast voorspelt waar je eindigt, met een citaat dat je kunt uitprinten en boven de deur hangen. De voorspelling volgt je teamsterkte tegenover de reeks, met een vleugje toeval
- **Deze zomer:** wie transfervrij vertrok, wie terug is van uitleenbeurt, en welke shirtsponsor op de nieuwe truitjes staat
- **Uit de eigen jeugd:** de doorstromers met hun leeftijd en positie
- **De doelen van het bestuur:** drie doelen, één per categorie van je clubrating (sportief, financieel, gemeenschap), berekend op waar je vandaag staat plus een duw. Elk met zijn eigen premie
- **De persconferentie:** je kiest één van drie ambities. Dat is het enige wat de opening van je vraagt, en het is niet terug te nemen

| Ambitie | Belofte | Supporters | Spelers | Sponsors |
| --- | --- | --- | --- | --- |
| Voeten op de grond | niet in de degradatiezone | −4 | +6 (rust) | −3 |
| Meedoen voor de prijzen | bij de eerste vijf | +6 | −2 | +5 |
| Wij worden kampioen | kampioen worden | +14 | −8 (druk) | +12 |

Op het einde van het seizoen wordt er afgerekend. Waarmaken levert een premie op (0,35× tot 2× de basispremie van je reeks) plus reputatie en tevreden sponsors; het niet waarmaken kost geld, reputatie, sfeer en sponsortevredenheid. Grootspraak betaalt het dubbele en kost ook het dubbele.

De drie doelen staan het hele seizoen op je **dashboard**, met je belofte erboven, hoever je staat en een voortgangsbalk. De volledige afrekening (✅/❌ per doel, met wat je effectief haalde) staat in het **seizoensrapport**, en alle premies worden geboekt onder **premies**.

Oude opslagbestanden: sta je nog voor de eerste speeldag, dan krijg je de opening alsnog; sta je middenin een seizoen, dan begint het bij je volgende seizoenstart. Opslagversie 14.

## Laag 9

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
