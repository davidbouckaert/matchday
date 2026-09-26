# ROADMAP — Matchday

*Levend document: wat, wanneer, prioriteit, status. Eigenaarschap en werkwijze staan in
[DEVELOPMENT_PLAYBOOK.md](DEVELOPMENT_PLAYBOOK.md); techniek en beslissingen in
[ARCHITECTURE.md](ARCHITECTURE.md). Laatst bijgewerkt: 26 september 2026 (v0.84.5 live),
na Astra's review en de laatste Codex-ronde op PR #56 (commit 90d61e3) en de
PO-beslissingen accounts + Clerk.*

**Launchdoel: ACCOUNT-GEBASEERDE GO-LIVE met eerste echte externe gebruikers rond
10 oktober 2026 (±14 dagen).** OPEN-1 is gesloten: accounts zijn een must-have voor de
publieke go-live. OPEN-2 is gesloten: Clerk is de v1-authrichting (zie
[ARCHITECTURE.md §Beslislog](ARCHITECTURE.md#12-beslislog)).

## Hoe dit document werkt

- Status: `BACKLOG` → `READY` → `IN PROGRESS` → `IN REVIEW` → `BLOCKED` / `DONE`
- Prioriteit: `P0` launch blocker · `P1` belangrijk voor launch/betrouwbaarheid · `P2` betekenisvolle verbetering · `P3` later/polish
- Een developer werkt dit bestand bij wanneer zijn PR een taak start, afrondt, blokkeert of een FOLLOW-UP creëert.
- Een launch gate (zie §Launch gates) wordt pas afgevinkt op basis van een uitgevoerde controle, nooit alleen omdat de implementatie bestaat.

## Minimum-account-launchscope

Accounts zijn P0, maar **niet elke online-ambitie is daarmee P0**.

| MUST (launchkritisch) | NIET automatisch P0 (alleen bij aangetoonde afhankelijkheid) |
|---|---|
| Clerk-integratie achter Matchday-identity-boundary | Rijk admindashboard |
| D1-fundament: users/accountkoppeling/rollen | Breed testerdashboard |
| Server-side identiteitsverificatie + autorisatie + save-ownership | Geavanceerde analytics/telemetrie-dashboards |
| Veilige koppeling lokale save → account (nooit stil verlies) | Payments / premium entitlements |
| Minimale sync + begrijpelijke sync-/fout-/herstel-UX | Server-authoritative motor |
| Logging voldoende voor support/troubleshooting | Volledige deterministische replay-UI |
| Privacyminimum vóór accountdatacollectie: datainventaris bevestigd, doeleinden en bewaartermijnen vastgelegd, Clerk-verwerkersovereenkomst (DPA) afgehandeld, privacy-informatie zichtbaar voor de gebruiker | |
| Staging/prod-scheiding · CI-gates · back-up-/herstelrepetitie | |
| Launch-onboarding · end-to-end accountlaunch-generale | |

## Kritiek pad — 14 dagen

`⇄` = parallel; `→` = afhankelijk. **Gezamenlijk ontwerpcheckpoint (dag ~3) is de poort
vóór het bevriezen van account-/save-API's** — zie §Checkpoint.

### Dagen 1–3 — fundament

| Taak | Owner | Prio | Status | Afh. |
|---|---|---|---|---|
| Documentatie (deze PR) gereviewd en gemerged | Fable + Astra + David | P0 | IN REVIEW | — |
| CI-gates: test/typecheck/build verplicht op PR's; branch protection | Fable | P0 | READY | docs |
| Security-baseline: sourcemaps dicht, consolebeleid, headers/CSP | Fable | P0 | READY | ⇄ |
| Staging/prod-scheiding (eigen omgeving + eigen data) | Fable | P0 | READY | ⇄ |
| Cloudflare-/Clerk-limieten en -prijzen verifiëren tegen actuele documentatie | Fable | P0 | READY | ⇄ |
| Technische voorbereiding auth-/accountcontract (identity boundary-ontwerp) | Fable | P0 | READY | ⇄ |
| Onboarding/first-player-experience doorlichten en waar nodig fixen | Astra | P0 | READY | ⇄ |
| Fysieke iPad-acceptatie (draaiboek Slice 3) of daaruit volgende fixes | Astra + David (apparaat) | P1 | READY | ⇄ |
| `release:skip`/padenregel tegen changelog-ruis van docs-PR's | Fable | P1 | READY | ⇄ |
| `release.yml` race-vrij maken: concurrency-groep + rebase/retry vóór de push van de releasecommit, zodat twee snel opeenvolgende merges geen release verliezen. Tot dan: merges handmatig serialiseren (CLAUDE.md) | Fable | P1 | READY | ⇄ |
| **CHECKPOINT (gezamenlijk): account-lifecycle-contract** — zie §Checkpoint | David + Fable + Astra + ChatGPT | P0 | READY | boundary-ontwerp |

### Dagen 3–7 — accountfundament

| Taak | Owner | Prio | Status | Afh. |
|---|---|---|---|---|
| **Privacyminimum vóór accountcollectie** (ARCHITECTURE §3): datainventaris bevestigen, doeleinden + bewaartermijnen vastleggen, Clerk-verwerkersovereenkomst (DPA) aanvaarden en archiveren, privacy-informatie voor de gebruiker. Moet DONE zijn vóór Clerk op een publiek bereikbare omgeving echte gebruikersdata verwerkt; bewijs onder gate D | Fable (inventaris, termijnen, tekst) + David (DPA) | P0 | READY | Clerk-verificatie dag 1–3 |
| Clerk-integratie + Matchday-identity-adapter (Workers) | Fable | P0 | BACKLOG | checkpoint |
| D1-fundament: users, authkoppeling, rollen; migratieflow | Fable | P0 | BACKLOG | checkpoint |
| Workers-autorisatie + ownership-checks (RBAC) | Fable | P0 | BACKLOG | ↑ |
| R2-/save-backendfundament (blobformaat, envelope) | Fable | P0 | BACKLOG | checkpoint |
| Sign-in-/account-UX; accountstatuspresentatie | Astra | P0 | BACKLOG | checkpoint |
| Save-vertrouwen/sync-states op afgesproken vocabulaire | Astra | P0 | BACKLOG | checkpoint |
| Integratiecheckpoints vóór API-/storagecontracten duur worden om te wijzigen | Fable + Astra | P0 | BACKLOG | doorlopend |

### Dagen 7–10 — save/sync/supportbaarheid

| Taak | Owner | Prio | Status | Afh. |
|---|---|---|---|---|
| Cloud-save/sync + ownership + conflict- en herstelprimitieven | Fable | P0 | BACKLOG | fundament + OPEN-3-contract |
| Logging (structured, request-ID) + supportpad | Fable | P0 | BACKLOG | ⇄ |
| Minimum support-/adminbackend (§Minimum-admin) | Fable | P1 | BACKLOG | RBAC |
| Conflict-UX, offline-/syncfout-UX, herstel-UX | Astra | P0 | BACKLOG | primitieven |
| Koppeling/logout/accountwissel-gedrag (UX) | Astra | P0 | BACKLOG | contract |
| End-to-end stagingflows (gezamenlijk) | beiden | P0 | BACKLOG | ↑ |

### Dagen 10–11 — integratiepoort (geen nieuwe brede features)

Valideren op staging: accountcreatie/login · bestaande lokale save koppelen ·
save-persistentie · herladen · tweede browser/apparaat waar ondersteund · syncfout ·
conflict · logout/login · herstel · migratie · privacyminimum afgerond (inventaris, doeleinden/
bewaartermijnen, DPA) en privacy-informatie zichtbaar · logging-/supportpad.

### Dagen 11–14 — launchstabilisatie (feature freeze behalve blockers)

End-to-end-QA · security-sanity · privacy-sanity · onboarding · desktop · fysieke iPad ·
smartphone-funnel-sanity · back-up-/herstelrepetitie · staging→productie-generale ·
rollback · monitoring/logging · alleen gecontroleerde fixes.

**Haalbaarheidsrisico, eerlijk benoemd:** dit pad past alleen als (a) het checkpoint op
dag ~3 echt landt, (b) de accountscope minimaal blijft, en (c) er geen grote verrassing uit
de fysieke iPad-test of de Clerk-verificatie komt. Schuift het checkpoint meer dan twee
dagen, dan schuift de go-live — dat besluit ligt dan bij David, niet bij stille scopekrimp
op save-veiligheid.

## §Checkpoint — gezamenlijk ontwerpcheckpoint (vóór API-freeze)

Deelnemers: David (PO), Fable (mechaniek), Astra (userflow), ChatGPT (coördinatie/spec).
Vereiste outputs — daarna pas zijn account-/save-API-contracten stabiel:

1. account-lifecycle: eerste bezoek → lokaal spel/account → geauthenticeerd spel;
2. koppeling van bestaande lokale save;
3. save-statusvocabulaire; 4. sync-statusvocabulaire;
5. fout-/retrygedrag; 6. conflictgedrag; 7. logout/accountwissel; 8. herstel;
9. gebruikerszichtbare privacy-informatie;
10. technisch API-/statecontract dat het bovenstaande draagt.

De inhoudelijke minimumgaranties staan in
[ARCHITECTURE.md §4 Account-/save-garanties](ARCHITECTURE.md#4-account-save-garanties-launchcontract).

## Launch gates

Go-live vereist dat alle toepasselijke gates gehaald zijn, op basis van uitgevoerde
controles.

| Gate | Inhoud (samengevat) |
|---|---|
| **A — Engine/game** | Regressiesuite groen; deterministische invarianten intact; save-migraties geverifieerd; geen bekende P0-gameplayblocker |
| **B — Account/auth** | Clerk werkt op productie-achtige staging; interne identity-mapping werkt; server-side autorisatie werkt; PLAYER/TESTER/ADMIN-scheiding waar geïmplementeerd; geen client-only securitygrens |
| **C — Save-veiligheid** | Geen stil verlies van lokale voortgang; lokaal→account-koppeling gedefinieerd/getest; cloud-save-ownership correct; herladen/herinloggen veilig; syncfout vernietigt niets; conflictpad getest; back-up/herstel geoefend |
| **D — Privacy/security** | Privacyminimum afgerond vóór relevante collectie, met bewijs: datainventaris bevestigd tegen ARCHITECTURE §3, doeleinden en bewaartermijnen vastgelegd, Clerk-verwerkersovereenkomst (DPA) aanvaard en gearchiveerd, privacy-informatie voor de gebruiker beschikbaar; geen publieke secrets; geen publieke productie-sourcemaps; headers/CSP passend; auth-/sessie-endpoints beschermd; logs lekken geen secrets/gevoelige payloads; retentie-/verwijderbasics gedefinieerd |
| **E — User experience** | Verse-speler-onboarding getest (eerste indruk → zichtbaar doel → waarom → hoofdactie → voltooiingsfeedback → volgende stap → eerste week → begrijpelijk resultaat → herladen/hervatten → save-vertrouwen); sign-in begrijpelijk; sync-/foutstatus begrijpelijk; desktop primair intact; fysieke iPad-acceptatie afgerond; smartphone-eerste-indruk + accountingang acceptabel. Voor gekozen launchflows: toetsenbordtoegang, zichtbare focus, begrijpelijke foutstates, status nooit alleen via kleur |
| **F — Operations** | CI-gates actief; staging/prod gescheiden; productiedeployment geoefend; rollback begrepen; logs/supportpad beschikbaar; minimum-user/save-support bestaat |

## Ownership accountlaunch

| Wie | Primair |
|---|---|
| **Fable** | Clerk-technische integratie; Workers-authverificatie; Matchday-identity-adapter; D1-account-/rolmodel; R2-/save-backend; syncprotocol-implementatie; save-ownership/security; migraties; staging; CI; logging/backend-diagnostiek; minimum-adminbackend; privacyminimum (datainventaris, doeleinden/bewaartermijnen, privacytekst-inhoud, DPA-voorbereiding) |
| **Astra** | Sign-in-/account-UX; koppelings-UX; save-/sync-status-UX; conflict-UX; herstel-/fout-UX; onboarding-integratie; toegankelijkheid; responsive account-UX; user-facing admin-/testerpanelen waar nodig |
| **Gezamenlijk vóór implementatie** | Account-lifecycle-contract; lokaal→account-gedrag; sync-/conflictgaranties; logout-/wisselgedrag; herstelcontract; fout-/statusvocabulaire |
| **David** | Finale productbeslissingen, launchscope, acceptatie; aanvaarden van de Clerk-verwerkersovereenkomst (DPA) als verwerkingsverantwoordelijke |

## Minimum-admin (launch) vs. later adminplatform

Launchminimum — uitsluitend wat nodig is om: een gebruiker te identificeren/ondersteunen;
relevante account-/save-metadata in te zien; veilig te herstellen/resetten waar vereist;
TESTER/ADMIN-rollen toe te kennen; launchproblemen te troubleshooten. Het rijke
admindashboard blijft LATER tenzij een afhankelijkheid dat aantoont.

## Track A — Astra (naast het kritieke pad)

| # | Taak | Prio | Status |
|---|---|---|---|
| A1 | Onboarding/first-experience (kritiek pad dag 1–3) | P0 | READY |
| A2 | Fysieke iPad-acceptatie Slice 3 | P1 | READY |
| A3 | Account-/sync-UX (kritiek pad dag 3–10) | P0 | BACKLOG |
| A4 | Smartphone-launchminimum: geloofwaardige eerste indruk, uitleg wat het product is, bruikbare account-/sign-in-ingang, eerlijke apparaatverwachting — géén volledige mobiele managementredesign | P1 | BACKLOG |
| A5 | Resterende consistentie/polish (badges, agenda-focus) | P2 | BACKLOG |
| A6 | Review-follow-ups Slice 1 (Bureau-uitkomstkaart veroudert niet; "Alle N zaken"-label) | P3 | BACKLOG |
| A7 | ~~Rondleidingstekst lening~~ | — | DONE (gemerged in PR #55, geverifieerd in `src/engine/tour.ts`) |

## Track B — Fable (fasen ná de launch-P0's)

| Fase | Inhoud | Status |
|---|---|---|
| 0 + 1 | = kritiek pad hierboven | zie kritiek pad |
| 2 — operatie | Volwaardige admin-essentials, tester-scenario's/inspector, back-up-automatisering | BACKLOG |
| 3 — observability | Telemetrie, diagnosepakket "Stuur diagnose", deterministische replay-tooling | BACKLOG |
| 4 — commercieel | Entitlements, payments indien nodig, uitgebreide privacy/legal bovenop het launch-privacyminimum uit het kritieke pad (incl. minderjarigen-review vóór brede collectie), abuse-controls, dashboards | BACKLOG |
| doorlopend | Motor-/economie-ownership: metingen bij economiewijzigingen, save-migraties, RNG-discipline | doorlopend |

## Bewijsindex (duurzaam, geen /tmp-afhankelijkheid)

| Werk | PR / versie | QA uitgevoerd | Resterende acceptatie |
|---|---|---|---|
| Slice 1 — subsidiedossier, Bureau-statusmodel, onboardingfix | #51/#52 · v0.84.2 | 837 tests; cross-review Fable; Chrome-flows beide uitkomsten; 5 viewports | — |
| Slice 2 — personeelsvergelijking, competitiestand | in #53 · v0.84.3 | 843 tests; 45 golden personeelsuitkomsten; R02-meting 1440/1024 | — |
| Urgentiesignalen | #53 · v0.84.3 | 849 tests; valse-positieventest vers spel | — |
| Slice 3 — tabletworkflows, taakcontinuïteit | #54 · v0.84.4 | 865 tests; B-sneltoetsfix na review | **fysieke iPad/VoiceOver (A2)** |
| Bank-betaalbaarheid, aanvraagstatus, ratingbalken | #55 · v0.84.5 | 886 tests; kredietdoorlichting 2 clubs × 3 seeds; startclub-meting | — |

Details per werkstuk: PR-beschrijvingen en README-laagvermeldingen (bestaande conventie).

## Afhankelijkheden tussen de tracks

- Al het account-/sync-UX-werk (A3) hangt aan het checkpoint-contract — bewust gezamenlijk.
- Tester-/adminpanelen: backend (Fable) en paneel-UX (Astra) gescheiden, met cross-review.
- Integratiepoort dag 10–11 heeft beide tracks nodig.
- Conflictzones (zie Playbook §4): bij overlap een **integratie-eigenaar** benoemen per taak.

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| Checkpoint dag 3 schuift | Heel het kritieke pad schuift | Strak plannen; PO beslist over datum vs. scope, geen stille krimp op save-veiligheid |
| Clerk-verificatie levert verrassing (limieten, prijs, EU/minderjarigen) | Authfundament vertraagt | Dag 1–3-verificatietaak vóór integratie |
| Sync-conflictontwerp onderschat | Save-verlies = vertrouwensverlies | Garanties eerst (ARCHITECTURE §4), algoritme pas na contract (OPEN-3) |
| Release-workflow test niet | Regressie kan live | P0 dag 1–3 |
| Twee merges vlak na elkaar | Eerste releasecommit kan niet meer naar `main` (non-fast-forward): changelog-item en tag ontbreken | Handmatig serialiseren (CLAUDE.md) tot `release.yml` concurrency/rebase heeft (dag 1–3, P1) |
| Fysieke iPad nooit getest | Onbekende Safari-/touchproblemen | A2 in dag 1–3, niet in de stabilisatieweek |
| Parallelle botsing op gedeelde kern | Merge-pijn, regressie | Aparte worktrees, integratie-eigenaar, STOP-regel |
| workers.dev vs. definitief domein | IndexedDB is origin-gebonden: saves verhuizen niet mee | OPEN-7 beslissen vóór dag 7 (vóór er externe blijvende saves bestaan) |

## Open beslissingen

Volledige kaders in [ARCHITECTURE.md §Open beslissingen](ARCHITECTURE.md#10-open-beslissingen).

| # | Vraag | Deadline | Status |
|---|---|---|---|
| OPEN-1 | ~~Accounts nodig bij launch?~~ | — | **GESLOTEN 26-09: ja, accounts vereist voor go-live (David)** |
| OPEN-2 | ~~Authprovider~~ | — | **GESLOTEN 26-09: Clerk als v1-richting, achter Matchday-boundary (David)** |
| OPEN-3 | Exact sync-/conflictalgoritme (na checkpoint-contract) | vóór dag 7 | OPEN |
| OPEN-4 | Telemetrie-retentie/granulariteit | vóór fase 3 | OPEN |
| OPEN-5 | Minimum-adminfuncties: bevestiging launchminimum (§Minimum-admin) | vóór dag 7 | OPEN |
| OPEN-6 | Monetisatie-start | later | OPEN |
| OPEN-7 | Publieke productie-origin/domein (IndexedDB + saves zijn origin-gebonden) | **vóór dag 7, vóór eerste externe blijvende saves** | OPEN |
| OPEN-8 | Offline heropenen van de app (service worker/PWA) — nu níét ondersteund/getest | na launch | OPEN |

## Definition of Done (launchtaken)

Zoals [DEVELOPMENT_PLAYBOOK.md §6](DEVELOPMENT_PLAYBOOK.md#6-definition-of-done), plus:
launchtaken tellen pas mee voor een gate na een uitgevoerde, benoemde controle op staging.
