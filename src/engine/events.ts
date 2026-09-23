import type { EventDef } from '../content/types';
import type { GameState } from './types';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { RANDOM_EVENTS } from '../content/events';
import { DIVISIONS } from './data/divisions';
import { PRO_CLUBS } from './data/names';
import { isTransferWindow } from './calendar';
import { apply, baseVars, openStoryline, pickPlayer, storyline, test, worldContext } from './content';
import type { Focus } from './content';
import { generatePlayer, marketValue, overall } from './players';
import { staffSkill } from './staff';
import { injuryFactors, overFatigueFactor, product } from './factors';
import { addNews, nextId, weeks as weeksLabel } from './util';

const EVENT_COOLDOWN_PREFIX = 'event-';

/** De kans dat een gebeurtenis deze week valt, inclusief de factoren uit de data. */
export function eventChance(state: GameState, def: EventDef): number {
  const ctx = worldContext(state);
  if (!test(state, ctx, def.wanneer)) return 0;
  if ((state.eventCooldowns[EVENT_COOLDOWN_PREFIX + def.id] ?? 0) > 0) return 0;
  let chance = def.kans;
  for (const f of def.kansFactoren ?? []) {
    if (test(state, ctx, f.wanneer)) chance *= f.factor;
  }
  return chance;
}

/** Voert één gebeurtenis uit. Apart zodat een test hem rechtstreeks kan aanroepen. */
export function fireEvent(state: GameState, rng: Rng, def: EventDef): void {
  const ctx = worldContext(state);
  const focus: Focus = {};
  if (def.focusSpeler) focus.playerId = pickPlayer(state, rng, def.focusSpeler)?.id ?? null;
  if (def.focusSponsor === 'grootste') focus.sponsorId = [...state.sponsors].sort((a, b) => b.weekly - a.weekly)[0]?.id ?? null;
  else if (def.focusSponsor === 'willekeurig' && state.sponsors.length) focus.sponsorId = rng.pick(state.sponsors).id;
  const inherited = def.verhaal ? storyline(state, def.verhaal)?.vars : undefined;
  apply(state, rng, def.effecten, focus, ctx, { ...baseVars(state, ctx, focus), ...inherited });
  if (def.cooldown) state.eventCooldowns[EVENT_COOLDOWN_PREFIX + def.id] = def.cooldown;
}

function rollRandomEvents(state: GameState, rng: Rng): void {
  for (const def of RANDOM_EVENTS) {
    if (rng.chance(eventChance(state, def))) fireEvent(state, rng, def);
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
    // de zorgen ebben weg, maar niet meteen: de verhaallijn loopt gewoon af
    state.weeksNegative = 0;
    state.emergencyLoanOffered = false;
    return;
  }
  state.weeksNegative++;
  const w = state.weeksNegative;
  // financiële zorgen laten sporen na, ook nadat het saldo weer klopt
  if (w >= 2) openStoryline(state, 'geldzorgen', 40);
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
