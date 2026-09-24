// Je personeel beter maken: wat een volgende ster kost, en wanneer je eraan mag beginnen.
//
// Personeel hébben ontgrendelt het delegeren; hoe goed het loopt, hangt af van wie je erop
// zet. Er zijn twee wegen naar een goede medewerker en ze kosten allebei: kopen (een hoog
// loon, elke week opnieuw) of opleiden (een bedrag ineens, plus weken waarin hij op 60%
// werkt). Welke weg de beste is, hoort een echte afweging te zijn in elke fase van het spel.
//
// Daarom wordt elke ster duurder dan de vorige. Van één naar twee sterren is iets voor je
// eerste seizoen; van vier naar vijf is een investering waar je een half jaar voor spaart.
// En de laatste twee treden zitten achter je klassement: een medewerker op het niveau van de
// nationale reeksen laat zich niet opleiden bij een club uit provinciale.

import type { GameState, Staff } from './types';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';

/** De ondergrens in vaardigheid per ster. Eén ster tot 30, vijf sterren vanaf 90. */
export const STAR_THRESHOLDS = [0, 30, 50, 70, 90];

/** Hoeveel sterren deze vaardigheid waard is, los van welke taak hij doet. */
export function skillStars(skill: number): number {
  let sterren = 1;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) if (skill >= STAR_THRESHOLDS[i]) sterren = i + 1;
  return sterren;
}

/** Vanaf welke reeks je iemand naar dit sterniveau mag laten opleiden. */
export function starRequiresLevel(star: number): number {
  if (star >= 5) return 3; // 1ste nationale
  if (star >= 4) return 2; // 2de nationale
  return 0;
}

export interface CoursePlan {
  /** De ster waar hij naartoe werkt. */
  toStar: number;
  cost: number;
  weeks: number;
  /** Winst in vaardigheid, als bereik. */
  gain: [number, number];
  /** Waarom het nu niet kan, of null. */
  blocked: string | null;
}

const BASE_COST = 700;
const BASE_WEEKS = 4;

/**
 * Wat de volgende stap voor dit personeelslid kost.
 *
 * De prijs verdubbelt ruim per ster en de opleiding duurt telkens langer, zodat de sprong
 * van vier naar vijf sterren een beslissing is en geen routine.
 */
export function coursePlan(state: GameState, staff: Staff): CoursePlan {
  const nu = skillStars(staff.skill);
  const toStar = Math.min(5, nu + 1);
  const trap = toStar - 1; // 1 voor de stap naar 2 sterren, 4 voor de stap naar 5
  const cost = Math.round((BASE_COST * Math.pow(2.2, trap) * state.inflation) / 50) * 50;
  const weeks = BASE_WEEKS + trap * 3;
  const nodig = starRequiresLevel(toStar);
  const volgende = STAR_THRESHOLDS[toStar - 1];
  const gain: [number, number] = [Math.max(3, volgende - staff.skill), Math.max(6, volgende - staff.skill + 5)];

  let blocked: string | null = null;
  if (nu >= 5) blocked = `${staff.name} heeft alles gehad: vijf sterren is het maximum.`;
  else if (staff.courseWeeksLeft > 0) blocked = `${staff.name} volgt al een opleiding.`;
  else if (state.league.divisionLevel < nodig) {
    blocked = `Een opleiding tot ${toStar} sterren wordt pas aangeboden aan clubs uit ${DIVISIONS[nodig].name} of hoger. Promoveer eerst.`;
  } else if (state.cash < cost) blocked = `Dat kost €${cost.toLocaleString('nl-BE')} en zoveel staat er niet op de rekening.`;

  return { toStar, cost, weeks, gain, blocked };
}

/** Het plafond waar opleiden je brengt. Kopen kan hoger, maar kost elke week loon. */
export const TRAINING_CAP = clamp(STAR_THRESHOLDS[4] + 4, 0, 100);
