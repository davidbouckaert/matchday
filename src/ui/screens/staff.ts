import { courseButton } from '../coursebutton';
import { recentReasoning } from '../../engine/reasoning';
import type { GameState, Staff } from '../../engine/types';
import { COURSES, STAFF_ROLES, TASKS, roleDef } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { hasDiploma } from '../../engine/staff';
import { staffLock } from '../../engine/actions';
import { delegate, taskCapacity, taskEfficiency, taskSkill, taskStars, tasksOf } from '../../engine/delegation';
import { esc, euro, bar, stars } from '../format';
import { impactChips } from '../impact';
import { staffImpact } from '../../engine/impact';
import { hint, tip, tipAttr } from '../tooltip';

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
                <span><strong>${esc(t.label)}</strong> <span class="fit-stars" ${tipAttr(
                  `${taskStars(s, t.id, m)} van de 5 sterren voor deze taak. Daarmee haalt hij er ${Math.round(
                    taskEfficiency(s, t.id, m) * 100,
                  )}% uit van wat er maximaal uit te halen valt. Sterren hangen af van zijn vaardigheid, of de taak bij zijn functie past en hoeveel taken hij al heeft. De laatste 15% haalt niemand: die is er alleen voor jou.`,
                  'Wat hij eruit haalt',
                )}>${stars(fitStars(s, t.id, m))} <span class="eff">${Math.round(taskEfficiency(s, t.id, m) * 100)}%</span></span>${current && !mine ? ` <span class="tag">nu bij ${esc(current.name)}</span>` : ''}<br/>
                <span class="muted small">${esc(mine ? t.delegated : `Zelf: ${t.owner} Overlaten: ${t.delegated}`)}</span></span></label>
              </li>`;
            })
            .join('')}</ul>`
        : '<p class="muted small">Deze functie neemt geen beslissingen van je over; het effect is automatisch.</p>'
    }
    <h3>Opleiding</h3>
    <div class="btn-row">
      ${course && !m.courseWeeksLeft ? `<button class="sm" data-action="course" data-id="${m.id}">Diploma ${course.to} (${euro(course.cost)}, ${course.weeks} weken)</button>` : ''}
      ${courseButton(s, m)}
      <button class="sm ghost" data-action="fire" data-id="${m.id}">Ontslaan (${euro(m.wage * 8)})</button>
    </div>
  </section>`;
}

/** Geschiktheid van 1 tot 5 sterren: vaardigheid, hoe goed de taak bij zijn functie past en zijn werklast. */
function fitStars(s: GameState, taskId: Parameters<typeof taskSkill>[1], m: Staff): number {
  // dezelfde sterren als de engine gebruikt om zijn efficiëntie te bepalen
  return taskStars(s, taskId, m);
}

/**
 * Wat je personeel heeft uitgerekend, en wat er veranderde.
 *
 * Zonder dit zie je alleen het resultaat: er wordt vier keer getraind. Niet waarom, en niet
 * dat het vorige week nog drie was omdat je intussen een kinesist in dienst hebt. Hier staat
 * elke beslissing met de stappen erachter, uit dezelfde functies die daarna het werk doen.
 */
function brainCard(s: GameState): string {
  const regels = recentReasoning(s, 12);
  if (!regels.length) {
    return `<section class="card">
      <h2>Wat je personeel besliste</h2>
      <p class="muted small">Zodra je een taak uitbesteedt, staat hier elke week wat die persoon heeft uitgerekend en waarom. Speel een week om de eerste regels te zien.</p>
    </section>`;
  }
  const items = regels
    .map(
      (e) => `<details class="brain"${e.changed ? ' open' : ''}>
        <summary>
          <span class="brain-when">${e.season}-${String(e.week).padStart(2, '0')}</span>
          <strong>${esc(e.subject)}</strong>
          <span class="brain-uitkomst ${e.changed ? 'changed' : ''}">${e.changed && e.from !== null ? `${esc(e.from)} → ${esc(e.to)}` : esc(e.to)}</span>
          <span class="muted small">${esc(e.staff)} · ${Math.round(e.efficiency * 100)}%</span>
        </summary>
        <ol class="brain-steps">${e.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>
      </details>`,
    )
    .join('');
  return `<section class="card">
    <h2>Wat je personeel besliste ${hint('Elke week rekent je personeel opnieuw. Verandert er iets aan je club — een kinesist erbij, een betere kantine, iemand die een ster hoger komt — dan verandert hun keuze mee. Een regel die openstaat, is een keuze die deze week veranderd is.')}</h2>
    <p class="muted small">De stappen komen uit dezelfde berekening die daarna ook echt uitgevoerd wordt. Wil je live meekijken terwijl je speelt, zet dan <code>vcgDebug = true</code> in de console van je browser.</p>
    ${items}
  </section>`;
}

export function staffScreen(s: GameState, selected: string | null): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const member = selected ? s.staff.find((x) => x.id === selected) : undefined;

  const current = STAFF_ROLES.map((def) => {
    const m = s.staff.find((x) => x.role === def.role);
    if (!m) {
      return `<tr class="empty"><td><strong>${def.label}</strong><br/><span class="muted small">${esc(def.effect)}</span></td><td colspan="5" class="muted">Niet ingevuld</td></tr>`;
    }
    const tasks = tasksOf(s, m.id).map((id) => TASKS.find((t) => t.id === id)!.label);
    return `<tr class="clickable ${member?.id === m.id ? 'selected' : ''}" data-action="staff-open" data-id="${m.id}">
      <td><strong>${def.label}</strong><br/><span class="muted small">${esc(def.effect)}</span></td>
      <td><strong class="link">${esc(m.name)}</strong><br/><span class="muted small">${m.trait}</span></td>
      <td>${bar(m.skill)} ${m.skill}${m.courseWeeksLeft ? ' 📚' : ''}</td>
      <td>${hasDiploma(m.role) ? m.diploma : '—'}</td>
      <td>${euro(m.wage)}</td>
      <td>${impactChips(staffImpact(s, m.role, m.skill, null))}</td>
      <td class="small">${tasks.length ? tasks.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') : '<span class="muted">geen</span>'}
        <br/><span class="muted small">${tasks.length}/${taskCapacity(m)} taken</span></td>
    </tr>`;
  }).join('');

  const overview = TASKS.map((t) => {
    const who = delegate(s, t.id);
    const able = s.staff.filter((m) => t.roles.includes(m.role));
    const option = (m: (typeof able)[number]) => {
      const busy = tasksOf(s, m.id).filter((x) => x !== t.id).length;
      const full = busy >= taskCapacity(m) && who?.id !== m.id;
      const fit = fitStars(s, t.id, m);
      return `<option value="${m.id}" ${who?.id === m.id ? 'selected' : ''} ${full ? 'disabled' : ''}>${esc(m.name)} ${'★'.repeat(fit)}${'☆'.repeat(5 - fit)}${
        t.roles.indexOf(m.role) === 0 ? ' · vakgebied' : ''
      }${full ? ` · vol (${busy}/${taskCapacity(m)})` : ''}</option>`;
    };
    const picker = able.length
      ? `<select data-change="delegate-task" data-id="${t.id}" aria-label="Wie doet ${esc(t.label)}?">
          <option value="">Jij</option>
          ${able.map(option).join('')}
        </select>${
          who && t.roles.indexOf(who.role) > 0
            ? `<br/><span class="muted small" ${tip('Buiten zijn vakgebied mist hij kennis: hij beslist met een lager niveau en maakt vaker een verkeerde keuze.')}>⚠️ niet zijn vakgebied (${Math.round(
                taskSkill(s, t.id, who),
              )} in plaats van ${who.skill})</span>`
            : ''
        }`
      : `<span class="muted small">niemand in dienst die dit kan: ${t.roles.map((r) => roleDef(r).label).join(', ')}</span>`;
    return `<tr class="${who ? '' : 'own-task'}"><td><strong>${esc(t.label)}</strong><br/><span class="muted small">vakgebied: ${roleDef(t.roles[0]).label}</span></td>
      <td>${picker}</td>
      <td class="small muted">${esc(who ? t.delegated : t.owner)}</td></tr>`;
  }).join('');

  const candidates = s.staffMarket
    .map(
      (c) => `<tr>
      <td data-v="${STAFF_ROLES.findIndex((r) => r.role === c.role)}">${roleDef(c.role).label}</td>
      <td>${esc(c.name)}<br/><span class="muted small">${c.trait}</span></td>
      <td data-v="${c.skill}">${bar(c.skill)} ${c.skill}</td>
      <td>${hasDiploma(c.role) ? c.diploma : '—'}</td>
      <td>${impactChips(staffImpact(s, c.role, c.skill))}</td>
      <td data-v="${c.wage}">${euro(c.wage)}</td>
      <td>${
        staffLock(s, c.role)
          ? `<span class="muted small" data-tip="${esc(staffLock(s, c.role)!)}">🔒 nog niet mogelijk</span>`
          : `<button class="sm primary" data-action="hire" data-id="${c.id}">Aanwerven (tekengeld ${euro(c.wage * 2)})</button>`
      }</td>
    </tr>`,
    )
    .join('');

  return `
  ${member ? detailCard(s, member) : ''}
  <section class="card">
    <h2>Jouw personeel</h2>
    <p class="muted small">Klik op een personeelslid om taken aan te vinken die hij van je overneemt, of om hem een opleiding te geven.
    Licentie voor ${division.name}: hoofdtrainer met minstens <strong>${division.requiredDiploma}</strong> en een ploegafgevaardigde (audit in week 38).</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Functie</th><th>Naam</th><th>Vaardigheid</th><th>Diploma</th><th data-tip="Wat hij je elke week kost">Loon per week</th><th>Wat hij oplevert</th><th>Taken</th></tr></thead>
      <tbody>${current}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Wie doet wat? ${hint('Kies per taak wie ze doet: jij, of iemand van je personeel.')}</h2>
    <p class="muted small">Staat er "Jij", dan beslis je het zelf op het scherm waar die taak thuishoort. Geef je ze uit handen, dan beslist die persoon elke week automatisch — en hoe beter hij is, hoe minder hij ernaast zit. Terugnemen kan altijd.</p>
    <p class="muted small">Je hebt ${TASKS.filter((t) => delegate(s, t.id)).length} van de ${TASKS.length} taken uitbesteed.
    Iemand kan 1 tot 4 taken aan, afhankelijk van zijn vaardigheid, en werkt buiten zijn vakgebied op een lager niveau.
    Staat er "niemand in dienst die dit kan", werf dan eerst zo iemand aan bij de kandidaten hieronder.</p>
    <div class="table-wrap"><table class="compact">
      <thead><tr><th>Taak</th><th>Wie doet het?</th><th>Wat gebeurt er</th></tr></thead>
      <tbody>${overview}</tbody>
    </table></div>
  </section>
  ${brainCard(s)}
  <section class="card">
    <h2>Kandidaten</h2>
    <p class="muted small">De lijst vernieuwt elke 4 weken. Je hebt maximaal één persoon per functie.
      "Wat het je oplevert" is het verschil met wie je nu op die plaats hebt — doorgerekend met dezelfde formules waarmee het spel rekent. Beweeg over een kaartje voor het volledige verhaal.</p>
    <div class="table-wrap"><table data-sort-id="kandidaten">
      <thead><tr><th>Functie</th><th>Naam</th><th>Vaardigheid</th><th>Diploma</th><th data-nosort>Wat het je oplevert</th><th data-tip="Wat hij je elke week kost">Loon per week</th><th data-nosort></th></tr></thead>
      <tbody>${candidates}</tbody>
    </table></div>
  </section>`;
}
