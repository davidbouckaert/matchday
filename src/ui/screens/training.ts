import type { GameState } from '../../engine/types';
import { BIJSCHOLING, COURSES, STAFF_ROLES } from '../../engine/data/catalog';
import { DIVISIONS, DIPLOMA_ORDER, diplomaRank } from '../../engine/data/divisions';
import { hasDiploma } from '../../engine/staff';
import { bar, esc, euro } from '../format';

/** Tab Opleiding: personeel bijscholen en trainersdiploma's halen. */
export function trainingScreen(s: GameState): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const next = DIVISIONS[Math.min(DIVISIONS.length - 1, s.league.divisionLevel + 1)];
  const spent = -(s.seasonTotals.opleidingen ?? 0);
  const running = s.staff.filter((m) => m.courseWeeksLeft > 0);

  const rows = STAFF_ROLES.map((def) => {
    const m = s.staff.find((x) => x.role === def.role);
    if (!m) return '';
    const course = hasDiploma(m.role) ? COURSES.find((c) => c.from === m.diploma) : undefined;
    const busy = m.courseWeeksLeft > 0;
    const licence =
      m.role === 'hoofdtrainer'
        ? diplomaRank(m.diploma) >= diplomaRank(division.requiredDiploma)
          ? diplomaRank(m.diploma) >= diplomaRank(next.requiredDiploma)
            ? '<span class="pos small">ok, ook voor de volgende reeks</span>'
            : `<span class="small">ok nu; ${next.name} vraagt ${next.requiredDiploma}</span>`
          : `<span class="neg small">te laag voor de licentie (${division.requiredDiploma})</span>`
        : '';
    return `<tr>
      <td><strong>${esc(m.name)}</strong><br/><span class="muted small">${def.label}</span></td>
      <td data-v="${m.skill}">${bar(m.skill)} ${m.skill}</td>
      <td>${hasDiploma(m.role) ? `${m.diploma}<br/>${licence}` : '—'}</td>
      <td>${busy ? `📚 ${m.courseType === 'bijscholing' ? 'bijscholing' : 'diploma'}: nog ${m.courseWeeksLeft} weken` : '<span class="muted">beschikbaar</span>'}</td>
      <td class="btns">
        ${course && !busy ? `<button class="sm primary" data-action="course" data-id="${m.id}">${course.to}: ${euro(course.cost)}, ${course.weeks} weken</button>` : ''}
        ${!busy && m.skill < BIJSCHOLING.cap ? `<button class="sm" data-action="bijscholing" data-id="${m.id}">Bijscholing +${BIJSCHOLING.gain[0]}–${BIJSCHOLING.gain[1]}: ${euro(BIJSCHOLING.cost(m.skill))}, ${BIJSCHOLING.weeks} weken</button>` : ''}
        ${!busy && m.skill >= BIJSCHOLING.cap && !course ? '<span class="muted small">volledig opgeleid</span>' : ''}
      </td>
    </tr>`;
  }).join('');

  return `
  <section class="card">
    <h2>Opleiding van je personeel</h2>
    <p class="muted small">Tijdens een opleiding werkt een personeelslid op 60% van zijn kunnen. Ambitieuze en perfectionistische personeelsleden vragen na een diploma meteen opslag.
    Dit seizoen al uitgegeven aan opleidingen: <strong>${euro(spent)}</strong>. Nu in opleiding: ${running.length ? running.map((m) => esc(m.name)).join(', ') : 'niemand'}.</p>
    <div class="table-wrap"><table data-sort-id="opleiding">
      <thead><tr><th>Staflid</th><th>Vaardigheid</th><th>Diploma</th><th>Status</th><th data-nosort>Opleidingen</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted">Nog geen personeel in dienst.</td></tr>'}</tbody>
    </table></div>
  </section>
  <div class="grid">
    <section class="card">
      <h2>Trainersdiploma's</h2>
      <p class="muted small">Voor de hoofdtrainer en de assistent-trainer. Elk diploma geeft +4 vaardigheid en is nodig voor de licentie in hogere reeksen.</p>
      <table class="compact"><thead><tr><th>Van</th><th>Naar</th><th class="num">Kost</th><th class="num">Duur</th></tr></thead><tbody>
        ${COURSES.map((c) => `<tr><td>${c.from}</td><td>${c.to}</td><td class="num">${euro(c.cost)}</td><td class="num">${c.weeks} weken</td></tr>`).join('')}
      </tbody></table>
      <p class="muted small">Licentievereiste per reeks: ${DIVISIONS.map((d) => `${d.name}: ${d.requiredDiploma}`).join(' · ')}. Volgorde: ${DIPLOMA_ORDER.join(' → ')}.</p>
    </section>
    <section class="card">
      <h2>Bijscholing</h2>
      <p class="muted small">Voor elk personeelslid: ${BIJSCHOLING.weeks} weken, +${BIJSCHOLING.gain[0]} tot +${BIJSCHOLING.gain[1]} vaardigheid, tot maximaal ${BIJSCHOLING.cap}.
      Kost €800 + €20 per vaardigheidspunt (hoe beter iemand al is, hoe duurder).</p>
      <p class="muted small">Het jeugdopleidingscentrum (voor spelers) vind je bij Infrastructuur.</p>
    </section>
  </div>`;
}
