// Clubrecords: de mooiste cijfers uit je geschiedenis. Een gebroken record is een klein feestje.

import type { GameState, LedgerCategory } from './types';
import { OWN_TEAM_ID } from './league';
import { addNews, euro } from './util';

/**
 * Financiering, geen prestatie: een lening, subsidie, kapitaalinjectie of de jaarlijkse
 * lidgeldstorting zegt niets over hoe goed de week liep. Meegeteld voor het inkomstenrecord
 * geeft dat een vals record (één lening verslaat elke goede weekwerking) of een record dat
 * hooguit één keer per seizoen sneuvelt (de lidgeldstorting). Die categorieën tellen daarom
 * niet mee — enkel opbrengsten uit de werking van de club (tickets, kantine, shop, horeca,
 * sponsors, transfers, premies, ...) doen dat wel.
 */
const FINANCIERING: ReadonlySet<LedgerCategory> = new Set(['leningen', 'subsidies', 'lidgelden', 'investeerder']);

function werkingsinkomstenWeek(entries: readonly { category: LedgerCategory; amount: number }[]): number {
  return entries.reduce((sum, e) => (FINANCIERING.has(e.category) ? sum : sum + Math.max(0, e.amount)), 0);
}

function werkingsinkomstenSeizoen(totals: Partial<Record<LedgerCategory, number>>): number {
  let sum = 0;
  for (const category of Object.keys(totals) as LedgerCategory[]) {
    if (FINANCIERING.has(category)) continue;
    sum += Math.max(0, totals[category] ?? 0);
  }
  return sum;
}

/** Hoeveel wedstrijden je op rij ongeslagen bent (of gewonnen hebt). */
export function currentStreak(state: GameState): { unbeaten: number; wins: number } {
  const played = state.league.fixtures
    .filter((f) => f.homeGoals !== undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .sort((a, b) => a.week - b.week);
  let unbeaten = 0;
  let wins = 0;
  let countingWins = true;
  for (let i = played.length - 1; i >= 0; i--) {
    const f = played[i];
    const home = f.homeId === OWN_TEAM_ID;
    const us = home ? f.homeGoals! : f.awayGoals!;
    const them = home ? f.awayGoals! : f.homeGoals!;
    if (us > them) {
      unbeaten++;
      if (countingWins) wins++;
      continue;
    }
    countingWins = false;
    if (us === them) {
      unbeaten++;
      continue;
    }
    break;
  }
  return { unbeaten, wins };
}

/** Kijkt na elke week welke records sneuvelen. Geeft de labels terug voor het weekrapport. */
export function checkRecords(state: GameState): string[] {
  const r = state.records;
  const broken: string[] = [];
  const income = werkingsinkomstenWeek(state.thisWeek);
  const seasonIncome = werkingsinkomstenSeizoen(state.seasonTotals);
  const { unbeaten, wins } = currentStreak(state);
  const match = state.lastMatch;

  if (match?.home && match.week === state.week && match.attendance > r.attendance) {
    r.attendance = match.attendance;
    broken.push(`Recordopkomst: ${match.attendance} toeschouwers`);
  }
  if (income > r.weekIncome && r.weekIncome > 0) broken.push(`Beste week ooit: ${euro(income)} inkomsten`);
  r.weekIncome = Math.max(r.weekIncome, income);
  r.seasonIncome = Math.max(r.seasonIncome, seasonIncome);
  if (unbeaten > r.unbeaten && unbeaten >= 3) {
    r.unbeaten = unbeaten;
    broken.push(`${unbeaten} wedstrijden op rij ongeslagen`);
  }
  if (wins > r.winStreak && wins >= 3) {
    r.winStreak = wins;
    broken.push(`${wins} overwinningen op rij`);
  }
  if (state.community.fanBase > r.fanBase + 99) {
    r.fanBase = state.community.fanBase;
    broken.push(`${state.community.fanBase} supporters: nooit eerder zoveel`);
  }
  r.fanBase = Math.max(r.fanBase, state.community.fanBase);
  for (const b of broken) addNews(state, 'goed', `🏅 Clubrecord: ${b}.`);
  return broken;
}
