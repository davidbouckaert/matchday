// Strategie: training, mentaliteit en spelplannen.
// Spelplannen werken zoals types in Pokémon: elk plan is sterk tegen twee andere en zwak tegen twee andere.

import type { GameState, GamePlan, Mentality, TrainingFocus } from './types';
import { DIVISIONS } from './data/divisions';
import { OWN_TEAM_ID } from './league';

export const PLANS: GamePlan[] = ['balbezit', 'lange bal', 'vleugelspel', 'counter', 'pressing'];

export interface PlanInfo {
  label: string;
  text: string;
  needs: string; // welke spelers je ervoor nodig hebt
  beats: GamePlan[];
  why: Partial<Record<GamePlan, string>>; // waarom dit plan wint van een ander
}

export const PLAN_INFO: Record<GamePlan, PlanInfo> = {
  balbezit: {
    label: 'Balbezit',
    text: 'Geduldig combineren, de bal in de ploeg houden.',
    needs: 'Technische middenvelders en verdedigers.',
    beats: ['lange bal', 'vleugelspel'],
    why: { 'lange bal': 'wie de bal wegtrapt, krijgt hem niet meer terug', vleugelspel: 'centraal overtal, de flankspelers krijgen geen bal' },
  },
  'lange bal': {
    label: 'Lange bal',
    text: 'Snel en direct naar een sterke spits.',
    needs: 'Fysiek sterke aanvallers.',
    beats: ['pressing', 'counter'],
    why: { pressing: 'de bal gaat over de hoge druk heen', counter: 'een laag blok krijgt de ballen in de zestien' },
  },
  vleugelspel: {
    label: 'Vleugelspel',
    text: 'Breed spelen, veel voorzetten.',
    needs: 'Technisch en fysiek sterke aanvallers en middenvelders, een brede formatie (4-3-3, 3-5-2).',
    beats: ['counter', 'lange bal'],
    why: { counter: 'breedte trekt een diep blok uit elkaar', 'lange bal': 'de tegenstander verliest de tweede ballen op de flank' },
  },
  counter: {
    label: 'Counter',
    text: 'Laag blok, snel omschakelen.',
    needs: 'Fysieke aanvallers en een stevige verdediging.',
    beats: ['balbezit', 'pressing'],
    why: { balbezit: 'ruimte in de rug van een opgeschoven ploeg', pressing: 'een hoog drukkende ploeg laat veel ruimte achter' },
  },
  pressing: {
    label: 'Pressing',
    text: 'Hoog druk zetten en de bal snel heroveren.',
    needs: 'Fysiek sterke spelers en veel trainingen. Zonder conditietrainer of focus op conditie: 50% meer blessures.',
    beats: ['balbezit', 'vleugelspel'],
    why: { balbezit: 'de opbouw van achteruit wordt verstoord', vleugelspel: 'de backs krijgen geen tijd om op te komen' },
  },
};

/** +1 = ons plan wint, -1 = ons plan verliest, 0 = neutraal. */
export function matchup(ours: GamePlan, theirs: GamePlan): number {
  if (PLAN_INFO[ours].beats.includes(theirs)) return 1;
  if (PLAN_INFO[theirs].beats.includes(ours)) return -1;
  return 0;
}

/** Hoe een spelplan de sterkte van een tegenstander verdeelt over aanval en verdediging. */
export const PLAN_BIAS: Record<GamePlan, number> = { balbezit: 0.5, 'lange bal': 1, vleugelspel: 1, counter: -1.5, pressing: 0.5 };

export function opponentSide(strength: number, plan: GamePlan): { attack: number; defense: number } {
  return { attack: strength + PLAN_BIAS[plan], defense: strength - PLAN_BIAS[plan] };
}

export const MENTALITY_INFO: Record<Mentality, { att: number; def: number; text: string }> = {
  verdedigend: { att: -2, def: 2, text: 'Minder tegengoals, minder doelpunten.' },
  gebalanceerd: { att: 0, def: 0, text: 'Geen extra risico.' },
  aanvallend: { att: 2.5, def: -2.5, text: 'Meer doelpunten aan beide kanten.' },
};

export const FOCUS_INFO: Record<TrainingFocus, { label: string; text: string }> = {
  conditie: { label: 'Conditie', text: 'Fysiek groeit sneller, +0,5 verdediging, pressing zonder extra blessures.' },
  techniek: { label: 'Techniek', text: 'Techniek groeit sneller, balbezit en vleugelspel werken beter.' },
  tactiek: { label: 'Tactiek', text: 'Voordeel én nadeel van spelplannen tellen 30% zwaarder door.' },
  spelhervattingen: { label: 'Spelhervattingen', text: '+1 aanval dankzij hoekschoppen en vrije trappen.' },
  herstel: { label: 'Herstel', text: '25% minder blessures, geblesseerden genezen sneller, betere moraal.' },
};

export const TRAININGS_MIN = 2;
export const TRAININGS_MAX = 5;

export const TRAINING_INFO: Record<number, string> = {
  2: 'Weinig: frisse en tevreden spelers, maar minder scherp en ze ontwikkelen trager.',
  3: 'Normaal voor 3de nationale.',
  4: 'Veel: scherper en snellere ontwikkeling, maar vermoeider, iets meer blessures, moraal zakt licht.',
  5: 'Semi-profritme: maximale ontwikkeling, maar duur, vermoeid, meer blessures en morrende spelers.',
};

export function trainingCost(state: GameState): number {
  return state.tactics.trainings * (60 + state.league.divisionLevel * 30);
}

/** Scherpte door het aantal trainingen: -0,8 bij 2, +1,6 bij 5. Meer trainingen = wel meer vermoeidheid. */
export function sharpness(trainings: number): number {
  return (trainings - 3) * 0.8;
}

export function developmentFactor(trainings: number): number {
  return 0.55 + trainings * 0.15;
}


export function weeklyMoraleEffect(state: GameState): number {
  const t = state.tactics;
  const byTrainings: Record<number, number> = { 2: 0.3, 3: 0, 4: -0.2, 5: -0.6 };
  return (byTrainings[t.trainings] ?? 0) + (t.focus === 'herstel' ? 0.2 : 0);
}

// ---------- Volgende tegenstander ----------

export interface NextOpponent {
  name: string;
  strength: number;
  home: boolean;
  week: number;
  usualPlan: GamePlan;
  actualPlan: GamePlan; // wat ze echt spelen (enkel zichtbaar met een analist)
  knownPlan: GamePlan; // wat jij verwacht
  certain: boolean;
}

export function nextOpponent(state: GameState): NextOpponent | null {
  const f = state.league.fixtures
    .filter((x) => x.homeGoals === undefined && (x.homeId === OWN_TEAM_ID || x.awayId === OWN_TEAM_ID) && x.week >= state.week)
    .sort((a, b) => a.week - b.week)[0];
  if (!f) return null;
  const home = f.homeId === OWN_TEAM_ID;
  const team = state.league.teams.find((t) => t.id === (home ? f.awayId : f.homeId));
  if (!team) return null;
  const actualPlan = (home ? f.awayPlan : f.homePlan) ?? team.plan;
  const analyst = state.staff.some((s) => s.role === 'analist');
  return {
    name: team.name,
    strength: team.strength,
    home,
    week: f.week,
    usualPlan: team.plan,
    actualPlan,
    knownPlan: analyst ? actualPlan : team.plan,
    certain: analyst,
  };
}

/** Hoe zwaar een voor- of nadeel doorweegt (trainer en trainingsfocus versterken het). */
export function matchupWeight(state: GameState): number {
  const head = state.staff.find((s) => s.role === 'hoofdtrainer');
  const trainer = head ? 0.8 + head.skill / 250 : 0.7;
  return trainer * (state.tactics.focus === 'tactiek' ? 1.3 : 1);
}

export const MATCHUP_ATT = 2;
export const MATCHUP_DEF = 1.2;

export function levelOf(state: GameState): number {
  return DIVISIONS[state.league.divisionLevel].opponentStrength;
}

// ---------- Scoutingrapport ----------

export interface ScoutingReport extends NextOpponent {
  position: number;
  points: number;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  form: ('W' | 'G' | 'V')[]; // laatste 5, oudste eerst
  recentPlans: GamePlan[]; // gespeelde spelplannen in hun laatste 5 wedstrijden
  attack: number;
  defense: number;
  analyst: boolean;
}

export function scoutingReport(state: GameState): ScoutingReport | null {
  const opp = nextOpponent(state);
  if (!opp) return null;
  const team = state.league.teams.find((t) => t.name === opp.name)!;
  const table = [...state.league.table].sort(
    (a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor,
  );
  const row = table.find((r) => r.teamId === team.id)!;
  const played = state.league.fixtures
    .filter((f) => f.homeGoals !== undefined && (f.homeId === team.id || f.awayId === team.id))
    .sort((a, b) => a.week - b.week)
    .slice(-5);
  const form = played.map((f) => {
    const home = f.homeId === team.id;
    const gf = home ? f.homeGoals! : f.awayGoals!;
    const ga = home ? f.awayGoals! : f.homeGoals!;
    return gf > ga ? 'W' : gf < ga ? 'V' : 'G';
  }) as ('W' | 'G' | 'V')[];
  const recentPlans = played.map((f) => (f.homeId === team.id ? f.homePlan : f.awayPlan) ?? team.plan);
  const analyst = state.staff.some((s) => s.role === 'analist');
  const side = opponentSide(team.strength, opp.knownPlan);
  return {
    ...opp,
    position: table.indexOf(row) + 1,
    points: row.points,
    played: row.played,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    form,
    recentPlans,
    attack: Math.round(side.attack * 10) / 10,
    defense: Math.round(side.defense * 10) / 10,
    analyst,
  };
}
