// De knop om een personeelslid naar zijn volgende ster te laten opleiden.
//
// Staat op twee schermen (Personeel en Opleiding), dus hier één keer geschreven. De knop
// zegt altijd wat de stap kost, hoe lang hij duurt en wat hij oplevert; kan het niet, dan
// zegt hij waarom — een slot achter je klassement is een doel en hoort zichtbaar te zijn.

import type { GameState, Staff } from '../engine/types';
import { coursePlan, skillStars } from '../engine/training-staff';
import { esc, euro } from './format';
import { tipAttr } from './tooltip';

export function courseButton(s: GameState, m: Staff): string {
  const plan = coursePlan(s, m);
  const sterren = skillStars(m.skill);
  if (sterren >= 5) return '<span class="muted small">5 sterren: volledig opgeleid</span>';
  if (plan.blocked && /wordt pas aangeboden/.test(plan.blocked)) {
    return `<span class="muted small" ${tipAttr(plan.blocked)}>🔒 ${plan.toStar} sterren vraagt een hogere reeks</span>`;
  }
  return `<button class="sm" data-action="bijscholing" data-id="${m.id}" ${
    plan.blocked ? `disabled ${tipAttr(esc(plan.blocked))}` : tipAttr(
      `Van ${sterren} naar ${plan.toStar} sterren: +${plan.gain[0]} tot +${plan.gain[1]} vaardigheid. Tijdens die ${plan.weeks} weken werkt hij op 60%, dus je voelt het even. Elke volgende ster kost ruim het dubbele.`,
    )
  }>Opleiden naar ${plan.toStar} ★ (${euro(plan.cost)}, ${plan.weeks} weken)</button>`;
}
