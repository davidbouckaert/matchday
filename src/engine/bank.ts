// Krediet wordt gedragen door de werking, nooit door eerder geleend geld.
import type { GameState } from './types';
import type { LoanOffer } from './loans';
import { creditLimit, payLoanWeek } from './loans';
import { annualInsuranceCost, bookAwayMatch, bookHomeMatch, bookWeeklyFlows } from './finance';
import { expectedMerchNet } from './merch';
import { medischeKost } from './medisch';
import { trainingCost } from './strategy';
import { WEEKS_PER_YEAR } from './calendar';
import { OWN_TEAM_ID } from './league';
import { clamp } from './rng';
import { euro } from './util';
import { youthForecast } from './actions';

export interface BankCapacity {
  annualOperating: number;
  existingPayments: number;
}

/**
 * Een normaal werkingsjaar bij huidig beleid, publiek, contracten en prijzen.
 * Ook gespeelde wedstrijden tellen mee: aanvragen in december of juni mag de jaarlast
 * niet verbergen. Dit is draagkracht, geen kasprognose of voorspelling van promoties.
 * We hergebruiken de echte boekingsfuncties op een geïsoleerde kopie zonder leningen.
 * Transfers, nieuwe kredieten, subsidies, investeerders en eenmalige premies tellen niet.
 */
export function bankCapacity(state: GameState): BankCapacity {
  const model = structuredClone(state);
  model.loans = [];
  let annualOperating = -Math.round(annualInsuranceCost(state)) + Math.min(state.community.youthMembers, youthForecast(state)) * state.youthFee;
  if (state.seasonTickets?.season === state.season) annualOperating += state.seasonTickets.revenue;
  for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
    model.week = week;
    model.cash = 0;
    model.thisWeek = [];
    model.community.fanMood = state.community.fanMood;
    bookWeeklyFlows(model);
    const fixture = model.league.fixtures.find((f) => f.week === week && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID));
    if (fixture?.homeId === OWN_TEAM_ID) {
      const opponent = model.league.teams.find((t) => t.id === fixture.awayId);
      bookHomeMatch(model, { weather: 'bewolkt', derby: !!opponent?.isRival, positionFactor: 1 }, opponent?.name ?? 'tegenstander');
    } else if (fixture) bookAwayMatch(model, 'tegenstander');
    model.community.fanMood = state.community.fanMood;
    annualOperating += model.cash - trainingCost(model) - medischeKost(model) + expectedMerchNet(model);
  }
  // Een sponsorverlenging is nog geen contract. Bekend wegvallende inkomsten mogen
  // de bank geen extra draagkracht beloven; stadionrechten lopen volgens de motor door.
  for (const deal of state.sponsors) {
    if (deal.kind !== 'stadion') annualOperating -= deal.weekly * (WEEKS_PER_YEAR - Math.max(0, Math.min(WEEKS_PER_YEAR, deal.weeksLeft)));
  }
  // De laatste termijn kan kleiner zijn; bijna afbetaalde leningen tellen niet 52 keer mee.
  let existingPayments = 0;
  for (const original of state.loans) {
    const loan = { ...original };
    for (let week = 0; week < WEEKS_PER_YEAR && loan.weeksLeft > 0 && loan.remaining > 0; week++) existingPayments += payLoanWeek(loan);
  }
  return { annualOperating: Math.round(annualOperating), existingPayments };
}

export interface LoanAssessment extends BankCapacity {
  allowed: boolean;
  reason: string;
  annualPayments: number;
  requiredOperating: number;
  chance: number;
}

/** Aanvraag, antwoord en scherm delen deze harde ondergrens; toeval kan haar niet omzeilen. */
export function assessLoan(state: GameState, offer: Pick<LoanOffer, 'principal' | 'weeklyPayment' | 'weeks'>, capacity = bankCapacity(state)): LoanAssessment {
  const room = creditLimit(state);
  const annualPayments = capacity.existingPayments + offer.weeklyPayment * Math.min(WEEKS_PER_YEAR, offer.weeks);
  // Tien procent ademruimte voor winstpremies, wisselend weer en onverwachte kosten.
  const requiredOperating = Math.ceil(annualPayments * 1.1);
  const reason = offer.principal > room
    ? 'Alle leningen samen overschrijden je kredietruimte. Los eerst schuld af.'
    : capacity.annualOperating < requiredOperating
      ? `Niet betaalbaar: alle afbetalingen en 10% buffer vragen ${euro(requiredOperating)}/jaar; je werking levert naar schatting ${euro(capacity.annualOperating)}/jaar. Verlaag vaste kosten of verhoog terugkerende inkomsten.`
      : '';
  const chance = clamp(0.35 + room / Math.max(1, offer.principal) / 6 + state.community.reputation / 300 - (state.cash < 0 ? 0.25 : 0), 0.05, 0.95);
  return { ...capacity, allowed: !reason, reason, annualPayments, requiredOperating, chance: reason ? 0 : chance };
}
