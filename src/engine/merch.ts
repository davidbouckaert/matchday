// Clubwinkel: supporters kopen sjaals, shirts en mokken. Jij kiest het assortiment en de prijzen.
// Verkoop per week = vraag (supporters, sfeer, resultaten, thuiswedstrijd) × prijsgevoeligheid per artikel.

import type { GameState, MerchItem, Player } from './types';
import type { Factor } from './factors';
import { product } from './factors';
import { recordOrigin } from './origins';
import type { Rng } from './rng';
import { clamp } from './rng';
import { MERCH_ITEM_WEEK_COST, MERCH_WEEK_COST, merchDef } from './data/catalog';
import { MATCH_WEEKS, isWinter } from './calendar';
import { DIVISIONS } from './data/divisions';
import { OWN_TEAM_ID, ownPosition } from './league';
import { staffSkill } from './staff';
import { popularity, willingnessToPay } from './popularity';
import { isStar } from './stars';
import { addNews, book } from './util';

const x = (label: string, value: number, source: string): Factor => ({ label, value, source, kind: 'x' });

/** Prijsgevoeligheid: vragen wat iedereen vraagt = 1, dubbel zo duur = ongeveer een derde van de verkoop. */
export function merchPriceFactor(price: number, ref: number): number {
  return clamp(Math.pow(ref / Math.max(1, price), 1.5), 0.15, 2.2);
}

/** De richtprijs stijgt mee met je populariteit: bij een populaire club betaalt men meer voor een shirt. */
export function refPrice(state: GameState, id: MerchItem['id']): number {
  // in een hogere reeks betalen supporters meer voor hetzelfde shirt
  const level = DIVISIONS[state.league.divisionLevel].refTicketPrice / DIVISIONS[1].refTicketPrice;
  return Math.round(merchDef(id).ref * willingnessToPay(state) * level);
}

/** Speelt er deze week een thuiswedstrijd? Dan is de shop open en verkoopt hij het meest. */
export function isHomeMatchWeek(state: GameState): boolean {
  return state.league.fixtures.some((f) => f.week === state.week && f.homeId === OWN_TEAM_ID);
}

function matchFactor(state: GameState): Factor {
  if (isHomeMatchWeek(state)) return x('Wedstrijddag', 3.4, 'thuiswedstrijd: de shop draait op volle toeren');
  if (MATCH_WEEKS.includes(state.week)) return x('Wedstrijddag', 1.15, 'uitwedstrijd: enkel de webwinkel');
  return x('Wedstrijddag', 0.75, 'geen wedstrijd deze week');
}

/** Alle vermenigvuldigers op de verkoop (ook voor de tab Invloeden). */
export function merchFactors(state: GameState): Factor[] {
  const c = state.community;
  const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const pos = played >= 3 ? ownPosition(state.league) : 8;
  const list: Factor[] = [
    matchFactor(state),
    x('Populariteit', popularity(state).factor, `clubscore, klassement (${played >= 3 ? `${pos}e` : 'nog niet begonnen'}) en recente resultaten`),
    x('Sfeer', 0.6 + c.fanMood / 250, `sfeer ${Math.round(c.fanMood)}/100`),
    x('Verkooppunt', 0.85 + state.infrastructure.kantineLevel * 0.06, `kantine niveau ${state.infrastructure.kantineLevel}/5`),
  ];
  if (isWinter(state.week)) list.push(x('Seizoen', 1.15, 'winter: sjaals en truien verkopen beter'));
  const skill = staffSkill(state, 'merchandising');
  if (skill) list.push(x('Winkelverantwoordelijke', 1 + skill / 120, `vaardigheid ${Math.round(skill)}`));
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

// ---------- Shirts met een naam ----------
//
// Wie een replicashirt koopt, wil er vaak een naam op — en welke naam, dat beslist de
// tribune, niet het bestuur. Zo zie je zwart op wit wie je populairste speler is: de
// ranglijst op het winkelscherm is de optelsom van echte drukorders, geen meter die wij
// verzinnen. De bedrukking is een kleine meerprijs bovenop het shirt zelf.

export const PRINT_PRICE = 12; // wat de supporter extra betaalt voor een naam en nummer
export const PRINT_COST = 3; // wat de drukker jou per shirt rekent
export const PRINT_SHARE = 0.6; // deel van de shirtkopers dat een naam wil

/**
 * Hoe graag supporters de naam van déze speler op hun rug willen.
 *
 * Basisplaatsen wegen mee (wie er elke week staat, kent iedereen), doelpunten wegen
 * zwaarder (de spits verkoopt), een sterspeler verkoopt nog eens dubbel zo goed, en een
 * jongen uit de eigen jeugd heeft streekwaarde. Wie uitgeleend is, hangt in een andere
 * kleedkamer en verkoopt hier niets.
 */
export function shirtFame(state: GameState, p: Player): number {
  if (p.loan?.type === 'uit') return 0;
  let fame = 1 + p.starts * 1.5 + p.goals * 4;
  if (isStar(state, p)) fame *= 2;
  if (p.isYouth) fame *= 1.35;
  return fame;
}

/** De spelers zoals de winkel ze zou uitstallen: populairste eerst. */
export function shirtRanking(state: GameState): { p: Player; fame: number }[] {
  return state.players
    .map((p) => ({ p, fame: shirtFame(state, p) }))
    .filter((x) => x.fame > 0)
    .sort((a, b) => b.fame - a.fame);
}

/** De naam die dit seizoen het vaakst gedrukt werd (minstens één keer). */
export function topShirtName(state: GameState): { id: string; name: string; aantal: number } | null {
  const lijst = [...state.merch.shirtNames].sort((a, b) => b.aantal - a.aantal);
  return lijst.length && lijst[0].aantal > 0 ? lijst[0] : null;
}

/** De drukorders van deze week: wie er verkocht, boekt zijn naam bij op de ranglijst. */
function weeklyPrints(state: GameState, rng: Rng, shirtsVerkocht: number): void {
  const m = state.merch;
  m.lastPrints = { aantal: 0, omzet: 0 };
  if (!shirtsVerkocht) return;
  const ranking = shirtRanking(state);
  if (!ranking.length) return;
  const vorige = topShirtName(state);

  const totaal = ranking.reduce((sum, x) => sum + x.fame, 0);
  let aantal = 0;
  for (let i = 0; i < shirtsVerkocht; i++) {
    if (!rng.chance(PRINT_SHARE)) continue;
    aantal++;
    // gewogen loting: hoe beroemder, hoe vaker jouw naam onder de pers gaat
    let r = rng.next() * totaal;
    const keuze = ranking.find((x) => (r -= x.fame) <= 0) ?? ranking[0];
    const rij = m.shirtNames.find((x) => x.id === keuze.p.id);
    if (rij) {
      rij.aantal++;
      rij.name = keuze.p.name; // naam kan ooit wijzigen? goedkoop actueel houden
    } else m.shirtNames.push({ id: keuze.p.id, name: keuze.p.name, aantal: 1 });
  }
  if (!aantal) return;

  const omzet = aantal * PRINT_PRICE;
  m.lastPrints = { aantal, omzet };
  book(state, 'clubartikelen', omzet, `Bedrukking: ${aantal} ${aantal === 1 ? 'naam' : 'namen'} op shirts`);
  book(state, 'inkoop winkel', -aantal * PRINT_COST, 'Drukwerk namen op shirts');

  // een wissel aan de top is nieuws in het dorp — vanaf er echt iets verkocht is
  const nieuwe = topShirtName(state);
  if (nieuwe && nieuwe.aantal >= 5 && nieuwe.id !== vorige?.id) {
    addNews(state, 'neutraal', `De tribune heeft gekozen: ${nieuwe.name} is nu de meest gedrukte naam op de shirts in de clubwinkel.`);
  }
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
  weeklyPrints(state, rng, result.units.find((u) => u.id === 'shirt')?.units ?? 0);

  const sold = result.units.reduce((s, u) => s + u.units, 0);
  if (result.revenue > 0) {
    book(state, 'clubartikelen', result.revenue, `Clubwinkel: ${sold} artikelen verkocht`);
    recordOrigin(state, 'clubartikelen', `Clubwinkel (${sold} artikelen)`, result.revenue, merchFactors(state));
  }
  if (result.cost > 0) book(state, 'inkoop winkel', -result.cost, `Inkoop van de ${sold} verkochte artikelen`);
  book(state, 'werking winkel', -result.fixed, 'Werking clubwinkel en webwinkel (vaste kost)');
  return result;
}
