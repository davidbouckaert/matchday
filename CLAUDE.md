# Matchday — Clubeigenaar

Turn-based browsersimulatie in het Nederlands: jij bent **eigenaar** van een
Belgische voetbalclub, met de nadruk op de financiële kant. TypeScript + Vite,
geen UI-framework. De motor in `src/engine` is DOM-vrij en deterministisch
(geseede RNG in `state.rngState`); `advanceWeek(state)` geeft een nieuwe state
terug. Draait live op Cloudflare.

**Antwoord altijd in het Nederlands.** Commitboodschappen, code-commentaar,
changelog en README zijn Nederlands.

## Lees dit eerst

- `HANDOVER.md` — waar het project staat en welke draden openstaan
- `README.md` — het ontwerplogboek per laag, met de metingen en de redenering
  erbij. Ook mijn eigen foute conclusies staan erin, met de meting die ze
  onderuithaalde. Dat is bewust.

Ga bij twijfel over "waarom is dit zo" eerst in de README kijken voor je iets
verandert. Veel van wat willekeurig lijkt, is een keuze met een meting eronder.

## Ontwerpregels

- **"Hoort dit bij een eigenaar of bij een trainer?"** Fijnmazig spelersbeheer
  hoort er niet in. Bij twijfel: niet doen.
- **Taal voor spelers vanaf tien jaar, uitdagend genoeg voor volwassenen,
  zonder kinderlijk te worden.** Geen jargon zonder uitleg, geen betutteling.
- **Meten, niet beweren.** Een balansbewering zonder meting is geen bevinding.
  Zegt de meting iets anders dan verwacht: zeg dat, en zet de correctie in de
  README.
- **Wat op het scherm staat, komt uit dezelfde functies die de motor gebruikt.**
  Nooit een getal apart uitrekenen voor de weergave — dan kan het scherm iets
  anders beweren dan er gebeurt.
- **Logging is voor ontwikkelaars, niet voor spelers.** De rekenkern logt
  waarden via `src/log`, op niveau debug. Nooit in een scherm, nooit in de
  browserconsole, nooit in de opgeslagen speelstand.

## Werkwijze

- Punt na punt afwerken. Geen grote sprongen zonder overleg.
- Testen toevoegen bij elke wijziging. Een test beschrijft bedoeld gedrag, dus
  schrijf hem in het Nederlands, met erboven waaróm hij bestaat.
- **Testen mag, maar strategisch.** `npm test` altijd. Een browsercontrole
  alleen bij echte layoutwijzigingen. De meetscripts alleen als de economie
  verandert. Te veel tijd aan verificatie is verspilling.
- Commitboodschap zegt wat er **gemeten** is, niet alleen wat er veranderd is.
- Botsen twee eisen met elkaar: zeg dat, los het niet stil op in mijn nadeel.
- **Versie hoort bij de merge, niet bij de branch.** Een feature-branch/PR
  raakt `src/version.ts` nooit aan — geen VERSION-bump, geen CHANGELOG-item in
  de diff. Anders bumpen twee branches vanaf hetzelfde nummer, of wijst een tag
  na een merge (zeker bij squash) niet meer naar de commit die echt op `main`
  staat. Pas ná het mergen naar `main`, op de dan-actuele `main`: versienummer
  + changelog in `src/version.ts` (README-laagvermelding bij een minor, alleen
  changelog bij een patch) → commit met wat er gemeten is → tag `vX.Y.Z` →
  `git push origin main --tags` → op de achtergrond `/api/version` pollen tot
  de versie live staat. `npm run release -- --type=patch|minor --title="..."
  --item="..."` doet de VERSION- en CHANGELOG-bewerking in `src/version.ts`
  voor je (en weigert te draaien buiten `main`) — de rest van de vaste gang
  (committen, taggen, pushen, pollen) blijft met de hand. Gebeuren er twee
  merges vlak na elkaar, rond dan de release-stap van de eerste helemaal af
  vóór je aan de tweede begint. UI-werk eerst met Playwright-schermafdrukken
  (voor én na) uit de draaiende app verifiëren.

## Commando's

    npm test           de testsuite (mocha + chai)
    npm run typecheck  tsc --noEmit
    npm run dev        lokaal spelen
    npm run balance    niets doen: gaat elke partij failliet?
    npm run autopilot  is uitbesteden risicoloos? SEEDS=20 voor de echte lat
    npm run economie   inkomsten en kosten per seizoen, naast je reeks
    npm run release    bumpt VERSION + CHANGELOG in src/version.ts (alleen op main, na een merge)

Zet `VCG_LOG=debug` ervoor om het logboek van de rekenkern mee weg te schrijven
naar `logs/`.

## Vallen bij het meten

Hier is dit project al in gelopen:

- **Meet lang genoeg.** Een venster van drie seizoenen verborg dat niets-doen
  pas in seizoen vier of vijf omvalt. Zes seizoenen is het minimum.
- **Laat een bot de spelregels volgen.** Een bot die onder de harde ondergrens
  van de kern zakt zonder spelers te kopen, meet een club die in het echte spel
  niet eens verder kan klikken.
- **Meet niet terwijl er gebouwd wordt.** Een meting heeft een stilstaand
  onderwerp nodig.
