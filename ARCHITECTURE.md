# ARCHITECTURE — Matchday

*Levend document: huidige architectuur, doelarchitectuur en beslissingen. Wie/hoe staat in
[DEVELOPMENT_PLAYBOOK.md](DEVELOPMENT_PLAYBOOK.md); wat/wanneer in [ROADMAP.md](ROADMAP.md).
Laatst bijgewerkt: 26 september 2026, tegen code op `main` v0.84.5.*

Legenda bij elke claim: **[BESLOTEN]** vastgelegde beslissing · **[HUIDIG]** geverifieerd feit
in de repo · **[VOORGESTELD]** richting, nog geen beslissing · **[OPEN]** beslissing vereist ·
**[AANNAME]** moet vóór implementatie opnieuw geverifieerd worden.

## 1. Huidige architectuur [HUIDIG]

| Laag | Feit (geverifieerd 26 sep 2026) |
|---|---|
| Applicatie | TypeScript + Vite, HTML-template-UI zonder framework; spelerstaal Nederlands 10+ |
| Motor | `src/engine`: DOM-vrij, deterministisch (geseede mulberry32 in `state.rngState`); `advanceWeek(state)` → nieuwe toestand; aparte cosmetische anim-RNG; 886 tests (mocha/chai, Nederlands) |
| Lokale opslag | IndexedDB via `SaveStore` in `src/storage/save.ts`; `SAVE_VERSION` 41 met doorlopende migratieketen; JSON-export/-import bestaat als back-up/herstelroute |
| UI-patronen | Statusprojectie `src/ui/signals.ts` (één bron voor Bureau/navigatie/domeinen); engine-derived previews via `structuredClone` + echte acties; adaptieve tabletworkflows ≤1100px (`workflow-panel.ts`); contextuele terugkeer (`task-context.ts`); toetschips/slotjespatroon |
| Server | Eén Cloudflare Worker (`worker/index.ts`) achter `wrangler.jsonc`: statische assets uit `dist/` (SPA-fallback), `run_worker_first` op `/api/*`; endpoints `/api/version` en `/api/log`; observability aan; **geen** D1/R2/KV-bindings |
| CI/CD | `release.yml` op push naar main: `npm ci` + versiebump/changelog/tag via PR-titel en `release:minor`-label; **geen tests/typecheck/build in workflows** — kwaliteitsgates draaien nu alleen lokaal; `claude.yml`/`claude-code-review.yml` zijn agent-automatisering, geen testbewijs |
| Deploy | Cloudflare bouwt en publiceert bij push naar main (gedrag waargenomen via `/api/version`-verificaties). Exacte buildtrigger/-configuratie: **[AANNAME]** — in fase 0 vastleggen |
| Meetgereedschap | `npm run balance` / `autopilot` / `economie` / `scripts/doorlichting-*.ts` — verplicht bij economiewijzigingen (CLAUDE.md) |

## 2. Doelarchitectuur online [BESLOTEN richting, gefaseerd]

**Local-first.** De deterministische motor blijft voorlopig client-side draaien.
Redenen: sterke bestaande asset, offline/lokaal spel behouden, lage latency, lage
operationele kosten, privacy, uitgebreide bestaande tests, reproduceerbaarheid.

De motor blijft environment-agnostisch en DOM-vrij, zodat later mogelijk is:

```
client-simulatie → seed + actielog → server-replay/validatie
```

of, uitsluitend indien commercieel/competitief noodzakelijk, een server-authoritative
motor. **We verhuizen de motor niet server-side om JavaScript te verbergen** — obfuscatie is
geen security-grens (§8).

### Verantwoordelijkheden client ↔ server

| Kant | Verantwoordelijk voor |
|---|---|
| Client | Spelmotor en -simulatie, presentatie, lokale saves (IndexedDB blijft primair), offline werking, diagnose-ringbuffer |
| Workers (API) | Auth-/sessie-integratie, RBAC + ownership-checks, save-sync, admin-API, telemetrie-endpoints, auditoperaties, rate limiting |
| D1 | Relationeel/gestructureerd: users, rollen, sessies/identifiers waar passend, save-index/metadata, entitlements, auditregels, feature flags |
| R2 | Blobs: save-bestanden (gecomprimeerd, met versie-envelope), back-ups, diagnosepakketten |

Cloud-save is in eerste instantie **synchronisatie/recovery bovenop local-first**, geen
verplichte server-authoritative game. Conflictstrategie: OPEN-3 (§10).

## 3. Auth en privacy

**Authprovider: nog niet gekozen (OPEN-2).** Vergelijking gebeurt op: security, privacy,
recovery, complexiteit, kosten, vendor lock-in, multi-device, minderjarigen. Kandidaat­richtingen: eigen passkeys/WebAuthn + magic-link-fallback (minimale PII, geen wachtwoorden)
versus managed auth (minder bouw, extra verwerker). Zie ROADMAP OPEN-2.

**Privacyprincipe: data die we niet verzamelen, kan niet lekken.**

Datainventaris account (doel): opaque interne user-ID, rol, aanmaaktimestamp,
auth-identifier(s), optioneel herstel-e-mailadres — en verder niets. Niet standaard
verzamelen: echte naam, adres, telefoon, geboortedatum, geslacht of andere niet-noodzakelijke
PII. In-game eigenaars-/clubnamen zijn **speldata**, geen accountidentiteit. Gezien het
mogelijk jonge publiek (10+): GDPR-/minderjarigen-/juridische review vóór brede publieke
account-/paymentlaunch (ROADMAP: fase 4-voorwaarde).

## 4. Autorisatiemodel [BESLOTEN]

Startrollen: `PLAYER`, `TESTER`, `ADMIN`. Later, alleen indien nodig: `SUPPORT`, `MODERATOR`.

Strikt gescheiden concepten:

| Concept | Voorbeeld | Waar |
|---|---|---|
| RBAC (wie mag wat in het systeem) | rol = TESTER | D1 + sessie, server-side afgedwongen |
| Spelvoortgang (wat is vrijgespeeld) | medische cel ontgrendeld | in de save (speldata) |
| Commerciële entitlements | premium = true | eigen tabel in D1 |

De server controleert altijd autorisatie **én** ownership. Verborgen frontendknoppen zijn
nooit security.

## 5. Admin en testmodus [VOORGESTELD, richting vastgelegd]

**Admin:** aparte adminbundle/app, beschermd door server-side ADMIN-rol en waar passend
Cloudflare Access. Geen directe willekeurige DB-manipulatie als primaire beheerinterface:
beheer loopt via gecontroleerde adminacties met audit trail (actor, actie, doelwit,
timestamp, resultaat).

**Testmodus:** rol-gated TESTER/ADMIN-functionaliteit, twee niveaus:

- **A. Scenario's**: bijna-faillissement, promotie-/licentieprobleem, seizoensovergang,
  blessurecrisis, … (sluit aan op bestaande testfixture-helpers).
- **B. Gecontroleerde inspector-acties**: kas aanpassen, naam aanpassen, week/seizoen/
  teststate, geselecteerde testsave resetten, andere expliciete testhelpers.

Regels: testacties lopen via gecontroleerde functies (geen vrije DB-toegang); geen
productie-database-clear vanuit de gewone game; staging-/testdata fysiek/logisch gescheiden
van productie; test-/adminpaneelcode gescheiden of lazy geladen zodat gewone spelers hem niet
ontvangen.

## 6. Logging en observability [VOORGESTELD, richting vastgelegd]

Vier lagen:

| Laag | Inhoud | Kanaal (richting) |
|---|---|---|
| 1. Infrastructuur | Worker-errors, latency, D1/R2/netwerk/deployments | Cloudflare-observability (staat aan) |
| 2. Applicatie/API | Structured logs: request-/correlatie-ID, endpoint, status, duur, versie. **Nooit** wachtwoorden, tokens of volledige saves in standaardlogs | Workers Logs |
| 3. Audit | Duurzame registratie van gevoelige beheeracties | D1-tabel, onwisbaar |
| 4. Motor-diagnostiek | Determinisme benutten: checkpoint/save + seed/RNG-state + actielog + engineversie + beslissingslog (`src/log` bestaat al) = reproduceerbare bug | client-ringbuffer + "Stuur diagnose" |

"Stuur diagnose": de gebruiker deelt **bewust** een beperkt diagnosepakket (via bestaand
`/api/log`-kanaal of R2). Geen centrale permanente dump van iedere volledige save bij iedere
actie — dat botst met het privacyprincipe én met kosten.

## 7. Staging, productie, back-up [VOORGESTELD, fase 0/2]

- Staging: eigen Worker-omgeving (workers.dev) met **eigen** D1/R2; test- en adminacties
  kunnen productie fysiek niet raken.
- Productiepromotie pas na staging-smoke; rollback via Workers-versies.
- Back-up/recovery: R2-saveblobs versioneren; D1-export in het deploy-draaiboek; de bestaande
  client-side JSON-export blijft de gebruikerszijde van herstel.

## 8. Security-grenzen [BESLOTEN]

Expliciet geaccepteerd: **JavaScript dat naar de browser gaat, kan bekeken en gekopieerd
worden. Obfuscatie is geen security-grens.**

Maatregelen (fase 0 tenzij anders vermeld):

- productie-minificatie; geen publieke sourcemaps (privé waar nodig voor error-tracking);
- productie-console-/debugbeleid (`src/log`-discipline hard afdwingen in de build);
- CSP/security-headers;
- secrets nooit client-side; Cloudflare-/GitHub-secretstorage;
- admin-/testcode gescheiden/lazy (fase 2);
- autorisatie + ownership server-side (fase 1);
- rate limiting en Turnstile waar passend (fase 1);
- technische changelog/release-details intern; publieke changelog beschrijft spelerimpact
  (bestaande conventie).

## 9. CI/CD-doelpad [VOORGESTELD, fase 0 start]

```
featurebranch → PR → verplichte checks (npm test · typecheck · production build · relevante
extra's) → preview waar passend → onafhankelijke review → merge → staging → migraties →
smoke test → productiepromotie/release → versiecontrole (/api/version) → rollbackmogelijkheid
```

Nightly/periodiek: economie-/autopilot-/langlopende simulaties buiten de kritieke PR-latency.
Huidige release-automation (versiebump/changelog/tag op main) blijft de release-eigenaar; er
komt geen tweede handmatige route naast.

## 10. Open beslissingen

| # | Vraag | Opties + trade-offs (kort) | Eigenaar | Deadline | Status |
|---|---|---|---|---|---|
| OPEN-1 | Accounts/cloud-save nodig vóór eerste externe gebruikers? | (a) lokaal + export/import volstaat: kleinste launchscope, geen authblokkade; (b) accounts bij launch: recovery/multi-device vanaf dag één, maar auth+sync in ~10 dagen | David | dag 3 | OPEN |
| OPEN-2 | Authprovider | (a) eigen passkeys/WebAuthn + magic link: minimale PII, geen wachtwoorden, meer eigen bouw/recovery-ontwerp; (b) managed (bv. Clerk/Auth0/…): sneller, extra verwerker + kosten + lock-in | David (advies Fable) | dag 3–5 | OPEN |
| OPEN-3 | Cloud-save conflictstrategie | (a) last-write-wins + expliciete conflictvraag bij afwijking: eenvoudig, zeldzaam dataverlies mogelijk; (b) versievector/slot-locking: robuuster, complexer | Fable stelt voor, David beslist | vóór dag 8 | OPEN |
| OPEN-4 | Telemetrie-retentie/granulariteit | sampling vs. volledig; bewaartermijn; pseudonimisering | David | vóór fase 3 | OPEN |
| OPEN-5 | Minimum-viable adminfuncties launch | zoeken/rol/save-herstel vs. meer | David | vóór dag 8 | OPEN |
| OPEN-6 | Monetisatie-start (fase 4-trigger) | supporter/premium via Stripe; nooit kaartdata zelf | David | later | OPEN |
| OPEN-7 | Distributiekanaal eerste gebruikers | huidige workers.dev-URL vs. eigen domein/landing | David | vóór dag 11 | OPEN |

Regel: waar geen beslissing genomen is, wordt er geen geïmpliceerd — een eerdere brainstorm
die een technologie noemt, is geen keuze.

## 11. Kosten en free-tiers [AANNAME]

Uitgangspunt is de bestaande Cloudflare-stack uitbreiden (Workers → D1/R2/Access/Turnstile/
Analytics Engine), mede omdat de gratis niveaus hard begrenzen in plaats van door te
factureren — dat past bij de eis "geen lopende kosten tijdens bouwen en testen". **Alle
concrete limieten en prijsstellingen zijn aannames die vóór implementatie tegen de actuele
Cloudflare-documentatie geverifieerd moeten worden.** Alternatieven (bv. managed auth) worden
per OPEN-beslissing afgewogen, niet stilzwijgend geïntroduceerd.

## 12. Beslislog

| Datum | Beslissing | Status |
|---|---|---|
| sep 2026 | Desktop primair en normatief; iPad volwaardig spel met adaptieve UI; smartphone funnel/verkenning; geen desktopcompromis voor tablet | BESLOTEN |
| sep 2026 | Local-first: deterministische motor blijft voorlopig client-side; environment-agnostisch houden voor latere replay/validatie of (alleen indien nodig) server-authoritative | BESLOTEN |
| sep 2026 | IndexedDB blijft primaire lokale opslag; cloud-save = sync/recovery erbovenop | BESLOTEN |
| sep 2026 | Cloudflare-first online stack: Workers (API), D1 (gestructureerd), R2 (blobs) | BESLOTEN |
| sep 2026 | Auth: nog open (OPEN-2); minimale PII als hard principe; in-game namen zijn speldata | BESLOTEN (principe) / OPEN (provider) |
| sep 2026 | Rollen PLAYER/TESTER/ADMIN; RBAC ≠ spelvoortgang ≠ entitlements; server checkt autorisatie én ownership | BESLOTEN |
| sep 2026 | Fable = platform-/engine-ownership; Astra = UX-/frontend-ownership; onafhankelijke cross-review met classificatie | BESLOTEN |
| sep 2026 | Geen publieke sourcemaps; geen security-by-obscurity; technische details niet in spelers-changelog | BESLOTEN |
| sep 2026 | Eerste externe gebruikers verwacht ~10 oktober 2026 (±14 dagen); ROADMAP prioriteert launch-readiness | BESLOTEN |
| sep 2026 | UX-ground-truth = gemergde Slices 1–3 (dossier/status­model, desktopvergelijkingen, urgentiesignalen, tabletworkflows, contextuele terugkeer, actieve onboarding), niet de oudere audits | BESLOTEN |
| sep 2026 | Features niet allemaal vanaf dag één: progressieve ontgrendeling als ontwerprichting (uitwerking volgt als eigen producttopic); precedent: bank-betaalbaarheidstoets sluit dag-één-leningen bewust uit | BESLOTEN (richting) |

## 13. Relatie met bestaande documenten

- [CLAUDE.md](CLAUDE.md): operationele repo-instructie voor coding agents (blijft leidend
  voor workflow; bevat naast de automatische release-flow nog een oudere handmatige
  beschrijving — de automation is leidend, zie §9).
- [README.md](README.md): ontwerplogboek per laag met metingen (bevat enkele verouderde
  feiten, o.a. spatie-sneltoets en GitHub Pages-publicatie; actuele code is de waarheid).
- [HANDOVER.md](HANDOVER.md): historische momentopname (zegt zelf: 24 sep 2026, v0.50.0;
  o.a. localStorage-vermelding is achterhaald — het is IndexedDB).
- [DOORLICHTING.md](DOORLICHTING.md): briefing voor motor-doorlichtingen; de meetscripts
  eronder zijn herbruikbaar gereedschap.
