import type { GameState, Loan } from './types';
import { round } from './rng';

export interface LoanOffer {
  key: string;
  label: string;
  principal: number;
  weeks: number;
  annualRate: number;
  weeklyPayment: number;
}

export function annuity(principal: number, annualRate: number, weeks: number): number {
  const r = annualRate / 52;
  if (r === 0) return principal / weeks;
  return (principal * r) / (1 - Math.pow(1 + r, -weeks));
}

export function totalDebt(state: GameState): number {
  return state.loans.reduce((s, l) => s + l.remaining, 0);
}

export function sponsorWeekly(state: GameState): number {
  return state.sponsors.reduce((s, d) => s + d.weekly, 0);
}

/** Hoeveel de bank je in totaal wil lenen. */
export function creditLimit(state: GameState): number {
  const base = 60_000 + state.community.fanBase * 80 + sponsorWeekly(state) * 52 * 1.2 + state.league.divisionLevel * 50_000;
  const infra = state.infrastructure.capacity * 60 + (state.infrastructure.pitch === 'kunstgras' ? 150_000 : 0);
  return Math.max(0, round(base + infra - totalDebt(state), 1000));
}

export function interestRate(state: GameState): number {
  const limit = creditLimit(state) + totalDebt(state);
  const ratio = limit > 0 ? totalDebt(state) / limit : 1;
  const stress = state.cash < 0 ? 0.025 : 0;
  return Math.round((0.04 + ratio * 0.04 + stress) * 1000) / 1000;
}

/**
 * Wat een bank je vandaag wil lenen, schaalt mee met je club en met de economie:
 * je reeks, je inflatie en de omvang van je werking. Een kaskrediet van €25.000 helpt je
 * in 3de nationale, in de Challenger Pro Liga is dat zakgeld.
 */
export function loanScale(state: GameState): number {
  const weeklyCost = state.players.reduce((t, p) => t + p.wage, 0) + state.staff.reduce((t, x) => t + x.wage, 0);
  const size = clampScale(weeklyCost / 5_000); // ±5.000 euro loon per week = een club in 3de nationale
  return Math.round(state.inflation * (1 + state.league.divisionLevel * 0.4) * size * 100) / 100;
}

const clampScale = (v: number) => Math.min(2.2, Math.max(0.7, v));

export function loanOffers(state: GameState): LoanOffer[] {
  const limit = creditLimit(state);
  const rate = interestRate(state);
  const scale = loanScale(state);
  const options = [
    { key: 'kort', label: 'Kaskrediet (1 jaar)', principal: 25_000 * scale, weeks: 52, extra: 0.01 },
    { key: 'middel', label: 'Investeringskrediet (3 jaar)', principal: 100_000 * scale, weeks: 156, extra: 0 },
    { key: 'lang', label: 'Infrastructuurlening (10 jaar)', principal: 400_000 * scale, weeks: 520, extra: 0.005 },
  ];
  return options
    .map((o) => {
      const principal = round(Math.min(o.principal, limit), 1000);
      const annualRate = rate + o.extra;
      return {
        key: o.key,
        label: o.label,
        principal,
        weeks: o.weeks,
        annualRate,
        weeklyPayment: round(annuity(principal, annualRate, o.weeks), 1),
      };
    })
    .filter((o) => o.principal >= 10_000);
}

export function emergencyOffer(state?: GameState): LoanOffer {
  // een noodlening is een reddingsboei, geen kredietlijn: ze schaalt maar half mee
  const principal = round(30_000 * (state ? 1 + (loanScale(state) - 1) * 0.5 : 1), 1000);
  const annualRate = 0.15;
  return { key: 'nood', label: 'Noodlening (1 jaar, 15%)', principal, weeks: 52, annualRate, weeklyPayment: round(annuity(principal, annualRate, 52), 1) };
}

/** Wekelijkse afbetaling: deel rente, deel kapitaal. Geeft het betaalde bedrag terug. */
export function payLoanWeek(loan: Loan): number {
  const interest = loan.remaining * (loan.annualRate / 52);
  const payment = Math.min(loan.weeklyPayment, loan.remaining + interest);
  loan.remaining = Math.max(0, loan.remaining + interest - payment);
  loan.weeksLeft--;
  if (loan.weeksLeft <= 0) loan.remaining = 0;
  return payment;
}
