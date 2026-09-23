// Abonnementen: de enige beslissing die je een heel seizoen vastzet.
//
// In de weken voor de competitie verkoop je abonnementen. Het geld komt in één keer binnen,
// maar die mensen betalen daarna niet meer aan de kassa — ook niet als je je ticketprijs
// verhoogt, en ook niet als ze door de regen thuisblijven. Je legt dus je belangrijkste
// inkomstenbron vast voor een heel jaar, vóór je weet hoe het seizoen loopt.

import type { GameState } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { MATCH_WEEKS } from './calendar';
import { popularity } from './popularity';
import { addNews, book, euro } from './util';
import { remember } from './content';

/** Tot en met deze week kun je abonnementen verkopen; daarna is de competitie bezig. */
export const CAMPAIGN_LAST_WEEK = MATCH_WEEKS[0] - 1;

/** Zoveel thuiswedstrijden telt een seizoen. */
export const HOME_MATCHES = MATCH_WEEKS.length / 2;

/** De prijs die overeenkomt met los betalen: alle thuiswedstrijden aan de kassaprijs. */
export function fullPrice(state: GameState): number {
  return state.ticketPrice * HOME_MATCHES;
}

/** Wat een redelijke abonnementsprijs is: met een korting die mensen over de streep trekt. */
export function suggestedPrice(state: GameState): number {
  return round(fullPrice(state) * 0.75, 5);
}

/** Onder deze prijs verkoop je jezelf straatarm; de schuifregelaar gaat niet lager. */
export const MIN_PRICE = 10;

/** De laagste zinvolle prijs voor deze club: 45% van wat los betalen kost. */
export function floorPrice(state: GameState): number {
  return Math.max(MIN_PRICE, round(fullPrice(state) * 0.45, 5));
}

/**
 * Hoeveel abonnementen je aan deze prijs zou verkopen. Hoe scherper de korting tegenover
 * los betalen, hoe meer mensen tekenen — maar er is een plafond: niet iedereen komt elke week.
 */
export function expectedSales(state: GameState, price: number): number {
  const c = state.community;
  const full = fullPrice(state);
  if (price <= 0 || full <= 0) return 0;
  // 1 = evenveel als los betalen. Zonder korting tekent niemand: waarom zou je vooruitbetalen
  // voor matchen waar je misschien niet bent? Hoe scherper de korting, hoe meer mensen bijten.
  const ratio = clamp(price / full, 0.3, 1.2);
  const attractiveness = clamp((1 - ratio) * 2.4, 0, 2);
  // wie tekent er een abonnement? De trouwe kern, en die groeit met sfeer en reputatie
  const core = c.fanBase * 0.3 * (0.5 + c.fanMood / 140) * (0.75 + c.reputation / 220) * popularity(state).factor;
  const capacity = state.infrastructure.capacity * 0.8;
  return Math.max(0, Math.round(Math.min(core * attractiveness, capacity, c.fanBase * 0.7)));
}

/** Wat de campagne aan deze prijs zou opbrengen. */
export function expectedRevenue(state: GameState, price: number): number {
  return Math.round(expectedSales(state, price) * price);
}

/**
 * Hoe vaak een gewone supporter naar een thuiswedstrijd komt. Niemand staat er vijftien keer:
 * werk, weer, vakantie. Dit is wat een abonnee je aan de kassa zou hebben opgebracht.
 */
export const TYPICAL_ATTENDANCE_RATE = 0.55;

/** Wat je aan de kassa misloopt door die abonnementen, over het hele seizoen. */
export function forgoneGate(state: GameState, price: number): number {
  return Math.round(expectedSales(state, price) * fullPrice(state) * TYPICAL_ATTENDANCE_RATE);
}

/** Kan er nu een campagne lopen? */
export function canSell(state: GameState): { ok: boolean; reason: string } {
  if (state.gameOver) return { ok: false, reason: 'Het spel is afgelopen.' };
  if (state.seasonTickets && state.seasonTickets.season === state.season) {
    return { ok: false, reason: `Je verkocht dit seizoen al ${state.seasonTickets.sold} abonnementen aan ${euro(state.seasonTickets.price)}.` };
  }
  if (state.week > CAMPAIGN_LAST_WEEK) {
    return { ok: false, reason: `Abonnementen verkoop je voor de competitie start, tot en met week ${CAMPAIGN_LAST_WEEK}.` };
  }
  return { ok: true, reason: '' };
}

/**
 * De campagne voeren. Het geld komt meteen binnen; de rest van het seizoen betalen die
 * mensen niet meer aan de kassa. Er is geen weg terug tot het volgende seizoen.
 */
export function sellSeasonTickets(state: GameState, price: number, rng: Rng): { sold: number; revenue: number } {
  const asked = Math.max(MIN_PRICE, Math.round(price));
  // de werkelijkheid wijkt altijd wat af van de raming
  const sold = Math.max(0, Math.round(expectedSales(state, asked) * rng.range(0.85, 1.15)));
  const revenue = sold * asked;
  state.seasonTickets = { season: state.season, price: asked, sold, revenue };
  book(state, 'tickets', revenue, `Abonnementen ${sold} × ${euro(asked)}`);
  addNews(
    state,
    sold > 0 ? 'goed' : 'neutraal',
    sold > 0
      ? `${sold} abonnementen verkocht aan ${euro(asked)}: ${euro(revenue)} ineens in kas. Die mensen betalen dit seizoen niet meer aan de kassa.`
      : 'De abonnementencampagne leverde niets op. Aan die prijs tekende niemand.',
  );
  if (sold > 0) remember(state, `${sold} abonnementen verkocht aan ${euro(asked)} (${euro(revenue)}).`);
  return { sold, revenue };
}

/**
 * Hoe trouw een abonnee komt, tegenover iemand die aan de kassa moet beslissen.
 *
 * `rate` is welk deel van je supporters deze week sowieso zou komen — dat cijfer heeft het
 * weer, je vorm en je klassement al in zich. Een abonnee zit daar tussenin en het altijd:
 * hij heeft betaald, dus de drempel om toch te gaan is lager, en regen weegt half zo zwaar.
 * Vandaar het midden tussen de gewone opkomst en altijd komen.
 *
 * Je haalt er dus geen volle tribune mee, maar wel een tribune die minder leegloopt als het
 * giet — en dat is precies waar je hem voor koopt.
 */
export function loyaltyRate(rate: number): number {
  return Math.min(0.95, rate + (1 - rate) * 0.5);
}

/** Hoeveel abonnees er dit seizoen rondlopen. */
export function holders(state: GameState): number {
  return state.seasonTickets && state.seasonTickets.season === state.season ? state.seasonTickets.sold : 0;
}

/** Op het einde van het seizoen vervallen alle abonnementen. */
export function settleSeasonTickets(state: GameState): void {
  const current = state.seasonTickets;
  if (!current || current.season !== state.season || !current.sold) return;
  const gate = current.sold * fullPrice(state) * TYPICAL_ATTENDANCE_RATE;
  addNews(
    state,
    gate > current.revenue ? 'neutraal' : 'goed',
    gate > current.revenue
      ? `De abonnementen zijn afgelopen. Je kreeg er ${euro(current.revenue)} voor; aan de kassa waren diezelfde mensen ${euro(gate)} waard geweest.`
      : `De abonnementen zijn afgelopen en pakten goed uit: ${euro(current.revenue)} vooraf, tegenover ${euro(gate)} aan de kassa.`,
  );
}

/** Voor het overzicht: hoe de klap uitpakt op het einde van de rit. */
export function outcome(state: GameState): { revenue: number; gate: number; diff: number } | null {
  const current = state.seasonTickets;
  if (!current || !current.sold) return null;
  const gate = Math.round(current.sold * state.ticketPrice * HOME_MATCHES * TYPICAL_ATTENDANCE_RATE);
  return { revenue: current.revenue, gate, diff: current.revenue - gate };
}

/** De reeks bepaalt mee hoeveel je durft te vragen. */
export function referencePrice(state: GameState): number {
  return round(DIVISIONS[state.league.divisionLevel].refTicketPrice * HOME_MATCHES * 0.75, 5);
}
