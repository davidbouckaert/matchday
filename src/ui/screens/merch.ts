// Fanshop: assortiment en prijzen van de clubartikelen.

import type { GameState } from '../../engine/types';
import { MERCH_ITEMS, MERCH_ITEM_WEEK_COST, MERCH_START_COST, MERCH_WEEK_COST, merchDef } from '../../engine/data/catalog';
import { bestPrice, buyPrice, expectedUnits, isHomeMatchWeek, margin, merchPriceFactor, refPrice } from '../../engine/merch';
import { delegate } from '../../engine/delegation';
import { staffSkill } from '../../engine/staff';
import { esc, euro } from '../format';
import { tip } from '../tooltip';

export function merchScreen(s: GameState): string {
  const m = s.merch;
  const manager = delegate(s, 'merchandising');
  const locked = !!manager;

  if (!m.active) {
    return `<section class="card">
      <h2>Fanshop</h2>
      <p>Supporters kopen graag een sjaal of een shirt van hun club. Met een eigen shop en webshop verdien je aan elke thuiswedstrijd,
      en ook tussendoor verkoop je nog wat. Jij kiest welke artikelen in de rekken liggen en wat ze kosten.</p>
      <ul class="small">
        <li>Eenmalige inrichting: <strong>${euro(MERCH_START_COST)}</strong> (rekken, kassasysteem, webshop). Een sjaal ligt er meteen in.</li>
        <li>Per artikel dat je in het assortiment neemt, betaal je eerst drukwerk en voorraad.</li>
        <li>Vaste werkingskost: ${euro(MERCH_WEEK_COST)} per week plus ${euro(MERCH_ITEM_WEEK_COST)} per artikel.</li>
        <li>Je verdient het verschil tussen je verkoopprijs en de inkoopprijs. Te duur = je verkoopt veel minder.</li>
      </ul>
      <button class="primary" data-action="start-merch" ${s.cash < MERCH_START_COST ? 'disabled' : ''}>Fanshop openen (${euro(MERCH_START_COST)})</button>
      ${s.cash < MERCH_START_COST ? '<p class="muted small">Je hebt hier op dit moment te weinig geld voor.</p>' : ''}
    </section>`;
  }

  const lastTotal = m.lastUnits.reduce((sum, u) => sum + u.revenue, 0);
  const lastUnits = m.lastUnits.reduce((sum, u) => sum + u.units, 0);
  const expectedRevenue = m.items.reduce((sum, i) => sum + expectedUnits(s, i) * margin(s, i), 0);
  const fixed = MERCH_WEEK_COST * (1 - staffSkill(s, 'merchandising') / 400) + m.items.length * MERCH_ITEM_WEEK_COST;

  const rows = m.items
    .map((item) => {
      const def = merchDef(item.id);
      const units = expectedUnits(s, item);
      const sold = m.lastUnits.find((u) => u.id === item.id);
      const pf = merchPriceFactor(item.price, refPrice(s, item.id));
      const best = bestPrice(s, item.id);
      return `<tr>
        <td><strong>${esc(def.label)}</strong><br/><span class="muted small">richtprijs €${refPrice(s, item.id)} · inkoop ${euro(Math.round(buyPrice(s, item.id)))}</span></td>
        <td class="num">${locked ? `<strong>€${item.price}</strong>` : `<input class="price" type="number" min="1" max="${Math.round(def.ref * 4)}" value="${item.price}" data-change="merch-price" data-id="${item.id}" aria-label="Prijs ${esc(def.label)}"/>`}</td>
        <td class="num">${euro(Math.round(margin(s, item)))}</td>
        <td class="num" ${tip('100% = normale verkoop aan de richtprijs. De richtprijs stijgt mee met je populariteit: bij een populaire club betalen mensen meer voor hetzelfde shirt.')}>${Math.round(pf * 100)}%<br/><span class="muted small">${item.price > best ? 'duurder dan ideaal' : item.price < best ? 'goedkoper dan ideaal' : 'ideaal'} (€${best})</span></td>
        <td class="num">${units.toFixed(1)}</td>
        <td class="num">${sold ? `${sold.units} · ${euro(sold.revenue)}` : '–'}</td>
        <td class="num">${item.soldTotal}</td>
        <td class="nowrap">${locked ? '' : `<button class="sm ghost" data-action="remove-merch-item" data-id="${item.id}">Uit de shop</button>`}</td>
      </tr>`;
    })
    .join('');

  const missing = MERCH_ITEMS.filter((d) => !m.items.some((i) => i.id === d.id));

  return `<div class="grid">
    <section class="card span2">
      <h2>Fanshop</h2>
      <p class="muted small">
        ${isHomeMatchWeek(s) ? 'Deze week is er een thuiswedstrijd: de shop verkoopt ongeveer 3,4 keer zoveel.' : 'Zonder thuiswedstrijd draait alleen de webshop.'}
        Verkoop hangt af van je supporters, de sfeer, je klassement en je prijs. De details staan bij Invloeden.
      </p>
      ${locked ? `<p class="attention-inline small">${esc(manager!.name)} beheert de fanshop: hij zet de prijzen en breidt het assortiment uit. Haal de taak bij Staff terug om zelf te beslissen.</p>` : ''}
      <dl class="facts">
        <dt>Vorige week</dt><dd>${lastUnits} artikelen · ${euro(lastTotal)} omzet</dd>
        <dt>Dit seizoen</dt><dd>${m.seasonUnits} artikelen verkocht</dd>
        <dt>Verwachte brutowinst deze week</dt><dd>${euro(Math.round(expectedRevenue - fixed))} <span class="muted small">(na ${euro(Math.round(fixed))} werkingskosten)</span></dd>
      </dl>
      <div class="table-wrap">
        <table class="compact sortable">
          <thead><tr><th>Artikel</th><th class="num">Prijs</th><th class="num">Marge</th><th class="num">Prijseffect</th><th class="num">Verwacht/week</th><th class="num">Vorige week</th><th class="num">Totaal</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="muted">Nog geen artikelen in de shop.</td></tr>'}</tbody>
        </table>
      </div>
      <p class="muted small">Prijzen worden meteen toegepast, je hoeft niets op te slaan. Prijseffect: 100% = normale verkoop aan de richtprijs. Vraag je het dubbele, dan verkoop je ongeveer een derde.</p>
    </section>
    <section class="card span2">
      <h2>Assortiment uitbreiden</h2>
      <p class="muted small">Je betaalt eenmalig drukwerk en de eerste voorraad. Populaire artikelen verkopen vaker, dure artikelen leveren meer per stuk op.</p>
      <div class="choice-grid two">
        ${missing
          .map(
            (d) => `<div class="choice static"><strong>${esc(d.label)}</strong>
            <span class="muted small">inkoop €${d.buy} · richtprijs €${d.ref} · populariteit ${Math.round(d.appeal * 100)}%</span>
            <span class="big">${euro(d.setup)}</span>
            ${locked ? '<span class="muted small">je verantwoordelijke beslist dit</span>' : `<button class="sm primary" data-action="add-merch-item" data-id="${d.id}" ${s.cash < d.setup ? 'disabled' : ''}>In de shop</button>`}
          </div>`,
          )
          .join('') || '<p class="muted">Alles ligt al in de rekken.</p>'}
      </div>
    </section>
  </div>`;
}
