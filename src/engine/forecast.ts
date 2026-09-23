// Kasprognose: wat er de komende weken staat aan te komen.
//
// Alleen wat nu al vastligt of goed te schatten is — lonen, onderhoud, sponsorcontracten,
// aflossingen, de vaste momenten in het jaar, en per wedstrijd een raming van de kassa en
// de kantine. Geen toeval, geen gokwerk: de prognose is bedoeld om te plannen, niet om te
// voorspellen. Alles hier is puur rekenwerk; er wordt niets aan de spelstand veranderd.

import type { GameState, LedgerCategory } from './types';
import { DIVISIONS } from './data/divisions';
import { BOND_FEE_WEEK, SUBSIDY_WEEK, WEEKS_PER_YEAR, inWinterBreak, isWinter } from './calendar';
import { OWN_TEAM_ID } from './league';
import { AWAY_SHARE, MATCH_FEE_SHARE, YOUTH_TEAM_COST, expectedAttendance, facilityCost, spendPerHead } from './finance';
import { sponsorWeekly } from './loans';
import { trainingCost } from './strategy';
import { volunteerFactor } from './factors';
import { subsidyFactor } from './career';
import { YOUTH_FEE_WEEK, youthForecast } from './actions';

export interface ForecastLine {
  category: LedgerCategory;
  label: string;
  amount: number; // positief = inkomst, negatief = kost
  /** Een raming in plaats van een vast bedrag (wedstrijdinkomsten hangen af van het weer en de opkomst). */
  estimate?: boolean;
}

export interface ForecastWeek {
  season: number;
  week: number;
  match: 'thuis' | 'uit' | null;
  opponent: string;
  lines: ForecastLine[];
  income: number;
  costs: number;
  net: number;
  balance: number; // verwacht saldo op het einde van die week
}

export interface Forecast {
  weeks: ForecastWeek[];
  net: number; // wat er over de hele periode bij- of afgaat
  lowest: { season: number; week: number; balance: number };
  /** De eerste week waarin je onder nul zou duiken, als die er is. */
  trouble: { season: number; week: number } | null;
}

export const FORECAST_WEEKS = 8;

/** Het weer dat je gemiddeld mag verwachten; voor een prognose nemen we een gewone dag. */
const TYPICAL_WEATHER = 'bewolkt';

/**
 * De komende weken doorrekenen. `weeks` is standaard acht: ver genoeg om een bouwproject
 * of een dure maand te zien aankomen, dichtbij genoeg om nog te kloppen.
 */
export function forecast(state: GameState, weeks = FORECAST_WEEKS): Forecast {
  const out: ForecastWeek[] = [];
  let balance = state.cash;
  let lowest = { season: state.season, week: state.week, balance };
  let trouble: { season: number; week: number } | null = null;

  for (let i = 0; i < weeks; i++) {
    const absolute = state.week + i;
    const season = state.season + Math.floor((absolute - 1) / WEEKS_PER_YEAR);
    const week = ((absolute - 1) % WEEKS_PER_YEAR) + 1;
    if (season > state.season) break; // over de seizoensgrens heen verandert te veel om te ramen

    const entry = weekLines(state, week, i);
    const income = entry.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const costs = entry.lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
    const net = income + costs;
    balance += net;
    if (balance < lowest.balance) lowest = { season, week, balance };
    if (balance < 0 && !trouble) trouble = { season, week };
    out.push({ season, week, match: entry.match, opponent: entry.opponent, lines: entry.lines, income, costs, net, balance });
  }

  return { weeks: out, net: balance - state.cash, lowest, trouble };
}

/** Wat er in één bepaalde week op de rekening zou komen en afgaan. */
function weekLines(state: GameState, week: number, offset: number): { lines: ForecastLine[]; match: 'thuis' | 'uit' | null; opponent: string } {
  const lines: ForecastLine[] = [];
  const add = (category: LedgerCategory, label: string, amount: number, estimate = false) => {
    if (Math.round(amount) !== 0) lines.push({ category, label, amount: Math.round(amount), estimate });
  };

  const fixture = state.league.fixtures.find((f) => f.week === week && f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID));
  const home = fixture?.homeId === OWN_TEAM_ID;
  const match: 'thuis' | 'uit' | null = fixture ? (home ? 'thuis' : 'uit') : null;
  const opponentId = fixture ? (home ? fixture.awayId : fixture.homeId) : '';
  const opponentTeam = state.league.teams.find((t) => t.id === opponentId);
  const opponent = opponentTeam?.name ?? '';

  // --- vaste wekelijkse stromen (zie bookWeeklyFlows) ---
  const share = fixture ? 1 : 1 - MATCH_FEE_SHARE;
  const playerWages = state.players.reduce((s, p) => s + p.wage * share * (p.loan?.type === 'uit' ? 1 - p.loan.wageShare : 1), 0);
  add('lonen spelers', fixture ? 'Spelersvergoedingen (met wedstrijdpremie)' : 'Spelersvergoedingen (vast deel)', -playerWages);
  add('lonen personeel', 'Lonen personeel', -state.staff.reduce((s, x) => s + x.wage, 0));
  add('onderhoud & energie', 'Onderhoud, energie en materiaal', -facilityForWeek(state, week));
  add('onderhoud & energie', `Werking jeugd (${state.community.youthTeams} ploegen)`, -(state.community.youthMembers * 3 + state.community.youthTeams * YOUTH_TEAM_COST));
  add('sponsors', 'Sponsorcontracten', sponsorWeekly(state));
  add('trainingen', `${state.tactics.trainings} trainingen`, -trainingCost(state));

  const breakFactor = inWinterBreak(week) ? 0.45 : 1;
  const trainingBar = (380 * (0.8 + state.infrastructure.kantineLevel * 0.1) * volunteerFactor(state) + state.community.youthMembers * 1.2) * breakFactor;
  add('kantine', inWinterBreak(week) ? 'Kantine tijdens de winterstop' : 'Kantine bij trainingen en jeugd', trainingBar);

  if (state.infrastructure.pitch === 'kunstgras') add('verhuur', 'Verhuur kunstgrasveld', 650);
  const tv = DIVISIONS[state.league.divisionLevel].tvRightsPerWeek;
  if (tv > 0) add('tv-rechten', 'Tv- en radiorechten', tv);

  // --- aflossingen: alleen zolang de lening loopt ---
  for (const loan of state.loans) {
    if (loan.weeksLeft > offset) add('aflossingen', `Afbetaling ${loan.label}`, -loan.weeklyPayment);
  }

  // --- wedstrijd van die week ---
  if (fixture && home) {
    const attendance = expectedAttendance(state, { weather: TYPICAL_WEATHER, derby: !!opponentTeam?.isRival, positionFactor: 1 });
    const gross = attendance * state.ticketPrice;
    add('tickets', `Tickets vs ${opponent} (± ${attendance} toeschouwers)`, gross, true);
    add('wedstrijdkosten', 'Aandeel bezoekers en bond', -gross * AWAY_SHARE, true);
    add('kantine', `Kantine op de wedstrijddag vs ${opponent}`, attendance * spendPerHead(state) * CATERING_MARGIN, true);
    add('wedstrijdkosten', `Scheidsrechter en organisatie vs ${opponent}`, -(250 + 120 + state.league.divisionLevel * 150));
  } else if (fixture) {
    const bus = state.infrastructure.teamBus ? 0.45 : 1;
    add('wedstrijdkosten', `Busvervoer naar ${opponent}`, -(300 + state.league.divisionLevel * 200) * bus);
  }

  // --- vaste momenten in het jaar (zie scheduledPayments) ---
  if (week === BOND_FEE_WEEK) {
    const fee = (5000 + state.players.length * 150 + state.community.youthMembers * 22 + state.community.youthTeams * 400) * (1 + state.league.divisionLevel * 0.35) * state.inflation;
    add('bond & verzekering', 'Aansluiting bond en verzekeringen', -fee);
  }
  if (week === YOUTH_FEE_WEEK) {
    add('lidgelden', `Lidgelden jeugd (± ${youthForecast(state)} × €${state.youthFee})`, youthForecast(state) * state.youthFee, true);
  }
  if (week === SUBSIDY_WEEK) {
    add('subsidies', 'Subsidie gemeente', (8000 + state.community.youthMembers * 25) * (1 + state.league.divisionLevel * 0.12) * subsidyFactor(state));
  }

  // --- opbrengsten die al onderweg zijn ---
  for (const p of state.pending) {
    if (p.weeksLeft === offset + 1) add(p.category, p.label, p.amount);
  }

  return { lines, match, opponent };
}

/** De kantinemarge op een wedstrijddag; ruwweg wat er van de omzet overblijft. */
const CATERING_MARGIN = 0.45;

/** Onderhoud hangt af van de week: in de winter branden de lichten langer. */
function facilityForWeek(state: GameState, week: number): number {
  if (isWinter(week) === isWinter(state.week)) return facilityCost(state);
  // zelfde berekening, maar met het seizoen van die week
  const shifted = { ...state, week } as GameState;
  return facilityCost(shifted);
}

/** De grootste posten van een week, voor wie alleen de kern wil zien. */
export function topLines(week: ForecastWeek, count = 5): ForecastLine[] {
  return [...week.lines].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, count);
}
