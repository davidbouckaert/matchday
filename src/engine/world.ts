// De wereld rond jouw club: alle andere clubs, over alle reeksen heen.
//
// Geen tweede Football Manager. Elke club houdt zes getallen bij — sterkte, budget, ambitie,
// momentum, accommodatie en jeugdwerking — en neemt één keer per seizoen één beslissing.
// Die beslissing is zichtbaar: in het nieuws van de zomer, in de sterkte van de ploeg die
// je volgend seizoen tegenkomt, en in wie er promoveert of degradeert.

import type { ClubMove, GameState, World, WorldClub } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { DIVISION_CLUBS } from './data/names';
import { OPPONENT_STAFF_BONUS, OWN_TEAM_ID, sortedTable, teamLevel } from './league';

/** Wat een club op dit niveau ruwweg per seizoen kan uitgeven. */
const SEASON_BUDGET = [25_000, 60_000, 140_000, 350_000, 1_200_000, 5_000_000];

const budgetOf = (level: number): number => SEASON_BUDGET[clamp(level, 0, SEASON_BUDGET.length - 1)];

/** Hoeveel clubs er per reeks in de wereld moeten zitten (jij bezet één plaats in de jouwe). */
const clubsPerDivision = (level: number): number => (DIVISIONS[level]?.teams ?? 16) - 1;

/* -------------------------------------------------------------- wereld bouwen */

/** Bouwt de hele voetbalwereld bij een nieuw spel: elke reeks met haar eigen clubs. */
export function buildWorld(rng: Rng): World {
  const clubs: WorldClub[] = [];
  const used = new Set<string>();
  let counter = 0;
  for (let level = 0; level < DIVISIONS.length; level++) {
    let placed = 0;
    for (const name of DIVISION_CLUBS[level] ?? []) {
      if (placed >= clubsPerDivision(level)) break; // de rest blijft in reserve voor later
      if (used.has(name)) continue; // sommige namen komen in twee reeksen voor
      used.add(name);
      clubs.push(makeClub(rng, `w${counter++}`, name, level));
      placed++;
    }
  }
  return { clubs };
}

function makeClub(rng: Rng, id: string, name: string, level: number): WorldClub {
  const ambition = clamp(Math.round(rng.normal(40 + level * 6, 16)), 10, 95);
  return {
    id,
    name,
    divisionLevel: level,
    strength: teamLevel(rng, level, 'eigen'),
    budget: Math.round(budgetOf(level) * rng.range(0.4, 1.4)),
    ambition,
    momentum: 0,
    stadium: clamp(Math.round(level / 2 + rng.int(-1, 1)), 0, 3),
    youth: clamp(Math.round(ambition / 30 + rng.int(-1, 1)), 0, 3),
    trouble: rng.int(0, 25),
    defunct: false,
    lastMove: null,
    seasons: [],
  };
}

/** De clubs die op dit niveau spelen en nog bestaan. */
export function clubsAtLevel(world: World, level: number): WorldClub[] {
  return world.clubs.filter((c) => c.divisionLevel === level && !c.defunct);
}

export function findClub(world: World, id: string): WorldClub | undefined {
  return world.clubs.find((c) => c.id === id);
}

export function clubByName(world: World, name: string): WorldClub | undefined {
  return world.clubs.find((c) => c.name === name && !c.defunct);
}

/* ------------------------------------------------------- beslissing per seizoen */

interface MoveResult {
  move: ClubMove;
  text: string;
}

/** De kosten van elke zet, als deel van wat een seizoen op dit niveau opbrengt. */
const COST = { versterken: 0.45, bouwen: 0.9, jeugd: 0.28 };

/**
 * Eén seizoen voor één club: eerst wat er binnenkwam en buitenging, daarna de beslissing.
 * De eindpositie, het budget en de ambitie bepalen samen wat ze doen.
 */
export function runClubSeason(club: WorldClub, rng: Rng, position: number, teams: number): MoveResult {
  const base = budgetOf(club.divisionLevel);
  const mid = (teams + 1) / 2;
  // momentum: boven de middenmoot loopt het, eronder niet
  club.momentum = clamp(Math.round(club.momentum * 0.4 + (mid - position) * 5), -50, 50);

  // de kas van het seizoen: inkomsten volgen prestaties en accommodatie, uitgaven volgen ambitie
  const earned = base * rng.range(0.38, 0.8) * (1 + club.momentum / 150) * (1 + club.stadium * 0.06);
  const spent = base * (0.3 + club.ambition / 250);
  club.budget = Math.round(club.budget + earned - spent);
  // clubs op dit niveau potten niet op: wat er overblijft gaat naar werking
  club.budget = Math.min(club.budget, Math.round(base * 2.2));

  const move = chooseMove(club, rng, base);
  const text = applyMove(club, rng, move, base);
  // financiële zorgen volgen de kas: rood staan doet pijn, een gezonde kas lucht op
  if (club.budget < 0) club.trouble = clamp(club.trouble + 16, 0, 100);
  else if (club.budget > base * 0.8) club.trouble = clamp(club.trouble - 8, 0, 100);
  club.lastMove = move;
  return { move, text };
}

function chooseMove(club: WorldClub, rng: Rng, base: number): ClubMove {
  if (club.budget < -base * 0.5 || club.trouble >= 85) {
    // echt in nood: opdoeken of overleven
    if (club.trouble >= 80 && club.budget < -base * 0.4 && rng.chance(0.18)) return 'opgedoekt';
    return 'problemen';
  }
  if (club.budget < 0) return 'besparen';

  const options: { move: ClubMove; weight: number }[] = [];
  if (club.budget > base * COST.bouwen && club.stadium < 3) {
    options.push({ move: 'bouwen', weight: (club.ambition / 100) * 1.4 + club.momentum / 120 });
  }
  if (club.budget > base * COST.versterken) {
    options.push({ move: 'versterken', weight: 0.4 + club.ambition / 70 + club.momentum / 90 });
  } else if (club.ambition >= 68 && club.budget > -base * 0.2) {
    // een ambitieus bestuur wacht niet tot het geld er is; dat wreekt zich later
    options.push({ move: 'versterken', weight: 0.25 + (club.ambition - 68) / 60 });
  }
  if (club.budget > base * COST.jeugd && club.youth < 3) {
    options.push({ move: 'jeugd', weight: 0.5 + club.ambition / 140 });
  }
  const rich = club.budget / (base || 1);
  options.push({ move: 'stilzitten', weight: Math.max(0.15, (0.5 + (100 - club.ambition) / 90) / (1 + rich)) });
  if (club.budget < base * 0.3) options.push({ move: 'besparen', weight: 1.2 });

  const usable = options.filter((o) => o.weight > 0);
  const total = usable.reduce((s, o) => s + o.weight, 0);
  let roll = rng.range(0, total);
  for (const o of usable) {
    roll -= o.weight;
    if (roll <= 0) return o.move;
  }
  return 'stilzitten';
}

function applyMove(club: WorldClub, rng: Rng, move: ClubMove, base: number): string {
  switch (move) {
    case 'versterken': {
      const spend = Math.round(base * COST.versterken * rng.range(0.9, 1.3));
      club.budget -= spend;
      club.strength += rng.range(0.9, 2.6) * (0.6 + club.ambition / 120);
      club.trouble = clamp(club.trouble + 4, 0, 100);
      return 'versterkte de kern';
    }
    case 'bouwen': {
      club.budget -= Math.round(base * COST.bouwen * rng.range(0.9, 1.2));
      club.stadium = clamp(club.stadium + 1, 0, 3);
      club.strength += 0.3;
      club.trouble = clamp(club.trouble + 6, 0, 100);
      return 'bouwde aan de accommodatie';
    }
    case 'jeugd': {
      club.budget -= Math.round(base * COST.jeugd * rng.range(0.9, 1.2));
      club.youth = clamp(club.youth + 1, 0, 3);
      return 'breidde de jeugdwerking uit';
    }
    case 'besparen': {
      club.budget += Math.round(base * rng.range(0.2, 0.45));
      club.strength -= rng.range(0.8, 2.2);
      club.trouble = clamp(club.trouble + 5, 0, 100);
      return 'moest de riem aanhalen';
    }
    case 'problemen': {
      club.budget += Math.round(base * rng.range(0.4, 0.9));
      club.strength -= rng.range(1.6, 3.6);
      club.trouble = clamp(club.trouble + 12, 0, 100);
      return 'zit in financiële moeilijkheden';
    }
    case 'opgedoekt': {
      club.defunct = true;
      return 'legde de boeken neer';
    }
    default: {
      club.budget += Math.round(base * 0.06);
      club.trouble = clamp(club.trouble - 6, 0, 100);
      // een club die niets doet, zakt stilaan weg
      club.strength -= rng.range(0, 0.6);
      return 'hield het bij het oude';
    }
  }
}

/**
 * De jeugdwerking werpt vruchten af, en zonder investering zakt een ploeg weg. Daarbovenop
 * trekt elke reeks haar clubs naar haar eigen niveau: wie jaar na jaar investeert wordt een
 * topploeg in zijn reeks, maar geen ploeg uit een andere wereld.
 */
function naturalDrift(club: WorldClub, rng: Rng): void {
  club.strength += club.youth * rng.range(0.05, 0.25) - 0.15;
  const division = DIVISIONS[club.divisionLevel];
  const below = DIVISIONS[club.divisionLevel - 1];
  const band = division.opponentStrength + OPPONENT_STAFF_BONUS;
  club.strength += (band - club.strength) * 0.25;
  const floor = below ? below.opponentStrength + OPPONENT_STAFF_BONUS + 1 : band - 6;
  club.strength = Math.round(clamp(club.strength, floor, band + 9) * 10) / 10;
  club.trouble = clamp(club.trouble - 2, 0, 100);
}

/** Houdt de sterkte binnen de band van de reeks waarin de club nu speelt. */
export function rebaseStrength(club: WorldClub, rng: Rng, origin: 'eigen' | 'promovendus' | 'degradant'): void {
  const target = teamLevel(rng, club.divisionLevel, origin);
  // niet volledig opnieuw loten: de club houdt haar eigen karakter, maar past in de reeks
  const blended = club.strength * 0.45 + target * 0.55;
  const division = DIVISIONS[club.divisionLevel];
  const below = DIVISIONS[club.divisionLevel - 1];
  const floor = below ? below.opponentStrength + 5.5 : division.opponentStrength - 6;
  club.strength = Math.round(clamp(blended, floor, division.opponentStrength + 13) * 10) / 10;
}

/* ------------------------------------------------- promotie en degradatie in de wereld */

const UP_DOWN = 2; // clubs die per grens omhoog en omlaag gaan

/**
 * Het einde van het seizoen voor de hele wereld: iedereen beslist, en daarna schuiven
 * clubs op en af tussen de reeksen. In jouw eigen reeks telt de echte rangschikking;
 * elders wordt de volgorde afgeleid uit sterkte en momentum.
 */
export function runWorldSeason(state: GameState, rng: Rng): { club: string; move: ClubMove; text: string }[] {
  const world = state.world;
  if (!world?.clubs.length) return [];
  const moves: { club: string; move: ClubMove; text: string }[] = [];
  const ownLevel = state.league.divisionLevel;
  const positions = tablePositions(state);

  for (const club of world.clubs) {
    if (club.defunct) continue;
    const teams = clubsPerDivision(club.divisionLevel) + 1;
    const position = positions.get(club.id) ?? guessPosition(world, club, teams);
    club.seasons.push({ season: state.season, divisionLevel: club.divisionLevel, position });
    if (club.seasons.length > 8) club.seasons.shift();
    const result = runClubSeason(club, rng, position, teams);
    naturalDrift(club, rng);
    if (club.divisionLevel === ownLevel || result.move === 'opgedoekt') {
      moves.push({ club: club.name, move: result.move, text: result.text });
    }
  }

  shuffleDivisions(world, rng, positions, ownLevel);
  balanceDivisions(world, rng);
  return moves;
}

/** De echte eindstand van jouw reeks, per wereldclub. */
function tablePositions(state: GameState): Map<string, number> {
  const map = new Map<string, number>();
  const rows = sortedTable(state.league);
  rows.forEach((row, index) => {
    if (row.teamId === OWN_TEAM_ID) return;
    const team = state.league.teams.find((t) => t.id === row.teamId);
    if (team?.clubId) map.set(team.clubId, index + 1);
  });
  return map;
}

/** In de reeksen waar jij niet speelt: de volgorde volgt sterkte en momentum. */
function guessPosition(world: World, club: WorldClub, teams: number): number {
  const peers = clubsAtLevel(world, club.divisionLevel)
    .map((c) => ({ id: c.id, score: c.strength + c.momentum / 10 }))
    .sort((a, b) => b.score - a.score);
  const index = peers.findIndex((p) => p.id === club.id);
  return index < 0 ? Math.ceil(teams / 2) : index + 1;
}

/** Twee clubs omhoog en twee omlaag per grens tussen twee reeksen. */
function shuffleDivisions(world: World, rng: Rng, positions: Map<string, number>, ownLevel: number): void {
  const rank = (club: WorldClub): number => {
    const real = positions.get(club.id);
    if (real !== undefined) return real;
    return guessPosition(world, club, clubsPerDivision(club.divisionLevel) + 1);
  };
  for (let level = 0; level < DIVISIONS.length - 1; level++) {
    const lower = clubsAtLevel(world, level).sort((a, b) => rank(a) - rank(b));
    const upper = clubsAtLevel(world, level + 1).sort((a, b) => rank(b) - rank(a));
    // jouw eigen promotie of degradatie neemt één plaats in: dan verhuist er één club minder
    const count = Math.min(UP_DOWN, lower.length, upper.length);
    const goingUp = lower.slice(0, count);
    const goingDown = upper.slice(0, count);
    for (const club of goingUp) {
      club.divisionLevel = level + 1;
      rebaseStrength(club, rng, 'promovendus');
      club.budget = Math.round(club.budget + budgetOf(level + 1) * 0.2); // promotiepremie
    }
    for (const club of goingDown) {
      club.divisionLevel = level;
      rebaseStrength(club, rng, 'degradant');
      club.trouble = clamp(club.trouble + 8, 0, 100);
    }
    void ownLevel;
  }
}

/**
 * Houdt elke reeks op het juiste aantal clubs. Opgedoekte clubs laten een gat achter,
 * en jouw eigen promotie of degradatie verschuift er ook één. De zwaksten zakken, de
 * sterksten schuiven op, en als het echt niet anders kan komt er een dorpsploeg bij.
 */
function balanceDivisions(world: World, rng: Rng): void {
  const rank = (club: WorldClub): number => club.strength + club.momentum / 10;
  // twee doorgangen waren niet altijd genoeg: een reeks aanvullen maakt haar buur één te
  // kort, en die schuift het probleem door. Nu herhalen we tot alles klopt.
  for (let pass = 0; pass < 8; pass++) {
    const klopt = DIVISIONS.every((_, l) => clubsAtLevel(world, l).length === clubsPerDivision(l));
    if (klopt) break;
    for (let level = 0; level < DIVISIONS.length; level++) {
      const target = clubsPerDivision(level);
      let here = clubsAtLevel(world, level);
      // te veel: de zwaksten zakken, of bij gebrek aan een reeks eronder gaan de sterksten omhoog
      let guard = 0;
      while (here.length > target && guard++ < 40) {
        const sorted = [...here].sort((a, b) => rank(a) - rank(b));
        const down = level > 0 ? sorted[0] : null;
        const up = level < DIVISIONS.length - 1 ? sorted[sorted.length - 1] : null;
        const mover = down ?? up;
        if (!mover) break;
        mover.divisionLevel = mover === down ? level - 1 : level + 1;
        rebaseStrength(mover, rng, mover === down ? 'degradant' : 'promovendus');
        here = clubsAtLevel(world, level);
      }
      // te weinig: haal de beste van onder of de zwakste van boven
      guard = 0;
      while (here.length < target && guard++ < 40) {
        const below = clubsAtLevel(world, level - 1).sort((a, b) => rank(b) - rank(a));
        const above = clubsAtLevel(world, level + 1).sort((a, b) => rank(a) - rank(b));
        // let op de grens: alleen een buur met écht een club te veel mag er één afstaan.
        // Stond hier `- 1`, dan telde een reeks die precies vol zat als overschot, en dan
        // verhuisde het gat alleen maar: reeks 0 haalde er één uit reeks 1, reeks 1 haalde
        // die meteen terug, en na de laatste doorgang bleef er ergens een reeks van vijftien
        // ploegen over. Zo speelde 1ste provinciale vanaf seizoen 11 met een ploeg te weinig.
        const fromBelow = below.length > clubsPerDivision(level - 1) ? below[0] : null;
        const fromAbove = above.length > clubsPerDivision(level + 1) ? above[0] : null;
        const mover = fromBelow ?? fromAbove;
        if (!mover) break;
        const origin = mover === fromBelow ? 'promovendus' : 'degradant';
        mover.divisionLevel = level;
        rebaseStrength(mover, rng, origin);
        here = clubsAtLevel(world, level);
      }
      // nog altijd te weinig: een nieuwe club uit de dorpen erbij
      guard = 0;
      while (here.length < target && guard++ < 20) {
        world.clubs.push(makeClub(rng, `w${world.clubs.length + 100}`, freeClubName(world, level), level));
        here = clubsAtLevel(world, level);
      }
    }
    void pass;
  }
}

/**
 * Een clubnaam die nog vrij is.
 *
 * Hier lekte een reeks weg. Als een club opdoekt en alle namen uit de lijst van dat niveau
 * al in gebruik zijn — na een seizoen of acht is dat normaal — vond dit niets meer en bleef
 * de reeks één club te kort. Die bleef dan voorgoed met vijftien ploegen spelen. Nu putten
 * we eerst uit de andere niveaus, en anders krijgt een dorp er een tweede ploeg bij.
 */
function freeClubName(world: World, level: number): string {
  const bezet = new Set(world.clubs.map((c) => c.name));
  const eigen = DIVISION_CLUBS[level] ?? DIVISION_CLUBS[1];
  const vrij = eigen.find((n) => !bezet.has(n));
  if (vrij) return vrij;
  for (const lijst of DIVISION_CLUBS) {
    const ander = lijst.find((n) => !bezet.has(n));
    if (ander) return ander;
  }
  for (let nummer = 2; nummer < 40; nummer++) {
    const naam = `${eigen[0]} ${nummer}`;
    if (!bezet.has(naam)) return naam;
  }
  return `Nieuwkomer ${world.clubs.length + 1}`;
}

/* ------------------------------------------------------------------ leesbaarheid */

/** Een korte typering van een club, voor de UI. */
export function clubProfile(club: WorldClub): string {
  const ambition = club.ambition >= 70 ? 'ambitieus' : club.ambition >= 45 ? 'degelijk bestuurd' : 'tevreden met wat er is';
  const money = club.trouble >= 70 ? 'financieel in nood' : club.budget > budgetOf(club.divisionLevel) ? 'ruim bij kas' : 'krap bij kas';
  const form = club.momentum >= 20 ? 'in vorm' : club.momentum <= -20 ? 'in slechte papieren' : 'wisselvallig';
  return `${ambition}, ${money}, ${form}`;
}

/** Hoe hun jeugdwerking en accommodatie ervoor staan, in woorden. */
export const LEVEL_WORDS = ['geen', 'bescheiden', 'degelijk', 'sterk'];
