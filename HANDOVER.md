# Waar we staan

*Momentopname van 24 september 2026, versie 0.50.0. Dit bestand veroudert; de README is het
levende logboek en git de waarheid.*

Geschreven om een gesprek dat in een chatvenster liep, elders te kunnen voortzetten. Alles wat
telt staat in de repo — de README beschrijft achttien lagen met het waarom erbij, `version.ts`
houdt de changelog bij, 726 tests leggen het gedrag vast. Wat hier staat is het enige dat
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

## De doorlichting van september 2026, en wat ermee gebeurd is

Een externe doorlichting van de rekenkern vond de motor achter "promoveren is gratis geld":
alle inkomsten hingen aan de reeks, terwijl de twee grootste kwaliteitsbronnen van een
uitbestedende club — eigen jeugd (kwaliteit "reeksniveau − 12" aan €40/week) en zittende
contracten (+14% per promotie tegen een lat van +45 à 62%) — buiten de loonlat vielen.
Daarbovenop: evenementen erfden de volledige reeksschaal in hun opbrengst (netto €714.000 per
seizoen in de Challenger Pro Liga), de licentie was een papieren grens (boete, geen blokkade),
degradatie liet sponsorbedragen staan (een degradatieseizoen draaide €981.000 winst), en 99%
van de thuiswedstrijden was uitverkocht zodat alle publieksknoppen dood stonden. De vier
meetscripts (`scripts/doorlichting-*.ts`) dragen die cijfers en zijn herbruikbaar.

Laag 18 (0.45.0 t/m 0.50.0) heeft dat omgebouwd naar **poorten per trede**: jeugd volgt je
jeugdwerking in plaats van je reeks; onderbetaalde spelers morren tot je bijbetaalt; een
speler beslist mee of hij wil komen (en wie boven zijn stand tekent, betaalt een premie);
evenementen zijn gasten × bedrag per gast, fysiek begrensd; zonder licentie voor de hogere
reeks gaat een promotie niet door; bij degradatie zakken sponsorbedragen mee (en beschermt
een lang contract); inflatie geldt voor sponsors, lonen, tv, premies en subsidies tegelijk;
en parking, onderhoud, supportersnorm en scoutbudget wijzen eindelijk de goede kant op.

**Gemeten na de ombouw** (`scripts/doorlichting-loonlat.ts`, 5 seeds × 6 seizoenen,
uitbestedende club):

| | voor laag 18 | na laag 18 |
|---|---|---|
| loon t.o.v. de lat, seizoen 6 | 76% | 100% |
| reeks in seizoen 6 | Challenger Pro Liga | 3de Nationale (licentie geweigerd) |
| winst per seizoen, seizoen 6 | ~€2,2M | ~€600k |
| evenementen netto per seizoen | tot €714.000 | €29.000 à €53.000 |

Niets doen blijft de harde bodem: 20/20 failliet in alle zes de startcombinaties
(`npm run balance`), omvallen rond seizoen 4 à 6.

## De open knoop: de bodemreeks is nog te zacht

De reeksladder is dicht — de uitbestedende club zonder investeringen strandt in
3de Nationale in plaats van door te klimmen naar de top. Maar de afspraak was **~2 op 20
faillissementen** voor "de beste betaalbare staf aanwerven en doorklikken", en die staat er
nog niet: die club wordt elk jaar kampioen van 3de Nationale (haar opgeleide jeugd tegen een
stilstaande reeks), krijgt elk jaar de licentie geweigerd, en draait daar €600.000 à €700.000
winst per seizoen. Het faillissementsrisico vraagt dat de **marge op de onderste treden**
smaller wordt — en dat is precies het geplande gesprek over de moeilijkheidsinstelling, want
dezelfde marge bepaalt hoe zwaar een beginnende, actieve speler het heeft.

Wat daarbij op tafel hoort:

- **"Onbemand is veilig."** Wie taken niet delegeert (of niet kán delegeren door het
  takenplafond), krijgt "niets doen" op die taak — en dat is op taakniveau bijna altijd
  veilig. Een club die nooit bouwt, hamstert geld. De vraag is of onbemande taken sluipende
  kosten horen te hebben.
- **Dominantie in de bodemreeks**: een kern die elk seizoen +10 à +16 boven een stilstaande
  reeks uitgroeit terwijl de licentie promotie blokkeert, wint alles zonder gevolg. Een
  reeks die haar kampioen ziet blijven, zou sterker terug moeten vechten (de wereld-AI
  investeert nu los van jou).

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
| `eventPrestige` | `actions.ts` | wat men per gast betaalt op jouw niveau |
| licentievereisten per reeks | `data/divisions.ts` | wat een trede kost om te mogen nemen |
| de spelerswil-curve | `appeal.ts` | hoe streng spelers jouw club wegen |

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
- De spelerswil staat op Transfers (kolom "Wil hij komen?"), maar de aantrekkingskracht van
  je club als geheel (`clubAppeal`) staat nog nergens als cijfer op een scherm. Wie wil weten
  waaróm spelers twijfelen, moet het uit de tooltip halen.

## Hoe je hier werkt

```
npm run dev          spelen (de motor draait in de browser: geen logbestand)
npm test             726 tests (mocha + chai)
npm run typecheck    tsc --noEmit
npm run autopilot    is uitbesteden nog risicoloos?   SEEDS=20 voor de echte lat
npm run economie     inkomsten en kosten per seizoen, naast je reeks
npm run balance      niets doen: gaat elke partij failliet?
npm exec tsx scripts/doorlichting-loonlat.ts       loon t.o.v. de lat, sterkte t.o.v. de reeks
npm exec tsx scripts/doorlichting-evenementen.ts   evenementen: netto en verhoudingen per reeks
VCG_LOG=debug ...    zet het logboek aan voor tests en scripts
```

**Testen mag, maar strategisch.** Niet elke ronde een volledige batterij: `npm test` altijd,
een browsercontrole alleen bij echte layoutwijzigingen, en `npm run balance` alleen als er iets
aan de economie verandert. Te veel tijd aan verificatie is verspilling.

**Werkwijze:** punt na punt afwerken, testen toevoegen, en een commit per betekenisvolle
wijziging — met in de commit wat er gemeten is, niet alleen wat er veranderd is.
