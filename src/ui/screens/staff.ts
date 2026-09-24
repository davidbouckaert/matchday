import { courseButton } from '../coursebutton';
import type { GameState, Staff, StaffRole } from '../../engine/types';
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
 * Het scherm in de volgorde waarin je werkt, met twee tabellen naast elkaar.
 *
 * Het stond onder elkaar — wie heb je, wie doet wat, wie kun je halen — en dat was
 * vijfduizend pixels scrollen. Maar "wie heb je" en "wie kun je halen" zijn één
 * gedachte: je kijkt naar een lege of zwakke functie en wilt meteen zien wie er voor
 * die plek te vinden is. Die twee staan nu naast elkaar, en de functienaam links is
 * een filter op de kandidaten rechts: klik op "Kinesist" en je ziet alleen kinesisten,
 * met een duidelijk kruisje om de filter weer weg te halen (of klik de functie nog
 * eens). De takenlijst — een andere denkbui: delegeren, niet aanwerven — staat eronder
 * over de volle breedte.
 */
export function staffScreen(s: GameState, selected: string | null, filter: StaffRole | null = null): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const member = selected ? s.staff.find((x) => x.id === selected) : undefined;

  const roleBtn = (role: StaffRole, label: string, effect: string) =>
    `<button class="filter-pick ${filter === role ? 'on' : ''}" data-action="staff-filter" data-id="${role}" ${tipAttr(
      `${effect} Klik om de kandidatenlijst op ${label.toLowerCase()} te filteren${filter === role ? ' — nog eens klikken haalt de filter weg' : ''}.`,
    )}><strong>${esc(label)}</strong>${filter === role ? ' ●' : ''}</button>`;

  const current = STAFF_ROLES.map((def) => {
    const m = s.staff.find((x) => x.role === def.role);
    if (!m) {
      return `<tr class="empty ${filter === def.role ? 'filtering' : ''}">
        <td>${roleBtn(def.role as StaffRole, def.label, def.effect)}</td>
        <td colspan="3" class="muted">Niet ingevuld — <button class="link-btn" data-action="staff-filter" data-id="${def.role}">${filter === def.role ? 'filter weghalen' : 'toon kandidaten'}</button></td>
      </tr>`;
    }
    const tasks = tasksOf(s, m.id).map((id) => TASKS.find((t) => t.id === id)!.label);
    return `<tr class="clickable ${member?.id === m.id ? 'selected' : ''} ${filter === def.role ? 'filtering' : ''}" data-action="staff-open" data-id="${m.id}">
      <td>${roleBtn(def.role as StaffRole, def.label, def.effect)}</td>
      <td><strong class="link">${esc(m.name)}</strong><br/><span class="muted small">${m.trait}${hasDiploma(m.role) ? ` · ${m.diploma}` : ''} · ${euro(m.wage)}/week</span></td>
      <td data-v="${m.skill}">${bar(m.skill)} ${m.skill}${m.courseWeeksLeft ? ' 📚' : ''}</td>
      <td class="small">${tasks.length ? tasks.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') : '<span class="muted">geen taken</span>'}
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

  // Zonder filter: de beste kandidaat per functie — dertien rijen overzicht in plaats van
  // eenendertig rijen lijst. Wie een functie aanklikt (links of in de rij zelf), krijgt
  // de volledige lichting voor die rol.
  const bestePerFunctie = STAFF_ROLES.map((def) =>
    s.staffMarket.filter((c) => c.role === def.role).sort((a, b) => b.skill - a.skill)[0],
  ).filter((c): c is NonNullable<typeof c> => !!c);
  const markt = filter ? s.staffMarket.filter((c) => c.role === filter) : bestePerFunctie;
  const candidates = markt
    .map((c) => {
      const lock = staffLock(s, c.role);
      const zittend = s.staff.find((x) => x.role === c.role);
      const status = lock
        ? `<span class="seat-lock has-tip small" ${tipAttr(lock)}>🔒 op slot</span>`
        : zittend
          ? `<span class="seat-taken small has-tip" ${tipAttr(`Je hebt maar één ${roleDef(c.role).label.toLowerCase()}. Aanwerven kan alleen door ${zittend.name} te vervangen.`)}>bezet: ${esc(zittend.name)} (${zittend.skill})</span>`
          : `<span class="seat-free small has-tip" ${tipAttr('Deze functie is nog niet ingevuld: aanwerven kan meteen.')}>functie vrij</span>`;
      const actie = lock
        ? ''
        : zittend
          ? `<button class="sm" data-action="hire-replace" data-id="${c.id}" ${tipAttr(
              `${zittend.name} vertrekt met een opzegvergoeding van ${euro(zittend.wage * 8)}, ${c.name} tekent voor ${euro(c.wage * 2)} tekengeld. Zijn taken gaan mee naar de opvolger.`,
            )}>Vervang ${esc(zittend.name.split(' ')[0])} (${euro(zittend.wage * 8 + c.wage * 2)})</button>`
          : `<button class="sm primary" data-action="hire" data-id="${c.id}">Aanwerven (${euro(c.wage * 2)})</button>`;
      return `<tr>
      <td data-v="${STAFF_ROLES.findIndex((r) => r.role === c.role)}"><strong>${esc(c.name)}</strong> <span class="muted small">${c.trait}${hasDiploma(c.role) ? ` · ${c.diploma}` : ''} · ${euro(c.wage)}/week</span><br/>
        <button class="filter-pick small ${filter === c.role ? 'on' : ''}" data-action="staff-filter" data-id="${c.role}" ${tipAttr(
          filter === c.role ? 'Klik om de filter weg te halen.' : `Klik om alle kandidaten voor ${roleDef(c.role).label.toLowerCase()} te zien.`,
        )}>${roleDef(c.role).label}${filter === c.role ? ' ●' : ''}</button> · ${status}</td>
      <td data-v="${c.skill}">${bar(c.skill)} ${c.skill}</td>
      <td>${impactChips(staffImpact(s, c.role, c.skill))}</td>
      <td>${actie}</td>
    </tr>`;
    })
    .join('');

  const filterChip = filter
    ? `<button class="filter-chip" data-action="staff-filter" data-id="${filter}" aria-label="Filter op ${roleDef(filter).label} weghalen">${roleDef(filter).label} ✕</button>`
    : '';

  return `
  ${member ? detailCard(s, member) : ''}
  <div class="cols-2">
    <div class="col">
      <section class="card">
        <h2>Jouw personeel ${hint('Klik op een naam voor taken en opleiding. Klik op een functie om de kandidatenlijst ernaast op die functie te filteren.')}</h2>
        <p class="muted small">Licentie voor ${division.name}: hoofdtrainer met minstens <strong>${division.requiredDiploma}</strong> en een ploegafgevaardigde (audit in week 38).</p>
        <div class="table-wrap"><table class="compact">
          <thead><tr><th>Functie</th><th>Naam</th><th>Vaardigheid</th><th>Taken</th></tr></thead>
          <tbody>${current}</tbody>
        </table></div>
      </section>
    </div>
    <div class="col">
      <section class="card">
        <h2>Kandidaten <span class="tag">${markt.length}${filter ? ` van ${s.staffMarket.length}` : ''}</span> ${filterChip}</h2>
        <p class="muted small">${filter ? 'Alle kandidaten voor deze functie in deze lichting.' : 'Je ziet de beste kandidaat per functie; klik op een functie voor de volledige lichting.'} De lijst vernieuwt elke 4 weken; maximaal één persoon per functie. Bij elke kandidaat staat of zijn functie vrij is, bezet (vervangen kan in één beslissing) of nog op slot. "Wat het je oplevert" is het verschil met wie je nu hebt.</p>
        <div class="table-wrap"><table class="compact" data-sort-id="kandidaten">
          <thead><tr><th>Kandidaat</th><th>Vaardigheid</th><th data-nosort>Wat het je oplevert</th><th data-nosort></th></tr></thead>
          <tbody>${candidates || `<tr><td colspan="4" class="muted">Geen kandidaten voor deze functie in deze lichting. Haal de filter weg met het kruisje hierboven, of wacht op de volgende lichting.</td></tr>`}</tbody>
        </table></div>
      </section>
    </div>
  </div>
  <section class="card">
    <h2>Wie doet wat? ${hint('Kies per taak wie ze doet: jij, of iemand van je personeel.')}</h2>
    <p class="muted small">Staat er "Jij", dan beslis je het zelf op het scherm waar die taak thuishoort. Geef je ze uit handen, dan beslist die persoon elke week automatisch — en hoe beter hij is, hoe minder hij ernaast zit. Terugnemen kan altijd.
    Je hebt ${TASKS.filter((t) => delegate(s, t.id)).length} van de ${TASKS.length} taken uitbesteed. Iemand kan 1 tot 4 taken aan, en werkt buiten zijn vakgebied op een lager niveau.</p>
    <div class="table-wrap"><table class="compact">
      <thead><tr><th>Taak</th><th>Wie doet het?</th><th>Wat gebeurt er</th></tr></thead>
      <tbody>${overview}</tbody>
    </table></div>
  </section>`;
}
