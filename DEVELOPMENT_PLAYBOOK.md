# DEVELOPMENT PLAYBOOK — Matchday

*Levend document: wie doet wat, hoe we samenwerken, wat "af" betekent. Prioriteiten en status
staan in [ROADMAP.md](ROADMAP.md); techniek in [ARCHITECTURE.md](ARCHITECTURE.md); de
operationele repo-regels voor coding agents blijven in [CLAUDE.md](CLAUDE.md) — dit document
herhaalt ze niet, het verwijst ernaar. Laatst bijgewerkt: 26 september 2026.*

## 1. Rollen en ownership

| Wie | Rol | Beslist over / primair eigenaar van |
|---|---|---|
| **David** | Product owner / architect / analist | Productrichting, requirements, prioriteiten, scope, businessbeslissingen, finale architectuurkeuzes, finale acceptatie. **Mergt elke PR.** |
| **ChatGPT** | Assistent / projectmanager | Roadmap en sequencing, requirements concretiseren, scope bewaken, afhankelijkheden, opdrachten structureren, resultaten van Astra en Fable consolideren, risico's en open beslissingen zichtbaar houden. Vervangt Davids finale beslissingen niet. |
| **Fable** | Primary engine-/platformdeveloper | Game-engine, domeinlogica, determinisme/RNG, save-architectuur en -migraties, backend, Cloudflare Workers, D1/R2, auth-/backendintegratie, RBAC, cloud-save/sync, admin-backend, tester-/dev-backend, logging/diagnostiek, CI/CD, staging/productie-infrastructuur, security-grenzen. Heeft door de implementatiegeschiedenis bijzondere ground-truth-kennis van de motor. |
| **Astra** | Primary UX/UI-/frontend-productdeveloper | UX/UI, visueel ontwerp, informatiearchitectuur, interactieontwerp, desktop-UX, adaptieve iPad-UX, smartphone/funnel-UX, toegankelijkheid, onboarding, visualisaties, navigatie/taakcontinuïteit, browser-gedreven visuele QA, user-facing presentatie van backend-/account-/cloudfunctionaliteit. |

Grensregels:

- Astra mag TypeScript en gedeelde frontendarchitectuur wijzigen wanneer zijn slice dat
  vereist, maar wijzigt **niet opportunistisch** engine-, infrastructuur- of economieregels.
- Fable bepaalt **niet** automatisch frontend-/UX-beslissingen; cross-review is
  kwaliteitsborging, geen ownership-overname. Dat geldt in beide richtingen.
- Ownership betekent: eerste auteur én eerste aanspreekpunt, niet exclusiviteit.

## 2. Cross-review

Het model dat tijdens Slices 1–3 goed werkte, blijft de standaard.

**Astra implementeert:**

```
Astra implementeert → implementatieverslag → Fable reviewt onafhankelijk
(code + domeincorrectheid, zelf metingen draaien) → bevindingen geclassificeerd
→ fixes → eindverificatie → PR → David accepteert/mergt
```

**Fable implementeert:**

```
Fable implementeert → technische verificatie → bij user-facing gedrag reviewt
Astra UX-/productimpact → bevindingen → fixes → David accepteert/mergt
```

Onafhankelijkheidsregels:

- De reviewer controleert de **daadwerkelijke code en het daadwerkelijke gedrag** (zelf
  tests draaien, zelf de app bedienen), niet alleen het verslag.
- Geen gedeeld AI-geheugen dat de reviewer de interpretatie van de implementeerder laat
  overnemen. Kennis reist expliciet via repo-docs, implementatieverslagen, reviewverslagen
  en de volgende scoped opdracht — nooit via impliciete herinnering tussen agents.
- Een implementatieverslag zonder meting is geen bewijs ("meten, niet beweren" — CLAUDE.md).

## 3. Reviewclassificatie

| Label | Betekenis | Gevolg |
|---|---|---|
| **BLOCKER** | Moet vóór merge opgelost | PR wacht |
| **FIX BEFORE MERGE** | Klein/beheersbaar, hoort vóór merge te verdwijnen | fix in dezelfde PR |
| **FOLLOW-UP** | Reëel punt, bewust buiten huidige scope | taak in ROADMAP.md |
| **NOTE** | Observatie/context | geen wijziging vereist |

Geen stilzwijgende scope-uitbreiding: wat niet in de opdracht zat en geen BLOCKER is, wordt
FOLLOW-UP — ook als het klein lijkt.

## 4. Branches en parallel werk

Basisregels (aanvullend op CLAUDE.md):

- Elke nieuwe taak start vanaf **actuele `origin/main`** (eerst fetchen).
- Kleine, kortlevende featurebranches (`claude/<korte-omschrijving>`); geen wekenlang
  divergerende branches.
- Vóór wijzigingen aan gedeelde kernbestanden: actuele main controleren op recent werk.
- Ongerelateerd/untracked werk van anderen (bv. losse scripts) blijft onaangeroerd.
- `src/version.ts` wordt op featurebranches nooit handmatig gewijzigd; de release-automation
  beheert versie en changelog (zie CLAUDE.md).

**Conflictzones** — bij parallel werk dat deze raakt geldt verhoogde alertheid:

`src/engine/*` · `src/storage/*` · `src/ui/main.ts` · `src/ui/header.ts` · gedeelde
UI-/navigatiehelpers (`signals.ts`, `keys.ts`, `task-context.ts`, `workflow-panel.ts`,
`financial.ts`, `subsidiezaak.ts`) · `package.json`/lockfile · `wrangler.jsonc` ·
`README.md` · `CLAUDE.md` · roadmap-/architectuurdocs.

**STOP-regel:** raken twee parallelle opdrachten dezelfde concepten of bestanden, dan stopt
het werk daar, wordt gesynchroniseerd via David/projectmanagement, en wordt de opdracht
herbaseerd op actuele main. Liever een uur wachten dan een middag mergen.

## 5. Platformstrategie (bindend voor reviews)

| Platform | Status | Regel |
|---|---|---|
| Desktop/browser | **Primair en normatief** | Informatiedichtheid, brede tabellen, simultane vergelijking en snelle muis/toetsenbord-workflows blijven. |
| iPad | Volwaardige full-gameplay-omgeving | Adaptieve UI toegestaan (panelen, sheets, andere stapeling, progressive disclosure) — maar **nooit desktop degraderen** voor tabletuniformiteit. Bij conflict: beste desktopoplossing behouden + tablet-specifieke presentatie ernaast. |
| Smartphone | Discovery/funnel/basisverkenning | Niet elke complexe managementflow hoeft phone-optimaal. |

**Desktopregressie door tablet-/mobieloptimalisatie is een BLOCKER.**

## 6. Definition of Done

Een wijziging is af wanneer:

1. Tests toegevoegd/aangepast — in het Nederlands, met erboven waaróm (CLAUDE.md).
2. `npm test`, `npm run typecheck` en `npm run build` slagen (exitcodes gecontroleerd, niet
   alleen output gegrept).
3. Echte layoutwijzigingen zijn vóór/na in de draaiende app geverifieerd met schermafdrukken
   (browser-QA hoort bij de implementatie, niet bij de review alleen).
4. Economische wijzigingen zijn gemeten met de meetscripts (`balance`/`autopilot`/
   `economie`/doorlichting), op stabiele code, lang genoeg (zie CLAUDE.md "Vallen bij het
   meten").
5. Toegankelijkheid is meegenomen: focusroutes, tekstlabels naast kleur, bereikbare uitleg
   (patroon uit Slices 1–3).
6. Save-schemawijzigingen hebben een migratie + migratietest; oude saves blijven laden.
7. Engine-invarianten gerespecteerd (zie §7).
8. Implementatieverslag geschreven; cross-review afgerond; ROADMAP.md bijgewerkt als de taak
   daar staat.

## 7. Engineering-invarianten

Deze zijn niet onderhandelbaar zonder expliciete productbeslissing:

- De motor blijft **DOM-vrij, deterministisch en environment-agnostisch**; `advanceWeek(state)`
  geeft een nieuwe toestand; geen nieuwe toevalligheid voor presentatie; geen gewijzigde
  RNG-trekkingsvolgorde zonder benoemde reden.
- **Het scherm rekent nooit apart**: elk getoond getal komt uit de motorfuncties.
- Previews/vergelijkingen draaien op een kopie (`structuredClone`) via de échte acties en
  wijzigen de speltoestand niet — en voorspellen geen RNG-uitkomsten.
- Logging voor ontwikkelaars via `src/log`, nooit in schermen, browserconsole (productie) of
  saves.
- Spelerstaal 10+; technische details horen niet in de spelers-changelog.
- Verborgen frontendknoppen zijn nooit security; autorisatie en ownership worden server-side
  gecontroleerd zodra er een server is.

## 8. Communicatieprotocol

```
Developer ontvangt scoped opdracht
→ controleert actuele main + docs (ROADMAP, PLAYBOOK, ARCHITECTURE, CLAUDE.md)
→ rapporteert implementatieplan wanneer gevraagd
→ implementeert
→ draait vereiste verificatie (DoD §6)
→ schrijft implementatieverslag (wat, hoe geverifieerd, beperkingen eerlijk benoemd)
→ onafhankelijke reviewer verifieert zelf
→ bevindingen geclassificeerd (§3)
→ developer fixt
→ eindverificatie
→ PR (titel in spelerstaal — wordt het changelog-item)
→ David accepteert/mergt
```

Belangrijke cross-agent-kennis reist uitsluitend via: repository-docs, implementatie­verslagen,
reviewverslagen en de volgende scoped opdracht.

## 9. Documentatieverantwoordelijkheden

| Document | Wordt bijgewerkt wanneer | Door |
|---|---|---|
| ROADMAP.md | een geplande taak start/afrondt/blokkeert of een FOLLOW-UP ontstaat | de developer van die PR |
| ARCHITECTURE.md | een echte architectuurbeslissing valt of vastgelegde architectuur aantoonbaar verandert | Fable (platform) / Astra (frontendarchitectuur), met Davids akkoord voor beslissingen |
| DEVELOPMENT_PLAYBOOK.md | samenwerking, reviewflow of DoD verandert | David/ChatGPT met het team |
| README.md | ontwerpkeuzes en metingen per laag (bestaande conventie, incl. foute conclusies met correctie) | de implementeerder |
| CLAUDE.md | operationele repo-regels veranderen | David |

Geen changelog van elke codewijziging in deze documenten; geen dubbele vastlegging van
dezelfde regel in meerdere documenten — verwijs.

## 10. Source of truth

| Onderwerp | Leidende bron |
|---|---|
| Productbeslissingen | David / expliciet goedgekeurde roadmap- en architectuurbeslissingen |
| Huidige implementatie | actuele code op `main` |
| Coding-/repositoryworkflow | CLAUDE.md + actuele repositoryconfiguratie |
| Projectprioriteit / ownership / status | ROADMAP.md |
| Teamwerkafspraken | DEVELOPMENT_PLAYBOOK.md (dit document) |
| Technische doelarchitectuur | ARCHITECTURE.md |
| Historische context | README.md / HANDOVER.md (HANDOVER is een gedateerde momentopname) |

Bij conflict: niet stil kiezen — noteer het conflict in het relevante document of escaleer
naar David.
