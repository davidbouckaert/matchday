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

export interface WeekRef {
  week: number;
  season: number;
}

/** Animatie terwijl de week gespeeld wordt: een bal die naar doel rolt. */
export function animationOverlay(s: GameState, prev: WeekRef): string {
  const hadMatch = s.lastMatch && s.lastMatch.week === prev.week && s.season === prev.season;
  const title = hadMatch ? `${s.lastMatch!.home ? s.clubName : esc(s.lastMatch!.opponent)} – ${s.lastMatch!.home ? esc(s.lastMatch!.opponent) : s.clubName}` : `Week ${prev.week}`;
  const where = hadMatch ? venue(s.lastMatch!.home) : '';
  return `<div class="overlay" data-action="skip-anim">
    <div class="anim-card">
      <p class="muted small">${formatDateLong(s.startYear, prev.season, prev.week)}</p>
      <h2>${title}</h2>
      ${where}
      <svg class="pitch" viewBox="0 0 300 120" aria-hidden="true">
        <rect x="2" y="2" width="296" height="116" rx="6" class="field"/>
        <line x1="150" y1="2" x2="150" y2="118" class="lines"/>
        <circle cx="150" cy="60" r="16" class="lines" fill="none"/>
        <rect x="262" y="38" width="36" height="44" class="lines" fill="none"/>
        <rect x="292" y="48" width="6" height="24" class="goal"/>
        <g class="ball-move"><circle cx="0" cy="0" r="6" class="ball"/><path d="M-3 -2 L0 -4 L3 -2 L2 2 L-2 2Z" class="ball-dot"/></g>
      </svg>
      <div class="anim-beats">
        <span>${hadMatch ? 'De bal rolt…' : 'De week begint…'}</span>
        <span>${hadMatch ? 'Tweede helft…' : 'De rekeningen komen binnen…'}</span>
        <span>${hadMatch ? 'Affluiten!' : 'Alles geteld!'}</span>
      </div>
      <div class="anim-bar"><span></span></div>
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
      <p class="small center">${m.forfeit ? '<strong class="neg">Forfait: te weinig spelers beschikbaar</strong>' : `${m.home ? `${m.attendance} toeschouwers · ` : ''}${m.weather}${m.ourPlan && m.theirPlan ? ` · ${PLAN_INFO[m.ourPlan].label} tegen ${PLAN_INFO[m.theirPlan].label.toLowerCase()} (${MU[m.matchup ?? 0]})` : ''}`}</p>
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
    ? `<details><summary class="small">Andere uitslagen (${others.length})</summary><ul class="small plain">${others
        .map((f) => `<li>${esc(teamName(s, f.homeId))} ${f.homeGoals}-${f.awayGoals} ${esc(teamName(s, f.awayId))}</li>`)
        .join('')}</ul></details>`
    : '';

  // financiën
  const byCat = new Map<LedgerCategory, number>();
  for (const e of s.lastWeek) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const net = sorted.reduce((sum, [, v]) => sum + v, 0);
  const roll = (value: number, signed = true) => `<span class="roll" data-to="${Math.round(value)}" data-signed="${signed ? 1 : 0}">${euro(0)}</span>`;
  const financeHtml = sorted.length
    ? `<table class="compact"><tbody>${sorted.map(([k, v]) => `<tr><td>${k}</td><td class="num ${v < 0 ? 'neg' : 'pos'}">${roll(v)}</td></tr>`).join('')}
        <tr class="total"><td>Saldo van de week</td><td class="num ${net < 0 ? 'neg' : 'pos'}">${roll(net)}</td></tr>
        <tr><td>Nieuw saldo</td><td class="num"><strong>${roll(s.cash, false)}</strong></td></tr></tbody></table>`
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

  // nieuws van deze week
  const news = s.news.filter((n) => n.week === prev.week && n.season === prev.season);
  const newsHtml = news.length
    ? `<ul class="news reveal-lines">${news.map((n) => `<li class="${n.tone}">${esc(n.text)}</li>`).join('')}</ul>`
    : '<p class="muted">Rustige week.</p>';

  // in afwachting
  const waiting: string[] = [];
  for (const p of s.pending) waiting.push(`${esc(p.label)}${p.amount ? `: ${euro(p.amount)}` : ''}, over ${weeks(p.weeksLeft)}`);
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

  return `<div class="overlay">
    <div class="report-card" role="dialog" aria-label="Weekrapport">
      <div class="report-head">
        <div><h2>Weekrapport</h2><span class="muted small">Week ${prev.week} · ${formatDateLong(s.startYear, prev.season, prev.week)}</span></div>
        <button class="sm ghost" data-action="close-report">Sluiten ✕</button>
      </div>
      <div class="report-grid">
        ${seasonReview}
        ${milestones}
        ${records}
        <section><h3>Wedstrijd</h3>${matchHtml}${othersHtml}</section>
        <section><h3>Financiën</h3>${financeHtml}</section>
        ${s.lastChoice ? `<section class="wide moment-result"><h3>📌 Weekmoment — ${esc(s.lastChoice.title)}</h3><p class="small">${esc(s.lastChoice.outcome)}</p></section>` : ''}
        <section class="wide"><h3>Nieuws en berichten</h3>${newsHtml}</section>
        <section class="wide"><h3>In afwachting</h3>${waiting.length ? `<ul class="small reveal-lines">${waiting.map((w) => `<li>${w}</li>`).join('')}</ul>` : '<p class="muted">Niets in afwachting.</p>'}</section>
      </div>
      <div class="actions">
        <button class="primary" data-action="report-overview">Naar het overzicht</button>
      </div>
    </div>
  </div>`;
}
