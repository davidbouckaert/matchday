// Waar een bedrag vandaan kwam.
//
// De engine rekent met vermenigvuldigers: een basisbedrag maal sfeer maal ticketprijs maal
// weer maal populariteit. Het Invloeden-scherm toont welke factoren meespelen, maar niet hoe
// zwaar ze déze week wogen. Hier houden we dat per week bij, zodat je bij een tegenvallende
// kantine-omzet kunt nagaan of het aan het weer lag, aan de opkomst of aan je prijszetting.
//
// Er wordt niets extra berekend: we leggen dezelfde factorlijsten vast die de formule zelf
// gebruikt. De uitsplitsing kan dus nooit iets anders zeggen dan wat er echt gebeurde.

import type { Factor } from './factors';
import type { GameState, LedgerCategory } from './types';

/** Eén post van de week, met de factoren die haar hoogte bepaalden. */
export interface WeekOrigin {
  category: LedgerCategory;
  label: string;
  amount: number; // wat er uiteindelijk geboekt werd
  base: number; // wat het zonder al die factoren geweest zou zijn
  factors: Factor[];
}

/**
 * Wat deze factor je opleverde of kostte: het verschil tussen wat er nu geboekt is en
 * wat het geweest zou zijn zonder deze ene factor. Positief = hij hielp.
 */
export function factorEffect(amount: number, factor: Factor): number {
  if (factor.kind !== 'x' || !factor.value) return 0;
  return Math.round(amount - amount / factor.value);
}

/** De factoren die het meest wogen, grootste effect eerst. */
export function biggestFactors(origin: WeekOrigin, count = 6): Factor[] {
  return [...origin.factors]
    .filter((f) => f.kind === 'x' && Math.abs(f.value - 1) > 0.001)
    .sort((a, b) => Math.abs(factorEffect(origin.amount, b)) - Math.abs(factorEffect(origin.amount, a)))
    .slice(0, count);
}

/** Legt vast waar een bedrag vandaan kwam. Alleen posten die de moeite zijn. */
export function recordOrigin(
  state: GameState,
  category: LedgerCategory,
  label: string,
  amount: number,
  factors: Factor[],
  base?: number,
): void {
  if (!state.lastOrigins) state.lastOrigins = [];
  if (Math.abs(Math.round(amount)) < 1) return;
  const multiplier = factors.filter((f) => f.kind === 'x').reduce((p, f) => p * f.value, 1);
  state.lastOrigins.push({
    category,
    label,
    amount: Math.round(amount),
    base: Math.round(base ?? (multiplier ? amount / multiplier : amount)),
    factors: factors.filter((f) => f.kind === 'x'),
  });
}

/** Maakt de lijst leeg aan het begin van een nieuwe week. */
export function clearOrigins(state: GameState): void {
  state.lastOrigins = [];
}

/** De posten van de week, grootste eerst. */
export function sortedOrigins(state: GameState, count = 5): WeekOrigin[] {
  return [...(state.lastOrigins ?? [])].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, count);
}
