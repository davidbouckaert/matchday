// Clubwinkel: assortiment en prijzen van de clubartikelen.

import type { GameState } from '../../engine/types';
import { MERCH_ITEMS, MERCH_ITEM_WEEK_COST, MERCH_START_COST, MERCH_WEEK_COST, merchDef } from '../../engine/data/catalog';
import { PRINT_PRICE, bestPrice, buyPrice, expectedUnits, isHomeMatchWeek, margin, merchPriceFactor, refPrice, shirtRanking } from '../../engine/merch';
import { delegate } from '../../engine/delegation';
import { staffSkill } from '../../engine/staff';
import { esc, euro } from '../format';
import { hint, tip } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';

export function merchScreen(s: GameState): string {
  const m = s.merch;
  const manager = delegate(s, 'merchandising');
  const locked = !!manager;

  if (!m.active) {
    return `<section class="card" data-tour-doel="winkel">
      <h2>Clubwinkel</h2>
      <p>Supporters kopen graag een sjaal of een shirt van hun club. Met een eigen winkel en webwinkel verdien je aan elke thuiswedstrijd,
      en ook tussendoor verkoop je nog wat. Jij kiest welke artikelen in de rekken liggen en wat ze kosten.</p>
      <ul class="small">
        <li>Eenmalige inrichting: <strong>${euro(MERCH_START_COST)}</strong> (rekken, kassasysteem, webwinkel). Een sjaal ligt er meteen in.</li>
        <li>Per artikel dat je in het assortiment neemt, betaal je eerst drukwerk en voorraad.</li>
        <li>Vaste werkingskost: ${euro(MERCH_WEEK_COST)} per week plus ${euro(MERCH_ITEM_WEEK_COST)} per artikel.</li>
        <li>Je verdient het verschil tussen je verkoopprijs en de inkoopprijs. Te duur = je verkoopt veel minder.</li>
      </ul>
      <button class="primary" data-action="start-merch" ${s.cash < MERCH_START_COST ? 'disabled' : ''}>Clubwinkel openen (${euro(MERCH_START_COST)})</button>
      ${s.cash < MERCH_START_COST ? '<p class="muted small">Je hebt hier op dit moment te weinig geld voor.</p>' : ''}
    </section>`;
  }

  const lastTotal = m.lastUnits.reduce((sum, u) => sum + u.revenue, 0);
  const lastUnits = m.lastUnits.reduce((sum, u) => sum + u.units, 0);
  const lastCost = m.lastUnits.reduce((sum, u) => sum + u.units * buyPrice(s, u.id), 0);
  const seasonRevenue = s.seasonTotals.clubartikelen ?? 0;
  const seasonCost = s.seasonTotals['inkoop winkel'] ?? 0;
  const seasonFixed = s.seasonTotals['werking winkel'] ?? 0;
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
        <td class="num">${locked ? `<strong>€${item.price}</strong>` : `${numField({ value: item.price, min: 1, max: Math.round(def.ref * 4), step: 1, prefix: '€', change: 'merch-price', rowId: item.id, label: `Prijs ${def.label}` })}`}</td>
        <td class="num">${euro(Math.round(margin(s, item)))}</td>
        <td class="num" ${tip('100% = normale verkoop aan de richtprijs. De richtprijs stijgt mee met je populariteit: bij een populaire club betalen mensen meer voor hetzelfde shirt.')}>${Math.round(pf * 100)}%<br/><span class="muted small">${item.price > best ? 'duurder dan ideaal' : item.price < best ? 'goedkoper dan ideaal' : 'ideaal'} (€${best})</span></td>
        <td class="num">${units.toFixed(1)}</td>
        <td class="num">${sold ? `${sold.units} · ${euro(sold.revenue)}` : '–'}</td>
        <td class="num">${item.soldTotal}</td>
        <td class="nowrap">${locked ? '' : `<button class="sm ghost" data-action="remove-merch-item" data-id="${item.id}">Uit de winkel</button>`}</td>
      </tr>`;
    })
    .join('');

  const missing = MERCH_ITEMS.filter((d) => !m.items.some((i) => i.id === d.id));

  return `${taskPicker(s, ['merchandising'])}<div class="grid">
    <section class="card span2" data-tour-doel="winkel">
      <h2>Clubwinkel</h2>
      <p class="muted small">
        ${isHomeMatchWeek(s) ? 'Deze week is er een thuiswedstrijd: de winkel verkoopt ongeveer 3,4 keer zoveel.' : 'Zonder thuiswedstrijd draait alleen de webwinkel.'}
        Verkoop hangt af van je supporters, de sfeer, je klassement en je prijs. De details staan bij Invloeden.
      </p>
      ${locked ? `<p class="attention-inline small">${esc(manager!.name)} beheert de clubwinkel: hij zet de prijzen en breidt het assortiment uit. Haal de taak bij Personeel terug om zelf te beslissen.</p>` : ''}
      <dl class="facts">
        <dt>Vorige week</dt><dd>${lastUnits} artikelen · ${euro(lastTotal)} omzet · inkoop ${euro(Math.round(lastCost))} · winst ${euro(Math.round(lastTotal - lastCost - fixed))}</dd>
        <dt>Dit seizoen</dt><dd>${m.seasonUnits} artikelen verkocht · omzet ${euro(seasonRevenue)} · inkoop ${euro(-seasonCost)} · werking ${euro(-seasonFixed)}</dd>
        <dt>Verwachte winst deze week</dt><dd>${euro(Math.round(expectedRevenue - fixed))} <span class="muted small">(marge op de verkoop min ${euro(Math.round(fixed))} vaste werkingskosten)</span></dd>
      </dl>
      <p class="muted small" ${tip('Inkoop is alleen wat je voor de verkochte artikelen betaalde. De vaste werkingskosten en het drukwerk van een nieuw artikel staan apart als "werking winkel", zodat je je echte marge ziet.')}>
        Je boekhouding splitst dit in drie: <strong>clubartikelen</strong> (omzet), <strong>inkoop winkel</strong> (wat de verkochte artikelen kostten) en <strong>werking winkel</strong> (vaste kosten en eerste voorraad van nieuwe artikelen).</p>
      <div class="table-wrap">
        <table class="compact sortable">
          <thead><tr><th>Artikel</th><th class="num">Prijs</th><th class="num" data-tip="Wat je overhoudt per verkocht stuk, na aftrek van de inkoopprijs">Winst per stuk</th><th class="num" data-tip="Hoeveel er meer of minder verkocht wordt door jouw prijs, vergeleken met de richtprijs">Effect van je prijs</th><th class="num">Verwacht/week</th><th class="num">Vorige week</th><th class="num">Totaal</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="muted">Nog geen artikelen in de winkel.</td></tr>'}</tbody>
        </table>
      </div>
      <p class="muted small">Prijzen worden meteen toegepast, je hoeft niets op te slaan. Prijseffect: 100% = normale verkoop aan de richtprijs. Vraag je het dubbele, dan verkoop je ongeveer een derde.</p>
    </section>
    ${shirtNamesCard(s)}
    <section class="card span2">
      <h2>Assortiment uitbreiden</h2>
      <p class="muted small">Je betaalt eenmalig drukwerk en de eerste voorraad. Populaire artikelen verkopen vaker, dure artikelen leveren meer per stuk op.</p>
      <div class="choice-grid two">
        ${missing
          .map(
            (d) => `<div class="choice static"><strong>${esc(d.label)}</strong>
            <span class="muted small">inkoop €${d.buy} · richtprijs €${d.ref} · populariteit ${Math.round(d.appeal * 100)}%</span>
            <span class="big">${euro(d.setup)}</span>
            ${locked ? '<span class="muted small">je verantwoordelijke beslist dit</span>' : `<button class="sm primary" data-action="add-merch-item" data-id="${d.id}" ${s.cash < d.setup ? 'disabled' : ''}>In de winkel</button>`}
          </div>`,
          )
          .join('') || '<p class="muted">Alles ligt al in de rekken.</p>'}
      </div>
    </section>
  </div>`;
}

/**
 * De namen op de shirts: wie een replicashirt koopt, laat er vaak een naam op drukken —
 * en welke naam, dat beslist de tribune. Deze ranglijst is dus geen meter die wij
 * verzinnen maar de optelsom van echte drukorders: zo zie je zwart op wit wie je
 * populairste speler is. Bovenaan prijkt de publiekslieveling met een kroontje.
 */
function shirtNamesCard(s: GameState): string {
  const m = s.merch;
  const shirtInWinkel = m.items.some((i) => i.id === 'shirt');
  const verkocht = [...m.shirtNames].sort((a, b) => b.aantal - a.aantal);
  const favoriet = verkocht.length && verkocht[0].aantal > 0 ? verkocht[0] : null;
  // nog geen drukorders? toon dan alvast wie de winkel vooraan zou leggen
  const verwacht = shirtRanking(s).slice(0, 5);
  const omzet = m.shirtNames.reduce((sum, x) => sum + x.aantal, 0);

  const rijen = (verkocht.length ? verkocht.slice(0, 5).map((x, i) => ({ naam: x.name, aantal: x.aantal, top: i === 0 && x === favoriet })) : verwacht.map((x) => ({ naam: x.p.name, aantal: 0, top: false })))
    .map(
      (r, i) => `<tr class="${r.top ? 'pos' : ''}">
        <td class="num">${i + 1}</td>
        <td>${r.top ? '👑 ' : ''}<strong>${esc(r.naam)}</strong>${r.top ? ' <span class="tag">publiekslieveling</span>' : ''}</td>
        <td class="num">${r.aantal}</td>
      </tr>`,
    )
    .join('');

  return `<section class="card span2">
    <h2>De namen op de shirts ${hint(`Wie een wedstrijdshirt koopt, betaalt €${PRINT_PRICE} extra voor een naam en nummer. Welke naam, dat beslist de tribune: basisplaatsen tellen, doelpunten tellen dubbel, een sterspeler verkoopt nog eens zo goed en een jongen uit de eigen jeugd heeft streekwaarde. De ranglijst herbegint elk seizoen.`)}</h2>
    ${
      shirtInWinkel
        ? `<p class="muted small">${
            omzet
              ? `Dit seizoen al ${omzet} ${omzet === 1 ? 'naam' : 'namen'} gedrukt${m.lastPrints.aantal ? ` · vorige week ${m.lastPrints.aantal} (${euro(m.lastPrints.omzet)})` : ''}. De tribune kiest — dit is je populariteitspeiling in het echt.`
              : 'Nog geen drukorders dit seizoen. Zodra er shirts verkopen, zie je hier wiens naam de supporters kiezen; dit is alvast wie de winkel vooraan zou leggen.'
          }</p>
          <div class="table-wrap"><table class="compact">
            <thead><tr><th class="num">#</th><th>Speler</th><th class="num">Gedrukt</th></tr></thead>
            <tbody>${rijen || '<tr><td colspan="3" class="muted">Nog geen spelers om te drukken.</td></tr>'}</tbody>
          </table></div>`
        : `<p class="muted small">Neem het <strong>wedstrijdshirt</strong> in je assortiment (hieronder) en supporters laten er tegen meerprijs een spelersnaam op drukken. De ranglijst verklapt wie je populairste speler is.</p>`
    }
  </section>`;
}
