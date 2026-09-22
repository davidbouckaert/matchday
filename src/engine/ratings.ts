import type { GameState } from './types';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { teamStrength } from './players';
import { hasStaff, staffSkill } from './staff';
import { creditLimit, sponsorWeekly, totalDebt } from './loans';
import { facilityCost } from './finance';

export interface SubScore {
  label: string;
  score: number; // 0-100
}

export interface CategoryRating {
  key: 'sportief' | 'financieel' | 'gemeenschap';
  label: string;
  score: number; // 0-100
  stars: number; // 1-5
  parts: SubScore[];
}

const stars = (score: number): number => clamp(1 + Math.floor(score / 20), 1, 5);
const avg = (parts: SubScore[]): number => Math.round(parts.reduce((s, p) => s + p.score, 0) / parts.length);

export function clubRatings(state: GameState): CategoryRating[] {
  const division = DIVISIONS[state.league.divisionLevel];
  const strength = teamStrength(state).total;

  const staffRoles = ['hoofdtrainer', 'kinesist', 'afgevaardigde', 'scout', 'jeugdcoordinator'] as const;
  const staffCoverage = staffRoles.filter((r) => hasStaff(state, r)).length / staffRoles.length;
  const i = state.infrastructure;
  const sport: SubScore[] = [
    { label: 'Eerste elftal', score: clamp(50 + (strength - division.opponentStrength) * 5, 0, 100) },
    { label: 'Jeugd', score: clamp(state.community.youthMembers / 4 + staffSkill(state, 'jeugdcoordinator') / 3, 0, 100) },
    { label: 'Staff', score: clamp(staffCoverage * 60 + staffSkill(state, 'hoofdtrainer') * 0.4, 0, 100) },
    {
      label: 'Infrastructuur',
      score: clamp((i.capacity / division.requiredCapacity) * 35 + i.kantineLevel * 6 + i.lightingLevel * 8 + (i.pitch === 'kunstgras' ? 15 : 0), 0, 100),
    },
  ];

  const weeklyCost = state.players.reduce((s, p) => s + p.wage, 0) + state.staff.reduce((s, x) => s + x.wage, 0) + facilityCost(state);
  const runwayWeeks = state.cash / Math.max(1, weeklyCost);
  const debt = totalDebt(state);
  const limit = debt + creditLimit(state);
  const incomeKinds = Object.entries(state.lastSeasonTotals.tickets ? state.lastSeasonTotals : state.seasonTotals).filter(
    ([k, v]) => (v ?? 0) > 1000 && !['leningen', 'investeerder'].includes(k),
  ).length;
  const fin: SubScore[] = [
    { label: 'Kaspositie', score: clamp(runwayWeeks * 4, 0, 100) },
    { label: 'Schulden', score: clamp(100 - (limit > 0 ? (debt / limit) * 100 : 100), 0, 100) },
    { label: 'Sponsoring', score: clamp((sponsorWeekly(state) / (3000 * division.sponsorFactor)) * 60, 0, 100) },
    { label: 'Spreiding inkomsten', score: clamp(incomeKinds * 12, 0, 100) },
  ];

  const c = state.community;
  const comm: SubScore[] = [
    { label: 'Supporters', score: clamp((c.fanBase / division.fanBaseNorm) * 55, 0, 100) },
    { label: 'Sfeer', score: c.fanMood },
    { label: 'Vrijwilligers', score: clamp(c.volunteers * 1.4, 0, 100) },
    { label: 'Reputatie', score: c.reputation },
  ];

  return [
    { key: 'sportief', label: 'Sportief', parts: sport, score: avg(sport), stars: stars(avg(sport)) },
    { key: 'financieel', label: 'Financieel', parts: fin, score: avg(fin), stars: stars(avg(fin)) },
    { key: 'gemeenschap', label: 'Gemeenschap', parts: comm, score: avg(comm), stars: stars(avg(comm)) },
  ].map((r) => ({ ...r, parts: r.parts.map((p) => ({ ...p, score: Math.round(p.score) })) })) as CategoryRating[];
}
