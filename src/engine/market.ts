import type { GameState, StaffRole } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { STAFF_ROLES } from './data/catalog';
import { generatePlayer, marketValue, wageDemand } from './players';
import { PRO_CLUBS } from './data/names';
import { generateStaff, staffSkill } from './staff';
import { isTransferWindow } from './calendar';

/** De markt is altijd in beweging: een algemene trend plus schommelingen per speler. */
export function updateMarket(state: GameState, rng: Rng): void {
  // terugkeer naar 1.0 + ruis + af en toe een schok
  const shock = rng.chance(0.04) ? rng.normal(0, 0.12) : 0;
  state.marketIndex = clamp(state.marketIndex + (1 - state.marketIndex) * 0.08 + rng.normal(0, 0.03) + shock, 0.65, 1.4);

  for (const p of state.players) {
    // prestaties en vorm beïnvloeden de interesse
    const drift = p.form / 200 + (p.morale - 60) / 2000;
    p.bidFactor = clamp(p.bidFactor + (1 - p.bidFactor) * 0.15 + rng.normal(0, 0.05) + drift, 0.6, 1.45);
  }
}

export function refreshTransferList(state: GameState, rng: Rng, full = false): void {
  const division = DIVISIONS[state.league.divisionLevel];
  const scout = staffSkill(state, 'scout');
  const target = 8 + Math.round(scout / 12);
  if (full) state.transferList = [];
  else {
    // een deel van de lijst verdwijnt (anderen kopen ze)
    state.transferList = state.transferList.filter(() => rng.chance(0.7));
  }
  while (state.transferList.length < target) {
    const quality = division.opponentStrength + rng.normal(-1 + scout / 25, 5);
    const young = rng.chance(0.3 + scout / 300);
    const p = generatePlayer(state, rng, {
      quality,
      age: young ? rng.int(17, 21) : undefined,
      season: state.season,
      potentialBoost: scout / 15,
    });
    p.contractUntil = state.season + rng.int(1, 2);
    const freeAgent = rng.chance(0.18);
    const scoutDiscount = 1 - scout / 500;
    p.purchasePrice = freeAgent ? 0 : round(marketValue(p, state.marketIndex) * rng.range(1.0, 1.35) * scoutDiscount, 100);
    state.transferList.push(p);
  }
}

export function refreshStaffMarket(state: GameState, rng: Rng): void {
  const level = state.league.divisionLevel;
  const mean = 42 + level * 7 + state.community.reputation / 10;
  state.staffMarket = [];
  for (const def of STAFF_ROLES) {
    const count = def.role === 'hoofdtrainer' ? 3 : 2;
    for (let i = 0; i < count; i++) state.staffMarket.push(generateStaff(state, rng, def.role as StaffRole, mean));
  }
}

/** Profclubs bieden jonge spelers aan op huurbasis: beter dan je niveau, maar ze vertrekken na het seizoen. */
export function refreshLoanMarket(state: GameState, rng: Rng): void {
  const level = DIVISIONS[state.league.divisionLevel].opponentStrength;
  state.loanMarket = [];
  const n = 3 + Math.round(staffSkill(state, 'scout') / 30);
  for (let i = 0; i < n; i++) {
    const p = generatePlayer(state, rng, { quality: level + rng.range(2, 7), age: rng.int(18, 22), season: state.season, potentialBoost: 6 });
    p.wage = round(wageDemand(state, p) * rng.range(0.3, 0.7), 5); // jouw deel van het loon
    p.purchasePrice = round(marketValue(p, state.marketIndex) * rng.range(0.03, 0.08), 250);
    p.contractUntil = state.season;
    p.loan = { type: 'in', club: rng.pick(PRO_CLUBS), untilSeason: state.season, wageShare: 1 };
    state.loanMarket.push(p);
  }
}

export function weeklyMarket(state: GameState, rng: Rng): void {
  updateMarket(state, rng);
  if (isTransferWindow(state.week)) refreshTransferList(state, rng);
  // huurmarkt: nieuw aanbod bij de start van elke transferperiode (juli en januari)
  const next = (state.week % 52) + 1;
  if (next === 28) refreshLoanMarket(state, rng);
  else if (!isTransferWindow(next)) state.loanMarket = [];
  if (state.week % 4 === 0) refreshStaffMarket(state, rng);
}
