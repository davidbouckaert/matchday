// De seizoensopening: de persconferentie, de voorbeschouwing van de pers en de doelen van het bestuur.
// Eén keer per seizoen, in week 1. Wat je hier belooft, betaal je op het einde van het seizoen terug — of niet.

import type { AmbitionId, GameState, SeasonGoal, SeasonOpening } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { teamStrength } from './players';
import { sponsorWeekly } from './loans';
import { OPPONENT_STAFF_BONUS, OWN_TEAM_ID, sortedTable } from './league';
import { addNews, book } from './util';

// ---------- De persconferentie ----------

export interface AmbitionDef {
  id: AmbitionId;
  label: string;
  quote: string; // wat jij voor de micro zegt
  belofte: string; // waar je op wordt afgerekend
  place: number; // plaats die je moet halen (of beter)
  fanMood: number;
  morale: number;
  satisfaction: number; // tevredenheid van je sponsors
  bonusFactor: number; // premie bij slagen, maal de basispremie van je reeks
  malusFactor: number; // wat het kost als je het niet haalt
  reputation: number; // wat het je reputatie kost bij mislukken
}

export const AMBITIONS: AmbitionDef[] = [
  {
    id: 'bescheiden',
    label: 'Voeten op de grond',
    quote: '"We zijn een kleine club met een kleine begroting. Ons doel is simpel: volgend jaar spelen we hier nog."',
    belofte: 'niet in de degradatiezone eindigen',
    place: -3, // negatief = "niet bij de laatste drie"
    fanMood: -4,
    morale: 6,
    satisfaction: -3,
    bonusFactor: 0.35,
    malusFactor: 0.25,
    reputation: 3,
  },
  {
    id: 'ambitieus',
    label: 'Meedoen voor de prijzen',
    quote: '"Waarom niet wij? We hebben een goede kern, een goede trainer. We mikken op de linkerkolom en dan zien we wel."',
    belofte: 'bij de eerste vijf eindigen',
    place: 5,
    fanMood: 6,
    morale: -2,
    satisfaction: 5,
    bonusFactor: 1,
    malusFactor: 0.6,
    reputation: 6,
  },
  {
    id: 'grootspraak',
    label: 'Wij worden kampioen',
    quote: '"Ik zeg het gewoon: wij gaan hier kampioen spelen. Schrijf dat maar op."',
    belofte: 'kampioen worden',
    place: 1,
    fanMood: 14,
    morale: -8,
    satisfaction: 12,
    bonusFactor: 2,
    malusFactor: 1.2,
    reputation: 14,
  },
];

export const ambitionDef = (id: AmbitionId): AmbitionDef => AMBITIONS.find((a) => a.id === id) ?? AMBITIONS[1];

/** De basispremie waarop de beloning van je belofte gebaseerd is: groter in een hogere reeks. */
export function promiseBase(state: GameState): number {
  const div = DIVISIONS[state.league.divisionLevel];
  // altijd genoeg om iets te betekenen, ook onderaan de ladder
  return Math.round(Math.max(6_000, (6_000 + state.league.divisionLevel * 4_500) * (div.sponsorFactor ?? 1)) * state.inflation);
}

// ---------- De doelen van het bestuur ----------

const round = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** Waar een doel vandaag staat. Tijdens het seizoen zie je dit op je overzicht. */
export function goalProgress(state: GameState, goal: SeasonGoal): { now: number; done: boolean; pct: number } {
  let now = 0;
  switch (goal.kind) {
    case 'plaats': {
      const table = sortedTable(state.league);
      const pos = table.findIndex((r) => r.teamId === OWN_TEAM_ID) + 1;
      now = pos || table.length;
      // voor de eerste speeldag zegt de stand niets: iedereen staat op nul
      const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
      if (!played) return { now, done: false, pct: 0 };
      // lager is beter: het doel is gehaald als je plaats <= target is
      return { now, done: now > 0 && now <= goal.target, pct: clamp((goal.target / Math.max(1, now)) * 100, 0, 100) };
    }
    case 'zeges':
      now = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.won ?? 0;
      break;
    case 'kas':
      now = Math.round(state.cash);
      break;
    case 'inkomsten':
      now = Math.round(
        Object.entries(state.seasonTotals)
          .filter(([k]) => !['leningen', 'investeerder'].includes(k))
          .reduce((sum, [, v]) => sum + Math.max(0, v ?? 0), 0),
      );
      break;
    case 'sponsors':
      now = Math.round(sponsorWeekly(state));
      break;
    case 'jeugd':
      now = state.community.youthMembers;
      break;
    case 'publiek':
      now = state.stats.matchesHome ? Math.round(state.stats.attendanceHome / state.stats.matchesHome) : 0;
      break;
    case 'vrijwilligers':
      now = state.community.volunteers;
      break;
  }
  return { now, done: now >= goal.target, pct: clamp((now / Math.max(1, goal.target)) * 100, 0, 100) };
}

/**
 * Drie doelen, één per categorie van je clubscore. Ze worden berekend op waar je vandaag staat,
 * met een duw erbovenop: haalbaar als je werkt, niet als je niets doet.
 */
export function makeGoals(state: GameState, rng: Rng): SeasonGoal[] {
  const div = DIVISIONS[state.league.divisionLevel];
  const teams = state.league.table.length;
  const strength = teamStrength(state).total;
  const gap = strength - (div.opponentStrength + OPPONENT_STAFF_BONUS);
  const reward = promiseBase(state);

  // sportief
  // nooit slapper dan de linkerkolom: een doel moet iets betekenen
  const target = clamp(Math.round(teams / 2 - gap * 0.8), 1, Math.floor(teams / 2));
  const sportief: SeasonGoal =
    rng.chance(0.5) || state.season === 1
      ? { id: 'g-sport', category: 'sportief', kind: 'plaats', label: `Eindig bij de eerste ${target}`, target, reward: Math.round(reward * 0.9), unit: 'plaats' }
      : { id: 'g-sport', category: 'sportief', kind: 'zeges', label: `Win minstens ${clamp(Math.round(6 + gap * 0.5), 5, 20)} wedstrijden`, target: clamp(Math.round(6 + gap * 0.5), 5, 20), reward: Math.round(reward * 0.9), unit: 'zeges' };

  // financieel: kas of inkomsten, altijd boven waar je nu staat
  const lastIncome = Object.entries(state.lastSeasonTotals)
    .filter(([k]) => !['leningen', 'investeerder'].includes(k))
    .reduce((sum, [, v]) => sum + Math.max(0, v ?? 0), 0);
  const financieel: SeasonGoal =
    lastIncome > 0 && rng.chance(0.6)
      ? {
          id: 'g-geld',
          category: 'financieel',
          kind: 'inkomsten',
          label: `Haal ${euroShort(round(lastIncome * 1.18, 5_000))} inkomsten dit seizoen`,
          target: round(lastIncome * 1.18, 5_000),
          reward,
          unit: '€',
        }
      : {
          id: 'g-geld',
          category: 'financieel',
          kind: 'kas',
          label: `Sluit het seizoen af met ${euroShort(round(Math.max(state.cash * 1.25, 25_000), 5_000))} op de rekening`,
          target: round(Math.max(state.cash * 1.25, 25_000), 5_000),
          reward,
          unit: '€',
        };

  // gemeenschap
  const c = state.community;
  const pool: SeasonGoal[] = [
    { id: 'g-club', category: 'gemeenschap', kind: 'jeugd', label: `Groei naar ${round(c.youthMembers * 1.2 + 15, 5)} jeugdleden`, target: round(c.youthMembers * 1.2 + 15, 5), reward: Math.round(reward * 0.8), unit: 'leden' },
    (() => {
      const last = state.statsHistory[state.statsHistory.length - 1];
      const lastAvg = last?.matchesHome ? last.attendanceHome / last.matchesHome : 0;
      const t = round(Math.max(lastAvg * 1.15, c.fanBase * 0.8, 300), 25);
      return { id: 'g-club', category: 'gemeenschap', kind: 'publiek', label: `Gemiddeld ${t} toeschouwers thuis`, target: t, reward: Math.round(reward * 0.8), unit: 'toeschouwers' } as SeasonGoal;
    })(),
    { id: 'g-club', category: 'gemeenschap', kind: 'vrijwilligers', label: `Bouw je ploeg vrijwilligers uit tot ${Math.round(c.volunteers + 3)}`, target: Math.round(c.volunteers + 3), reward: Math.round(reward * 0.7), unit: 'vrijwilligers' },
  ];
  const gemeenschap = rng.pick(pool);

  return [sportief, financieel, gemeenschap];
}

const euroShort = (n: number) => (n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`);

// ---------- De opening zelf ----------

const PUNDITS = [
  'Het Laatste Nieuwsblad van ’t Vlaamse Land',
  'Sportmagazine Voetbalpraat',
  'de podcast Derde Klasse Café',
  'Radio Tussenlijn',
  'het weekblad De Kantinepraat',
];

/** Wat de pers je toedicht: een plaats en een zinnetje dat je kan uitprinten en boven de deur hangen. */
function pressPreview(state: GameState, rng: Rng): { place: number; quote: string; source: string } {
  const div = DIVISIONS[state.league.divisionLevel];
  const teams = state.league.table.length;
  const gap = teamStrength(state).total - (div.opponentStrength + OPPONENT_STAFF_BONUS);
  const place = clamp(Math.round(teams / 2 - gap * 0.9 + rng.range(-1.2, 1.2)), 1, teams);
  const source = rng.pick(PUNDITS);
  const quote =
    place === 1
      ? `${state.clubName} is de te kloppen ploeg. Alles minder dan de titel is een ontgoocheling.`
      : place <= 3
        ? `${state.clubName} hoort bij de favorieten. Op papier staat daar een ploeg die moet meedoen.`
        : place <= teams / 2
          ? `${state.clubName} kan verrassen, maar mist nog een tandje om echt mee te doen.`
          : place <= teams - 3
            ? `${state.clubName} zal het seizoen vooral gebruiken om zich te handhaven.`
            : `${state.clubName} is onze degradatiefavoriet. De kern is te licht voor deze reeks.`;
  return { place, quote, source };
}

/** Roept de opening in het leven. Wordt gezet in week 1, en pas gesloten als de eigenaar zijn ambitie kiest. */
export function createOpening(state: GameState, rng: Rng, newcomers: string[], summer: string[]): SeasonOpening {
  const press = pressPreview(state, rng);
  // de doelen van het bestuur gelden sowieso; de persconferentie gaat alleen over jouw eigen belofte
  state.seasonGoals = makeGoals(state, rng);
  return {
    season: state.season,
    division: DIVISIONS[state.league.divisionLevel].name,
    pressPlace: press.place,
    pressQuote: press.quote,
    pressSource: press.source,
    newcomers,
    summer,
    goals: state.seasonGoals,
    done: false,
  };
}

/** De eigenaar spreekt. Dit zet de toon voor het hele seizoen, en het is niet meer terug te nemen. */
export function chooseAmbition(state: GameState, id: AmbitionId): void {
  const def = ambitionDef(id);
  const c = state.community;
  state.ambition = id;
  c.fanMood = clamp(c.fanMood + def.fanMood, 0, 100);
  for (const p of state.players) p.morale = clamp(p.morale + def.morale, 0, 100);
  for (const d of state.sponsors) d.satisfaction = clamp(d.satisfaction + def.satisfaction, 0, 100);
  if (state.opening) state.opening.done = true;
  addNews(state, def.id === 'bescheiden' ? 'neutraal' : 'goed', `Persconferentie: ${def.quote} De pers pikt het op, de kantine praat erover.`);
}

// ---------- De afrekening ----------

/** Op het einde van het seizoen: hield je woord stand, en haalde je de doelen van het bestuur? */
export function settleSeason(state: GameState, position: number): { ambition: string; goals: string[]; kept: boolean } {
  const results: string[] = [];
  let ambitionLine = '';
  let keptPromise = false;

  if (state.ambition) {
    const def = ambitionDef(state.ambition);
    const teams = state.league.table.length;
    const kept = def.place < 0 ? position <= teams + def.place : position <= def.place;
    const base = promiseBase(state);
    keptPromise = kept;
    if (kept) {
      const bonus = Math.round(base * def.bonusFactor);
      book(state, 'premies', bonus, `Belofte waargemaakt: ${def.belofte}`);
      state.community.reputation = clamp(state.community.reputation + Math.round(def.reputation * 0.6), 0, 100);
      for (const d of state.sponsors) d.satisfaction = clamp(d.satisfaction + 6, 0, 100);
      ambitionLine = `Je beloofde ${def.belofte} en je deed het. Sponsors en supporters belonen dat met €${bonus.toLocaleString('nl-BE')}.`;
      addNews(state, 'goed', `Belofte waargemaakt (${def.belofte}): €${bonus.toLocaleString('nl-BE')} aan premies en een pak tevreden sponsors.`);
    } else {
      const cost = Math.round(base * def.malusFactor);
      book(state, 'tegenslagen', -cost, `Belofte niet waargemaakt: ${def.belofte}`);
      state.community.reputation = clamp(state.community.reputation - def.reputation, 0, 100);
      state.community.fanMood = clamp(state.community.fanMood - Math.round(def.reputation * 0.8), 0, 100);
      for (const d of state.sponsors) d.satisfaction = clamp(d.satisfaction - 8, 0, 100);
      ambitionLine = `Je beloofde ${def.belofte}. Het werd plaats ${position}. Dat kost je €${cost.toLocaleString('nl-BE')} aan afgesprongen premies en een boel goodwill.`;
      addNews(state, 'slecht', `De belofte van begin dit seizoen (${def.belofte}) is niet waargemaakt. De pers is genadeloos, de sponsors ook.`);
    }
  }

  for (const goal of state.seasonGoals) {
    const p = goalProgress(state, goal);
    if (p.done) {
      book(state, 'premies', goal.reward, `Doel behaald: ${goal.label}`);
      results.push(`✅ ${goal.label} — €${goal.reward.toLocaleString('nl-BE')}`);
    } else {
      const reached = goal.kind === 'plaats' ? `plaats ${p.now}` : goal.unit === '€' ? `€${Math.round(p.now).toLocaleString('nl-BE')}` : `${p.now.toLocaleString('nl-BE')} ${goal.unit}`;
      results.push(`❌ ${goal.label} — het werd ${reached}`);
    }
  }
  const won = state.seasonGoals.filter((g) => goalProgress(state, g).done).length;
  if (state.seasonGoals.length) {
    addNews(
      state,
      won === state.seasonGoals.length ? 'goed' : won ? 'neutraal' : 'slecht',
      `Doelen van het bestuur: ${won} van de ${state.seasonGoals.length} behaald.`,
    );
  }
  if (won === state.seasonGoals.length && won > 0) {
    state.community.reputation = clamp(state.community.reputation + 5, 0, 100);
  }

  return { ambition: ambitionLine, goals: results, kept: keptPromise };
}

export { euroShort };
