// Wat je investeerder met je club doet.
//
// De drie investeerders geven niet alleen een ander bedrag, ze spelen een ander spel:
//
//   fonds       veel geld nu, maar een klok die blijft lopen en spelers die niet van jou zijn
//   aannemer    matig geld, maar bouwen is goedkoper, sneller en met een werf meer — dat stapelt
//   cooperatie  bijna geen geld, maar elk seizoen een ledenronde die groeit met hoe goed je het doet
//
// Alles wat per investeerder verschilt, staat hier. De rest van de engine vraagt het op.

import type { GameState } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { MATCH_WEEKS } from './calendar';
import { addNews, book, euro } from './util';
import { remember } from './content';

/* ------------------------------------------------------------------ aannemer */

/**
 * De stadionnaam van de aannemer groeit mee met je reeks. Vroeger stond dit vast op €600
 * per week, waardoor zijn belangrijkste voordeel met elke promotie minder waard werd —
 * terwijl de plek van de stadionsponsor wel bezet bleef.
 */
export function stadiumSponsorWeekly(level: number): number {
  const base = DIVISIONS[1].sponsorFactor; // 3de nationale is de ijkreeks
  const here = DIVISIONS[clamp(level, 0, DIVISIONS.length - 1)].sponsorFactor;
  return round(600 * (here / base), 5);
}

/** Werkt de stadionsponsor bij wanneer je van reeks verandert. */
export function updateStadiumSponsor(state: GameState, level: number): void {
  if (state.investor !== 'aannemer' || !state.investorActive) return;
  const deal = state.sponsors.find((d) => d.kind === 'stadion');
  if (!deal) return;
  const next = stadiumSponsorWeekly(level);
  if (next === deal.weekly) return;
  const before = deal.weekly;
  deal.weekly = next;
  addNews(
    state,
    next > before ? 'goed' : 'neutraal',
    next > before
      ? `${deal.name}: de naamsponsor trekt zijn bijdrage op naar ${euro(next)}/week, nu je een reeks hoger speelt.`
      : `${deal.name}: de naamsponsor zakt naar ${euro(next)}/week na de degradatie.`,
  );
}

/** Korting op bouwwerken. Zijn eigen firma voert ze uit. */
export function buildDiscount(state: GameState): number {
  return state.investor === 'aannemer' && state.investorActive ? 0.85 : 1;
}

/** Zijn ploegen krijgen voorrang: werven zijn een kwart sneller klaar. */
export function buildSpeed(state: GameState): number {
  return state.investor === 'aannemer' && state.investorActive ? 0.75 : 1;
}

/** Hoeveel werven er standaard tegelijk mogen lopen, voor je eigen niveau erbij komt. */
export function baseProjects(state: GameState): number {
  return state.investor === 'aannemer' && state.investorActive ? 3 : 2;
}

/* ---------------------------------------------------------------- cooperatie */

/** Het plafond op de vrijwilligersfactor. Bij de coöperatie ligt dat hoger. */
export function volunteerCap(state: GameState): number {
  return state.investor === 'cooperatie' ? 1.35 : 1.15;
}

/** De ledenronde kan alleen in de voorbereiding, één keer per seizoen. */
export const ROUND_LAST_WEEK = MATCH_WEEKS[0] - 1;

/** Elke ronde vraagt wat meer van dezelfde mensen; de opbrengst zakt geleidelijk. */
const ROUND_FATIGUE = 0.08;

/**
 * Wat een ledenronde zou opbrengen. Honderden kleine aandeelhouders uit de buurt: hoe
 * groter je achterban, hoe beter je reputatie en hoe beter de sfeer, hoe meer ze storten.
 * Een club die goed draait, haalt hier op termijn meer uit dan het fonds ooit gaf.
 */
export function roundForecast(state: GameState): number {
  if (state.investor !== 'cooperatie') return 0;
  const c = state.community;
  const base = c.fanBase * 55 + c.youthMembers * 25;
  const standing = clamp(c.reputation / 55, 0.4, 1.9);
  const mood = clamp(0.55 + c.fanMood / 130, 0.5, 1.4);
  const tired = Math.max(0.5, 1 - (state.investorState?.coopRounds ?? 0) * ROUND_FATIGUE);
  return Math.round((base * standing * mood * tired * state.inflation) / 500) * 500;
}

/** Kan er nu een ledenronde gehouden worden? */
export function canHoldRound(state: GameState): { ok: boolean; reason: string } {
  if (state.investor !== 'cooperatie') return { ok: false, reason: 'Alleen een supporterscoöperatie kan haar leden om geld vragen.' };
  if (!state.investorActive) return { ok: false, reason: 'De coöperatie is niet langer betrokken bij de club.' };
  if (state.gameOver) return { ok: false, reason: 'Het spel is afgelopen.' };
  if (state.investorState?.coopSeason === state.season) {
    return { ok: false, reason: 'Je hield dit seizoen al een ledenronde. Volgend seizoen mag het opnieuw.' };
  }
  if (state.week > ROUND_LAST_WEEK) {
    return { ok: false, reason: `Een ledenronde houd je voor de competitie start, tot en met week ${ROUND_LAST_WEEK}.` };
  }
  return { ok: true, reason: '' };
}

/**
 * De ledenronde houden. Het geld komt binnen, maar je vraagt wel iets van dezelfde mensen
 * die ook aan de kassa en in de kantine staan: de sfeer zakt er een beetje van, en elke
 * volgende ronde brengt wat minder op.
 */
export function holdRound(state: GameState, rng: Rng): number {
  const expected = roundForecast(state);
  const raised = Math.round((expected * rng.range(0.88, 1.12)) / 500) * 500;
  if (!state.investorState) state.investorState = emptyInvestorState();
  state.investorState.coopRounds++;
  state.investorState.coopSeason = state.season;
  book(state, 'investeerder', raised, `Ledenronde coöperatie (ronde ${state.investorState.coopRounds})`);
  state.community.fanMood = clamp(state.community.fanMood - 3, 0, 100);
  state.community.reputation = clamp(state.community.reputation + 1, 0, 100);
  addNews(state, 'goed', `De leden van de coöperatie legden ${euro(raised)} bij elkaar. Dat zijn dezelfde mensen die zondag aan de kassa staan.`);
  remember(state, `Ledenronde ${state.investorState.coopRounds}: de coöperatie bracht ${euro(raised)} bijeen.`);
  return raised;
}

/* --------------------------------------------------------------------- fonds */

/** Zoveel seizoenen mag je zonder promotie voor het fonds zijn geduld verliest. */
export const FUND_PATIENCE = 3;

/** Het deel van elke transferwinst dat naar het fonds gaat. */
export const FUND_TRANSFER_SHARE = 0.3;

/** Het deel van je prijzengeld dat naar het fonds gaat. Dit kun je niet ontwijken. */
export const FUND_PRIZE_SHARE = 0.2;

/** Wat het fonds terugtrekt als zijn geduld op is. */
export const FUND_WITHDRAWAL = 300_000;

/**
 * Hoeveel seizoenen je nog hebt om te promoveren, dit seizoen meegerekend. Eén betekent:
 * dit is je laatste kans. Nul of minder: het geduld is op.
 */
export function seasonsLeft(state: GameState): number {
  if (state.investor !== 'fonds' || !state.investorActive) return Infinity;
  return Math.min(FUND_PATIENCE, FUND_PATIENCE - seasonsSincePromotion(state) + 1);
}

/** Het hoeveelste seizoen sinds de laatste promotie dit is (dit seizoen meegerekend). */
function seasonsSincePromotion(state: GameState): number {
  return state.season - (state.investorState?.lastPromotionSeason ?? 0);
}

/** Het fonds neemt zijn deel van het prijzengeld. Daar valt niet aan te ontkomen. */
export function takePrizeShare(state: GameState, prize: number): void {
  if (state.investor !== 'fonds' || !state.investorActive || prize <= 0) return;
  const share = Math.round(prize * FUND_PRIZE_SHARE);
  if (share <= 0) return;
  book(state, 'investeerder', -share, `${Math.round(FUND_PRIZE_SHARE * 100)}% van het prijzengeld naar het fonds`);
  addNews(state, 'neutraal', `Het fonds hield ${euro(share)} van het prijzengeld in. Dat stond in het contract.`);
}

/** De klok opnieuw op nul zetten: je promoveerde. */
export function notePromotion(state: GameState): void {
  if (!state.investorState) state.investorState = emptyInvestorState();
  state.investorState.lastPromotionSeason = state.season;
}

/**
 * Het geduld van het fonds. Promoveer je niet binnen drie seizoenen, dan trekken ze hun
 * geld terug en zijn ze weg. De klok begint opnieuw bij elke promotie, dus je blijft
 * onder druk staan zolang ze aan boord zijn.
 */
export function checkFundPatience(state: GameState): void {
  if (state.investor !== 'fonds' || !state.investorActive) return;
  // dit draait op het einde van het seizoen, nadat een promotie de klok al heeft teruggezet
  const since = seasonsSincePromotion(state);
  if (since === FUND_PATIENCE - 1) {
    addNews(state, 'slecht', `Het fonds wordt ongeduldig: promoveer je volgend seizoen niet, dan trekt het ${euro(FUND_WITHDRAWAL)} terug.`);
    return;
  }
  if (since < FUND_PATIENCE) return;
  state.investorActive = false;
  book(state, 'investeerder', -FUND_WITHDRAWAL, 'Terugtrekking investeringsfonds');
  addNews(state, 'slecht', `Het fonds is het geduld kwijt: geen promotie in ${FUND_PATIENCE} seizoenen. Het trekt ${euro(FUND_WITHDRAWAL)} terug en stapt op.`);
  remember(state, `Het investeringsfonds stapte op en nam ${euro(FUND_WITHDRAWAL)} mee.`);
}

/**
 * Het fonds ziet de club als een springplank. Ligt er een stevig bod op een jonge speler,
 * dan tekenen zij en hoor jij het achteraf. Je krijgt het geld wel — min hun aandeel.
 */
export function forcedSaleCandidate(state: GameState): { offerId: string; playerId: string } | null {
  if (state.investor !== 'fonds' || !state.investorActive) return null;
  for (const offer of state.playerOffers) {
    const player = state.players.find((p) => p.id === offer.playerId);
    if (!player || player.loan) continue;
    if (player.age > 24) continue;
    // alleen bij een bod dat zij niet kunnen laten liggen
    if (offer.amount < Math.max(15_000, player.purchasePrice * 1.6)) continue;
    return { offerId: offer.id, playerId: player.id };
  }
  return null;
}

/* --------------------------------------------------------------------- staat */

export function emptyInvestorState(): NonNullable<GameState['investorState']> {
  return { coopRounds: 0, coopSeason: null, lastPromotionSeason: 0 };
}

/** Eén zin over wat jouw investeerder voor je betekent, voor in de schermen. */
export function investorSummary(state: GameState): string {
  if (!state.investorActive) return 'Je investeerder is niet langer betrokken bij de club.';
  switch (state.investor) {
    case 'aannemer':
      return `Bouwwerken kosten 15% minder en zijn een kwart sneller klaar, je mag drie werven tegelijk open hebben, en de stadionnaam brengt ${euro(stadiumSponsorWeekly(state.league.divisionLevel))}/week op.`;
    case 'fonds':
      // de promotieklok staat als aparte, opvallende regel op de kaart — hier niet herhalen
      return `${Math.round(FUND_TRANSFER_SHARE * 100)}% van elke transferwinst en ${Math.round(FUND_PRIZE_SHARE * 100)}% van je prijzengeld gaan naar het fonds. Ze tekenen zelf voor stevige biedingen op je jonge spelers, en ze verwachten dat je promoveert.`;
    default:
      return `Je mag je ticketprijs niet boven 120% van het normale niveau zetten, maar je vrijwilligers tellen zwaarder mee en je kunt elk seizoen een ledenronde houden (nu ongeveer ${euro(roundForecast(state))}).`;
  }
}
