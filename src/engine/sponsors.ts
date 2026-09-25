import type { ActionResult, GameState, PendingRequest, SponsorDeal, SponsorProspect } from './types';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { SECTORS, SPONSOR_COMPANIES, sectorKind } from './data/names';
import { staffSkill } from './staff';
import { wageDemand } from './players';
import { transferWillingness } from './appeal';
import { subsidieBedrag, subsidieKans } from './finance';
import { product, sponsorFactors } from './factors';
import { ownPosition } from './league';
import { popularity } from './popularity';
import { addLog, addNews, book, nextId } from './util';
import { remember } from './content';
import { creditLimit } from './loans';
import { completeLoanIn, completeSigning, grantLoan, loanRequestChance, loanStanding, tooExpensive } from './actions';
import { sponsorBonus } from './career';

type Kind = SponsorDeal['kind'];

// Wat een plaats per week opbrengt, op het niveau van een club in 1ste provinciale.
//
// Deze bedragen lagen te laag ten opzichte van de rest. Sponsoring was 38% van je
// inkomsten, terwijl dat bij een echte club in deze reeksen de grootste post is — groter
// dan de kassa en de kantine samen. Een bestuur van een dorpsclub brengt zijn geld binnen
// bij de handelaars van het dorp, niet aan het loket.
const KIND_RANGE: Record<Kind, [number, number]> = {
  bord: [40, 90],
  bal: [60, 120],
  jeugd: [110, 240],
  scherm: [120, 250],
  evenement: [150, 310],
  bus: [180, 370],
  mouw: [230, 480],
  shirt: [320, 700],
  hoofdsponsor: [900, 1700],
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

/**
 * Korte naam voor op een tegel.
 *
 * "Evenementensponsor" is achttien tekens zonder één plaats om af te breken: in een tegel van
 * honderdtachtig pixels brak de browser er middenin een lettergreep doorheen. De volle naam
 * staat in de tooltip, dus je verliest niets.
 */
export const KIND_SHORT: Record<Kind, string> = {
  bord: 'Reclamebord',
  bal: 'Wedstrijdbal',
  jeugd: 'Jeugd',
  scherm: 'Schermen',
  evenement: 'Evenementen',
  bus: 'Ploegbus',
  mouw: 'Mouw',
  shirt: 'Shirt rug',
  hoofdsponsor: 'Hoofdsponsor',
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
 *  Hoe meer borden er al hangen, hoe minder een extra bord waard is (de lokale markt is beperkt).
 *  De bedragen volgen ook het prijspeil: de doorlichting van september 2026 vond dat de
 *  grootste inkomstenpost van het spel als enige buiten de inflatie stond. */
export function kindRange(state: GameState, kind: Kind): [number, number] {
  const [min, max] = KIND_RANGE[kind];
  const saturation = kind === 'bord' ? boardSaturation(state) : 1;
  const events = kind === 'evenement' ? clamp(0.7 + state.eventLog.filter((e) => e.season === state.season).length * 0.15, 0.7, 1.6) : 1;
  const m = sponsorMultiplier(state) * saturation * events * state.inflation;
  return [round(min * m, 5), round(max * m, 5)];
}

/**
 * De prijs die de markt op dit moment normaal vindt voor zo'n plaats bij jouw club.
 *
 * Dit is het midden van de bandbreedte: sommige bedrijven hebben er meer voor over, andere
 * minder. Het is de lat waar jouw vraagprijs tegen wordt afgemeten.
 */
export function fairPrice(state: GameState, kind: Kind): number {
  const [min, max] = kindRange(state, kind);
  return round((min + max) / 2, 5);
}

/** Wat jij vraagt voor zo'n plaats. Niets ingevuld = de gangbare prijs. */
export function askPrice(state: GameState, kind: Kind): number {
  const eigen = state.sponsorAsk?.[kind];
  return eigen !== undefined && eigen > 0 ? Math.round(eigen) : fairPrice(state, kind);
}

const ASK_DECAY = 0.9;
const ASK_CHEAP_GAIN = 0.6;

/**
 * Hoe graag bedrijven bij jóuw club willen hangen.
 *
 * Dit is voor sponsors wat `youthPull` voor de jeugd is: niet hoeveel ze normaal betalen —
 * dat zit al in de gangbare prijs — maar hoe hard ze je een prijsverhoging kwalijk nemen.
 * Bij een club waar niemand over praat is een bord een bord, en dan telt alleen het bedrag.
 * Bij een club met een naam, een volle tribune en een ploeg die bovenaan staat, willen
 * bedrijven erbij horen en slikken ze een hogere prijs.
 */
export function sponsorPull(state: GameState): number {
  const c = state.community;
  const sales = staffSkill(state, 'commercieel');
  const score =
    (c.reputation - 50) / 200 +
    (c.fanMood - 50) / 330 +
    (popularity(state).factor - 1) * 0.6 +
    state.league.divisionLevel * 0.045 +
    (sales ? (sales - 40) / 300 : 0) +
    (state.avatar.background === 'ondernemer' ? 0.06 : 0);
  return clamp(1 + score, 0.7, 1.6);
}

/**
 * Hoeveel je vraagprijs je kansen helpt of schaadt.
 *
 * Vroeger noemde het bedrijf zelf een bedrag en zei jij ja of nee. Nu hangt jouw prijskaart
 * aan de muur en beslissen zij. Vraag je wat gangbaar is, dan verandert er niets aan je
 * kansen: één. Vraag je minder, dan hebben meer bedrijven er oren naar. Vraag je meer, dan
 * haken er af — en hoe verder je gaat, hoe sneller dat gaat.
 *
 * De eerste versie was een rechte lijn: elke procent erbij kostte een procent kans. Gemeten
 * bleek dat de keuze zinloos te maken. De opbrengst van een plaats is kans maal prijs, en bij
 * een rechte lijn is dat product precies op de gangbare prijs het hoogst, voor élke club. Je
 * kon dus aan de knoppen draaien wat je wilde: over een heel seizoen scheelde het minder dan
 * een procent. Nu buigt de curve, en waar ze haar top heeft, hangt af van je trekkracht:
 * een dorpsclub kan niets extra vragen, een club met een naam ongeveer de helft meer.
 */
export function askFactor(state: GameState, kind: Kind): number {
  const fair = fairPrice(state, kind);
  if (fair <= 0) return 1;
  const ratio = Math.max(0, askPrice(state, kind) / fair);
  if (ratio <= 1) return clamp(1 + (1 - ratio) * ASK_CHEAP_GAIN, 1, 1.6);
  return clamp(Math.exp(-(ratio - 1) * (ASK_DECAY / sponsorPull(state))), 0.02, 1);
}

/**
 * Hoeveel keer het gangbare bedrag jouw club op termijn het meest opbrengt.
 *
 * Kans maal prijs is het hoogst bij trekkracht gedeeld door de helling. Bij een club zonder
 * naam komt daar minder dan één uit, en dan is het gangbare bedrag gewoon het beste: onder de
 * markt gaan zitten levert wel meer contracten op, maar samen minder geld.
 */
export function bestAskRatio(state: GameState): number {
  return Math.max(1, sponsorPull(state) / ASK_DECAY);
}

/**
 * In woorden: hoe goed zit je vraagprijs?
 *
 * Gemeten tegen wat jóuw club aankan, niet tegen een vaste lat. Dezelfde €90 voor een bord is
 * bij een topclub scherp geprijsd en bij een dorpsclub onbetaalbaar, en precies dát verschil
 * moet je kunnen zien.
 */
export function askVerdict(state: GameState, kind: Kind): { woord: string; toon: 'good' | 'neutral' | 'bad' } {
  const fair = fairPrice(state, kind);
  if (fair <= 0) return { woord: 'gangbaar', toon: 'neutral' };
  const q = askPrice(state, kind) / fair / bestAskRatio(state);
  if (q <= 0.55) return { woord: 'te goedkoop', toon: 'neutral' };
  if (q <= 0.9) return { woord: 'scherp', toon: 'good' };
  if (q <= 1.15) return { woord: 'goed gemikt', toon: 'good' };
  if (q <= 1.5) return { woord: 'stevig', toon: 'neutral' };
  if (q <= 2.2) return { woord: 'duur', toon: 'bad' };
  return { woord: 'onbetaalbaar', toon: 'bad' };
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

  // De rest verdelen over de kleinere plaatsen, van groot naar klein.
  //
  // Dit stopte vroeger alles in borden, en toen het startbedrag omhoog ging leverde dat
  // negentien borden op terwijl er zestien plaatsen zijn. Je begon dus met een overvolle
  // bordenrij en geen enkele vrije plaats voor een handelaar die zich aanbood.
  let rest = totalWeekly * 0.4;

  // eerst de bordenrij, want dát is wat een dorpsclub heeft: de bakker, de garage en de
  // frituur langs de lijn. Niet alle zestien plaatsen, zodat er nog iets te verkopen valt.
  const [bordMin, bordMax] = kindRange(state, 'bord');
  let bordBudget = rest * 0.55;
  while (bordBudget > bordMin && state.sponsors.filter((d) => d.kind === 'bord').length < KIND_MAX.bord - 5) {
    const amount = round(Math.min(bordBudget, rng.range(bordMin, bordMax)), 5);
    const deal = makeDeal(state, rng, 'bord', amount);
    deal.weeksLeft = rng.int(10, 100);
    state.sponsors.push(deal);
    bordBudget -= amount;
    rest -= amount;
  }

  // daarna de middelgrote plaatsen, voor zover ze bij deze club al bestaan
  for (const kind of ['mouw', 'bus', 'jeugd', 'evenement', 'scherm', 'bal'] as Kind[]) {
    if (rest <= 60) break;
    if (kindLock(state, kind)) continue; // die plaats bestaat bij deze club nog niet
    const [min, max] = kindRange(state, kind);
    const bedrag = round(Math.min(rest * 0.6, rng.range(min, max)), 5);
    if (bedrag < min * 0.8) continue;
    const deal = makeDeal(state, rng, kind, bedrag);
    deal.weeksLeft = rng.int(20, 120);
    state.sponsors.push(deal);
    rest -= bedrag;
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
  // een bord langs een verwaarloosd veld is een slecht uithangbord; premium onderhoud
  // is net het visitekaartje waar een sponsor graag naast hangt. Zo raakt de
  // onderhoudsknop iets wat níet achter een volle tribune verstopt zit.
  const onderhoud = state.infrastructure.maintenance === 'basis' ? -6 : state.infrastructure.maintenance === 'premium' ? 4 : 0;
  return clamp(35 + c.fanMood * 0.25 + c.reputation * 0.25 + results + onderhoud, 0, 100);
}

// ---------- Wekelijkse verwerking ----------

export function weeklySponsors(state: GameState, rng: Rng): void {
  // 1. antwoorden op gesprekken van vorige week
  for (const p of state.prospects.filter((x) => x.approached)) {
    p.approached = false;
    const basis = (p.interest / 100) * (0.55 + staffSkill(state, 'commercieel') / 300 + (state.avatar.background === 'ondernemer' ? 0.1 : 0));
    const kind = freeKind(state, p.maxKind);
    // jouw vraagprijs beslist mee: het bedrijf krijgt geen bedrag meer voorgesteld, het
    // ziet wat jij vraagt en zegt daar ja of nee op
    const prijs = kind ? askPrice(state, kind) : 0;
    const chance = kind ? basis * askFactor(state, kind) : 0;
    if (kind && rng.chance(chance)) {
      const deal = makeDeal(state, rng, kind, prijs, p.name, p.sector);
      state.sponsorOffers.push({ ...deal, expiresInWeeks: 3 });
      state.prospects = state.prospects.filter((x) => x.id !== p.id);
      addNews(state, 'goed', `${p.name} (${p.sector.toLowerCase()}) gaat akkoord met je prijs: ${KIND_LABEL[kind].toLowerCase()} voor €${deal.weekly} per week. Zie Sponsors.`, 'viering');
    } else {
      p.interest = Math.max(5, p.interest - 15);
      p.cooldown = 8;
      const teDuur = kind && askFactor(state, kind) < 0.75;
      addNews(
        state,
        'neutraal',
        !kind
          ? `${p.name} past: je hebt geen vrije plaats in hun budgetklasse.`
          : teDuur
            ? `${p.name} vindt €${prijs} per week te veel voor ${KIND_LABEL[kind].toLowerCase()}. Zakken met je prijs helpt.`
            : `${p.name} past voorlopig. Probeer het later opnieuw.`,
      );
    }
  }

  // 2. tevredenheid en lopende contracten
  const target = satisfactionTarget(state);
  for (const deal of state.sponsors) {
    deal.satisfaction = clamp(deal.satisfaction + (target - deal.satisfaction) * 0.05, 0, 100);
    if (deal.kind === 'stadion') continue;
    deal.weeksLeft--;
    if (deal.weeksLeft === 8 && deal.satisfaction >= 55 && !state.sponsorOffers.some((o) => o.renewalOf === deal.id)) {
      // Een verlenging gaat tegen je huidige prijskaart. Wie tevreden is neemt een verhoging
      // er nog bij; wie je prijs intussen fors optrok, haakt af en komt terug op je lijst.
      const weekly = askPrice(state, deal.kind);
      const rek = 1.15 + deal.satisfaction / 250; // hoeveel meer dan nu hij wil betalen
      if (weekly <= deal.weekly * rek || rng.chance(askFactor(state, deal.kind) * 0.5)) {
        state.sponsorOffers.push({ ...makeDeal(state, rng, deal.kind, weekly, deal.name), expiresInWeeks: 8, renewalOf: deal.id });
        addNews(
          state,
          'goed',
          weekly > deal.weekly
            ? `${deal.name} wil verlengen, en gaat mee met je nieuwe prijs van €${weekly} per week. Zie Sponsors.`
            : `${deal.name} wil verlengen aan €${weekly} per week. Zie Sponsors.`,
        );
      } else {
        addNews(state, 'slecht', `${deal.name} verlengt niet: €${weekly} per week vindt hij te veel geworden voor ${KIND_LABEL[deal.kind].toLowerCase()}.`);
      }
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
  const spontaanKind = freeKind(state, rng.chance(0.8) ? 'bord' : 'shirt');
  if (state.sponsorOffers.length < 4 && spontaanKind && rng.chance(chance * askFactor(state, spontaanKind))) {
    const deal = makeDeal(state, rng, spontaanKind, askPrice(state, spontaanKind));
    state.sponsorOffers.push({ ...deal, expiresInWeeks: 3 });
    addNews(state, 'goed', `${deal.name} meldt zich spontaan voor ${KIND_LABEL[spontaanKind].toLowerCase()} aan €${deal.weekly} per week. Zie Sponsors.`);
  }

  // 5. zoekcampagne van een bureau
  if (state.sponsorCampaignWeeks > 0) {
    state.sponsorCampaignWeeks--;
    if (state.sponsorCampaignWeeks === 0) {
      const found = [makeProspect(state, rng, true), makeProspect(state, rng, true), makeProspect(state, rng, rng.chance(0.5))];
      // wie naam heeft gemaakt als eigenaar, krijgt er een prospect bij
      for (let i = 0; i < sponsorBonus(state); i++) found.push(makeProspect(state, rng, true));
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
  // Om de twee weken komen er nieuwe namen bij, en haken er een paar af.
  //
  // De lijst stond vroeger zo goed als stil: drie nieuwe contacten in week 1, en verder
  // alleen wat een sponsorbureau opleverde. Wie zijn lijst één keer had afgewerkt, keek de
  // rest van het seizoen naar dezelfde dertien namen. Nu draait ze: een handelaar die
  // maanden niets hoort verliest zijn interesse en verdwijnt, en er meldt zich nieuw volk.
  if (state.week % 2 === 0) {
    const nieuw: SponsorProspect[] = [];
    for (let i = 0; i < rng.int(2, 4); i++) nieuw.push(makeProspect(state, rng));
    state.prospects.push(...nieuw);
    addNews(state, 'neutraal', `Nieuwe namen op je contactenlijst: ${nieuw.map((p) => p.name).join(', ')}. Zie Sponsors.`);
  }

  // wie weinig interesse heeft en niet in gesprek is, haakt geleidelijk af
  state.prospects = state.prospects.filter((p) => p.approached || p.cooldown > 0 || p.interest > 20 || !rng.chance(0.3));
  if (state.prospects.length > 16) {
    // vol is vol: de minst geïnteresseerde namen vallen weg, behalve wie in gesprek is of
    // wie je net gesproken hebt — anders verdwijnt een bedrijf tussen je vraag en zijn antwoord
    const behouden = state.prospects.filter((p) => p.approached || p.cooldown > 0);
    const rest = state.prospects.filter((p) => !p.approached && p.cooldown === 0).sort((a, b) => b.interest - a.interest);
    state.prospects = [...behouden, ...rest].slice(0, 16);
  }
}

// ---------- Acties van de eigenaar ----------

const fail = (message: string): ActionResult => ({ ok: false, message });
const ok = (message: string): ActionResult => ({ ok: true, message });

/**
 * Hoe groot de kans is dat dit bedrijf ja zegt als je het deze week benadert.
 *
 * Exact dezelfde rekensom als in `weeklySponsors`, zodat het scherm niet iets anders kan
 * beweren dan er gebeurt. Verandert de formule, dan verandert het percentage mee.
 */
export function prospectChance(state: GameState, p: SponsorProspect): { kans: number; kind: Kind | null } {
  const kind = freeKind(state, p.maxKind);
  if (!kind) return { kans: 0, kind: null };
  const basis = (p.interest / 100) * (0.55 + staffSkill(state, 'commercieel') / 300 + (state.avatar.background === 'ondernemer' ? 0.1 : 0));
  return { kans: clamp(basis * askFactor(state, kind), 0, 1), kind };
}

export function approachProspect(state: GameState, prospectId: string): ActionResult {
  const p = state.prospects.find((x) => x.id === prospectId);
  if (!p) return fail('Bedrijf niet gevonden.');
  if (p.approached) return fail('Het gesprek loopt al. Antwoord volgende week.');
  if (p.cooldown > 0) return fail(`${p.name} wil nog ${p.cooldown} weken niet gestoord worden.`);
  p.approached = true;
  return ok(`Afspraak met ${p.name}. Je krijgt volgende week antwoord.`);
}

/**
 * Je vraagprijs voor een soort sponsorplaats zetten.
 *
 * Er is geen bovengrens die je tegenhoudt: je mag €5.000 vragen voor een reclamebord. Je
 * zult er alleen nooit één verkopen, en dat mag je zelf ontdekken — het scherm zegt bij
 * elk bedrag wat de bedrijven in de streek ervan zullen vinden.
 */
export function setSponsorAsk(state: GameState, kind: Kind, weekly: number): ActionResult {
  if (state.gameOver) return fail('Het spel is afgelopen.');
  if (kind === 'stadion') return fail('De stadionnaam hoort bij de afspraak met je investeerder; die prijs zet jij niet.');
  if (!Number.isFinite(weekly) || weekly < 0) return fail('Vul een bedrag per week in.');
  state.sponsorAsk = { ...state.sponsorAsk, [kind]: Math.round(weekly) };
  const oordeel = askVerdict(state, kind);
  return ok(
    `${KIND_LABEL[kind]}: je vraagt nu €${Math.round(weekly)} per week. Bedrijven in de streek vinden dat ${oordeel.woord} (gangbaar is €${fairPrice(state, kind)}).`,
  );
}

/** Terug naar wat de markt normaal vindt. */
export function resetSponsorAsk(state: GameState, kind: Kind): ActionResult {
  if (state.gameOver) return fail('Het spel is afgelopen.');
  const rest = { ...state.sponsorAsk };
  delete rest[kind];
  state.sponsorAsk = rest;
  return ok(`${KIND_LABEL[kind]}: je volgt weer de gangbare prijs van €${fairPrice(state, kind)} per week.`);
}

export function networkEvening(state: GameState): ActionResult {
  if ((state.eventCooldowns['netwerk'] ?? 0) > 0) return fail(`Nog ${state.eventCooldowns['netwerk']} weken wachten.`);
  if (state.cash < NETWORK_EVENING.cost) return fail(tooExpensive(state, NETWORK_EVENING.cost, 'Een netwerkavond'));
  const rng = createRng(state);
  book(state, 'sponsors', -NETWORK_EVENING.cost, 'Netwerkavond voor lokale ondernemers');
  for (const p of state.prospects) p.interest = Math.round(clamp(p.interest + rng.range(8, 20), 5, 95));
  state.prospects.push(makeProspect(state, rng));
  state.eventCooldowns['netwerk'] = NETWORK_EVENING.cooldown;
  return ok('Netwerkavond gehouden: alle bedrijven zijn meer geïnteresseerd en er is een nieuw contact bij.');
}

export function startCampaign(state: GameState): ActionResult {
  if (state.sponsorCampaignWeeks > 0) return fail('Er loopt al een campagne.');
  if (state.cash < CAMPAIGN.cost) return fail(tooExpensive(state, CAMPAIGN.cost, 'Een sponsorbureau inschakelen'));
  book(state, 'sponsors', -CAMPAIGN.cost, 'Zoekcampagne sponsorbureau');
  state.sponsorCampaignWeeks = CAMPAIGN.weeks;
  return ok(`Het bureau gaat ${CAMPAIGN.weeks} weken op zoek naar grotere sponsors.`);
}

export function cancelSponsor(state: GameState, dealId: string): ActionResult {
  const d = state.sponsors.find((x) => x.id === dealId);
  if (!d) return fail('Die sponsor staat niet meer in je lijst. Ververs de pagina.');
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
  if (!d) return fail('Die sponsor staat niet meer in je lijst. Ververs de pagina.');
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
    if (r.kind === 'subsidie') {
      const zaak = state.subsidieZaken.find((z) => z.id === r.id);
      const { kans, zwakstePlek } = subsidieKans(state);
      if (rng.chance(kans)) {
        const bedrag = subsidieBedrag(state);
        if (zaak) {
          zaak.status = 'toegekend';
          zaak.antwoord = { seizoen: state.season, week: state.week, bedrag };
        }
        book(state, 'subsidies', bedrag, 'Subsidie gemeente (jeugdwerking en sportieve uitstraling)');
        addNews(state, 'goed', `De gemeente kent je werkingssubsidie toe: €${bedrag.toLocaleString('nl-BE')}. Je jeugdwerking gaf de doorslag.`, 'viering');
        addLog(state, 'antwoord', `Subsidie toegekend: €${bedrag.toLocaleString('nl-BE')}.`);
      } else {
        if (zaak) {
          zaak.status = 'afgewezen';
          zaak.antwoord = { seizoen: state.season, week: state.week, bedrag: 0, dossierzwakte: zwakstePlek };
        }
        addNews(state, 'slecht', `De gemeente wijst je subsidieaanvraag af. In de brief staat vooral: ${zwakstePlek}. Volgend seizoen mag je opnieuw indienen.`);
        addLog(state, 'antwoord', `Subsidie geweigerd: ${zwakstePlek}.`);
      }
      if (zaak) state.news[0].subsidieZaakId = zaak.id;
      continue;
    }
    if (r.kind === 'transfer-koop' || r.kind === 'transfer-huur') {
      resolveTransferRequest(state, rng, r);
      continue;
    }
    if (r.kind === 'huur-verlengen' || r.kind === 'huur-kopen') {
      resolveLoanRequest(state, rng, r);
      continue;
    }
    if (r.kind !== 'sponsor-extra') continue;
    const d = state.sponsors.find((x) => x.id === r.targetId);
    if (!d) continue;
    if (rng.chance((d.satisfaction / 100) * 0.8)) {
      const amount = round(d.weekly * rng.range(4, 10), 50);
      book(state, 'sponsors', amount, `Extra bijdrage ${d.name}`);
      d.satisfaction = clamp(d.satisfaction - 10, 0, 100);
      addNews(state, 'goed', `${d.name} stort een extra bijdrage van €${amount.toLocaleString('nl-BE')}.`, 'viering');
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
  if (!d) return fail('Die sponsor staat niet meer in je lijst. Ververs de pagina.');
  if (d.kind === 'stadion') return fail('Dit contract loopt zolang de investeerder blijft.');
  if (d.weeksLeft > 26) return fail('Verlengen kan pas in het laatste half jaar van het contract.');
  if (d.satisfaction < 40) {
    d.satisfaction = clamp(d.satisfaction - 5, 0, 100);
    return fail(`${d.name} is niet tevreden genoeg om te verlengen.`);
  }
  // Verlengen gaat tegen je prijskaart, net als een nieuw contract. Wie tevreden is neemt een
  // verhoging erbij; wie je prijs intussen fors optrok, zegt nee en je houdt het oude contract.
  const weekly = askPrice(state, d.kind);
  const rek = 1.15 + d.satisfaction / 250;
  if (weekly > d.weekly * rek) {
    d.satisfaction = clamp(d.satisfaction - 3, 0, 100);
    return fail(`${d.name} wil niet verlengen aan €${weekly} per week. Dat is te veel meer dan de €${d.weekly} die hij nu betaalt.`);
  }
  const rng = createRng(state);
  d.weekly = weekly;
  d.weeksLeft += rng.int(52, 104);
  state.sponsorOffers = state.sponsorOffers.filter((o) => o.renewalOf !== d.id);
  return {
    ok: true,
    message: `${d.name} verlengt aan jouw prijs: €${d.weekly} per week, nog ${d.weeksLeft} weken.`,
    viering: { icon: '🤝', kop: `${d.name} verlengt`, sub: `€${d.weekly}/week` },
  };
}


/**
 * Hoelang je een sponsorcontract vastlegt. Langer tekenen levert meer per week op, maar je
 * zit eraan vast: promoveer je, dan schuift dit contract niet mee omhoog, en een sponsor
 * die ontevreden wordt, raak je niet zomaar kwijt.
 */
export interface SponsorTerm {
  seasons: 1 | 2 | 3;
  label: string;
  /** Vermenigvuldiger op het weekbedrag. */
  factor: number;
  detail: string;
}

export const SPONSOR_TERMS: SponsorTerm[] = [
  { seasons: 1, label: 'Eén seizoen', factor: 1, detail: 'Volgend jaar opnieuw onderhandelen. Promoveer je, dan kun je meteen meer vragen.' },
  { seasons: 2, label: 'Twee seizoenen', factor: 1.08, detail: '8% meer per week, maar twee jaar vast. Een promotie levert je hier niets extra op.' },
  { seasons: 3, label: 'Drie seizoenen', factor: 1.15, detail: '15% meer per week en drie jaar zekerheid — ook als het slechter gaat. Je zit er wel aan vast.' },
];

export function sponsorTerm(seasons: number): SponsorTerm {
  return SPONSOR_TERMS.find((t) => t.seasons === seasons) ?? SPONSOR_TERMS[0];
}

/** Wat een contract van deze looptijd in totaal opbrengt. */
export function termTotal(weekly: number, seasons: number): number {
  return Math.round(weekly * sponsorTerm(seasons).factor * 52 * seasons);
}

export function acceptSponsorOffer(state: GameState, offerId: string, seasons: 1 | 2 | 3 = 1): ActionResult {
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
  const term = sponsorTerm(seasons);
  const { expiresInWeeks: _e, renewalOf: _r, ...deal } = o;
  deal.weekly = round(deal.weekly * term.factor, 5);
  deal.weeksLeft = 52 * term.seasons;
  deal.lockedSeasons = term.seasons;
  state.sponsors.push(deal);
  addNews(
    state,
    'goed',
    term.seasons === 1
      ? `${o.name} is nieuwe sponsor: €${deal.weekly}/week voor één seizoen.`
      : `${o.name} tekent voor ${term.seasons} seizoenen: €${deal.weekly}/week, samen €${termTotal(o.weekly, term.seasons).toLocaleString('nl-BE')}.`,
  );
  if (term.seasons > 1) remember(state, `${o.name} tekende een contract van ${term.seasons} seizoenen.`);
  return {
    ok: true,
    message: term.seasons === 1 ? 'Sponsorcontract getekend voor één seizoen.' : `Sponsorcontract getekend voor ${term.seasons} seizoenen.`,
    viering: { icon: '🤝', kop: `${o.name} is sponsor`, sub: `${KIND_LABEL[o.kind]} · €${deal.weekly}/week` },
  };
}

/**
 * Na promotie of degradatie herbekijken sponsors hun bijdrage. Bij promotie zijn ze blij
 * en bieden de besten spontaan een opwaardering aan; bij degradatie zakt hun tevredenheid.
 */
export function sponsorsAfterSeason(state: GameState, rng: Rng, result: 'kampioen' | 'promotie' | 'degradatie' | 'behoud', newLevel: number): void {
  const deals = state.sponsors.filter((d) => d.kind !== 'stadion');
  if (result === 'degradatie') {
    // De klap moet twee kanten op werken. Bij promotie boden sponsors spontaan meer; bij
    // degradatie bleven hun bedragen gewoon staan, en de doorlichting van september 2026
    // mat dat een degradatieseizoen daardoor €981.000 winst kon draaien. Nu herzien ze hun
    // bijdrage naar het prijspeil van de nieuwe reeks — behalve wie voor meerdere seizoenen
    // tekende: die betaalt gewoon door. Dát is waar een lang contract voor dient.
    const previous = state.league.divisionLevel;
    state.league.divisionLevel = newLevel;
    const afgeprijsd: string[] = [];
    for (const d of deals) {
      d.satisfaction = clamp(d.satisfaction - 12, 0, 100);
      const passend = fairPrice(state, d.kind) * 1.1;
      if (d.weekly <= passend) continue;
      if ((d.lockedSeasons ?? 1) > 1 && d.weeksLeft > 52) continue; // vast contract: hij zit eraan vast
      afgeprijsd.push(`${d.name} (${euroText(d.weekly)} → ${euroText(passend)})`);
      d.weekly = round(passend, 5);
    }
    state.league.divisionLevel = previous;
    addNews(
      state,
      'slecht',
      afgeprijsd.length
        ? `Je sponsors herzien hun bijdrage na de degradatie: ${afgeprijsd.join(', ')}. Wie voor meerdere seizoenen tekende, betaalt gewoon door.`
        : 'Je sponsors zijn ontgoocheld door de degradatie. Reken op lastige gesprekken bij de verlenging.',
    );
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
    // wie voor meerdere seizoenen tekende, zit vast: geen beter voorstel bij een promotie
    if ((d.lockedSeasons ?? 1) > 1 && d.weeksLeft > 52) continue;
    // wat hij wil bijleggen, staat op jouw prijskaart: die is intussen meegegroeid met de
    // nieuwe reeks. Heb je zelf een lager bedrag gezet, dan betaalt hij dat lagere bedrag.
    const offerValue = askPrice(state, d.kind);
    if (offerValue <= d.weekly) continue;
    if (offerValue > d.weekly * (1.3 + d.satisfaction / 200)) continue; // te grote sprong ineens
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

/**
 * Het antwoord van de club die je huurspeler uitleent.
 *
 * Zij beslissen, niet jij: ze wegen hoeveel hij gespeeld heeft, of hij erop vooruitging en
 * wat je biedt. De kans die het scherm toonde toen je de vraag stelde, is exact deze.
 */
/**
 * Het antwoord op een transfer- of huurgesprek, een week na jouw interesse.
 *
 * De speler beslist met dezelfde wil-berekening als vroeger het directe kopen deed —
 * alleen hoor je het nu op de manier waarop een club het hoort: een week later, in je
 * nieuwsstroom en je weekverslag. Tekent hij, dan is dat een viering; weigert hij, dan
 * is hij van de markt (zijn makelaar praat niet twee keer over dezelfde vraag).
 */
function resolveTransferRequest(state: GameState, rng: Rng, r: PendingRequest): void {
  const p = r.speler;
  if (!p) return;
  const huur = r.kind === 'transfer-huur';
  if (state.players.length >= 30) {
    addNews(state, 'slecht', `Het gesprek met ${p.name} is stilgelegd: je kern zit vol (30 spelers).`);
    addLog(state, 'antwoord', `Gesprek met ${p.name} afgebroken: kern vol.`);
    return;
  }
  const wil = transferWillingness(state, p, huur);
  if (wil.kans < 1 && !rng.chance(wil.kans)) {
    addNews(
      state,
      'neutraal',
      huur
        ? `${p.name} wil niet op uitleenbasis naar ${state.clubName}: hij vindt je club een maat te klein.`
        : `${p.name} kiest voor een andere club: ${state.clubName} is nog geen ploeg van zijn niveau.`,
    );
    addLog(state, 'antwoord', `${p.name} zegt nee.`);
    return;
  }
  const prijs = p.purchasePrice ?? 0;
  if (prijs > state.cash) {
    addNews(state, 'slecht', `${p.name} wilde tekenen, maar je hebt €${prijs.toLocaleString('nl-BE')} niet meer op de rekening. De deal springt af.`);
    addLog(state, 'antwoord', `Deal met ${p.name} gesprongen: geld ontbreekt.`);
    return;
  }
  if (huur) completeLoanIn(state, p);
  else completeSigning(state, p, wil);
  addLog(state, 'antwoord', `${p.name} zegt ja.`);
}

function resolveLoanRequest(state: GameState, rng: Rng, r: PendingRequest): void {
  const p = state.players.find((x) => x.id === r.targetId);
  if (!p || p.loan?.type !== 'in') return;
  const club = p.loan.club;
  const verlengen = r.kind === 'huur-verlengen';
  const bod = r.amount ?? 0;
  const kans = loanRequestChance(state, p, verlengen ? 'verlengen' : 'kopen', bod);
  const stand = loanStanding(state, p);

  if (!rng.chance(kans)) {
    // vier weken niet meer over beginnen: ze hebben hun standpunt gegeven
    p.loanTalks = { season: state.season, weeksLeft: 4, bought: p.loanTalks?.bought };
    const reden = verlengen
      ? stand.speeltijd < 0.4
        ? `hij speelt bij jou te weinig; ze zoeken een club waar hij wél aan spelen toekomt`
        : `ze vinden €${bod.toLocaleString('nl-BE')} te weinig voor nog een seizoen`
      : stand.groei > 2
        ? `hij is bij jou zo gegroeid dat ze hem liever zelf houden`
        : `ze vinden €${bod.toLocaleString('nl-BE')} te weinig`;
    addNews(state, 'slecht', `${club} zegt nee: ${reden}. Over vier weken kun je het opnieuw proberen.`);
    addLog(state, 'antwoord', `${club} wijst je vraag over ${p.name} af.`);
    return;
  }

  if (state.cash < bod) {
    addNews(state, 'slecht', `${club} ging akkoord voor ${p.name}, maar je hebt €${bod.toLocaleString('nl-BE')} niet meer op de rekening. De afspraak gaat niet door.`);
    p.loanTalks = { season: state.season, weeksLeft: 4, bought: p.loanTalks?.bought };
    return;
  }

  if (verlengen) {
    book(state, 'transfers', -bod, `Huur verlengd: ${p.name}`);
    p.loan = { ...p.loan, untilSeason: state.season + 1 };
    p.contractUntil = state.season + 1;
    p.loanTalks = { season: state.season, weeksLeft: 0, bought: p.loanTalks?.bought };
    addNews(state, 'goed', `${club} gaat akkoord: ${p.name} blijft nog een seizoen bij je club.`, 'viering');
    addLog(state, 'antwoord', `${club} verlengt de huur van ${p.name} voor €${bod.toLocaleString('nl-BE')}.`);
    return;
  }

  book(state, 'transfers', -bod, `Aankoop ${p.name} van ${club}`);
  p.loan = null;
  p.purchasePrice = bod;
  p.contractUntil = state.season + 2;
  p.wage = round(wageDemand(state, p), 5);
  p.loanTalks = { season: state.season, weeksLeft: 0, bought: true };
  p.morale = clamp(p.morale + 8, 0, 100);
  addNews(state, 'goed', `${p.name} is definitief van jou: ${club} verkoopt hem voor €${bod.toLocaleString('nl-BE')}. Hij tekent voor twee seizoenen aan €${p.wage} per week.`, 'viering');
  addLog(state, 'antwoord', `${p.name} gekocht van ${club} voor €${bod.toLocaleString('nl-BE')}.`);
  remember(state, `${p.name} kwam als huurspeler en bleef: je kocht hem van ${club}.`);
}
