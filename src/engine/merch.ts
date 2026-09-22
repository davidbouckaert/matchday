// Fanshop: supporters kopen sjaals, shirts en mokken. Jij kiest het assortiment en de prijzen.
// Verkoop per week = vraag (supporters, sfeer, resultaten, thuiswedstrijd) × prijsgevoeligheid per artikel.

import type { GameState, MerchItem } from './types';
import type { Factor } from './factors';
import { product } from './factors';
import type { Rng } from './rng';
import { clamp } from './rng';
import { MERCH_ITEM_WEEK_COST, MERCH_WEEK_COST, merchDef } from './data/catalog';
import { MATCH_WEEKS, isWinter } from './calendar';
import { OWN_TEAM_ID, ownPosition } from './league';
import { staffSkill } from './staff';
import { popularity, willingnessToPay } from './popularity';
import { book } from './util';

const x = (label: string, value: number, source: string): Factor => ({ label, value, source, kind: 'x' });

/** Prijsgevoeligheid: vragen wat iedereen vraagt = 1, dubbel zo duur = ongeveer een derde van de verkoop. */
export function merchPriceFactor(price: number, ref: number): number {
  return clamp(Math.pow(ref / Math.max(1, price), 1.5), 0.15, 2.2);
}

/** De richtprijs stijgt mee met je populariteit: bij een populaire club betaalt men meer voor een shirt. */
export function refPrice(state: GameState, id: MerchItem['id']): number {
  return Math.round(merchDef(id).ref * willingnessToPay(state));
}

/** Speelt er deze week een thuiswedstrijd? Dan is de shop open en verkoopt hij het meest. */
export function isHomeMatchWeek(state: GameState): boolean {
  return state.league.fixtures.some((f) => f.week === state.week && f.homeId === OWN_TEAM_ID);
}

function matchFactor(state: GameState): Factor {
  if (isHomeMatchWeek(state)) return x('Wedstrijddag', 3.4, 'thuiswedstrijd: de shop draait op volle toeren');
  if (MATCH_WEEKS.includes(state.week)) return x('Wedstrijddag', 1.15, 'uitwedstrijd: enkel de webshop');
  return x('Wedstrijddag', 0.75, 'geen wedstrijd deze week');
}

/** Alle vermenigvuldigers op de verkoop (ook voor de tab Invloeden). */
export function merchFactors(state: GameState): Factor[] {
  const c = state.community;
  const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const pos = played >= 3 ? ownPosition(state.league) : 8;
  const list: Factor[] = [
    matchFactor(state),
    x('Populariteit', popularity(state).factor, `clubrating, klassement (${played >= 3 ? `${pos}e` : 'nog niet begonnen'}) en recente resultaten`),
    x('Sfeer', 0.6 + c.fanMood / 250, `sfeer ${Math.round(c.fanMood)}/100`),
    x('Verkooppunt', 0.85 + state.infrastructure.kantineLevel * 0.06, `kantine niveau ${state.infrastructure.kantineLevel}/5`),
  ];
  if (isWinter(state.week)) list.push(x('Seizoen', 1.15, 'winter: sjaals en truien verkopen beter'));
  const skill = staffSkill(state, 'merchandising');
  if (skill) list.push(x('Merchandisingverantwoordelijke', 1 + skill / 120, `vaardigheid ${Math.round(skill)}`));
  const commercial = staffSkill(state, 'commercieel');
  if (commercial) list.push(x('Commercieel medewerker', 1 + commercial / 400, `vaardigheid ${Math.round(commercial)}`));
  if (state.avatar.background === 'lokaal') list.push(x('Achtergrond eigenaar', 1.1, 'lokale verankering'));
  return list;
}

/** Inkoopprijs per stuk: een goede verantwoordelijke onderhandelt betere voorwaarden. */
export function buyPrice(state: GameState, itemId: MerchItem['id']): number {
  const def = merchDef(itemId);
  return def.buy * (1 - staffSkill(state, 'merchandising') / 500);
}

/** Verwachte verkoop van één artikel deze week (stuks). */
export function expectedUnits(state: GameState, item: MerchItem): number {
  const def = merchDef(item.id);
  const base = (state.community.fanBase / 90) * def.appeal;
  const factors = product(merchFactors(state));
  return base * factors * merchPriceFactor(item.price, refPrice(state, item.id));
}

export interface MerchWeek {
  units: { id: MerchItem['id']; units: number; revenue: number }[];
  revenue: number;
  cost: number;
  fixed: number;
}

/** Marge per stuk bij de huidige prijs. */
export function margin(state: GameState, item: MerchItem): number {
  return item.price - buyPrice(state, item.id);
}

/** Prijs met de beste verwachte winst (wat een verantwoordelijke zou vragen). */
export function bestPrice(state: GameState, itemId: MerchItem['id']): number {
  const ref = refPrice(state, itemId);
  const cost = buyPrice(state, itemId);
  let best = ref;
  let bestProfit = -Infinity;
  for (let price = Math.ceil(cost) + 1; price <= ref * 2.5; price++) {
    const profit = merchPriceFactor(price, ref) * (price - cost);
    if (profit > bestProfit) {
      bestProfit = profit;
      best = price;
    }
  }
  return best;
}

/** Wekelijkse verkoop. Wordt in advanceWeek opgeroepen nadat de wedstrijd gespeeld is. */
export function weeklyMerch(state: GameState, rng: Rng): MerchWeek | null {
  const m = state.merch;
  if (!m.active) return null;
  const result: MerchWeek = { units: [], revenue: 0, cost: 0, fixed: 0 };
  for (const item of m.items) {
    const units = rng.poisson(Math.max(0, expectedUnits(state, item)));
    const revenue = units * item.price;
    const cost = units * buyPrice(state, item.id);
    item.soldTotal += units;
    state.stats.merch[item.id] = (state.stats.merch[item.id] ?? 0) + units;
    result.units.push({ id: item.id, units, revenue: Math.round(revenue) });
    result.revenue += revenue;
    result.cost += cost;
  }
  const skill = staffSkill(state, 'merchandising');
  result.fixed = MERCH_WEEK_COST * (1 - skill / 400) + m.items.length * MERCH_ITEM_WEEK_COST;
  m.lastUnits = result.units;
  m.seasonUnits += result.units.reduce((s, u) => s + u.units, 0);

  const sold = result.units.reduce((s, u) => s + u.units, 0);
  if (result.revenue > 0) book(state, 'merchandising', result.revenue, `Fanshop: ${sold} artikelen verkocht`);
  if (result.cost > 0) book(state, 'inkoop shop', -result.cost, `Inkoop van de ${sold} verkochte artikelen`);
  book(state, 'werking shop', -result.fixed, 'Werking fanshop en webshop (vaste kost)');
  return result;
}
