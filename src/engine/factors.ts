// Alle vermenigvuldigers en bonussen als lijsten. De engine rekent met het product van
// deze lijsten, en de tab "Invloeden" toont exact dezelfde lijsten. Zo kan wat je ziet
// nooit afwijken van wat er echt berekend wordt.

import type { GameState, Player } from './types';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { popularity } from './popularity';
import { staffSkill } from './staff';
import { starPlayers, starSponsorFactor } from './stars';
import { volunteerCap } from './investors';

export interface Factor {
  label: string;
  value: number; // bij 'x': vermenigvuldiger (1 = geen effect), bij '+': optelling
  kind: 'x' | '+';
  source: string; // waar het vandaan komt
}

const x = (label: string, value: number, source: string): Factor => ({ label, value, kind: 'x', source });

export function product(factors: Factor[]): number {
  return factors.filter((f) => f.kind === 'x').reduce((p, f) => p * f.value, 1);
}

// ---------- Sponsoring ----------

export function sponsorFactors(state: GameState): Factor[] {
  const division = DIVISIONS[state.league.divisionLevel];
  const list = [
    x('Reeks', division.sponsorFactor, division.name),
    x('Reputatie', 0.7 + state.community.reputation / 100, `reputatie ${Math.round(state.community.reputation)}`),
  ];
  if (state.avatar.background === 'ondernemer') list.push(x('Netwerk eigenaar', 1.15, 'achtergrond: ondernemer'));
  if (state.infrastructure.scoreboardLevel) list.push(x('Scorebord', 1 + state.infrastructure.scoreboardLevel * 0.06, `niveau ${state.infrastructure.scoreboardLevel}/2`));
  const sales = staffSkill(state, 'commercieel');
  if (sales) list.push(x('Commercieel medewerker', 1 + sales / 250, `vaardigheid ${Math.round(sales)}`));
  // een naam in je ploeg maakt een bord langs het veld aantrekkelijker
  const sterren = starPlayers(state);
  if (sterren.length) list.push(x(sterren.length === 1 ? 'Sterspeler' : 'Sterspelers', starSponsorFactor(state), sterren.map((p) => p.name).join(', ')));
  return list;
}

// ---------- Toeschouwers en kantine ----------

export function priceFactor(state: GameState): number {
  const ref = DIVISIONS[state.league.divisionLevel].refTicketPrice;
  return clamp(Math.pow(ref / Math.max(1, state.ticketPrice), 1.3), 0.25, 1.7);
}

export function attendanceFactors(state: GameState): Factor[] {
  const c = state.community;
  const i = state.infrastructure;
  const ref = DIVISIONS[state.league.divisionLevel].refTicketPrice;
  const list = [
    x('Sfeer', 0.45 + c.fanMood / 180, `sfeer ${Math.round(c.fanMood)}/100`),
    x('Ticketprijs', priceFactor(state), `€${state.ticketPrice} (normaal €${ref})`),
    x('Populariteit', popularity(state).factor, `rating, klassement en recente resultaten`),
  ];
  if (i.wifiLevel) list.push(x('Wifi op het complex', 1 + i.wifiLevel * 0.03, `niveau ${i.wifiLevel}/2`));
  if (i.toiletLevel) list.push(x('Toiletten', 1 + i.toiletLevel * 0.03, `niveau ${i.toiletLevel}/2`));
  if (i.kleedkamerLevel) list.push(x('Kleedkamers', 1 + i.kleedkamerLevel * 0.02, `niveau ${i.kleedkamerLevel}/2`));
  if (i.parkingLevel) list.push(x('Parking', 1 + i.parkingLevel * 0.045, `niveau ${i.parkingLevel}/2`));
  if (i.scoreboardLevel) list.push(x('Scorebord', 1 + i.scoreboardLevel * 0.03, `niveau ${i.scoreboardLevel}/2`));
  if (i.maintenance === 'premium') list.push(x('Onderhoud', 1.04, 'premium onderhoud: alles ligt er piekfijn bij'));
  if (i.maintenance === 'basis') list.push(x('Onderhoud', 0.94, 'basisonderhoud: het complex ziet er verwaarloosd uit'));
  return list;
}

/**
 * Hoe zwaar je vrijwilligers meetellen. Veertien is een normaal bemande club.
 *
 * Onder de veertien doet elke ontbrekende vrijwilliger meteen pijn: de toog is te traag,
 * de kassa's zijn onderbemand. Daarboven is het een afvlakkende curve in plaats van een
 * hard plafond. Dat plafond was het probleem: met achttien vrijwilligers zat een club er
 * al tegenaan, en dan was élke vrijwilliger die daarna bijkwam — en dus ook de +40% van de
 * coöperatie en de +30% van de lokale figuur — letterlijk niets meer waard. Nu blijft een
 * extra paar handen altijd iets opleveren, alleen steeds minder dan het vorige.
 *
 * Bij de supporterscoöperatie loopt de curve naar een hoger punt: daar draait de hele club
 * op mensen, en dat mag je merken.
 */
export function volunteerFactor(state: GameState): number {
  const ratio = state.community.volunteers / NORMAL_VOLUNTEERS;
  if (ratio <= 1) return clamp(ratio, 0.35, 1);
  // e-macht: nadert de grens zonder ze ooit te raken, dus er is geen punt waarop het stopt
  return 1 + (volunteerCap(state) - 1) * (1 - Math.exp(-(ratio - 1) / VOLUNTEER_DECAY));
}

/** Een normaal bemande club van dit niveau. */
export const NORMAL_VOLUNTEERS = 14;

/** Hoe snel de meerwaarde van een extra vrijwilliger afvlakt. */
const VOLUNTEER_DECAY = 0.75;

export function spendFactors(state: GameState): Factor[] {
  const list = [
    x('Kantine', 0.8 + state.infrastructure.kantineLevel * 0.1, `niveau ${state.infrastructure.kantineLevel}/5`),
    x('Vrijwilligers', volunteerFactor(state), `${state.community.volunteers} vrijwilligers (14 = normaal)`),
  ];
  const k = staffSkill(state, 'kantine');
  if (k) list.push(x('Kantineverantwoordelijke', 1 + k / 300, `vaardigheid ${Math.round(k)}`));
  return list;
}

// ---------- Vermoeidheid ----------

export const FATIGUE_FREE = 25; // tot hier geen effect

/** Vermenigvuldiger op aanval en verdediging: 1 bij frisse spelers, lager als ze moe zijn. */
export function fatigueFactor(avgFatigue: number): number {
  return clamp(1 - Math.max(0, avgFatigue - FATIGUE_FREE) * 0.006, 0.7, 1);
}

// Vermoeidheid per week:
//   nieuw = oud × (1 − natuurlijk herstel) + opbouw − extra herstel
// Basisspelers krijgen er per wedstrijd nog opbouw bij (vóór het natuurlijk herstel).

export const NATURAL_RECOVERY = 0.4; // 40% van de vermoeidheid verdwijnt vanzelf elke week

/** Voedingsdeskundige: minder opbouw. */
export function buildUpFactor(state: GameState): number {
  return 1 - staffSkill(state, 'voeding') / 300;
}

/** Opbouw door trainingen (punten per week). */
export function trainingLoad(state: GameState): number {
  const t = state.tactics;
  const perTraining = t.focus === 'conditie' ? 1.6 : 2;
  return t.trainings * perTraining * buildUpFactor(state);
}

export const MATCH_FATIGUE = 10;
export const PRESSING_FATIGUE = 5;

export function matchLoad(state: GameState): number {
  return (MATCH_FATIGUE + (state.tactics.plan === 'pressing' ? PRESSING_FATIGUE : 0)) * buildUpFactor(state);
}

/** Extra herstel bovenop het natuurlijke herstel: jouw keuzes als eigenaar. */
export function recoveryFactors(state: GameState): Factor[] {
  const list: Factor[] = [];
  const add = (label: string, value: number, source: string) => {
    if (value > 0) list.push({ label, value: -Math.round(value * 10) / 10, kind: '+', source });
  };
  add('Kinesist', staffSkill(state, 'kinesist') / 25, 'staff');
  add('Verzorger / masseur', staffSkill(state, 'verzorger') / 12, 'staff');
  add('Voedingsdeskundige', staffSkill(state, 'voeding') / 15, 'staff');
  add('Conditietrainer', staffSkill(state, 'conditietrainer') / 10, 'staff');
  add('Focus herstel', state.tactics.focus === 'herstel' ? 3 : 0, 'trainingsfocus');
  add('Recuperatieruimte', state.infrastructure.recoveryLevel * 3, `niveau ${state.infrastructure.recoveryLevel}/2`);
  return list;
}

export function recovery(state: GameState): number {
  return -recoveryFactors(state).reduce((s, f) => s + f.value, 0);
}

export function fatigueFactors(state: GameState): Factor[] {
  const t = state.tactics;
  const vd = staffSkill(state, 'voeding');
  return [
    { label: 'Natuurlijk herstel', value: -NATURAL_RECOVERY * 100, kind: '+', source: '% van de vermoeidheid verdwijnt elke week vanzelf' },
    { label: 'Opbouw trainingen', value: Math.round(trainingLoad(state) * 10) / 10, kind: '+', source: `${t.trainings} per week${t.focus === 'conditie' ? ', focus conditie (−20%)' : ''}${vd ? ', voedingsdeskundige' : ''}` },
    { label: 'Opbouw wedstrijd (basisspelers)', value: Math.round(matchLoad(state) * 10) / 10, kind: '+', source: t.plan === 'pressing' ? 'inclusief het pressen van de tegenstander' : 'per gespeelde wedstrijd' },
    ...recoveryFactors(state),
  ];
}

/** Oververmoeidheid: extra blessurerisico boven 60. */
export function overFatigueFactor(fatigue: number): number {
  return (1 + fatigue / 100) * (fatigue > 60 ? 1 + (fatigue - 60) / 40 : 1);
}

export function avgFatigue(players: Player[]): number {
  return players.length ? players.reduce((s, p) => s + p.fatigue, 0) / players.length : 0;
}

// ---------- Blessures ----------

export function injuryFactors(state: GameState): Factor[] {
  const list: Factor[] = [];
  const kine = staffSkill(state, 'kinesist');
  if (kine) list.push(x('Kinesist', 1 - kine / 200, `vaardigheid ${Math.round(kine)}`));
  const fit = staffSkill(state, 'conditietrainer');
  if (fit) list.push(x('Conditietrainer', 1 - fit / 300, `vaardigheid ${Math.round(fit)}`));
  const t = state.tactics;
  if (t.plan === 'pressing' && !fit && t.focus !== 'conditie') list.push(x('Pressing', 1.5, 'zonder conditietrainer of focus conditie'));
  list.push(x('Trainingen', 1 + (t.trainings - 3) * 0.12, `${t.trainings} per week`));
  if (t.focus === 'herstel') list.push(x('Focus herstel', 0.75, 'trainingsfocus'));
  // een hobbelig, verwaarloosd veld is een blessureveld; premium onderhoud ligt er vlak bij
  if (state.infrastructure.maintenance === 'basis') list.push(x('Basisonderhoud', 1.08, 'een verwaarloosd veld is een blessureveld'));
  if (state.infrastructure.maintenance === 'premium') list.push(x('Premium onderhoud', 0.95, 'een vlak, verzorgd veld'));
  return list;
}
