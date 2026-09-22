import type { GameState, Infrastructure } from './types';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { inWinterBreak, isWinter } from './calendar';
import { attendanceFactors, priceFactor, product, spendFactors, volunteerFactor } from './factors';
import { payLoanWeek, sponsorWeekly } from './loans';
import { book, addNews } from './util';
import { bookMatchdayCatering } from './canteen';

export type Weather = 'zon' | 'bewolkt' | 'regen' | 'storm' | 'vriesweer';

export const WEATHER_FACTOR: Record<Weather, number> = { zon: 1.12, bewolkt: 1, regen: 0.78, storm: 0.55, vriesweer: 0.7 };

export { priceFactor, volunteerFactor };

export const SPEND_BASE = 5.5; // euro per toeschouwer bij een gemiddelde kantine

export interface AttendanceInput {
  weather: Weather;
  derby: boolean;
  positionFactor: number; // 0.85 (laag in klassement) .. 1.2 (bovenaan)
}

export function expectedAttendance(state: GameState, input: AttendanceInput): number {
  const base = state.community.fanBase * product(attendanceFactors(state));
  const derby = input.derby ? 1.45 : 1;
  const awayFans = 25 + state.league.divisionLevel * 30;
  const total = base * WEATHER_FACTOR[input.weather] * derby * input.positionFactor + awayFans;
  return Math.round(clamp(total, 30, state.infrastructure.capacity));
}

export function spendPerHead(state: GameState): number {
  return SPEND_BASE * product(spendFactors(state));
}

/** Inkomsten van een thuiswedstrijd. Geeft het aantal toeschouwers terug. */
export const AWAY_SHARE = 0.08; // aandeel van de bezoekende club en de bond in de ticketopbrengst

export function bookHomeMatch(state: GameState, input: AttendanceInput, opponentName: string): number {
  const attendance = expectedAttendance(state, input);
  const gross = attendance * state.ticketPrice;
  book(state, 'tickets', gross, `Tickets vs ${opponentName} (${attendance} × €${state.ticketPrice})`);
  book(state, 'wedstrijdkosten', -gross * AWAY_SHARE, `Aandeel bezoekers en bond (${Math.round(AWAY_SHARE * 100)}% van de ticketverkoop)`);
  bookMatchdayCatering(state, attendance, opponentName);
  book(state, 'wedstrijdkosten', -(250 + 120 + state.league.divisionLevel * 150), `Scheidsrechter en organisatie thuiswedstrijd vs ${opponentName}`);
  state.stats.tickets += attendance;
  state.stats.attendanceHome += attendance;
  state.stats.matchesHome += 1;
  return attendance;
}

export function bookAwayMatch(state: GameState, opponentName: string): void {
  const bus = state.infrastructure.teamBus ? 0.45 : 1; // met een eigen bus betaal je alleen brandstof en chauffeur
  book(state, 'wedstrijdkosten', -(300 + state.league.divisionLevel * 200) * bus, `Busvervoer naar de uitwedstrijd bij ${opponentName}`);
}

/** Wat je per week aan onderhoud en energie kiest te besteden. */
export const MAINTENANCE_FACTOR: Record<Infrastructure['maintenance'], number> = { basis: 0.75, normaal: 1, premium: 1.3 };

export function facilityCost(state: GameState): number {
  const i = state.infrastructure;
  let cost = 730 + i.capacity * 0.34 + (i.pitch === 'natuurgras' ? 430 : 160) + i.kantineLevel * 70 + i.academyLevel * 400;
  cost += i.wifiLevel * 60 + i.sanitairLevel * 80 + i.parkingLevel * 45 + i.recoveryLevel * 90 + i.scoreboardLevel * 55 + (i.teamBus ? 95 : 0);
  if (isWinter(state.week)) cost += 180 * i.lightingLevel + 150;
  cost *= MAINTENANCE_FACTOR[i.maintenance];
  if (i.greenEnergy) cost *= 0.8; // zonnepanelen en ledverlichting
  return Math.round(cost * state.inflation);
}

/** Kans dat er deze week iets stukgaat omdat je te weinig onderhoudt. */
export function breakdownChance(state: GameState): number {
  return state.infrastructure.maintenance === 'basis' ? 0.06 : state.infrastructure.maintenance === 'normaal' ? 0.015 : 0.004;
}

/** Vaste wekelijkse inkomsten en kosten. */
export function bookWeeklyFlows(state: GameState): void {
  // uitgeleende spelers: de andere club betaalt een deel van het loon
  const playerWages = state.players.reduce((s, p) => s + p.wage * (p.loan?.type === 'uit' ? 1 - p.loan.wageShare : 1), 0);
  const staffWages = state.staff.reduce((s, x) => s + x.wage, 0);
  book(state, 'lonen spelers', -playerWages, 'Spelersvergoedingen');
  book(state, 'lonen staff', -staffWages, 'Lonen staff');
  book(state, 'onderhoud & energie', -facilityCost(state), 'Onderhoud terreinen, energie, materiaal');
  book(state, 'onderhoud & energie', -state.community.youthMembers * 3, 'Werking jeugd (materiaal, vergoedingen)');
  book(state, 'sponsors', sponsorWeekly(state), 'Sponsorcontracten');

  // tijdens de winterstop ligt alles stil: geen jeugdwedstrijden, veel minder volk in de kantine
  const breakFactor = inWinterBreak(state.week) ? 0.45 : 1;
  const trainingBar = (380 * (0.8 + state.infrastructure.kantineLevel * 0.1) * volunteerFactor(state) + state.community.youthMembers * 1.2) * breakFactor;
  book(state, 'kantine', trainingBar, inWinterBreak(state.week) ? 'Kantine tijdens de winterstop' : 'Kantine tijdens trainingen en jeugdwedstrijden');

  if (state.infrastructure.pitch === 'kunstgras') book(state, 'verhuur', 650, 'Verhuur kunstgrasveld');

  const tv = DIVISIONS[state.league.divisionLevel].tvRightsPerWeek;
  if (tv > 0) book(state, 'tv-rechten', tv, 'Tv- en radiorechten');

  for (const loan of state.loans) {
    const paid = payLoanWeek(loan);
    book(state, 'aflossingen', -paid, `Afbetaling ${loan.label}`);
    if (loan.remaining <= 0) addNews(state, 'goed', `${loan.label} is volledig afbetaald.`);
  }
  state.loans = state.loans.filter((l) => l.remaining > 0);
}
