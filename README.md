# Clubeigenaar ⚽

Een turn-based simulatiegame in de browser. Jij bent de **eigenaar** van een kleine Belgische voetbalclub die net naar 3de nationale is gepromoveerd. Je bent geen trainer en speelt zelf geen wedstrijden: jij beslist over het geld. Denk aan Coffee Inc, maar dan met een voetbalclub.

## Starten

```bash
npm install
npm run dev        # speel op http://localhost:5173
npm test           # unit tests (Mocha + Chai)
npm run typecheck  # TypeScript-controle
npm run balance    # simuleert passief spel voor elke club/investeerder
npm run investors  # rekent door wat elke investeerder over zes seizoenen waard is
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
- **Sponsors:** eigen tab met je prijskaart (jij zet per plaats wat ze per week kost), bedrijven om te benaderen met de kans dat ze ja zeggen, netwerkavond, sponsorbureau, tevredenheid, extra bijdrage vragen, verlengen, stopzetten
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

- **Kern beschermen:** je kunt je laatste doelman niet verkopen of uitlenen, elke linie houdt minstens één reserve en je zakt nooit onder 18 spelers. Ook de scout houdt zich daaraan. In Transfers zie je met een ★ wie tot je kern hoort en met een slotje wie deze week niet weg mag
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

## Laag 18 (deze versie)

### 0.62.0 — De bouwprojecten in vijf herkenbare groepen

**Twaalf werven in één vlakke lijst las als een rommelmarkt**: beton naast wifi naast een tweedehands bus. Het bouwscherm deelt ze nu in zoals een bestuur erover praat: **🧱 Ruwbouw** (de tribune vooraan, kantine, toiletten en kleedkamers, parking), **⚽ Sportief** (kunstgras, verlichting), **🚪 Afdelingen** — ruimtes met een eigen werking — (jeugdopleidingscentrum, recuperatieruimte), **📡 Technologie** (wifi, scorebord) en **💶 Investeringen** die zichzelf terugverdienen (ploegbus, zonnepanelen). Elke groep opent met één zin die zegt wat je er koopt. De groep is een veld in de catalogus (`UPGRADE_GROUPS` in `catalog.ts`), dus een toekomstig project — een persruimte, kantoren, een fitness — moet bij het toevoegen meteen een plek kiezen. Voor en na met Playwright vastgelegd: zelfde elf kaarten plus de tribune, nu onder vijf koppen.

### 0.61.0 — Eén rondleiding in plaats van twee lijsten

**Er stonden twee begeleidingssystemen boven elkaar op het Bureau** — "Eerste stappen" (tien punten die je op dag één voor je kiezen kreeg) en "Deze week" — en samen overdonderden ze precies de nieuwe speler die ze moesten helpen. Wie in die stortvloed iets miste, het lidgeld bijvoorbeeld, werd daar stilletjes voor gestraft zonder ooit te horen dat het bestond.

**Nu is er één rondleiding, in zes hoofdstukken die elk één thema bundelen**: eerst je ploeg (basiself, spelplan, kapitein), dan de markt, dan je mensen (personeel, taken, opleiding), dan het geld (tickets, abonnementen, lidgeld én sponsors), dan de clubzaken (winkel, kantine, evenementen), en tot slot vooruitkijken (doelen, bouwplannen, "wat beïnvloedt wat"). Je springt dus nooit meer van je opstelling naar je ticketprijs en weer terug. Het blok woont rustig onderin de weekkaart, onder een stippellijn: gedempte kleuren, geen amber, en het telt níet mee in "wat op je wacht" — hulp, geen huiswerk.

**Het tempo regelt zichzelf.** Eén hoofdstuk tegelijk; is alles af, dan ligt er de week erna een nieuw hoofdstuk. Blijft het liggen, dan schuift het na drie weken vanzelf zachtjes door — niets doen kost je niets. Stappen vinken af op wat er echt in het spel gebeurde (wie al een kapitein had, is die stap gewoon kwijt), en kijk-stappen — "bekijk je prijzenscherm" — vinken af zodra je er geweest bent. Wie het spel al kent, klikt "Ik ken het spel al" en is er definitief vanaf (met bevestigingspopup). Oude opslagbestanden krijgen de rondleiding via een echte migratie: wie al diep in het spel zit, krijgt hem verborgen.

Negen nieuwe motortests voor het tempo (757 in totaal), en in de draaiende app nagespeeld: hoofdstuk 1 met drie ploegstappen bij een vers spel, na vier weken nietsdoen hoofdstuk 2, de kijk-registratie, en verbergen dat na annuleren blijft en na bevestigen weg is.

### 0.60.0 — De kopbalk is minder kaal

**Netjes, rustig, minimalistisch — maar nét te kaal.** Twee toevoegingen die allebei iets zeggen in plaats van alleen maar versieren. Achter je clublogo ligt nu een vleug clubkleur die naar rechts wegloopt (zeven procent, via `color-mix` op de bijgetrokken clubkleur — warmte, geen behang). En tussen Klassement en Volgende match staat een nieuw blokje **Vorm**: je laatste vijf uitslagen als stippen, oudste links — groen gewonnen, grijs gelijk, rood verloren, en holle stippen voor wedstrijden die nog moeten komen. Het rijtje dat elke voetbalapp toont, want het is het verhaal áchter je plaats in het klassement. De tooltip vertelt elke uitslag voluit ("winst 3-1 thuis tegen SC Wielbeke"), en klikken brengt je naar de stand. In de draaiende app gecontroleerd: vijf holle stippen bij de start, na tien weken ●●◐ met twee keer winst en één verlies — kloppend met de gespeelde wedstrijden.

### 0.59.0 — De werklijst-pil valt nu echt op

**"2 dingen wachten op jou" is de nuttigste knop van de speelbalk — en de onzichtbaarste.** Hij stond in dezelfde zachte accentkleur als de rest van de balk en viel volledig weg naast de grote groene weekknop. De pil draagt nu het aandacht-palet: amber, met het aantal in een echte gekleurde badge, en een rand die hem van de achtergrond tilt. Zit er iets dringends tussen (te weinig speelklare spelers, een deadline die vandaag valt), dan kleurt het geheel rood. Rond de badge klopt een trage polsslag — elke 2,8 seconden één zachte ring — die het oog trekt zonder te irriteren, en een pijltje maakt duidelijk dat de pil ergens heen gaat. Wie verminderde beweging instelde, krijgt geen polsslag. Voor en na met Playwright-schermafdrukken vergeleken, in beide staten.

### 0.58.0 — Kleine successen worden echt gevierd

**Een speler die tekent, een sponsor die verlengt, een nieuw personeelslid: dat was een grijze regel, en dat voelt niet als winnen.** Directe successen — een contract verlengen, een speler of huurling binnenhalen, een sponsorvoorstel tekenen of tegen jouw prijs verlengen, personeel aanwerven of vervangen — krijgen nu een feesttoast: de melding kleurt in de clubkleur, met een groot icoon, de naam als kop en het bedrag eronder, en een seconde confettisnippers (goud, wit en de clubkleur — puur CSS). De motor geeft dat door via een optioneel `viering`-veld op het bestaande `ActionResult`; schermen die er niets mee doen, merken er niets van.

**Successen die vanzelf gebeurden, vieren mee in het weekrapport.** Een diploma of afgeronde opleiding, een opgeleverd bouwproject, een sponsor die je commerciële man binnenhaalde, een extra bijdrage, doorstromers uit de eigen jeugd: dat nieuws draagt nu de soort `viering` en verschijnt in het weekrapport als gouden kaartjes onder een kop "🎉 Om te vieren" — ná de rollende cijfers, één voor één oppoppend, en maximaal drie (bij meer viert niemand nog iets; de rest blijft gewoon nieuws). In de nieuwsstroom op je bureau staan ze gewoon tussen de rest.

**En de knoppen om aan nieuwe sponsornamen te raken staan nu bovenaan.** "Netwerkavond" en "Sponsorbureau" stonden onder de contactentabel: wie een lange lijst had zag ze pas na scrollen, en wie een lege lijst had zocht ze net. Ze staan nu direct onder de kop "Nieuwe namen vinden", bovenaan de Contacten-kaart.

Wie animaties uitzette bij Opslaan krijgt dezelfde kaarten, zonder confetti en zonder pop-in. In de draaiende app nagespeeld: sponsorvoorstel tekenen gaf de feesttoast met 14 snippers, en na een opleiding van 20 weken stond "🎓 Nathalie Vandewalle behaalde het diploma EUFA A." als gouden kaartje in het rapport terwijl de nieuwslijst "Rustige week" toonde.

### 0.57.0 — Ingrijpende knoppen vragen een tweede klik

**"Stopzetten" stond er even onschuldig bij als "Sluiten", en dat klopt niet.** Een sponsorcontract stopzetten, een personeelslid ontslaan, een speler wegsturen of verkopen, een huur beëindigen — dat zijn definitieve beslissingen met een grote impact, en één misklik was genoeg. Die knoppen kleuren nu rood, hun uitleg begint met "Ingrijpend:" en benoemt de gevolgen (wat het kost, wat er wegvalt, dat het definitief is).

**En ze vragen een bevestiging.** De eerste versie hiervan (0.57.0) wapende de knop voor een tweede klik — hetzelfde patroon als "nieuw spel" — maar dat bleek niet het patroon dat mensen kennen, en een bevestiging die je moet leren is geen bevestiging. Sinds 0.57.2 opent zo'n knop een kleine popup: de vraag mét naam en bedrag als kop ("Contract met Brouwerij Het Anker-Ei stopzetten?"), de gevolgen eronder, en Annuleren naast de rode actieknop. Escape of ernaast klikken annuleert ook. In de draaiende app nagespeeld: openen en annuleren verandert niets (14 sponsors), bevestigen voert uit (13).

### 0.56.0 — De wedstrijd duurt vijf tellen, met klok, rust en wissels

**De tijdlijn van 0.54.0 kreeg lucht.** Drie seconden was te gejaagd en het kader te krap; het is nu vijf seconden in een ruimer kader (600 in plaats van 420 pixels), en een week zónder wedstrijd houdt de korte animatie — die hoeft niet langer te duren.

**Er loopt nu een echte wedstrijdklok** (`ANIM_T` in `report.ts`, aangedreven vanuit `main.ts` zodat een hertekening de klok niet terugzet): ze telt de eerste helft naar 45, valt stil op **"Rust"** — dat ook als gebeurtenis in de tijdlijn staat, mét ruststand — telt dan door naar 90, en toont bij het affluiten de uitslag. In de draaiende app gemeten: 22' → Rust → 71' → "2 - 0".

**En er wordt gewisseld, aan beide kanten.** Jouw wissels komen van je echte bank (fitte, niet-geschorste spelers die niet in de basis stonden), die van de tegenstander uit hun eigen kern — allemaal bestaande namen. Eerlijk erbij gezegd, in de code én hier: dit is vertelling. Een echt wisselsysteem, met bankspelers die minuten maken en er iets aan overhouden, staat op de planning; tot dan hebben deze wissels geen enkel spelgevolg. De minuten komen uit dezelfde aparte toevalsbron als de rest van de tijdlijn, dus opgeslagen spellen spelen exact hetzelfde verder.

### 0.55.0 — Het sponsorscherm in de vorm van het personeelsscherm

**Zelfde denkstructuur, zelfde vorm.** Het personeelsscherm van 0.53.0 beviel — links wat je hebt, rechts wat je kunt halen, acties compact — dus het sponsorscherm volgt nu dezelfde opbouw: de prijskaart vol breed bovenaan (dat is én je instrument én je filter), daaronder links "Huidige sponsors" en rechts "Op tafel", "Contacten" en "Nieuwe namen vinden". De tabellen zijn compacter gemaakt (type bij de naam, budget en vrije plaats bij het bedrijf), en het scherm ging van 2.596 naar 2.230 pixels.

**En de tegels staan eindelijk strak.** Elke sponsortegel heeft nu vier vaste zones — kop (twee regels gereserveerd), invoerveld, oordeel, notitie — die er ook staan als ze leeg zijn. Vroeger hing elke tegel op zijn eigen hoogte, afhankelijk van wat er toevallig in stond ("te goedkoop" plus "terug naar €915" tegenover alleen "volgt de markt"), en oogde de rij scheef en slordig. Nu staan alle invoervelden op één lijn, alle oordelen op één lijn en alle notities op één lijn — ook bij plaatsen die nog op slot staan. Met Playwright-schermafdrukken gecontroleerd.

### 0.54.0 — Het weekrapport bouwt spanning op in plaats van ze te verklappen

**Boven het weekrapport stond een rij kaartjes met het resultaat en de uitslag — de hele week samengevat vóór het rapport ook maar iets kon vertellen.** De rollende cijfers en het scorebord zijn anticipatiemechanismen, maar je zat ze meteen door dat label bovenaan. De kaartjes zijn weg (alles wat erin stond heeft hieronder al zijn eigen blok), en de hele onthulling volgt nu één spanningsboog:

1. **De wedstrijd als tijdlijn** (animatie, ≤3 seconden): elk doelpunt van beide kanten verschijnt op het moment in de wedstrijd waarop het viel — de 12de minuut vroeg, de 88ste laat — met de tussenstand erbij, en de eigen doelpuntenmaker in het vet. Pas daarna klinkt het affluiten met de uitslag. Klikken slaat over, zoals altijd.
2. **De cijfers rollen binnen** (rapport, ~1,5 seconde): binnengekomen en uitgegeven tellen post per post naar hun eindbedrag.
3. **Daarna pas de nieuwsflitsen**, regel per regel — die begonnen vroeger tegelijk met de cijfers.

De motor levert de tijdlijn (`moments` op `lastMatch` in `turn.ts`): jouw doelpuntenmakers hadden al minuten, die van de tegenstander komen uit een **eigen toevalsbron met een vaste seed** — de hoofdstroom van het toeval blijft onaangeroerd, dus een opgeslagen spel speelt exact hetzelfde verder (vastgelegd in `test/weekrapport.test.ts`). Gecontroleerd in de echt draaiende app: ticker in beeld, geen kaartjes meer in het rapport, en op de schermafdruk halverwege staan de uitgaven nog op €0 terwijl de inkomsten al tellen.

### 0.53.0 — Personeel en Sponsors: klikken om te filteren, half zoveel scrollen

**Het personeelsscherm was bijna vijfduizend pixels onder elkaar**: wie heb je, wie doet wat, wie kun je halen. Maar "wie heb je" en "wie kun je halen" zijn één gedachte — je kijkt naar een lege of zwakke functie en wilt meteen zien wie ervoor te vinden is. Die twee staan nu **naast elkaar**, en de takenlijst (delegeren: een andere denkbui) staat eronder over de volle breedte.

**Klikken is filteren, op beide schermen dezelfde taal.** Klik op een functie in je personeelslijst en de kandidaten ernaast filteren op die rol; klik op een tegel van je sponsorprijskaart en je sponsors én je contacten filteren op die plaats (contacten op de plaats die ze écht zouden krijgen, uit dezelfde functie die hun kans berekent). De actieve keuze licht op met een bolletje, bij de gefilterde lijst staat een chip met een kruisje, en nogmaals klikken haalt de filter ook weg. De teller zegt wat je ziet: "2 van 31", "10 van 15".

**Zonder filter is de kandidatenlijst een overzicht**: de beste kandidaat per functie (dertien rijen) in plaats van de hele lichting (eenendertig). De volledige lichting zit één klik ver, per functie. Gemeten met Playwright op 1440 breed: het personeelsscherm ging van **4.778 naar 2.878 pixels**, en met een filter actief naar 1.980 — meer dan de helft minder scrollen, zonder dat er informatie verdween.

### 0.52.0 — Je ziet vooraf wat vrij is

**Twee schermen lieten je raden welke plaatsen nog vrij waren, en dat is de omgekeerde wereld.** Op Sponsors stond de bezetting als voetnootje van elf pixels onder het invoerveld ("9 van 16 bezet" — een rekensommetje dat niemand zag; het werd gemeld als "staat er niet meer", terwijl het er stond). En op Personeel kon je in de kandidatenlijst op "Aanwerven" klikken om pas dáárna te horen dat je die functie al ingevuld had.

- **Sponsortegels zeggen het antwoord**: een badge in de kop met "nog 6 vrij", "vol" (groen) of "op slot" — het exacte aantal staat in de uitleg. Visueel gecontroleerd met een Playwright-schermafdruk vóór en na.
- **Elke personeelskandidaat draagt zijn status**: "functie vrij", "bezet: Sofie Witsel-Maes (50)" of "🔒 op slot", vóór je iets aanklikt.
- **Een bezette functie heeft een eerlijke knop**: "Vervang Sofie (€3.580)" — `replaceStaff` regelt opzegvergoeding plus tekengeld in één beslissing, en de taken van wie vertrekt gaan mee naar zijn opvolger (voor zover die ze aankan). De aanwerf-knop bestaat alleen nog waar hij kan; de foutmelding "je hebt al iemand" kun je niet meer tegenkomen.

### 0.51.0 — Stilstaan heeft gevolgen

Laag 18 sloot de reeksladder, maar de eindmeting toonde twee nieuwe evenwichten die niet klopten. **Degradatie was een doodvonnis geworden**: de sponsorbedragen zakten mee naar de nieuwe reeks (−30 à −40% inkomsten) maar de lonen bleven op −10% hangen — "uitbesteden aan je bestaande staf" schoot daardoor van ~23% naar 60% faillissementen. En er stond een **eeuwige kampioen**: de club die elk jaar 3de Nationale wint, elk jaar de licentie geweigerd ziet, en wier sterren braaf blijven zitten tegen een stilstaande reeks — 10 à 16 punten boven het reeksgemiddelde, seizoen na seizoen, met €600.000 winst per jaar. Drie ingrepen, samen één antwoord: stilstaan — vallen, of blijven hangen — heeft gevolgen.

- **De degradatieschok is symmetrisch en progressief** (`relegationShake` in `turn.ts`). Wie blijft, levert in richting de lat van de nieuwe reeks; wie duidelijk boven die lat verdient, kan vertrekken — en hoe hoger de reeks die je verlaat, hoe meer er bewegen (van ~6% onderaan tot 60% uit de Pro Liga: die spelers hebben elders opties). Eigen jeugd en huurlingen blijven erbuiten, en de kern zakt nooit onder de ondergrens. Uit 2de Nationale vallen kost je dus vooral loonbudget en één vertrekker; uit de top vallen breekt je ploeg — precies het verschil dat het hoort te zijn.
- **Wie boven zijn club is uitgegroeid, wil hogerop** (`wantsAway` in `appeal.ts` — de spiegel van de spelerswil bij het komen). Hij verlengt niet, tegen geen enkel loon; zijn makelaar belt rond (driemaal zoveel biedingen); zijn moraal zakt zolang hij vastzit; en een geweigerde licentie is voor hem een breekpunt. Op Contracten staat het kaartje "wil hogerop" met de uitleg. De eeuwige kampioen verliest zo elk seizoen zijn top: verkopen nu het geld waard is, of de club worden die bij hem past.
- **De reeks vecht terug** (`runWorldSeason` in `world.ts`). Blijft dezelfde club bovenaan hangen zonder te stijgen, dan verhogen alle rivalen hun ambitie (+10) en komt er budget vrij: zij kopen sterspelers, de reeks kruipt naar je toe. Gemeten: de sterkte-voorsprong van de gestrande kampioen daalt nu na seizoen vier (+11,6 → +8,4) in plaats van door te groeien naar +16, en het reeksgemiddelde stijgt zichtbaar mee.

Wat er bewust níet in zit: een straf op onbemande taken. Niet delegeren betekent dat de eigenaar het zelf doet — eigen tijd en aandacht van de speler mag het spel nooit afstraffen.

### 0.50.0 — Knoppen die de goede kant op wijzen

De doorlichting vond een rij knoppen die dood stonden of de verkeerde kant op wezen, met als hoofdoorzaak één clamp: 99% van de thuiswedstrijden van een klimmende club was uitverkocht, en dan doet álles wat de opkomst vermenigvuldigt niets meer. Deze laag zet ze recht:

- **Parking en tribune zijn verbonden** (`parkingSupport` in `finance.ts`). Wie te voet of met de fiets komt plus de parking bepaalt wat je bereikbaarheid aankan; daarboven komt van de rest maar 60% opdagen en zakt de sfeer — mensen parkeren één keer in het dorp, daarna blijven ze thuis. Geen harde lijn, wel een zachte rem: een tribune van 2.000 met een dorpsparking raakt nooit vol. Voor een dorpsclub onder de 600 verandert er niets.
- **Uitverkocht is zichtbaar.** Je leest in het nieuws hoeveel volk er niet binnen geraakte en of de tribune dan wel de parking het eerst volliep — het geld dat je laat liggen, met de reden erbij.
- **Onderhoud raakt nu iets dat niet achter de volle tribune verstopt zit.** Basisonderhoud drukt de sponsortevredenheid (−6 op hun evenwicht: een bord langs een verwaarloosd veld is een slecht uithangbord) en verhoogt het blessurerisico met 8%; premium doet het omgekeerde. Gemeten stond basis vóór deze laag op +€279 à +€340 per week zonder enig nadeel dat aankwam.
- **De reeksnorm voor supporters is een plafond, geen roltrap** — de automatische kruip ernaartoe is meer dan gehalveerd; resultaten, sfeer en een fandag doen het werk. Daarmee is de fandag (opbrengst/kost 0,5, maar +4% supporters) eindelijk een echte koop.
- **Een scout zonder budget zegt het zelf.** Het transferbudget start op nul en niemand zei het; "transfers uitbesteed" deed dan stilletjes bijna niets.
- **Opgeruimd:** de defect-kansfunctie die door niets gebruikt werd (het echte risico loopt via het content-event) is weg — één waarheid.

### 0.49.0 — Inflatie geldt voor iedereen

**Het principe was "alles wordt elk seizoen 7% duurder", maar het gold maar voor een kwart van de geldstromen.** Onderhoud, bond en bouw volgden de inflatie; de grootste inkomstenpost (sponsors) en de grootste kostenpost (lonen) stonden er als enige buiten. Zo kon het prijspeil verhoudingen stilletjes verschuiven — hetzelfde soort scheefgroei als 0.42.0, maar dan over de tijd in plaats van over de reeksen.

Nu volgen **sponsorbedragen** (`kindRange`), **spelerslonen** (`wageDemand`), **staflonen** (`staffWage`), **tv-rechten, premies en subsidies** het prijspeil, aan beide kanten van de boekhouding tegelijk. Lopende contracten blijven nominaal staan tot ze vernieuwd worden — ook dat is echt: wie lang niet heronderhandelt, ziet zijn loon achterop raken en de loononrust van 0.45.0 doet de rest. Ticket-, kantine- en winkelprijzen blijven bewust vraaggestuurd: dat zijn prijzen die jíj zet tegen een vraagcurve, geen contracten; hun referenties meesleuren zou alleen de schuifbalk verschuiven. Aan het begin van een carrière (inflatie 1) verandert er niets, en `test/inflatie.test.ts` legt de indexering vast.

### 0.48.0 — De bond en je sponsors reageren op stijgen en zakken

**De licentie was een papieren grens.** De doorlichting mat een club die seizoenen lang 1ste Nationale speelde met vijfhonderd plaatsen en verlichting niveau 1; de boete (`problemen × €2.500 × waarschuwingen`) haalde de top tien van haar boekhouding niet. Nu is de licentie wat ze hoort te zijn: **zonder licentie voor de hogere reeks gaat een promotie niet door.** Word je kampioen zonder de accommodatie, de trainer of de afgevaardigde die de nieuwe reeks vraagt, dan hou je de eer en de premie — en blijf je waar je bent. De jaarlijkse audit en de promotieweigering rekenen met exact dezelfde lijst (`licenceProblems` in `turn.ts`), en wie in week 30 of 41 op een promotieplaats staat zonder licentie, leest in het nieuws precies wat er nog ontbreekt. Bouwen is daarmee een verplicht deel van klimmen — elke trede heeft nu een kostenkant die je niet kunt overslaan.

**En de sponsorklap werkt eindelijk twee kanten op.** Bij promotie boden sponsors spontaan meer; bij degradatie bleven hun bedragen gewoon staan, en zo kon een degradatieseizoen €981.000 winst draaien (gemeten, seed 5 van de loonlat-meting). Nu herzien ze hun bijdrage naar het prijspeil van de nieuwe reeks — behalve wie voor méérdere seizoenen tekende: die betaalt gewoon door. Daarmee is de looptijdkeuze bij een sponsorcontract voor het eerst een echte afweging: kort tekenen pakt de promotiesprong mee, lang tekenen is je verzekering tegen de val. Precies wat de doorlichting als "bijna dode knop" aanwees.

Het effect op de open knoop is meteen zichtbaar in de evenementen-meting hieronder: de uitbestedende club die nooit bouwt, raakt 3de Nationale niet meer uit.

### 0.47.0 — Een zaal heeft muren

**Evenementen waren de nieuwe gratis-geld-machine.** De doorlichting mat netto €21.630 per seizoen in 3de Nationale en **€714.410 in de Challenger Pro Liga**, uit dezelfde tien avonden per seizoen, met opbrengst/kost-verhoudingen tot 28,6×. De oorzaak was de fout van 0.42.0 in een nieuw jasje: de opbrengst hing rechtstreeks aan je sponsorportefeuille en je supportersnorm — allebei reeks-geïndexeerd — terwijl de kost alleen inflatie plus 12% per reeks droeg. Een lunch voor twaalf bedrijven "bracht" €178.000 op.

De opbrengst is nu **gasten × wat een gast uitgeeft**, en de gasten zijn overal begrensd door iets fysieks: de zaal van je kantine (quiz, spaghetti, galabal), je tribune (oefenmatch, wintercup), je aanhang (mosselfeest, fandag) of het aantal bedrijven aan tafel (sponsorontbijt, businessclub). Alleen het bedrag per gast stijgt met je niveau — `eventPrestige`: ×1 in 3de Nationale tot ×3,1 in de Pro Liga — en met het prijspeil. Een galadiner in de top brengt per couvert dus nog altijd een veelvoud op van een spaghetti-avond in 2de Nationale, maar de zaal wordt er niet groter van.

Gemeten na de ingreep: dezelfde club zit tussen €29.000 (3de Nationale) en €136.000 (2de Nationale, voor de licentielaag erbij kwam) netto per seizoen, met verhoudingen tussen 0,5 (de fandag, die koopt supporters en geen geld) en 7,6. `test/evenementen.test.ts` legt vast dat de zaal het plafond is, dat prestige begrensd blijft, en dat geen enkel evenement nog boven de 8× uitkomt.

### 0.46.0 — De speler beslist mee

**Geld was het enige criterium: wie het bedrag had, kreeg elke handtekening.** Een sterspeler tekende even vlot bij een hekkensluiter met een veldje van vijfhonderd plaatsen als bij een kampioen met een opleidingscentrum. Dat is de omgekeerde wereld, en het was ook een gat in de balans: niets dwong een club met veel geld om eerst een club te wórden waar zulke spelers willen spelen.

Nu weegt de speler jouw club, zoals een bedrijf bij de sponsors jouw vraagprijs weegt (`clubAppeal` en `transferWillingness` in `appeal.ts`): in welke reeks speel je en waar sta je, klopt je accommodatie met het niveau, wie is de trainer, en welk niveau haalt de kleedkamer waar hij in stapt. Samen schuiven die de aantrekkingskracht een punt of tien op tegenover de reeks als basis.

- **Tot twee punten boven jouw niveau tekent iedereen gewoon.** Een club haalt vaker wel dan niet spelers die nét beter zijn, en de noodaankoop onder de achttien-grens kan dus nooit vastlopen.
- **Daarboven zakt de kans per punt.** Op Transfers staat de kolom "Wil hij komen?" — komt graag, staat ervoor open, twijfelt, ziet het amper zitten — met in de tooltip het echte percentage, uit dezelfde functie die zijn antwoord bepaalt. Zegt hij nee, dan kiest hij voor een andere club en verdwijnt hij van je lijst.
- **Wie boven jouw niveau tóch tekent, laat zich de stap betalen:** zes procent loon extra per punt boven de grens. Een grote naam naar een kleine club halen kán, maar het is duur — zoals het hoort.
- **Een huurling rekent anders.** Hij komt een seizoen spelen, niet carrière maken: zijn ambitie telt niet mee en hij aanvaardt een flinke stap omlaag. Alleen een club die er binnen haar eigen reeks niets van bakt, of een wel heel groot talent, krijgt nee te horen. Een jonge koopspeler kijkt wél naar wat hij kan worden: een achttienjarige met potentieel zeventig zoekt geen dorpsclub uit, ook al staat zijn kwaliteit vandaag op vijftig.

Voor de klimmende club is dit de tweede poort op elke trede: wie promoveert met een accommodatie en een kleedkamer die achterblijven, ziet de spelers die hij nodig heeft "twijfelen" — en betaalt de premie, of bouwt eerst.

**De doorlichting van september 2026 vond de motor achter "promoveren is gratis geld", en hij zat niet waar HANDOVER.md hem zocht.** Niet (alleen) in de tegenstand die van 52 naar 70 loopt, maar in twee lekken in de loonlat van 0.42.0. Gemeten met `scripts/doorlichting-loonlat.ts` (5 seeds × 6 seizoenen, beste betaalbare staf en alles uitbesteed): tegen seizoen zes bestond de kern voor 60% uit eigen jeugd aan €40 per week, betaalde de club 60 à 80% van wat haar reeks vraagt, en stond ze structureel 4 à 7 punten boven het reeksgemiddelde — zonder één euro transferbudget.

- **De eigen jeugd was reeks-geïndexeerd.** Een doorstromer kreeg kwaliteit "reeksniveau − 12": elke promotie maakte je gratis aanvoer vanzelf beter. De kwaliteit hangt nu aan je jeugdwérking — coördinator, opleidingscentrum, ledenaantal (`youthIntakeQuality` in `youth.ts`). IJkpunt: een startclub in 3de Nationale blijft op ~46, dus aan het begin van een carrière verandert er niets. Het plafond van een topwerking ligt rond 1ste Nationale; wie hoger wil, koopt aan de lat.
- **Zittende contracten kregen +14% per promotie terwijl de lat +45 à +62% per trede stijgt.** Eén promotie verteert een kleedkamer (14% extra blijft boven driekwart van de nieuwe lat); wie twee tredes klimt zonder één contract open te breken, betaalt onder de zestig procent van het niveau — en dat pikken ze niet meer (`wagePressure` in `players.ts`). Hun moraal-evenwicht zakt tot je bijbetaalt, in het nieuws heet dat loononrust, en wie ontevreden blijft, weigert te verlengen en vertrekt gratis. Eigen jeugd tot en met negentien en huurlingen vallen erbuiten: een leercontract hoort goedkoop te zijn, en het loon van een huurling is een afspraak tussen clubs.

**Gemeten na de ingreep** (zelfde meting): de loonlast klimt naar 104% van de lat in seizoen zes, de sterkte-voorsprong op de reeks krimpt (seizoen vijf: van +5,5 naar −1,7), en voor het eerst blijft een club ook eens vier seizoenen in dezelfde reeks hangen. **Wat het nog niet oplevert, en dat hoort erbij:** de autopilot gaat nog altijd 0 op 48 failliet. De club klimt trager, maar elke reeks blijft winstgevend zolang de evenementen-economie (netto €714.000 per seizoen in de Challenger Pro Liga) en de papieren licentie er staan. Die volgen in de volgende lagen — bewust één oorzaak per laag, zodat elke meting zegt wát er werkte.

## Laag 17

### 0.44.0 — De log is een log, geen spelfeature

**De vorige laag deed het half goed.** Er kwam een echte logmodule met een bestand en een terminal, maar het oude kader bleef ook gewoon staan: "Wat je personeel besliste", op het scherm Personeel, met een uitleg in gewone taal bij elke beslissing, en dezelfde regels in de console van je browser. Dat was een breindump vermomd als logging. Een log is voor wie de code nakijkt, niet voor wie het spel speelt. Alles wat in de richting van de speler wees, is eruit:

- het kader op het scherm Personeel
- de regels in je browserconsole
- `src/log/browser.ts` en het ontvangststuk in `vite.config.ts`
- `state.reasoning` uit de opgeslagen stand — met een migratie die het uit bestaande spellen haalt

**Wat ervoor in de plaats komt.** Dezelfde berekening, maar als waarden in plaats van als verhaal:

```
2026-09-24T09:04:08.912Z debug [delegatie.horeca] canteen price set
    season: 1
    week: 1
    staff: s82
    item: pils
    eff: 0.582
    support: 0.855
    visitors: 494
    ref: 2.5
    cost: 0.75
    baseline: 706.1
    optimum: {"price":4.5,"value":747.4}
    picked: 3
    from: 2.5
    to: 2.9
```

Daar staat alles in wat je nodig hebt om na te rekenen of de motor doet wat hij belooft: waar hij van vertrok (`baseline`, de richtprijs), wat het meetbare optimum was, met welke efficiëntie hij werkte, wat hij koos en wat er uiteindelijk stond. Zonder een woord uitleg, want die hoort in de code en in dit bestand, niet in elke logregel.

De scopes zijn `delegatie.<taak>`, dus `grep 'delegatie.training' logs/*.log` geeft je één taak over een heel seizoen. De wekelijkse doorlichting staat onder `delegatie.scan`.

**Alles loopt op `debug`, en dat is de veilige stand.** Zonder aangehaakte bestemming doet loggen niets — er wordt niet eens een record gemaakt. Een testronde of een meting van zes seizoenen is dus even snel als daarvoor, tenzij je er expliciet om vraagt:

| wat je doet | waar je regels komen |
|---|---|
| `VCG_LOG=debug npx mocha` | `logs/test.log` en de terminal |
| `VCG_LOG=debug npm run autopilot` | `logs/autopilot.log` en de terminal |
| `VCG_LOG=debug npm run economie` | `logs/economie.log` en de terminal |
| `npm run dev` en spelen | niets — de motor draait dan in je browser, en die heeft geen bestandssysteem |

Die laatste regel is de prijs van deze keuze, en hij is bewust betaald: browserspel levert geen logbestand meer op. Wil je dat later terug, dan hoort het via een echte server te lopen, niet via een kader in het spel.

### 0.43.0 — Een echt logboek: naar een bestand en naar de terminal

**Wat er vorige laag stond, was geen log.** Ik had "logging toevoegen aan de code base" gelezen als "laat zien wat het brein uitrekent", en dat is ook gebeurd: elke beslissing komt met haar stappen op het scherm Personeel. Maar het ging verder alleen naar `console.debug`, en dat is geen logbestand. Je kunt er niet in grepen, je houdt er na het sluiten van je tabblad niets van over, en je kunt het later niet naar een server sturen. Dat is nu rechtgezet.

**Waarom het niet gewoon winston is.** Winston is een Node-bibliotheek en kan geen bestand schrijven vanuit een browser — de motor van dit spel draait in je browser, dus daar kan winston niet eens geladen worden. De enige vorm die allebei aankan is deze:

```
  src/log/logger.ts    de kern: niveaus, regels, bestemmingen. Weet niet waar hij draait.
  src/log/node.ts      bestemming: logs/voetbalclub.log + de terminal (node:fs)
  src/log/browser.ts   bestemming: de console van je browser + doorsturen naar de server
  vite.config.ts       het ontvangststuk: zet doorgestuurde regels in hetzelfde bestand
```

De motor roept `logInfo('brein', ...)` aan en weet verder van niets. Waar die regel terechtkomt, beslist degene die het spel opstart. Zonder aangehaakte bestemming doet loggen niets — dat is de veilige stand, zodat een testronde er niet trager van wordt.

De niveaus en de vorm van een regel zijn met opzet dezelfde als die van winston: `error`, `warn`, `info`, `debug`. Wil je later echt winston op de server, dan schrijf je één bestemming van vijftien regels die het record doorgeeft aan `winston.log()`, en verandert er in de motor niets. Er staat nu geen enkele afhankelijkheid tegenover.

**Hoe je eraan komt.**

| wat je doet | waar je regels komen |
|---|---|
| `npm run dev` en spelen | `logs/voetbalclub.log`, de terminal van de server, en de console van je browser |
| `VCG_LOG=debug npx mocha` | `logs/test.log` en de terminal |
| `VCG_LOG=debug npm run balance` | `logs/balance.log` en de terminal |
| een gebouwde versie op GitHub Pages | alleen de console — daar staat geen server om het naartoe te sturen |

Zonder `VCG_LOG` schrijft een testronde niets weg. Een meting van zes seizoenen maakt duizenden regels, en dat hoef je meestal niet.

Zo ziet een regel eruit:

```
2026-09-24T08:49:11.126Z info  [brein] [1-01] Bart Onanna · Prijs pils: €2.50 → €2.90
    taak: horeca
    efficientie: 58%
    gewijzigd: true
    stappen:
      - Richtprijs is €2.50, inkoop €0.75, gerekend op 494 bezoekers.
      - Bij de richtprijs levert dit artikel €706 op.
      - De beste prijs zou €4.50 zijn, goed voor €747.
      - Met 58% efficiëntie mikt hij op €3.00.
      - Hij schat het niet tot op de cent en zet uiteindelijk €2.90.
```

De kopregel staat op één lijn, zodat `grep brein logs/voetbalclub.log` je alleen de beslissingen geeft; de uitleg staat eronder met inspringing.

**En de log betrapte zichzelf op een leugen.** In dat voorbeeld hierboven stond eerst "komt hij uit op €3.00" terwijl de kop €2.90 zei. Dat verschil is de misgreep van een medewerker die het niet tot op de cent schat — de bedoeling van het spel — maar de log beweerde het ene en deed het andere. Nu staat er waar hij op mikte én wat hij uiteindelijk zette. Hetzelfde stond bij de ticketprijs.

### 0.42.0 — Een reeks hoger spelen kost ook meer

**Je economie liep op één been.** Ik ging op zoek naar de reden waarom "de beste betaalbare staf aanwerven en alles uitbesteden" nooit failliet gaat, en ik verwachtte die bij het personeel te vinden. Ze zat ergens anders. Dit is de boekhouding van één club over zes seizoenen, met vier aangeworven personeelsleden en alles uitbesteed:

| seizoen | reeks | inkomsten | kosten | sponsors | lonen |
|---|---|---:|---:|---:|---:|
| 1 | 3de Nationale | €648k | €449k | €250k | €234k |
| 3 | 1ste Nationale | €1,41M | €570k | €715k | €311k |
| 6 | Challenger Pro Liga | €3,97M | €933k | €2,14M | €589k |

De omzet ging zes keer omhoog, de kosten twee keer. Dat is geen toeval maar een gat in de cijfers: **op de inkomstenkant was álles geïndexeerd op je reeks** — sponsorbedragen gaan met factor 0,6 naar 8 over de zes reeksen, tv-geld van niets naar €30.000 per week, het normale publiek van 250 naar 10.000 — **en op de kostenkant stond niets**. Het onderhoud hing aan je eigen gebouwen, en het loon van een speler hing alleen aan hoe goed hij was: `170 × 1,08^(kwaliteit − 52)`, of je nu in 1ste Provinciale of in de Pro Liga speelde. Je kon dus met een dorpsploeg naar de Challenger Pro Liga klimmen en daar profgeld opstrijken aan dorpslonen. Elke promotie was gratis geld.

**Wat er nu gebeurt.** Elke reeks heeft er twee cijfers bij: een loonlat en een weekkost.

| reeks | loonlat | bond, scheidsrechters, verplaatsingen |
|---|---:|---:|
| 1ste Provinciale | 0,7× | €120/week |
| 3de Nationale | **1×** | €260/week |
| 2de Nationale | 1,45× | €520/week |
| 1ste Nationale | 2,2× | €1.100/week |
| Challenger Pro Liga | 3,6× | €3.200/week |
| Pro Liga | 6,5× | €9.000/week |

3de Nationale staat op één: aan het begin van een carrière verandert er dus niets aan wat je betaalt. De rest schuift mee.

**Bestaande contracten blijven staan.** De nieuwe lat geldt voor wie je haalt en voor wie bijtekent, niet voor wie al getekend heeft. Dat is bewust: anders springt je loonlast omhoog in de week van je promotie, op een moment dat je er nog niets aan kunt doen, en dat voelt als een straf in plaats van als een keuze. Nu krijg je eerst de weekkost van je nieuwe reeks — die komt meteen — en pas daarna, contract per contract, de rekening voor je ploeg.

**Wat het oplevert.** Bij dezelfde club stijgen de kosten in seizoen 6 van €933k naar €1,89M, waarvan €1,31M lonen. Een club die niets doet, gaat nu rond seizoen vier failliet in plaats van seizoen zes.

**Wat het niet oplevert, en dat hoor je te weten.** "De beste betaalbare staf aanwerven en alles uitbesteden" gaat nog altijd nooit failliet: nul op acht, in alle zes de combinaties van club en investeerder. Die club eindigt nu op €6,6M in plaats van €8,2M, maar ze eindigt in de plus. De reden is dat ze met een goedkope ploeg blíjft winnen — de tegenstand loopt van sterkte 52 in 3de Nationale naar 70 in de Challenger Pro Liga, en dat is te weinig om een goedkope kern tegen te houden. Dat laatste cijfer is precies de knop die je me twee vragen geleden de ándere kant op liet draaien ("maak het iets makkelijker om te winnen"). Daar zit een echte spanning tussen twee dingen die je allebei gevraagd hebt, en die hoort thuis in het gesprek over de moeilijkheidsgraad.

### 0.41.0 — Achttien spelers, en personeel dat elke week rondkijkt

**De ondergrens gaat van zestien naar achttien, en het ventiel gaat dicht.** Vorige versie zette een harde ondergrens op zestien spelers en gaf daar een uitweg bij: met een te kleine kern mocht je ook buiten de transferperiode transfervrije spelers halen, want anders zou je vastzitten. Dat ventiel was niet nodig, en de reden waarom is de moeite waard om op te schrijven.

Mijn redenering was: je kunt onder de grens zakken zonder dat je het wilt — een speler raakt geblesseerd, een contract loopt af — en buiten de transferperiode kun je er niemand bij halen, dus dan staat het spel stil. De eerste helft klopte niet. Verkopen kan alleen tijdens de transferperiode, uitlenen ook. De enige manier om buiten die periode spelers kwijt te raken was ze vrijgeven, en dáár zat geen controle op. Dat was de echte fout: niet dat er een uitweg ontbrak, maar dat er een lek zat. Vrijgeven is nu ook aan de transferperiode gebonden, en daarmee kun je buiten de transferperiode niet meer onder je eigen ondergrens zakken. Het ventiel is weg.

Achttien in plaats van zestien, omdat dat de marge is die je in het echt nodig hebt: elf op het veld, en genoeg volk op de bank om een blessure en een schorsing tegelijk op te vangen zonder dat je een doelman op de flank moet zetten.

**Elke week licht je personeel eerst de club door.** "Hun keuzes zijn niet statisch" is makkelijk gezegd; dit maakt het zichtbaar. Voor er ook maar iets beslist wordt, kijkt je staf rond — wie is er in dienst, wat staat er, hoe ligt de groep erbij — en die doorlichting is de eerste regel in het logboek, ook in een week waarin er niets verandert. Zo kun je nakijken dat de analyse écht elke week gebeurt.

Verandert er wel iets, dan staat in diezelfde regel wat er veranderd is en wat de beslissing daardoor werd:

```
Wekelijkse analyse van de club: niets veranderd
   3 personeelsleden in dienst, 1 van de 15 taken uitbesteed.
   trainingen 62%
   Groep op vermoeidheid 0, 0 geblesseerd.

--- de week erna, met een kinesist en een verzorger erbij ---

Wekelijkse analyse van de club: 3 wijzigingen (GEWIJZIGD)
   trainingen 92%
   Veranderd: kinesist in dienst (4 sterren)
   Veranderd: verzorger in dienst (4 sterren)
   Veranderd: omkadering trainingen van 62% naar 92%
  → Trainingen per week: 3 → 4 (GEWIJZIGD)
```

**Eén medewerker kan minder tegelijk.** Drie toppers konden samen de hele club draaien, en dat maakte "de beste betaalbare aanwerven" een eindpunt in plaats van een begin. Een medewerker neemt nu drie taken aan vanaf tachtig punten, twee vanaf vijfenveertig, anders één — en buiten zijn vakgebied werken kost meer dan vroeger: een tweede keuze haalt 75% van zijn punten in plaats van 82%, een derde 58% in plaats van 68%. Elke extra taak kost hem bovendien een tiende van zijn slagkracht.

### 0.40.0 — Wat je personeel nodig heeft, en waarom het doet wat het doet

**Een medewerker is zo goed als wat er om hem heen staat.** Zijn sterren zeggen hoe goed hij ís; de rest van je club zegt of hij zijn werk kán doen. Dat zat alleen in de training, als uitzondering. Nu is het een regel die voor elf taken geldt: elke taak heeft een lijstje van collega's en accommodatie die meetellen, en wat ontbreekt drukt zijn efficiëntie.

| trainer met vijf sterren | efficiëntie |
|---|---|
| zonder kinesist, verzorger of recuperatieruimte | **53%** |
| met dat alles erbij | **85%** |

Die 53% is minder dan een trainer van drie sterren met alles achter zich (68%), en dat hoort ook zo: wie zijn personeel wil laten renderen, moet er iets omheen bouwen. De bodem ligt op 62% van wat je sterren toelaten, zodat een medewerker nooit waardeloos wordt. Bij elke taak staat wat er ontbreekt en wat je eraan kunt doen — "hij mist een kinesist: die haalt elke week vermoeidheid weg, zodat er zwaarder getraind kan worden."

Zo hangt je kantine aan vrijwilligers en een deftige toog, je scout aan een opleidingscentrum, je analist aan wifi, en je evenementenmens aan genoeg handen.

**En je ziet nu waarom.** Er is een logboek bijgekomen op het scherm Personeel, waarin elke beslissing staat die je personeel neemt — met de berekening erachter, opgeschreven vóór de week gespeeld wordt:

```
Trainingen per week: 3 → 4 (GEWIJZIGD) (70%)
   Groep staat op vermoeidheid 30; 0 spelers zijn geblesseerd.
   Herstel per week: 14.6 punten (natuurlijk 40% plus je staf en accommodatie).
   2 trainingen zou uitkomen op waarde 2.40.
   3 trainingen zou uitkomen op waarde 3.60.
   4 trainingen zou uitkomen op waarde 4.80.
   5 trainingen zou uitkomen op waarde 6.00.
   Beste keuze is 5 trainingen; met 70% efficiëntie wordt het er 4.
   Hij mist conditietrainer: hij bouwt de belasting op zonder de groep op te branden.
```

Dat is de week nadat er een kinesist en een verzorger in dienst kwamen: zijn efficiëntie ging van 47% naar 70%, zijn herstel van 0 naar 14,6 per week, en zijn keuze van drie naar vier trainingen. Hun beslissingen zijn dus niet statisch — ze rekenen elke week opnieuw, en wat verandert staat als wijziging aangeduid.

De getallen komen uit dezelfde functies die daarna ook echt het werk doen, dus het logboek kan niet iets anders beweren dan er gebeurt. (Vanaf 0.43.0 gaan dezelfde regels ook naar `logs/voetbalclub.log` en de terminal; zie die laag.)

**Eén regel staat bewust los van dit alles:** gas terugnemen bij een uitgeputte groep. Dat is geen optimalisatie maar gezond verstand, en dat ziet ook een trainer die verder niets om zich heen heeft.

### 0.39.0 — Sterren bepalen wat je personeel voor je uithaalt

**Personeel hébben ontgrendelt het delegeren; wie je erop zet bepaalt wat het oplevert.** Dat zat verspreid over een handvol losse vuistregels per taak. Nu is er één schaal, en die geldt overal:

| sterren | wat hij uit de taak haalt |
|---|---|
| ★ | 50% |
| ★★ | 59% |
| ★★★ | 68% |
| ★★★★ | 76% |
| ★★★★★ | 85% |

Die 85% is een plafond met opzet. Er bestaat een wiskundig beste keuze — het spel kan ze uitrekenen — en die is er alleen voor jou. Wie alles uitbesteedt koopt gemak en betaalt daarvoor met die laatste vijftien procent, elke week opnieuw.

**Wat "50%" betekent, is meetbaar en niet vaag.** Voor elke taak berekent het spel wat de beste keuze oplevert én wat je krijgt als niemand er iets aan doet. De medewerker landt daar precies tussenin, op de hoogte die bij zijn sterren past. Aan de toog is dat direct te zien:

| kantineverantwoordelijke | opbrengst per bezoeker |
|---|---|
| ★ (50%) | €3,16 |
| ★★ (59%) | €3,38 |
| ★★★ (68%) | €3,59 |
| ★★★★ (76%) | €3,80 |
| ★★★★★ (85%) | €4,02 |

De ticketprijs en het trainingsschema werken op dezelfde manier.

**Twee wegen naar goed personeel, allebei duur.** Kopen kost je elke week loon; opleiden kost een bedrag ineens plus weken waarin hij op 60% werkt. Elke ster is een aparte opleiding en elke volgende kost ruim het dubbele:

| stap | kost | duurt | vanaf |
|---|---|---|---|
| ★ → ★★ | €1.550 | 7 weken | meteen |
| ★★ → ★★★ | €3.400 | 10 weken | meteen |
| ★★★ → ★★★★ | €7.450 | 13 weken | 2de nationale |
| ★★★★ → ★★★★★ | €16.400 | 16 weken | 1ste nationale |

Zo is het personeelsspel iets voor je eerste seizoen én voor je vijfde: in provinciale til je iemand van één naar drie sterren, de bovenste twee treden zijn een reden om te promoveren. En één opleiding brengt hem nu ook echt een ster hoger; vroeger was het een plus van vier tot acht waarmee je tussen twee sterren in bleef hangen zonder dat er iets veranderde.

**Wat nog niet klopt, eerlijk gemeten.** Alles uitbesteden aan de staf die je toevallig al hebt eindigt in 1 tot 7 van de 12 partijen in een faillissement — dat werkt. Maar wie de beste betaalbare mensen aanwerft en dan doorklikt, gaat nog altijd 0 op 12 failliet, terwijl de afspraak ongeveer 2 op 20 is. De oorzaak zit niet in deze schaal maar in de inkomsten: een club die 68% van het maximum haalt, draait nog altijd winst. Dat is dezelfde knoop als de moeilijkheidsinstelling, en daar hoort ze ook thuis.

### 0.38.0 — Je personeel denkt na, en je kern heeft een ondergrens

**Autopilot was gratis.** Alles uitbesteden aan personeel en dan doorklikken gaf nul faillissementen op twintig partijen. Dat hoort niet: het verschil tussen een zwakke en een sterke medewerker moet je in je boekhouding voelen. Nu wel:

| speelstijl over zes seizoenen | failliet |
|---|---|
| niets doen | 20 op 20 |
| alles uitbesteden aan de staf die je al hebt | 3 tot 12 op 12 |
| de beste betaalbare aanwerven en dan uitbesteden | 0 op 12 |
| elke rol kopen wat er te koop is | 0 op 12 |

**Een harde ondergrens van zestien spelers.** Zak je eronder, dan gaat de week niet verder. Het bestuur vult je kern niet meer zelf aan — die beslissing hoort bij jou, en het was ook de laatste manier waarop je je club stilletjes kon laten leeglopen. (In 0.41.0 werd dit achttien, en verviel het ventiel dat hier eerst bij hoorde.)

**De kantineverantwoordelijke rekent nu echt.** Hij nam de richtprijs met een vaste opslag, hoe goed of slecht hij ook was. Nu loopt hij per artikel de prijzen af en rekent hij met het vraagmodel van het spel uit wat er overblijft: duurder betekent minder pinten, goedkoper meer volk aan de toog maar minder marge. Hoe beter hij is, hoe verder hij vooruitkijkt en hoe dichter hij bij de top uitkomt.

| kantineverantwoordelijke | opbrengst per bezoeker | pils | koffie |
|---|---|---|---|
| vaardigheid 25 | €3,21 | €2,80 | €2,40 |
| vaardigheid 55 | €3,56 | €3,30 | €2,20 |
| vaardigheid 90 | €3,94 | €3,80 | €1,90 |

Let op wat de topper doet: bier duurder, koffie goedkoper. Dat is geen vuistregel maar het resultaat van de berekening per artikel.

**En de trainer kijkt naar wat je club aankan.** Hij koos vroeger uit een handvol vuistregels. Nu rekent hij met dezelfde functies waarmee het spel vermoeidheid boekt: wat een training erbij legt, wat de wedstrijd kost, en wat er vanzelf én door je staf af gaat. Dan kiest hij het zwaarste schema dat de groep volgende week nog fris genoeg houdt.

| groep op vermoeidheid 35 | herstel per week | trainingen |
|---|---|---|
| geen medische staf | 0,0 | 3× |
| kine, verzorger en recuperatieruimte | 14,9 | 5× |

Precies zoals het hoort: wie in opvang investeert, kan zwaarder trainen. Bij een uitgeputte groep neemt hij gas terug en zet hij de focus op herstel. Een zwakke trainer houdt meer marge aan en durft die grens niet op te zoeken.

**Nog niet af.** De middelste trede — de beste betaalbare staf aanwerven en alles uitbesteden — is nog altijd 0 op 12. Dat hoort volgens de afspraak zo'n 2 op 20 te zijn, en de knop daarvoor is hoeveel taken één iemand aankan: nu vier voor een topper, waardoor je met drie goede mensen heel je club draaiende houdt. Dat is de volgende stap.

### 0.37.0 — Niets doen loopt nu altijd slecht af

**Eerst een correctie op mezelf.** Ik rapporteerde dat passief spelen steeds milder werd, met cijfers als "4 van de 20 failliet". Die cijfers klopten, maar ze kwamen uit een balanstest die maar drie seizoenen speelde. Over acht seizoenen ging elke club alsnog kopje-onder. De test verborg dus niet dat het te makkelijk was, maar dat het langzaam ging. Ze speelt er nu zes, en de kop erboven zegt wat "passief" betekent: een nieuw spel openen en alleen maar op "volgende week" klikken — geen ambitie uitgesproken, niets gedelegeerd, geen prijs gezet, geen sponsor benaderd.

**En er zat een echte fout onder.** Een club die niets deed, kromp zichzelf uit de problemen. Contracten liepen af, spelers vertrokken transfervrij, en de loonlast zakte mee:

| seizoen | inkomsten | spelerslonen | sponsors |
|---|---|---|---|
| 1 | €484.007 | €214.114 | €188.800 (9 contracten) |
| 2 | €464.956 | €175.975 | €153.780 (3 contracten) |
| 3 | €340.840 | €131.846 | €64.590 (1 contract) |

Zijn sponsors liepen weg — dat hoorde zo — maar zijn grootste kost liep in hetzelfde tempo weg. Hoe minder je deed, hoe goedkoper het werd. Daar kwam bij dat het jeugdlidgeld intussen vanzelf groeide, van €71.300 naar €100.050, bij een club waar helemaal niets gebeurde.

Twee dingen rechtgezet. Het bestuur vult je kern nu aan zodra die te klein wordt om zondag elf man op het veld te zetten — met tekengeld en een loon dat jij niet onderhandeld hebt, want wie in juni nog vrij rondloopt laat zich betalen. En de stilstandregel raakt nu ook je jeugd: bij een club waar niets gebeurt, haken ouders af. Resultaat: **zes seizoenen niets beslissen eindigt in alle zes de startcombinaties 20 keer op 20 in een faillissement**, ook met de rijkste start.

**Tegelijk weegt je werk zwaarder.** Chemie, trainer, moraal, vorm, scherpte, spelersrollen en spelplan tellen nu voor 70% mee in plaats van 55%. Gemeten over 24 seizoenen:

| speelstijl | gemiddelde eindplaats | punten | top vijf |
|---|---|---|---|
| alleen je beste elf opstellen | 8,9 | 40 | 2 op 12 |
| ploeg opvolgen: trainingen, staf, rollen, opstelling | **6,0** | **48** | **11 op 24** |

(Mijn eerdere cijfer van 5,3 kwam uit twaalf partijen en was een gelukkige steekproef; over 24 ligt het op 6,0.)

**Wat niet veranderd is:** je sterspeler, het gewicht van je sponsors en de wedstrijdmotor blijven precies zoals ze waren. Het verschil zit in wat er gebeurt als je níets doet.

**Wat nog openstaat:** alles uitbesteden aan personeel en dan doorklikken is nog altijd risicoloos — 0 faillissementen op 20 over acht seizoenen. Dat is een echte speelstijl en geen bodem, dus daar hoort een keuze gemaakt te worden: mag autopilot veilig zijn, of hoort ook dat mis te kunnen gaan?

### 0.36.0 — De man waar ze voor komen kijken

**Elke ploeg heeft een beste speler. Niet elke ploeg heeft een sterspeler.** Dat verschil is de hele feature. Je beste speler is een rangschikking; een sterspeler is iemand die er op zijn positie duidelijk bovenuit steekt — je verdediging staat gemiddeld op 55 en hij op 67. Dán hebben de mensen het over hém.

De grens ligt op 20% boven het gemiddelde van zijn positiegenoten, hijzelf niet meegeteld. Dat getal is niet gegokt maar gemeten, over achthonderdtachtig spelers in veertig kernen:

| grens | sterspelers per kern |
|---|---|
| +15% | 2,02 |
| +18% | 1,25 |
| **+20%** | **1,02** |
| +25% | 0,23 |
| +30% | 0,07 |

Op 15% heeft elke ploeg er twee en betekent het niets meer; op 25% kom je er nog maar bij één op de vier clubs een tegen. Op 20% heeft de meeste clubs er één, sommige geen en een goed samengestelde kern twee. De verdeling over de posities klopt ook: middenvelders 15, verdedigers 13, aanvallers 10, keepers 3 — evenredig met hoe groot die groepen in een kern zijn.

**Wat hij doet, blijft op het niveau waar dit spel over gaat.** Hij trekt volk naar het veld, en dat loopt vanzelf door in je kantine en je clubwinkel; en een naam in je ploeg maakt een bord langs de lijn aantrekkelijker voor een sponsor. Geen aparte spelersmechaniek, geen leertrajecten — twee bestaande knoppen waar hij aan draait. Gemeten over dertig clubs met een ster: mediaan +4,2% publiek, een echte uitschieter +9,5%. Een tweede ster telt half mee en een derde een kwart, zodat een kern vol uitschieters je publiek niet verdubbelt.

**En je hoort het.** Wordt iemand sterspeler, dan staat het in het nieuws met hoeveel hij boven de rest uitsteekt. Valt hij terug of leen je hem uit, dan ook. Om te voorkomen dat een speler die rond de 20% zweeft elke week in en uit het nieuws valt, ligt de grens om ster te wórden hoger dan die om het te blijven: erin op 20%, eruit pas onder 16%. Op je bureau staat één regel met wie het is en wat hij opbrengt, en op zijn spelerskaart draagt hij een eigen kaartje.

**Ook bij de buren.** Een ambitieuze club in je reeks tast af en toe diep in de buidel en haalt er een sterspeler bij. Die club wordt er merkbaar sterker van, en je leest het in het nieuws — het is tenslotte de ploeg waar je over twee weken tegen speelt.

### 0.35.1 — Een laag eruit die hier niet thuishoorde

**Wat ik in 0.35.0 bouwde, werkte — en hoorde hier niet.** De gastclub bepaalde hoeveel een uitgeleende speler groeide: hun trainer, hun jeugdwerking, of hij er wel in de ploeg paste. Een seizoen bij een club die een maat te groot was, leverde nul op. Dat is fijnmazig spelersmanagement, en dit spel gaat over het runnen van een club, niet over het uitstippelen van een leertraject per speler. Eruit.

Een uitgeleende speler speelt nu gewoon elke week en ontwikkelt zich verder. Gemeten over een seizoen:

| | groei |
|---|---|
| uitgeleend | +5,5 |
| in je eigen basiself | +6,0 |
| op je eigen bank | +2,5 |

Dat is de hele regel: uitlenen is beter dan hem laten zitten, iets minder dan hem zelf opstellen, en het kost je de helft van zijn loon. Daar hoef je niets voor uit te rekenen.

Wat blijft staan uit 0.35.0: hij gaat naar een echte club uit de wereld in plaats van een naam die nergens bestaat, je ziet terwijl hij weg is hoeveel wedstrijden hij speelde en hoeveel hij vooruitging, en bij zijn terugkeer staat er een bericht met het verhaal in plaats van alleen zijn naam.

### 0.35.0 — Een uitgeleende speler speelt ergens echt

**Je leende hem uit aan een naam.** `rng.pick(state.league.teams).name` — een willekeurige club uit je eigen reeks, zonder enig gevolg. Zijn ontwikkeling liep intussen gewoon door op jóuw trainer en jouw trainingsschema, terwijl hij een heel seizoen honderd kilometer verderop speelde.

Hij komt nu terecht bij een echte club uit de wereld: eentje die meedoet, promoveert en degradeert. Hij speelt daar elke week en komt een stuk sterker terug dan wanneer hij bij jou op de bank was blijven zitten.

**En je ziet het.** Terwijl hij weg is, staat bij Ploeg › Transfers hoeveel wedstrijden hij daar speelde en hoeveel hij erop vooruitging. Bij zijn terugkeer stond er vroeger alleen "Terug van uitleenbeurt: Kobe Deprez." Nu staat er wat het opleverde: hoeveel hij speelde, hoeveel sterker hij werd, of juist dat hij er nauwelijks aan spelen toekwam.

### 0.34.0 — Een huurspeler die je wil houden

**Een huurcontract liep af en dan was hij weg, punt.** Je haalde een jonge speler van een profclub, liet hem een seizoen groeien in je ploeg, en in week 52 stond hij weer op de bus. Nu kun je erover praten — maar zíj beslissen, niet jij.

Vanaf week 26 staat er bij Ploeg › Transfers een blok met je huurspelers en twee mogelijkheden per speler: nog een seizoen huren, of hem definitief kopen. Jij vult in wat je biedt en ziet meteen hoe groot de kans is dat ze ja zeggen — en die kans beweegt mee terwijl je aan het bedrag draait, want anders weet je pas ná het klikken wat je bod waard was. Het is exact dezelfde rekensom die een week later het antwoord maakt.

**Wat zij bekijken, werkt twee kanten op.** Hoeveel hij bij jou speelde, hoeveel hij erop vooruitging, en je bod. Gemeten bij een huurspeler van 22 die een half seizoen achter de rug heeft:

| | speelde 18 van de 20, gegroeid +4 | zat op de bank, 2 van de 20 |
|---|---|---|
| wat ze vragen om te verlengen | €1.000 | €750 |
| kans bij dat bedrag | 95% | 26% |
| kans als je het dubbele biedt | 95% | 61% |
| wat ze vragen om hem te verkopen | €16.500 | €12.000 |
| kans bij dat bedrag | 37% | 81% |

Liet je hem elke week spelen en werd hij beter, dan verlengen ze graag — hij ontwikkelt zich precies zoals ze hoopten — maar verkopen doen ze dan juist niet graag, en duur, want nu weten zij ook wat hij waard is. Zat hij op de bank, dan willen ze hem terug voor een uitleenbeurt die wél iets oplevert, maar kopen lukt dan een stuk makkelijker. Een fooi nemen ze niet in behandeling: een bod van één euro gaf in de eerste versie nog 31% kans, nu 1%. Zeggen ze nee, dan hoor je waarom en kun je het vier weken later opnieuw proberen.

**Eén fout kwam meteen boven.** Het seizoenseinde stuurde élke huurspeler terug naar zijn club, ook wie je net had mogen houden. De verlenging was dus een lege afspraak: je betaalde ervoor en hij vertrok toch. Nu keert alleen terug wie zijn huur echt zag aflopen, en wie blijft krijgt een eigen bericht.

Elke speler houdt voortaan bij op welk niveau hij binnenkwam, zodat zijn groei meetbaar is — ook in oude opgeslagen spellen, die dat cijfer bij het inladen krijgen.

### 0.33.1 — Nu vergelijk je appels met appels

**Het scherm liet je twee verschillende dingen vergelijken.** In het scoutingrapport stond hun sterkte op papier, en daarnaast jouw totaal — maar jouw totaal draagt al je blessures, je moraal, je vorm, je chemie en je spelplan in zich, en dat van hen niets. Keek je naar die twee cijfers en zag je "gelijkaardig of zelfs lager", dan klopte dat gevoel: je las een cijfer dat niets met het andere te maken had. Er staat nu hun échte sterkte van zondag — precies het getal waarmee de motor de wedstrijd berekent — met hun papieren cijfer en de tik van het seizoen erbij.

**En een correctie op 0.33.0.** Daar stond dat vermoeidheid de oorzaak was. Dat klopt niet. Nagemeten over zes seizoenen, met elke week de beste elf:

| week | jouw totaal | kwaliteit elftal | vermoeidheidsfactor | moraal | geblesseerd | gemiddelde tegenstander |
|---|---|---|---|---|---|---|
| 1 | 56,25 | 54,25 | 1,000 | +1,05 | 0,0 | 56,27 |
| 10 | 54,68 | 53,23 | 1,000 | +0,42 | 1,5 | 56,27 |
| 22 | 55,35 | 53,37 | 1,000 | +0,10 | 1,2 | 56,25 |

De vermoeidheidsfactor blijft gewoon 1,00 — die kost je niets, precies zoals het groene bolletje op je scherm zegt. Wat je wél kost: blessures halen je besten uit de ploeg (kwaliteit −0,9) en je moraal zakt weg (−0,95). Het gemiddelde van je tegenstanders staat ondertussen het hele seizoen stil. De achterstand was dus 1 à 1,6 punten en niet 3; de uitleg van vorige versie overdreef.

**De duim op de weegschaal staat nu expliciet.** De slijtage van je tegenstanders hangt aan één constante, `WEAR_PEAK`, en die staat op 2,6 terwijl een strikte gelijkstand om ongeveer 1,5 zou vragen. Dat verschil is bewust: het geeft je ongeveer een punt voorsprong. Dat is precies de knop waar de moeilijkheidsinstelling aan hoort te draaien — lager voor zwaarder, hoger voor makkelijker.

### 0.33.0 — Je zakte weg omdat alleen jouw ploeg de tikken kreeg

**Er zat een scheeftrekking in, en die werkte tegen jou.** Jouw ploeg wordt in detail gespeeld: een blessure haalt je beste verdediger eruit, een schorsing kost je een basisspeler, moraal en vorm schommelen. Je tegenstanders waren één vast getal dat het hele seizoen nergens last van had — hun gemiddelde staat van week 1 tot week 44 op 56,3.

De wedstrijdmotor zelf was wél eerlijk: twee even sterke ploegen komen over 20.000 duels uit op 37% winst, 26% gelijk, 37% verlies. Het probleem zat niet in de dobbelstenen maar in wat er in de motor ging.

**Nu draagt elke ploeg hetzelfde seizoen.** De slijtage loopt op tot de winterstop, de rust haalt er een stuk uit, en in de terugronde loopt ze weer op. De ene club heeft meer pech dan de andere, maar gemiddeld even veel. Onderling verandert er voor hen niets — ze zakken allemaal evenveel — maar tegenover jou staan ze eindelijk in dezelfde eenheden.

**En je werk weegt zwaarder.** Chemie, trainer, moraal, vorm, scherpte, spelersrollen en spelplan tellen nu voor 55% in plaats van 45% mee. Alles wat beheer kan opleveren — topstaf, vijf trainingen, frisse benen, hoge moraal — is daarmee goed voor ongeveer vijf punten ploegsterkte, en dat is in de eindstand te zien:

| speelstijl | gemiddelde eindplaats | punten uit 30 wedstrijden |
|---|---|---|
| enkel de beste elf opstellen | 8,4 | 41 |
| ploeg opvolgen: trainingen, staf, rollen, opstelling | 5,5 | 51 |

Top vijf in de helft van de seizoenen, en af en toe een titel.

**De prijs staat er eerlijk bij.** Passief spelen wordt hier nóg milder van: Zuidrand met de aannemer gaat van 10 naar 7 faillissementen op 20, met de coöperatie van 17 naar 11, Heidebeke met de coöperatie van 3 naar 0. Samen met de sponsorwijziging van 0.32.0 is de financiële druk in twee versies fors gezakt — van 17 op 20 naar 7 op 20 voor de moeilijkste startcombinatie. Dat is de plek waar de moeilijkheidsinstellingen thuishoren.

### 0.32.0 — De sponsormarkt stond op zijn kop

**Er waren meer banken dan bakkers.** Van de achtenveertig bedrijven in de streek konden er eenentwintig een shirt of de borst aan — samen twee plaatsen — en maar drie een reclamebord, waarvan er zestien zijn. Je contactenlijst stond dus vol brouwerijen en telecombedrijven die, omdat de grote plaatsen allang bezet waren, een bord van veertig euro kwamen tekenen. In het echt is het net omgekeerd: langs het veld hangen dertig borden van de bakker, de loodgieter en de frituur, en is er één bedrijf in de streek groot genoeg voor de borst.

De markt telt nu eenentachtig bedrijven, en de piramide staat rechtop:

| plaats | bedrijven | plaatsen |
|---|---|---|
| reclamebord | 26 | 16 |
| wedstrijdbal | 11 | 4 |
| schermen | 7 | 2 |
| jeugdsponsor | 4 | 3 |
| shirt en borst | 16 | 2 |

Er kwamen drieëndertig bedrijven bij: dakwerkers, schilders, een frituur, een nachtwinkel, een taxibedrijf, een wassalon, een vishandel. En er zijn nu sectoren die bij de jeugdsponsor passen — kinderopvang, speelgoed, een dansschool — want daar bestond tot nu letterlijk geen enkel bedrijf voor, zodat die plaats alleen gevuld raakte door iemand die eigenlijk groter kon.

**Je contactenlijst draait.** Ze stond zo goed als stil: drie nieuwe namen in week 1 en verder alleen wat een sponsorbureau opleverde. Wie zijn lijst één keer had afgewerkt, keek de rest van het seizoen naar dezelfde dertien bedrijven. Om de twee weken melden zich nu twee tot vier nieuwe contacten — je krijgt er een bericht van — en een handelaar die maanden niets hoort, verliest zijn interesse en verdwijnt. Een bedrijf waarmee een gesprek loopt kan nooit wegvallen voor je zijn antwoord hebt.

**En sponsoring weegt nu zoals bij een echte club.** De bedragen gingen ongeveer 28% omhoog. Gemeten over een seizoen:

| post | voor | na |
|---|---|---|
| sponsors | €153.718 (38%) | €193.300 (45%) |
| lidgelden | €64.256 (16%) | €65.263 (15%) |
| tickets | €65.609 (16%) | €62.350 (14%) |
| kantine | €51.052 (13%) | €46.145 (11%) |

Sponsoring is daarmee de grootste post, groter dan de kassa en de kantine samen — en dat klopt met hoe een club in deze reeksen haar geld binnenhaalt: bij de handelaars van het dorp, niet aan het loket.

**Dat heeft een prijs, en die staat hier eerlijk bij.** Passief spelen is duidelijk minder dodelijk geworden: Zuidrand met de aannemer gaat van 17 naar 10 faillissementen op 20, Heidebeke met de coöperatie van 16 naar 3. De tering-naar-de-nering-spanning die het spel had, is dus voor een stuk weg. Dat is geen bijwerking om weg te moffelen: als de inkomsten realistischer worden, moet de druk ergens anders vandaan komen.

**Drie fouten die hierbij bovenkwamen.** Door het hogere startbedrag maakte het spel negentien borden op zestien plaatsen, zodat je begon met een overvolle bordenrij en geen enkele vrije plaats. Je begint nu met acht à tien borden plus een mouw-, jeugd- en balsponsor, en houdt ruimte over om zelf te verkopen. En in de wereld buiten je club lekte een reeks weg: doekte een club op terwijl alle clubnamen van dat niveau al in gebruik waren, dan vond het spel geen vervanger en bleef die reeks voorgoed met vijftien ploegen spelen. Erger nog, een gat opvullen gebeurde bij een buurreeks die zelf precies vol zat, dus het gat verhuisde alleen maar heen en weer tot de doorgangen op waren. Beide zijn gerepareerd en over vijftien seizoenen nagemeten op vier verschillende partijen.

### 0.31.0 — Jij hangt de prijskaart aan de muur

**Tot nu noemde het bedrijf een bedrag en zei jij ja of nee.** Dat is de omgekeerde wereld voor iemand die de club runt: in het echt bepaalt de club wat een bord langs het veld kost, en beslist de bakker om de hoek of hij dat wil betalen. Nu hangt er een prijskaart onder Geld › Sponsors, met per soort plaats één bedrag dat jij zet. Een reclamebord aan €80? Dat mag. Of je er dan één verkoopt, is een andere vraag.

Wat er met je prijs gebeurt, staat er meteen bij: een woord onder elk veld (`scherp`, `goed gemikt`, `stevig`, `duur`, `onbetaalbaar`), en in de contactenlijst per bedrijf het echte percentage dat het ja zegt — dezelfde rekensom die het spel zondag zelf gebruikt, dus het scherm kan niet iets anders beweren dan er gebeurt. Ook de plaats die zo'n bedrijf écht zou krijgen staat erbij: is je hoofdsponsorplaats bezet, dan zakt het een trapje, en dan geldt die prijs.

**De eerste versie was een rechte lijn, en die bleek de keuze zinloos te maken.** Elke procent boven het gangbare bedrag kostte een procent kans. Klinkt eerlijk, maar de opbrengst van een plaats is kans maal prijs, en dat product is bij een rechte lijn altijd precies op het gangbare bedrag het hoogst — voor élke club. Gemeten over een heel seizoen van benaderen en tekenen: €200.988 als je de markt volgt, €202.412 als je 20% meer vraagt. Nog geen procent verschil. Je kon dus aan de knoppen draaien zonder dat het iets deed.

Daarom buigt de curve nu, en hangt de bocht af van hoe graag bedrijven bij jóuw club willen horen — reputatie, sfeer, populariteit, je reeks, je commercieel medewerker. Hetzelfde onderscheid als bij het lidgeld: niet het niveau, maar de helling.

| club | trekkracht | beste prijs | kans bij 1,5× | kans bij 2× |
|---|---|---|---|---|
| dorpsclub, slechte naam | 0,80 | 1,00× het gangbare bedrag | 56% | 32% |
| zoals je begint | 1,12 | 1,26× | 67% | 45% |
| topclub met naam en commercieel medewerker | 1,60 | 1,76× | 75% | 57% |

En over een volledig seizoen, met elke week het meest geïnteresseerde bedrijf benaderen en elk voorstel tekenen:

| vraagprijs | sponsors na 52 weken | inkomsten per week | totaal seizoen |
|---|---|---|---|
| 60% van gangbaar | 24,2 | €3.476 | €184.016 |
| gangbaar | 22,8 | €4.168 | €200.988 |
| 150% | 20,8 | €4.524 | €214.817 |
| 200% | 17,3 | €4.249 | €205.990 |
| 300% | 12,0 | €3.508 | €181.271 |

Een echte top dus, met een helling aan beide kanten: te goedkoop vult je plaatsen met kleine contracten, te duur laat ze leeg staan. En het uiterste is nooit het beste — dat is precies de fout die in 0.28.0 bij het lidgeld boven kwam, en er staat nu een test op die het voor een zwakke, een gewone en een topclub nameet.

**Jouw prijs geldt overal.** Een verlenging gaat tegen je prijskaart, en een sponsor die je bedrag intussen zag verdubbelen, zegt nee en je houdt gewoon het oude contract. Ook de voorstellen die na een promotie vanzelf binnenkomen, staan op jouw prijs in plaats van op een bedrag dat het spel zelf verzon.

**Wie er niets mee doet, merkt er niets van.** Zonder eigen bedrag volgt elke plaats de gangbare prijs, en dan is de kansfactor precies één. De balans nagemeten: zes van de zes startcombinaties exact gelijk aan voor deze laag.

### 0.30.0 — Een sterkere club mag meer vragen voor haar jeugd

**De prijsgevoeligheid was voor elke club dezelfde, en dat klopt niet.** Als je club goed draait — een naam in de streek, een opleidingscentrum, een coördinator die de ouders kent, een ploeg die bovenaan meedoet — dan kijken ouders niet meer alleen naar het bedrag. Ze blijven omdat hun kind hier beter wordt. Een club die achteraan bengelt met een modderveld heeft dat argument niet en verliest bij elke euro meteen leden.

Dat zit nu in de helling zelf, niet alleen in het niveau. `youthPull()` vat samen hoe hard ouders zich aan jóuw club vasthouden — reputatie, opleidingscentrum, de vaardigheid van je jeugdcoördinator, hoe de ploeg het doet en in welke reeks je speelt — en die waarde maakt de curve platter of steiler. Het verschil is groot:

| club | trekkracht | beste prijs | opbrengst |
|---|---|---|---|
| dorpsclub, slechte naam | 0,79 | 1,00× het gangbare bedrag | €52.650 |
| zoals je begint | 1,08 | 1,37× | €94.720 |
| goede naam, opleidingscentrum, coach | 1,42 | 1,73× | €156.040 |
| topclub in de Challenger Pro Liga | 1,55 | 1,89× | €277.500 |

De trekkracht is bewust begrensd tussen 0,7 en 1,55. Zonder plafond zou een topclub opnieuw eindeloos kunnen verhogen, en dat was precies de fout die er in 0.28.0 uitging. Getest: ook bij de sterkste club daalt de opbrengst na de top overal, ligt de beste prijs op 47% van de schuifbalk, en levert het uiterste nog maar 71% van de top op.

**En je jeugdcoördinator verhoogt nu ook het plafond.** Hoeveel ploegen je aankan hing alleen aan stenen en gras: opleidingscentrum, kunstgras, verlichting. Maar een ploeg draaiende houden is vooral mensenwerk — trainingen inplannen, ouders bellen, scheidsrechters regelen, een afgevaardigde vinden. Een coördinator vanaf vaardigheid 45 krijgt er één ploeg bij, vanaf 75 twee. Gratis is dat niet: elke ploeg bindt twee vrijwilligers die je dan niet voor een evenement kunt inzetten.

Allebei staan ze nu op het scherm — je aantrekkingskracht in woorden, met in de tooltip wat eraan bijdraagt, en hoeveel ploegen je aankan. Anders is het een stille mechaniek en lijkt de tabel willekeurig.

Balans nagemeten: vijf van de zes startcombinaties blijven gelijk. Heidebeke met de aannemer gaat van 2 naar 0 faillissementen op 20 — dat was al de makkelijkste weg, en die club begint met een coördinator.

### 0.29.0 — Je ploegsterkte beweegt mee terwijl je wisselt

**De cijfers stonden er wel, maar niet waar je ze nodig had.** Ploegsterkte, aanval, verdediging en de kwaliteit per linie stonden onder het veld en onder je kern — dus precies buiten beeld op het moment dat je iemand wisselt. En dat is nu net wanneer je ze wil zien. Ze staan nu boven het veld en naast elke linie, en terwijl je wisselt toont elke kandidaat in je kern wat híj met je ploegsterkte zou doen: `+0,4`, `−1,3`. Dat cijfer is gemeten en niet geschat — het doet precies wat de wissel zou doen en laat dezelfde functie het opnieuw uitrekenen die het spel er zondag mee speelt.

**Wat een abonnement doet, deed het niet.** Er stond "abonnees komen ook als het regent", en de code probeerde dat met een ondergrens: de opkomst zakte nooit onder 85% van je abonnees. Die grens sloeg nooit aan — zelfs bij storm en driehonderd abonnees lag de gewone opkomst nog hoger. En de rest klopte ook niet: alle abonnees werden verondersteld aanwezig te zijn, wat op een volle tribune betekende dat ze de betalende supporters verdrongen.

Nu staat er wat er echt gebeurt. Een abonnee heeft betaald, dus de drempel om toch te gaan is lager en het weer weegt half zo zwaar als bij iemand die aan de kassa moet beslissen. Vierhonderd abonnees maken van een stormwedstrijd 289 toeschouwers er 378 — en die negenentachtig extra mensen drinken en eten allemaal iets. Dat is waar je een abonnement voor koopt, en het is nu ook zo. Omgekeerd: wie niet komt opdagen laat zijn plaats vrij, en als er meer volk wil dan er plaatsen zijn gaat die plaats naar iemand aan de kassa. Op een tribune van driehonderd met honderdvijftig abonnees leverde dat 182 betalende bezoekers op in plaats van 150.

**Het weekrapport zei dingen drie keer.** De uitslag stond als kaartje bovenaan, als scorebord in het midden, en nog eens als nieuwsregel met dezelfde toeschouwers en dezelfde kaarten erin. Het weekmoment stond twee keer, de opkomst twee keer. Nieuwsberichten dragen nu een merkje dat zegt waar ze over gaan, zodat het rapport kan overslaan wat het zelf al toont — in de nieuwsstroom op je bureau blijven ze gewoon staan, want daar is geen scorebord.

En de knop "Sluiten ✕" deed exact hetzelfde als "Naar je bureau": allebei het rapport weg en naar het overzicht. Dan heeft een tweede knop geen bestaansreden. Sluiten laat je nu staan waar je was, want wie midden in zijn selectie zat wil daarheen terug.

### 0.28.0 — Het lidgeld had een vluchtstrook

**Je kon het lidgeld blijven verhogen en het bleef beter worden.** De prijsgevoeligheid was `(gangbaar / jouw prijs)^1,5`, vastgezet tussen 0,3 en 1,8. Die ondergrens was de fout: vanaf ongeveer €510 zakte het ledenaantal niet meer, en vanaf dat punt leverde élke verhoging gewoon lineair meer op. De opbrengst steeg tot €156, daalde tot €513, en steeg daarna oneindig door — een dal met een vluchtstrook erachter. Het beste wat je kon doen, was het uiterste van de schuifbalk: honderd leden aan het maximum, de hoogste opbrengst van de hele reeks bij het minste werk. Dat is geen keuze.

Boven het gangbare bedrag vallen de inschrijvingen nu exponentieel weg: ouders die het te duur vinden gaan naar de club in het dorp ernaast, en hoe verder je erboven zit hoe sneller dat gaat. De opbrengst heeft daardoor één top, iets boven het gangbare bedrag, en zakt daarna echt weg — aan het maximum van de schuifbalk hou je nog een derde van wat de top oplevert.

**Er zat een tweede laag onder.** `youthForecast` schoof het ledenaantal maar half op naar waar de prijs het brengt, om trage groei te modelleren. Maar daardoor bleef de helft van je huidige leden élke prijs betalen, en dat halve stuk bleef bij elke verhoging meer opleveren — dezelfde oneindige arm, één niveau dieper. Nu geldt een bovengrens op wat je kunt vasthouden: je houdt nooit meer dan een derde meer leden dan de prijs draagt. Wie het écht te duur vindt, schrijft gewoon niet meer in, en dat gebeurt meteen.

**En het was volledig voorspelbaar.** De inschrijvingen waren letterlijk de prognose, zonder enige marge, dus je kon de tabel aflezen en perfect optimaliseren. Er zit nu ongeveer 12% toeval op: het scherm toont wat je mág verwachten, niet wat je krijgt.

**Het maximum lag vast op €800,** wat te laag is voor een club met een opleidingscentrum in de Pro Liga. Het gangbare bedrag klimt nu mee met je reeks en met de inflatie (€230 bij een dorpsclub, €437 in de Pro Liga), en het maximum is vier keer dat bedrag. Een bestaand spel waarin je boven de nieuwe grens zat, zakt bij het laden terug naar het maximum.

De tabel op het scherm duidt nu twee toppen aan, en dat is precies de les: de prijs die **volgend seizoen** het meeste opbrengt ligt hoger dan de prijs die **op termijn** het meeste opbrengt, want de helft van je huidige leden blijft nog even zitten. Wie de eerste kiest, cashet één jaar en zakt daarna door. Je jeugdcoördinator kiest voortaan de tweede.

`test/youthfee.test.ts` houdt dit vast, onder meer met een test die over vier reeksen en drie ledenaantallen controleert dat het uiterste van de schuifbalk nooit de beste keuze is. De balans is nagemeten: passief spelen blijft even dodelijk (19 van de 20 faillissementen bij Zuidrand met de aannemer).

### 0.27.0 — Sorteren werkt weer, en het weekrapport heeft een volgorde

**Sorteren was op drie manieren stuk,** en ze versterkten elkaar.

De eerste is de zichtbaarste. De sorteerfunctie haalde de duizendpunten uit elk getal — nodig voor "€1.234" — maar deed dat ook met een `data-v` die rechtstreeks uit een JavaScript-getal komt. De tevredenheid van een sponsor is een kommagetal, dus `data-v="60.34210371"` werd 6.034.210.371. Elke sponsor kreeg een willekeurig getal van tien cijfers, en de kolom stond volledig door elkaar.

De tweede verklaart waarom het ook elders misging. De functie besliste *per cel* of die een getal was. Een kolom met één streepje ertussen leverde dus deels getallen en deels tekst op, en de vergelijking viel dan terug op tekst — maar alleen voor dát paar. Een sorteervergelijking die niet voor alle paren hetzelfde doet is niet transitief, en dan mag de browser er elke volgorde uit laten komen. Dat deed hij ook, en niet twee keer dezelfde.

De derde is de A–Z-klacht. Bij tekst nam de functie de volledige inhoud van de cel, en in de spelerstabel staat daar naast de naam ook ★, "eigen jeugd", "2 wedstrijden geschorst" en zijn karakter in.

Het sorteren staat nu in `src/ui/tablesort.ts`. Dat bepaalt het soort van de héle kolom in één keer — pas als elke gevulde cel een getal oplevert is het een getallenkolom — laat `data-v` ongemoeid omdat wij dat zelf schrijven, en neemt bij tekst alleen de kop van de cel. Lege cellen staan altijd onderaan, ook omgekeerd, want "geen waarde" is geen kleine waarde. Gelijke waarden houden hun oorspronkelijke volgorde. Zestien tests leggen dit vast, en een doorloop klikt elke sorteerbare kolom in twaalf tabellen twee keer aan en controleert de uitkomst.

**Het weekrapport had veel data en weinig volgorde.** Nu leest het van dringend naar naslag: de kaartjes met je resultaat en de uitslag, dan de wedstrijd over de volle breedte, dan het geld, en pas daarna het nieuws en wat er nog loopt. Het geldoverzicht was één lijst van twaalf categorieën door elkaar, van +€26.000 tot −€42.000, waarin je zelf moest optellen wat er binnenkwam. Het staat nu in twee kolommen — binnengekomen en uitgegeven — elk met een eigen subtotaal, met daaronder wat je overhield.

En de knop stond buiten beeld. Een drukke week maakt dit rapport twaalfhonderd pixels lang, en dan moest je langs alles scrollen om verder te kunnen. De kop en de knoppenbalk plakken nu aan het kader en alleen het middenstuk schuift; de knop heet voortaan "Naar je bureau". De twee lijsten die het langst worden — de andere uitslagen en wat er in afwachting staat — klappen dicht zodra ze meer dan vijf regels tellen.

Daarbij viel nog iets op: de tooltip rechtsonder dekte precies de knop van het rapport af. Staat er een venster open, dan wijkt hij nu uit naar links.

### 0.26.0 — Taal die je begrijpt zonder voorkennis

**Waar zet ik mijn ticketprijs?** Dat bleek niet te beantwoorden zonder te zoeken. De ticketprijs stond halverwege Financiën tussen tien andere kaarten, de abonnementen bovenaan datzelfde scherm, en het jeugdlidgeld onder Clubinfo tussen de clubgeschiedenis en de kerncijfers. Drie beslissingen van dezelfde soort — jij zet een prijs, iemand anders beslist of hij die betaalt — op drie plekken. Ze staan nu samen onder **Geld › Tickets en lidgeld**, met bij elk hetzelfde: wat het nu opbrengt, wat gangbaar is, en wat er gebeurt als je schuift. Op de oude plekken staat een regel met de huidige waarde en een knop ernaartoe.

**De kopbalk kromp bij het scrollen.** Dat was bedoeld om hoogte te winnen, maar een balk die onder je handen van vorm verandert kost meer dan de twintig pixels die hij oplevert: je zoekt een cijfer dat er net nog stond. Eruit.

**"€230" werd "23(".** Het getalveld had een vaste minimumbreedte die niets wist van het getal dat erin moest. De eerste reparatie rekende in `ch` — de breedte van een nul — maar die eenheid klopte hier niet: de browser gaf 8,1 pixels per `ch` terwijl de cijfers in dit vette, tabellarische lettertype er ruim veertien innemen. Nu gebruikt het veld `size`, het attribuut dat daar bestaat: de browser meet zelf. Daarna bleef het in tabelcellen tóch misgaan, omdat de algemene regel `input[type='text']` een `width: 100%` zette die zwaarder weegt dan één losse klasse — de derde keer deze maand dat specificiteit de schuldige was. Alle 56 getalvelden in het spel zijn nagemeten.

**De taalronde.** Het spel is gericht op spelers vanaf een jaar of tien, maar moet uitdagend blijven voor volwassenen. Dat betekent niet: eenvoudiger spel. Het betekent: geen drempel die niets met het spel te maken heeft.

- De kolomkoppen van je kern waren `Pos · Kwal/Pot · Techn/Fys · Moe · Loon/w`, en de helft had geen uitleg. Vijf afkortingen op het scherm dat je elke week opent. Ze staan nu voluit, en wat niet in één woord past staat in de tooltip in plaats van in een afkorting.
- `S2` en `W17` zijn overal weg. Er staat "nog 2 seizoenen" en "week 17"; in een lijst waarin alles uit hetzelfde seizoen komt, gewoon "week 17".
- `'Niet genoeg geld.'` stond op zes plekken. Dat is de melding waar je niets mee kunt: je weet niet wat het kost, niet hoeveel je tekortkomt, en niet wat je eraan kunt doen. Eén functie zegt nu alle drie.
- Knoppen zeggen wat ze doen. Twee verschillende knoppen heetten "Starten" (een tribune bouwen, en vrijwilligers zoeken). "Ontbind" werd "Wegsturen", "Voorstellen" werd "Dit bod doen", "Verder" werd "Sluiten en verderspelen".
- Het scherm "Wat beïnvloedt wat" las als een rekenblad: *"× prijsgevoeligheid ((gangbare prijs / jouw prijs) tot de macht 1,2)"*. Die formules zijn gewone zinnen geworden die hetzelfde zeggen — "vraag je meer dan gangbaar, dan bestellen ze minder dan evenredig minder" — zonder dat de cijfers verdwijnen.
- Weg: `speler(s)`, `wedstrijd(en)`, `plaats-eenhe(i)d(en)`, `±`, `vs`, `incl.`, `Ptn`, `Marge/stuk`.
- Vier tooltips legden drie of vier dingen tegelijk uit. Die zijn gesplitst: het kernidee blijft in de tooltip, de rest staat op het scherm zelf, waar toch plaats is.

`test/taal.test.ts` bewaakt deze regels. Hij leest alleen de inhoud van string- en sjabloonliteralen — de eerste versie las hele regels en zag `teamStrength(s)` aan voor "speler(s)" — en faalt op weekcodes, haakjesmeervouden, `±`, puntafkortingen, ambtelijke taal en tooltips boven de 45 woorden.

### 0.25.0 — Je plaats in het klassement staat altijd in beeld

**De kopbalk draagt nu de vijf cijfers waar je week om draait.** Ze stonden verspreid: de datum links, drie weekcijfers ernaast, het saldo helemaal rechts en een halve kopbalk leeg ertussen. En je plaats in het klassement stond er niet, terwijl dat het cijfer is waar je hele seizoen om draait. Nu staan week, speeldag, klassement, volgende match en saldo op één lijn, elk met een kopje erboven en elk als knop naar het scherm waar het vandaan komt.

Je plaats kleurt mee: groen met een ▲ op een promotieplaats, rood met een ▼ in de degradatiezone. Die zone komt uit `zoneAt()` in `src/engine/league.ts`, en `seasonEnd()` gebruikt dezelfde functie om het seizoen af te rekenen. Stonden die twee los van elkaar, dan zou de kopbalk je een degradatieplaats kunnen aanwijzen die de engine niet als degradatie afrekent.

**Een bug op Ploeg › Strategie.** Het scherm keek naar één taak — "opstelling" — en zette daarmee álle drie de blokken op slot. Wie zijn opstelling had uitbesteed, kon dus ook zijn trainingsritme en zijn spelplan niet meer aanraken, terwijl de kiezer erboven netjes "Jij" aanwees en de melding eronder sprak over het terugnemen van een taak "Strategie" die niet bestaat. Elk blok hangt nu aan zijn eigen taak, het slotje staat op het blok waar het over gaat en noemt de persoon die beslist, en alle drie de taken staan in de kiezer.

**De kalender stond dubbel.** Onder Competitie stond een kaart "Kalender" met jouw gespeelde en komende wedstrijden, en daarnaast was er een submenu "Kalender" met de echte agenda: alle 52 weken met transferperiodes, uitbetalingen, de licentie-audit en de weken waarin spelers evolueren. Twee verschillende dingen met dezelfde naam. De kaart heet nu "Jouw wedstrijden" en staat bij de stand waar ze hoort; de agenda verhuisde naar **Bureau › Agenda**, want het is planning en geen naslag over de competitie. Competitie houdt daardoor één scherm over en verliest zijn subbalk.

**Drie schermen die de breedte niet gebruikten.** Sponsors stond in de dashboard-indeling: een brede kolom met een smalle ernaast, en op een breed scherm viel die brede kolom zelf nog eens in tweeën. De twee tabellen — zeventien sponsors met zes kolommen, dertien contacten met vijf — werden daardoor in een vak van tweehonderdvijftig pixels geperst waar elke cel over drie regels brak, en één kaart belandde alleen onderaan met tweederde wit ernaast. Nu staan de twee dingen waar je iets mee doet bovenaan naast elkaar, en krijgen de tabellen de volle breedte.

Doelen had hetzelfde probleem in het klein: acht langetermijndoelen die elk een paar zinnen nodig hebben, in een kolom van een derde van de pagina. Die keuze ís het scherm zolang je nog niet gekozen hebt, dus ze krijgt nu de volle breedte; daarna staan je doel, je seizoensdoelen en je eigenaarsniveau naast elkaar. En Financiën stond in een `.grid` met auto-fill: vier kolommen van 336 pixels, met kaarten die van één alinea tot twintig tabelregels lopen. Daar ligt de indeling nu vast.

### 0.24.0 — De kopbalk blijft staan, en een spelerskaart legt zichzelf uit

**De kopbalk blijft nu boven in beeld.** Ze scrolde weg, en dan was je halverwege een spelerslijst je clublogo, je clubnaam en je saldo kwijt. De vorige poging om alles te laten plakken liep mis omdat elke balk apart plakte op de gemeten hoogte van de vorige: zodra er één van hoogte veranderde bleef er een band over waar de tabel doorheen schoof. Nu zitten kopbalk, menubalk en subbalk samen in één `.bars`, en dat blok plakt als geheel. Er is geen afstand meer om verkeerd te rekenen.

Bevroren mag alleen geen kwart van je scherm kosten. Zodra je scrolt krijgt het document de klasse `scrolled` en krimpt de balk van 200 naar 148 pixels: kleiner logo, geen datumregel, geen weekcijfers, halve marges. Wie je bent en wat je in kas hebt blijft staan. Je saldo stond intussen twee keer op het scherm — in de kopbalk én in de speelbalk onderaan — en die tweede is weg.

**De tooltip lag voor de knop "Volgende week".** Hij staat rechtsonder, en daar staat ook de speelbalk. Hij begint nu net boven die balk; `--playbar-h` wordt bij elke hertekening gemeten, dus dat klopt ook als de balk op een telefoon twee rijen hoog wordt. Hetzelfde geldt voor de meldingen onderaan, die half achter de balk lagen.

**Een spelerskaart legt zichzelf uit.** Er stond "30 jaar · leider · kernspeler" als één grijze regel: drie losse feiten die je zelf uit elkaar moest halen, en waarvan er twee niets zeiden. Het zijn nu drie kaartjes met een icoontje, en bij elk staat in de tooltip wat het je oplevert — een lastpak pakt 2,5× zoveel kaarten en is een slechte kapitein, een harde werker groeit 1,3× zo snel, een leider tilt als kapitein de hele ploeg op. Daaronder staat wat er nú met hem aan de hand is, in gekleurde kaartjes: vorm, vermoeidheid, moraal, een aflopend contract. Wie hij is en wat er speelt zijn twee verschillende dingen, en dus twee verschillende rijen.

De cryptische `S2` is weg. Dat was het seizoen waarin zijn contract afloopt, wat betekent dat je het seizoensnummer uit je hoofd moest kennen om het te kunnen lezen. Er staat nu "nog 2 seizoenen", of "laatste seizoen" in het rood. Loon en contract staan als twee benoemde feiten met een kopje erboven in plaats van achter elkaar op één regel. En de knoppen zien er eindelijk uit als knoppen: een eigen vlak, een randje, en ze kleuren mee als je erover gaat.

**"Dashboard" heet nu "Bureau".** Het is de plek waar je gaat zitten, niet een instrumentenpaneel.

**Eén brede tabel duwde de clubpagina opzij.** Het lidgeldoverzicht en de clubgeschiedenis stonden zonder schuifkader in een rasterkolom van 336 pixels, en een tabel krimpt niet mee — dus schoof de hele pagina 320 pixels naar rechts. Ze schuiven nu binnen hun eigen kader, en elk rastervak heeft `min-width: 0` gekregen zodat dit niet opnieuw kan gebeuren.

## Laag 15

### 0.22.0 — Je eigen kleuren, en cijfers die zeggen wat ze doen

**Je kiest je clubkleuren, en ze lopen door de hele app.** Bij een nieuw spel staat er een rij schema's: groen-wit, rood-wit, geel-zwart, bordeaux-goud, en zo verder. Die kleur is niet alleen je logo — het is de accentkleur van alles: de actieve tab, de primaire knop, je balken, de rand van de kaart die je aandacht vraagt.

Dat kan makkelijk fout gaan. Wit op geel is onleesbaar, en marineblauw verdwijnt in een donkere achtergrond. Daarom gaat elke kleur door `src/ui/theme.ts` in plaats van er rechtstreeks in: dat rekent de relatieve helderheid en de contrastverhouding uit zoals WCAG ze definieert, kiest zwarte of witte tekst op basis daarvan, en trekt de accentkleur donkerder of lichter tot ze 4,5:1 haalt. Geel blijft dus geel op je logo en op de band bovenaan, maar wordt oker waar het tekst of een knop moet dragen. `test/theme.test.ts` controleert elk schema in beide thema's op vier punten, dus een nieuw schema kan er niet in glippen als het onleesbaar is. Een bestaand opslagbestand krijgt automatisch het schema dat het dichtst bij zijn oude clubkleuren ligt.

**De kopbalk, derde poging.** De tweede had een seizoensbalk met de 52 weken erin. Op zich bruikbaar, maar in een balk van tachtig pixels werd het drukte naast een logo dat je nauwelijks zag. Die balk staat nu op de kalender, waar ze breedte heeft en waar je ze zoekt. Wat overblijft krijgt de plaats die het verdient: het logo is 58 pixels in plaats van 40, de clubnaam staat er in koptekst, en je clubkleuren lopen als band over de bovenrand. Daarnaast staat wanneer het is, in drie korte stukken — `week 13/52`, `speeldag 6/30`, `volgende match deze week` — en dan je saldo en de twee knoppen.

**Wat levert dit personeelslid op?** Een vaardigheid van 75 zegt niets. Wat je wil weten is wat die 75 je koopt, en hoeveel beter dat is dan de 40 die je nu hebt. Dat stond nergens: je moest het afleiden uit "betere fysiek, stabielere vorm, minder blessures" en dan maar hopen. Op Personeel staat nu per persoon een rijtje kaartjes: `⚽ +3,1 Teamsterkte`, `🩹 −18% Blessurekans`, `👥 +12 Toeschouwers`, `🍺 +€0,14 Per bezoeker`. Bij een kandidaat is dat het verschil met wie je nu op die plaats hebt.

Die cijfers zijn niet overgeschreven uit de formules maar gemeten: `src/engine/impact.ts` maakt twee kopieën van je club, zet in de ene die persoon op die plaats en in de andere wie je nu hebt, en draait er dezelfde engine-functies op die het spel zelf gebruikt. Verandert een formule, dan verandert het kaartje mee. Het kan dus niet uit de pas lopen.

**Minder tekst, meer beeld.** Dat kaartje is meteen het antwoord op een tweede probleem: de tooltips waren goed maar lang, en lange uitleg lees je één keer en daarna scan je eroverheen. Een icoon met een getal lees je in een halve seconde, en je kunt er twee kandidaten mee vergelijken zonder iets te lezen — `🩹 −18%` naast `🩹 −7%`. De volle uitleg zit er nog steeds in, maar in de tooltip: daar staat ze voor wie ze wil, in plaats van in de weg voor wie ze niet nodig heeft.

**Ruimte.** De inhoud mag tot 1700 pixels breed, en op een breed scherm valt het dashboard zelf in twee kolommen: de geldkaart over de volle breedte, daaronder de posten naast de wedstrijd. Strategie staat in drie kolommen, de sponsorplaatsen zijn tien tegels op een rij in plaats van drie uitgerekte blokken met een rijtje kleintjes eronder, en de spelersselectie is een veld geworden met je kern ernaast — klik wie eruit moet, klik wie erin komt. De tabel met alle cijfers blijft bestaan, maar ingeklapt, voor wie wil sorteren op loon of contract. De inklappijltjes zijn daarbij echte ronde knoppen geworden in plaats van een grijs driehoekje van zes pixels.

## Laag 14

### 0.21.1 — De week begint met wat er op je ligt te wachten

**Het eerste wat een eigenaar doet als hij gaat zitten, is kijken wat er op hem ligt te wachten.** Dat stond in een smal kaartje rechts, onder de cijfers. Het staat nu bovenaan over de volle breedte, vóór alles: "Deze week", met een teller en de regels van dringend naar minder dringend. De beslissing van de week zit erin als eerste regel met de knop erbij, in plaats van in een eigen kaart ernaast — het is de hoofdtaak van de week, geen apart onderwerp. Elke regel zegt er nu bij wat er op het spel staat: dat biedingen na twee weken vervallen, dat je onder de elf spelers forfait geeft, dat wie je niet verlengt gratis vertrekt. Rood blijft voorbehouden aan echte problemen; de gewone weekbeslissing krijgt de clubkleur, anders staat er elke week een rode streep en went ze weg.

**De kopbalk was een etalage.** Vijf kerncijfers, drie clubscores en een datum, netjes naast elkaar — en sinds het dashboard diezelfde cijfers groot toont, stond alles er twee keer. Wat een kopbalk wél moet doen, doet hij nu: zeggen waar in het jaar je staat, en je laten verderspelen. Het nieuwe stuk is de seizoensbalk: de 52 weken in één streep, met elke speeldag als streepje, de winterstop als grijze band, de transferperiodes als groene banden, een merkteken waar jij staat en een rood streepje op de week van de eindstand. Daarmee zie je zonder na te denken of het venster nog open is, hoeveel weken je hebt tot de volgende match en wanneer de rust komt — precies de dingen waar je planning van afhangt. Eronder staat het in woorden: `week 9/52 · speeldag 2/30 · wedstrijd deze week`. Op een telefoon is de kopbalk daarmee ongeveer gehalveerd.

### 0.21.0 — Een dashboard in plaats van een spreadsheet

**Het probleem.** Alle informatie en alle keuzes voor een leuk spel zaten er al in, maar de manier waarop je ermee omging was chaotisch. Het overzicht was een stapel kaarten in de volgorde waarin ze ooit geschreven waren: clubscore, weekmoment, carrièredoel, seizoensdoelen, volgende wedstrijd, vorige week, aandachtspunten, saldo, logboek, nieuws. Wat je élke week nodig had stond onder wat je één keer per jaar bekeek. Daarbij kwam een groep "Club" met tien subtabs waarin alles belandde dat nergens anders paste.

**Het dashboard is opnieuw gebouwd, vanuit één vraag:** wat moet een eigenaar deze week weten en doen? Links de operationele kolom — je saldo, het resultaat van de week en de prognose over acht weken naast elkaar in grote cijfers; daaronder waar het geld heen ging als een liggende staafgrafiek in plaats van een tabel; daaronder je volgende wedstrijd. Rechts een smalle kolom met wat nu jouw handtekening vraagt, en hoe je ervoor staat bij de drie groepen die je club dragen. Nieuws staat onderaan: dat vertelt wat er gebeurd is, niet wat je moet doen.

**Cijfers met hun gevolg erbij.** Een score van 58 op publiek zegt niets. Er staat nu bij wat dat cijfer doet: `−23% aan de kassa en in de kantine`, met de exacte vermenigvuldiger in de uitleg. Bij sponsors staat wat er per week binnenkomt en hoeveel contracten wankelen; bij je clubscores de deelscores waaruit ze bestaan.

**Weg met de kaderlijnen.** De hele app draait op een nieuwe set tokens: kaarten zonder rand op een rustige ondergrond, met een schaduw in plaats van een lijn; kaarttitels als klein kapitaal zodat het cijfer eronder het beeld draagt; tabellen zonder verticale lijnen, met kopjes in klein kapitaal en cijfers rechts uitgelijnd in tabulaire cijfers. Eén accentkleur, en kleur verder alleen waar ze betekenis heeft.

**Het menu is opnieuw ingedeeld.** Geld kreeg een eigen tab (Financiën, Sponsors, Cijfers). De kalender hoort bij Competitie. Je langetermijndoel, de seizoensdoelen en het logboek staan nu samen bij Club › Doelen — die veranderen niet van week tot week en hoorden niet op het dashboard. "Wat beïnvloedt wat" verhuisde naar het menu, bij de handleiding.

**Tooltips die je kunt lezen.** De browsertooltip is klein, traag, staat waar je muis toevallig is en verdwijnt terwijl je leest. Er is nu één paneel rechtsonder in beeld, groot en rustig, altijd op dezelfde plek — dus je ogen weten waar te kijken, en de uitleg dekt nooit af waar je net naar wees. Werkt op hover, op tab en op aanraking.

**Getalvelden met knoppen die je kunt raken.** De pijltjes van `<input type="number">` zijn een paar pixels groot en staan op elke browser ergens anders. Elk getalveld in het spel heeft nu twee knoppen van volle hoogte met het tekstveld ertussen — intikken blijft dus de snelste weg als je precies weet wat je wil. Ingedrukt houden laat het getal doorlopen en versnelt, shift maakt de stap tien keer zo groot, en waar een duidelijk bereik bestaat staat er een schuifbalk onder. De cursor blijft staan waar hij stond, ook al tekent elke wijziging het scherm opnieuw.

**Kiezen waar je bezig bent.** "Wie doet wat" stond alleen op Personeel: wilde je vanuit de kantine je kantineverantwoordelijke de prijzen laten zetten, dan waren dat vier schermwissels voor één keuze. Bovenaan elk taakscherm staat nu dezelfde keuze voor de taken die daar thuishoren — kantine, clubwinkel, tactiek, opstelling, transfers, sponsors, ticketprijs, evenementen, infrastructuur, jeugd. Het is letterlijk dezelfde besturing, dus Personeel blijft de plek waar je alles naast elkaar ziet.

## Laag 13

### 0.20.0 — Drie investeerders, drie verschillende spellen

**Het probleem.** Er waren drie investeerders met drie bedragen: €600.000, €150.000 en €60.000. De voorwaarden verschilden op papier, maar in de praktijk was er weinig reden om níét voor het fonds te kiezen. Het grootste bedrag kocht het meeste, en de nadelen (een promotie-eis die zelden beet, 30% van je transferwinst) waren te zacht om daar tegenop te wegen. De bedoeling is niet dat alle drie evenveel opleveren, wel dat ze een ander spel zijn.

**Het fonds: veel geld nu, en een klok die blijft lopen.** Naast 30% van elke transferwinst nemen ze nu ook 20% van je prijzengeld, en daar valt niet aan te ontkomen — je kunt geen transfers laten om ze te ontwijken. De promotie-eis werkt weer: promoveer je drie seizoenen niet, dan trekken ze €300.000 terug en stappen ze op. De klok begint opnieuw bij elke promotie, dus de druk verdwijnt niet nadat je één keer geleverd hebt; het seizoen vóór de deadline krijg je een waarschuwing. En ligt er een stevig bod op een speler van 24 of jonger, dan tekenen zij zelf en hoor jij het achteraf. Het geld komt wel binnen — min hun aandeel, en min wat het met je kleedkamer en je tribune doet.

**De aannemer: matig geld, maar bouwen is zijn vak.** Zijn firma voert je werken uit, dus die kosten 15% minder en zijn een kwart sneller klaar, en je mag drie werven tegelijk open hebben in plaats van twee. Zijn naam op het stadion stond vroeger vast op €600 per week, waardoor zijn belangrijkste voordeel met elke promotie mínder waard werd terwijl de plek van de stadionsponsor wel bezet bleef. Die bijdrage schaalt nu mee met je reeks, en je krijgt er een bericht van als je stijgt of zakt.

**De coöperatie: bijna geen geld, maar een club die van de buurt is.** €60.000 om mee te beginnen, en daarna elk seizoen één ledenronde in de voorbereiding. Wat die opbrengt hangt af van je achterban, je reputatie en de sfeer — honderden kleine aandeelhouders uit de streek, dezelfde mensen die zondag aan de kassa staan. Elke ronde vraagt wat meer van dezelfde mensen (8% minder per keer) en kost een beetje sfeer. Daarbovenop tellen je vrijwilligers zwaarder door: het plafond op de vrijwilligersfactor ligt bij de coöperatie op 1,35 in plaats van 1,15. Wie zijn club echt laat groeien, haalt hier op termijn meer uit dan het fonds ooit gaf.

**Gemeten over zes seizoenen aan dezelfde club** (`npm run investors`), in de euro's van seizoen 1 — want het fonds legt zijn bedrag in week 1 op tafel, terwijl de andere twee jaar na jaar leveren in geld dat de inflatie elk seizoen wat uitholt. Een club die groeit en om de twee seizoenen promoveert: aannemer +€702.000, fonds +€595.000, coöperatie +€499.000. Dezelfde club die stilstaat en niet promoveert: aannemer +€436.000, fonds +€338.000 (de terugtrekking meegerekend), coöperatie +€167.000. Het fonds is dus nog steeds het meeste geld op dag één — en dat geld is bovendien meteen bruikbaar, wat een tabel niet kan uitdrukken — maar het is het enige van de drie waar je slechter uitkomt door níéts te doen. De aannemer betaalt zich terug in steen, de coöperatie in mensen, en beide alleen als je er iets mee doet. Op de balanscontrole (40 partijen van drie seizoenen, passief gespeeld) verandert er niets aan de hardheid: Zuidrand 36/9/38 failliet, Heidebeke 4/0/29.

**Twee voordelen die in de praktijk niets deden (0.20.1).** De vrijwilligersfactor liep tegen een hard plafond, en clubs zaten daar vanaf week één al tegenaan: Heidebeke start met achttien vrijwilligers en zat met 1,15 meteen vast. Daardoor was élke vrijwilliger die daarna bijkwam — en dus ook de +40% van de coöperatie en de +30% van de lokale figuur — letterlijk nul waard. Het plafond is een afvlakkende curve geworden: onder de veertien doet elke ontbrekende vrijwilliger nog even hard pijn, daarboven levert elk extra paar handen altijd nog iets op, alleen steeds minder dan het vorige. De coöperatie loopt naar een duidelijk hoger punt (1,55 tegenover 1,30). In dezelfde beweging kregen de coöperatie en de lokale figuur ook echt de +40% en +30% die de tekst altijd al beloofde; de code deed 1,30 en 1,25. En de stadionnaam van de aannemer volgt nu naast je reeks ook je reputatie en het prijspeil, en wordt elk seizoen herbekeken — dat contract wordt namelijk nooit heronderhandeld, terwijl elke andere sponsor om de één à drie seizoenen opnieuw tekent.

**In de schermen.** Bovenaan Financiën staat een investeerderskaart die in één zin zegt wat jouw investeerder voor je club betekent, met de actuele cijfers erin: bij het fonds hoeveel seizoenen je nog hebt, bij de aannemer wat de stadionnaam nu opbrengt, bij de coöperatie wat een ledenronde ongeveer zou opleveren en de knop om ze te houden. De handleiding heeft een item "Welke investeerder kies ik het best?" dat de drie naast elkaar zet.

## Laag 12

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
