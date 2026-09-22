// Kalender van het seizoen: competitie, transferperiodes, vaste momenten en jouw planning.

import type { GameState } from '../../engine/types';
import {
  BOND_FEE_WEEK,
  LICENCE_AUDIT_WEEK,
  MATCH_WEEKS,
  SEASON_END_WEEK,
  SUBSIDY_WEEK,
  WINTER_BREAK,
  formatWeek,
  isTransferWindow,
  monthName,
  seasonLabel,
} from '../../engine/calendar';
import { OWN_TEAM_ID, teamName } from '../../engine/league';
import { CLUB_EVENTS, UPGRADES } from '../../engine/data/catalog';
import { KIND_LABEL } from '../../engine/sponsors';
import { YOUTH_FEE_WEEK } from '../../engine/actions';
import { seasonPrize } from '../../engine/turn';
import { esc, euro } from '../format';

type Kind = 'match' | 'transfer' | 'fixed' | 'plan' | 'money' | 'break';

export function calendarScreen(s: GameState): string {
  const items = new Map<number, { kind: Kind; text: string }[]>();
  const add = (week: number, kind: Kind, text: string) => {
    if (week < 1 || week > 52) return;
    if (!items.has(week)) items.set(week, []);
    items.get(week)!.push({ kind, text });
  };

  // vaste momenten
  add(1, 'fixed', 'Start seizoen · jeugd stroomt door · nieuwe competitie');
  add(1, 'transfer', 'Zomertransferperiode open (tot week 9)');
  add(9, 'transfer', 'Laatste week zomertransferperiode');
  add(28, 'transfer', 'Wintertransferperiode open (tot week 32)');
  add(32, 'transfer', 'Laatste week wintertransferperiode');
  add(45, 'transfer', 'Transferperiode open voor volgend seizoen');
  add(BOND_FEE_WEEK, 'fixed', 'Aansluiting Voetbal Vlaanderland en verzekeringen');
  add(YOUTH_FEE_WEEK, 'fixed', `Inschrijvingen jeugd (lidgeld €${s.youthFee})`);
  add(SUBSIDY_WEEK, 'fixed', 'Subsidie gemeente');
  add(LICENCE_AUDIT_WEEK, 'fixed', 'Licentie-audit Voetbal Vlaanderland');
  add(40, 'fixed', 'Laatste kans om aflopende contracten te verlengen');
  add(43, 'fixed', 'Inhaaldag (afgelaste wedstrijden)');
  add(
    SEASON_END_WEEK,
    'fixed',
    `Einde competitie: kampioen, promotie en degradatie · premie ${euro(seasonPrize(s.league.divisionLevel, 'kampioen'))} bij de titel, ${euro(
      seasonPrize(s.league.divisionLevel, 'promotie'),
    )} bij plaats 2`,
  );
  add(WINTER_BREAK.from, 'break', `Winterstop (tot week ${WINTER_BREAK.to})`);
  for (let w = 4; w <= 52; w += 4) add(w, 'fixed', 'Spelersevolutie (4 weken)');

  // wedstrijden
  for (const f of s.league.fixtures.filter((x) => x.homeId === OWN_TEAM_ID || x.awayId === OWN_TEAM_ID)) {
    const home = f.homeId === OWN_TEAM_ID;
    const opp = teamName(s, home ? f.awayId : f.homeId);
    const round = MATCH_WEEKS.indexOf(f.week);
    const played = f.homeGoals !== undefined;
    const score = played ? ` <strong>${home ? f.homeGoals : f.awayGoals}-${home ? f.awayGoals : f.homeGoals}</strong>` : '';
    add(f.week, 'match', `${round >= 0 ? `Speeldag ${round + 1}` : 'Inhaalwedstrijd'}: ${home ? 'thuis' : 'uit'} tegen ${esc(opp)}${score}`);
  }

  // jouw planning
  for (const e of s.eventLog.filter((x) => x.season === s.season)) {
    add(e.week, 'plan', `Evenement: ${CLUB_EVENTS.find((d) => d.id === e.id)?.label ?? e.id}`);
  }
  for (const p of s.pending) add(s.week + p.weeksLeft - 1, 'money', `${esc(p.label)}${p.amount ? ` (${euro(p.amount)})` : ''}`);
  if (s.infrastructure.construction) {
    const u = UPGRADES.find((x) => x.id === s.infrastructure.construction!.upgrade)!;
    add(s.week + s.infrastructure.construction.weeksLeft - 1, 'plan', `Bouwproject klaar: ${esc(u.label)}`);
  }
  for (const st of s.staff.filter((x) => x.courseWeeksLeft > 0)) add(s.week + st.courseWeeksLeft - 1, 'plan', `Opleiding klaar: ${esc(st.name)}`);
  for (const d of s.sponsors.filter((x) => x.kind !== 'stadion' && s.week + x.weeksLeft <= 52)) {
    add(s.week + d.weeksLeft - 1, 'money', `Contract ${esc(d.name)} (${KIND_LABEL[d.kind].toLowerCase()}) loopt af`);
  }
  for (const l of s.loans.filter((x) => s.week + x.weeksLeft <= 52)) add(s.week + l.weeksLeft - 1, 'money', `Laatste afbetaling ${esc(l.label)}`);

  // opbouw per maand
  let month = '';
  let html = '';
  for (let w = 1; w <= 52; w++) {
    const m = monthName(s.startYear, s.season, w);
    if (m !== month) {
      if (month) html += '</tbody></table>';
      month = m;
      html += `<h3 class="month">${m}</h3><table class="compact cal"><tbody>`;
    }
    const list = items.get(w) ?? [];
    const cls = w === s.week ? 'now' : w < s.week ? 'past' : '';
    html += `<tr class="${cls}">
      <td class="cal-date">W${w}<br/><span class="muted small">${formatWeek(s.startYear, s.season, w)}</span></td>
      <td>${isTransferWindow(w) ? '<span class="tag">transfers</span> ' : ''}${list.map((i) => `<span class="cal-item ${i.kind}">${i.text}</span>`).join('') || '<span class="muted small">—</span>'}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  return `<section class="card">
    <h2>Kalender ${seasonLabel(s.startYear, s.season)}</h2>
    <p class="muted small">Een speelweek begint op de vermelde datum. <span class="cal-item match">wedstrijd</span> <span class="cal-item transfer">transfers</span>
    <span class="cal-item fixed">vast moment</span> <span class="cal-item plan">jouw planning</span> <span class="cal-item money">geld of contract</span> <span class="cal-item break">winterstop</span></p>
    ${html}
  </section>`;
}
