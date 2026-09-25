import type { GameState, Staff } from '../engine/types';
import { hireStaff, replaceStaff } from '../engine/actions';
import { tasksOf } from '../engine/delegation';
import { staffChangeCost } from '../engine/staff';

/** Een proef op een kopie: ook capaciteit, taakvolgorde en blokkades volgen de echte actie. */
export function staffComparison(state: GameState, candidate: Staff) {
  const current = state.staff.find((m) => m.role === candidate.role);
  const copy = structuredClone(state);
  const result = current ? replaceStaff(copy, candidate.id) : hireStaff(copy, candidate.id);
  const before = current ? tasksOf(state, current.id) : [];
  const taken = result.ok ? tasksOf(copy, candidate.id) : [];
  return {
    current,
    cost: staffChangeCost(candidate, current),
    weeklyDelta: candidate.wage - (current?.wage ?? 0),
    reason: result.ok ? null : result.message,
    taken,
    returned: result.ok ? before.filter((id) => !taken.includes(id)) : [],
  };
}
