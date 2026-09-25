import { courseButton } from '../coursebutton';
import type { GameState, Staff, StaffRole } from '../../engine/types';
import { COURSES, STAFF_ROLES, TASKS, roleDef } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { hasDiploma, staffPayoff, staffSigningFee } from '../../engine/staff';
import { staffComparison } from '../staff-comparison';
import { delegate, taskCapacity, taskEfficiency, taskSkill, taskStars, tasksOf } from '../../engine/delegation';
import { esc, euro, stars } from '../format';
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
    <p>${impactChips(staffImpact(s, m.role, m.skill, null))}</p>
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
      <button class="sm ghost danger" data-action="fire" data-id="${m.id}" data-confirm="${esc(m.name)} ontslaan?" ${tipAttr(`Ingrijpend: hij vertrekt meteen, je betaalt ${euro(staffPayoff(m))} opzegvergoeding (acht weken loon) en al zijn taken vallen terug naar jou.`)}>Ontslaan (${euro(staffPayoff(m))})</button>
    </div>
  </section>`;
}

/** Geschiktheid van 1 tot 5 sterren: vaardigheid, hoe goed de taak bij zijn functie past en zijn werklast. */
function fitStars(s: GameState, taskId: Parameters<typeof taskSkill>[1], m: Staff): number {
  // dezelfde sterren als de engine gebruikt om zijn efficiëntie te bepalen
  return taskStars(s, taskId, m);
}

/** Rollen geven context; kandidaten krijgen de ruimte om gevolgen en kosten te vergelijken. */
export function staffScreen(s: GameState, selected: string | null, filter: StaffRole | null = null): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const member = selected ? s.staff.find((x) => x.id === selected) : undefined;
  const currentMember = filter ? s.staff.find((m) => m.role === filter) : undefined;
  const roleBtn = (role: StaffRole, label: string, body: string) =>
    `<button class="staff-role" data-action="staff-filter" data-id="${role}" aria-pressed="${filter === role}">
      <strong>${esc(label)}${filter === role ? ' · geselecteerd' : ''}</strong><span>${body}</span></button>`;
  const current = STAFF_ROLES.map((def) => {
    const m = s.staff.find((x) => x.role === def.role);
    return `<li>${roleBtn(def.role, def.label, m
      ? `${esc(m.name)}<small>Vaardigheid ${m.skill}${hasDiploma(m.role) ? ` · ${m.diploma}` : ''} · ${euro(m.wage)}/week<br/>${tasksOf(s, m.id).length}/${taskCapacity(m)} taken${m.courseWeeksLeft ? ' · in opleiding' : ''}</small>`
      : 'Vacature')}${m ? `<button class="link-btn staff-person" data-action="staff-open" data-id="${m.id}" aria-expanded="${member?.id === m.id}" aria-label="Taken en opleiding van ${esc(m.name)}">Taken en opleiding</button>` : ''}</li>`;
  }).join('');
  const context = currentMember
    ? `<strong>Nu: ${esc(currentMember.name)}</strong> · vaardigheid ${currentMember.skill}${hasDiploma(currentMember.role) ? ` · ${currentMember.diploma}` : ''} · ${euro(currentMember.wage)}/week · ${tasksOf(s, currentMember.id).length}/${taskCapacity(currentMember)} taken
      <button class="link-btn" data-action="staff-open" data-id="${currentMember.id}">Taken en opleiding</button>`
    : filter ? '<strong>Vacature</strong> · Deze functie is nog niet ingevuld.' : 'Per kandidaat zie je wie hij vervangt, of dat de functie nog vrij is.';

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

  // Zonder filter: de beste kandidaat per functie — dertien rijen overzicht in plaats van
  // eenendertig rijen lijst. Wie een functie aanklikt (links of in de rij zelf), krijgt
  // de volledige lichting voor die rol.
  const bestePerFunctie = STAFF_ROLES.map((def) =>
    s.staffMarket.filter((c) => c.role === def.role).sort((a, b) => b.skill - a.skill)[0],
  ).filter((c): c is NonNullable<typeof c> => !!c);
  const markt = filter ? s.staffMarket.filter((c) => c.role === filter) : bestePerFunctie;
  const candidates = markt.map((c) => {
    const comparison = staffComparison(s, c);
    const impacts = staffImpact(s, c.role, c.skill);
    const { current: incumbent, cost, weeklyDelta, reason, taken, returned } = comparison;
    const names = (ids: typeof taken) => ids.map((id) => TASKS.find((t) => t.id === id)!.label).join(', ');
    const handover = reason ? 'Deze kandidaat kan nu niet aangeworven worden; er veranderen geen taken.' : incumbent
      ? `${taken.length ? `Gaan mee: ${names(taken)}.` : 'Geen taken gaan mee.'}${returned.length ? ` Terug naar jou: ${names(returned)}.` : ''}`
      : 'Taken toewijzen doe je hieronder bij Wie doet wat?.';
    const costs = `${euro(cost)} totaal nu: ${euro(staffSigningFee(c))} tekengeld${incumbent ? ` + ${euro(staffPayoff(incumbent))} opzegvergoeding` : ''}. Loon: ${euro(c.wage)} per week (${weeklyDelta > 0 ? '+' : ''}${euro(weeklyDelta)} verschil).`;
    const confirmation = `${costs} ${handover}${incumbent?.role === 'hoofdtrainer' ? ' Het ontslag van de hoofdtrainer verlaagt de moraal van je spelers.' : ''}`;
    return `<tr>
      <td><strong>${esc(c.name)}</strong><button class="tablet-inspect" data-action="workflow-open" data-id="staff:${c.id}" aria-label="Vergelijk ${esc(c.name)}">Vergelijken</button><span class="staff-meta">${esc(c.trait)}${hasDiploma(c.role) ? ` · ${c.diploma}` : ''}</span>
        ${!filter ? `<button class="link-btn" data-action="staff-filter" data-id="${c.role}">${roleDef(c.role).label}</button>` : ''}
        <span class="staff-meta">${incumbent ? `Nu: ${esc(incumbent.name)} · ${incumbent.skill} · ${euro(incumbent.wage)}/week` : 'Vacature'}</span></td>
      <td data-v="${c.skill}"><strong>${c.skill}</strong><span class="staff-meta">${incumbent ? `${c.skill - incumbent.skill > 0 ? '+' : ''}${c.skill - incumbent.skill} verschil` : 'op 100'}<br/>${taskCapacity(c)} ${taskCapacity(c) === 1 ? 'taak' : 'taken'}</span></td>
      <td>${impactChips(impacts)}<details class="staff-explanation"><summary>Effect en taken</summary><p>${esc(roleDef(c.role).effect)}</p><p>${esc(handover)}</p>${impacts.map((i) => `<p>${esc(i.label)}: ${esc(i.tip)}</p>`).join('')}</details></td>
      <td data-v="${c.wage}" class="staff-cost"><strong>${euro(c.wage)}/week</strong><span class="staff-meta">${weeklyDelta > 0 ? '+' : ''}${euro(weeklyDelta)} verschil</span><strong>${euro(cost)} nu</strong><span class="staff-meta">${euro(staffSigningFee(c))} tekengeld${incumbent ? `<br/>${euro(staffPayoff(incumbent))} opzeg` : ''}</span></td>
      <td class="staff-decision"><button class="sm ${incumbent ? '' : 'primary'}" data-action="${incumbent ? 'hire-replace' : 'hire'}" data-id="${c.id}" aria-label="${incumbent ? `Vervang ${esc(incumbent.name)} door ${esc(c.name)}` : `${esc(c.name)} aanwerven`}" ${incumbent ? `data-confirm="${esc(incumbent.name)} vervangen door ${esc(c.name)}?" ${tipAttr(confirmation)}` : ''} ${reason ? `disabled aria-describedby="staff-reason-${c.id}"` : ''}>${incumbent ? `Vervang ${esc(incumbent.name.split(' ')[0])}` : 'Aanwerven'}</button>${reason ? `<details class="staff-explanation"><summary>Niet beschikbaar: uitleg</summary><p id="staff-reason-${c.id}">${esc(reason)}</p></details>` : ''}</td>
    </tr>`;
  }).join('');

  return `<div class="staff-screen">
  ${member ? detailCard(s, member) : ''}
  <div class="staff-layout">
    <aside class="card staff-roster">
      <h2>Jouw personeel</h2>
      <p class="muted small">Kies een functie om kandidaten te vergelijken.</p>
      <details class="staff-role-list" open><summary>Functies en bezetting${filter ? ` · ${roleDef(filter).label}` : ''}</summary>
        <ul>${current}</ul>
      </details>
    </aside>
    <section class="card staff-market" data-tour-doel="kandidaten">
      <label class="staff-mobile-picker">Functie vergelijken
        <select data-change="staff-role" aria-label="Functie vergelijken"><option value="">Alle functies</option>${STAFF_ROLES.map((def) => `<option value="${def.role}" ${filter === def.role ? 'selected' : ''}>${def.label}${s.staff.some((m) => m.role === def.role) ? '' : ' · vacature'}</option>`).join('')}</select>
      </label>
      <div class="staff-heading"><h2>${filter ? roleDef(filter).label : 'Kandidaten'} <span class="tag">${markt.length} kandidaten</span></h2>
        ${filter ? `<button class="sm ghost" data-action="staff-filter" data-id="${filter}">Alle functies</button>` : ''}</div>
      <p id="staff-context" class="staff-context" tabindex="-1">${context}</p>
      <p class="muted small">${filter ? 'Alle kandidaten voor deze functie.' : 'De beste kandidaat per functie. Kies een functie voor de volledige lichting.'} Nieuwe lichting elke 4 weken. Effecten en niveau van de kandidaat; open Effect en taken voor de vergelijking met je bezetting.</p>
      <div class="table-wrap"><table class="compact staff-candidates" data-sort-id="kandidaten" data-accessible-sort>
        <caption class="sr-only">Kandidaten vergelijken met je huidige personeel</caption>
        <thead><tr><th scope="col">Kandidaat</th><th scope="col" aria-label="Vaardigheid">Niveau</th><th scope="col" data-nosort>Wat verandert</th><th scope="col">Loon en kosten</th><th scope="col" data-nosort>Beslissing</th></tr></thead>
        <tbody>${candidates || '<tr><td colspan="5" class="muted">Geen kandidaten voor deze functie in deze lichting. Kies Alle functies of wacht op de volgende lichting.</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">Licentie ${division.name}: hoofdtrainer met minstens ${division.requiredDiploma} en een ploegafgevaardigde. Audit in week 38.</p>
    </section>
  </div>
  <section class="card" data-tour-doel="taken">
    <h2>Wie doet wat? ${hint('Kies per taak wie ze doet: jij, of iemand van je personeel.')}</h2>
    <p class="muted small">Staat er "Jij", dan beslis je het zelf op het scherm waar die taak thuishoort. Geef je ze uit handen, dan beslist die persoon elke week automatisch — en hoe beter hij is, hoe minder hij ernaast zit. Terugnemen kan altijd.
    Je hebt ${TASKS.filter((t) => delegate(s, t.id)).length} van de ${TASKS.length} taken uitbesteed. Hoeveel taken iemand aankan, hangt af van zijn vaardigheid. Buiten zijn vakgebied werkt hij op een lager niveau.</p>
    <div class="table-wrap"><table class="compact">
      <thead><tr><th>Taak</th><th>Wie doet het?</th><th>Wat gebeurt er</th></tr></thead>
      <tbody>${overview}</tbody>
    </table></div>
  </section></div>`;
}
