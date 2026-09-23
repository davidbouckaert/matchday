// Gevolgen tonen als kaartjes in plaats van als zin.
//
// "Betere fysiek, stabielere vorm, minder blessures" is een mooie zin, maar je leest hem
// één keer en daarna scan je eroverheen. En hij zegt niet hoevéél. Een kaartje met een
// icoon en een getal lees je in een halve seconde en je kunt er twee kandidaten mee
// vergelijken zonder iets te lezen: 🩹 −18% naast 🩹 −7%.
//
// De volle uitleg zit er nog steeds in, maar in de tooltip — daar staat ze voor wie ze
// wil, in plaats van in de weg voor wie ze niet nodig heeft.

import type { Impact } from '../engine/impact';
import { esc } from './format';
import { tipAttr } from './tooltip';

/** Eén kaartje. */
export function impactChip(i: Impact): string {
  return `<span class="effect ${i.tone}" ${tipAttr(i.tip, i.label)}>
    <span class="ic" aria-hidden="true">${i.icon}</span>
    <span class="val">${esc(i.value)}</span>
    <span class="lbl">${esc(i.label)}</span>
  </span>`;
}

/** Een rijtje kaartjes; geeft een streepje terug als er niets te melden valt. */
export function impactChips(list: Impact[], max = 4): string {
  if (!list.length) return '<span class="muted small">—</span>';
  return `<span class="effects">${list.slice(0, max).map(impactChip).join('')}</span>`;
}
