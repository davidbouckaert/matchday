// Kalender: een jaar heeft 52 beurten (weken). Week 1 = eerste week van juli.

export const WEEKS_PER_YEAR = 52;

// Speeldagen: 30 rondes. Heenronde in weken 7-21, winterstop, terugronde 28-42.
export const MATCH_WEEKS: number[] = [
  ...Array.from({ length: 15 }, (_, i) => 7 + i), // 7..21
  ...Array.from({ length: 15 }, (_, i) => 28 + i), // 28..42
];

export const SEASON_END_WEEK = 44; // eindstand, promotie en degradatie
export const LICENCE_AUDIT_WEEK = 38;
export const BOND_FEE_WEEK = 2;
export const MEMBERSHIP_FEE_WEEK = 10;
export const SUBSIDY_WEEK = 24;
export const SEASON_ROLLOVER_WEEK = 1; // nieuwe seizoen begint

export function isTransferWindow(week: number): boolean {
  return (week >= 1 && week <= 9) || (week >= 28 && week <= 32) || week >= 45;
}

export function isWinter(week: number): boolean {
  return week >= 19 && week <= 36;
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function weekDate(startYear: number, season: number, week: number): Date {
  const start = new Date(Date.UTC(startYear + season - 1, 6, 1)); // 1 juli
  return new Date(start.getTime() + (week - 1) * 7 * 24 * 3600 * 1000);
}

export function formatWeek(startYear: number, season: number, week: number): string {
  const d = weekDate(startYear, season, week);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function seasonLabel(startYear: number, season: number): string {
  const y = startYear + season - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Bv. "woensdag 12 augustus 2026" (de eerste dag van de speelweek). */
export function formatDateLong(startYear: number, season: number, week: number): string {
  const d = weekDate(startYear, season, week);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthName(startYear: number, season: number, week: number): string {
  const d = weekDate(startYear, season, week);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const WINTER_BREAK = { from: MATCH_WEEKS[14] + 1, to: MATCH_WEEKS[15] - 1 }; // tussen heen- en terugronde

/** Waar staan we in het seizoen? Voor de kopbalk. */
export function seasonPhase(week: number): string {
  const first = MATCH_WEEKS[0];
  const last = MATCH_WEEKS[MATCH_WEEKS.length - 1];
  if (week < first) return `competitie start over ${first - week} ${first - week === 1 ? 'week' : 'weken'}`;
  const round = MATCH_WEEKS.indexOf(week);
  if (round >= 0) return `speeldag ${round + 1}/${MATCH_WEEKS.length}`;
  if (week >= WINTER_BREAK.from && week <= WINTER_BREAK.to) return 'winterstop';
  if (week <= last) return `competitie loopt (${MATCH_WEEKS.filter((w) => w < week).length}/${MATCH_WEEKS.length} gespeeld)`;
  if (week <= SEASON_END_WEEK) return 'laatste weken van de competitie';
  return 'zomerstop';
}
