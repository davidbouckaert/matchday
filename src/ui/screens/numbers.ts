// Cijfers: wat er verkocht en geconsumeerd werd, per seizoen. Zo zie je wat een prijs of een bouwproject doet.

import type { GameState, SeasonStats } from '../../engine/types';
import { CANTEEN_ITEMS, CONCESSIONS, MERCH_ITEMS } from '../../engine/data/catalog';
import { totalOf } from '../../engine/stats';
import { formatWeek, seasonLabel } from '../../engine/calendar';
import { esc, euro } from '../format';
import { hint } from '../tooltip';

function column(s: GameState, st: SeasonStats, current: boolean): string {
  return `<th>${seasonLabel(s.startYear, st.season)}${current ? ' <span class="muted small">(bezig)</span>' : ''}</th>`;
}

function weekView(s: GameState, toggle: string): string {
  const rows = [...s.statsWeeks]
    .reverse()
    .slice(0, 20)
    .map((w) => {
      const rev = Object.entries(w.revenue).filter(([, v]) => (v ?? 0) !== 0);
      const total = rev.reduce((sum, [, v]) => sum + (v ?? 0), 0);
      return `<tr>
        <td>S${w.season} W${w.week}<br/><span class="muted small">${formatWeek(s.startYear, w.season, w.week)}</span></td>
        <td class="num">${w.tickets || '–'}</td>
        <td class="num">${w.canteen || '–'}</td>
        <td class="num">${w.concessions || '–'}</td>
        <td class="num">${w.merch || '–'}</td>
        <td class="num ${total < 0 ? 'neg' : 'pos'}">${euro(total)}</td>
        <td class="small">${rev
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k, v]) => `${k} ${euro(v ?? 0)}`)
          .join(' · ')}</td>
      </tr>`;
    })
    .join('');
  return `<section class="card span2">
    ${toggle}
    <h2>Cijfers per week ${hint('De laatste 20 weken. Tickets, consumpties, porties en artikelen zijn aantallen; het bedrag is wat die bronnen die week opbrachten (inkoop van de winkel inbegrepen).')}</h2>
    <div class="table-wrap"><table class="compact">
      <thead><tr><th>Week</th><th class="num">Tickets</th><th class="num">Consumpties</th><th class="num">Porties kraam</th><th class="num">Artikelen winkel</th><th class="num">Opbrengst</th><th>Waarvan</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="muted">Speel eerst een week.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

export function numbersScreen(s: GameState, view: 'seizoen' | 'week' = 'seizoen'): string {
  const toggle = `<div class="stat-toggle">
    <button class="sm ${view === 'seizoen' ? 'primary' : ''}" data-action="stats-view" data-id="seizoen">Per seizoen</button>
    <button class="sm ${view === 'week' ? 'primary' : ''}" data-action="stats-view" data-id="week">Per week</button>
  </div>`;
  if (view === 'week') return `<div class="grid">${weekView(s, toggle)}</div>`;
  return seasonView(s, toggle);
}

function seasonView(s: GameState, toggle: string): string {
  const seasons = [...s.statsHistory, s.stats];
  const shown = seasons.slice(-5);
  const cell = (fn: (st: SeasonStats) => string) => shown.map((st) => `<td class="num">${fn(st)}</td>`).join('');
  const n = (v: number | undefined) => (v ? Math.round(v).toLocaleString('nl-BE') : '–');

  return `<div class="grid">
    <section class="card span2">
      ${toggle}
      <h2>Cijfers per seizoen ${hint('Alles wordt geteld op het moment van de verkoop. Vergelijk seizoenen om te zien wat een prijswijziging, een bouwproject of een betere ploeg opbrengt.')}</h2>
      <p class="muted small">Het lopende seizoen telt nog verder op. Tickets en consumpties komen van thuiswedstrijden, clubartikelen ook van de webwinkel.</p>
      <div class="table-wrap"><table class="compact">
        <thead><tr><th>Cijfer</th>${shown.map((st) => column(s, st, st.season === s.season)).join('')}</tr></thead>
        <tbody>
          <tr><td><strong>Tickets verkocht</strong></td>${cell((st) => n(st.tickets))}</tr>
          <tr><td>Thuiswedstrijden</td>${cell((st) => n(st.matchesHome))}</tr>
          <tr><td>Gemiddeld publiek</td>${cell((st) => (st.matchesHome ? n(st.attendanceHome / st.matchesHome) : '–'))}</tr>
          <tr><td>Ticketprijs op het einde</td>${cell((st) => (st.ticketPrice ? `€${st.ticketPrice}` : `€${s.ticketPrice}`))}</tr>
          <tr class="section"><td colspan="${shown.length + 1}"><strong>Kantine (consumpties)</strong></td></tr>
          ${CANTEEN_ITEMS.map((d) => `<tr><td>${esc(d.label)}</td>${cell((st) => n(st.canteen[d.id]))}</tr>`).join('')}
          <tr class="total"><td>Samen aan de toog</td>${cell((st) => n(totalOf(st.canteen)))}</tr>
          <tr class="section"><td colspan="${shown.length + 1}"><strong>Concessies (porties)</strong></td></tr>
          ${CONCESSIONS.map((d) => `<tr><td>${esc(d.label)}</td>${cell((st) => n(st.concessions[d.id]))}</tr>`).join('')}
          <tr class="section"><td colspan="${shown.length + 1}"><strong>Clubwinkel (artikelen)</strong></td></tr>
          ${MERCH_ITEMS.map((d) => `<tr><td>${esc(d.label)}</td>${cell((st) => n(st.merch[d.id]))}</tr>`).join('')}
          <tr class="total"><td>Samen in de winkel</td>${cell((st) => n(totalOf(st.merch)))}</tr>
          <tr class="section"><td colspan="${shown.length + 1}"><strong>Opbrengst per bron (dit en vorig seizoen)</strong></td></tr>
          ${(['tickets', 'kantine', 'horeca concessies', 'clubartikelen', 'inkoop winkel', 'werking winkel', 'sponsors', 'lidgelden', 'evenementen', 'premies'] as const)
            .map(
              (cat) =>
                `<tr><td>${cat}</td>${shown
                  .map((st) => {
                    const totals = st.season === s.season ? s.seasonTotals : st.season === s.season - 1 ? s.lastSeasonTotals : undefined;
                    return `<td class="num">${totals ? euro(totals[cat] ?? 0) : '–'}</td>`;
                  })
                  .join('')}</tr>`,
            )
            .join('')}
          <tr class="section"><td colspan="${shown.length + 1}"><strong>Club</strong></td></tr>
          <tr><td>Jeugdleden op het einde van het seizoen</td>${cell((st) => n(st.youthMembers || (st.season === s.season ? s.community.youthMembers : 0)))}</tr>
          <tr><td>Vrijwilligers op het einde van het seizoen</td>${cell((st) => n(st.volunteers || (st.season === s.season ? s.community.volunteers : 0)))}</tr>
        </tbody>
      </table></div>
    </section>
    <section class="card span2">
      <h3>Inkomsten per categorie</h3>
      <p class="muted small">Dit seizoen tot nu, vergeleken met het vorige seizoen.</p>
      <div class="table-wrap"><table class="compact">
        <thead><tr><th>Categorie</th><th class="num">Dit seizoen</th><th class="num">Vorig seizoen</th></tr></thead>
        <tbody>${Object.entries(s.seasonTotals)
          .filter(([, v]) => (v ?? 0) > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k, v]) => `<tr><td>${k}</td><td class="num">${euro(v ?? 0)}</td><td class="num">${euro(s.lastSeasonTotals[k as keyof typeof s.lastSeasonTotals] ?? 0)}</td></tr>`)
          .join('')}</tbody>
      </table></div>
    </section>
  </div>`;
}
