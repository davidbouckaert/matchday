// Cijfers per seizoen: tickets, consumpties, merchandising, leden. Voor de tab Cijfers.

import type { GameState, SeasonStats } from './types';

export function emptyStats(season: number): SeasonStats {
  return { season, tickets: 0, attendanceHome: 0, matchesHome: 0, merch: {}, canteen: {}, concessions: {}, youthMembers: 0, volunteers: 0, ticketPrice: 0 };
}

/** Op het einde van het seizoen bewaren we de cijfers en beginnen we opnieuw. */
export function rolloverStats(state: GameState): void {
  state.stats.youthMembers = state.community.youthMembers;
  state.stats.volunteers = state.community.volunteers;
  state.stats.ticketPrice = state.ticketPrice;
  state.statsHistory.push(state.stats);
  if (state.statsHistory.length > 20) state.statsHistory.shift();
  state.stats = emptyStats(state.season);
}

export function totalOf(record: Partial<Record<string, number>>): number {
  return Object.values(record).reduce((sum: number, v) => sum + (v ?? 0), 0);
}
