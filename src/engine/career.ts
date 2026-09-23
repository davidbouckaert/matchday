// Je carrière als eigenaar: één langetermijndoel en één eenvoudige progressielaag.
//
// Bewust klein gehouden. Het doel geeft de hele partij een boog — je weet waar je naartoe
// werkt en je ziet elke week hoe ver je staat. De niveaus zetten niets achter slot: alles
// wat je in week één kon, kan je altijd; een niveau opent alleen iets extra.

import type { CarriereDoel } from '../content/careers';
import type { GameState } from './types';
import { CARRIERE_DOELEN, EIGENAARSNIVEAUS, PUNTEN } from '../content/careers';
import { DIVISIONS } from './data/divisions';
import { addNews, euro } from './util';
import { remember } from './content';

export { CARRIERE_DOELEN, EIGENAARSNIVEAUS };

/* -------------------------------------------------------------------- doelen */

export function goalDef(state: GameState): CarriereDoel | undefined {
  return CARRIERE_DOELEN.find((g) => g.id === state.career?.goalId);
}

export interface GoalProgress {
  /** Waar je nu staat, in de eenheid van het doel. */
  value: number;
  target: number;
  /** 0–1, afgekapt op 1. */
  fraction: number;
  done: boolean;
  /** Leesbare stand, bv. "2de Nationale van 1ste Nationale" of "€120.000 van €500.000". */
  label: string;
  /** Het tweede deel van een samengesteld doel, als dat er is. */
  extra?: { value: number; target: number; done: boolean; label: string };
}

/** Hoe ver je staat met je langetermijndoel. */
export function goalProgress(state: GameState, goal = goalDef(state)): GoalProgress | null {
  if (!goal) return null;
  const level = state.league.divisionLevel;
  const money = (n: number) => euro(Math.max(0, Math.round(n)));
  const seasonsAt = (min: number): number => {
    let count = 0;
    for (const [key, value] of Object.entries(state.career?.seasonsByLevel ?? {})) {
      if (Number(key) >= min) count += value;
    }
    return count;
  };

  switch (goal.soort) {
    case 'klasse': {
      const best = Math.max(level, ...(state.history ?? []).map((h) => DIVISIONS.findIndex((d) => d.name === h.division)));
      return {
        value: best,
        target: goal.doel,
        fraction: clampFraction(best / goal.doel),
        done: best >= goal.doel,
        label: `${DIVISIONS[Math.max(0, best)]?.name ?? '?'} van ${DIVISIONS[goal.doel]?.name ?? '?'}`,
      };
    }
    case 'kas':
      return {
        value: state.cash,
        target: goal.doel,
        fraction: clampFraction(state.cash / goal.doel),
        done: state.cash >= goal.doel,
        label: `${money(state.cash)} van ${money(goal.doel)}`,
      };
    case 'capaciteit':
      return {
        value: state.infrastructure.capacity,
        target: goal.doel,
        fraction: clampFraction(state.infrastructure.capacity / goal.doel),
        done: state.infrastructure.capacity >= goal.doel,
        label: `${state.infrastructure.capacity} van ${goal.doel} plaatsen`,
      };
    case 'jeugd':
      return {
        value: state.community.youthTeams,
        target: goal.doel,
        fraction: clampFraction(state.community.youthTeams / goal.doel),
        done: state.community.youthTeams >= goal.doel,
        label: `${state.community.youthTeams} van ${goal.doel} jeugdploegen`,
      };
    case 'seizoenen': {
      const count = seasonsAt(goal.extra ?? 2);
      return {
        value: count,
        target: goal.doel,
        fraction: clampFraction(count / goal.doel),
        done: count >= goal.doel,
        label: `${count} van ${goal.doel} seizoenen in ${DIVISIONS[goal.extra ?? 2]?.name ?? '?'} of hoger`,
      };
    }
    case 'combinatie': {
      const sportDone = level >= goal.doel;
      const moneyDone = state.cash >= (goal.extra ?? 0);
      return {
        value: level,
        target: goal.doel,
        fraction: clampFraction((clampFraction(level / goal.doel) + clampFraction(state.cash / (goal.extra ?? 1))) / 2),
        done: sportDone && moneyDone,
        label: `${DIVISIONS[level]?.name ?? '?'} van ${DIVISIONS[goal.doel]?.name ?? '?'}`,
        extra: {
          value: state.cash,
          target: goal.extra ?? 0,
          done: moneyDone,
          label: `${money(state.cash)} van ${money(goal.extra ?? 0)}`,
        },
      };
    }
    default:
      return null;
  }
}

const clampFraction = (x: number): number => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

/** Legt je langetermijndoel vast. Kan maar één keer. */
export function setCareerGoal(state: GameState, goalId: string): boolean {
  if (!state.career) state.career = emptyCareer();
  if (state.career.goalId) return false;
  const goal = CARRIERE_DOELEN.find((g) => g.id === goalId);
  if (!goal) return false;
  state.career.goalId = goal.id;
  state.career.chosenSeason = state.season;
  addNews(state, 'neutraal', `Je legde je doel voor de lange termijn vast: ${goal.titel.toLowerCase()}. ${goal.beschrijving}`);
  remember(state, `Doel voor de lange termijn vastgelegd: ${goal.titel.toLowerCase()}.`);
  return true;
}

export function emptyCareer(): GameState['career'] {
  return { goalId: null, chosenSeason: null, achievedSeason: null, seasonsByLevel: {} };
}

/**
 * Kijkt of het doel bereikt is. Gebeurt elke week, zodat het moment waarop het lukt
 * ook echt dat moment is en niet het einde van het seizoen.
 */
export function checkCareerGoal(state: GameState): boolean {
  const career = state.career;
  const goal = goalDef(state);
  if (!career || !goal || career.achievedSeason !== null) return false;
  const progress = goalProgress(state, goal);
  if (!progress?.done) return false;
  career.achievedSeason = state.season;
  const seasons = career.chosenSeason ? state.season - career.chosenSeason + 1 : state.season;
  addNews(state, 'goed', `DOEL BEREIKT — ${goal.titel}. Je deed er ${seasons} ${seasons === 1 ? 'seizoen' : 'seizoenen'} over. ${goal.belofte}`);
  remember(state, `Langetermijndoel bereikt: ${goal.titel.toLowerCase()} (na ${seasons} ${seasons === 1 ? 'seizoen' : 'seizoenen'}).`);
  addOwnerPoints(state, PUNTEN.doelBehaald, 'je langetermijndoel behaald');
  return true;
}

/* ----------------------------------------------------------- eigenaarsniveaus */

export function emptyOwner(): GameState['owner'] {
  return { level: 1, points: 0, lastUnlock: null };
}

export function levelFor(points: number): number {
  let level = 1;
  for (const l of EIGENAARSNIVEAUS) if (points >= l.punten) level = l.level;
  return level;
}

export function ownerLevel(state: GameState) {
  const level = state.owner?.level ?? 1;
  return EIGENAARSNIVEAUS.find((l) => l.level === level) ?? EIGENAARSNIVEAUS[0];
}

/** Het volgende niveau en hoeveel punten je er nog voor nodig hebt. */
export function nextLevel(state: GameState): { niveau: (typeof EIGENAARSNIVEAUS)[number]; missing: number } | null {
  const points = state.owner?.points ?? 0;
  const next = EIGENAARSNIVEAUS.find((l) => l.punten > points);
  return next ? { niveau: next, missing: next.punten - points } : null;
}

/** Punten bijschrijven; als er een niveau bij komt, hoor je het meteen. */
export function addOwnerPoints(state: GameState, points: number, reason: string): void {
  if (!state.owner) state.owner = emptyOwner();
  if (points <= 0) return;
  const before = state.owner.level;
  state.owner.points += points;
  state.owner.level = levelFor(state.owner.points);
  if (state.owner.level > before) {
    const niveau = ownerLevel(state);
    state.owner.lastUnlock = niveau.voordeel;
    addNews(state, 'goed', `Je staat er nu anders voor in de streek: ${niveau.naam}. ${niveau.uitleg}`);
    remember(state, `Doorgegroeid tot ${niveau.naam.toLowerCase()}: ${niveau.voordeel.toLowerCase()}.`);
  }
  void reason;
}

/* ------------------------------------------------------------- de ontgrendelingen */
//
// Elke ontgrendeling is één getal dat de rest van het spel opvraagt. Zo blijft het
// bij één laag en zit er nergens verborgen logica.

/** Hoeveel bouwprojecten er tegelijk mogen lopen. */
export function maxProjects(state: GameState): number {
  return (state.owner?.level ?? 1) >= 3 ? 3 : 2;
}

/** Korting op de rente van een nieuwe lening, in procentpunten. */
export function loanDiscount(state: GameState): number {
  return (state.owner?.level ?? 1) >= 2 ? 0.005 : 0;
}

/** Extra prospecten die een sponsorcampagne oplevert. */
export function sponsorBonus(state: GameState): number {
  return (state.owner?.level ?? 1) >= 4 ? 1 : 0;
}

/** Vermenigvuldiger op de gemeentesubsidie. */
export function subsidyFactor(state: GameState): number {
  return (state.owner?.level ?? 1) >= 5 ? 1.25 : 1;
}

/* ------------------------------------------------------------ einde van het seizoen */

/** Punten en tellers bijwerken zodra een seizoen erop zit. */
export function settleCareerSeason(state: GameState, result: string, profit: number): void {
  if (!state.career) state.career = emptyCareer();
  if (!state.owner) state.owner = emptyOwner();
  const level = state.league.divisionLevel;
  state.career.seasonsByLevel[level] = (state.career.seasonsByLevel[level] ?? 0) + 1;

  let points = PUNTEN.seizoen;
  if (result === 'kampioen') points += PUNTEN.titel;
  else if (result === 'promotie') points += PUNTEN.promotie;
  if (profit > 0) points += PUNTEN.winstgevendSeizoen;
  addOwnerPoints(state, points, 'het seizoen afgewerkt');
}

/** Punten voor een nieuwe mijlpaal. */
export function creditMilestones(state: GameState, count: number): void {
  if (count > 0) addOwnerPoints(state, count * PUNTEN.mijlpaal, 'nieuwe mijlpalen');
}
