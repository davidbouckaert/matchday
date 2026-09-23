import type { ActionResult, GameState, SponsorDeal, SponsorProspect } from './types';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { SECTORS, SPONSOR_COMPANIES, sectorKind } from './data/names';
import { staffSkill } from './staff';
import { product, sponsorFactors } from './factors';
import { ownPosition } from './league';
import { addLog, addNews, book, nextId } from './util';
import { creditLimit } from './loans';
import { grantLoan } from './actions';

type Kind = SponsorDeal['kind'];

const KIND_RANGE: Record<Kind, [number, number]> = {
  bord: [30, 70],
  bal: [45, 90],
  jeugd: [80, 180],
  scherm: [90, 190],
  evenement: [110, 230],
  bus: [140, 280],
  mouw: [180, 380],
  shirt: [250, 550],
  hoofdsponsor: [700, 1300],
  stadion: [600, 600],
};

export const KIND_LABEL: Record<Kind, string> = {
  bord: 'Reclamebord',
  bal: 'Wedstrijdbal',
  jeugd: 'Jeugdsponsor',
  scherm: 'Schermen in de kantine',
  evenement: 'Evenementensponsor',
  bus: 'Ploegbus',
  mouw: 'Mouwsponsor',
  shirt: 'Shirtsponsor rug',
  hoofdsponsor: 'Hoofdsponsor borst',
  stadion: 'Stadionnaam',
};

export const KIND_INFO: Record<Kind, string> = {
  bord: 'Een bord langs het veld. Veel plaatsen, klein bedrag; hoe meer borden er al hangen, hoe minder een extra bord opbrengt.',
  bal: 'Een bedrijf schenkt de wedstrijdbal en wordt omgeroepen. Klein maar makkelijk te verkopen.',
  jeugd: 'Draagt de jeugdwerking: tornooien, uitrusting en busritten.',
  scherm: 'Reclame op de schermen in je kantine. Vraagt een kantine van niveau 2 of hoger.',
  evenement: 'Zet zijn naam op je evenementen (quiz, spaghetti-avond, fandag). Groeit mee met hoeveel je organiseert.',
  bus: 'Zijn naam op de ploegbus en op de verplaatsingen.',
  mouw: 'Klein logo op de mouw van het shirt.',
  shirt: 'Grote plaats op de rug van het shirt.',
  hoofdsponsor: 'De borst van het shirt: het grootste contract dat je kunt tekenen.',
  stadion: 'De naam van je terrein. Hoort bij je investeerder.',
};

export const KIND_MAX: Record<Kind, number> = { bord: 16, bal: 4, jeugd: 3, scherm: 2, evenement: 2, bus: 1, mouw: 1, shirt: 1, hoofdsponsor: 1, stadion: 1 };
const KIND_ORDER: Kind[] = ['bord', 'bal', 'jeugd', 'scherm', 'evenement', 'bus', 'mouw', 'shirt', 'hoofdsponsor'];

/** Sommige plaatsen bestaan pas als je de infrastructuur of werking hebt. */
export function kindLock(state: GameState, kind: Kind): string | null {
  if (kind === 'scherm' && state.infrastructure.kantineLevel < 2) return 'Kantine niveau 2 nodig';
  if (kind === 'evenement' && state.eventLog.filter((e) => e.season === state.season).length < 1) return 'Eerst een evenement organiseren';
  if (kind === 'jeugd' && state.community.youthTeams < 3) return '3 jeugdploegen nodig';
  if (kind === 'bus' && !state.infrastructure.teamBus) return 'Eerst een eigen ploegbus kopen';
  if (kind === 'bal' && state.community.fanBase < 250) return '250 supporters nodig';
  return null;
}

export const NETWORK_EVENING = { cost: 1_500, cooldown: 12 };
export const CAMPAIGN = { cost: 3_000, weeks: 4 };

function sponsorMultiplier(state: GameState): number {
  return product(sponsorFactors(state));
}

/** Hoe meer borden er al hangen, hoe minder een extra bord waard is (de lokale markt is beperkt). */
export function boardSaturation(state: GameState): number {
  const boards = state.sponsors.filter((s) => s.kind === 'bord').length;
  return Math.max(0.5, 1 - boards * 0.03);
}

/** Verwachte bandbreedte (per week) voor een type sponsor, op het huidige niveau van de club.
 *  Hoe meer borden er al hangen, hoe minder een extra bord waard is (de lokale markt is beperkt). */
export function kindRange(state: GameState, kind: Kind): [number, number] {
  const [min, max] = KIND_RANGE[kind];
  const saturation = kind === 'bord' ? boardSaturation(state) : 1;
  const events = kind === 'evenement' ? clamp(0.7 + state.eventLog.filter((e) => e.season === state.season).length * 0.15, 0.7, 1.6) : 1;
  const m = sponsorMultiplier(state) * saturation * events;
  return [round(min * m, 5), round(max * m, 5)];
}

function usedNames(state: GameState): Set<string> {
  return new Set([...state.sponsors, ...state.sponsorOffers, ...state.prospects].map((s) => s.name));
}

/** Een bedrijf dat nog niet bij je club zit. Naam en sector horen altijd bij elkaar. */
function unusedCompany(state: GameState, rng: Rng, kind?: Kind): { name: string; sector: string } {
  const used = usedNames(state);
  const fits = (c: { sector: string }) => !kind || kind === 'stadion' || sectorKind(c.sector) === kind;
  const free = SPONSOR_COMPANIES.filter((c) => !used.has(c.name) && fits(c));
  if (free.length) return rng.pick(free);
  const any = SPONSOR_COMPANIES.filter((c) => !used.has(c.name));
  if (any.length) return rng.pick(any);
  const c = rng.pick(SPONSOR_COMPANIES);
  return { name: `${c.name} ${rng.int(2, 9)}`, sector: c.sector };
}

export function makeDeal(state: GameState, rng: Rng, kind: Kind, weekly?: number, name?: string, sector?: string): SponsorDeal {
  const [min, max] = kindRange(state, kind);
  const company = name ? { name, sector: sector ?? companySector(name) } : unusedCompany(state, rng, kind);
  return {
    id: nextId(state, 'sp'),
    name: company.name,
    sector: company.sector,
    kind,
    weekly: weekly ?? round(rng.range(min, max), 5),
    weeksLeft: rng.int(52, 156),
    satisfaction: rng.int(55, 75),
    extraAskedSeason: 0,
  };
}

export function companySector(name: string): string {
  const base = name.replace(/\s\d+$/, ''); // "Elektro Baert 3" hoort bij "Elektro Baert"
  return SPONSOR_COMPANIES.find((c) => c.name === base)?.sector ?? 'Lokale handel';
}

export function makeProspect(state: GameState, rng: Rng, bigger = false): SponsorProspect {
  const wanted = bigger ? rng.pick(SECTORS.filter(([, k]) => k !== 'bord'))[0] : undefined;
  const company = unusedCompany(state, rng, wanted ? sectorKind(wanted) : undefined);
  const maxKind = sectorKind(company.sector);
  const base = 15 + state.community.reputation * 0.4;
  return {
    id: nextId(state, 'pr'),
    name: company.name,
    sector: company.sector,
    maxKind,
    interest: Math.round(clamp(rng.normal(base + (bigger ? 20 : 0), 10), 5, 90)),
    cooldown: 0,
    approached: false,
  };
}

/** Bestaande sponsors bij de start, zodat het totaal ongeveer overeenkomt met de club. */
export function startingSponsors(state: GameState, rng: Rng, totalWeekly: number): void {
  state.sponsors.push(makeDeal(state, rng, 'hoofdsponsor', round(totalWeekly * 0.4, 5)));
  state.sponsors.push(makeDeal(state, rng, 'shirt', round(totalWeekly * 0.2, 5)));
  let rest = totalWeekly * 0.4;
  while (rest > 40) {
    const amount = round(Math.min(rest, rng.range(50, 90)), 5);
    const deal = makeDeal(state, rng, 'bord', amount);
    deal.weeksLeft = rng.int(10, 100);
    state.sponsors.push(deal);
    rest -= amount;
  }
  for (let i = 0; i < 8; i++) state.prospects.push(makeProspect(state, rng));
}

export function mainSponsor(state: GameState): SponsorDeal | undefined {
  return state.sponsors.find((s) => s.kind === 'hoofdsponsor');
}

function freeKind(state: GameState, max: Kind): Kind | null {
  const top = KIND_ORDER.indexOf(max);
  for (let i = top; i >= 0; i--) {
    const k = KIND_ORDER[i];
    if (kindLock(state, k)) continue;
    if (state.sponsors.filter((s) => s.kind === k).length + state.sponsorOffers.filter((o) => o.kind === k && !o.renewalOf).length < KIND_MAX[k]) return k;
  }
  return null;
}

function satisfactionTarget(state: GameState): number {
  const c = state.community;
  const played = state.league.table.find((r) => r.teamId === 'club')?.played ?? 0;
  const pos = played > 2 ? ownPosition(state.league) : 8;
  const results = pos <= 3 ? 10 : pos >= 14 ? -10 : 0;
  return clamp(35 + c.fanMood * 0.25 + c.reputation * 0.25 + results, 0, 100);
}

// ---------- Wekelijkse verwerking ----------

export function weeklySponsors(state: GameState, rng: Rng): void {
  // 1. antwoorden op gesprekken van vorige week
  for (const p of state.prospects.filter((x) => x.approached)) {
    p.approached = false;
    const chance = (p.interest / 100) * (0.55 + staffSkill(state, 'commercieel') / 300 + (state.avatar.background === 'ondernemer' ? 0.1 : 0));
    const kind = freeKind(state, p.maxKind);
    if (kind && rng.chance(chance)) {
      const deal = makeDeal(state, rng, kind, undefined, p.name, p.sector);
      state.sponsorOffers.push({ ...deal, expiresInWeeks: 3 });
      state.prospects = state.prospects.filter((x) => x.id !== p.id);
      addNews(state, 'goed', `${p.name} (${p.sector.toLowerCase()}) doet een voorstel: ${KIND_LABEL[kind].toLowerCase()}, €${deal.weekly}/week. Zie Sponsors.`);
    } else {
      p.interest = Math.max(5, p.interest - 15);
      p.cooldown = 8;
      addNews(state, 'neutraal', `${p.name} past${kind ? '' : ' (je hebt geen vrije plaats in hun budgetklasse)'}. Probeer het later opnieuw.`);
    }
  }

  // 2. tevredenheid en lopende contracten
  const target = satisfactionTarget(state);
  for (const deal of state.sponsors) {
    deal.satisfaction = clamp(deal.satisfaction + (target - deal.satisfaction) * 0.05, 0, 100);
    if (deal.kind === 'stadion') continue;
    deal.weeksLeft--;
    if (deal.weeksLeft === 8 && deal.satisfaction >= 55 && !state.sponsorOffers.some((o) => o.renewalOf === deal.id)) {
      const weekly = round(deal.weekly * (0.9 + deal.satisfaction / 400) * rng.range(0.95, 1.1), 5);
      state.sponsorOffers.push({ ...makeDeal(state, rng, deal.kind, weekly, deal.name), expiresInWeeks: 8, renewalOf: deal.id });
      addNews(state, 'goed', `${deal.name} wil verlengen aan €${weekly}/week. Zie Sponsors.`);
    }
    if (deal.weeksLeft <= 0) addNews(state, 'neutraal', `Het contract met ${deal.name} (${KIND_LABEL[deal.kind].toLowerCase()}) is afgelopen.`);
  }
  const ended = state.sponsors.filter((d) => d.kind !== 'stadion' && d.weeksLeft <= 0);
  state.sponsors = state.sponsors.filter((d) => d.kind === 'stadion' || d.weeksLeft > 0);
  // wie niet verlengd werd, komt terug op de lijst van mogelijke sponsors
  for (const d of ended) {
    state.prospects.push({ id: nextId(state, 'pr'), name: d.name, sector: d.sector, maxKind: d.kind === 'stadion' ? 'hoofdsponsor' : d.kind, interest: Math.round(d.satisfaction * 0.6), cooldown: 4, approached: false });
  }

  // 3. openstaande aanbiedingen verlopen
  for (const o of state.sponsorOffers) o.expiresInWeeks--;
  state.sponsorOffers = state.sponsorOffers.filter((o) => o.expiresInWeeks > 0 && (!o.renewalOf || state.sponsors.some((s) => s.id === o.renewalOf)));

  // 4. af en toe een spontaan aanbod
  const chance = 0.06 + staffSkill(state, 'commercieel') / 600 + state.community.reputation / 1000;
  if (state.sponsorOffers.length < 4 && rng.chance(chance)) {
    const kind = freeKind(state, rng.chance(0.8) ? 'bord' : 'shirt');
    if (kind) {
      const deal = makeDeal(state, rng, kind);
      state.sponsorOffers.push({ ...deal, expiresInWeeks: 3 });
      addNews(state, 'goed', `${deal.name} meldt zich spontaan (${KIND_LABEL[kind].toLowerCase()}). Zie Sponsors.`);
    }
  }

  // 5. zoekcampagne van een bureau
  if (state.sponsorCampaignWeeks > 0) {
    state.sponsorCampaignWeeks--;
    if (state.sponsorCampaignWeeks === 0) {
      const found = [makeProspect(state, rng, true), makeProspect(state, rng, true), makeProspect(state, rng, rng.chance(0.5))];
      state.prospects.push(...found);
      addNews(state, 'goed', `Het bureau vond ${found.length} geïnteresseerde bedrijven: ${found.map((p) => p.name).join(', ')}.`);
    }
  }

  // 6. interesse schuift mee met reputatie en sfeer
  const base = 15 + state.community.reputation * 0.4 + (state.community.fanMood - 50) * 0.2;
  for (const p of state.prospects) {
    if (p.cooldown > 0) p.cooldown--;
    p.interest = Math.round(clamp(p.interest + (base - p.interest) * 0.03 + rng.normal(0, 1), 5, 95));
  }
  if (state.week === 1) for (let i = 0; i < 3; i++) state.prospects.push(makeProspect(state, rng));
  if (state.prospects.length > 16) state.prospects = [...state.prospects].sort((a, b) => b.interest - a.interest).slice(0, 16);
}

// ---------- Acties van de eigenaar ----------

const fail = (message: string): ActionResult => ({ ok: false, message });
const ok = (message: string): ActionResult => ({ ok: true, message });

export function approachProspect(state: GameState, prospectId: string): ActionResult {
  const p = state.prospects.find((x) => x.id === prospectId);
  if (!p) return fail('Bedrijf niet gevonden.');
  if (p.approached) return fail('Het gesprek loopt al. Antwoord volgende week.');
  if (p.cooldown > 0) return fail(`${p.name} wil nog ${p.cooldown} weken niet gestoord worden.`);
  p.approached = true;
  return ok(`Afspraak met ${p.name}. Je krijgt volgende week antwoord.`);
}

export function networkEvening(state: GameState): ActionResult {
  if ((state.eventCooldowns['netwerk'] ?? 0) > 0) return fail(`Nog ${state.eventCooldowns['netwerk']} weken wachten.`);
  if (state.cash < NETWORK_EVENING.cost) return fail('Niet genoeg geld.');
  const rng = createRng(state);
  book(state, 'sponsors', -NETWORK_EVENING.cost, 'Netwerkavond voor lokale ondernemers');
  for (const p of state.prospects) p.interest = Math.round(clamp(p.interest + rng.range(8, 20), 5, 95));
  state.prospects.push(makeProspect(state, rng));
  state.eventCooldowns['netwerk'] = NETWORK_EVENING.cooldown;
  return ok('Netwerkavond gehouden: alle bedrijven zijn meer geïnteresseerd en er is een nieuw contact bij.');
}

export function startCampaign(state: GameState): ActionResult {
  if (state.sponsorCampaignWeeks > 0) return fail('Er loopt al een campagne.');
  if (state.cash < CAMPAIGN.cost) return fail('Niet genoeg geld.');
  book(state, 'sponsors', -CAMPAIGN.cost, 'Zoekcampagne sponsorbureau');
  state.sponsorCampaignWeeks = CAMPAIGN.weeks;
  return ok(`Het bureau gaat ${CAMPAIGN.weeks} weken op zoek naar grotere sponsors.`);
}

export function cancelSponsor(state: GameState, dealId: string): ActionResult {
  const d = state.sponsors.find((x) => x.id === dealId);
  if (!d) return fail('Sponsor niet gevonden.');
  if (d.kind === 'stadion') return fail('De stadionnaam hoort bij de afspraak met je investeerder.');
  state.sponsors = state.sponsors.filter((x) => x.id !== dealId);
  state.community.reputation = clamp(state.community.reputation - 1, 0, 100);
  for (const other of state.sponsors) other.satisfaction = clamp(other.satisfaction - 2, 0, 100);
  addNews(state, 'neutraal', `Je zette het contract met ${d.name} stop. Andere sponsors kijken even op.`);
  return ok(`Contract met ${d.name} stopgezet. Die plaats is weer vrij.`);
}

/**
 * Een extra bijdrage vragen. De sponsor denkt erover na: je hoort het volgende week,
 * in het weekrapport en in het logboek.
 */
export function askExtra(state: GameState, dealId: string): ActionResult {
  const d = state.sponsors.find((x) => x.id === dealId);
  if (!d) return fail('Sponsor niet gevonden.');
  if (d.extraAskedSeason === state.season) return fail('Je vroeg dit seizoen al een extra bijdrage aan deze sponsor.');
  if (state.requests.some((r) => r.kind === 'sponsor-extra' && r.targetId === dealId)) return fail('Je wacht nog op zijn antwoord.');
  d.extraAskedSeason = state.season;
  state.requests.push({ id: nextId(state, 'rq'), kind: 'sponsor-extra', targetId: dealId, label: `Extra bijdrage gevraagd aan ${d.name}`, weeksLeft: 1 });
  addLog(state, 'beslissing', `Extra bijdrage gevraagd aan ${d.name} (tevredenheid ${Math.round(d.satisfaction)}).`);
  return ok(`${d.name} bekijkt je vraag. Je hoort het volgende week.`);
}

/** Antwoorden op vragen die vorige week vertrokken. */
export function resolveRequests(state: GameState, rng: Rng): void {
  for (const r of state.requests) r.weeksLeft--;
  const due = state.requests.filter((r) => r.weeksLeft <= 0);
  state.requests = state.requests.filter((r) => r.weeksLeft > 0);
  for (const r of due) {
    if (r.kind === 'lening' && r.payload) {
      // de bank kijkt naar je schuldgraad, je kaspositie en je reputatie
      const room = creditLimit(state);
      const chance = clamp(0.35 + room / Math.max(1, r.payload.principal) / 6 + state.community.reputation / 300 - (state.cash < 0 ? 0.25 : 0), 0.05, 0.95);
      if (r.payload.principal <= room && rng.chance(chance)) {
        grantLoan(state, { ...r.payload, label: r.label.replace(/^Kredietaanvraag /, '').replace(/ \(.*\)$/, '') });
        addNews(state, 'goed', `De bank keurt je kredietaanvraag goed: €${r.payload.principal.toLocaleString('nl-BE')} staat op de rekening.`);
        addLog(state, 'antwoord', `Krediet goedgekeurd: €${r.payload.principal.toLocaleString('nl-BE')}.`);
      } else {
        addNews(state, 'slecht', 'De bank wijst je kredietaanvraag af. Probeer het later opnieuw, met een beter dossier.');
        addLog(state, 'antwoord', 'Krediet geweigerd door de bank.');
      }
      continue;
    }
    if (r.kind !== 'sponsor-extra') continue;
    const d = state.sponsors.find((x) => x.id === r.targetId);
    if (!d) continue;
    if (rng.chance((d.satisfaction / 100) * 0.8)) {
      const amount = round(d.weekly * rng.range(4, 10), 50);
      book(state, 'sponsors', amount, `Extra bijdrage ${d.name}`);
      d.satisfaction = clamp(d.satisfaction - 10, 0, 100);
      addNews(state, 'goed', `${d.name} stort een extra bijdrage van €${amount.toLocaleString('nl-BE')}.`);
      addLog(state, 'antwoord', `${d.name} gaat akkoord: €${amount.toLocaleString('nl-BE')} extra.`);
    } else {
      d.satisfaction = clamp(d.satisfaction - 20, 0, 100);
      addNews(state, 'slecht', `${d.name} gaat niet in op je vraag om een extra bijdrage.`);
      addLog(state, 'antwoord', `${d.name} weigert de extra bijdrage (tevredenheid ${Math.round(d.satisfaction)}).`);
    }
  }
}

/** Waarom een sponsor tevreden of ontevreden is. Ook voor de tooltip bij Sponsors. */
export function satisfactionParts(state: GameState): { label: string; value: number; detail: string }[] {
  const c = state.community;
  const played = state.league.table.find((r) => r.teamId === 'club')?.played ?? 0;
  const pos = played > 2 ? ownPosition(state.league) : 8;
  return [
    { label: 'Basis', value: 35, detail: 'elke sponsor start rond dit niveau' },
    { label: 'Sfeer rond de club', value: Math.round(c.fanMood * 0.25), detail: `sfeer ${Math.round(c.fanMood)}/100` },
    { label: 'Reputatie', value: Math.round(c.reputation * 0.25), detail: `reputatie ${Math.round(c.reputation)}/100` },
    { label: 'Resultaten', value: pos <= 3 ? 10 : pos >= 14 ? -10 : 0, detail: played > 2 ? `${pos}e plaats` : 'competitie nog niet begonnen' },
  ];
}

export function renewSponsor(state: GameState, dealId: string): ActionResult {
  const d = state.sponsors.find((x) => x.id === dealId);
  if (!d) return fail('Sponsor niet gevonden.');
  if (d.kind === 'stadion') return fail('Dit contract loopt zolang de investeerder blijft.');
  if (d.weeksLeft > 26) return fail('Verlengen kan pas in het laatste half jaar van het contract.');
  if (d.satisfaction < 40) {
    d.satisfaction = clamp(d.satisfaction - 5, 0, 100);
    return fail(`${d.name} is niet tevreden genoeg om te verlengen.`);
  }
  const rng = createRng(state);
  const [, max] = kindRange(state, d.kind);
  d.weekly = round(Math.min(max * 1.1, d.weekly * (0.85 + d.satisfaction / 250)), 5);
  d.weeksLeft += rng.int(52, 104);
  state.sponsorOffers = state.sponsorOffers.filter((o) => o.renewalOf !== d.id);
  return ok(`${d.name} verlengt: €${d.weekly}/week, nog ${d.weeksLeft} weken.`);
}

export function acceptSponsorOffer(state: GameState, offerId: string): ActionResult {
  const o = state.sponsorOffers.find((x) => x.id === offerId);
  if (!o) return fail('Aanbod verlopen.');
  if (o.renewalOf) {
    const old = state.sponsors.find((s) => s.id === o.renewalOf);
    if (old) {
      old.weekly = o.weekly;
      old.weeksLeft += o.weeksLeft;
    }
    state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== offerId);
    return ok(`Contract met ${o.name} verlengd.`);
  }
  const count = state.sponsors.filter((s) => s.kind === o.kind).length;
  if (count >= KIND_MAX[o.kind]) return fail(`Geen plaats meer voor een extra ${KIND_LABEL[o.kind].toLowerCase()}. Zet eerst een contract stop.`);
  state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== offerId);
  const { expiresInWeeks: _e, renewalOf: _r, ...deal } = o;
  state.sponsors.push(deal);
  addNews(state, 'goed', `${o.name} is nieuwe sponsor: €${o.weekly}/week gedurende ${o.weeksLeft} weken.`);
  return ok('Sponsorcontract getekend.');
}

/**
 * Na promotie of degradatie herbekijken sponsors hun bijdrage. Bij promotie zijn ze blij
 * en bieden de besten spontaan een opwaardering aan; bij degradatie zakt hun tevredenheid.
 */
export function sponsorsAfterSeason(state: GameState, rng: Rng, result: 'kampioen' | 'promotie' | 'degradatie' | 'behoud', newLevel: number): void {
  const deals = state.sponsors.filter((d) => d.kind !== 'stadion');
  if (result === 'degradatie') {
    for (const d of deals) d.satisfaction = clamp(d.satisfaction - 12, 0, 100);
    addNews(state, 'slecht', 'Je sponsors zijn ontgoocheld door de degradatie. Reken op lastige gesprekken bij de verlenging.');
    return;
  }
  if (result === 'behoud') return;

  // het aanbod van de nieuwe reeks: zelfde club, hoger niveau
  const previous = state.league.divisionLevel;
  state.league.divisionLevel = newLevel;
  const upgrades: string[] = [];
  for (const d of deals) {
    d.satisfaction = clamp(d.satisfaction + (result === 'kampioen' ? 14 : 10), 0, 100);
    if (state.sponsorOffers.some((o) => o.renewalOf === d.id)) continue; // er ligt al een voorstel
    const [min, max] = kindRange(state, d.kind);
    const offerValue = round(Math.max(d.weekly * 1.15, rng.range(min, max) * 0.9), 5);
    if (offerValue <= d.weekly) continue;
    // hoe tevredener, hoe groter de kans dat hij zelf met een beter voorstel komt
    if (!rng.chance(0.35 + d.satisfaction / 200)) continue;
    state.sponsorOffers.push({ ...makeDeal(state, rng, d.kind, offerValue, d.name, d.sector), expiresInWeeks: 6, renewalOf: d.id });
    upgrades.push(`${d.name} (${euroText(d.weekly)} → ${euroText(offerValue)})`);
  }
  state.league.divisionLevel = previous;
  if (upgrades.length) {
    addNews(state, 'goed', `Door de promotie willen sponsors hun bijdrage opdrijven: ${upgrades.join(', ')}. Zie Sponsors.`);
  } else {
    addNews(state, 'neutraal', 'Je sponsors feliciteren je met de promotie. Vraag gerust een nieuw contract: ze staan er nu open voor.');
  }
}

function euroText(n: number): string {
  return `€${Math.round(n).toLocaleString('nl-BE')}`;
}
