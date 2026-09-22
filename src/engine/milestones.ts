// Mijlpalen: kleine momenten om naar toe te werken. Elke mijlpaal komt één keer voor,
// levert iets op en verschijnt duidelijk in het weekrapport.

import type { GameState } from './types';
import { DIVISIONS } from './data/divisions';
import { OWN_TEAM_ID } from './league';
import { totalOf } from './stats';
import { addNews, book, euro } from './util';

export interface Milestone {
  id: string;
  label: string;
  detail: string;
  reached: (s: GameState) => boolean;
  reward?: (s: GameState) => void;
}

const reputation = (s: GameState, n: number) => {
  s.community.reputation = Math.min(100, s.community.reputation + n);
};

export const MILESTONES: Milestone[] = [
  {
    id: 'fans-500',
    label: '500 supporters',
    detail: 'Je achterban groeit: meer volk op het veld, meer omzet in de kantine.',
    reached: (s) => s.community.fanBase >= 500,
    reward: (s) => reputation(s, 2),
  },
  {
    id: 'fans-1000',
    label: '1.000 supporters',
    detail: 'De club leeft in de streek. Sponsors merken dat.',
    reached: (s) => s.community.fanBase >= 1000,
    reward: (s) => reputation(s, 3),
  },
  {
    id: 'fans-2500',
    label: '2.500 supporters',
    detail: 'Je bent een begrip geworden.',
    reached: (s) => s.community.fanBase >= 2500,
    reward: (s) => reputation(s, 4),
  },
  {
    id: 'kas-250k',
    label: '€250.000 op de rekening',
    detail: 'Genoeg buffer om te durven investeren.',
    reached: (s) => s.cash >= 250_000,
  },
  {
    id: 'kas-1m',
    label: 'Een miljoen op de rekening',
    detail: 'De boekhouder glimlacht voor het eerst.',
    reached: (s) => s.cash >= 1_000_000,
    reward: (s) => reputation(s, 3),
  },
  {
    id: 'reeks-2',
    label: 'Promotie naar een hogere reeks',
    detail: 'Hogere ticketprijzen, dikkere sponsorcontracten en meer volk.',
    reached: (s) => s.league.divisionLevel >= 2,
    reward: (s) => {
      s.community.fanBase = Math.round(s.community.fanBase * 1.15);
      reputation(s, 5);
    },
  },
  {
    id: 'uitverkocht',
    label: 'Uitverkocht huis',
    detail: 'De tribune zat vol. Tijd om uit te breiden?',
    reached: (s) => !!s.lastMatch?.home && s.lastMatch.attendance >= s.infrastructure.capacity,
    reward: (s) => {
      s.community.fanMood = Math.min(100, s.community.fanMood + 4);
    },
  },
  {
    id: 'shop-1000',
    label: '1.000 artikelen verkocht',
    detail: 'Je clubkleuren hangen in de hele gemeente.',
    reached: (s) => totalOf(s.stats.merch) + s.statsHistory.reduce((sum, st) => sum + totalOf(st.merch), 0) >= 1000,
    reward: (s) => reputation(s, 2),
  },
  {
    id: 'jeugd-300',
    label: '300 jeugdleden',
    detail: 'Een jeugdwerking waar andere clubs naar kijken.',
    reached: (s) => s.community.youthMembers >= 300,
    reward: (s) => reputation(s, 4),
  },
  {
    id: 'ongeslagen-10',
    label: 'Tien wedstrijden ongeslagen',
    detail: 'De hele streek praat over je ploeg.',
    reached: (s) => {
      const played = s.league.fixtures.filter((f) => f.homeGoals !== undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID)).slice(-10);
      if (played.length < 10) return false;
      return played.every((f) => {
        const home = f.homeId === OWN_TEAM_ID;
        return (home ? f.homeGoals! : f.awayGoals!) >= (home ? f.awayGoals! : f.homeGoals!);
      });
    },
    reward: (s) => {
      s.community.fanMood = Math.min(100, s.community.fanMood + 5);
      reputation(s, 3);
    },
  },
  {
    id: 'sponsorgeld',
    label: 'Sponsors goed voor €5.000 per week',
    detail: 'Je commerciële machine draait.',
    reached: (s) => s.sponsors.reduce((sum, d) => sum + d.weekly, 0) >= 5000,
    reward: (s) => reputation(s, 3),
  },
];

/** Bonus bij een mijlpaal: schaalt mee met je reeks, zodat het later ook nog telt. */
function bonus(state: GameState): number {
  return Math.round(2500 * DIVISIONS[state.league.divisionLevel].sponsorFactor);
}

/** Controleert wekelijks welke mijlpalen je haalt. Geeft de nieuwe mijlpalen terug. */
export function checkMilestones(state: GameState): Milestone[] {
  const hit: Milestone[] = [];
  for (const m of MILESTONES) {
    if (state.milestones.includes(m.id)) continue;
    if (!m.reached(state)) continue;
    state.milestones.push(m.id);
    m.reward?.(state);
    const cash = bonus(state);
    book(state, 'meevallers', cash, `Mijlpaal: ${m.label}`);
    addNews(state, 'goed', `🎉 Mijlpaal bereikt: ${m.label}. ${m.detail} De feestcommissie haalt ${euro(cash)} op.`);
    hit.push(m);
  }
  return hit;
}
