# DEVELOPMENT PLAYBOOK — Matchday

*Levend document: wie doet wat, hoe we samenwerken, wat "af" betekent. Prioriteiten en status
staan in [ROADMAP.md](ROADMAP.md); techniek in [ARCHITECTURE.md](ARCHITECTURE.md); de
operationele repo-regels voor coding agents blijven in [CLAUDE.md](CLAUDE.md) — dit document
herhaalt ze niet, het verwijst ernaar. Laatst bijgewerkt: 26 september 2026 (na Astra's
review van PR #56).*

## 1. Rollen en ownership

| Wie | Rol | Beslist over / primair eigenaar van |
|---|---|---|
| **David** | Product owner / architect / analist | Productrichting, requirements, prioriteiten, scope, businessbeslissingen, finale architectuurkeuzes, **finale acceptatie**. |
| **ChatGPT** | Assistent / projectmanager | Roadmap en sequencing, requirements concretiseren, scope bewaken, afhankelijkheden, opdrachten structureren, resultaten consolideren, risico's en open beslissingen zichtbaar houden. Vervangt Davids finale beslissingen niet. |
| **Fable** | Primary engine-/platformdeveloper | Game-engine, domeinlogica, determinisme/RNG, save-architectuur en -migraties, backend, Cloudflare Workers, D1/R2, auth-/backendintegratie (incl. Clerk-serverintegratie en identity-adapter), RBAC, sync-mechaniek/persistentie/revisies, admin-backend, tester-/dev-backend, logging/diagnostiek, CI/CD, staging/productie, security-grenzen, backend-herstelprimitieven. |
| **Astra** | Primary UX/UI-/frontend-productdeveloper | UX/UI, visueel ontwerp, informatiearchitectuur, interactieontwerp, desktop-UX, adaptieve iPad-UX, smartphone/funnel-UX, toegankelijkheid, onboarding, visualisaties, navigatie/taakcontinuïteit, browser-gedreven visuele QA — en voor account/cloud: sign-in-/koppelings-/sync-status-/conflict-/herstel-flows, accountwissel/logout-UX, save-vertrouwenspresentatie. |

**Account/save/sync — expliciete verdeling:** Fable bezit de **technische mechanismen**,
Astra bezit de **userflows, interactie en herstelgedrag**. Voor deze features definiëren
beiden **eerst samen het user-facing contract** (zie ROADMAP §Checkpoint) voordat
afhankelijke API-/storagecontracten bevroren worden. De backend moet de goedgekeurde
productgaranties dragen — niet omgekeerd.

Grensregels:

- Astra mag TypeScript en gedeelde frontendarchitectuur wijzigen wanneer zijn slice dat
  vereist, maar wijzigt **niet opportunistisch** engine-, infrastructuur- of economieregels.
- Fable bepaalt **niet** automatisch frontend-/UX-beslissingen; cross-review is
  kwaliteitsborging, geen ownership-overname. Dat geldt in beide richtingen.
- Ownership betekent: eerste auteur én eerste aanspreekpunt, niet exclusiviteit.

**Merge en acceptatie:** David behoudt finale acceptatie. Mergen gebeurt door David, of door
een developer die daarvoor **expliciet gemachtigd** is voor die PR of dat werktype. "David
merget persoonlijk elke PR" is géén invariant.

## 2. Bewezen Matchday-UX-invarianten (uit Slices 1–3)

Deze principes zijn gemergde, gemeten ground truth en gelden als duurzame projectregels.
Reviews toetsen eraan; afwijken vraagt een expliciete productbeslissing.

1. **Beslissing → wachten → gevolg → verklaring.** Een aanvraag is niet hetzelfde als een
   toegekend resultaat; verzin nooit historische uitkomsten (onbekend blijft onbekend).
2. **Werk ≠ wachten ≠ informatie.** Wachten op een andere partij/proces telt niet
   automatisch als spelerswerk of urgentie.
3. **Engine-derived UI.** Voorwaarden, bedragen, effecten, previews en urgentie komen uit
   gedeelde domeinlogica; previews wijzigen geen state en geen RNG. "Het scherm rekent
   nooit apart" blijft leidend.
4. **Urgentieconsistentie.** Hetzelfde onderliggende probleem heeft dezelfde semantiek op
   Bureau, navigatie en domeinscherm, en legt uit: wat is er mis, wanneer telt het, waar
   onderzoek/los je het op.
5. **Contextuele terugkeer.** Contextnavigatie is een omweg binnen een bestaande taak:
   detect → investigate → act → confirm → return. Expliciete globale navigatie wist de
   taakoorsprong — óngeacht muis- of toetsenbordroute. Focus/scroll worden passend hersteld.
6. **Adaptieve workflows.** Tablet mag de interactievorm veranderen; nooit de spelregels,
   en nooit desktop degraderen. Desktop blijft primair.
7. **Actieve onboarding ≠ optionele hulp.** Tijdens de rondleiding: zichtbaar huidig doel,
   reden, één hoofdactie, voortgang en duidelijke volgende stap. De first-player-experience
   verdwijnt nooit achter optionele hulp.

## 3. Cross-review

Het model uit Slices 1–3 blijft de standaard.

**Astra implementeert:**

```
Astra implementeert → implementatieverslag → Fable reviewt onafhankelijk
(code + domeincorrectheid, zelf metingen draaien) → bevindingen geclassificeerd
→ fixes → eindverificatie → PR → David accepteert (merge: zie §1)
```

**Fable implementeert:**

```
Fable implementeert → technische verificatie → bij user-facing gedrag reviewt
Astra UX-/productimpact → bevindingen → fixes → David accepteert (merge: zie §1)
```

Spelregels:

- Review kan **vóór de PR of op een bestaande PR** plaatsvinden; na reviewfixes krijgt
  wezenlijk gewijzigde code een passende eindverificatie (suite + gerichte hercontrole),
  niet alleen een diff-blik.
- De reviewer controleert de **daadwerkelijke code en het daadwerkelijke gedrag** (zelf
  tests draaien, zelf de app bedienen), niet alleen het verslag.
- Geen gedeeld AI-geheugen dat de reviewer de interpretatie van de implementeerder laat
  overnemen; kennis reist expliciet via repo-docs, implementatieverslagen, reviewverslagen
  en de volgende scoped opdracht.
- Een implementatieverslag zonder meting is geen bewijs ("meten, niet beweren").

## 4. Reviewclassificatie

| Label | Betekenis | Gevolg |
|---|---|---|
| **BLOCKER** | Moet vóór merge opgelost | PR wacht |
| **FIX BEFORE MERGE** | Klein/beheersbaar, hoort vóór merge te verdwijnen | fix in dezelfde PR |
| **FOLLOW-UP** | Reëel punt, bewust buiten huidige scope | taak in ROADMAP.md |
| **NOTE** | Observatie/context | geen wijziging vereist |

Geen stilzwijgende scope-uitbreiding: wat niet in de opdracht zat en geen BLOCKER is, wordt
FOLLOW-UP — ook als het klein lijkt.

## 5. Branches en parallel werk

Basisregels (aanvullend op CLAUDE.md):

- Elke nieuwe taak start vanaf **actuele `origin/main`** (eerst fetchen).
- Kleine, kortlevende featurebranches (`claude/<korte-omschrijving>`); geen wekenlang
  divergerende branches.
- **Bij voorkeur werken Fable en Astra in aparte worktrees/checkouts** waar dat praktisch
  is, zodat parallel werk elkaars werkboom niet raakt.
- Vóór wijzigingen aan gedeelde kernbestanden: actuele main controleren op recent werk.
- Ongerelateerd/untracked werk van anderen blijft onaangeroerd.
- `src/version.ts` wordt op featurebranches nooit handmatig gewijzigd; de release-automation
  beheert versie en changelog (zie CLAUDE.md).

**Conflictzones** — verhoogde alertheid bij parallel werk:

`src/engine/*` · `src/storage/*` · `src/ui/main.ts` · `src/ui/header.ts` · gedeelde
UI-/navigatiehelpers (`signals.ts`, `keys.ts`, `task-context.ts`, `workflow-panel.ts`,
`financial.ts`, `subsidiezaak.ts`) · `package.json`/lockfile · `wrangler.jsonc` ·
`README.md` · `CLAUDE.md` · roadmap-/architectuurdocs.

**Integratie-eigenaar:** wanneer gepland parallel werk naar verwachting dezelfde
kernbestanden raakt, wordt per taak één integratie-eigenaar benoemd (in ROADMAP bij de
taak) die de samenvoeging bewaakt.

**STOP-regel:** raken twee parallelle opdrachten dezelfde concepten of bestanden, dan stopt
**de conflicterende/gedeelde wijziging** — niet al het onafhankelijke werk van beide
developers — en wordt gesynchroniseerd via David/projectmanagement, waarna de opdracht
herbaseerd wordt op actuele main.

## 6. Definition of Done

Een wijziging is af wanneer:

1. Tests toegevoegd/aangepast — in het Nederlands, met erboven waaróm (CLAUDE.md).
2. `npm test`, `npm run typecheck` en `npm run build` slagen (exitcodes gecontroleerd).
3. Echte layoutwijzigingen zijn vóór/na in de draaiende app geverifieerd met schermafdrukken.
4. Economische wijzigingen zijn gemeten met de meetscripts, op stabiele code, lang genoeg
   (CLAUDE.md "Vallen bij het meten").
5. Toegankelijkheid meegenomen: focusroutes, tekstlabels naast kleur, bereikbare uitleg,
   toetsenbordbediening voor de geraakte flow (§2-invarianten).
6. Save-schemawijzigingen hebben een migratie + migratietest; oude saves blijven laden.
7. Engine-invarianten gerespecteerd (§7).
8. Implementatieverslag geschreven; cross-review afgerond; ROADMAP.md bijgewerkt als de
   taak daar staat.

## 7. Engineering-invarianten

Niet onderhandelbaar zonder expliciete productbeslissing:

- De motor blijft **DOM-vrij, deterministisch en environment-agnostisch**; `advanceWeek(state)`
  geeft een nieuwe toestand; geen nieuwe toevalligheid voor presentatie; geen gewijzigde
  RNG-trekkingsvolgorde zonder benoemde reden.
- **Het scherm rekent nooit apart** (zie ook §2.3).
- Previews/vergelijkingen draaien op een kopie via de échte acties, wijzigen de speltoestand
  niet en voorspellen geen RNG-uitkomsten.
- Logging voor ontwikkelaars via `src/log`, nooit in schermen, productieconsole of saves.
- Spelerstaal 10+; technische details horen niet in de spelers-changelog.
- Verborgen of code-gesplitste frontendcode is nooit een securitygrens; autorisatie en
  ownership worden server-side gecontroleerd (zie ARCHITECTURE §8).
- Clerk-/providertypes blijven achter de Matchday-identity-boundary; engine-/domeincode
  kent alleen `MatchdayIdentity`-begrippen (ARCHITECTURE §3).

## 8. Communicatieprotocol

```
Developer ontvangt scoped opdracht
→ controleert actuele main + docs (ROADMAP, PLAYBOOK, ARCHITECTURE, CLAUDE.md)
→ rapporteert implementatieplan wanneer gevraagd
→ implementeert
→ draait vereiste verificatie (DoD §6)
→ schrijft implementatieverslag (wat, hoe geverifieerd, beperkingen eerlijk)
→ onafhankelijke reviewer verifieert zelf
→ bevindingen geclassificeerd (§4)
→ developer fixt → eindverificatie op gewijzigde code
→ PR (titel in spelerstaal — wordt het changelog-item)
→ David accepteert; merge conform §1
```

Belangrijke cross-agent-kennis reist uitsluitend via repository-docs,
implementatieverslagen, reviewverslagen en de volgende scoped opdracht — nooit via
impliciete herinnering tussen agents.

## 9. Documentatieverantwoordelijkheden

| Document | Wordt bijgewerkt wanneer | Door |
|---|---|---|
| ROADMAP.md | een geplande taak start/afrondt/blokkeert of een FOLLOW-UP ontstaat | de developer van die PR |
| ARCHITECTURE.md | een echte architectuurbeslissing valt of vastgelegde architectuur aantoonbaar verandert | Fable (platform) / Astra (frontendarchitectuur), met Davids akkoord voor beslissingen |
| DEVELOPMENT_PLAYBOOK.md | samenwerking, reviewflow of DoD verandert | David/ChatGPT met het team |
| README.md | ontwerpkeuzes en metingen per laag (bestaande conventie) | de implementeerder |
| CLAUDE.md | operationele repo-regels veranderen | David |

Geen changelog van elke codewijziging in deze documenten; verwijs in plaats van dupliceren.

## 10. Source of truth

| Onderwerp | Leidende bron |
|---|---|
| Productbeslissingen | David / expliciet goedgekeurde roadmap- en architectuurbeslissingen |
| Huidige implementatie | actuele code op `main` |
| Coding-/repositoryworkflow | CLAUDE.md + actuele repositoryconfiguratie |
| Projectprioriteit / ownership / status | ROADMAP.md |
| Teamwerkafspraken | DEVELOPMENT_PLAYBOOK.md (dit document) |
| Technische doelarchitectuur en beslislog | ARCHITECTURE.md |
| Historische context | README.md / HANDOVER.md (HANDOVER is een gedateerde momentopname) |

Bij conflict: niet stil kiezen — noteer het conflict in het relevante document of escaleer
naar David.
