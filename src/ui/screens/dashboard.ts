import { bureauStatus, signalBadge, type Todo } from '../signals';
export { bureauStatus, todos } from '../signals';
import { subsidieRows } from '../subsidiezaak';
// Het dashboard. Het enige scherm dat je élke week opent, dus het enige scherm dat
// gebouwd is vanuit één vraag: wat moet ik deze week weten en doen?
//
// Links de operationele kolom — geld, waar het vandaan kwam, wat eraan komt, wie je
// tegenstander is. Rechts de zijkolom: hoe je ervoor staat bij de drie groepen die je
// club dragen (publiek, sponsors, bank), wat er nu jouw handtekening vraagt, en onderaan
// het nieuws — het vertelt wat er gebeurd is, niet wat je moet doen, dus het staat na de
// cijfers. Het stond ooit los, over de volle breedte onder de hele pagina: dat was zoveel
// witruimte voor één smalle lijst dat je moest scrollen om het nog te zien.
//
// Wat je niet elke week nodig hebt — je langetermijndoel, je eigenaarsniveau, de
// seizoensdoelen van het bestuur — staat bij Club › Doelen. Het hoort bij je carrière,
// niet bij je week.

import type { GameState, LedgerEntry } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { MATCH_WEEKS } from '../../engine/calendar';
import { OPPONENT_STAFF_BONUS, OWN_TEAM_ID, nextDerby, ownPosition, rivalTeam, teamName } from '../../engine/league';
import { clubRatings } from '../../engine/ratings';
import { teamStrength } from '../../engine/players';
import { attendanceFactors } from '../../engine/factors';
import { starLabel, starPlayers, starPopularityFactor, starSponsorFactor } from '../../engine/stars';
import { expectedAttendance } from '../../engine/finance';
import { forecast } from '../../engine/forecast';
import { esc, euro, resultIcon, signedEuro, sparkline, whenLabel } from '../format';
import { hint, tipAttr } from '../tooltip';
import { TOUR_CHAPTERS, tourChapter, tourStepDone } from '../../engine/tour';
import { newsIcon } from '../newsIcon';

export function weekSummary(entries: LedgerEntry[]): { income: number; costs: number } {
  let income = 0;
  let costs = 0;
  for (const e of entries) {
    if (e.amount > 0) income += e.amount;
    else costs += e.amount;
  }
  return { income, costs };
}

/* ------------------------------------------------------------------- het geld */

/**
 * De geldkaart. Drie cijfers naast elkaar — wat er in kas staat, wat deze week deed, en
 * wat de laagste raming in de beschikbare vooruitblik is — met daaronder de lijn van de voorbije weken. Dit is de
 * eerste kaart omdat het de eerste vraag van een eigenaar is.
 */
function moneyCard(s: GameState): string {
  const { income, costs } = weekSummary(s.lastWeek);
  const net = income + costs;
  const f = forecast(s);
  const troubled = f.trouble;

  return `<section class="card money wide">
    <h2>Geld ${hint('Je saldo nu, wat de voorbije week opleverde of kostte, en waar je uitkomt als je niets verandert. De prognose rekent de komende acht weken door: vaste kosten, contracten, aflossingen en een raming van de kassa per thuiswedstrijd.')}</h2>
    <div class="money-head">
      <div class="money-fig">
        <span class="cap">In kas</span>
        <span class="big-num lg ${s.cash < 0 ? 'neg' : ''}">${euro(s.cash)}</span>
        <span class="sub">${s.cash < 0 && s.weeksNegative ? `<span class="neg">${s.weeksNegative}/8 weken onder nul</span>` : '&nbsp;'}</span>
      </div>
      <div class="money-fig">
        <span class="cap">${s.season === 1 && s.week === 1 ? 'Bij de start' : 'Kasverandering vorige week'}</span>
        <span class="big-num ${net < 0 ? 'neg' : 'pos'}">${signedEuro(net)}</span>
        <span class="sub">in ${euro(income)} · uit ${euro(-costs)}</span>
      </div>
      <div class="money-fig">
        <span class="cap">Laagste raming</span>
        <span class="big-num ${f.lowest.balance < 0 ? 'neg' : ''}">${f.weeks.length ? euro(f.lowest.balance) : '—'}</span>
        <span class="sub">${f.weeks.length ? `in week ${f.lowest.week} · vooruitblik ${f.weeks.length} ${f.weeks.length === 1 ? 'week' : 'weken'}` : 'Geen vooruitblik beschikbaar voor deze periode.'}</span>
      </div>
    </div>
    ${
      troubled
        ? `<p class="attention-inline small"><strong>Je duikt onder nul in week ${troubled.week}.</strong> Zo ver vooruit is er nog tijd om iets te doen: prijzen, een sponsor, een verkoop of een lening.
           <button class="link-btn small" data-action="nav" data-id="financien">Naar Financiën →</button></p>`
        : ''
    }
    ${f.weeks.some((w) => w.lines.some((l) => l.category === 'subsidies')) ? '<p class="small muted">De raming bevat een onzekere subsidie in week 24. Bekijk de toelichting bij Financiën.</p>' : ''}
    <button class="link-btn small" data-action="nav" data-id="financien">Bekijk financiën →</button>
    <details><summary class="small">Verloop van je saldo</summary><div class="money-chart">${sparkline(s.cashHistory)}</div>
    <p class="tiny muted">Saldo van de laatste ${s.cashHistory.length} weken.</p></details>
  </section>`;
}

/**
 * Waar het geld deze week vandaan kwam en heen ging. Geen tabel: een lijst met een
 * staafje dat de verhouding toont, zodat je in één blik ziet wat groot is.
 */
function postsCard(s: GameState): string {
  const entries = s.lastWeek.filter((e) => e.category !== 'leningen' && e.category !== 'investeerder');
  if (!entries.length) return '';

  const byLabel = new Map<string, number>();
  for (const e of entries) byLabel.set(e.label, (byLabel.get(e.label) ?? 0) + e.amount);
  const rows = [...byLabel.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
  const biggest = Math.max(...rows.map(([, v]) => Math.abs(v)), 1);

  return `<section class="card">
    <h2>Waar het geld heen ging ${hint('De grootste posten van vorige week, van groot naar klein. Bij Geld › Financiën staat per post waarom hij zo hoog of laag uitviel.')}</h2>
    <div class="posts">
      ${rows
        .map(
          ([label, amount]) => `<div class="post ${amount >= 0 ? 'in' : 'out'}">
            <span class="pname"><span>${esc(label)}</span></span>
            <span class="pval ${amount >= 0 ? 'pos' : 'neg'}">${signedEuro(amount)}</span>
            <span class="pbar" style="width:${Math.round((Math.abs(amount) / biggest) * 100)}%"></span>
          </div>`,
        )
        .join('')}
    </div>
    <p class="actions left"><button class="ghost sm" data-action="nav" data-id="financien">Alles en de herkomst →</button></p>
  </section>`;
}

/* -------------------------------------------------------------- de wedstrijd */

function matchCard(s: GameState): string {
  const next = s.league.fixtures
    .filter((f) => f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .sort((a, b) => a.week - b.week)[0];
  const rival = rivalTeam(s);
  const isDerby = !!next && !!rival && (next.homeId === rival.id || next.awayId === rival.id);
  const strength = teamStrength(s);
  const division = DIVISIONS[s.league.divisionLevel];
  const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const derbyWeek = nextDerby(s);
  const m = s.lastMatch;
  const home = next?.homeId === OWN_TEAM_ID;
  const gate = next && home ? expectedAttendance(s, { weather: 'bewolkt', derby: isDerby, positionFactor: 1 }) : null;

  const head = next
    ? `<div class="match-line">
        <span class="tag">${home ? '🏠 Thuis' : '🚌 Uit'}</span>
        <span class="vs">${esc(teamName(s, home ? next.awayId : next.homeId))}</span>
        ${isDerby ? '<span class="tag bad">🔥 DERBY</span>' : ''}
        <span class="muted small">week ${next.week}${next.week === s.week ? ' — deze week' : ''}</span>
      </div>`
    : `<p class="muted">${MATCH_WEEKS[0] > s.week ? `De competitie start in week ${MATCH_WEEKS[0]}.` : 'Geen wedstrijden meer dit seizoen.'}</p>`;

  return `<section class="card match-card">
    <h2>Volgende wedstrijd</h2>
    ${head}
    <div class="match-strength">
      <div class="money-fig">
        <span class="cap">Jouw ploeg</span><span class="big-num sm">${strength.total}</span>
        <span class="sub">aanval ${strength.attack} · verdediging ${strength.defense}</span>
      </div>
      <div class="money-fig">
        <span class="cap">Gemiddelde tegenstander</span><span class="big-num sm">${division.opponentStrength + OPPONENT_STAFF_BONUS}</span>
        <span class="sub">${esc(division.name)}</span>
      </div>
      ${
        played
          ? `<div class="money-fig"><span class="cap">Klassement</span><span class="big-num sm">${ownPosition(s.league)}e</span><span class="sub">van ${s.league.table.length}</span></div>`
          : ''
      }
      ${
        gate
          ? `<div class="money-fig"><span class="cap">Verwacht publiek</span><span class="big-num sm">${gate}</span><span class="sub">bij gewoon weer</span></div>`
          : ''
      }
    </div>
    ${
      rival && derbyWeek
        ? `<p class="tiny muted">Aartsrivaal ${esc(rival.name)} · volgende derby in week ${derbyWeek.week} (${derbyWeek.home ? 'thuis' : 'uit'}) · onderling ${s.derbyRecord.won}W ${s.derbyRecord.drawn}G ${s.derbyRecord.lost}V</p>`
        : ''
    }
    ${
      m && m.week === s.week - 1
        ? `<p class="small">Vorige week: ${resultIcon(m.goalsFor, m.goalsAgainst)} ${m.home ? '🏠' : '🚌'} ${esc(m.opponent)} <strong>${m.goalsFor}-${m.goalsAgainst}</strong>${
            m.forfeit ? ' · <span class="neg">forfait</span>' : m.home ? ` · ${m.attendance} toeschouwers · ${esc(m.weather)}` : ''
          }</p>`
        : ''
    }
  </section>`;
}

/* ------------------------------------------------- de drie groepen, met impact */

const band = (score: number) => (score >= 66 ? 'good' : score >= 40 ? 'mid' : 'bad');

/**
 * Publiek, sponsors en bank. Niet alleen het cijfer — een cijfer op zich zegt niets —
 * maar wat het concreet met je club doet, in euro's of in procenten waar dat kan.
 */
function meterCard(s: GameState): string {
  const ratings = clubRatings(s);
  const byKey = (k: string) => ratings.find((r) => r.key === k)!;

  // wat de sfeer met je kassa doet: dezelfde factor waarmee de engine rekent
  const moodFactor = attendanceFactors(s).find((f) => f.label === 'Sfeer')?.value ?? 1;
  const moodPct = Math.round((moodFactor - 1) * 100);

  // sponsors: hoe tevreden ze gemiddeld zijn, en wat er per week binnenkomt
  const deals = s.sponsors;
  const sponsorSat = deals.length ? Math.round(deals.reduce((t, d) => t + d.satisfaction, 0) / deals.length) : 0;
  const weekly = deals.reduce((t, d) => t + d.weekly, 0);
  const wobbly = deals.filter((d) => d.satisfaction < 45).length;

  const fin = byKey('financieel');
  const sport = byKey('sportief');

  const meter = (name: string, value: number, impact: string, tipText: string) => `<div class="meter ${band(value)}">
      <div class="top"><span class="mname">${esc(name)}</span><span class="mval">${value}</span></div>
      <div class="track"><span style="width:${Math.max(2, value)}%"></span></div>
      <div class="impact" ${tipAttr(tipText, name)}>${impact}</div>
    </div>`;

  return `<section class="card">
    <h2>Hoe je ervoor staat ${hint('Drie groepen dragen je club: het publiek dat komt kijken, de bedrijven die betalen, en de cijfers waar de bank naar kijkt. Onder elk cijfer staat wat het nu concreet doet.')}</h2>
    <div class="meters">
      ${meter(
        'Publiek',
        Math.round(s.community.fanMood),
        `<strong class="${moodPct >= 0 ? 'pos' : 'neg'}">${moodPct >= 0 ? '+' : ''}${moodPct}%</strong> aan de kassa en in de kantine`,
        `De sfeer werkt als een vermenigvuldiger op je toeschouwers: nu ×${moodFactor.toFixed(2)}. Winnen, een lage ticketprijs en evenementen tillen hem op; verliezen, prijsverhogingen en geldzorgen trekken hem neer.`,
      )}
      ${meter(
        'Sponsors',
        sponsorSat,
        `<strong>${euro(weekly)}</strong> per week${wobbly ? ` · <span class="neg">${wobbly} ontevreden</span>` : ''}`,
        `Het gemiddelde over je ${deals.length} lopende contracten. Een tevreden sponsor verlengt vanzelf en betaalt bij de verlenging meer; onder de 45 begint het te wankelen. Resultaten, publiek en zichtbaarheid bepalen dat cijfer.`,
      )}
      ${meter(
        'Financieel',
        fin.score,
        `${fin.parts.map((p) => `${esc(p.label)} ${p.score}`).join(' · ')}`,
        `Je clubscore op geld: ${fin.parts.map((p) => `${p.label} ${p.score}/100`).join(', ')}. Dit is waar sponsors, de bank en het bestuur naar kijken als ze beslissen of je club gezond is.`,
      )}
      ${meter(
        'Sportief',
        sport.score,
        `${sport.parts.map((p) => `${esc(p.label)} ${p.score}`).join(' · ')}`,
        `Je clubscore op het veld: ${sport.parts.map((p) => `${p.label} ${p.score}/100`).join(', ')}. Hij bepaalt mee hoeveel volk er komt, wat sponsors willen betalen en hoe makkelijk je spelers aantrekt.`,
      )}
    </div>
    ${starLine(s)}
    <p class="actions left"><button class="ghost sm" data-action="nav" data-id="invloeden">Wat beïnvloedt wat? →</button></p>
  </section>`;
}

/**
 * Je sterspeler, met wat hij opbrengt.
 *
 * Hij zit al verwerkt in je populariteit en in wat sponsors betalen, maar dan zie je alleen
 * het resultaat en niet waar het vandaan komt. Eén regel volstaat: wie het is en wat hij doet.
 */
function starLine(s: GameState): string {
  const sterren = starPlayers(s);
  if (!sterren.length) return '';
  const publiek = Math.round((starPopularityFactor(s) - 1) * 100);
  const sponsors = Math.round((starSponsorFactor(s) - 1) * 100);
  return `<p class="star-line" ${tipAttr(
    `${sterren.map((p) => `${p.name}: ${starLabel(s, p)}`).join('. ')}. Een speler die er zo bovenuit steekt trekt volk naar het veld — dat loopt door in je kantine en je clubwinkel — en maakt een plaats langs de lijn aantrekkelijker voor sponsors. Verkoop je hem, dan ben je dat kwijt.`,
    sterren.length === 1 ? 'Je sterspeler' : 'Je sterspelers',
  )}>⭐ <strong>${sterren.map((p) => esc(p.name)).join(', ')}</strong> ${sterren.length === 1 ? 'is je sterspeler' : 'zijn je sterspelers'}: <span class="pos">+${publiek}%</span> publiek en <span class="pos">+${sponsors}%</span> van je sponsors.</p>`;
}

/* ----------------------------------------------------- wat jou nu nodig heeft */

/**
 * De werklijst van de week. Dit is het eerste wat een eigenaar doet als hij gaat zitten:
 * kijken wat er op hem ligt te wachten. Daarom staat het bovenaan, over de volle breedte,
 * vóór de cijfers — die vertellen hoe het gáát, deze lijst vertelt wat je moet dóén.
 *
 * Het weekmoment zit erin als eerste regel in plaats van in een eigen kaart ernaast; het
 * is de belangrijkste taak van de week, niet een apart onderwerp.
 */
/**
 * De rondleiding, onderin de weekkaart: één hoofdstuk tegelijk, stappen van één thema
 * bij elkaar. Bewust kalm — geen amber, geen rood, telt niet mee in "wat op je wacht":
 * dit is hulp, geen huiswerk. De verbergknop opent de gewone bevestigingspopup.
 */
function tourBlock(s: GameState): string {
  const t = tourChapter(s);
  if (!t) return '';
  // de hoofdstukken die nog komen: zo zie je dat ook geld, clubzaken en bouwen aan bod
  // komen — anders lijkt de rondleiding "iets over de ploeg" en klik je hem te vroeg weg
  const verder = TOUR_CHAPTERS.slice(t.nr).map((c) => c.title);
  const openStappen = t.chapter.steps.some((_, i) => !tourStepDone(s, t.nr - 1, i));
  return `<div class="tour-block ${openStappen ? 'wacht' : ''}">
    <div class="tour-head">
      <span class="tour-titel">📚 Leer je club kennen</span>
      <span class="tour-hoofdstuk">hoofdstuk ${t.nr}/${t.total} · <strong>${esc(t.chapter.title)}</strong></span>
      <button class="link-btn tiny tour-hide" data-action="tour-hide"
        data-confirm="De rondleiding verbergen?"
        data-tip="Ingrijpend: de leerstappen verdwijnen definitief uit dit spel.">Ik ken het spel al</button>
    </div>
    <ul class="tour-steps">
      ${t.chapter.steps
        .map((st, stapIndex) => {
          const af = tourStepDone(s, t.nr - 1, stapIndex);
          return `<li class="${af ? 'done' : ''}">
            <span class="box">${af ? '✓' : ''}</span>
            <span class="what">${esc(st.text)}</span>
            ${af ? '' : `<button class="sm primary tour-ga" data-action="tour-go" data-id="${st.screen}:${st.wijs ?? ''}">${esc(st.where)} →</button>`}
          </li>`;
        })
        .join('')}
    </ul>
    ${verder.length ? `<p class="tour-verder small">Daarna: ${verder.map((v) => esc(v)).join(' → ')}</p>` : ''}
  </div>`;
}

/** De bestaande hoofdstukken zijn de begeleide start; geen tijd- of ervaringsscore erbij verzinnen. */
export function guidedTourCard(s: GameState): string {
  const t = tourChapter(s);
  if (!t) return '';
  const flags = t.chapter.steps.map((_, i) => tourStepDone(s, t.nr - 1, i));
  const next = flags.findIndex((done) => !done);
  const completed = flags.filter(Boolean).length;
  const step = t.chapter.steps[next];
  const parts = step?.text.split(/: | — /) ?? [];
  return `<section class="card slice guided-tour" aria-labelledby="guided-tour-heading">
    <div class="guided-context">Leer je club kennen · hoofdstuk ${t.nr} van ${t.total} · ${esc(t.chapter.title)}</div>
    <div class="guided-progress"><span>${completed} van ${flags.length} ${flags.length === 1 ? 'stap' : 'stappen'} afgerond</span><progress value="${completed}" max="${flags.length}" aria-label="Voortgang in dit hoofdstuk"></progress></div>
    <h2 id="guided-tour-heading" tabindex="-1">${step ? esc(parts[0]) : 'Dit hoofdstuk is klaar'}</h2>
    <p>${step ? esc(parts.slice(1).join(' — ').replace(/^./, (c) => c.toUpperCase()) || 'Zo leer je deze kant van je club kennen. Je hoeft nog niet alles zelf te regelen.') : 'Goed gedaan. Speel verder met Volgende week onderaan; daarna gaat de rondleiding verder.'}</p>
    ${completed && step ? '<p class="guided-done">✓ Je eerdere stappen zijn afgevinkt. Dit is je volgende stap.</p>' : ''}
    <div class="guided-actions">${step ? `<button class="primary" data-action="tour-go" data-id="${step.screen}:${step.wijs ?? ''}">Ga naar ${esc(step.where)}</button>` : ''}
      <details><summary>Meer uitleg en stappen</summary>${tourBlock(s)}</details>
    </div>
  </section>`;
}

/** De grote werklijst bovenaan het dashboard. */
function attentionBar(s: GameState): string {
  const status = bureauStatus(s);
  const w = s.weekChoice;
  const rows = (list: Todo[]) => list.map((t) => `<li class="${t.level}">
    <span class="what">${signalBadge(t)} <strong>${esc(t.text)}</strong>${t.detail ? `<span class="sub-line">${esc(t.detail)}</span>` : ''}</span>
    <button class="sm" data-action="nav" data-id="${t.screen}">${esc(t.where)} →</button></li>`).join('');
  const visibleActions = status.acties.filter((t, i) => t.level !== 'info' || i < 3);
  const moreActions = status.acties.filter((t) => !visibleActions.includes(t));
  return `${guidedTourCard(s)}<section class="card bureau-work slice">
    <div class="slice-heading"><h2>Te regelen</h2><span class="tag">${status.count} ${status.count === 1 ? 'zaak' : 'zaken'}</span></div>
    ${status.count ? `<ul class="worklist">${w && !w.answer ? `<li class="choice"><span class="what"><strong>${esc(w.title)}</strong><span class="sub-line">${esc(w.text)}</span></span><button class="primary sm" data-action="moment-open">Beslissen</button></li>` : ''}${rows(visibleActions)}</ul>${moreActions.length ? `<details><summary>Alle ${status.count} zaken</summary><ul class="worklist">${rows(moreActions)}</ul></details>` : ''}` : `<p class="quiet-state">${tourChapter(s) ? 'Geen clubzaken te regelen. Je volgende leerstap staat hierboven.' : 'Niets te regelen. Bekijk wat er loopt of speel verder.'}</p>`}
  </section>
  <div class="bureau-context">
    <section class="card slice"><h2>Lopende zaken</h2>
      ${subsidieRows(s, true)}
      ${status.wachten.length ? `<ul class="worklist">${rows(status.wachten.slice(0, 3))}</ul>${status.wachten.length > 3 ? `<details><summary>Alle lopende zaken</summary><ul class="worklist">${rows(status.wachten.slice(3))}</ul></details>` : ''}` : ''}
      ${!status.wachten.length && !s.requests.some((r) => r.kind === 'subsidie') ? '<p class="muted">Er ligt niets op antwoord te wachten.</p>' : ''}
    </section>
    <section class="card slice"><h2>Goed om te weten</h2>
      ${status.informatie.length ? `<ul class="worklist">${rows(status.informatie)}</ul>` : '<p class="muted">Geen bijzonderheden deze week.</p>'}
      ${!tourChapter(s) && s.tour && !s.tour.hidden ? '<details class="compact-tour"><summary>Leer je club kennen · naslag</summary><p>De begeleide rondleiding is afgelopen. De uitleg blijft beschikbaar als je iets wilt opzoeken.</p><button class="sm" data-action="nav" data-id="handleiding">Naar de handleiding</button></details>' : ''}
    </section>
  </div>
  ${subsidieRows(s, false) ? `<section class="card slice"><h2>Antwoord van de gemeente</h2>${subsidieRows(s, false)}</section>` : ''}`;
}

/** Wat je deze week al besliste; klein, onder de werklijst. */
function decidedCard(s: GameState): string {
  const w = s.weekChoice;
  if (!w || !w.answer) return '';
  return `<section class="card decided">
    <h2>Beslist deze week</h2>
    <p><strong>${esc(w.title)}</strong></p>
    <p class="small muted">${esc(w.outcome ?? '')}</p>
  </section>`;
}

/* ------------------------------------------------------------------- nieuws */

function newsCard(s: GameState): string {
  if (!s.news.length) return '';
  return `<section class="card">
    <h2>Nieuws</h2>
    <ul class="news-feed">
      ${s.news
        .slice(0, 12)
        .map((n) => {
          const icon = newsIcon(n.text);
          return `<li class="${n.tone}"><span class="when">${whenLabel(n.season, n.week, s.season)}</span><span class="what">${icon ? `<span class="n-icon">${icon}</span>` : ''}${esc(n.text)}</span></li>`;
        })
        .join('')}
    </ul>
  </section>`;
}

/* --------------------------------------------------------------------- scherm */

export function dashboardScreen(s: GameState): string {
  return `
  ${attentionBar(s)}
  <div class="dash">
    <div class="dash-main">
      ${moneyCard(s)}
      ${postsCard(s)}
      ${matchCard(s)}
    </div>
    <div class="dash-side">
      ${meterCard(s)}
      ${decidedCard(s)}
      ${newsCard(s)}
    </div>
  </div>`;
}
