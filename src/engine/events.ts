import type { GameState } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { PRO_CLUBS } from './data/names';
import { isTransferWindow, isWinter } from './calendar';
import { breakdownChance } from './finance';
import { generatePlayer, marketValue, overall } from './players';
import { staffSkill } from './staff';
import { injuryFactors, overFatigueFactor, product } from './factors';
import { addNews, book, nextId, weeks as weeksLabel } from './util';

interface RandomEvent {
  id: string;
  chance: (s: GameState) => number; // kans per week
  apply: (s: GameState, rng: Rng) => void;
}

// Meevallers en tegenslagen. Rudimentair: één effect, één nieuwsbericht.
const EVENTS: RandomEvent[] = [
  {
    id: 'storm',
    chance: (s) => (isWinter(s.week) ? 0.025 : 0.006),
    apply: (s, rng) => {
      const cost = rng.int(2, 7) * 1000;
      book(s, 'tegenslagen', -cost, 'Stormschade');
      addNews(s, 'slecht', `Storm! Het dak van de tribune is beschadigd. Herstelling: €${cost.toLocaleString('nl-BE')}.`);
    },
  },
  {
    id: 'influencer',
    chance: () => 0.008,
    apply: (s, rng) => {
      const extra = rng.int(20, 60);
      s.community.fanBase += extra;
      s.community.reputation = clamp(s.community.reputation + 2, 0, 100);
      addNews(s, 'goed', `Een lokale influencer filmde een wedstrijd. De video ging viraal: +${extra} supporters.`);
    },
  },
  {
    id: 'subsidie',
    chance: () => 0.007,
    apply: (s, rng) => {
      const amount = rng.int(3, 8) * 1000;
      book(s, 'subsidies', amount, 'Extra subsidie gemeente');
      addNews(s, 'goed', `De gemeente kent een extra sportsubsidie toe van €${amount.toLocaleString('nl-BE')}.`);
    },
  },
  {
    id: 'inbraak',
    chance: () => 0.006,
    apply: (s, rng) => {
      const cost = rng.int(8, 25) * 100;
      book(s, 'tegenslagen', -cost, 'Inbraak kantine');
      addNews(s, 'slecht', `Inbraak in de kantine. De kassa en de vriezer met frieten zijn weg (€${cost.toLocaleString('nl-BE')}).`);
    },
  },
  {
    id: 'koeling',
    chance: () => 0.006,
    apply: (s) => {
      book(s, 'tegenslagen', -3200, 'Koelinstallatie');
      addNews(s, 'slecht', 'De koelinstallatie van de kantine begeeft het. Vervanging: €3.200.');
    },
  },
  {
    id: 'defect',
    chance: (s) => breakdownChance(s),
    apply: (s, rng) => {
      const what = rng.pick(['de verwarming van de kleedkamers', 'een deel van de verlichting', 'de dakgoot van de tribune', 'de grasmachine', 'de boiler van de douches']);
      const level = s.infrastructure.maintenance;
      const cost = rng.int(1, 5) * 1000 * (level === 'basis' ? 1.4 : 1);
      book(s, 'tegenslagen', -Math.round(cost), 'Herstelling');
      addNews(
        s,
        'slecht',
        `Defect: ${what} is stuk. Herstelling: €${Math.round(cost).toLocaleString('nl-BE')}.${level === 'basis' ? ' Met meer onderhoud was dit niet gebeurd.' : ''}`,
      );
    },
  },
  {
    id: 'erfenis',
    chance: () => 0.0015,
    apply: (s) => {
      book(s, 'meevallers', 15000, 'Schenking oud-voorzitter');
      addNews(s, 'goed', 'Een overleden oud-voorzitter liet de club €15.000 na. Er komt een minuut applaus.');
    },
  },
  {
    id: 'vrijwilliger-weg',
    chance: (s) => (s.community.volunteerLoyaltyWeeks > 0 ? 0.012 : 0.03),
    apply: (s, rng) => {
      const n = rng.int(1, 2);
      s.community.volunteers = Math.max(2, s.community.volunteers - n);
      addNews(s, 'slecht', n === 1 ? 'Een vrijwilliger stopt ermee. "Het is te veel geworden."' : `${n} vrijwilligers stoppen ermee. "Het is te veel geworden."`);
    },
  },
  {
    id: 'vrijwilliger-bij',
    chance: (s) => 0.01 + s.community.fanMood / 3000,
    apply: (s, rng) => {
      const n = rng.int(1, 4);
      s.community.volunteers += n;
      addNews(s, 'goed', n === 1 ? 'Een ouder van een jeugdspeler meldt zich als vrijwilliger.' : `${n} ouders van jeugdspelers melden zich als vrijwilliger.`);
    },
  },
  {
    id: 'griep',
    chance: (s) => (isWinter(s.week) ? 0.015 : 0),
    apply: (s, rng) => {
      const victims = s.players.filter(() => rng.chance(0.2));
      victims.forEach((p) => (p.injuryWeeks = Math.max(p.injuryWeeks, 1)));
      addNews(s, 'slecht', `Griepgolf in de kleedkamer: ${victims.length} spelers zijn een week out.`);
    },
  },
  {
    id: 'supportersclub',
    chance: (s) => (s.community.fanMood > 70 ? 0.006 : 0),
    apply: (s) => {
      s.community.fanBase += 40;
      s.community.fanMood = clamp(s.community.fanMood + 4, 0, 100);
      addNews(s, 'goed', 'Een nieuwe supportersclub is opgericht: "De Zuiderlingen". +40 supporters.');
    },
  },
  {
    id: 'sponsor-failliet',
    chance: (s) => (s.sponsors.length > 3 ? 0.004 : 0),
    apply: (s, rng) => {
      const candidates = s.sponsors.filter((d) => d.kind !== 'stadion');
      if (!candidates.length) return;
      const deal = rng.pick(candidates);
      s.sponsors = s.sponsors.filter((d) => d.id !== deal.id);
      addNews(s, 'slecht', `Sponsor ${deal.name} is failliet. Het contract valt weg.`);
    },
  },
  {
    id: 'krant-slecht',
    chance: (s) => (s.community.fanMood < 40 ? 0.03 : 0),
    apply: (s) => {
      s.community.reputation = clamp(s.community.reputation - 3, 0, 100);
      addNews(s, 'slecht', 'De lokale krant kopt: "Onrust bij de supporters, waar gaat het heen met de club?"');
    },
  },
];

function rollRandomEvents(state: GameState, rng: Rng): void {
  for (const e of EVENTS) {
    if (rng.chance(e.chance(state))) e.apply(state, rng);
  }
}

/** Profclubs die interesse tonen in jouw talenten. */
function rollPlayerOffers(state: GameState, rng: Rng): void {
  for (const o of state.playerOffers) o.expiresInWeeks--;
  state.playerOffers = state.playerOffers.filter((o) => o.expiresInWeeks > 0 && state.players.some((p) => p.id === o.playerId));
  if (!isTransferWindow(state.week)) return;

  const level = DIVISIONS[state.league.divisionLevel].opponentStrength;
  for (const p of state.players) {
    if (p.loan) continue;
    // meerdere clubs mogen tegelijk op dezelfde speler bieden (max 2)
    if (state.playerOffers.filter((o) => o.playerId === p.id).length >= 2) continue;
    if (p.listed) {
      // te koop gezet: grotere kans op een bod, afhankelijk van hoe realistisch de vraagprijs is
      const value = marketValue(p, state.marketIndex);
      const realism = p.askingPrice > 0 ? clamp(value / p.askingPrice, 0.2, 1.2) : 1;
      if (rng.chance(0.35 * realism)) {
        const amount = round(Math.max(value * rng.range(0.8, 1.1), Math.min(p.askingPrice, value * 1.2) * rng.range(0.9, 1)), 500);
        const club = rng.chance(0.2) ? rng.pick(PRO_CLUBS) : rng.pick(state.league.teams).name;
        state.playerOffers.push({ id: nextId(state, 'o'), playerId: p.id, club, amount, expiresInWeeks: 2 });
        addNews(state, 'goed', `${club} reageert op de transferlijst: €${amount.toLocaleString('nl-BE')} voor ${p.name}.`);
        continue;
      }
    }
    const talent = p.potential - level + (overall(p) - level) * 0.5;
    const young = p.age <= 23 ? 1 : 0.3;
    const chance = clamp(talent / 400, 0, 0.12) * young + 0.004;
    if (!rng.chance(chance)) continue;
    const isPro = talent > 12 && p.age <= 23;
    const club = isPro ? rng.pick(PRO_CLUBS) : rng.pick(state.league.teams).name;
    const factor = isPro ? rng.range(1.3, 2.6) : rng.range(0.8, 1.2);
    const amount = round(marketValue(p, state.marketIndex) * factor, 500);
    if (amount < 1000) continue;
    state.playerOffers.push({ id: nextId(state, 'o'), playerId: p.id, club, amount, expiresInWeeks: 2 });
    addNews(state, 'goed', `${club} biedt €${amount.toLocaleString('nl-BE')} voor ${p.name}. Bekijk het bij Ploeg.`);
  }
}

/** Het fonds bemoeit zich soms met de selectie. */
function rollInvestorInterference(state: GameState, rng: Rng): void {
  if (state.investor !== 'fonds' || !state.investorActive) return;
  if (!isTransferWindow(state.week) || !rng.chance(0.05)) return;
  const level = DIVISIONS[state.league.divisionLevel].opponentStrength;
  const p = generatePlayer(state, rng, { quality: level + 3, age: rng.int(19, 24), season: state.season, potentialBoost: 5 });
  p.wage = round(p.wage * 1.6, 5);
  p.contractUntil = state.season + 2;
  state.players.push(p);
  addNews(state, 'neutraal', `Het fonds heeft ${p.name} (${p.age} jaar) bij de club geplaatst. Zijn loon: €${p.wage}/week. Discussie is niet mogelijk.`);
}

/** Tijdens de laatste weken onder nul wordt de druk steeds groter. */
export function bankruptcyCheck(state: GameState): void {
  if (state.cash >= 0) {
    if (state.weeksNegative > 0) addNews(state, 'goed', 'Het saldo is weer positief. De bank ademt opgelucht.');
    state.weeksNegative = 0;
    state.emergencyLoanOffered = false;
    return;
  }
  state.weeksNegative++;
  const w = state.weeksNegative;
  if (w === 1) addNews(state, 'slecht', 'Waarschuwing: het saldo staat onder nul. Na 8 weken is de club failliet.');
  if (w === 3) {
    state.emergencyLoanOffered = true;
    addNews(state, 'slecht', 'De bank biedt een noodlening aan tegen 15% rente (zie Financiën).');
  }
  if (w === 5) {
    state.players.forEach((p) => (p.morale = clamp(p.morale - 10, 0, 100)));
    state.community.fanMood = clamp(state.community.fanMood - 10, 0, 100);
    addNews(state, 'slecht', 'De spelersraad eist garanties over de betaling van de vergoedingen. Supporters zijn ongerust.');
  }
  if (w === 7) addNews(state, 'slecht', 'Laatste waarschuwing: volgende week is de club failliet als het saldo niet positief is.');
  if (w >= 8) {
    state.gameOver = true;
    state.gameOverReason = 'De club stond 8 weken onder nul en werd failliet verklaard door de rechtbank.';
    addNews(state, 'slecht', state.gameOverReason);
  }
}

export function weeklyEvents(state: GameState, rng: Rng): void {
  rollRandomEvents(state, rng);
  rollPlayerOffers(state, rng);
  rollInvestorInterference(state, rng);
}

/** Blessures na een wedstrijd; de kinesist beperkt de schade. */
export function rollInjuries(state: GameState, rng: Rng, playedIds: string[]): void {
  const kine = staffSkill(state, 'kinesist');
  const clubFactor = product(injuryFactors(state));
  for (const id of playedIds) {
    const p = state.players.find((x) => x.id === id);
    if (!p) continue;
    const risk = (0.035 + (p.age > 30 ? 0.015 : 0) + (p.trait === 'feestbeest' ? 0.015 : 0)) * clubFactor * overFatigueFactor(p.fatigue);
    if (rng.chance(risk)) {
      const weeks = Math.max(1, Math.round(rng.range(1, 7) * (1 - kine / 250)));
      p.injuryWeeks = weeks;
      addNews(state, 'slecht', `${p.name} is geblesseerd en valt ${weeksLabel(weeks)} uit.`);
    }
  }
}
