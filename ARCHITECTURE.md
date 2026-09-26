# ARCHITECTURE — Matchday

*Levend document: huidige architectuur, doelarchitectuur en beslissingen. Wie/hoe staat in
[DEVELOPMENT_PLAYBOOK.md](DEVELOPMENT_PLAYBOOK.md); wat/wanneer in [ROADMAP.md](ROADMAP.md).
Laatst bijgewerkt: 26 september 2026, tegen code op `main` v0.84.5, na Astra's review en de
PO-beslissingen accounts + Clerk.*

Legenda: **[BESLOTEN]** vastgelegde beslissing (zie §12 voor eigenaar/rationale) ·
**[HUIDIG]** geverifieerd feit in de repo · **[VOORGESTELD]** richting, nog geen beslissing ·
**[OPEN]** beslissing vereist · **[AANNAME]** vóór implementatie opnieuw verifiëren.

## 1. Huidige architectuur [HUIDIG]

| Laag | Feit (geverifieerd 26 sep 2026) |
|---|---|
| Applicatie | TypeScript + Vite, HTML-template-UI zonder framework; spelerstaal Nederlands 10+ |
| Motor | `src/engine`: DOM-vrij, deterministisch (geseede mulberry32 in `state.rngState`); `advanceWeek(state)` → nieuwe toestand; aparte cosmetische anim-RNG; 886 tests (mocha/chai, Nederlands) |
| Lokale opslag | IndexedDB via `SaveStore` in `src/storage/save.ts`; `SAVE_VERSION` 41 met doorlopende migratieketen; JSON-export/-import als back-up-/herstelroute. **IndexedDB is origin-gebonden**: saves verhuizen niet vanzelf mee naar een ander domein (zie OPEN-7) |
| UX-patronen | Zie [PLAYBOOK §2 — bewezen UX-invarianten](DEVELOPMENT_PLAYBOOK.md#2-bewezen-matchday-ux-invarianten-uit-slices-13); technisch gedragen door `signals.ts` (statusprojectie), previews via `structuredClone` + echte acties, adaptieve workflows ≤1100px, `task-context.ts` (terugkeer) |
| Server | Eén Cloudflare Worker (`worker/index.ts`) achter `wrangler.jsonc`: statische assets uit `dist/` (SPA-fallback), `run_worker_first` op `/api/*`; endpoints `/api/version` en `/api/log`; observability aan; **geen** D1/R2/KV-bindings |
| CI/CD | `release.yml` op push naar main: `npm ci` + versiebump/changelog/tag via PR-titel en `release:minor`-label; **geen tests/typecheck/build in workflows**; `claude.yml`/`claude-code-review.yml` zijn agent-automatisering, geen testbewijs |
| Deploy | Cloudflare bouwt/publiceert bij push naar main (gedrag waargenomen via `/api/version`). Exacte buildtrigger: **[AANNAME]** — in fase 0 vastleggen |
| Meetgereedschap | `npm run balance` / `autopilot` / `economie` / `scripts/doorlichting-*.ts` — verplicht bij economiewijzigingen (CLAUDE.md) |

## 2. Doelarchitectuur online [BESLOTEN richting, gefaseerd]

**Local-first.** De deterministische motor blijft voorlopig client-side.
Redenen: sterke bestaande asset, lokaal spel behouden, lage latency, lage operationele
kosten, privacy, uitgebreide tests, reproduceerbaarheid.

De motor blijft environment-agnostisch en DOM-vrij, zodat later mogelijk is:

```text
client-simulatie → seed + actielog → server-replay/validatie
```

of, uitsluitend indien commercieel/competitief noodzakelijk, een server-authoritative
motor. **We verhuizen de motor niet server-side om JavaScript te verbergen** (§8).

### Verantwoordelijkheden client ↔ server

| Kant | Verantwoordelijk voor |
|---|---|
| Client | Spelmotor en -simulatie, presentatie, lokale saves (IndexedDB blijft primair), doorspelen bij netwerkuitval in een al geladen app, diagnose-ringbuffer |
| Workers (API) | Clerk-verificatie achter de identity boundary, sessies, RBAC + ownership-checks, save-sync, admin-API, telemetrie-endpoints, auditoperaties, rate limiting |
| D1 | Relationeel: users (interne ID + externe authkoppeling), rollen, save-index/metadata, entitlements (later), auditregels, feature flags |
| R2 | Blobs: save-bestanden (gecomprimeerd, versie-envelope), back-ups, diagnosepakketten |

Cloud-save is **synchronisatie/recovery bovenop local-first**, geen verplichte
server-authoritative game.

### Offline — precies geformuleerd [HUIDIG + OPEN]

Local-first betekent nu concreet:

| Gedrag | Status |
|---|---|
| Doorspelen in een al geladen app terwijl het netwerk wegvalt | HUIDIG (motor en save zijn lokaal) |
| Lokale save-veiligheid bij netwerkuitval | HUIDIG |
| Latere synchronisatie zodra netwerk terug is | doel van fase-sync (P0-launchpad) |
| **App volledig offline heropenen** (browser dicht, netwerk uit, opnieuw openen) | **NIET gegarandeerd** — vereist expliciet service worker/PWA-werk; OPEN-8, niet in launchscope |

## 3. Identiteit, auth en privacy

### Clerk als v1-authrichting [BESLOTEN — zie ADR in §12]

Clerk is gekozen als managed authprovider voor de eerste publieke accountimplementatie.
MFA en passkeys zijn géén launchvereisten. De beslissing is bewust omkeerbaar gehouden
door de volgende **harde architectuurregel**:

**Clerk blijft achter een Matchday-eigen auth-/identity-boundary.** Clerk-specifieke user-/
sessietypes verspreiden zich niet door engine-/game-/domeincode.

```text
Clerk
  ↓
Matchday auth-adapter / identity boundary
  ↓
MatchdayIdentity  (interne user-ID · geauthenticeerde staat · noodzakelijke koppeling)
  ↓
D1 / Matchday-autorisatie  (rol · accountmetadata · later entitlements)
```

Exact type-/API-ontwerp hoort bij de implementatiespecificatie, niet bij dit document.

### Privacy [BESLOTEN principe]

**Data die we niet verzamelen, kan niet lekken** — Matchday slaat alleen op wat het echt
nodig heeft. Belangrijke precisering: **Clerk verwerkt als authprovider wél
identiteitsgegevens** (verwerkersrelatie). "Matchday bewaart alleen een ID" betekent dus
niet dat nergens in de keten persoonsgegevens verwerkt worden. Die verwerkersrelatie
(doel, welke gegevens, verwerkersovereenkomst) hoort bij het privacywerk dat **vóór
publieke accountcollectie** af moet (launch gate D; minderjarigen-/GDPR-review vóór brede
collectie — het spel richt zich op 10+).

Ook: in-game tekstvelden (eigenaars-/clubnaam) zijn speldata en geen accountidentiteit,
maar een gebruiker kán er persoonsidentificerende tekst in zetten — claim dus nooit dat
speldata per definitie geen persoonsgegevens kunnen zijn.

### Voorlopige datainventaris (launch) [VOORGESTELD, te bevestigen bij privacywerk]

| Categorie | Inhoud | Waar |
|---|---|---|
| Authprovider-data | Wat Clerk noodzakelijkerwijs verwerkt voor authenticatie | Clerk (verwerker) |
| Matchday-accountdata | Interne user-ID; externe authkoppelings-ID; rol; created/updated-timestamps; verdere metadata alleen bij concrete productbehoefte | D1 |
| Speldata | Saves, spelinstellingen, fictieve in-game inhoud | IndexedDB + R2 |
| Operationele data | Audit, logs, diagnostiek (met de waarborgen uit §6) | D1 / Workers Logs / R2 |

Geen profielvelden verzamelen omdat Clerk ze aanbiedt.

### Autorisatie blijft van Matchday [BESLOTEN]

Provider-identiteit ≠ Matchday-autorisatie. Rollen (`PLAYER`, `TESTER`, `ADMIN`; later
alleen indien nodig `SUPPORT`/`MODERATOR`) zijn een Matchday-concept in D1. Strikt
gescheiden: **RBAC ≠ spelvoortgang ≠ commerciële entitlements.** De server controleert
altijd autorisatie **én** save-ownership. Verborgen frontendknoppen zijn nooit security.

## 4. Account-/save-garanties (launchcontract)

Deze garanties zijn het productcontract; het exacte sync-algoritme volgt eruit (OPEN-3) en
definieert ze nooit achteraf. Uitwerking gebeurt op het gezamenlijke checkpoint
(ROADMAP §Checkpoint).

| Situatie | Garantie |
|---|---|
| Lokale voortgang vóór login | Wordt **nooit stil vernietigd** doordat iemand inlogt of een account aanmaakt |
| Accountcreatie/koppeling | Bestaande lokale voortgang wordt **niet stil overschreven** door een leeg/nieuw cloudaccount |
| Lokale save | Betrouwbare lokale-save-staat volgens de bestaande IndexedDB-architectuur blijft bestaan |
| Sync-onderscheid | Het product kan conceptueel onderscheiden: lokaal opgeslagen · sync in behandeling · cloud bevestigd · sync mislukt/offline (niet elke staat vergt een permanente grote indicator) |
| Offline / sessie verlopen / syncfout | Spelvoortgang blijft lokaal veilig; begrijpelijk herstel-/retrygedrag; **tijdelijke netwerkfout wordt nooit game-state-verlies** |
| Conflict | Nooit stil één afwijkende save weggooien; beide versies bewaard vóór destructieve resolutie; bij gebruikerskeuze worden saves geïdentificeerd met betekenisvolle spelcontext (club, seizoen, week, bijgewerkt-tijdstip) |
| Logout/accountwissel | Expliciet gedefinieerd wat er gebeurt met lokale save, ongesyncte voortgang en gecachte accountdata; **geen stille ownership-overgang tussen gebruikers** |
| Herstel | De speler begrijpt wat herstelbaar is, waarvandaan, en wat er gebeurt als herstel faalt |
| Tester/admin | Omgeving, actieve save en bevoegdheid herkenbaar; destructief/reset-gedrag altijd expliciet |

## 5. Admin en testmodus [VOORGESTELD, richting vastgelegd]

**Launchminimum-admin** (zie ROADMAP §Minimum-admin): gebruiker identificeren/ondersteunen,
account-/save-metadata inzien, veilig herstellen/resetten, rollen toekennen,
launchtroubleshooting — via gecontroleerde adminacties met auditregistratie. Géén directe
willekeurige DB-manipulatie als beheerinterface. Het rijke adminplatform is LATER.

**Testmodus** (rol-gated TESTER/ADMIN, ná launch tenzij afhankelijkheid): (A) scenario's
(bijna-faillissement, licentieprobleem, seizoensovergang, blessurecrisis) op bestaande
fixture-helpers; (B) gecontroleerde inspector-acties (kas, naam, week/seizoen, reset
geselecteerde testsave). Testacties lopen via gecontroleerde functies; geen
productie-database-clear vanuit de game; staging-/testdata gescheiden van productie.

**Codeleveringsprecisie:** lazy geladen/code-gesplitste admin-/tester-UI **verkleint de
blootstelling van de normale spelersbundel, maar beschermt zelf niets** — server-side
autorisatie beschermt de acties. Moet de code zelf niet publiek ophaalbaar zijn, dan
vereist dat een apart beschermd leveringspad (bv. achter authenticatie geserveerd).

## 6. Logging en observability [VOORGESTELD, richting vastgelegd]

| Laag | Inhoud | Kanaal (richting) |
|---|---|---|
| 1. Infrastructuur | Worker-errors, latency, D1/R2/netwerk/deployments | Cloudflare-observability (staat aan) |
| 2. Applicatie/API | Structured logs: request-/correlatie-ID, endpoint, status, duur, versie. **Nooit** wachtwoorden, tokens of volledige saves in standaardlogs | Workers Logs |
| 3. Audit | Registratie van gevoelige beheeracties (actor, actie, doelwit, timestamp, resultaat), **beschermd tegen wijziging door gewone applicatierollen, met gedefinieerde retentie en geprivilegieerde beheercontroles** — geen belofte van absolute onveranderbaarheid | D1-tabel |
| 4. Motor-diagnostiek | Determinisme benutten: checkpoint/save + seed/RNG-state + actielog + engineversie + beslissingslog (`src/log` bestaat al) = reproduceerbare bug | client-ringbuffer + "Stuur diagnose" |

"Stuur diagnose" (of gelijkaardige toekomstige functionaliteit) **legt vóór verzending uit
wat er gedeeld wordt** en verstuurt alleen na bewuste actie van de gebruiker. Geen centrale
permanente dump van iedere volledige save bij iedere actie.

**Leveringscontract diagnosepakket [toekomstige implementatie-eis]:** "verzoek verstuurd"
is níét hetzelfde als "diagnose veilig ontvangen". Een diagnose-inzending geldt pas als
geslaagd nadat de backend **duurzame acceptatie/opslag bevestigd** heeft. Het toekomstige
contract levert minimaal:

- duurzame opslag passend bij het diagnoseontwerp;
- serverbevestiging van ontvangst;
- een diagnose-/support-ID dat aan de gebruiker wordt teruggegeven;
- een begrijpelijke geslaagd-staat én een begrijpelijke mislukt-staat;
- retrygedrag dat geen dubbelzinnige duplicaten veroorzaakt;
- privacy-uitleg vóór verzending (zie hierboven);
- **geen aanname dat het huidige `/api/log`-endpoint deze garanties biedt** — dat doet het
  niet; het is een fire-and-forget-logkanaal.

## 7. Staging, productie, back-up, quota [VOORGESTELD, fase 0/kritiek pad]

- Staging: eigen Worker-omgeving met **eigen** D1/R2; test-/adminacties kunnen productie
  fysiek niet raken. Productiepromotie pas na staging-smoke; rollback via Workers-versies.
- Back-up/recovery: R2-saveblobs versioneren; D1-export in het deploy-draaiboek;
  client-side JSON-export blijft de gebruikerszijde van herstel. Back-upcompatibiliteit en
  rollback **over schema-/saveversies heen** horen bij het ontwerp (migratieketen bestaat al
  client-side; zelfde discipline server-side).
- **Gedrag bij uitputting/uitval definiëren vóór implementatie:** wat gebeurt er bij
  quota-uitputting (D1/R2/Workers/Clerk) en bij een onbereikbare clouddienst? Uitgangspunt:
  de game en de lokale save blijven werken (§2 offline-precisie); sync meldt begrijpelijk
  en probeert later opnieuw.

## 8. Security-grenzen [BESLOTEN]

Expliciet geaccepteerd: **JavaScript dat naar de browser gaat, kan bekeken en gekopieerd
worden. Obfuscatie is geen security-grens** — en code-splitsing evenmin (§5).

Maatregelen: productie-minificatie; geen publieke sourcemaps (privé waar nodig);
productie-console-/debugbeleid; CSP/security-headers; secrets nooit client-side
(Cloudflare-/GitHub-secretstorage); autorisatie + ownership server-side; rate limiting en
Turnstile waar passend; auth-/sessie-endpoints beschermd; technische release-details
intern, publieke changelog beschrijft spelerimpact (bestaande conventie).

## 9. CI/CD-doelpad [VOORGESTELD, fase 0 start]

```text
featurebranch → PR → verplichte checks (npm test · typecheck · production build) →
preview waar passend → onafhankelijke review → merge → staging → migraties → smoke test →
productiepromotie/release → versiecontrole (/api/version) → rollbackmogelijkheid
```

**Doelcontract productie-uitrol — staging is een echte promotiepoort:**

- de revisie die naar productie gaat, heeft eerst de verplichte validatie doorlopen
  (checks + staging-smoke);
- **dezelfde geteste revisie/hetzelfde artefact wordt gepromoveerd** naar productie —
  productie bouwt of deployt niet zelfstandig een andere, ongeverifieerde revisie;
- staging is een verplichte tussenstap in de promotieketen, geen optionele parallelle
  omgeving;
- **de huidige directe main → productie-publicatie wordt vervangen/uitgeschakeld zodra de
  nieuwe staging-/promotiepijplijn actief is.** Tot dat moment blijft de bestaande gang
  gewoon werken; de omschakeling gebeurt als bewuste migratiestap in de geautoriseerde
  CI/CD-implementatiefase, zodat lopende releases niet per ongeluk breken. [VOORGESTELD —
  nog niet doorgevoerd]

Nightly/periodiek: economie-/autopilot-/langlopende simulaties buiten de PR-latency. De
bestaande release-automation blijft de release-eigenaar; de handmatige gang is uitsluitend
een gemarkeerd noodpad (zie CLAUDE.md).

## 10. Open beslissingen

| # | Vraag | Opties + trade-offs (kort) | Eigenaar | Deadline | Status |
|---|---|---|---|---|---|
| OPEN-3 | Exact sync-/conflictalgoritme | last-write-wins + prompt · merge · server-authoritative save · client-authoritative save · revisiestrategie — keuze volgt uit het checkpoint-contract en de garanties in §4, niet omgekeerd | Fable + Astra stellen voor, David beslist | vóór dag 7 | OPEN |
| OPEN-4 | Telemetrie-retentie/granulariteit | sampling vs. volledig; bewaartermijn; pseudonimisering | David | vóór fase 3 | OPEN |
| OPEN-5 | Bevestiging launchminimum-admin | ROADMAP §Minimum-admin volstaat? | David | vóór dag 7 | OPEN |
| OPEN-6 | Monetisatie-start (fase 4-trigger) | supporter/premium via betalingsprovider; nooit kaartdata zelf | David | later | OPEN |
| OPEN-7 | Publieke productie-origin/domein | workers.dev vs. eigen domein. **Weegt zwaar: IndexedDB-saves zijn origin-gebonden en verhuizen niet mee** | David | **vóór dag 7, vóór eerste externe blijvende saves** | OPEN |
| OPEN-8 | Offline heropenen (service worker/PWA) | nu niet ondersteund; buiten launchscope | David | na launch | OPEN |

Gesloten: OPEN-1 (accounts vereist voor go-live) en OPEN-2 (Clerk) — zie §12.
Regel blijft: waar geen beslissing genomen is, wordt er geen geïmpliceerd.

## 11. Kosten en quota [AANNAME]

Uitgangspunt blijft de bestaande Cloudflare-stack uitbreiden, plus Clerk als managed auth.
**Alle limieten, gratis niveaus en prijsstellingen (D1, R2, Workers, Clerk) zijn aannames
die per dienst tegen de actuele officiële documentatie geverifieerd moeten worden vóór
implementatie** (kritiek pad dag 1–3). Documenteer niet als universele eigenschap dat
"alles gratis hard stopt" — dat verschilt per dienst en verandert. Gedrag bij uitputting:
§7.

## 12. Beslislog

Materiële beslissingen met datum, eigenaar, korte rationale en status.

| Datum | Eigenaar | Beslissing | Rationale (kort) | Status |
|---|---|---|---|---|
| 2026-09-25 | David (PO) | Desktop primair/normatief; iPad volwaardig met adaptieve UI; smartphone funnel; geen desktopcompromis voor tablet | Platformstrategie uit audit/spec-traject, bevestigd in slice-reviews | BESLOTEN |
| 2026-09-25 | David (PO), na consolidatie voorstellen Fable + Astra | Local-first: deterministische motor client-side; environment-agnostisch houden voor latere replay/validatie of (alleen indien nodig) server-authoritative | Bestaande asset, offline spel, latency, kosten, privacy, tests, reproduceerbaarheid | BESLOTEN |
| 2026-09-25 | David (PO) | IndexedDB blijft primaire lokale opslag; cloud-save = sync/recovery erbovenop | Local-first-gevolg | BESLOTEN |
| 2026-09-25 | David (PO) | Cloudflare-first online stack: Workers (API), D1 (gestructureerd), R2 (blobs) | Bestaande deploy, kostenmodel, één leverancier | BESLOTEN |
| 2026-09-25 | David (PO) | Minimale PII als hard principe; in-game namen zijn speldata (met de precisering in §3) | "Data die we niet verzamelen kan niet lekken" | BESLOTEN |
| 2026-09-25 | David (PO) | Rollen PLAYER/TESTER/ADMIN; RBAC ≠ voortgang ≠ entitlements; server checkt autorisatie én ownership | Scheiding van concepten | BESLOTEN |
| 2026-09-25 | David (PO) | Fable = platform-/engine-ownership; Astra = UX-/frontend-ownership; onafhankelijke cross-review met classificatie; voor account/save: gezamenlijk contract eerst (verfijnd 26-09 na Astra-review) | Werkend gebleken in Slices 1–3 | BESLOTEN |
| 2026-09-25 | David (PO) | Geen publieke sourcemaps; geen security-by-obscurity; technische details niet in spelers-changelog | §8 | BESLOTEN |
| 2026-09-25 | David (PO) | Eerste externe gebruikers ~10 okt 2026; ROADMAP prioriteert launch-readiness | Business | BESLOTEN |
| 2026-09-25 | David (PO) | UX-ground-truth = gemergde Slices 1–3, vastgelegd als invarianten in PLAYBOOK §2 | Gemeten en gemergd gedrag boven oude audits | BESLOTEN |
| 2026-09-26 | David (PO) | Progressieve feature-ontgrendeling als ontwerprichting; precedent: bank-betaalbaarheidstoets sluit dag-één-leningen bewust uit; uitwerking volgt als eigen producttopic | Focus voor nieuwe spelers + engagement | BESLOTEN (richting) |
| **2026-09-26** | **David (PO)** | **Accounts vereist voor go-live (OPEN-1 gesloten): de launch is account-gebaseerd** | Publieke go-live met echte gebruikers vraagt accounts; niet elke platformambitie wordt daarmee P0 | **BESLOTEN** |
| **2026-09-26** | **David (PO)** | **ADR: Clerk als v1-authrichting (OPEN-2 gesloten).** Boundary: Clerk blijft achter Matchday-eigen identity-abstractie (§3). Niet beslist hierbij: permanente levenslange provider, toekomstige passkeys, toekomstige MFA-eis, commercieel entitlementmodel | ~14 dagen tot go-live; managed auth boven eigen wachtwoord-/sessie-/herstelsecurity onder launchdruk; MFA/passkeys geen launchvereiste; snelheid/betrouwbaarheid boven eigen WebAuthn-controle in v1 | **BESLOTEN** (omkeerbaar door boundary) |

## 13. Documentautoriteit en relaties

Na deze reconciliatie geldt: **ROADMAP.md** = autoritatief voor prioriteit/status;
**DEVELOPMENT_PLAYBOOK.md** = autoritatief voor team/kwaliteit/werkafspraken;
**ARCHITECTURE.md** = autoritatief voor doelarchitectuur en beslislog; **CLAUDE.md** =
autoritatief voor coding-/repo-operatie; **README.md/HANDOVER.md** = context/historie.

- [CLAUDE.md](CLAUDE.md): de release-automation is de normale weg; de handmatige gang staat
  daar als expliciet gemarkeerd noodpad (conflict opgelost op 26-09).
- [README.md](README.md): ontwerplogboek per laag met metingen; bevat enkele verouderde
  feiten (o.a. spatie-sneltoets, GitHub Pages) — actuele code is de waarheid.
- [HANDOVER.md](HANDOVER.md): historische momentopname (zelfverklaard 24 sep 2026, v0.50.0;
  localStorage-vermelding is achterhaald — het is IndexedDB).
- [DOORLICHTING.md](DOORLICHTING.md): briefing voor motor-doorlichtingen; meetscripts
  herbruikbaar.
