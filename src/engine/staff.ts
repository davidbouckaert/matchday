import type { Diploma, GameState, Staff, StaffRole, StaffTrait } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { STAFF_FIRST, LAST_NAMES } from './data/names';
import { roleDef } from './data/catalog';
import { nextId } from './util';

const STAFF_TRAITS: StaffTrait[] = ['ambitieus', 'loyaal', 'gemakzuchtig', 'perfectionist', 'teamspeler'];

export function staffWage(role: StaffRole, skill: number, trait: StaffTrait, diploma: Diploma, inflation = 1): number {
  const base = roleDef(role).baseWage;
  const traitFactor = trait === 'ambitieus' ? 1.15 : trait === 'loyaal' ? 0.95 : trait === 'gemakzuchtig' ? 0.9 : 1;
  const diplomaFactor = hasDiploma(role) ? [0.7, 0.85, 1, 1.4, 2][['geen', 'EUFA C', 'EUFA B', 'EUFA A', 'EUFA Pro'].indexOf(diploma)] : 1;
  return round(base * Math.pow(1.03, skill - 50) * traitFactor * diplomaFactor * inflation, 5);
}

export function generateStaff(state: GameState, rng: Rng, role: StaffRole, meanSkill: number): Staff {
  const skill = clamp(Math.round(rng.normal(meanSkill, 10)), 15, 95);
  const trait = rng.pick(STAFF_TRAITS);
  let diploma: Diploma = 'geen';
  if (role === 'hoofdtrainer') {
    diploma = skill > 72 ? 'EUFA A' : skill > 45 ? 'EUFA B' : rng.chance(0.5) ? 'EUFA C' : 'EUFA B';
    if (skill > 85 && rng.chance(0.4)) diploma = 'EUFA Pro';
  }
  if (role === 'assistent') diploma = skill > 70 ? 'EUFA B' : skill > 40 ? 'EUFA C' : 'geen';
  return {
    id: nextId(state, 's'),
    name: `${rng.pick(STAFF_FIRST)} ${rng.pick(LAST_NAMES)}`,
    role,
    skill,
    trait,
    wage: staffWage(role, skill, trait, diploma, state.inflation),
    diploma,
    courseWeeksLeft: 0,
    courseType: null,
  };
}

/** Effectieve vaardigheid van een personeelslid in een rol (0 als niemand, of als hij op opleiding is: half). */
export function staffSkill(state: GameState, role: StaffRole): number {
  const s = state.staff.find((x) => x.role === role);
  if (!s) return 0;
  const traitFactor = s.trait === 'perfectionist' ? 1.1 : s.trait === 'gemakzuchtig' ? 0.85 : 1;
  const onCourse = s.courseWeeksLeft > 0 ? 0.6 : 1;
  return s.skill * traitFactor * onCourse;
}

/** Trainers met een EUFA-diploma. */
export function hasDiploma(role: StaffRole): boolean {
  return role === 'hoofdtrainer' || role === 'assistent';
}

export function hasStaff(state: GameState, role: StaffRole): boolean {
  return state.staff.some((s) => s.role === role);
}

/** Bestaande personeelsvergoedingen, gedeeld door boeking en vergelijking. */
export const staffSigningFee = (member: Staff): number => member.wage * 2;
export const staffPayoff = (member: Staff): number => member.wage * 8;
export function staffChangeCost(candidate: Staff, current?: Staff): number {
  return staffSigningFee(candidate) + (current ? staffPayoff(current) : 0);
}
