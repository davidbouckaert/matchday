// Contracten: wie loopt af, wat vraagt hij, en wat bied jij?

import type { GameState, Player } from '../../engine/types';
import { POSITIONS, isCorePlayer, overall } from '../../engine/players';
import { askingWage, wageOfferEffect } from '../../engine/actions';
import { wantsAway } from '../../engine/appeal';
import { delegate } from '../../engine/delegation';
import { loanKeepCard } from './squad';
import { tipAttr } from '../tooltip';
import { esc, euro } from '../format';
import { contractLabel } from './playercard';
import { tip } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';

function moodWord(n: number): string {
  return n >= 8 ? 'erg blij' : n > 0 ? 'tevreden' : n === 0 ? 'neutraal' : n > -10 ? 'ontgoocheld' : 'boos';
}

function row(s: GameState, p: Player, locked: boolean, maxBod: number): string {
  const ask = askingWage(s, p);
  const seasonsLeft = p.contractUntil - s.season;
  const suggestion = Math.round(ask / 5) * 5;
  const { chance, morale } = wageOfferEffect(s, p, suggestion);
  const weg = wantsAway(s, p);
  return `<tr data-speler="${p.id}" class="${seasonsLeft <= 0 ? 'expiring' : ''}">
    <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
    <td><strong>${esc(p.name)}</strong><button class="tablet-inspect" data-action="workflow-open" data-id="contract:${p.id}" aria-label="Contract van ${esc(p.name)} bekijken">Contract bekijken</button>${isCorePlayer(s, p) ? ` <span class="core" ${tip('Kernspeler: bij je beste elf of een groot talent. Hem kwijtspelen doet pijn.')}>★</span>` : ''}${
      weg ? ` <span class="tag bad" ${tip('Hij is uitgegroeid tot een speler voor een hogere reeks en wil die stap zetten: hij verlengt niet, tegen geen enkel loon. Verkoop hem, of word zelf de club die bij hem past.')}>wil hogerop</span>` : ''
    }
      <br/><span class="muted small">${p.age} jaar · ${esc(p.trait)} · moraal ${Math.round(p.morale)}</span></td>
    <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
    <td data-v="${p.contractUntil}" class="${seasonsLeft <= 0 ? 'neg' : ''}">${contractLabel(s, p).kort}<br/><span class="muted small">${seasonsLeft <= 0 ? 'hij mag gratis weg' : 'daarna mag hij gratis weg'}</span></td>
    <td data-v="${p.wage}">${euro(p.wage)}</td>
    <td data-v="${ask}" ${tip('Wat hij vraagt. Hangt af van zijn kwaliteit, leeftijd, vorm, moraal en of hij tot je kern behoort.')}>${euro(ask)}</td>
    <td>${
      locked
        ? '<span class="muted small">je personeel regelt dit</span>'
        : weg
          ? '<span class="muted small">hij wil hogerop: verlengen kan niet</span>'
          : `<span class="ask">${numField({ value: suggestion, min: 40, max: maxBod, step: 5, prefix: '€', inputId: `wage-${p.id}`, label: `Loonvoorstel voor ${p.name}` })}
           <button class="sm primary" data-action="extend" data-id="${p.id}">Dit bod doen</button>${
             p.contractUntil <= s.season
               ? `<button class="sm ghost" data-action="no-extend" data-id="${p.id}" ${tipAttr('Bewust niet verlengen: hij vertrekt gratis op het einde van het seizoen en verdwijnt uit je waarschuwingen. Je kunt je bedenken zolang het seizoen loopt.')}>Niet verlengen</button>`
               : ''
           }</span>
           <br/><span class="muted small">bij ${euro(suggestion)}: ${Math.round(chance * 100)}% kans, hij is ${moodWord(morale)}</span>`
    }</td>
  </tr>`;
}

export function contractsScreen(s: GameState): string {
  const agent = delegate(s, 'contracten');
  // een huurspeler heeft hier geen contract dat "afloopt": hij keert terug naar zijn
  // club, en blijven of kopen regel je met zíjn eigenaar — die kaart staat hieronder
  const squad = [...s.players]
    .filter((p) => p.loan?.type !== 'in')
    .sort((a, b) => a.contractUntil - b.contractUntil || overall(b) - overall(a));
  const expiring = squad.filter((p) => p.contractUntil <= s.season && !p.nietVerlengen);
  const vertrekt = squad.filter((p) => p.contractUntil <= s.season && p.nietVerlengen);
  const rest = squad.filter((p) => p.contractUntil > s.season);
  const wages = s.players.reduce((sum, p) => sum + p.wage, 0);
  // numField reserveert de breedte van zijn veld op het grootst mogelijke getal; zonder een
  // gedeeld plafond gokt elke rij dat op tien keer háár eigen loonvoorstel, en dan springt de
  // knop ernaast in- en uit bij elke speler met een korter of langer bedrag.
  const maxBod = Math.max(40, ...squad.map((p) => Math.round(askingWage(s, p) / 5) * 5));

  return `${taskPicker(s, ['contracten'])}<div class="grid">
    <section class="card span-all">
      <h2>Eigen spelers: aflopende contracten</h2>
      <p class="muted small">Een contract loopt af op het einde van een seizoen. Verleng je niet op tijd, dan vertrekt de speler gratis.
      Bied je minder dan hij vraagt, dan is de kans op een akkoord kleiner en zakt zijn moraal; bied je meer, dan tekent hij graag,
      maar je betaalt het elke week opnieuw. Loonmassa nu: <strong>${euro(wages)}</strong> per week.</p>
      ${agent ? `<p class="attention-inline small">${esc(agent.name)} regelt de verlengingen vanaf week 36. Neem de taak terug bij Personeel om zelf te onderhandelen.</p>` : ''}
      <h3>Loopt af (${expiring.length})</h3>
      <div class="table-wrap"><table class="compact contract-tabel" data-sort-id="contracten-af">
        <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Contract</th><th>Loon nu</th><th>Vraagt</th><th data-nosort>Jouw voorstel</th></tr></thead>
        <tbody>${expiring.map((p) => row(s, p, !!agent, maxBod)).join('') || '<tr><td colspan="7" class="muted">Geen aflopende contracten.</td></tr>'}</tbody>
      </table></div>
      ${
        vertrekt.length
          ? `<h3>Laat je vertrekken (${vertrekt.length})</h3>
      <p class="muted small">Deze contracten verleng je bewust niet: ze vertrekken gratis op het einde van het seizoen en tellen niet meer mee in je waarschuwingen.</p>
      <ul class="small">${vertrekt
        .map(
          (p) => `<li><strong>${esc(p.name)}</strong> (${p.position}, ${overall(p)}) · ${euro(p.wage)}/week
            <button class="link-btn small" data-action="no-extend" data-id="${p.id}">Toch verlengen →</button></li>`,
        )
        .join('')}</ul>`
          : ''
      }
    </section>
    <section class="card span-all">
      <h2>Eigen spelers: rest van de kern</h2>
      <p class="muted small">Vroeg verlengen kan ook: dan ben je zeker van hem, maar je zit langer aan zijn loon vast (maximaal drie seizoenen vooruit).</p>
      <div class="table-wrap"><table class="compact contract-tabel" data-sort-id="contracten-rest">
        <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Contract</th><th>Loon nu</th><th>Vraagt</th><th data-nosort>Jouw voorstel</th></tr></thead>
        <tbody>${rest.map((p) => row(s, p, !!agent, maxBod)).join('')}</tbody>
      </table></div>
    </section>
    ${loanKeepCard(s)}
  </div>`;
}
