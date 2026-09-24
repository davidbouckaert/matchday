// De lokale taakkiezer.
//
// Wie doet wat, stond alleen op Personeel. Wilde je vanuit de kantine je
// kantineverantwoordelijke de prijzen laten zetten, dan moest je naar Personeel, de juiste
// rij zoeken tussen vijftien taken, kiezen, en weer terugklikken. Vier schermwissels voor
// één keuze die je net daar wilde maken.
//
// Deze strook zet dezelfde keuze bovenaan het scherm waar de taak thuishoort. Het is
// letterlijk dezelfde besturing — hetzelfde data-change, dezelfde staat — dus Personeel
// blijft de plek waar je alles in één tabel naast elkaar ziet, en hier kies je zonder weg
// te gaan van waar je mee bezig bent.

import type { GameState, TaskId } from '../engine/types';
import { TASKS, roleDef } from './../engine/data/catalog';
import { delegate, taskCapacity, taskEfficiency, taskSkill, taskStars, tasksOf } from '../engine/delegation';
import { esc } from './format';
import { tipAttr } from './tooltip';

/** Hoe goed iemand bij deze taak past, in sterren. */
function fitStars(s: GameState, taskId: TaskId, staffId: string): number {
  // dezelfde sterren als de engine: ze bepalen hoeveel hij uit de taak haalt
  const m = s.staff.find((x) => x.id === staffId);
  return m ? taskStars(s, taskId, m) : 0;
}

/**
 * Eén strook voor één taak. Geef er meerdere mee als een scherm meer dan één taak dekt
 * (Strategie gaat bijvoorbeeld over trainingen, opstelling én wedstrijdtactiek).
 */
export function taskPicker(s: GameState, taskIds: TaskId[]): string {
  const rows = taskIds
    .map((id) => {
      const t = TASKS.find((x) => x.id === id);
      if (!t) return '';
      const who = delegate(s, id);
      const able = s.staff.filter((m) => t.roles.includes(m.role));

      const options = able
        .map((m) => {
          const busy = tasksOf(s, m.id).filter((x) => x !== id).length;
          const full = busy >= taskCapacity(m) && who?.id !== m.id;
          const stars = fitStars(s, id, m.id);
          return `<option value="${m.id}" ${who?.id === m.id ? 'selected' : ''} ${full ? 'disabled' : ''}>${esc(m.name)} ${'★'.repeat(stars)}${'☆'.repeat(
            5 - stars,
          )}${Math.round(taskEfficiency(s, id, m) * 100)}%${t.roles.indexOf(m.role) === 0 ? ' · vakgebied' : ''}${full ? ` · vol (${busy}/${taskCapacity(m)})` : ''}</option>`;
        })
        .join('');

      const control = able.length
        ? `<select data-change="delegate-task" data-id="${id}" aria-label="Wie doet ${esc(t.label)}?">
             <option value="">Jij</option>${options}
           </select>`
        : `<span class="muted small">niemand in dienst die dit kan (${t.roles.map((r) => roleDef(r).label).join(', ')})</span>`;

      const note = who
        ? t.roles.indexOf(who.role) > 0
          ? `<span class="warn-note small" ${tipAttr(
              'Buiten zijn vakgebied mist hij kennis: hij beslist met een lager niveau en maakt vaker een verkeerde keuze.',
              'Niet zijn vakgebied',
            )}>⚠️ ${Math.round(taskSkill(s, id, who))} in plaats van ${who.skill}</span>`
          : `<span class="muted small">${Math.round(taskSkill(s, id, who))}/100</span>`
        : '<span class="muted small">jij beslist</span>';

      return `<div class="picker-row">
        <span class="picker-label" ${tipAttr(who ? t.delegated : t.owner, t.label)}>${esc(t.label)}</span>
        ${control}
        ${note}
      </div>`;
    })
    .join('');

  if (!rows) return '';
  return `<section class="card picker">
    <h2>Wie doet dit? <span class="tag">ook op Personeel</span></h2>
    ${rows}
  </section>`;
}
