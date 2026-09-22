// Populariteit: hoe groot en hoe warm je achterban is. Eén getal dat op alle inkomsten weegt:
// tickets, kantine, concessies, fanshop en wat mensen voor een shirt willen betalen.

import type { GameState } from './types';
import type { Factor } from './factors';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { OWN_TEAM_ID, ownPosition } from './league';
import { clubRatings } from './ratings';

const x = (label: string, value: number, source: string): Factor => ({ label, value, source, kind: 'x' });

export interface Popularity {
  score: number; // 0-100
  factor: number; // vermenigvuldiger op inkomsten (ongeveer 0,75 tot 1,35)
  parts: Factor[];
}

/** Recente resultaten: aandeel punten uit de laatste vijf wedstrijden. */
export function recentForm(state: GameState): number {
  const played = state.league.fixtures
    .filter((f) => f.homeGoals !== undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .slice(-5);
  if (!played.length) return 0.5;
  let points = 0;
  for (const f of played) {
    const home = f.homeId === OWN_TEAM_ID;
    const us = home ? f.homeGoals! : f.awayGoals!;
    const them = home ? f.awayGoals! : f.homeGoals!;
    points += us > them ? 3 : us === them ? 1 : 0;
  }
  return points / (played.length * 3);
}

export function popularity(state: GameState): Popularity {
  const ratings = clubRatings(state);
  const sport = ratings.find((r) => r.key === 'sportief')!.score;
  const community = ratings.find((r) => r.key === 'gemeenschap')!.score;
  const division = DIVISIONS[state.league.divisionLevel];
  const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const pos = played >= 3 ? ownPosition(state.league) : 8;
  const form = recentForm(state);

  const score = clamp(sport * 0.3 + community * 0.45 + (100 - (pos - 1) * 5) * 0.15 + form * 100 * 0.1, 0, 100);
  const parts: Factor[] = [
    x('Clubrating sportief', 1 + (sport - 50) / 500, `${Math.round(sport)}/100`),
    x('Clubrating gemeenschap', 1 + (community - 50) / 330, `${Math.round(community)}/100`),
    x('Klassement', 1 + (9 - pos) / 90, played >= 3 ? `${pos}e plaats` : 'nog niet begonnen'),
    x('Recente resultaten', 0.94 + form * 0.12, `${Math.round(form * 100)}% van de punten uit de laatste 5`),
    x('Reeks', division.sponsorFactor > 1 ? 1.05 : 1, division.name),
  ];
  return { score, factor: clamp(parts.reduce((f, p) => f * p.value, 1), 0.7, 1.45), parts };
}

/** Wat supporters voor merchandising en tickets willen betalen stijgt mee met de populariteit. */
export function willingnessToPay(state: GameState): number {
  return clamp(0.85 + popularity(state).score / 330, 0.85, 1.3);
}
