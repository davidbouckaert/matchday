import type { GameState, LedgerCategory, LedgerEntry, WeekRecord } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { creditLimit, emergencyOffer, interestRate, loanOffers, totalDebt } from '../../engine/loans';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import { AWAY_SHARE, expectedAttendance } from '../../engine/finance';
import { spendPerHeadCanteen } from '../../engine/canteen';
import { esc, euro, signedEuro } from '../format';
import { forecast, topLines } from '../../engine/forecast';
import { hint } from '../tooltip';

function groupByCategory(entries: LedgerEntry[]): [LedgerCategory, number][] {
  const map = new Map<LedgerCategory, number>();
  for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function totalsTable(totals: Partial<Record<LedgerCategory, number>>): string {
  const rows = Object.entries(totals).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (!rows.length) return '<p class="muted">Nog geen boekingen.</p>';
  const sum = rows.reduce((s, [k, v]) => s + (k === 'leningen' || k === 'investeerder' ? 0 : v ?? 0), 0);
  return `<table class="compact"><tbody>
    ${rows.map(([k, v]) => `<tr><td>${k}</td><td class="num">${signedEuro(v ?? 0)}</td></tr>`).join('')}
    <tr class="total"><td>Operationeel resultaat</td><td class="num">${signedEuro(sum)}</td></tr>
  </tbody></table>`;
}

/** Niet-operationeel: financiering, investeringen en spelershandel. */
const NON_OPERATIONAL: LedgerCategory[] = ['leningen', 'investeerder', 'aflossingen', 'transfers', 'infrastructuur'];

function weekChart(records: WeekRecord[]): string {
  if (!records.length) return '<p class="muted">Nog geen weken gespeeld.</p>';
  const data = records.map((r) => {
    let inc = 0;
    let out = 0;
    for (const [k, v] of Object.entries(r.totals)) {
      if (NON_OPERATIONAL.includes(k as LedgerCategory)) continue;
      if ((v ?? 0) > 0) inc += v!;
      else out += v!;
    }
    return { label: `W${r.week}`, inc, out };
  });
  const max = Math.max(1, ...data.map((d) => Math.max(d.inc, -d.out)));
  const W = 640;
  const H = 180;
  const mid = H / 2;
  const bw = W / data.length;
  const bars = data
    .map((d, i) => {
      const hi = (d.inc / max) * (mid - 14);
      const ho = (-d.out / max) * (mid - 14);
      const net = d.inc + d.out;
      return `<g><title>${d.label}: inkomsten €${Math.round(d.inc).toLocaleString('nl-BE')}, uitgaven €${Math.round(-d.out).toLocaleString('nl-BE')}, netto €${Math.round(net).toLocaleString('nl-BE')}</title>
        <rect x="${i * bw + bw * 0.15}" y="${mid - hi}" width="${bw * 0.7}" height="${hi}" class="bar-in"/>
        <rect x="${i * bw + bw * 0.15}" y="${mid}" width="${bw * 0.7}" height="${ho}" class="bar-out"/>
        <circle cx="${i * bw + bw / 2}" cy="${mid - (net / max) * (mid - 14)}" r="3" class="dot-net"/>
        ${data.length <= 16 || i % 2 === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 1}" class="axis">${d.label}</text>` : ''}</g>`;
    })
    .join('');
  return `<svg class="weekchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Operationele inkomsten en uitgaven per week">
    <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="zero"/>${bars}</svg>
    <p class="legend small"><span class="sw in"></span> inkomsten <span class="sw out"></span> uitgaven <span class="sw net"></span> netto</p>`;
}

function weekTable(records: WeekRecord[]): string {
  const recent = records.slice(-12);
  if (!recent.length) return '';
  const cats = new Set<LedgerCategory>();
  for (const r of recent) for (const k of Object.keys(r.totals) as LedgerCategory[]) if (!NON_OPERATIONAL.includes(k)) cats.add(k);
  const sorted = [...cats].sort((a, b) => {
    const sa = recent.reduce((s, r) => s + (r.totals[a] ?? 0), 0);
    const sb = recent.reduce((s, r) => s + (r.totals[b] ?? 0), 0);
    return sb - sa;
  });
  const cell = (v: number) => (v ? `<td class="num ${v < 0 ? 'neg' : 'pos'}">${Math.round(v).toLocaleString('nl-BE')}</td>` : '<td class="num muted">·</td>');
  const net = (r: WeekRecord) => sorted.reduce((s, k) => s + (r.totals[k] ?? 0), 0);
  const other = (r: WeekRecord) => NON_OPERATIONAL.reduce((s, k) => s + (r.totals[k] ?? 0), 0);
  return `<div class="table-wrap"><table class="compact weektable">
    <thead><tr><th>Categorie (€)</th>${recent.map((r) => `<th class="num">W${r.week}</th>`).join('')}<th class="num">Totaal</th></tr></thead>
    <tbody>
      ${sorted.map((k) => `<tr><td>${k}</td>${recent.map((r) => cell(r.totals[k] ?? 0)).join('')}${cell(recent.reduce((s, r) => s + (r.totals[k] ?? 0), 0))}</tr>`).join('')}
      <tr class="total"><td>Operationeel resultaat</td>${recent.map((r) => cell(net(r))).join('')}${cell(recent.reduce((s, r) => s + net(r), 0))}</tr>
      <tr><td class="muted">Niet-operationeel (leningen, transfers, investeringen)</td>${recent.map((r) => cell(other(r))).join('')}${cell(recent.reduce((s, r) => s + other(r), 0))}</tr>
    </tbody></table></div>`;
}


/**
 * Wat er de komende weken staat aan te komen. Alleen wat nu al vastligt of goed te ramen is:
 * lonen, onderhoud, sponsorcontracten, aflossingen, de vaste momenten in het jaar en per
 * wedstrijd een schatting van de kassa en de kantine.
 */
function forecastCard(s: GameState): string {
  const f = forecast(s);
  if (!f.weeks.length) {
    return `<section class="card">
      <h2>Wat komt eraan</h2>
      <p class="muted">Het seizoen loopt op zijn einde; vanaf het nieuwe seizoen verandert er te veel om vooruit te rekenen.</p>
    </section>`;
  }
  const worst = f.lowest;
  return `<section class="card forecast">
    <h2>Wat komt eraan ${hint('Een vooruitblik van maximaal acht weken op basis van wat nu vastligt: lonen, onderhoud, sponsorcontracten, aflossingen en de vaste momenten in het jaar. Wedstrijdinkomsten zijn een raming bij gewoon weer — die staan met een ± erbij.')}</h2>
    <p class="muted small">Over ${f.weeks.length} ${f.weeks.length === 1 ? 'week' : 'weken'}: <strong class="${f.net < 0 ? 'neg' : 'pos'}">${signedEuro(f.net)}</strong>.
      Laagste punt: ${euro(worst.balance)} in week ${worst.week}.</p>
    ${
      f.trouble
        ? `<p class="warn"><strong>Let op:</strong> met wat er nu vastligt duik je in week ${f.trouble.week} onder nul. Zoek inkomsten of schuif een uitgave op.</p>`
        : ''
    }
    <div class="table-wrap"><table class="compact forecast-table">
      <thead><tr>
        <th>Week</th><th></th>
        <th class="num">In</th><th class="num">Uit</th><th class="num">Saldo week</th><th class="num">Kas erna</th>
      </tr></thead>
      <tbody>${f.weeks
        .map(
          (w) => `<tr class="${w.balance < 0 ? 'danger' : ''}">
            <td>W${w.week}</td>
            <td>${w.match ? `<span class="venue ${w.match === 'thuis' ? 'home' : 'away'}">${w.match === 'thuis' ? '🏠' : '🚌'}</span> ${esc(w.opponent)}` : '<span class="muted small">vrij</span>'}</td>
            <td class="num pos">${w.income ? euro(w.income) : '–'}</td>
            <td class="num neg">${w.costs ? euro(-w.costs) : '–'}</td>
            <td class="num ${w.net < 0 ? 'neg' : 'pos'}">${signedEuro(w.net)}</td>
            <td class="num"><strong class="${w.balance < 0 ? 'neg' : ''}">${euro(w.balance)}</strong></td>
          </tr>
          <tr class="forecast-detail"><td></td><td colspan="5" class="small muted">${topLines(w, 5)
            .map((l) => `<span class="fc-line ${l.amount < 0 ? 'neg' : 'pos'}">${esc(l.label)}${l.estimate ? ' ±' : ''} ${signedEuro(l.amount)}</span>`)
            .join(' · ')}</td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
  </section>`;
}

export function financeScreen(s: GameState): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const lastWeek = groupByCategory(s.lastWeek);
  const thisWeek = s.thisWeek;
  const attendance = expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });
  const ticketer = delegate(s, 'ticketing');
  const offers = loanOffers(s);
  if (s.emergencyLoanOffered) offers.unshift(emergencyOffer(s));

  return `${forecastCard(s)}
  <section class="card">
    <h2>Operationeel per week</h2>
    <p class="muted small">Inkomsten en uitgaven uit de werking van de club, zonder leningen, investeringen, infrastructuur en transfers. Beweeg over een staaf voor de cijfers. Tabel: laatste 12 weken.</p>
    ${weekChart(s.weekHistory.slice(-26))}
    ${weekTable(s.weekHistory)}
  </section>
  <div class="grid">
    <section class="card">
      <h2>Ticketprijs</h2>
      ${
        ticketer
          ? `<p class="attention-inline small">${esc(ticketer.name)} bepaalt de ticketprijs: nu €${s.ticketPrice}.</p>`
          : `<div class="inline-form">
        <label>Prijs (€)<input id="ticket-price" type="number" min="0" max="100" step="1" value="${s.ticketPrice}" data-change="ticket-price"/></label>
        <span class="muted small">wordt meteen toegepast</span>
      </div>`
      }
      <p class="muted small">Normaal in ${division.name}: €${division.refTicketPrice}. Verwachte opkomst bij bewolkt weer: ~${attendance} (tribune: ${s.infrastructure.capacity}).
      Van elke ticketeuro gaat ${Math.round(AWAY_SHARE * 100)}% naar de bezoekende club en de bond; dat staat apart bij wedstrijdkosten.
      Kantinewinst per toeschouwer: ~€${spendPerHeadCanteen(s, 400).toFixed(2)} (prijzen zet je bij Club › Horeca). Een hoge prijs levert per ticket meer op, maar schrikt supporters af en drukt de sfeer.</p>
    </section>

    <section class="card">
      <h2>Vorige week</h2>
      ${lastWeek.length ? `<table class="compact"><tbody>${lastWeek.map(([k, v]) => `<tr><td>${k}</td><td class="num">${signedEuro(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nog niet gespeeld.</p>'}
      ${s.pending.some((p) => p.amount) ? `<h3>Verwacht</h3><ul class="small">${s.pending.filter((p) => p.amount).map((p) => `<li>${esc(p.label)}: ${signedEuro(p.amount)} over ${weeks(p.weeksLeft)}</li>`).join('')}</ul>` : ''}
      ${thisWeek.length ? `<h3>Deze week al geboekt</h3><ul class="small">${thisWeek.map((e) => `<li>${esc(e.label)}: ${signedEuro(e.amount)}</li>`).join('')}</ul>` : ''}
    </section>

    <section class="card">
      <h2>Dit seizoen</h2>
      ${totalsTable(s.seasonTotals)}
    </section>

    <section class="card">
      <h2>Vorig seizoen</h2>
      ${totalsTable(s.lastSeasonTotals)}
    </section>

    <section class="card span2">
      <h2>Leningen</h2>
      <p class="muted small">Openstaande schuld: <strong>${euro(totalDebt(s))}</strong> · Bank wil nog lenen: <strong>${euro(creditLimit(s))}</strong> · Basisrente: ${(interestRate(s) * 100).toFixed(1)}%</p>
      ${
        s.loans.length
          ? `<div class="table-wrap"><table class="compact"><thead><tr><th>Lening</th><th class="num">Open</th><th class="num">Rente</th><th class="num">Per week</th><th class="num">Weken</th><th></th></tr></thead><tbody>
          ${s.loans
            .map(
              (l) => `<tr><td>${esc(l.label)}</td><td class="num">${euro(l.remaining)}</td><td class="num">${(l.annualRate * 100).toFixed(1)}%</td><td class="num">${euro(l.weeklyPayment)}</td><td class="num">${l.weeksLeft}</td>
              <td><button class="sm" data-action="repay" data-id="${l.id}">Aflossen</button></td></tr>`,
            )
            .join('')}</tbody></table></div>`
          : '<p class="muted">Geen lopende leningen.</p>'
      }
      <h3>Aanbod van de bank</h3>
      <div class="choice-grid three">
        ${offers
          .map(
            (o) => `<div class="choice static ${o.key === 'nood' ? 'warn' : ''}"><strong>${esc(o.label)}</strong><span class="big">${euro(o.principal)}</span>
            <span>${(o.annualRate * 100).toFixed(1)}% · ${euro(o.weeklyPayment)}/week · ${o.weeks} weken</span>
            <button class="sm primary" data-action="loan" data-id="${o.key}">Lenen</button></div>`,
          )
          .join('') || '<p class="muted">De bank leent je op dit moment niets meer.</p>'}
      </div>
    </section>
  </div>`;
}
