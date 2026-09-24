// De jeugdwerking: ploegjes van U7 tot U17. Elke club heeft er van bij de start een paar.
// Ploegen binden vrijwilligers en vragen veldruimte — daar zit de afweging.

import type { GameState } from './types';
import { clamp } from './rng';
import { staffSkill } from './staff';

export const MEMBERS_PER_TEAM = 55; // leden die één extra ploeg rechtvaardigen
export const VOLUNTEERS_PER_TEAM = 2; // een jeugdtrainer en een ploegafgevaardigde per ploeg

/** De namen van de reeksen, in volgorde waarin een club ze opstart. */
export const TEAM_LABELS = ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U21', 'Dames'];

/**
 * Hoeveel ploegen je club aankan.
 *
 * Dit hing alleen aan stenen en gras: je opleidingscentrum, kunstgras, verlichting. Maar
 * een ploeg draaiende houden is vooral mensenwerk — trainingen inplannen, ouders bellen,
 * scheidsrechters regelen, een afgevaardigde vinden. Een goede jeugdcoördinator krijgt er
 * daarom één of twee ploegen bij die je anders niet georganiseerd kreeg, ook al verandert
 * er niets aan je terrein.
 *
 * Gratis is dat niet: elke ploeg bindt twee vrijwilligers die je dan niet meer voor een
 * evenement kunt inzetten.
 */
export function coordinatorTeams(state: GameState): number {
  const skill = staffSkill(state, 'jeugdcoordinator');
  return skill >= 75 ? 2 : skill >= 45 ? 1 : 0;
}

export function maxYouthTeams(state: GameState): number {
  const i = state.infrastructure;
  return 4 + i.academyLevel * 2 + (i.pitch === 'kunstgras' ? 2 : 0) + (i.lightingLevel >= 2 ? 1 : 0) + coordinatorTeams(state);
}

/** Hoeveel ploegen bij dit ledenaantal horen, begrensd door wat je club aankan. */
export function teamsFor(state: GameState, members = state.community.youthMembers): number {
  return clamp(Math.round(members / MEMBERS_PER_TEAM), 2, maxYouthTeams(state));
}

/** Vrijwilligers die vastzitten aan de jeugd: die kun je niet voor een evenement inzetten. */
export function boundVolunteers(state: GameState): number {
  return state.community.youthTeams * VOLUNTEERS_PER_TEAM;
}

/** Vrijwilligers die echt vrij zijn voor evenementen en acties. */
export function freeVolunteers(state: GameState): number {
  return Math.max(0, state.community.volunteers - boundVolunteers(state));
}

/** Tekort aan begeleiding: hoeveel vrijwilligers je jeugdploegen op dit moment missen. */
export function youthShortage(state: GameState): number {
  return Math.max(0, boundVolunteers(state) - state.community.volunteers);
}

/**
 * Wat je jeugdwerking doet met de instroom. Te weinig begeleiding of te weinig plaats
 * op het veld schrikt ouders af; genoeg ploegen en een opleidingscentrum trekken ze aan.
 */
export function youthCapacityFactor(state: GameState): number {
  const shortage = youthShortage(state);
  const full = state.community.youthTeams >= maxYouthTeams(state) ? 0.85 : 1;
  return clamp(full * (1 - shortage * 0.06), 0.45, 1);
}

/** Ploegen volgen het ledenaantal, maar schuiven per seizoen maar één stap op. */
export function updateYouthTeams(state: GameState): number {
  const want = teamsFor(state);
  const now = state.community.youthTeams;
  const next = want > now ? now + 1 : want < now ? now - 1 : now;
  state.community.youthTeams = next;
  return next - now;
}

/** De reeksen die je vandaag in competitie hebt. */
export function teamNames(state: GameState): string[] {
  return TEAM_LABELS.slice(0, state.community.youthTeams);
}

/**
 * De kwaliteit waarmee een doorstromer uit de eigen jeugd aan de A-kern begint.
 *
 * Dit hing aan je reeks: kwaliteit = reeksniveau − 12 + bonussen. Daardoor werd je jeugd
 * vanzelf beter telkens jij promoveerde — een gratis, reeks-geïndexeerde aanvoer van spelers
 * aan €40 per week. Gemeten (scripts/doorlichting-loonlat.ts): tegen seizoen zes bestond de
 * kern van een uitbestedende club voor 60% uit eigen jeugd en stond ze structureel 4 à 7
 * punten boven haar reeks, zonder één euro transferbudget. Je reeks maakt je jeugd niet
 * beter; je jeugdwerking wel. Vanaf nu telt alleen die: de coördinator, het
 * opleidingscentrum en hoeveel kinderen er komen voetballen.
 *
 * IJkpunt: een startclub in 3de Nationale met een degelijke coördinator komt op ~46 uit,
 * hetzelfde als voorheen — aan het begin van een carrière verandert er dus niets. Het
 * plafond (topcoördinator, vol centrum, 400 leden) ligt rond 65: jeugd kan je naar
 * 1ste Nationale dragen, maar wie hoger wil, moet kopen aan de loonlat van die reeks.
 */
export function youthIntakeQuality(state: GameState): number {
  const coord = staffSkill(state, 'jeugdcoordinator');
  const academy = state.infrastructure.academyLevel;
  const members = Math.min(400, state.community.youthMembers);
  return 34 + coord / 6 + academy * 3 + members / 60;
}

/** Hoeveel rek er op zo'n doorstromer zit. Talent toont zich pas met begeleiding. */
export function youthIntakePotential(state: GameState): number {
  const coord = staffSkill(state, 'jeugdcoordinator');
  const members = Math.min(400, state.community.youthMembers);
  return coord / 8 + members / 60 + state.infrastructure.academyLevel * 3;
}
