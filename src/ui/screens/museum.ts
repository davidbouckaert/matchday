// Het clubmuseum: de erelijst. Alles wat je club al bereikt heeft, op één muur.
// Niets nieuws om bij te houden — puur terugkijken op wat het spel al bijhoudt.

import type { GameState } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { seasonLabel } from '../../engine/calendar';
import { MILESTONES } from '../../engine/milestones';
import { rivalTeam } from '../../engine/league';
import { overall } from '../../engine/players';
import { esc, euro, signedEuro, sparkline } from '../format';
import { hint } from '../tooltip';

export function museumScreen(s: GameState): string {
  const titles = s.history.filter((h) => h.result === 'kampioen');
  const promotions = s.history.filter((h) => h.result === 'promotie');
  const relegations = s.history.filter((h) => h.result === 'degradatie');
  const prizeTotal = s.history.reduce((t, h) => t + (h.prize ?? 0), 0);
  const seasons = s.history.length;
  const best = s.history.length ? [...s.history].sort((a, b) => a.position - b.position)[0] : null;
  const highest = s.history.length ? [...s.history].sort((a, b) => DIVISIONS.findIndex((d) => d.name === b.division) - DIVISIONS.findIndex((d) => d.name === a.division))[0] : null;

  const fanHistory = [...s.statsHistory.map((st) => st.attendanceHome / Math.max(1, st.matchesHome)), s.stats.matchesHome ? s.stats.attendanceHome / s.stats.matchesHome : 0].filter((x) => x > 0);
  const priciest = [...s.players].sort((a, b) => b.purchasePrice - a.purchasePrice)[0];
  const bestPlayer = [...s.players].sort((a, b) => overall(b) - overall(a))[0];
  const veteran = [...s.players].sort((a, b) => b.starts - a.starts)[0];
  const rival = rivalTeam(s);
  const derbyTotal = s.derbyRecord.won + s.derbyRecord.drawn + s.derbyRecord.lost;

  const trophy = (n: number, label: string, icon: string) =>
    `<div class="trophy ${n ? 'won' : ''}"><span class="icon">${icon}</span><strong>${n}</strong><span class="small">${label}</span></div>`;

  return `<div class="grid">
    <section class="card full museum-head">
      <h2>🏛️ Clubmuseum ${esc(s.clubName)} ${hint('De erelijst van je club: titels, records, mijlpalen en de mensen die er iets van maakten. Alles wordt automatisch bijgehouden.')}</h2>
      <p class="muted small">${seasons ? `${seasons} afgewerkt${seasons === 1 ? ' seizoen' : 'e seizoenen'} sinds ${seasonLabel(s.startYear, 1)}` : 'Het eerste seizoen loopt nog. Hier komt je geschiedenis te staan.'}</p>
      <div class="trophies">
        ${trophy(titles.length, titles.length === 1 ? 'titel' : 'titels', '🏆')}
        ${trophy(promotions.length + titles.length, 'promoties', '⬆️')}
        ${trophy(relegations.length, 'degradaties', '⬇️')}
        ${trophy(s.milestones.length, `van de ${MILESTONES.length} mijlpalen`, '🎉')}
      </div>
    </section>

    <section class="card">
      <h3>Records</h3>
      <dl class="facts">
        <dt>Grootste opkomst</dt><dd>${s.records.attendance || '–'} toeschouwers</dd>
        <dt>Beste week</dt><dd>${s.records.weekIncome ? euro(s.records.weekIncome) : '–'}</dd>
        <dt>Beste seizoen</dt><dd>${s.records.seasonIncome ? euro(s.records.seasonIncome) : '–'}</dd>
        <dt>Langste zegereeks</dt><dd>${s.records.winStreak || '–'} wedstrijden</dd>
        <dt>Langst ongeslagen</dt><dd>${s.records.unbeaten || '–'} wedstrijden</dd>
        <dt>Meeste supporters</dt><dd>${s.records.fanBase || '–'}</dd>
      </dl>
    </section>

    <section class="card">
      <h3>Hoogtepunten</h3>
      <dl class="facts">
        <dt>Hoogste reeks</dt><dd>${highest ? esc(highest.division) : esc(DIVISIONS[s.league.divisionLevel].name)}</dd>
        <dt>Beste eindplaats</dt><dd>${best ? `${best.position}e (${seasonLabel(s.startYear, best.season)})` : '–'}</dd>
        <dt>Premies verdiend</dt><dd>${prizeTotal ? euro(prizeTotal) : '–'}</dd>
        <dt>Aartsrivaal</dt><dd>${rival ? esc(rival.name) : '–'}</dd>
        <dt>Onderling tegen hem</dt><dd>${derbyTotal ? `${s.derbyRecord.won}W ${s.derbyRecord.drawn}G ${s.derbyRecord.lost}V` : 'nog niet gespeeld'}</dd>
        <dt>Jeugdploegen nu</dt><dd>${s.community.youthTeams}</dd>
      </dl>
    </section>

    <section class="card">
      <h3>De mensen</h3>
      <dl class="facts">
        <dt>Sterkste speler</dt><dd>${bestPlayer ? `${esc(bestPlayer.name)} (${overall(bestPlayer)})` : '–'}</dd>
        <dt>Meeste basisplaatsen dit seizoen</dt><dd>${veteran && veteran.starts ? `${esc(veteran.name)} (${veteran.starts})` : '–'}</dd>
        <dt>Duurste aankoop in de kern</dt><dd>${priciest && priciest.purchasePrice ? `${esc(priciest.name)} — ${euro(priciest.purchasePrice)}` : 'nog niemand gekocht'}</dd>
        <dt>Eigen jeugd in de A-kern</dt><dd>${s.players.filter((p) => p.isYouth).length} van ${s.players.length}</dd>
        <dt>Trainer</dt><dd>${esc(s.staff.find((x) => x.role === 'hoofdtrainer')?.name ?? '–')}</dd>
      </dl>
    </section>

    <section class="card full">
      <h3>Gemiddelde opkomst per seizoen</h3>
      ${fanHistory.length > 1 ? sparkline(fanHistory) : '<p class="muted small">Na je eerste seizoen zie je hier de lijn lopen.</p>'}
    </section>

    <section class="card full">
      <h3>Erelijst per seizoen</h3>
      ${
        s.history.length
          ? `<div class="table-wrap"><table class="compact">
              <thead><tr><th>Seizoen</th><th>Reeks</th><th class="num">Plaats</th><th class="num">Ptn</th><th>Resultaat</th><th class="num">Premie</th><th class="num">Financieel</th></tr></thead>
              <tbody>${s.history
                .map(
                  (h) => `<tr class="${h.result === 'kampioen' ? 'up' : h.result === 'degradatie' ? 'down' : ''}">
                    <td>${seasonLabel(s.startYear, h.season)}</td><td>${esc(h.division)}</td><td class="num">${h.position}</td><td class="num">${h.points}</td>
                    <td>${h.result === 'kampioen' ? '🏆 kampioen' : h.result === 'promotie' ? '⬆️ promotie' : h.result === 'degradatie' ? '⬇️ degradatie' : 'behoud'}</td>
                    <td class="num">${h.prize ? euro(h.prize) : '–'}</td><td class="num">${signedEuro(h.profit)}</td>
                  </tr>`,
                )
                .join('')}</tbody>
            </table></div>`
          : '<p class="muted">Nog geen afgewerkt seizoen. Speel er een uit, dan hangt hier je eerste lijn.</p>'
      }
    </section>

    <section class="card full">
      <h3>Mijlpalen</h3>
      <ul class="milestone-wall">
        ${MILESTONES.map((m) => {
          const done = s.milestones.includes(m.label);
          return `<li class="${done ? 'done' : 'todo'}"><span class="icon">${done ? '🏅' : '🔒'}</span>
            <span><strong>${esc(m.label)}</strong><br/><span class="muted small">${done ? 'behaald' : esc(m.detail)}</span></span></li>`;
        }).join('')}
      </ul>
    </section>
  </div>`;
}
