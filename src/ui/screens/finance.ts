import type { GameState, LedgerCategory, LedgerEntry, WeekRecord } from '../../engine/types';
import { subsidieBedrag, subsidieKans } from '../../engine/finance';
import { creditLimit, emergencyOffer, interestRate, loanOffers, totalDebt } from '../../engine/loans';
import { weeks } from '../../engine/util';
import { esc, euro, signedEuro } from '../format';
import { forecast, topLines } from '../../engine/forecast';
import { biggestFactors, factorEffect, sortedOrigins } from '../../engine/origins';
import * as inv from '../../engine/investors';
import { INVESTORS } from '../../engine/data/setup';
import { hint } from '../tooltip';
import { taskPicker } from '../taskpicker';

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
    return { label: `week ${r.week}`, inc, out };
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
    <thead><tr><th>Categorie (€)</th>${recent.map((r) => `<th class="num">week ${r.week}</th>`).join('')}<th class="num">Totaal</th></tr></thead>
    <tbody>
      ${sorted.map((k) => `<tr><td>${k}</td>${recent.map((r) => cell(r.totals[k] ?? 0)).join('')}${cell(recent.reduce((s, r) => s + (r.totals[k] ?? 0), 0))}</tr>`).join('')}
      <tr class="total"><td>Operationeel resultaat</td>${recent.map((r) => cell(net(r))).join('')}${cell(recent.reduce((s, r) => s + net(r), 0))}</tr>
      <tr><td class="muted" data-tip="Geld dat niet uit de gewone werking komt: wat je leent of aflost, wat een transfer opbrengt of kost, en wat je in je accommodatie steekt.">Buiten de gewone werking</td>${recent.map((r) => cell(other(r))).join('')}${cell(recent.reduce((s, r) => s + other(r), 0))}</tr>
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
    <h2>Wat komt eraan ${hint('Een vooruitblik van maximaal acht weken op basis van wat nu vastligt: lonen, onderhoud, sponsorcontracten, aflossingen en de vaste momenten in het jaar. Wat een wedstrijd opbrengt is een schatting bij gewoon weer; daar staat "(schatting)" bij.')}</h2>
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
        <th class="num">In</th><th class="num">Uit</th><th class="num" data-tip="Wat er die week overblijft of bijkomt">Over die week</th><th class="num" data-tip="Wat er daarna op de rekening staat">Op de rekening</th>
      </tr></thead>
      <tbody>${f.weeks
        .map(
          (w) => `<tr class="${w.balance < 0 ? 'danger' : ''}">
            <td>week ${w.week}</td>
            <td>${w.match ? `<span class="venue ${w.match === 'thuis' ? 'home' : 'away'}">${w.match === 'thuis' ? '🏠' : '🚌'}</span> ${esc(w.opponent)}` : '<span class="muted small">vrij</span>'}</td>
            <td class="num pos">${w.income ? euro(w.income) : '–'}</td>
            <td class="num neg">${w.costs ? euro(-w.costs) : '–'}</td>
            <td class="num ${w.net < 0 ? 'neg' : 'pos'}">${signedEuro(w.net)}</td>
            <td class="num"><strong class="${w.balance < 0 ? 'neg' : ''}">${euro(w.balance)}</strong></td>
          </tr>
          <tr class="forecast-detail"><td></td><td colspan="5" class="small muted">${topLines(w, 5)
            .map((l) => `<span class="fc-line ${l.amount < 0 ? 'neg' : 'pos'}">${esc(l.label)}${l.estimate ? ' (schatting)' : ''} ${signedEuro(l.amount)}</span>`)
            .join(' · ')}</td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
  </section>`;
}


/**
 * Waar de grootste bedragen van de laatste week vandaan kwamen. Elke regel toont wat een
 * factor je die week opleverde of kostte: het verschil met wat het geweest zou zijn
 * zonder die ene factor.
 */
function originsCard(s: GameState): string {
  const origins = sortedOrigins(s, 5);
  if (!origins.length) {
    return `<section class="card">
      <h2>Waar kwam het vandaan</h2>
      <p class="muted">Speel een week, dan staat hier per post wat het weer, de opkomst, je prijzen en je vrijwilligers precies uithaalden.</p>
    </section>`;
  }
  return `<section class="card origins">
    <h2>Waar kwam het vandaan ${hint('Per post van vorige week: wat er meespeelde, en hoeveel het opleverde of kostte.')}</h2>
    <p class="muted small">Staat er +€400 bij "Sfeer", dan betekent dat: zonder die goede sfeer had je €400 minder gehad. Het zijn precies dezelfde getallen waarmee het spel rekent.</p>
    <p class="muted small">De laatst gespeelde week. Dit zijn dezelfde factoren als op de tab Invloeden, maar nu met wat ze déze week waard waren.</p>
    <div class="origin-list">${origins
      .map((o) => {
        const factors = biggestFactors(o, 6);
        return `<div class="origin">
          <div class="origin-head">
            <strong>${esc(o.label)}</strong>
            <span class="num ${o.amount < 0 ? 'neg' : 'pos'}">${signedEuro(o.amount)}</span>
          </div>
          ${
            factors.length
              ? `<ul class="origin-factors">${factors
                  .map((f) => {
                    const effect = factorEffect(o.amount, f);
                    return `<li>
                      <span class="of-label">${esc(f.label)}</span>
                      <span class="of-source muted small">${esc(f.source)}</span>
                      <span class="of-mult muted small">×${f.value.toFixed(2)}</span>
                      <span class="of-effect num ${effect < 0 ? 'neg' : 'pos'}">${signedEuro(effect)}</span>
                    </li>`;
                  })
                  .join('')}</ul>`
              : '<p class="muted small">Geen factoren die deze week iets uithaalden.</p>'
          }
          <p class="muted small">Zonder al die factoren zou hier ongeveer ${euro(o.base)} gestaan hebben.</p>
        </div>`;
      })
      .join('')}</div>
  </section>`;
}


/**
 * Wat jouw investeerder voor je club betekent, en — bij de coöperatie — de ledenronde.
 * Elke investeerder speelt een ander spel, dus dit staat er altijd bij.
 */
function investorCard(s: GameState): string {
  const def = INVESTORS.find((i) => i.id === s.investor);
  const check = inv.canHoldRound(s);
  const expected = inv.roundForecast(s);
  const rounds = s.investorState?.coopRounds ?? 0;
  const left = inv.seasonsLeft(s);

  return `<section class="card investor">
    <h2>Je investeerder ${hint('Elke investeerder speelt een ander spel: het fonds geeft veel geld maar houdt de druk erop, de aannemer maakt bouwen goedkoper en sneller, en de coöperatie geeft weinig maar groeit met je club mee.')}</h2>
    <p><strong>${esc(def?.name ?? '')}</strong></p>
    <p class="small">${esc(inv.investorSummary(s))}</p>
    ${
      s.investor === 'fonds' && s.investorActive && Number.isFinite(left)
        ? `<p class="small ${left <= 1 ? 'warn' : 'muted'}">${
            left <= 0
              ? 'Het geduld van het fonds is op.'
              : left === 1
                ? '<strong>Laatste kans:</strong> promoveer je dit seizoen niet, dan trekt het fonds €300.000 terug en stapt het op.'
                : `Nog ${left} seizoenen om te promoveren voor het fonds zijn geld terugtrekt.`
          }</p>`
        : ''
    }
    ${
      s.investor === 'cooperatie' && s.investorActive
        ? check.ok
          ? `<div class="round-box">
              <p class="small">De leden willen bijdragen. Je kunt nu een ronde houden; er wordt zo'n <strong>${euro(expected)}</strong> verwacht${rounds ? ` (ronde ${rounds + 1}, elke volgende brengt wat minder op)` : ''}.</p>
              <p class="muted small">Je vraagt iets van dezelfde mensen die zondag aan de kassa staan: de sfeer zakt er een paar punten van. Hoe beter je club draait, hoe meer ze storten.</p>
              <p class="actions left"><button class="primary" data-action="member-round">Ledenronde houden</button></p>
            </div>`
          : `<p class="muted small">${esc(check.reason)}${rounds ? ` Tot nu toe hielden de leden ${rounds} ${rounds === 1 ? 'ronde' : 'rondes'}.` : ''}</p>`
        : ''
    }
  </section>`;
}

export function financeScreen(s: GameState): string {
  const lastWeek = groupByCategory(s.lastWeek);
  const thisWeek = s.thisWeek;
  const offers = loanOffers(s);
  if (s.emergencyLoanOffered) offers.unshift(emergencyOffer(s));

  // Vaste kolommen in plaats van een raster dat zichzelf vult.
  //
  // Dit scherm stond in een `.grid` met auto-fill: die maakte op een breed scherm vier
  // kolommen van 336 pixels, en omdat de kaarten hier heel verschillend hoog zijn —
  // "Ticketprijs" is een alinea, "Vorig seizoen" een tabel van twintig regels — bleef de
  // halve pagina wit. Nu ligt de indeling vast: wat je instelt naast wat je terugleest,
  // de twee seizoensoverzichten naast elkaar omdat je ze vergelijkt, en alles wat een
  // brede tabel is over de volle breedte.
  return `${taskPicker(s, ['ticketing'])}
  ${investorCard(s)}
  ${subsidieCard(s)}
  ${forecastCard(s)}
  ${originsCard(s)}
  <section class="card">
    <h2>Operationeel per week</h2>
    <p class="muted small">Inkomsten en uitgaven uit de werking van de club, zonder leningen, investeringen, infrastructuur en transfers. Beweeg over een staaf voor de cijfers. Tabel: laatste 12 weken.</p>
    ${weekChart(s.weekHistory.slice(-26))}
    ${weekTable(s.weekHistory)}
  </section>
  <div class="cols-2">
    <div class="col">
    <section class="card">
      <h2>Wat je zelf kunt zetten</h2>
      <p class="muted small">Je ticketprijs, je abonnementen en het lidgeld van de jeugd staan bij elkaar op een eigen scherm.</p>
      <div class="price-facts">
        <span class="pc-fact"><span class="cap">Ticket</span><strong>€${s.ticketPrice}</strong></span>
        <span class="pc-fact"><span class="cap">Lidgeld jeugd</span><strong>€${s.youthFee}</strong><span class="unit">/seizoen</span></span>
        <span class="pc-fact"><span class="cap">Abonnementen</span><strong>${s.seasonTickets && s.seasonTickets.season === s.season ? `${s.seasonTickets.sold} verkocht` : 'nog niet verkocht'}</strong></span>
      </div>
      <button data-action="nav" data-id="prijzen">Naar Tickets en lidgeld</button>
    </section>

    </div>
    <div class="col">
    <section class="card">
      <h2>Vorige week</h2>
      ${lastWeek.length ? `<table class="compact"><tbody>${lastWeek.map(([k, v]) => `<tr><td>${k}</td><td class="num">${signedEuro(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nog niet gespeeld.</p>'}
      ${s.pending.some((p) => p.amount) ? `<h3>Verwacht</h3><ul class="small">${s.pending.filter((p) => p.amount).map((p) => `<li>${esc(p.label)}: ${signedEuro(p.amount)} over ${weeks(p.weeksLeft)}</li>`).join('')}</ul>` : ''}
      ${thisWeek.length ? `<h3>Deze week al geboekt</h3><ul class="small">${thisWeek.map((e) => `<li>${esc(e.label)}: ${signedEuro(e.amount)}</li>`).join('')}</ul>` : ''}
    </section>

    </div>
  </div>
  <div class="cols-2">
    <div class="col">
      <section class="card">
        <h2>Dit seizoen</h2>
        ${totalsTable(s.seasonTotals)}
      </section>
    </div>
    <div class="col">
      <section class="card">
        <h2>Vorig seizoen</h2>
        ${totalsTable(s.lastSeasonTotals)}
      </section>
    </div>
  </div>
    <section class="card">
      <h2>Leningen</h2>
      <p class="muted small">Je moet nog <strong>${euro(totalDebt(s))}</strong> terugbetalen. De bank wil je nu nog <strong>${euro(creditLimit(s))}</strong> lenen, aan ${(interestRate(s) * 100).toFixed(1)}% rente per jaar.</p>
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
    </section>`;
}

/**
 * De gemeentesubsidie: vroeger kwam ze in week 24 vanzelf binnen, nu is het een dossier.
 * Eén aanvraag per seizoen, antwoord na twee weken, en de kans hangt vooral aan je
 * jeugdwerking — de kaart zegt eerlijk waar je dossier zwak staat.
 */
function subsidieCard(s: GameState): string {
  const { kans, zwakstePlek } = subsidieKans(s);
  const bedrag = subsidieBedrag(s);
  const loopt = s.requests.some((r) => r.kind === 'subsidie');
  const gedaan = s.subsidieSeizoen === s.season;
  return `<section class="card" data-tour-doel="subsidie">
    <h2>Gemeentesubsidie ${hint('De jaarlijkse werkingssubsidie van de gemeente. Eén aanvraag per seizoen; de kans hangt vooral aan je jeugdwerking, daarnaast aan je reputatie en je licentiedossier.')}</h2>
    <p class="muted small">Bij toekenning: <strong>${euro(bedrag)}</strong> · kans nu ongeveer <strong>${Math.round(kans * 100)}%</strong> · zwakste plek in je dossier: ${zwakstePlek}.</p>
    ${
      loopt
        ? '<p class="attention-inline small">📨 Je dossier ligt bij de gemeente — antwoord binnen twee weken.</p>'
        : gedaan
          ? '<p class="muted small">Dit seizoen al aangevraagd. Volgend seizoen mag je opnieuw indienen.</p>'
          : `<button class="primary sm" data-action="subsidie-aanvragen">Dossier indienen</button>`
    }
  </section>`;
}