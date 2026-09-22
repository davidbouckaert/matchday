import type { GameState, LedgerEntry } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { MATCH_WEEKS, isTransferWindow } from '../../engine/calendar';
import { OWN_TEAM_ID, ownPosition, teamName } from '../../engine/league';
import { clubRatings } from '../../engine/ratings';
import { teamStrength } from '../../engine/players';
import { esc, resultIcon, signedEuro, sparkline, stars } from '../format';
import { hint } from '../tooltip';
import { weeks } from '../../engine/util';
import { available } from '../../engine/discipline';

export function weekSummary(entries: LedgerEntry[]): { income: number; costs: number } {
  let income = 0;
  let costs = 0;
  for (const e of entries) {
    if (e.category === 'leningen' || e.category === 'investeerder') continue;
    if (e.amount > 0) income += e.amount;
    else costs += e.amount;
  }
  return { income, costs };
}

export function overviewScreen(s: GameState): string {
  const ratings = clubRatings(s);
  const next = s.league.fixtures
    .filter((f) => f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .sort((a, b) => a.week - b.week)[0];
  const nextLabel = next
    ? `<span class="venue ${next.homeId === OWN_TEAM_ID ? 'home' : 'away'}">${next.homeId === OWN_TEAM_ID ? '🏠 Thuis' : '🚌 Uit'}</span> tegen <strong>${esc(teamName(s, next.homeId === OWN_TEAM_ID ? next.awayId : next.homeId))}</strong> in week ${next.week}${next.week === s.week ? ' (deze week)' : ''}`
    : MATCH_WEEKS[0] > s.week
      ? 'Competitie start in week 7'
      : 'Geen wedstrijden meer dit seizoen';
  const strength = teamStrength(s);
  const division = DIVISIONS[s.league.divisionLevel];
  const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const { income, costs } = weekSummary(s.lastWeek);
  const m = s.lastMatch;

  const warnings: string[] = [];
  if (s.weeksNegative > 0) warnings.push(`Saldo al ${weeks(s.weeksNegative)} onder nul. Na 8 weken is de club failliet.`);
  if (s.emergencyLoanOffered) warnings.push('De bank biedt een noodlening aan (Financiën).');
  if (s.playerOffers.length) warnings.push(s.playerOffers.length === 1 ? 'Er ligt een bod op een van je spelers (Ploeg).' : `Er liggen ${s.playerOffers.length} biedingen op je spelers (Ploeg).`);
  if (s.sponsorOffers.length) warnings.push(s.sponsorOffers.length === 1 ? 'Er is een nieuw sponsoraanbod (Financiën).' : `Er zijn ${s.sponsorOffers.length} sponsoraanbiedingen (Financiën).`);
  if (isTransferWindow(s.week)) warnings.push('De transferperiode is open.');
  const avail = available(s.players).length;
  if (avail < 11) warnings.push(`Slechts ${avail} spelers beschikbaar (geblesseerd of geschorst): de volgende wedstrijd wordt forfait (0-5)!`);
  else if (avail < 13) warnings.push(`Slechts ${avail} spelers beschikbaar. Onder de 11 volgt forfait.`);

  return `
  <div class="grid">
    <section class="card span2">
      <h2>Clubrating</h2>
      <div class="ratings">
        ${ratings
          .map(
            (r) => `<div class="rating"><span class="label">${r.label}</span>${stars(r.stars)}<span class="muted small">${r.score}/100</span></div>`,
          )
          .join('')}
      </div>
    </section>

    <section class="card">
      <h2>Volgende wedstrijd</h2>
      <p>${nextLabel}</p>
      <p class="muted small">Teamsterkte ${strength.total} · gemiddelde tegenstander ${division.opponentStrength}</p>
      ${played ? `<p>Stand: <strong>${ownPosition(s.league)}e</strong> in ${division.name}</p>` : ''}
    </section>

    <section class="card">
      <h2>Vorige week</h2>
      <p>Inkomsten ${signedEuro(income)}<br/>Kosten ${signedEuro(costs)}<br/>Resultaat <strong>${signedEuro(income + costs)}</strong></p>
      ${m && m.week === s.week - 1 ? `<p class="small">${resultIcon(m.goalsFor, m.goalsAgainst)} <span class="venue ${m.home ? 'home' : 'away'}">${m.home ? '🏠 Thuis' : '🚌 Uit'}</span> vs ${esc(m.opponent)}: <strong>${m.goalsFor}-${m.goalsAgainst}</strong>${m.forfeit ? ' · <span class="neg">forfait</span>' : m.home ? ` · ${m.attendance} toeschouwers · ${m.weather}` : ''}${m.cards ? `<br/>${esc(m.cards)}` : ''}</p>` : ''}
    </section>

    ${warnings.length ? `<section class="card full attention"><h2>Aandacht</h2><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}

    <section class="card full">
      <h2>Saldo (laatste ${s.cashHistory.length} weken)</h2>
      ${sparkline(s.cashHistory)}
    </section>

    <section class="card full">
      <h2>Logboek ${hint('Alles wat jij besliste en elk antwoord dat je daarop kreeg, in volgorde. Handig om terug te vinden wat je vorige week vroeg.')}</h2>
      ${
        s.log.length
          ? `<ul class="news log">${s.log
              .slice(0, 20)
              .map((l) => `<li class="${l.kind === 'antwoord' ? 'goed' : 'neutraal'}"><span class="muted small">S${l.season} W${l.week}</span> <span class="tag">${l.kind}</span> ${esc(l.text)}</li>`)
              .join('')}</ul>`
          : '<p class="muted">Nog niets beslist deze week.</p>'
      }
    </section>

    <section class="card full">
      <h2>Nieuws</h2>
      <ul class="news">
        ${s.news
          .slice(0, 14)
          .map((n) => `<li class="${n.tone}"><span class="muted small">S${n.season} W${n.week}</span> ${esc(n.text)}</li>`)
          .join('')}
      </ul>
    </section>
  </div>`;
}
