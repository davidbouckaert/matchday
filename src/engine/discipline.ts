// Gele en rode kaarten, schorsingen en tuchtboetes.
// Regels (vereenvoudigd): elke 5de gele kaart = 1 wedstrijd schorsing,
// twee gele in één wedstrijd = rood (1 wedstrijd), direct rood = 1 tot 3 wedstrijden.
// Tellingen van gele kaarten starten elk seizoen opnieuw; lopende schorsingen blijven.

import type { DisciplineRecord, GameState, Player } from './types';
import type { Rng } from './rng';
import { staffSkill } from './staff';
import { canPlay } from './players';
import { addNews, book } from './util';

export const YELLOW_LIMIT = 5;
export const YELLOW_FINE = 20;
export const RED_FINE = 75;
export const YELLOWS_PER_MATCH = 1.7;
export const DIRECT_RED_CHANCE = 0.035;

/** Hoe kaartgevoelig jouw ploeg speelt. */
export function cardFactor(state: GameState, derby: boolean): number {
  const t = state.tactics;
  let f = 1;
  if (t.plan === 'pressing') f *= 1.3;
  if (t.mentality === 'aanvallend') f *= 1.1;
  if (derby) f *= 1.3;
  f *= 1 - staffSkill(state, 'mentaal') / 250;
  return f;
}

function weight(p: Player): number {
  const trait = p.trait === 'lastpak' ? 2.5 : p.trait === 'feestbeest' ? 1.5 : p.trait === 'gevoelig' ? 1.2 : p.trait === 'professioneel' ? 0.7 : 1;
  const pos = p.position === 'VERD' || p.position === 'MIDD' ? 1.3 : p.position === 'DOEL' ? 0.3 : 1;
  return trait * pos;
}

function pickWeighted<T>(rng: Rng, items: T[], w: (x: T) => number): T {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = rng.next() * total;
  for (const x of items) {
    r -= w(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

/** Kaarten voor jouw spelers in één wedstrijd. Geeft een korte samenvatting terug. */
export function cardsForOwnTeam(state: GameState, rng: Rng, lineup: Player[], derby: boolean): string {
  if (!lineup.length) return '';
  const f = cardFactor(state, derby);
  const yellows = rng.poisson(YELLOWS_PER_MATCH * f);
  const inMatch = new Map<string, number>();
  const parts: string[] = [];
  for (let i = 0; i < yellows; i++) {
    const p = pickWeighted(rng, lineup, weight);
    const n = (inMatch.get(p.id) ?? 0) + 1;
    inMatch.set(p.id, n);
    if (n === 2) {
      p.redCards++;
      p.suspended += 1;
      book(state, 'tuchtboetes', -RED_FINE, `Rode kaart (2x geel) ${p.name}`);
      parts.push(`🟥 ${p.name} (2x geel)`);
      addNews(state, 'slecht', `${p.name} krijgt twee keer geel en is 1 wedstrijd geschorst.`);
      continue;
    }
    if (n > 2) continue;
    p.yellowCards++;
    book(state, 'tuchtboetes', -YELLOW_FINE, `Gele kaart ${p.name}`);
    parts.push(`🟨 ${p.name}`);
    if (p.yellowCards % YELLOW_LIMIT === 0) {
      p.suspended += 1;
      addNews(state, 'slecht', `${p.name} pakt zijn ${p.yellowCards}ste gele kaart en is volgende wedstrijd geschorst.`);
    }
  }
  if (rng.chance(DIRECT_RED_CHANCE * f)) {
    const p = pickWeighted(rng, lineup, weight);
    const matches = rng.int(1, 3);
    p.redCards++;
    p.suspended += matches;
    book(state, 'tuchtboetes', -RED_FINE, `Rode kaart ${p.name}`);
    parts.push(`🟥 ${p.name}`);
    addNews(state, 'slecht', `Rode kaart voor ${p.name}: ${matches} ${matches === 1 ? 'wedstrijd' : 'wedstrijden'} schorsing.`);
  }
  return parts.join(', ');
}

function record(state: GameState, teamId: string, name: string): DisciplineRecord {
  let r = state.league.discipline.find((d) => d.teamId === teamId && d.name === name);
  if (!r) {
    r = { teamId, name, yellows: 0, reds: 0, suspended: 0 };
    state.league.discipline.push(r);
  }
  return r;
}

/** Kaarten voor een tegenstander. Geschorste spelers spelen niet mee. */
export function cardsForOpponent(state: GameState, rng: Rng, teamId: string, derby: boolean): void {
  const team = state.league.teams.find((t) => t.id === teamId);
  if (!team) return;
  const banned = new Set(state.league.discipline.filter((d) => d.teamId === teamId && d.suspended > 0).map((d) => d.name));
  const players = team.roster.filter((n) => !banned.has(n));
  if (!players.length) return;
  const f = (team.plan === 'pressing' ? 1.3 : 1) * (derby ? 1.3 : 1);
  const yellows = rng.poisson(YELLOWS_PER_MATCH * f);
  const inMatch = new Map<string, number>();
  for (let i = 0; i < yellows; i++) {
    const name = rng.pick(players);
    const n = (inMatch.get(name) ?? 0) + 1;
    inMatch.set(name, n);
    const r = record(state, teamId, name);
    if (n === 2) {
      r.reds++;
      r.suspended += 1;
      continue;
    }
    if (n > 2) continue;
    r.yellows++;
    if (r.yellows % YELLOW_LIMIT === 0) r.suspended += 1;
  }
  if (rng.chance(DIRECT_RED_CHANCE * f)) {
    const r = record(state, teamId, rng.pick(players));
    r.reds++;
    r.suspended += rng.int(1, 3);
  }
}

/** Aantal geschorste spelers bij een tegenstander (verzwakt hun ploeg een beetje). */
export function opponentSuspensions(state: GameState, teamId: string): number {
  return state.league.discipline.filter((d) => d.teamId === teamId && d.suspended > 0).length;
}

/** Na een wedstrijd: wie geschorst was, heeft die wedstrijd uitgezeten. */
export function serveOwnSuspensions(players: Player[], wereSuspended: Set<string>): void {
  for (const p of players) if (wereSuspended.has(p.id) && p.suspended > 0) p.suspended--;
}

export function serveOpponentSuspensions(state: GameState, teamId: string, wereSuspended: Set<string>): void {
  for (const d of state.league.discipline) if (d.teamId === teamId && wereSuspended.has(d.name) && d.suspended > 0) d.suspended--;
}

export function available(players: Player[]): Player[] {
  return players.filter(canPlay);
}
