// Contracten: wie loopt af, wat vraagt hij, en wat bied jij?

import type { GameState, Player } from '../../engine/types';
import { POSITIONS, isCorePlayer, overall } from '../../engine/players';
import { askingWage, wageOfferEffect } from '../../engine/actions';
import { delegate } from '../../engine/delegation';
import { esc, euro } from '../format';
import { contractLabel } from './playercard';
import { tip } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';

function moodWord(n: number): string {
  return n >= 8 ? 'erg blij' : n > 0 ? 'tevreden' : n === 0 ? 'neutraal' : n > -10 ? 'ontgoocheld' : 'boos';
}

function row(s: GameState, p: Player, locked: boolean): string {
  const ask = askingWage(s, p);
  const seasonsLeft = p.contractUntil - s.season;
  const suggestion = Math.round(ask / 5) * 5;
  const { chance, morale } = wageOfferEffect(s, p, suggestion);
  return `<tr class="${seasonsLeft <= 0 ? 'expiring' : ''}">
    <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
    <td><strong>${esc(p.name)}</strong>${isCorePlayer(s, p) ? ` <span class="core" ${tip('Kernspeler: bij je beste elf of een groot talent. Hem kwijtspelen doet pijn.')}>★</span>` : ''}
      <br/><span class="muted small">${p.age} jaar · ${esc(p.trait)} · moraal ${Math.round(p.morale)}</span></td>
    <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
    <td data-v="${p.contractUntil}" class="${seasonsLeft <= 0 ? 'neg' : ''}">${contractLabel(s, p).kort}<br/><span class="muted small">${seasonsLeft <= 0 ? 'hij mag gratis weg' : 'daarna mag hij gratis weg'}</span></td>
    <td data-v="${p.wage}">${euro(p.wage)}</td>
    <td data-v="${ask}" ${tip('Wat hij vraagt. Hangt af van zijn kwaliteit, leeftijd, vorm, moraal en of hij tot je kern behoort.')}>${euro(ask)}</td>
    <td>${
      locked
        ? '<span class="muted small">je personeel regelt dit</span>'
        : `<span class="ask">${numField({ value: suggestion, min: 40, step: 5, prefix: '€', inputId: `wage-${p.id}`, label: `Loonvoorstel voor ${p.name}` })}
           <button class="sm primary" data-action="extend" data-id="${p.id}">Dit bod doen</button></span>
           <br/><span class="muted small">bij ${euro(suggestion)}: ${Math.round(chance * 100)}% kans, hij is ${moodWord(morale)}</span>`
    }</td>
  </tr>`;
}

export function contractsScreen(s: GameState): string {
  const agent = delegate(s, 'contracten');
  const squad = [...s.players].sort((a, b) => a.contractUntil - b.contractUntil || overall(b) - overall(a));
  const expiring = squad.filter((p) => p.contractUntil <= s.season);
  const rest = squad.filter((p) => p.contractUntil > s.season);
  const wages = s.players.reduce((sum, p) => sum + p.wage, 0);

  return `${taskPicker(s, ['contracten'])}<div class="grid">
    <section class="card span2">
      <h2>Contracten</h2>
      <p class="muted small">Een contract loopt af op het einde van een seizoen. Verleng je niet op tijd, dan vertrekt de speler gratis.
      Bied je minder dan hij vraagt, dan is de kans op een akkoord kleiner en zakt zijn moraal; bied je meer, dan tekent hij graag,
      maar je betaalt het elke week opnieuw. Loonmassa nu: <strong>${euro(wages)}</strong> per week.</p>
      ${agent ? `<p class="attention-inline small">${esc(agent.name)} regelt de verlengingen vanaf week 36. Neem de taak terug bij Personeel om zelf te onderhandelen.</p>` : ''}
      <h3>Loopt af (${expiring.length})</h3>
      <div class="table-wrap"><table class="compact" data-sort-id="contracten-af">
        <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Contract</th><th>Loon nu</th><th>Vraagt</th><th data-nosort>Jouw voorstel</th></tr></thead>
        <tbody>${expiring.map((p) => row(s, p, !!agent)).join('') || '<tr><td colspan="7" class="muted">Geen aflopende contracten.</td></tr>'}</tbody>
      </table></div>
    </section>
    <section class="card span2">
      <h3>Rest van de kern</h3>
      <p class="muted small">Vroeg verlengen kan ook: dan ben je zeker van hem, maar je zit langer aan zijn loon vast (maximaal drie seizoenen vooruit).</p>
      <div class="table-wrap"><table class="compact" data-sort-id="contracten-rest">
        <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Contract</th><th>Loon nu</th><th>Vraagt</th><th data-nosort>Jouw voorstel</th></tr></thead>
        <tbody>${rest.map((p) => row(s, p, !!agent)).join('')}</tbody>
      </table></div>
    </section>
  </div>`;
}
