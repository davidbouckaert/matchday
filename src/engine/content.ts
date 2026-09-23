// De uitvoerder van alles wat in src/content staat.
//
// De contentbestanden bevatten alleen data: voorwaarden, effecten, teksten met plaatshouders.
// Dit bestand vertaalt die data naar wijzigingen in de spelstand. Zo hoeft er voor een nieuw
// weekmoment of een nieuwe gebeurtenis niets aan de simulatie te veranderen.

import type { Effect, Getal, Meting, NieuwsSjabloon, SpelerKeuze, Vlag, Voorwaarde } from '../content/types';
import type { GameState, Player } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { MATCH_WEEKS, inWinterBreak, isTransferWindow, isWinter } from './calendar';
import { OWN_TEAM_ID, ownPosition, rivalTeam } from './league';
import { available } from './discipline';
import { addNews, book, euro } from './util';

/** Wat er deze week aan de hand is; hierop toetsen de voorwaarden. */
export interface WorldCtx {
  match: boolean;
  home: boolean;
  derby: boolean;
  opponent: string;
}

/** Waar een moment of gebeurtenis zich op richt: één speler, één sponsor. */
export interface Focus {
  playerId?: string | null;
  sponsorId?: string | null;
}

export function worldContext(state: GameState): WorldCtx {
  const f = state.league.fixtures.find(
    (x) => x.week === state.week && x.homeGoals === undefined && (x.homeId === OWN_TEAM_ID || x.awayId === OWN_TEAM_ID),
  );
  if (!f) return { match: false, home: false, derby: false, opponent: '' };
  const home = f.homeId === OWN_TEAM_ID;
  const oppId = home ? f.awayId : f.homeId;
  const rival = rivalTeam(state);
  return {
    match: true,
    home,
    derby: !!rival && rival.id === oppId,
    opponent: state.league.teams.find((t) => t.id === oppId)?.name ?? 'de tegenstander',
  };
}

/* ------------------------------------------------------------------ getallen */

const KLASSE_STAP = 0.12;

/** Rekent een `Getal` uit de contentdata om naar een concreet getal. */
export function value(state: GameState, rng: Rng, getal: Getal): number {
  if (typeof getal === 'number') return getal;
  let v = getal.heel ? rng.int(getal.heel[0], getal.heel[1]) : (getal.basis ?? 0);
  if (getal.maal !== undefined) v *= getal.maal;
  switch (getal.per) {
    case 'jeugdploegen':
      v *= state.community.youthTeams;
      break;
    case 'ticketprijs':
      v *= state.ticketPrice;
      break;
    case 'supporters':
      v *= state.community.fanBase;
      break;
    case 'vrijwilligers':
      v *= state.community.volunteers;
      break;
    case 'sponsors':
      v *= state.sponsors.length;
      break;
    case 'spelers':
      v *= state.players.length;
      break;
    default:
      break;
  }
  if (getal.inflatie) v *= state.inflation;
  if (getal.klasse) v *= 1 + state.league.divisionLevel * KLASSE_STAP;
  if (getal.spreiding) v *= rng.range(getal.spreiding[0], getal.spreiding[1]);
  const step = getal.afronden ?? 1;
  return Math.round(v / step) * step;
}

/* --------------------------------------------------------------- voorwaarden */

function flag(state: GameState, ctx: WorldCtx, name: Vlag): boolean {
  switch (name) {
    case 'match':
      return ctx.match;
    case 'thuis':
      return ctx.match && ctx.home;
    case 'uit':
      return ctx.match && !ctx.home;
    case 'derby':
      return ctx.derby;
    case 'winter':
      return isWinter(state.week);
    case 'winterstop':
      return inWinterBreak(state.week);
    case 'transferperiode':
      return isTransferWindow(state.week);
    case 'natuurgras':
      return state.infrastructure.pitch === 'natuurgras';
    case 'teambus':
      return state.infrastructure.teamBus;
    case 'basisonderhoud':
      return state.infrastructure.maintenance === 'basis';
    case 'investeerderActief':
      return state.investorActive;
    case 'gepromoveerd':
      return lastResult(state) === 'promotie' || lastResult(state) === 'kampioen';
    case 'gedegradeerd':
      return lastResult(state) === 'degradatie';
    default:
      return false;
  }
}

function lastResult(state: GameState): string {
  return state.history.length ? state.history[state.history.length - 1].result : '';
}

export function metric(state: GameState, name: Meting): number {
  switch (name) {
    case 'week':
      return state.week;
    case 'seizoen':
      return state.season;
    case 'klasse':
      return state.league.divisionLevel;
    case 'kas':
      return state.cash;
    case 'schuld':
      return state.loans.reduce((sum, l) => sum + l.remaining, 0);
    case 'sfeer':
      return state.community.fanMood;
    case 'reputatie':
      return state.community.reputation;
    case 'supporters':
      return state.community.fanBase;
    case 'vrijwilligers':
      return state.community.volunteers;
    case 'vrijwilligerstrouw':
      return state.community.volunteerLoyaltyWeeks;
    case 'jeugdploegen':
      return state.community.youthTeams;
    case 'leden':
      return state.community.youthMembers;
    case 'capaciteit':
      return state.infrastructure.capacity;
    case 'kantineniveau':
      return state.infrastructure.kantineLevel;
    case 'onderhoudsniveau':
      return state.infrastructure.maintenance === 'basis' ? 0 : state.infrastructure.maintenance === 'normaal' ? 1 : 2;
    case 'sponsors':
      return state.sponsors.length;
    case 'spelers':
      return state.players.length;
    case 'fitteSpelers':
      return available(state.players).length;
    case 'hoogsteVermoeidheid':
      return state.players.reduce((max, p) => (p.injuryWeeks === 0 && p.fatigue > max ? p.fatigue : max), 0);
    case 'laagsteMoraal':
      return state.players.reduce((min, p) => Math.min(min, p.morale), 100);
    case 'ploegsterkte':
      return DIVISIONS[state.league.divisionLevel]?.opponentStrength ?? 50;
    case 'stand':
      return ownPosition(state.league) || 99;
    default:
      return 0;
  }
}

function between(v: number, min?: number, max?: number): boolean {
  if (min !== undefined && v < min) return false;
  if (max !== undefined && v > max) return false;
  return true;
}

/** Toetst een voorwaarde uit de contentdata aan de spelstand. */
export function test(state: GameState, ctx: WorldCtx, cond: Voorwaarde | undefined, vars: Record<string, string> = {}): boolean {
  if (!cond) return true;
  if ('vlag' in cond) return flag(state, ctx, cond.vlag) === (cond.is ?? true);
  if ('meting' in cond) return between(metric(state, cond.meting), cond.min, cond.max);
  if ('variabele' in cond) {
    const raw = vars[cond.variabele];
    if (raw === undefined) return false;
    const n = Number(raw.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && between(n, cond.min, cond.max);
  }
  if ('verhaal' in cond) return (state.storylines ?? []).some((x) => x.name === cond.verhaal && x.weeksLeft > 0);
  if ('alle' in cond) return cond.alle.every((c) => test(state, ctx, c, vars));
  if ('een' in cond) return cond.een.some((c) => test(state, ctx, c, vars));
  if ('niet' in cond) return !test(state, ctx, cond.niet, vars);
  return true;
}

/* ------------------------------------------------------------------- spelers */

/** Zoekt de speler waar een effect op slaat. */
export function pickPlayer(state: GameState, rng: Rng, keuze: SpelerKeuze, focus?: Focus): Player | undefined {
  if (keuze === 'focus') {
    const found = state.players.find((p) => p.id === focus?.playerId);
    if (found) return found;
  }
  const fit = state.players.filter((p) => p.injuryWeeks === 0);
  const pool = fit.length ? fit : state.players;
  if (!pool.length) return undefined;
  switch (keuze) {
    case 'moeist':
      return [...pool].sort((a, b) => b.fatigue - a.fatigue)[0];
    case 'laagsteMoraal':
      return [...state.players].sort((a, b) => a.morale - b.morale)[0];
    case 'beste':
      return [...pool].sort((a, b) => b.potential - a.potential)[0];
    case 'jongste':
      return [...pool].sort((a, b) => a.age - b.age)[0];
    default:
      return rng.pick(pool);
  }
}

/* -------------------------------------------------------------------- effect */

/**
 * Voert een reeks effecten uit en geeft de plaatshouders terug die ze opleverden
 * ({bedrag}, {aantal}, {speler}, {sponsor}, {weken}), zodat de tekst erna ingevuld kan worden.
 */
export function apply(
  state: GameState,
  rng: Rng,
  effects: Effect[] | undefined,
  focus?: Focus,
  ctx: WorldCtx = worldContext(state),
  vars: Record<string, string> = {},
  booked = { total: 0 },
): Record<string, string> {
  for (const e of effects ?? []) {
    if ('boek' in e) {
      const amount = value(state, rng, e.bedrag);
      book(state, e.boek, amount, e.reden);
      booked.total += Math.abs(amount);
      vars.bedrag = euro(booked.total);
    } else if ('sfeer' in e) {
      state.community.fanMood = clamp(state.community.fanMood + value(state, rng, e.sfeer), 0, 100);
    } else if ('reputatie' in e) {
      state.community.reputation = clamp(state.community.reputation + value(state, rng, e.reputatie), 0, 100);
    } else if ('supporters' in e) {
      const n = value(state, rng, e.supporters);
      state.community.fanBase = Math.max(0, state.community.fanBase + n);
      vars.aantal = String(Math.abs(n));
    } else if ('vrijwilligers' in e) {
      const n = value(state, rng, e.vrijwilligers);
      state.community.volunteers = Math.max(2, state.community.volunteers + n);
      vars.aantal = String(Math.abs(n));
    } else if ('vrijwilligerstrouw' in e) {
      state.community.volunteerLoyaltyWeeks = Math.max(state.community.volunteerLoyaltyWeeks, e.vrijwilligerstrouw);
    } else if ('moraalIedereen' in e) {
      const d = value(state, rng, e.moraalIedereen);
      for (const p of state.players) p.morale = clamp(p.morale + d, 0, 100);
    } else if ('vermoeidheidIedereen' in e) {
      const d = value(state, rng, e.vermoeidheidIedereen);
      for (const p of state.players) p.fatigue = clamp(p.fatigue + d, 0, 100);
    } else if ('speler' in e) {
      const p = pickPlayer(state, rng, e.speler, focus);
      if (!p) continue;
      vars.speler = p.name;
      if (e.moraal !== undefined) p.morale = clamp(p.morale + value(state, rng, e.moraal), 0, 100);
      if (e.vermoeidheid !== undefined) p.fatigue = clamp(p.fatigue + value(state, rng, e.vermoeidheid), 0, 100);
      if (e.blessure !== undefined) {
        const w = Math.max(1, value(state, rng, e.blessure));
        p.injuryWeeks = Math.max(p.injuryWeeks, w);
        vars.weken = String(w);
      }
      if (e.uitBasis) {
        state.tactics.manualXI = state.tactics.manualXI.filter((id) => id !== p.id);
        state.tactics.benched = [...new Set([...state.tactics.benched, p.id])];
      }
    } else if ('sponsor' in e) {
      const pool = state.sponsors.filter((d) => d.kind !== 'stadion');
      const deal =
        e.sponsor === 'grootste'
          ? [...state.sponsors].sort((a, b) => b.weekly - a.weekly)[0]
          : state.sponsors.find((d) => d.id === focus?.sponsorId) ?? (pool.length ? rng.pick(pool) : undefined);
      if (!deal) continue;
      vars.sponsor = deal.name;
      if (e.tevredenheid !== undefined) deal.satisfaction = clamp(deal.satisfaction + value(state, rng, e.tevredenheid), 0, 100);
      if (e.beeindig) state.sponsors = state.sponsors.filter((d) => d.id !== deal.id);
    } else if ('griep' in e) {
      const victims = state.players.filter(() => rng.chance(e.griep.kans));
      victims.forEach((p) => (p.injuryWeeks = Math.max(p.injuryWeeks, e.griep.weken)));
      vars.aantal = String(victims.length);
    } else if ('nieuws' in e) {
      const one = e.nieuws.enkelvoud && vars.aantal === '1' ? e.nieuws.enkelvoud : pickText(rng, e.nieuws.tekst);
      addNews(state, e.nieuws.toon, fill(one, vars));
    } else if ('verhaalOpenen' in e) {
      openStoryline(state, e.verhaalOpenen.naam, e.verhaalOpenen.weken, vars);
    } else if ('verhaalSluiten' in e) {
      closeStoryline(state, e.verhaalSluiten);
    } else if ('geschiedenis' in e) {
      remember(state, fill(e.geschiedenis, vars));
    } else if ('als' in e) {
      if (test(state, ctx, e.als, vars)) apply(state, rng, e.dan, focus, ctx, vars, booked);
    }
  }
  return vars;
}

/** Eén formulering kiezen uit een lijst varianten. */
export function pickText(rng: Rng, text: string | string[]): string {
  return Array.isArray(text) ? rng.pick(text) : text;
}

/* --------------------------------------------------------------- verhaallijnen */

/** Zet een verhaallijn open: een gebeurtenis die later kan terugkomen. */
export function openStoryline(state: GameState, name: string, weeks: number, vars: Record<string, string> = {}): void {
  if (!state.storylines) state.storylines = [];
  const existing = state.storylines.find((x) => x.name === name);
  if (existing) {
    existing.weeksLeft = Math.max(existing.weeksLeft, weeks);
    existing.vars = { ...existing.vars, ...vars };
    return;
  }
  state.storylines.push({ name, season: state.season, week: state.week, weeksLeft: weeks, vars: { ...vars } });
}

export function closeStoryline(state: GameState, name: string): void {
  if (!state.storylines) return;
  state.storylines = state.storylines.filter((x) => x.name !== name);
}

export function storyline(state: GameState, name: string): { vars: Record<string, string> } | undefined {
  return (state.storylines ?? []).find((x) => x.name === name && x.weeksLeft > 0);
}

/** Telt alle open verhaallijnen een week af. */
export function ageStorylines(state: GameState): void {
  if (!state.storylines) return;
  for (const x of state.storylines) x.weeksLeft--;
  state.storylines = state.storylines.filter((x) => x.weeksLeft > 0);
}

/** Legt een gebeurtenis vast in de clubgeschiedenis. */
export function remember(state: GameState, text: string): void {
  if (!state.chronicle) state.chronicle = [];
  state.chronicle.unshift({ season: state.season, week: state.week, text });
  if (state.chronicle.length > 120) state.chronicle.length = 120;
}

/* ---------------------------------------------------------------- sjabloontekst */

/** Vervangt {plaatshouders} door hun waarde. Onbekende plaatshouders blijven staan. */
export function fill(text: string, ...bags: (Record<string, string> | undefined)[]): string {
  const all = Object.assign({}, ...bags.filter(Boolean)) as Record<string, string>;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => all[key] ?? match);
}

/** De vaste plaatshouders die altijd beschikbaar zijn. */
export function baseVars(state: GameState, ctx: WorldCtx, focus?: Focus): Record<string, string> {
  const player = state.players.find((p) => p.id === focus?.playerId);
  const sponsor = state.sponsors.find((d) => d.id === focus?.sponsorId);
  return {
    club: state.clubName,
    tegenstander: ctx.opponent,
    klasse: DIVISIONS[state.league.divisionLevel]?.name ?? '',
    seizoen: String(state.season),
    jeugdploegen: String(state.community.youthTeams),
    kas: euro(state.cash),
    ...(player ? { speler: player.name, vermoeidheid: String(Math.round(player.fatigue)), moraal: String(Math.round(player.morale)) } : {}),
    ...(sponsor ? { sponsor: sponsor.name } : {}),
  };
}

/** Kiest een formulering uit een nieuwssjabloon en vult de plaatshouders in. */
export function news(state: GameState, rng: Rng, template: NieuwsSjabloon, vars: Record<string, string> = {}): string {
  const text = fill(pickText(rng, template.tekst), vars);
  addNews(state, template.toon, text);
  return text;
}

/** Laatste speelweek van het seizoen; erna hebben weekmomenten geen zin meer. */
export const LAST_MATCH_WEEK = MATCH_WEEKS[MATCH_WEEKS.length - 1];
