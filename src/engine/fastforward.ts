// Versnellen: de rustige weken in één klik.
//
// Tussen de competitierondes door liggen lange stukken zonder wedstrijd — de voorbereiding,
// de winterstop, de weken na de laatste speeldag. Die week per week doorklikken levert niets op.
// Deze functie speelt ze achter elkaar en stopt zodra er iets is dat jou nodig heeft. Zo wordt
// er nooit stilletjes iets voor je beslist.

import type { GameState, NewsItem } from './types';
import { advanceWeek } from './turn';
import { MATCH_WEEKS } from './calendar';
import { OWN_TEAM_ID } from './league';
import { available } from './discipline';
import { lineupGap } from './players';

/** Waarom het versnellen stopte. */
export type StopReason =
  | 'wedstrijd' // volgende week wordt er gespeeld: die bereid je zelf voor
  | 'weekmoment' // er ligt een beslissing op je bureau
  | 'opstelling' // je basiself is niet rond
  | 'saldo' // je staat onder nul
  | 'seizoen' // een nieuw seizoen begint; de persconferentie wacht
  | 'einde' // het spel is afgelopen
  | 'limiet'; // de bovengrens bereikt

export const STOP_TEXT: Record<StopReason, string> = {
  wedstrijd: 'Volgende week wordt er gespeeld — die week bereid je zelf voor.',
  weekmoment: 'Er ligt een beslissing op je bureau.',
  opstelling: 'Je basiself is niet rond.',
  saldo: 'Je saldo staat onder nul.',
  seizoen: 'Een nieuw seizoen begint: de persconferentie wacht op je.',
  einde: 'Het spel is afgelopen.',
  limiet: 'Tot hier voor nu — klik gerust opnieuw door.',
};

export const MAX_FAST_WEEKS = 12; // nooit meer dan dit in één klik

/** Speelt jouw ploeg in deze week een wedstrijd? */
export function hasMatch(state: GameState, week = state.week): boolean {
  if (!MATCH_WEEKS.includes(week)) return false;
  return state.league.fixtures.some((f) => f.week === week && f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID));
}

/** Hoeveel rustige weken er voor je liggen voor de volgende wedstrijd. */
export function quietWeeksAhead(state: GameState, max = MAX_FAST_WEEKS): number {
  let count = 0;
  for (let week = state.week; week <= 52 && count < max; week++) {
    if (hasMatch(state, week)) break;
    count++;
  }
  return count;
}

/** Is je basiself rond? Zolang die niet klopt, kan er geen week gespeeld worden. */
export function lineupReady(state: GameState): boolean {
  if (available(state.players).length < 11) return false;
  return lineupGap(state).openTotal === 0;
}

/** Mag er versneld worden, en zo ja hoeveel weken? Nul betekent: gewoon week per week. */
export function canFastForward(state: GameState): number {
  if (state.gameOver) return 0;
  if (state.opening && !state.opening.done) return 0;
  if (state.weekChoice && !state.weekChoice.answer) return 0;
  if (!lineupReady(state)) return 0;
  const quiet = quietWeeksAhead(state);
  return quiet >= 2 ? quiet : 0;
}

export interface FastForwardDigest {
  net: number; // wat de kas erop voor- of achteruitging
  news: NewsItem[]; // het opvallende nieuws uit die weken
  milestones: string[];
  records: string[];
}

export interface FastForwardResult {
  state: GameState;
  weeks: number; // hoeveel weken er effectief gespeeld zijn
  from: { season: number; week: number };
  to: { season: number; week: number };
  reason: StopReason;
  digest: FastForwardDigest;
}

/** Waarom we na deze week zouden stoppen — of null als er nog doorgespeeld mag worden. */
function stopAfter(state: GameState, played: number, max: number): StopReason | null {
  if (state.gameOver) return 'einde';
  if (state.opening && !state.opening.done) return 'seizoen';
  if (state.cash < 0) return 'saldo';
  if (state.weekChoice && !state.weekChoice.answer) return 'weekmoment';
  if (!lineupReady(state)) return 'opstelling';
  if (hasMatch(state)) return 'wedstrijd';
  if (played >= max) return 'limiet';
  return null;
}

/**
 * Speelt zoveel rustige weken achter elkaar als verantwoord is en geeft terug wat er gebeurde.
 * De toestand die binnenkomt blijft onaangeroerd, net als bij `advanceWeek`.
 */
export function playAhead(state: GameState, max = MAX_FAST_WEEKS): FastForwardResult {
  const from = { season: state.season, week: state.week };
  const cashBefore = state.cash;
  const milestones: string[] = [];
  const records: string[] = [];
  let current = state;
  let weeks = 0;
  let reason: StopReason = 'limiet';

  const limit = Math.max(1, Math.min(max, MAX_FAST_WEEKS));
  while (weeks < limit) {
    current = advanceWeek(current);
    weeks++;
    milestones.push(...current.lastMilestones);
    records.push(...current.lastRecords);
    const stop = stopAfter(current, weeks, limit);
    if (stop) {
      reason = stop;
      break;
    }
  }

  return {
    state: current,
    weeks,
    from,
    to: { season: current.season, week: current.week },
    reason,
    digest: {
      net: current.cash - cashBefore,
      news: notableNews(current, from, weeks),
      milestones,
      records,
    },
  };
}

/** Het nieuws uit de overgeslagen weken dat de moeite is om te lezen. */
function notableNews(state: GameState, from: { season: number; week: number }, weeks: number): NewsItem[] {
  const startAbs = from.season * 52 + from.week;
  const endAbs = startAbs + weeks;
  const inRange = state.news.filter((n) => {
    const abs = n.season * 52 + n.week;
    return abs >= startAbs && abs < endAbs;
  });
  const notable = inRange.filter((n) => n.tone !== 'neutraal');
  return (notable.length ? notable : inRange).slice(0, 12);
}
