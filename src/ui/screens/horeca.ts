// Kantine en concessies: prijzen aan de toog en standhouders op het complex.

import type { GameState } from '../../engine/types';
import { CANTEEN_ITEMS, CONCESSIONS, CONCESSION_SPACE, canteenDef, concessionDef } from '../../engine/data/catalog';
import { acceptedMargin, canteenPriceFactor, concessionForecast, expectedCanteenUnits } from '../../engine/canteen';
import { usedConcessionSpace } from '../../engine/actions';
import { expectedAttendance } from '../../engine/finance';
import { delegate } from '../../engine/delegation';
import { esc, euro } from '../format';
import { hint, tip } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';

const money = (n: number) => `€${n.toFixed(2)}`;

export function horecaScreen(s: GameState): string {
  const manager = delegate(s, 'horeca');
  const locked = !!manager;
  const attendance = expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });

  const rows = s.canteen.items
    .map((item) => {
      const def = canteenDef(item.id);
      const units = expectedCanteenUnits(s, item.id, attendance);
      const sold = s.canteen.lastCanteen.find((c) => c.id === item.id);
      const pf = canteenPriceFactor(item.price, def.ref);
      const marginEach = item.price - def.cost;
      return `<tr>
        <td><strong>${esc(def.label)}</strong><br/><span class="muted small">inkoop ${money(def.cost)}</span></td>
        <td class="num">${
          locked
            ? `<strong>${money(item.price)}</strong>`
            : numField({ value: item.price, min: def.cost, max: def.ref * 4, step: 0.1, decimals: 2, prefix: '€', change: 'canteen-price', rowId: item.id, label: `Prijs ${def.label}` })
        }</td>
        <td class="num">${money(marginEach)}</td>
        <td class="num" ${tip('100% = de verkoop die je aan een normale prijs haalt. Duurder verkoop je minder, goedkoper verkoop je meer maar met minder marge per stuk.')}>${Math.round(pf * 100)}%</td>
        <td class="num">${Math.round(units)}</td>
        <td class="num">${euro(Math.round(units * marginEach))}</td>
        <td class="num">${sold ? `${sold.units} · ${euro(sold.revenue)}` : '–'}</td>
      </tr>`;
    })
    .join('');

  const totalMargin = s.canteen.items.reduce((sum, i) => sum + expectedCanteenUnits(s, i.id, attendance) * (i.price - canteenDef(i.id).cost), 0);

  const standRows = s.canteen.concessions
    .map((c) => {
      const def = concessionDef(c.id);
      const sold = s.canteen.lastConcessions.find((x) => x.id === c.id);
      const max = acceptedMargin(s, c.id);
      return `<tr>
        <td><strong>${esc(def.label)}</strong><br/><span class="muted small">${esc(c.partner)} · sinds seizoen ${c.sinceSeason} · prijs voor de supporter ${money(def.price)}</span></td>
        <td class="num">${
          locked
            ? `<strong>${c.marginPct}%</strong>`
            : numField({ value: c.marginPct, min: 0, max: 60, step: 1, suffix: '%', change: 'concession-margin', rowId: c.id, label: `Marge ${def.label}` })
        }<br/><span class="muted small">hij gaat tot ongeveer ${max}% erboven of eronder</span></td>
        <td class="num">${euro(concessionForecast(s, c.id, c.marginPct, attendance))}</td>
        <td class="num">${sold ? `${sold.units} · ${euro(sold.revenue)} omzet` : '–'}</td>
        <td>${locked ? '' : `<button class="sm ghost" data-action="close-concession" data-id="${c.id}">Stopzetten</button>`}</td>
      </tr>`;
    })
    .join('');

  const free = CONCESSIONS.filter((d) => !s.canteen.concessions.some((c) => c.id === d.id));
  const space = CONCESSION_SPACE - usedConcessionSpace(s);

  return `${taskPicker(s, ['horeca'])}<div class="grid">
    <section class="card span2">
      <h2>Kantine ${hint('De kantine draait op thuiswedstrijden. Je verdient het verschil tussen je prijs en de inkoopprijs; vrijwilligers, het kantineniveau en je populariteit bepalen hoeveel er besteld wordt.')}</h2>
      <p class="muted small">Prijzen passen zich meteen toe, je hoeft niets op te slaan. Verwachting bij een gewone thuiswedstrijd met ongeveer ${attendance} toeschouwers.</p>
      ${locked ? `<p class="attention-inline small">${esc(manager!.name)} bepaalt de prijzen en de concessies. Neem de taak "Kantine en concessies" terug bij Personeel om zelf te beslissen.</p>` : ''}
      <div class="table-wrap"><table class="compact sortable">
        <thead><tr><th>Artikel</th><th class="num">Prijs</th><th class="num" data-tip="Wat je overhoudt per verkocht stuk, na aftrek van de inkoopprijs">Winst per stuk</th><th class="num" data-tip="Hoeveel er meer of minder besteld wordt door jouw prijs, vergeleken met de gangbare prijs">Effect van je prijs</th><th class="num">Verwacht aantal</th><th class="num">Verwachte winst</th><th class="num">Vorige wedstrijd</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total"><td>Samen</td><td colspan="4"></td><td class="num">${euro(Math.round(totalMargin))}</td><td></td></tr></tfoot>
      </table></div>
    </section>
    <section class="card span2">
      <h2>Concessies ${hint('Standhouders staan op jouw terrein en betalen je een percentage van hun omzet. Vraag je te veel, dan haken ze af of verhogen ze hun prijzen, waardoor ze minder verkopen.')}</h2>
      <p class="muted small">Plaats: ${space} van ${CONCESSION_SPACE} eenheden vrij. Wat ze aanvaarden hangt af van je publiek, je populariteit en je kantineverantwoordelijke.</p>
      ${
        standRows
          ? `<div class="table-wrap"><table class="compact">
              <thead><tr><th>Stand</th><th class="num">Jouw marge</th><th class="num">Per thuiswedstrijd</th><th class="num">Vorige wedstrijd</th><th></th></tr></thead>
              <tbody>${standRows}</tbody>
            </table></div>`
          : '<p class="muted">Nog geen standhouders op het complex.</p>'
      }
      <h3>Nieuwe standhouder</h3>
      <div class="choice-grid two">
        ${
          free
            .map((d) => {
              const max = acceptedMargin(s, d.id);
              const fits = d.space <= space;
              return `<div class="choice static"><strong>${esc(d.label)}</strong>
              <span class="muted small">prijs voor de supporter ${money(d.price)} · neemt ${d.space} ${d.space === 1 ? 'plaats' : 'plaatsen'} in · gaat akkoord tot ongeveer ${max}% erboven of eronder</span>
              <span class="big">${euro(concessionForecast(s, d.id, max, attendance))} <span class="muted small">per thuiswedstrijd bij ${max}%</span></span>
              ${
                locked
                  ? '<span class="muted small">je verantwoordelijke beslist dit</span>'
                  : fits
                    ? `<span class="ask">${numField({ value: max, min: 0, max: 60, step: 1, suffix: '%', inputId: `margin-${d.id}`, label: 'Voorgestelde marge' })}
                       <button class="sm primary" data-action="open-concession" data-id="${d.id}">Onderhandelen</button></span>`
                    : '<span class="muted small">geen plaats meer op het complex</span>'
              }
            </div>`;
            })
            .join('') || '<p class="muted">Alle kramen staan er al.</p>'
        }
      </div>
    </section>
  </div>`;
}

export { CANTEEN_ITEMS };
