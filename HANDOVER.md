# Waar we staan

*Momentopname van 24 september 2026, versie 0.43.0. Dit bestand veroudert; de README is het
levende logboek en git de waarheid.*

Geschreven om een gesprek dat in een chatvenster liep, elders te kunnen voortzetten. Alles wat
telt staat in de repo — de README beschrijft zeventien lagen met het waarom erbij, `version.ts`
houdt de changelog bij, 679 tests leggen het gedrag vast. Wat hier staat is het enige dat
nergens anders in staat: de losse draden.

## Wat dit project is

Een turn-based browsersimulatie in het Nederlands waarin je **eigenaar** bent van een Belgische
voetbalclub, met de nadruk op de financiële kant. TypeScript en Vite, geen UI-framework.

Twee regels die alles sturen:

- **"Hoort dit bij een eigenaar of bij een trainer?"** Fijnmazig spelers managen hoort er niet
  in. Bij twijfel: niet doen.
- **Taal voor spelers vanaf tien jaar, uitdagend genoeg voor volwassenen, zonder kinderlijk te
  worden.** Geen jargon zonder uitleg, geen betutteling.

En één methode: **meten, niet beweren.** De cijfers op het scherm komen uit dezelfde functies
die de motor gebruikt, zodat het scherm niet iets anders kan zeggen dan er gebeurt. Bij twijfel
over balans wordt er gemeten, en als de meting iets anders zegt dan ik beweerde, gaat de
correctie in de README. Er staan meerdere van mijn eigen foute conclusies in, met de meting die
ze onderuithaalde. Dat hoort zo.

## De open knoop: uitbesteden is nog te veilig

Dit is de draad waar we middenin zitten.

De afspraak: **alles uitbesteden mag niet risicoloos zijn.** Wie de perfecte staf heeft en zelf
goed inschat, mag 18 op 20 halen en nooit failliet gaan — maar dat moet moeilijk en duur zijn.
Wie de beste betaalbare mensen aanwerft en dan doorklikt, hoort er af en toe onderuit te gaan:
ongeveer **2 op 20**.

Gemeten met `npm run autopilot` (8 partijen, 6 seizoenen, 48 partijen per stijl):

| speelstijl | failliet |
|---|---|
| uitbesteden aan de staf die je al hebt | 11/48 — dit werkt |
| de beste betaalbare aanwerven, dan doorklikken | **0/48** — dit is de knoop |
| elke rol kopen die er te koop is | 0/48 |

Wat ik al geprobeerd heb en wat het opleverde:

- **Personeel zwakker maken** (0.41.0: minder taken per persoon, zwaardere straf buiten het
  vakgebied). Hielp, maar niet genoeg. De oorzaak zit er niet.
- **De kostenkant indexeren op je reeks** (0.42.0). Dit was een echte fout die ik bij toeval
  vond: op de inkomstenkant was álles geïndexeerd op je niveau — sponsorbedragen ×0,6 tot ×8,
  tv-geld van niets naar €30.000/week, publiek van 250 naar 10.000 — en op de kostenkant stond
  niets. Elke promotie was gratis geld. Nu hebben reeksen een loonlat en een weekkost. Niets
  doen gaat daardoor rond seizoen 4 failliet in plaats van 6, en de kosten van een
  uitbestedende club verdubbelden. Maar de middelste kolom bleef 0.

**Wat er overblijft.** Die club blijft winnen met een goedkope kern. De tegenstand loopt van
sterkte 52 in 3de Nationale naar 70 in de Challenger Pro Liga, en dat is te weinig om een
goedkope ploeg tegen te houden. Dat cijfer is precies de knop die eerder bewust de andere kant
op is gedraaid, toen wedstrijden winnen te moeilijk voelde bij actief spelen.

**Daar zit de spanning, en die is echt:** "actief spelen moet lonen" en "uitbesteden mag niet
risicoloos zijn" bijten in hetzelfde getal. Dat hoort in het gesprek over de
moeilijkheidsinstelling, niet in een stille tuning. Dat gesprek staat gepland met één
samenhangende meting over alle speelstijlen tegelijk.

## De moeilijkheidsinstelling (gepland, nog niet begonnen)

Makkelijk / normaal / moeilijk. De knoppen die er in aanmerking voor komen, allemaal al
geïsoleerd in code:

| knop | waar | wat hij doet |
|---|---|---|
| `opponentStrength` | `data/divisions.ts` | hoe sterk de reeks is waarin je speelt |
| `wageFactor`, `weeklyCost` | `data/divisions.ts` | wat meespelen op dat niveau kost |
| `sponsorFactor`, `sponsorWeekly` | `data/divisions.ts`, `sponsors.ts` | hoe hard sponsorgeld meegroeit |
| `WEAR_PEAK` | `league.ts` | hoe hard tegenstanders doorheen een seizoen verslijten |
| `STAR_RATIO` en de sterfactoren | `stars.ts` | hoeveel een sterspeler opbrengt |
| `STAR_EFFICIENCY`, `MIN_SUPPORT` | `delegation.ts`, `support.ts` | hoe goed uitbesteed werk is |

## Andere open draden

- **Twee schermen zijn te lang**: Personeel (~5100px) en Agenda (~3900px). Genoemd, nooit
  aangepakt.
- **Winston**: de logmodule (`src/log/`) heeft winston-vormige niveaus en records, maar geen
  afhankelijkheid. Wil je echt winston op een server, dan volstaat één bestemming van vijftien
  regels; de motor hoeft niet aangeraakt te worden.

## Publiceren: Cloudflare Workers + statische assets (logendpoint live)

David wil vrienden, familie en kennissen laten spelen — niet om geld te verdienen of populair te
worden, gewoon om te delen. David heeft zelf een Cloudflare-account gemaakt en de GitHub-repo
(genaamd `matchday`, andere naam dan de projectmap) via "Ship product" gekoppeld. **Het spel staat
sinds 24/09/2026 live op `https://matchday.falling-term-2bcc.workers.dev`** — dat is voorlopig het
adres om te delen, tot er een eigen domeinnaam aan hangt.

**Correctie op de vorige aanname.** Eerst was het plan "Cloudflare Pages" met een `functions/`
map (Pages Functions). De echte eerste build faalde, en daaruit bleek dat Cloudflare's huidige
"Ship product"-knop een ander, nieuwer model gebruikt: **Workers met statische assets**, één
Worker-script (`wrangler deploy`, niet `wrangler pages deploy`) dat naast de gebouwde site draait.
`functions/api/log.ts` (Pages Functions-vorm) werd daardoor nooit aangeroepen — dat bestand is
weg. In de plaats:

- `worker/index.ts`: de Worker zelf. Bedient alleen `/api/log` (routering via `wrangler.jsonc`,
  `assets.run_worker_first`); al het overige gaat rechtstreeks naar de gebouwde site zonder dit
  bestand ooit aan te roepen.
- `wrangler.jsonc`: het project heet `matchday` (zelfde naam die Cloudflare al had gekozen),
  `assets.directory` wijst naar `dist`, `not_found_handling: single-page-application` zodat
  client-side routes werken, `observability.enabled: true` — dat is Cloudflare's eigen
  Workers Logs, ontvangt automatisch alle `console.log` uit de Worker, doorzoekbaar in hun
  dashboard. Geen aparte logdienst nodig.
- `vite.config.ts` kreeg de `@cloudflare/vite-plugin` (`plugins: [cloudflare()]`) — zonder die
  plugin kan `wrangler deploy` de Worker niet naast de site bouwen. **Dit verandert de
  buildstructuur**: `npm run build` levert nu `dist/client/` (de site) en `dist/matchday/` (de
  gebundelde Worker + een herschreven `wrangler.json` met de juiste relatieve paden) in plaats
  van platte bestanden in `dist/`. `npm run dev` en `npm run preview` draaien nu ook via de
  Cloudflare-runtime (workerd) in plaats van kale Vite — beide lokaal getest en ze werken, `/api/log`
  antwoordt 204 tijdens `npm run dev`.
- `src/log/browser.ts` (ongewijzigd sinds het vorige punt): bundelt regels per seconde en stuurt
  ze naar `/api/log` in productie (`import.meta.env.PROD`); tijdens `npm run dev` is er geen
  endpoint nodig — dat draait nu lokaal toch al mee via de Cloudflare-plugin, maar bewust nog niet
  aangezet, zodat lokaal testen niet tussen de regels van echte spelers belandt.
- `src/log/parseRecords.ts`: de validatie van binnenkomende logregels, losgetrokken van het
  ontvangststuk zodat zowel `worker/index.ts` als de tests dezelfde regel gebruiken.

**Gemeten, niet alleen beweerd — nu ook op de echte infrastructuur.** Na de push deployde
Cloudflare zelf zonder fouten. Live gecontroleerd met curl tegen
`https://matchday.falling-term-2bcc.workers.dev`:

| verzoek | verwacht | gemeten |
|---|---|---|
| `GET /` | 200, de site | 200 |
| `POST /api/log` met een geldige regel | 204 | 204 |
| `GET /api/log` (verkeerd werkwoord) | 405 | 405 |
| `GET /een-onbestaand-pad` | 200, valt terug op de site (SPA) | 200 |

690 tests groen (11 in `test/log-server.test.ts`). Dit is de eerste laag in dit project die niet
alleen unit-getest is, maar ook echt op de doelinfrastructuur gemeten — dat hoort in het
"meten, niet beweren"-rijtje.

**Bewust nog niet gedaan:**

- Geen rate-limit of gedeeld geheim op `/api/log` — bekende, openstaande knoop.
- Geen CHANGELOG-item in `version.ts` en geen nieuwe README-laag: er verandert niets voor de
  speler, en de infrastructuur is nog niet op de echte Cloudflare-omgeving gemeten.
- **Cloudflare's "agent-setup" aanbod afgewezen, niet stilzwijgend genegeerd.** Cloudflare toonde
  David een prompt om `https://developers.cloudflare.com/agent-setup/prompt.md` te laten
  uitvoeren. Dat document vraagt om een Cloudflare-pluginmarktplaats in Claude Code te installeren
  en MCP-servers te koppelen met OAuth naar zijn Cloudflare-account — een account-brede koppeling,
  niet iets wat nodig was om dit specifieke buildprobleem op te lossen. Dat is bewust niet gedaan
  zonder het eerst voor te leggen.

**Andere punten die David expliciet niet wil laten sneeuwen, nog niet aangepakt:**

- Logniveau in productie bewust kiezen (nu `debug`, zoals de taaklogs dat altijd al waren) — bij
  veel gelijktijdige spelers kan dat tegen de gratis-tier requestlimiet aanlopen. Batching (max 50
  regels of 1×/seconde) dempt dit al fors, maar is nooit tegen echt verkeer gemeten.
- Saves zitten alleen in `localStorage` — ander toestel of gewiste cache is het spel kwijt. Geen
  blocker, wel iets om ergens te vermelden of met een export/import-knop op te vangen vóór er
  echte accounts zijn.
- Geen crash-vangnet: het logboek vangt beslissingen van personeel, geen JS-fouten die een
  speler bij David nooit meldt. Een `window.onerror`/`unhandledrejection` naar hetzelfde endpoint
  (level `error`) is een voor de hand liggende volgende stap.
- De oude GitHub Actions-pipeline (`ci/github-actions.yml`) test en publiceert nog naar GitHub
  Pages. Moet omgebouwd worden zodra Cloudflare de echte hosting is, anders bestaan er twee
  "live" adressen naast elkaar.
- `scripts/investor-value.ts` haakt als enige script het logboek niet aan.

## Hoe je hier werkt

```
npm run dev          spelen (de motor draait in de browser: geen logbestand)
npm test             679 tests (mocha + chai)
npm run typecheck    tsc --noEmit
npm run autopilot    is uitbesteden nog risicoloos?   SEEDS=20 voor de echte lat
npm run economie     inkomsten en kosten per seizoen, naast je reeks
npm run balance      niets doen: gaat elke partij failliet?
VCG_LOG=debug ...    zet het logboek aan voor tests en scripts
```

**Testen mag, maar strategisch.** Niet elke ronde een volledige batterij: `npm test` altijd,
een browsercontrole alleen bij echte layoutwijzigingen, en `npm run balance` alleen als er iets
aan de economie verandert. Te veel tijd aan verificatie is verspilling.

**Werkwijze:** punt na punt afwerken, testen toevoegen, en een commit per betekenisvolle
wijziging — met in de commit wat er gemeten is, niet alleen wat er veranderd is.
