# ROADMAP — Matchday

*Levend document: wat, wanneer, prioriteit, status. Eigenaarschap en werkwijze staan in
[DEVELOPMENT_PLAYBOOK.md](DEVELOPMENT_PLAYBOOK.md); techniek en beslissingen in
[ARCHITECTURE.md](ARCHITECTURE.md). Laatst bijgewerkt: 26 september 2026 (v0.84.5 live).*

**Launchdoel: eerste echte externe gebruikers rond 10 oktober 2026 (±14 dagen).**

## Hoe dit document werkt

- Status: `BACKLOG` → `READY` → `IN PROGRESS` → `IN REVIEW` → `BLOCKED` / `DONE`
- Prioriteit: `P0` launch blocker · `P1` belangrijk voor launch/betrouwbaarheid · `P2` betekenisvolle verbetering · `P3` later/polish
- Een developer werkt dit bestand bij wanneer zijn PR een taak start, afrondt, blokkeert of een follow-up creëert. Niet bij elke codewijziging.
- Bevindingen uit reviews die bewust buiten scope blijven, komen hier binnen als `FOLLOW-UP`-taak.

## Launch-scope in één blik

| Categorie | Must have vóór eerste externe gebruikers | Should have kort erna | Later / schaal / commercieel |
|---|---|---|---|
| Spel | Stabiele game, betrouwbare lokale save + migraties, onboarding voldoende | Resterende UX-polish, smartphone-funnel | Progressieve feature-ontgrendeling (groot topic, PO behandelt later) |
| Platform | CI-gates (test/typecheck/build), staging/prod-scheiding, security-baseline, herstel-/back-upstrategie, logging voor troubleshooting | Cloud-save sync (indien niet al bij launch nodig — OPEN-1), minimale admin-/testerfuncties | Uitgebreid admindashboard, analytics-dashboards, replay-tooling |
| Accounts | **Alleen indien eerste gebruikers ervan afhankelijk zijn (OPEN-1)** | Accounts + sync + recovery | Payments/entitlements, abuse-controls op schaal |
| Privacy/juridisch | Privacy-basics: minimale data, geen trackers, exportknop bestaat al | Privacyverklaring-pagina, verwijderroute | Volledige GDPR/minderjarigen-review vóór brede account-/paymentlaunch |

## 14-dagenplan

De dagen zijn richtdata; parallellie en afhankelijkheden zijn leidend. `⇄` = kan volledig
parallel; `→` = afhankelijk van het genoemde.

### Dagen 1–3 — fundament en documentatie

| Taak | Owner | Prio | Status | Afhankelijkheid |
|---|---|---|---|---|
| ROADMAP/PLAYBOOK/ARCHITECTURE gereviewd en gemerged | Fable (auteur) + Astra (review) + David (accept) | P0 | IN REVIEW | — |
| CI-gates: `npm test` + typecheck + build verplicht op PR's; branch protection | Fable | P0 | READY | docs gemerged |
| `release:skip`- of padenregel zodat docs-PR's geen spelers-changelog maken | Fable | P1 | READY | ⇄ |
| Security-baseline: geen publieke sourcemaps, `drop_console`-beleid, security-headers, CSP | Fable | P0 | READY | ⇄ |
| Staging-omgeving (eigen workers.dev + eigen data) gescheiden van productie | Fable | P0 | READY | ⇄ |
| Logging-conventies vastleggen (structured logs, request-ID; zie ARCHITECTURE §Logging) | Fable | P1 | READY | ⇄ |
| Onboarding/first-run doorlichten als "eerste externe gebruiker": wizard → rondleiding → eerste weken | Astra | P0 | READY | ⇄ |
| Rondleidingstekst lening bijwerken (belooft dag-één-lenen dat niet meer bestaat) | Astra | P1 | READY | ⇄ |

### Dagen 3–8 — online-fundament (Track B) ⇄ UX-afronding (Track A)

| Taak | Owner | Prio | Status | Afhankelijkheid |
|---|---|---|---|---|
| Beslissing OPEN-1 (accounts nodig bij launch?) en OPEN-2 (authprovider) | David | P0 | BLOCKED op PO-antwoord | — |
| Workers API-fundament: routing, sessies, foutmodel, rate limiting | Fable | P0/P1* | READY | OPEN-1 |
| D1-schema (users, rollen, save-index, audit, feature flags) + migratieflow | Fable | P0/P1* | READY | OPEN-1 |
| R2-bucket + save-blobformaat (gzip, versie-envelope) | Fable | P1 | READY | OPEN-1 |
| RBAC: PLAYER/TESTER/ADMIN server-side afgedwongen | Fable | P0/P1* | READY | API-fundament |
| Frontendcontract account/sync-states (ingelogd, offline, sync-conflict, fout) definiëren | Fable + Astra samen | P1 | BACKLOG | API-fundament |
| Resterende UX-consistentie/polish uit audit (badges, spacing, agenda-focus) | Astra | P2 | BACKLOG | ⇄ |
| Toegankelijkheid: focusroutes, contrast-restpunten, fysieke iPad-test (staat nog open uit Slice 3) | Astra + David (apparaat) | P1 | READY | ⇄ |

*P0 als OPEN-1 = "ja, accounts bij launch"; anders P1 en verschuift naar na de launch.

### Dagen 8–11 — integratie

| Taak | Owner | Prio | Status | Afhankelijkheid |
|---|---|---|---|---|
| Cloud-save sync (achtergrond, last-write + conflictvraag; strategie OPEN-3) | Fable | P1 | BACKLOG | D1/R2 + OPEN-3 |
| User-facing auth/save-states bouwen op backendcontract | Astra | P1 | BACKLOG | → contract (dag 3–8) |
| "Stuur diagnose"-pakket: save + seed + motorbeslissingslog + versie | Fable | P1 | BACKLOG | logging-conventies |
| Minimale tester-capaciteit: rol-gated scenario's/inspector (zie ARCHITECTURE §Testmodus) | Fable (backend) + Astra (paneel-UX) | P1 | BACKLOG | RBAC |
| Minimale admin-capaciteit: gebruiker zoeken, rol zetten, save terugzetten — met audit | Fable | P1 | BACKLOG | RBAC |
| Stagingvalidatie: volledige spelrondgang op staging met accounts aan | beiden | P0 | BACKLOG | al het bovenstaande |

### Dagen 11–14 — launchstabilisatie (feature freeze)

| Taak | Owner | Prio | Status |
|---|---|---|---|
| Geen niet-essentiële features meer; alleen launch blockers en gecontroleerde fixes | allen | P0 | BACKLOG |
| End-to-end tests: nieuwe speler → wizard → weken spelen → save → herladen → (sync) | Fable + Astra | P0 | BACKLOG |
| Browser/iPad-QA op de kernflows (desktop 1440/1280, iPad beide oriëntaties, telefoon-funnel) | Astra | P0 | BACKLOG |
| Migratie-/herstelrepetitie: oude save laden, export/import, corrupt-save-gedrag | Fable | P0 | BACKLOG |
| Back-up/restore-oefening staging → productie-draaiboek | Fable | P0 | BACKLOG |
| Security/privacy-sanity: headers, geen lekken in console/changelog, datainventaris klopt | Fable | P0 | BACKLOG |
| Staging → productie-generale (deploy, smoke `/api/version`, rollback getest) | Fable | P0 | BACKLOG |

## Track A — Astra (product-UX)

Slices 1–3 zijn gebouwd, gereviewd, gemerged en live (zie
[ARCHITECTURE.md §Beslislog](ARCHITECTURE.md#beslislog)). Resterend, op volgorde:

| # | Taak | Prio | Status |
|---|---|---|---|
| A1 | Onboarding/first-experience als launchpad (dag 1–3 hierboven) | P0 | READY |
| A2 | Fysieke iPad-acceptatie Slice 3 (draaiboek staat in het Slice 3-verslag) | P1 | READY |
| A3 | Auth/cloud-save user-facing states (zodra contract er is) | P1 | BACKLOG |
| A4 | Smartphone-funnel: compacte clubkop, herkenbare eerste blik | P2 | BACKLOG |
| A5 | Resterende consistentie: badge-/icoonconventies, agenda opent op actuele taak | P2 | BACKLOG |
| A6 | Follow-ups uit reviews: Bureau-uitkomstkaart veroudert niet; "Alle N zaken"-label | P3 | BACKLOG |

## Track B — Fable (platform)

| Fase | Inhoud | Prio | Status |
|---|---|---|---|
| 0 — onmiddellijk | CI-gates, security-baseline, staging, sourcemap/consolebeleid, loggingconventies, release-ruisfix, deze documentatie | P0 | IN REVIEW (docs) / READY (rest) |
| 1 — online-fundament | Workers API, D1/R2, authbeslissing + integratie, RBAC, omgevingsscheiding | P0/P1 (OPEN-1) | BLOCKED op OPEN-1/2 |
| 2 — persistentie/operatie | Cloud-save sync, conflicthantering, audit, admin-essentials, tester-essentials, back-up/recovery | P1 | BACKLOG |
| 3 — observability | Telemetrie, diagnostiek, deterministische replay-/supporttooling | P2 | BACKLOG |
| 4 — commercieel | Entitlements, payments indien nodig, uitgebreide privacy/legal, abuse-controls, dashboards | P3 | BACKLOG |
| doorlopend | Motor-/economie-ownership: balansmetingen bij economiewijzigingen, save-migraties, RNG-discipline | P1 | doorlopend |

## Launch blockers (P0-lijst)

1. CI-gates op PR's (er draait nu **geen** test in de release-workflow — gemeten feit).
2. Staging gescheiden van productie (test-/adminacties mogen productie nooit raken).
3. Security-baseline (sourcemaps, console, headers, secrets).
4. Onboarding goed genoeg voor een vreemde zonder uitleg.
5. Betrouwbare save: migratieketen + export/import + corrupt-save-gedrag geverifieerd.
6. Logging voldoende om een gebruikersprobleem te kunnen onderzoeken.
7. Herstelmogelijkheid: back-up/rollback-draaiboek, geoefend.
8. Privacy-basics conform datainventaris in ARCHITECTURE.
9. **Indien OPEN-1 = ja:** accounts/sync-basispad werkend en op staging gevalideerd.
10. Desktopregressie door tablet-/mobielwerk is per definitie een blocker (platformstrategie).

## Definition of Done (launchtaken)

Een launchtaak is DONE wanneer: tests (Nederlands, met waarom) + typecheck + build groen;
gedrag in de draaiende app geverifieerd (schermafdrukken bij UI); onafhankelijke cross-review
afgerond met bevindingen geclassificeerd; ROADMAP-status bijgewerkt; geen scope-uitbreiding
stilzwijgend meegenomen. Voor UI-werk hoort toegankelijkheid (focus, tekstlabels, geen
kleur-als-enige-drager) bij DONE — patroon uit Slices 1–3.

## Afhankelijkheden tussen de tracks

- A3 (auth/save-states) wacht op het **frontendcontract** uit Track B fase 1 — dit contract is
  bewust een gezamenlijke taak, zodat Astra niet op een verrassing bouwt.
- Tester-/adminpanelen: backendfuncties (Fable) en paneel-UX (Astra) zijn gescheiden
  deliverables met cross-review over en weer.
- Stagingvalidatie (dag 8–11) heeft beide tracks nodig en is de synchronisatiepoort vóór de
  stabilisatieweek.
- Gedeelde bestanden (zie conflictzones in het Playbook): bij gelijktijdige wijzigingen aan
  `src/ui/main.ts`, signals/statusprojectie of storage: **STOP en synchroniseer eerst**.

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| OPEN-1/2 blijven te lang open | Fase 1 start te laat voor de launchdatum | Beslisdeadline: dag 3 (zie Open vragen) |
| Accounts bij launch tóch nodig terwijl er 14 dagen zijn | Krappe integratieweek | Scope-minimalisme: gast-account + sync-recovery, geen luxe |
| Release-workflow test niet | Regressie kan live gaan | Fase 0-taak, dag 1–3 |
| Parallel werk botst op main.ts/signals | Merge-pijn, subtiele UX-regressies | Kortlevende branches + STOP-regel |
| Fysieke iPad nooit getest | Onbekende touch-/Safari-problemen bij echte gebruikers | A2 met Davids apparaat vóór dag 11 |
| Save-migratie breekt bij bestaande spelers | Dataverlies = vertrouwensverlies | Migratietests verplicht (bestaande conventie), herstelrepetitie dag 11–14 |

## Open vragen (beslissingen voor David)

Volledige besliskaders met opties en trade-offs staan in
[ARCHITECTURE.md §Open beslissingen](ARCHITECTURE.md#open-beslissingen).

| # | Vraag | Deadline | Status |
|---|---|---|---|
| OPEN-1 | Zijn accounts/cloud-save **nodig voor de eerste externe gebruikers**, of is lokaal + export/import genoeg voor launch? | dag 3 | OPEN |
| OPEN-2 | Authprovider: eigen passkeys/WebAuthn + magic link vs. managed auth | dag 3–5 | OPEN |
| OPEN-3 | Cloud-save conflictstrategie (last-write-wins + prompt vs. versievector) | vóór dag 8 | OPEN |
| OPEN-4 | Telemetrie-retentie en -granulariteit | vóór fase 3 | OPEN |
| OPEN-5 | Minimum-viable adminfuncties voor launch | vóór dag 8 | OPEN |
| OPEN-6 | Wanneer monetisatie echt start (fase 4-trigger) | later | OPEN |
| OPEN-7 | Distributie eerste gebruikers: huidige URL of aparte domein/landing? | vóór dag 11 | OPEN |
