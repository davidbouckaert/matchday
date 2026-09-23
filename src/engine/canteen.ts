// Kantine en horecaconcessies. Jij zet de prijzen van het basisassortiment en onderhandelt
// met standhouders (hotdog, hamburger, frituur, pasta) over jouw deel van hun omzet.

import type { CanteenItemId, ConcessionId, GameState } from './types';
import type { Factor } from './factors';
import { product, spendFactors, volunteerFactor } from './factors';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { CANTEEN_ITEMS, CONCESSIONS, canteenDef, concessionDef } from './data/catalog';
import { staffSkill } from './staff';
import { popularity } from './popularity';
import { book } from './util';
import { recordOrigin } from './origins';

const x = (label: string, value: number, source: string): Factor => ({ label, value, source, kind: 'x' });

/** Prijsgevoeligheid per artikel: duurder = minder consumpties. */
export function canteenPriceFactor(price: number, ref: number): number {
  return clamp(Math.pow(ref / Math.max(0.5, price), 1.2), 0.25, 1.8);
}

/** Hoeveel er per bezoeker besteld wordt, los van de prijs. */
export function canteenFactors(state: GameState): Factor[] {
  const list = [
    x('Kantine', 0.8 + state.infrastructure.kantineLevel * 0.1, `niveau ${state.infrastructure.kantineLevel}/5`),
    x('Vrijwilligers', volunteerFactor(state), `${state.community.volunteers} vrijwilligers (14 = normaal)`),
    x('Populariteit', popularity(state).factor, `clubscore en sfeer`),
  ];
  const k = staffSkill(state, 'kantine');
  if (k) list.push(x('Kantineverantwoordelijke', 1 + k / 300, `vaardigheid ${Math.round(k)}`));
  if (state.infrastructure.sanitairLevel) list.push(x('Sanitair', 1 + state.infrastructure.sanitairLevel * 0.04, `niveau ${state.infrastructure.sanitairLevel}/2`));
  return list;
}

/** Verwachte consumpties van één artikel bij dit aantal bezoekers. */
export function expectedCanteenUnits(state: GameState, id: CanteenItemId, attendance: number): number {
  const def = canteenDef(id);
  const item = state.canteen.items.find((i) => i.id === id);
  if (!item) return 0;
  return attendance * def.perVisitor * product(canteenFactors(state)) * canteenPriceFactor(item.price, def.ref);
}

/** Verwachte besteding per bezoeker aan de toog (voor de schermen). */
export function spendPerHeadCanteen(state: GameState, attendance = 100): number {
  let total = 0;
  for (const item of state.canteen.items) total += expectedCanteenUnits(state, item.id, attendance) * (item.price - canteenDef(item.id).cost);
  return total / Math.max(1, attendance);
}

export function concessionPartner(rng: Rng, id: ConcessionId): string {
  return `${concessionDef(id).label} ${rng.pick(['Dubois', 'Van Hecke', 'Maes', 'De Smet', 'Tanghe', 'Verlinden'])}`;
}

/** Marge die een standhouder aanvaardt: hangt af van je publiek en je kantineverantwoordelijke. */
export function acceptedMargin(state: GameState, id: ConcessionId): number {
  const def = concessionDef(id);
  const pop = popularity(state);
  return Math.round(def.baseMargin + pop.score / 12 + staffSkill(state, 'kantine') / 12);
}

/** Wekelijkse horeca: alleen bij een thuiswedstrijd. Geeft de omzet terug. */
export function bookMatchdayCatering(state: GameState, attendance: number, opponent: string): { canteen: number; concessions: number } {
  const canteen: { id: CanteenItemId; units: number; revenue: number }[] = [];
  let revenue = 0;
  let cost = 0;
  for (const item of state.canteen.items) {
    const units = Math.round(expectedCanteenUnits(state, item.id, attendance));
    const def = canteenDef(item.id);
    canteen.push({ id: item.id, units, revenue: Math.round(units * item.price) });
    revenue += units * item.price;
    cost += units * def.cost;
    state.stats.canteen[item.id] = (state.stats.canteen[item.id] ?? 0) + units;
  }
  state.canteen.lastCanteen = canteen;
  const drinks = canteen.reduce((s, c) => s + c.units, 0);
  book(state, 'kantine', revenue - cost, `Kantine tegen ${opponent} (${drinks} consumpties)`);
  recordOrigin(state, 'kantine', `Kantine op de wedstrijddag tegen ${opponent}`, revenue - cost, [
    { label: 'Toeschouwers', value: attendance / Math.max(1, state.community.fanBase), kind: 'x', source: `${attendance} mensen op het complex` },
    ...spendFactors(state),
  ]);

  const stands: { id: ConcessionId; units: number; revenue: number }[] = [];
  let ownShare = 0;
  for (const c of state.canteen.concessions) {
    const def = concessionDef(c.id);
    // een standhouder verkoopt minder als jij een hoge marge vraagt (hij verhoogt zijn prijzen)
    const units = Math.round(attendance * def.perVisitor * product(canteenFactors(state)) * clamp(1.25 - c.marginPct / 60, 0.45, 1.15));
    const gross = units * def.price;
    stands.push({ id: c.id, units, revenue: Math.round(gross) });
    ownShare += (gross * c.marginPct) / 100;
    state.stats.concessions[c.id] = (state.stats.concessions[c.id] ?? 0) + units;
  }
  state.canteen.lastConcessions = stands;
  if (ownShare > 0) book(state, 'horeca concessies', ownShare, `Kraampjes tegen ${opponent} (${stands.reduce((s, c) => s + c.units, 0)} porties)`);
  return { canteen: revenue - cost, concessions: ownShare };
}

/** Wat een standhouder je per thuiswedstrijd ongeveer opbrengt bij deze marge. */
export function concessionForecast(state: GameState, id: ConcessionId, marginPct: number, attendance: number): number {
  const def = concessionDef(id);
  const units = attendance * def.perVisitor * product(canteenFactors(state)) * clamp(1.25 - marginPct / 60, 0.45, 1.15);
  return round((units * def.price * marginPct) / 100, 5);
}

export { CANTEEN_ITEMS, CONCESSIONS };
