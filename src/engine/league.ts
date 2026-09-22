import type { Fixture, GamePlan, GameState, League, OpponentTeam, TableRow } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { FIRST_NAMES, LAST_NAMES, OPPONENT_NAMES, PRO_CLUBS } from './data/names';
import { MATCH_WEEKS } from './calendar';

export const OWN_TEAM_ID = 'club';

export function createLeague(rng: Rng, divisionLevel: number): League {
  const division = DIVISIONS[divisionLevel];
  const pool = divisionLevel >= 4 ? [...PRO_CLUBS, ...OPPONENT_NAMES] : [...OPPONENT_NAMES];
  const names: string[] = [];
  while (names.length < division.teams - 1) {
    const n = rng.pick(pool);
    if (!names.includes(n)) names.push(n);
  }
  const teams: OpponentTeam[] = names.map((name, i) => ({
    id: `t${i}`,
    name,
    strength: Math.round(rng.normal(division.opponentStrength, 4.5) * 10) / 10,
    isRival: i < 2, // de twee dichtstbijzijnde clubs zijn derby's
    plan: rng.pick(PLAN_LIST),
    roster: makeRoster(rng),
  }));
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

export interface Side {
  attack: number;
  defense: number;
}

/** Simuleert één wedstrijd (Poisson): de aanval van de ene ploeg tegen de verdediging van de andere. */
export function simulateMatch(rng: Rng, home: Side, away: Side): [number, number] {
  const homeLambda = clamp(1.4 * Math.exp(((home.attack - away.defense) / 12) * 0.9), 0.2, 4.5);
  const awayLambda = clamp(1.1 * Math.exp(((away.attack - home.defense) / 12) * 0.9), 0.15, 4);
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
