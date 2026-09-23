import type { Fixture, GamePlan, GameState, League, OpponentTeam, TableRow, World, WorldClub } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { DIVISION_CLUBS, FIRST_NAMES, LAST_NAMES } from './data/names';
import { MATCH_WEEKS } from './calendar';

/** Ook de tegenstanders hebben een trainer, sfeer en vorm. */
export const OPPONENT_STAFF_BONUS = 4.5;

export const OWN_TEAM_ID = 'club';

/** Je aartsrivaal in deze reeks: de derby waar het dorp een jaar over praat. */
export function rivalTeam(state: GameState): OpponentTeam | undefined {
  return state.league.teams.find((t) => t.isRival);
}

/** De eerstvolgende derby, als die nog op de kalender staat. */
export function nextDerby(state: GameState): { week: number; home: boolean } | null {
  const rival = rivalTeam(state);
  if (!rival) return null;
  const f = state.league.fixtures
    .filter(
      (x) =>
        x.homeGoals === undefined &&
        ((x.homeId === OWN_TEAM_ID && x.awayId === rival.id) || (x.awayId === OWN_TEAM_ID && x.homeId === rival.id)),
    )
    .sort((a, b) => a.week - b.week)[0];
  return f ? { week: f.week, home: f.homeId === OWN_TEAM_ID } : null;
}

/**
 * De sterkte van één tegenstander. Elke reeks ligt duidelijk boven de vorige: de zwakste ploeg
 * van 2de nationale is nog altijd steviger dan de zwakste van 3de. Wie net promoveerde hoort
 * onderaan, wie net degradeerde hoort bij de betere ploegen — en jij, als nieuwkomer, ook onderaan.
 */
export function teamLevel(rng: Rng, divisionLevel: number, origin: 'eigen' | 'promovendus' | 'degradant'): number {
  const division = DIVISIONS[divisionLevel];
  const below = DIVISIONS[divisionLevel - 1];
  const base = division.opponentStrength + OPPONENT_STAFF_BONUS;
  const shift = origin === 'promovendus' ? -3.2 : origin === 'degradant' ? 2.8 : 0;
  // de bodem van deze reeks ligt boven het gemiddelde van de reeks eronder
  const floor = below ? below.opponentStrength + OPPONENT_STAFF_BONUS + 1 : base - 6;
  const value = clamp(rng.normal(base + shift, 3.4), floor, base + 8);
  return Math.round(value * 10) / 10;
}

/**
 * De tegenstanders van één reeks. Elk niveau heeft zijn eigen clubs; twee ploegen komen
 * uit de reeks eronder (net gepromoveerd) en twee uit de reeks erboven (net gedegradeerd),
 * zodat een promotie ook echt een andere wereld is. `carryOver` houdt je aartsrivaal bij je
 * als die samen met jou op- of afzakt.
 */
export function createLeague(rng: Rng, divisionLevel: number, carryOver: string[] = [], world?: World): League {
  if (world?.clubs.length) return leagueFromWorld(rng, divisionLevel, carryOver, world);
  const division = DIVISIONS[divisionLevel];
  const own = DIVISION_CLUBS[divisionLevel] ?? DIVISION_CLUBS[1];
  const below = DIVISION_CLUBS[divisionLevel - 1] ?? [];
  const above = DIVISION_CLUBS[divisionLevel + 1] ?? [];
  const names: { name: string; origin: 'eigen' | 'promovendus' | 'degradant' }[] = [];
  const add = (n: string, origin: 'eigen' | 'promovendus' | 'degradant') => {
    if (n && !names.some((x) => x.name === n) && names.length < division.teams - 1) names.push({ name: n, origin });
  };
  for (const n of carryOver) add(n, 'eigen');
  // net gepromoveerd en net gedegradeerd
  for (let i = 0; i < 2 && below.length; i++) add(rng.pick(below), 'promovendus');
  for (let i = 0; i < 2 && above.length; i++) add(rng.pick(above), 'degradant');
  let guard = 0;
  while (names.length < division.teams - 1 && guard++ < 500) add(rng.pick(own), 'eigen');
  // mocht een reeks te klein zijn: vul aan met de buren
  for (const pool of [below, above, DIVISION_CLUBS[1]]) {
    for (const n of pool) add(n, 'eigen');
  }

  // precies één aartsrivaal: de club van het dorp ernaast
  const rivalIndex = carryOver.length ? 0 : rng.int(0, names.length - 1);
  const teams: OpponentTeam[] = names.map((entry, i) => ({
    id: `t${i}`,
    name: entry.name,
    strength: teamLevel(rng, divisionLevel, entry.origin),
    isRival: i === rivalIndex,
    plan: rng.pick(PLAN_LIST),
    roster: makeRoster(rng),
    clubId: '',
  }));
  return assemble(rng, divisionLevel, teams);
}

/**
 * De reeks samengesteld uit de clubs die in de wereld op dit niveau spelen. Hun sterkte
 * komt uit hun eigen geschiedenis — wie vorig seizoen investeerde, staat er nu beter voor.
 */
function leagueFromWorld(rng: Rng, divisionLevel: number, carryOver: string[], world: World): League {
  const division = DIVISIONS[divisionLevel];
  const need = division.teams - 1;
  const pool = world.clubs.filter((c) => c.divisionLevel === divisionLevel && !c.defunct);
  const chosen: WorldClub[] = [];
  for (const name of carryOver) {
    const club = pool.find((c) => c.name === name);
    if (club && !chosen.includes(club)) chosen.push(club);
  }
  for (const club of pool) {
    if (chosen.length >= need) break;
    if (!chosen.includes(club)) chosen.push(club);
  }
  // mocht de reeks te dun zijn: leen bij de buren
  for (const level of [divisionLevel - 1, divisionLevel + 1]) {
    if (chosen.length >= need) break;
    for (const club of world.clubs.filter((c) => c.divisionLevel === level && !c.defunct)) {
      if (chosen.length >= need) break;
      if (!chosen.includes(club)) chosen.push(club);
    }
  }
  const rivalIndex = carryOver.length ? 0 : chosen.length ? rng.int(0, chosen.length - 1) : 0;
  const teams: OpponentTeam[] = chosen.map((club, i) => ({
    id: `t${i}`,
    name: club.name,
    strength: club.strength,
    isRival: i === rivalIndex,
    plan: rng.pick(PLAN_LIST),
    roster: makeRoster(rng),
    clubId: club.id,
  }));
  return assemble(rng, divisionLevel, teams);
}

/** Kalender, rangschikking en spelplannen rond een gegeven reeks tegenstanders. */
function assemble(rng: Rng, divisionLevel: number, teams: OpponentTeam[]): League {
  const ids = [OWN_TEAM_ID, ...teams.map((t) => t.id)];
  const fixtures = roundRobin(ids, rng);
  assignMatchPlans(fixtures, teams, rng);
  return {
    divisionLevel,
    teams,
    fixtures,
    discipline: [],
    table: ids.map((teamId) => ({ teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })),
  };
}

/** Dubbele competitie volgens de cirkelmethode. */
function roundRobin(ids: string[], rng: Rng): Fixture[] {
  const teams = [...ids];
  // schud voor variatie
  for (let i = teams.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }
  const n = teams.length;
  const rounds: Fixture[][] = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // wisselen tussen thuis en uit, zodat niemand lang na elkaar uit speelt
      const home = i === 0 ? (r % 2 === 0 ? a : b) : i % 2 === 0 ? a : b;
      const away = home === a ? b : a;
      round.push({ round: r + 1, week: MATCH_WEEKS[r], homeId: home, awayId: away });
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = rounds.map((round, r) =>
    round.map((f) => ({ round: n + r, week: MATCH_WEEKS[n - 1 + r], homeId: f.awayId, awayId: f.homeId })),
  );
  return [...rounds.flat(), ...second.flat()];
}

/** 18 namen per tegenstander, enkel gebruikt voor het tuchtoverzicht. */
function makeRoster(rng: Rng): string[] {
  const names = new Set<string>();
  while (names.size < 18) names.add(`${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`);
  return [...names];
}

const PLAN_LIST: GamePlan[] = ['balbezit', 'lange bal', 'vleugelspel', 'counter', 'pressing'];

/** Meestal spelen tegenstanders hun gewone spelplan, soms (25%) verrassen ze. */
export function assignMatchPlans(fixtures: Fixture[], teams: OpponentTeam[], rng: Rng): void {
  const planOf = (id: string) => {
    const team = teams.find((t) => t.id === id);
    if (!team) return undefined;
    return rng.chance(0.75) ? team.plan : rng.pick(PLAN_LIST);
  };
  for (const f of fixtures) {
    f.homePlan = planOf(f.homeId);
    f.awayPlan = planOf(f.awayId);
  }
}

export function teamName(state: GameState, id: string): string {
  if (id === OWN_TEAM_ID) return state.clubName;
  return state.league.teams.find((t) => t.id === id)?.name ?? '?';
}

export function sortedTable(league: League): TableRow[] {
  return [...league.table].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor,
  );
}

export function ownPosition(league: League): number {
  return sortedTable(league).findIndex((r) => r.teamId === OWN_TEAM_ID) + 1;
}

/** Wat er met een club gebeurt als de stand zo blijft. */
export type Zone = 'kampioen' | 'promotie' | 'degradatie' | 'behoud';

/**
 * In welke zone staat deze plaats?
 *
 * Eén plek waar dit staat, want het einde van het seizoen rekent ermee (`seasonEnd`) en
 * de kopbalk kleurt je plaats ermee. Stonden die twee los van elkaar, dan zou de kopbalk
 * je een degradatieplaats kunnen aanwijzen die de engine niet als degradatie afrekent.
 */
export function zoneAt(league: League, position: number, divisionLevel: number, divisions: number): Zone {
  const teams = league.table.length;
  if (position === 1 && divisionLevel < divisions - 1) return 'kampioen';
  if (position === 2 && divisionLevel < divisions - 1) return 'promotie';
  if (position >= teams - 2 && divisionLevel > 0) return 'degradatie';
  return 'behoud';
}

export interface Side {
  attack: number;
  defense: number;
}

/** Simuleert één wedstrijd (Poisson): de aanval van de ene ploeg tegen de verdediging van de andere. */
/** Thuisvoordeel: eigen veld, eigen publiek, geen busrit. Klein maar merkbaar. */
export const HOME_ADVANTAGE = 1.6;

export function simulateMatch(rng: Rng, home: Side, away: Side): [number, number] {
  const h = { attack: home.attack + HOME_ADVANTAGE, defense: home.defense + HOME_ADVANTAGE * 0.6 };
  const a = { attack: away.attack - HOME_ADVANTAGE * 0.4, defense: away.defense };
  const homeLambda = clamp(1.4 * Math.exp(((h.attack - a.defense) / 12) * 0.9), 0.2, 4.5);
  const awayLambda = clamp(1.1 * Math.exp(((a.attack - h.defense) / 12) * 0.9), 0.15, 4);
  return [rng.poisson(homeLambda), rng.poisson(awayLambda)];
}

export const side = (strength: number): Side => ({ attack: strength, defense: strength });

export function applyResult(league: League, f: Fixture): void {
  const home = league.table.find((r) => r.teamId === f.homeId)!;
  const away = league.table.find((r) => r.teamId === f.awayId)!;
  const hg = f.homeGoals!;
  const ag = f.awayGoals!;
  home.played++;
  away.played++;
  home.goalsFor += hg;
  home.goalsAgainst += ag;
  away.goalsFor += ag;
  away.goalsAgainst += hg;
  if (hg > ag) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (hg < ag) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points++;
    away.points++;
  }
}

export function opponentStrength(league: League, id: string): number {
  return league.teams.find((t) => t.id === id)?.strength ?? 50;
}
