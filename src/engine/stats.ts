// Cijfers per seizoen: tickets, consumpties, merchandising, leden. Voor de tab Cijfers.

import type { GameState, LedgerCategory, SeasonStats, WeekStats } from './types';

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

const COUNTED: LedgerCategory[] = ['tickets', 'kantine', 'horeca concessies', 'merchandising', 'inkoop shop', 'werking shop', 'sponsors', 'lidgelden', 'evenementen', 'verhuur', 'subsidies', 'tv-rechten'];

/** Bewaart wat er deze week verkocht en verdiend is (voor de weekweergave bij Cijfers). */
export function recordWeek(state: GameState, before: SeasonStats): void {
  const revenue: WeekStats['revenue'] = {};
  for (const e of state.thisWeek) {
    if (!COUNTED.includes(e.category)) continue;
    revenue[e.category] = (revenue[e.category] ?? 0) + e.amount;
  }
  const diff = (now: Partial<Record<string, number>>, then: Partial<Record<string, number>>) =>
    Object.keys(now).reduce((sum, k) => sum + ((now[k] ?? 0) - (then[k] ?? 0)), 0);
  state.statsWeeks.push({
    season: state.season,
    week: state.week,
    tickets: state.stats.tickets - before.tickets,
    canteen: diff(state.stats.canteen, before.canteen),
    concessions: diff(state.stats.concessions, before.concessions),
    merch: diff(state.stats.merch, before.merch),
    revenue,
  });
  if (state.statsWeeks.length > 52) state.statsWeeks.shift();
}

/** Momentopname van de tellers, om het verschil van deze week te kunnen berekenen. */
export function snapshot(state: GameState): SeasonStats {
  return { ...state.stats, merch: { ...state.stats.merch }, canteen: { ...state.stats.canteen }, concessions: { ...state.stats.concessions } };
}
