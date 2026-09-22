import type { GameState, Staff } from '../../engine/types';
import { BIJSCHOLING, COURSES, STAFF_ROLES, TASKS, roleDef } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { hasDiploma } from '../../engine/staff';
import { staffLock } from '../../engine/actions';
import { delegate, tasksOf } from '../../engine/delegation';
import { esc, euro, bar } from '../format';

function detailCard(s: GameState, m: Staff): string {
  const def = roleDef(m.role);
  const course = hasDiploma(m.role) ? COURSES.find((c) => c.from === m.diploma) : undefined;
  const tasks = TASKS.filter((t) => t.roles.includes(m.role));
  return `<section class="card detail">
    <div class="detail-head">
      <div><h2>${esc(m.name)}</h2><span class="muted">${def.label} · ${m.trait} · vaardigheid ${m.skill} · ${euro(m.wage)}/week${hasDiploma(m.role) ? ` · ${m.diploma}` : ''}</span></div>
      <button class="sm ghost" data-action="staff-open" data-id="${m.id}">Sluiten ✕</button>
    </div>
    <p class="small">${esc(def.effect)}</p>
    ${m.courseWeeksLeft ? `<p class="attention-inline small">📚 Volgt ${m.courseType === 'bijscholing' ? 'bijscholing' : 'een diplomaopleiding'}: nog ${m.courseWeeksLeft} weken (werkt intussen op 60%).</p>` : ''}
    <h3>Taken die ${esc(m.name.split(' ')[0])} van je overneemt</h3>
    ${
      tasks.length
        ? `<ul class="tasks">${tasks
            .map((t) => {
              const current = delegate(s, t.id);
              const mine = current?.id === m.id;
              return `<li>
                <label class="check"><input type="checkbox" data-action="delegate" data-id="${t.id}|${m.id}" ${mine ? 'checked' : ''}/>
                <span><strong>${esc(t.label)}</strong>${current && !mine ? ` <span class="tag">nu bij ${esc(current.name)}</span>` : ''}<br/>
                <span class="muted small">${esc(mine ? t.delegated : `Zelf: ${t.owner} Overlaten: ${t.delegated}`)}</span></span></label>
              </li>`;
            })
            .join('')}</ul>`
        : '<p class="muted small">Deze functie neemt geen beslissingen van je over; het effect is automatisch.</p>'
    }
    <h3>Opleiding</h3>
    <div class="btn-row">
      ${course && !m.courseWeeksLeft ? `<button class="sm" data-action="course" data-id="${m.id}">Diploma ${course.to} (${euro(course.cost)}, ${course.weeks} weken)</button>` : ''}
      ${!m.courseWeeksLeft && m.skill < BIJSCHOLING.cap ? `<button class="sm" data-action="bijscholing" data-id="${m.id}">Bijscholing +${BIJSCHOLING.gain[0]}-${BIJSCHOLING.gain[1]} (${euro(BIJSCHOLING.cost(m.skill))}, ${BIJSCHOLING.weeks} weken)</button>` : ''}
      <button class="sm ghost" data-action="fire" data-id="${m.id}">Ontslaan (${euro(m.wage * 8)})</button>
    </div>
  </section>`;
}

export function staffScreen(s: GameState, selected: string | null): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const member = selected ? s.staff.find((x) => x.id === selected) : undefined;

  const current = STAFF_ROLES.map((def) => {
    const m = s.staff.find((x) => x.role === def.role);
    if (!m) {
      return `<tr class="empty"><td><strong>${def.label}</strong><br/><span class="muted small">${esc(def.effect)}</span></td><td colspan="5" class="muted">Vacant</td></tr>`;
    }
    const tasks = tasksOf(s, m.id).map((id) => TASKS.find((t) => t.id === id)!.label);
    return `<tr class="clickable ${member?.id === m.id ? 'selected' : ''}" data-action="staff-open" data-id="${m.id}">
      <td><strong>${def.label}</strong><br/><span class="muted small">${esc(def.effect)}</span></td>
      <td><strong class="link">${esc(m.name)}</strong><br/><span class="muted small">${m.trait}</span></td>
      <td>${bar(m.skill)} ${m.skill}${m.courseWeeksLeft ? ' 📚' : ''}</td>
      <td>${hasDiploma(m.role) ? m.diploma : '—'}</td>
      <td>${euro(m.wage)}</td>
      <td class="small">${tasks.length ? tasks.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') : '<span class="muted">geen</span>'}</td>
    </tr>`;
  }).join('');

  const overview = TASKS.map((t) => {
    const who = delegate(s, t.id);
    return `<tr><td>${esc(t.label)}</td><td>${who ? `${esc(who.name)} <span class="muted small">(${roleDef(who.role).label})</span>` : '<strong>Jij</strong>'}</td>
      <td class="small muted">${esc(who ? t.delegated : t.owner)}</td>
      <td>${who ? `<button class="sm" data-action="undelegate" data-id="${t.id}">Zelf doen</button>` : `<span class="muted small">kan naar: ${t.roles.map((r) => roleDef(r).label).join(', ')}</span>`}</td></tr>`;
  }).join('');

  const candidates = s.staffMarket
    .map(
      (c) => `<tr>
      <td data-v="${STAFF_ROLES.findIndex((r) => r.role === c.role)}">${roleDef(c.role).label}</td>
      <td>${esc(c.name)}<br/><span class="muted small">${c.trait}</span></td>
      <td data-v="${c.skill}">${bar(c.skill)} ${c.skill}</td>
      <td>${hasDiploma(c.role) ? c.diploma : '—'}<br/><span class="muted small">${esc(roleDef(c.role).effect)}</span></td>
      <td data-v="${c.wage}">${euro(c.wage)}</td>
      <td>${
        staffLock(s, c.role)
          ? `<span class="muted small" title="${esc(staffLock(s, c.role)!)}">🔒 nog niet mogelijk</span>`
          : `<button class="sm primary" data-action="hire" data-id="${c.id}">Aanwerven (tekengeld ${euro(c.wage * 2)})</button>`
      }</td>
    </tr>`,
    )
    .join('');

  return `
  ${member ? detailCard(s, member) : ''}
  <section class="card">
    <h2>Jouw staff</h2>
    <p class="muted small">Klik op een staflid om taken aan te vinken die hij van je overneemt, of om hem een opleiding te geven.
    Licentie voor ${division.name}: hoofdtrainer met minstens <strong>${division.requiredDiploma}</strong> en een ploegafgevaardigde (audit in week 38).</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Functie</th><th>Naam</th><th>Vaardigheid</th><th>Diploma</th><th>Loon/w</th><th>Taken</th></tr></thead>
      <tbody>${current}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Wie doet wat?</h2>
    <div class="table-wrap"><table class="compact">
      <thead><tr><th>Taak</th><th>Uitvoerder</th><th>Wat gebeurt er</th><th></th></tr></thead>
      <tbody>${overview}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Kandidaten</h2>
    <p class="muted small">De lijst vernieuwt elke 4 weken. Je hebt maximaal één persoon per functie.</p>
    <div class="table-wrap"><table data-sort-id="kandidaten">
      <thead><tr><th>Functie</th><th>Naam</th><th>Vaardigheid</th><th>Diploma</th><th>Loon/w</th><th data-nosort></th></tr></thead>
      <tbody>${candidates}</tbody>
    </table></div>
  </section>`;
}
