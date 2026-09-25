// Weekrapport: verschijnt na elke gesimuleerde week, eerst met een korte animatie.

import type { GameState, LedgerCategory } from '../../engine/types';
import { SEASON_END_WEEK, formatDateLong, inWinterBreak, seasonLabel } from '../../engine/calendar';
import { OWN_TEAM_ID, ownPosition, teamName } from '../../engine/league';
import { PLAN_INFO } from '../../engine/strategy';
import { UPGRADES } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { KIND_LABEL } from '../../engine/sponsors';
import { weeks } from '../../engine/util';
import { currentStreak } from '../../engine/records';
import { esc, euro, resultIcon, venue } from '../format';
import { newsIcon } from '../newsIcon';
import { kbd } from '../keys';

export interface WeekRef {
  week: number;
  season: number;
}

/**
 * De klok van de wedstrijdanimatie, in seconden: de eerste helft loopt van start tot h1,
 * dan valt de klok stil voor de rust, de tweede helft loopt van h2 tot end, en bij fin
 * klinkt het affluiten. Eén plek voor deze getallen, want de regels op het scherm (hun
 * animatievertraging) en de lopende klok (main.ts) moeten exact dezelfde tijd rekenen.
 */
export const ANIM_T = { start: 0.3, h1: 2.2, rust: 2.4, h2: 2.95, end: 4.6, fin: 4.85 };
/** Na het affluiten blijft de uitslag nog tweeënhalve seconde staan voor het rapport
 *  opent: even nagenieten (of vloeken) vóór de cijfers beginnen te rollen. */
export const ANIM_MATCH_MS = 7400;
export const ANIM_WEEK_MS = 3600;

/** Wanneer een wedstrijdminuut in beeld komt, op de klok van de animatie. */
export function momentDelay(minute: number): number {
  return minute <= 45
    ? ANIM_T.start + ((minute - 1) / 44) * (ANIM_T.h1 - ANIM_T.start)
    : ANIM_T.h2 + ((Math.min(minute, 90) - 46) / 44) * (ANIM_T.end - ANIM_T.h2);
}

/**
 * Animatie terwijl de week gespeeld wordt.
 *
 * Bij een wedstrijd is dit een tijdlijn in plaats van een rollende bal: de hoogtepunten
 * verschijnen regel voor regel, op het moment in de wedstrijd waarop ze vielen (de 12de
 * minuut komt dus vroeg, de 88ste laat), en pas daarna klinkt het affluiten met de
 * uitslag. Alles binnen een seconde of drie — spanning, geen wachttijd — en klikken slaat
 * het over. Zonder wedstrijd blijft het de vertrouwde weekbalk.
 */
export function animationOverlay(s: GameState, prev: WeekRef): string {
  const m = s.lastMatch && s.lastMatch.week === prev.week && s.season === prev.season ? s.lastMatch : null;
  const title = m ? `${m.home ? s.clubName : esc(m.opponent)} – ${m.home ? esc(m.opponent) : s.clubName}` : `Week ${prev.week}`;
  const where = m ? venue(m.home) : '';

  let middenstuk: string;
  let affiche = `<h2>${title}</h2>`;
  if (m && m.moments && !m.forfeit) {
    const hg = m.home ? m.goalsFor : m.goalsAgainst;
    const ag = m.home ? m.goalsAgainst : m.goalsFor;
    const isDerby = s.league.teams.some((t) => t.isRival && t.name === m.opponent);
    // De affiche prominent: de twee ploegen groot, jouw ploeg in de clubkleur — dezelfde
    // kleur die verderop je doelpunten en wissels aanwijst, zodat je geen namen hoeft te
    // kennen om te zien wie wat deed.
    affiche = `<div class="match-title">
      <span class="mt-team ${m.home ? 'us' : ''}">${m.home ? esc(s.clubName) : esc(m.opponent)}</span>
      <span class="mt-vs">–</span>
      <span class="mt-team ${m.home ? '' : 'us'}">${m.home ? esc(m.opponent) : esc(s.clubName)}</span>
    </div>${isDerby ? '<p class="center"><span class="tag derby">🔥 DERBY</span></p>' : ''}`;
    // twee lanen rond een middellijn: de thuisploeg links, de uitploeg rechts, de minuut
    // in het midden — zo zie je in één oogopslag van wie een doelpunt of wissel was
    const kant = (us: boolean) => (us === m.home ? 'links' : 'rechts');
    const regel = (g: NonNullable<typeof m.moments>[number]) =>
      g.type === 'wissel'
        ? `<li class="sub ${g.us ? 'us' : ''}" style="animation-delay:${momentDelay(g.minute).toFixed(2)}s">
          <span class="min">${g.minute}'</span><span class="side ${kant(g.us)}">🔁 <span class="who">${esc(g.text)}</span></span></li>`
        : `<li class="${g.us ? 'us' : ''}" style="animation-delay:${momentDelay(g.minute).toFixed(2)}s">
          <span class="min">${g.minute}'</span><span class="side ${kant(g.us)}">⚽ <span class="who">${esc(g.text)}</span> <span class="mini">${g.score}</span></span></li>`;
    const eersteHelft = m.moments.filter((g) => g.minute <= 45);
    const tweedeHelft = m.moments.filter((g) => g.minute > 45);
    // de ruststand: de doelpunten van de eerste helft, in thuis-uit-volgorde
    const rustGoals = eersteHelft.filter((g) => g.type !== 'wissel');
    const rustStand = rustGoals.length ? rustGoals[rustGoals.length - 1].score : '0-0';
    middenstuk = `<div class="match-clock" data-fin="${hg} - ${ag}">1'</div>
    <ul class="match-ticker lanes">
      <li class="mid" style="animation-delay:.12s"><span class="min">1'</span> Aftrap</li>
      ${eersteHelft.map(regel).join('')}
      <li class="mid rust" style="animation-delay:${ANIM_T.rust}s"><span class="min">45'</span> Rust: ${rustStand}</li>
      ${tweedeHelft.map(regel).join('')}
      <li class="mid fin" style="animation-delay:${ANIM_T.fin}s"><span class="min">90'</span> Affluiten: ${hg} - ${ag}</li>
    </ul>`;
    } else {
    // Zonder wedstrijd rolde hier gewoon een bal over een leeg veld, met "De rekeningen
    // komen binnen…" eronder. Wie net de wedstrijdtijdlijn kende, dacht dat die kapot was
    // — terwijl het gewoon winterstop was. De kaart zegt dat nu zelf: een besneeuwd veld
    // zonder bal in de winterstop, en anders de kop "Geen wedstrijd deze week".
    const winter = !m && inWinterBreak(prev.week);
    if (!m) {
      affiche = winter
        ? `<h2>❄️ Winterstop</h2><p class="center muted small">De competitie ligt stil — geen wedstrijd deze week.</p>`
        : `<h2>${title}</h2><p class="center muted small">Geen wedstrijd deze week.</p>`;
    }
    middenstuk = `<svg class="pitch${winter ? ' winter' : ''}" viewBox="0 0 300 120" aria-hidden="true">
        <rect x="2" y="2" width="296" height="116" rx="6" class="field"/>
        <line x1="150" y1="2" x2="150" y2="118" class="lines"/>
        <circle cx="150" cy="60" r="16" class="lines" fill="none"/>
        <rect x="262" y="38" width="36" height="44" class="lines" fill="none"/>
        <rect x="292" y="48" width="6" height="24" class="goal"/>
        ${
          winter
            ? `<g class="sneeuw"><circle cx="45" cy="-6" r="3"/><circle cx="105" cy="-22" r="2"/><circle cx="150" cy="-10" r="2.6"/><circle cx="205" cy="-28" r="2.2"/><circle cx="255" cy="-14" r="3"/></g>`
            : `<g class="ball-move"><circle cx="0" cy="0" r="6" class="ball"/><path d="M-3 -2 L0 -4 L3 -2 L2 2 L-2 2Z" class="ball-dot"/></g>`
        }
      </svg>
      <div class="anim-beats">
        <span>${m ? 'De bal rolt…' : winter ? 'Het veld ligt er stil bij…' : 'De week begint…'}</span>
        <span>${m ? 'Tweede helft…' : 'De rekeningen komen binnen…'}</span>
        <span>${m ? 'Affluiten!' : 'Alles geteld!'}</span>
      </div>`;
  }

  return `<div class="overlay" data-action="skip-anim">
    <div class="anim-card">
      <p class="muted small">${formatDateLong(s.startYear, prev.season, prev.week)}</p>
      ${affiche}
      ${where}
      ${middenstuk}
      <div class="anim-bar" style="--dur:${m && m.moments && !m.forfeit ? ANIM_MATCH_MS : ANIM_WEEK_MS}ms"><span></span></div>
      <p class="muted small">Klik om over te slaan</p>
    </div>
  </div>`;
}

const MU: Record<number, string> = { 1: 'voordeel', 0: 'neutraal', [-1]: 'nadeel' };

/** Het seizoensrapport: waar je stond, wat je verdiende en hoeveel je groeide. */
function seasonReport(
  s: GameState,
  prev: WeekRef,
  stats: GameState['stats'],
  totals: (t: Partial<Record<LedgerCategory, number>>) => number,
): string {
  const row = s.league.table.find((r) => r.teamId === OWN_TEAM_ID);
  const place = ownPosition(s.league);
  const income = totals(s.seasonTotals);
  const costs = Object.values(s.seasonTotals).reduce((sum: number, v) => sum + Math.min(0, v ?? 0), 0);
  const beforeIncome = totals(s.lastSeasonTotals);
  const growth = beforeIncome > 0 ? Math.round(((income - beforeIncome) / beforeIncome) * 100) : null;
  const fansBefore = s.statsHistory[s.statsHistory.length - 1];
  const fanGrowth = fansBefore?.youthMembers ? `${s.community.youthMembers - fansBefore.youthMembers >= 0 ? '+' : ''}${s.community.youthMembers - fansBefore.youthMembers}` : null;
  const seasonMilestones = s.milestones.length;
  // het echte resultaat komt uit de clubgeschiedenis, die bij de eindafrekening geschreven wordt
  const record = s.history.find((h) => h.season === prev.season);
  const nextName = DIVISIONS[s.nextDivisionLevel]?.name ?? DIVISIONS[s.league.divisionLevel].name;
  const outcome =
    record?.result === 'kampioen'
      ? `🏆 Kampioen! Promotie naar ${nextName}`
      : record?.result === 'promotie'
        ? `⬆️ Promotie naar ${nextName}`
        : record?.result === 'degradatie'
          ? `⬇️ Degradatie naar ${nextName}`
          : `Behouden in ${DIVISIONS[s.league.divisionLevel].name}`;
  const top = [...s.players].sort((a, b) => b.starts - a.starts)[0];
  const consumpties = Object.values(stats.canteen).reduce((a, b) => a + (b ?? 0), 0);

  return `<section class="wide season-review">
    <h3>📈 Seizoensrapport ${seasonLabel(s.startYear, prev.season)}</h3>
    <div class="season-grid">
      <div class="wide-cell"><span class="label">Eindstand</span><strong>${place}e van ${s.league.table.length}</strong><span class="small"><strong>${outcome}</strong>${
        record && record.result !== 'behoud' ? ` <span class="muted">— vanaf week 1 van seizoen ${prev.season + 1}</span>` : ''
      }</span></div>
      <div><span class="label">Resultaten</span><strong>${row ? `${row.won}W ${row.drawn}G ${row.lost}V` : '–'}</strong><span class="small">${
        row ? `${row.goalsFor} voor, ${row.goalsAgainst} tegen` : ''
      }</span></div>
      <div><span class="label">Inkomsten</span><strong>${euro(income)}</strong><span class="small">${
        growth !== null ? `${growth >= 0 ? '+' : ''}${growth}% tegenover vorig seizoen` : 'eerste seizoen'
      }</span></div>
      <div><span class="label">Kosten</span><strong>${euro(-costs)}</strong><span class="small">resultaat ${euro(income + costs)}</span></div>
      <div><span class="label">Premie</span><strong>${record?.prize ? euro(record.prize) : '–'}</strong><span class="small">${
        record?.prize
          ? record.result === 'kampioen'
            ? 'kampioenenpremie, geboekt onder "premies"'
            : 'promotiepremie, geboekt onder "premies"'
          : 'alleen bij een titel of promotie'
      }</span></div>
      <div><span class="label">Supporters</span><strong>${s.community.fanBase}</strong><span class="small">${stats.tickets} tickets verkocht</span></div>
      <div><span class="label">Jeugd</span><strong>${s.community.youthMembers}</strong><span class="small">${fanGrowth ? `${fanGrowth} tegenover vorig seizoen` : 'eerste seizoen'}</span></div>
      <div><span class="label">Kantine</span><strong>${consumpties}</strong><span class="small">consumpties</span></div>
      <div><span class="label">Mijlpalen</span><strong>${seasonMilestones}</strong><span class="small">totaal behaald</span></div>
      <div><span class="label">Meeste basisplaatsen</span><strong>${top ? esc(top.name) : '–'}</strong><span class="small">${top ? `${top.starts} wedstrijden` : ''}</span></div>
    </div>
    ${
      s.lastSeasonSettlement
        ? `<div class="settlement">
            ${s.lastSeasonSettlement.ambition ? `<p class="promise-line ${s.lastSeasonSettlement.kept ? 'ok' : 'off'}">🎙️ ${esc(s.lastSeasonSettlement.ambition)}</p>` : ''}
            ${
              s.lastSeasonSettlement.goals.length
                ? `<h4>Doelen van het bestuur</h4><ul class="small plain">${s.lastSeasonSettlement.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`
                : ''
            }
          </div>`
        : ''
    }
  </section>`;
}

export function reportOverlay(s: GameState, prev: WeekRef): string {
  const m = s.lastMatch && s.lastMatch.week === prev.week ? s.lastMatch : null;
  const streak = currentStreak(s);
  const streakHtml =
    streak.wins >= 3
      ? `<p class="center small streak">🔥 ${streak.wins} overwinningen op rij</p>`
      : streak.unbeaten >= 4
        ? `<p class="center small streak">🔥 ${streak.unbeaten} wedstrijden ongeslagen</p>`
        : '';


  const sameSeason = s.season === prev.season;

  // wedstrijd
  let matchHtml = inWinterBreak(prev.week)
    ? '<p class="attention-inline">❄️ Winterstop: er werd niet gespeeld. Geen tickets, geen wedstrijdkantine en geen kraampjes deze week.</p>'
    : '<p class="muted">Geen wedstrijd deze week.</p>';
  if (m && sameSeason) {
    const homeName = m.home ? s.clubName : m.opponent;
    const awayName = m.home ? m.opponent : s.clubName;
    const hg = m.home ? m.goalsFor : m.goalsAgainst;
    const ag = m.home ? m.goalsAgainst : m.goalsFor;
    const res = m.goalsFor > m.goalsAgainst ? 'win' : m.goalsFor < m.goalsAgainst ? 'loss' : 'draw';
    const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
    const isDerby = s.league.teams.some((t) => t.isRival && t.name === m.opponent);
    matchHtml = `<p class="center small">${venue(m.home)} tegen ${esc(m.opponent)}${isDerby ? ' <span class="tag derby">🔥 DERBY</span>' : ''}</p>
      <div class="scoreboard reveal ${res}">
        <span class="team">${esc(homeName)}</span><span class="score">${hg} - ${ag}</span><span class="team">${esc(awayName)}</span>
      </div>
      <p class="center result-line ${res}">${resultIcon(m.goalsFor, m.goalsAgainst)} <strong>${res === 'win' ? 'Gewonnen' : res === 'loss' ? 'Verloren' : 'Gelijkspel'}</strong></p>
      <p class="small center">${m.forfeit ? '<strong class="neg">Forfait: te weinig spelers beschikbaar</strong>' : `${m.weather}${m.ourPlan && m.theirPlan ? ` · ${PLAN_INFO[m.ourPlan].label} tegen ${PLAN_INFO[m.theirPlan].label.toLowerCase()} (${MU[m.matchup ?? 0]})` : ''}`}</p>
      ${streakHtml}
      ${m.cards ? `<p class="small center">${esc(m.cards)}</p>` : ''}
      ${
        m.scorers?.length
          ? `<p class="scorers small center">⚽ ${m.scorers.map((g) => `<strong>${esc(g.name)}</strong> ${g.minute}'`).join(' · ')}</p>`
          : m.goalsFor === 0 && !m.forfeit
            ? '<p class="small center muted">Niet gescoord.</p>'
            : ''
      }
      ${
        m.lineup?.length
          ? `<details class="lineup-details"><summary class="small">De elf die begon (${m.lineup.length})</summary>
              <ul class="small plain lineup-list">${m.lineup
                .map((x) => {
                  const scored = m.scorers?.filter((g) => g.name === x.name).length ?? 0;
                  return `<li><span class="pos-tag">${x.zone}</span> ${esc(x.name)} <span class="muted">${x.rating}</span>${scored ? ` ${'⚽'.repeat(scored)}` : ''}</li>`;
                })
                .join('')}</ul></details>`
          : ''
      }
      ${played ? `<p class="small center">Stand: <strong>${ownPosition(s.league)}e</strong></p>` : ''}`;
  }
  const others = sameSeason
    ? s.league.fixtures.filter((f) => f.week === prev.week && f.homeGoals !== undefined && f.homeId !== OWN_TEAM_ID && f.awayId !== OWN_TEAM_ID)
    : [];
  const othersHtml = others.length
    ? `<details><summary class="small">De andere ${others.length} wedstrijden van deze speeldag</summary><ul class="small plain">${others
        .map((f) => `<li>${esc(teamName(s, f.homeId))} ${f.homeGoals}-${f.awayGoals} ${esc(teamName(s, f.awayId))}</li>`)
        .join('')}</ul></details>`
    : '';

  // financiën
  const byCat = new Map<LedgerCategory, number>();
  for (const e of s.lastWeek) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const net = sorted.reduce((sum, [, v]) => sum + v, 0);
  const roll = (value: number, signed = true) => `<span class="roll" data-to="${Math.round(value)}" data-signed="${signed ? 1 : 0}">${euro(0)}</span>`;
  // Binnen en buiten uit elkaar, met een subtotaal per kant.
  //
  // Het was één lijst van twaalf categorieën door elkaar, van +€26.000 tot −€42.000, waarin
  // je zelf moest optellen wat er eigenlijk binnenkwam. Twee kolommen met elk hun eigen
  // som beantwoorden de twee vragen die je hebt: wat bracht het op, en waar ging het heen.
  const inkomsten = sorted.filter(([, v]) => v > 0);
  const uitgaven = sorted.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const totaalIn = inkomsten.reduce((sum, [, v]) => sum + v, 0);
  const totaalUit = uitgaven.reduce((sum, [, v]) => sum + v, 0);
  const kant = (titel: string, rijen: [LedgerCategory, number][], totaal: number, klasse: string) =>
    `<div class="money-side">
      <h4>${titel}<span class="num ${klasse}">${roll(totaal)}</span></h4>
      ${
        rijen.length
          ? `<table class="compact"><tbody>${rijen.map(([k, v]) => `<tr><td>${k}</td><td class="num ${klasse}">${roll(v)}</td></tr>`).join('')}</tbody></table>`
          : '<p class="muted small">Niets deze week.</p>'
      }
    </div>`;

  const financeHtml = sorted.length
    ? `<div class="money-split">
        ${kant('Binnengekomen', inkomsten, totaalIn, 'pos')}
        ${kant('Uitgegeven', uitgaven, totaalUit, 'neg')}
      </div>
      <table class="compact money-bottom"><tbody>
        <tr class="total"><td>Overgehouden deze week</td><td class="num ${net < 0 ? 'neg' : 'pos'}">${roll(net)}</td></tr>
        <tr><td>Op de rekening</td><td class="num"><strong>${roll(s.cash, false)}</strong></td></tr>
      </tbody></table>`
    : '<p class="muted">Geen boekingen.</p>';

  // jaaroverzicht op het einde van het seizoen: zie je groei in één oogopslag
  const totals = (t: Partial<Record<LedgerCategory, number>>) => Object.values(t).reduce((sum: number, v) => sum + Math.max(0, v ?? 0), 0);
  const prevStats = s.stats.season === prev.season ? s.stats : s.statsHistory[s.statsHistory.length - 1];
  const seasonReview = prev.week === SEASON_END_WEEK && prevStats ? seasonReport(s, prev, prevStats, totals) : '';

  const records = s.lastRecords.length
    ? `<section class="wide milestone record"><h3>🏅 Clubrecord${s.lastRecords.length > 1 ? 's' : ''}</h3>
        <ul class="small">${s.lastRecords.map((r) => `<li><strong>${esc(r)}</strong></li>`).join('')}</ul></section>`
    : '';
  const milestones = s.lastMilestones.length
    ? `<section class="wide milestone"><h3>🎉 Mijlpaal${s.lastMilestones.length > 1 ? 'en' : ''}</h3>
        <ul class="small">${s.lastMilestones.map((m) => `<li><strong>${esc(m)}</strong></li>`).join('')}</ul></section>`
    : '';

  // Nieuws van deze week, minus wat hierboven al in een eigen blok staat.
  //
  // De uitslag stond drie keer op één scherm: als kaartje bovenaan, als scorebord, en nog
  // eens als nieuwsregel met dezelfde toeschouwers en dezelfde kaarten erin. Het weekmoment
  // stond twee keer. In de nieuwsstroom op je bureau horen ze wél thuis — daar is geen
  // scorebord — dus ze worden hier alleen overgeslagen.
  const weekNews = s.news.filter((n) => n.week === prev.week && n.season === prev.season && n.kind !== 'wedstrijd' && n.kind !== 'moment');

  // De kleine successen die vanzelf gebeurden — een diploma, een opgeleverde bouw, een
  // sponsor die je commerciële man binnenhaalde — verdwenen als grijze regel tussen het
  // nieuws. Ze krijgen nu hun eigen gouden kaartjes, die na de cijfers één voor één
  // oppoppen. Maximaal drie: bij meer viert niemand nog iets, de rest blijft gewoon nieuws.
  const feest = weekNews.filter((n) => n.kind === 'viering').slice(0, 3);
  const feestHtml = feest.length
    ? `<section class="wide"><h3>🎉 Om te vieren</h3><div class="vieringen">${feest
        .map((n, i) => `<div class="viering-kaart" style="--vd:${(1.5 + i * 0.4).toFixed(1)}s"><span class="v-icon">${newsIcon(n.text, '🎉')}</span><p>${esc(n.text)}</p></div>`)
        .join('')}</div></section>`
    : '';

  const news = weekNews.filter((n) => !feest.includes(n));
  const newsHtml = news.length
    ? `<ul class="news reveal-lines">${news
        .map((n) => {
          const icon = newsIcon(n.text);
          return `<li class="${n.tone}">${icon ? `<span class="n-icon">${icon}</span>` : ''}${esc(n.text)}</li>`;
        })
        .join('')}</ul>`
    : '<p class="muted">Rustige week.</p>';

  // in afwachting
  const waiting: string[] = [];
  for (const p of s.pending) waiting.push(`${esc(p.label)}${p.amount ? `: ${euro(p.amount)}` : ''}, over ${weeks(p.weeksLeft)}`);
  for (const r of s.requests) waiting.push(`${esc(r.label)}: antwoord over ${weeks(r.weeksLeft)}`);
  for (const o of s.sponsorOffers) waiting.push(`Sponsorvoorstel ${esc(o.name)} (${o.renewalOf ? 'verlenging' : KIND_LABEL[o.kind].toLowerCase()}, ${euro(o.weekly)}/week): beslis binnen ${weeks(o.expiresInWeeks)}`);
  for (const p of s.prospects.filter((x) => x.approached)) waiting.push(`Gesprek met ${esc(p.name)}: antwoord volgende week`);
  for (const o of s.playerOffers) {
    const p = s.players.find((x) => x.id === o.playerId);
    if (p) waiting.push(`Bod van ${esc(o.club)} op ${esc(p.name)}: ${euro(o.amount)}, nog ${weeks(o.expiresInWeeks)}`);
  }
  if (s.sponsorCampaignWeeks) waiting.push(`Sponsorbureau zoekt nog ${weeks(s.sponsorCampaignWeeks)}`);
  for (const c of s.infrastructure.constructions) {
    const u = UPGRADES.find((x) => x.id === c.upgrade)!;
    waiting.push(`Bouwwerken ${esc(u.label)}${c.seats ? ` (+${c.seats} plaatsen)` : ''}: klaar over ${weeks(c.weeksLeft)}`);
  }
  for (const st of s.staff.filter((x) => x.courseWeeksLeft > 0)) waiting.push(`${esc(st.name)} in opleiding: nog ${weeks(st.courseWeeksLeft)}`);
  const injured = s.players.filter((p) => p.injuryWeeks > 0);
  if (injured.length) waiting.push(`Geblesseerd: ${injured.map((p) => `${esc(p.name)} (${p.injuryWeeks}w)`).join(', ')}`);
  const suspended = s.players.filter((p) => p.suspended > 0);
  if (suspended.length) waiting.push(`Geschorst: ${suspended.map((p) => `${esc(p.name)} (${p.suspended})`).join(', ')}`);

  // Er stond hier een rij kaartjes met het resultaat, de uitslag en het publiek — de hele
  // week samengevat vóór het rapport ook maar iets kon vertellen. Dat verklapte precies
  // wat de rollende cijfers en het scorebord aan spanning opbouwen, en het stond dubbel:
  // alles eruit staat hieronder al in zijn eigen blok. Weg ermee.

  /**
   * De kop en de knop blijven staan, de rest scrollt ertussen.
   *
   * Een drukke week maakt dit rapport lang, en dan stond "Naar je bureau" onderaan buiten
   * beeld: je moest langs alles scrollen om verder te kunnen. Nu plakken de kop en de
   * knoppenbalk aan het kader, zodat je op elk moment weg kunt.
   *
   * De volgorde volgt wat je wil weten, van dringend naar naslag: eerst de kaartjes met de
   * uitslag en het resultaat, dan de wedstrijd, dan het geld, en pas daarna wat er verder
   * gebeurde. De twee lijsten die het langst worden — de andere uitslagen en wat er in
   * afwachting staat — zijn ingeklapt zodra ze meer dan een handvol regels tellen.
   */
  const afwachtingHtml = !waiting.length
    ? '<p class="muted">Niets in afwachting.</p>'
    : waiting.length <= 5
      ? `<ul class="small reveal-lines">${waiting.map((w) => `<li>${w}</li>`).join('')}</ul>`
      : `<details><summary class="small">${waiting.length} dingen lopen nog</summary>
          <ul class="small">${waiting.map((w) => `<li>${w}</li>`).join('')}</ul></details>`;

  return `<div class="overlay">
    <div class="report-card" role="dialog" aria-label="Weekrapport">
      <div class="report-head">
        <div><h2>Weekrapport</h2><span class="muted small">Week ${prev.week} · ${formatDateLong(s.startYear, prev.season, prev.week)}</span></div>
        <button class="sm ghost" data-action="close-report" data-tip="Sluit het rapport en ga terug naar het scherm waar je was. Sneltoets: Esc.">Sluiten ✕ ${kbd('Esc')}</button>
      </div>
      <div class="report-body">
        <div class="report-grid">
          ${seasonReview}
          ${milestones}
          ${records}
          <section class="wide"><h3>De wedstrijd</h3>${matchHtml}${othersHtml}</section>
          <section class="wide"><h3>Geld</h3>${financeHtml}</section>
          ${feestHtml}
          ${s.lastChoice ? `<section class="wide moment-result"><h3>📌 Weekmoment — ${esc(s.lastChoice.title)}</h3><p class="small">${esc(s.lastChoice.outcome)}</p></section>` : ''}
          <section class="wide"><h3>Nieuws${news.length ? ` <span class="tag">${news.length}</span>` : ''}</h3>${newsHtml}</section>
          <section class="wide"><h3>Loopt nog${waiting.length ? ` <span class="tag">${waiting.length}</span>` : ''}</h3>${afwachtingHtml}</section>
        </div>
      </div>
      <div class="report-foot">
        <button class="primary" data-action="report-overview" data-tip="Sneltoets: Enter (B werkt ook).">Naar je bureau ▸ ${kbd('↵')}</button>
      </div>
    </div>
  </div>`;
}
