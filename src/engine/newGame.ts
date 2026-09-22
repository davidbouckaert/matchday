import type { Avatar, GameState, InvestorId, Position } from './types';
import { createRng, clamp } from './rng';
import { DIVISIONS, START_DIVISION } from './data/divisions';
import { INVESTORS, START_CLUBS } from './data/setup';
import { createLeague } from './league';
import { generatePlayer, linkFriends } from './players';
import { generateStaff } from './staff';
import { refreshLoanMarket, refreshStaffMarket, refreshTransferList } from './market';
import { annuity } from './loans';
import { makeDeal, startingSponsors } from './sponsors';
import { addNews, book } from './util';
import { CANTEEN_ITEMS } from './data/catalog';
import { emptyStats } from './stats';

export const SAVE_VERSION = 13;

export interface NewGameOptions {
  avatar: Avatar;
  crest?: string;
  clubName?: string; // eigen naam voor je club (leeg = de naam van de club zelf)
  clubId: string;
  investor: InvestorId;
  seed?: number;
  startYear?: number;
}

const SQUAD: [Position, number][] = [
  ['DOEL', 3],
  ['VERD', 7],
  ['MIDD', 7],
  ['AANV', 5],
];

export function createNewGame(opts: NewGameOptions): GameState {
  const club = START_CLUBS.find((c) => c.id === opts.clubId);
  if (!club) throw new Error(`Onbekende club: ${opts.clubId}`);
  const investor = INVESTORS.find((i) => i.id === opts.investor)!;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    idCounter: 0,
    season: 1,
    week: 1,
    startYear: opts.startYear ?? 2026,
    avatar: opts.avatar,
    investor: opts.investor,
    clubId: club.id,
    clubName: (opts.clubName ?? '').trim() || club.name,
    cash: club.cash,
    weeksNegative: 0,
    gameOver: false,
    gameOverReason: '',
    ticketPrice: DIVISIONS[START_DIVISION].refTicketPrice,
    players: [],
    staff: [],
    league: { divisionLevel: START_DIVISION, teams: [], fixtures: [], table: [], discipline: [] },
    loans: [],
    sponsors: [],
    sponsorOffers: [],
    infrastructure: {
      capacity: club.capacity,
      kantineLevel: club.kantineLevel,
      pitch: club.pitch,
      lightingLevel: 1,
      academyLevel: 0,
      recoveryLevel: 0,
      wifiLevel: 0,
      sanitairLevel: 0,
      parkingLevel: 0,
      scoreboardLevel: 0,
      teamBus: false,
      maintenance: 'normaal',
      greenEnergy: false,
      construction: null,
    },
    crest: opts.crest ?? 'schild',
    merch: { active: false, items: [], lastUnits: [], seasonUnits: 0 },
    canteen: { items: CANTEEN_ITEMS.map((c) => ({ id: c.id, price: c.ref })), concessions: [], lastCanteen: [], lastConcessions: [] },
    stats: emptyStats(1),
    statsHistory: [],
    statsWeeks: [],
    requests: [],
    log: [],
    records: { attendance: 0, weekIncome: 0, seasonIncome: 0, unbeaten: 0, winStreak: 0, fanBase: 0 },
    lastRecords: [],
    milestones: [],
    lastMilestones: [],
    community: {
      fanBase: club.fanBase,
      fanMood: club.fanMood,
      volunteers: club.volunteers,
      volunteerLoyaltyWeeks: 0,
      reputation: club.reputation,
      youthMembers: club.youthMembers,
    },
    inflation: 1,
    marketIndex: 1,
    transferList: [],
    loanMarket: [],
    periodMatches: 0,
    eventLog: [],
    playerOffers: [],
    staffMarket: [],
    eventCooldowns: {},
    eventCounts: {},
    pending: [],
    tactics: { formation: '4-4-2', mentality: 'gebalanceerd', plan: 'balbezit', manualXI: [], trainings: 3, focus: 'conditie', roles: { kapitein: null, strafschop: null, hoekschop: null } },
    delegation: {},
    transferBudget: 0,
    youthFee: 230,
    prospects: [],
    sponsorCampaignWeeks: 0,
    emergencyLoanOffered: false,
    promotionsWithInvestor: 0,
    investorActive: true,
    licenceWarnings: 0,
    nextDivisionLevel: START_DIVISION,
    lastMatch: null,
    history: [],
    lastWeek: [],
    thisWeek: [],
    seasonTotals: {},
    lastSeasonTotals: {},
    cashHistory: [],
    weekHistory: [],
    news: [],
  };

  const rng = createRng(state);
  state.league = createLeague(rng, START_DIVISION);

  // spelerskern
  for (const [position, count] of SQUAD) {
    for (let i = 0; i < count; i++) {
      const p = generatePlayer(state, rng, { position, quality: club.squadStrength, ageBias: club.squadAgeBias, season: 1 });
      p.wage = Math.round((p.wage * club.wageLevel) / 5) * 5;
      p.contractUntil = 1 + rng.int(0, 3); // een deel loopt af na dit seizoen
      state.players.push(p);
    }
  }
  linkFriends(state.players, rng, 9);

  // staff: enkel een trainer en een afgevaardigde (vrijwilliger)
  const trainer = generateStaff(state, rng, 'hoofdtrainer', club.trainer.skill);
  trainer.skill = club.trainer.skill;
  trainer.wage = club.trainer.wage;
  trainer.diploma = 'EUFA B';
  state.staff.push(trainer);
  const delegate = generateStaff(state, rng, 'afgevaardigde', 45);
  delegate.wage = 40;
  state.staff.push(delegate);

  // bestaande lening en sponsors
  if (club.loan) {
    const remainingWeeks = Math.round(club.loan.weeks * 0.8);
    state.loans.push({
      id: 'l0',
      label: club.loan.label,
      principal: club.loan.principal,
      remaining: Math.round(club.loan.principal * 0.82),
      annualRate: club.loan.rate,
      weeklyPayment: Math.round(annuity(club.loan.principal * 0.82, club.loan.rate, remainingWeeks)),
      weeksLeft: remainingWeeks,
    });
  }
  startingSponsors(state, rng, club.sponsorWeekly);

  // effecten van je achtergrond
  if (opts.avatar.background === 'exspeler') state.players.forEach((p) => (p.morale = clamp(p.morale + 10, 0, 100)));
  if (opts.avatar.background === 'lokaal') {
    state.community.volunteers = Math.round(state.community.volunteers * 1.25);
    state.community.fanMood = clamp(state.community.fanMood + 5, 0, 100);
  }

  // effecten van de investeerder
  book(state, 'investeerder', investor.capital, `Kapitaalinjectie ${investor.name}`);
  if (opts.investor === 'aannemer') {
    const deal = makeDeal(state, rng, 'stadion', 600);
    deal.name = 'Stevens Arena';
    deal.sector = 'Bouw'; // de aannemer zelf: naamsponsor van het stadion
    deal.weeksLeft = 9999;
    state.sponsors.push(deal);
  }
  if (opts.investor === 'cooperatie') {
    state.community.volunteers = Math.round(state.community.volunteers * 1.3);
    state.community.fanBase = Math.round(state.community.fanBase * 1.15);
    state.community.fanMood = clamp(state.community.fanMood + 8, 0, 100);
  }

  refreshTransferList(state, rng, true);
  refreshStaffMarket(state, rng);
  refreshLoanMarket(state, rng);

  // de startinjectie hoort niet in het "vorige week"-overzicht, wel in de seizoenstotalen
  state.lastWeek = state.thisWeek;
  state.thisWeek = [];
  state.cashHistory = [state.cash];

  addNews(state, 'neutraal', `Welkom, ${opts.avatar.name}! Je bent de nieuwe eigenaar van ${club.name}, net gepromoveerd naar ${DIVISIONS[START_DIVISION].name}.`);
  addNews(state, 'neutraal', 'De transferperiode is open tot eind augustus. De competitie start in week 7.');
  return state;
}
