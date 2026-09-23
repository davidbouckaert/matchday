// Opslaan en laden. De rest van het spel praat alleen met de SaveStore-interface,
// zodat we later een online opslag (bv. een API met MongoDB erachter) kunnen toevoegen
// zonder de game zelf aan te passen.

import type { GameState, LedgerCategory, UpgradeId } from '../engine/types';
import { SAVE_VERSION } from '../engine/newGame';
import type { Rng } from '../engine/rng';
import { createRng } from '../engine/rng';
import { CANTEEN_ITEMS } from '../engine/data/catalog';
import { emptyStats } from '../engine/stats';
import { overall } from '../engine/players';
import { createOpening } from '../engine/opening';
import { teamsFor } from '../engine/youth';
import { maxYouthFee } from '../engine/actions';
import { buildWorld } from '../engine/world';
import { emptyCareer, emptyOwner, levelFor } from '../engine/career';
import { emptyInvestorState, stadiumSponsorWeekly } from '../engine/investors';
import { DEFAULT_SCHEME, SCHEMES, rgb } from '../ui/theme';
import { START_CLUBS } from '../engine/data/setup';
import { DIVISIONS } from '../engine/data/divisions';
import { MATCH_WEEKS } from '../engine/calendar';
import { companySector } from '../engine/sponsors';
import { makeProspect } from '../engine/sponsors';
import { PLANS } from '../engine/strategy';
import { assignMatchPlans } from '../engine/league';
import { FIRST_NAMES, LAST_NAMES } from '../engine/data/names';

export interface SaveStore {
  load(slot: string): Promise<GameState | null>;
  save(slot: string, state: GameState): Promise<void>;
  remove(slot: string): Promise<void>;
}

const DB_NAME = 'voetbalclub-game';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const indexedDbStore: SaveStore = {
  async load(slot) {
    const raw = await tx<unknown>('readonly', (s) => s.get(slot));
    return raw ? migrate(raw) : null;
  },
  async save(slot, state) {
    await tx('readwrite', (s) => s.put(state, slot));
  },
  async remove(slot) {
    await tx('readwrite', (s) => s.delete(slot));
  },
};

/** Past oudere opslagbestanden aan naar de huidige versie. */
export function migrate(raw: unknown): GameState {
  const state = raw as GameState;
  if (!state || typeof state !== 'object' || typeof state.version !== 'number') {
    throw new Error('Dit is geen geldig opslagbestand.');
  }
  if (state.version > SAVE_VERSION) {
    throw new Error('Dit opslagbestand komt van een nieuwere versie van het spel.');
  }
  if (state.version === 1) migrateV1toV2(state);
  if (state.version === 2) migrateV2toV3(state);
  if (state.version === 3) migrateV3toV4(state);
  if (state.version === 4) migrateV4toV5(state);
  if (state.version === 5) migrateV5toV6(state);
  if (state.version === 6) migrateV6toV7(state);
  if (state.version === 7) migrateV7toV8(state);
  if (state.version === 8) migrateV8toV9(state);
  if (state.version === 9) migrateV9toV10(state);
  if (state.version === 10) migrateV10toV11(state);
  if (state.version === 11) migrateV11toV12(state);
  if (state.version === 12) migrateV12toV13(state);
  if (state.version === 13) migrateV13toV14(state);
  if (state.version === 14) migrateV14toV15(state);
  if (state.version === 15) migrateV15toV16(state);
  if (state.version === 16) migrateV16toV17(state);
  if (state.version === 17) migrateV17toV18(state);
  if (state.version === 18) migrateV18toV19(state);
  if (state.version === 19) migrateV19toV20(state);
  if (state.version === 20) migrateV20toV21(state);
  if (state.version === 21) migrateV21toV22(state);
  if (state.version === 22) migrateV22toV23(state);
  if (state.version === 23) migrateV23toV24(state);
  if (state.version === 24) migrateV24toV25(state);
  if (state.version === 25) migrateV25toV26(state);
  if (state.version === 26) migrateV26toV27(state);
  if (state.version === 27) migrateV27toV28(state);
  if (state.version === 28) migrateV28toV29(state);
  if (state.version === 29) migrateV29toV30(state);
  repair(state);
  return state;
}

/** Versie 2: tactiek, delegeren, sponsorwerving, uitgestelde opbrengsten, opleidingscentrum. */
function migrateV1toV2(state: GameState): void {
  const s = state as GameState & { community: { volunteerEnergy?: number } };
  delete s.community.volunteerEnergy;
  s.community.volunteerLoyaltyWeeks = 0;
  s.infrastructure.academyLevel = 0;
  s.pending = [];
  (s as unknown as { tactics: unknown }).tactics = { formation: '4-4-2', style: 'gebalanceerd', manualXI: [] }; // wordt in v3 omgezet
  s.delegation = {};
  s.transferBudget = 0;
  s.prospects = [];
  s.sponsorCampaignWeeks = 0;
  const rng = createRng(s);
  for (let i = 0; i < 8; i++) s.prospects.push(makeProspect(s, rng));
  for (const st of s.staff) st.courseType = st.courseWeeksLeft > 0 ? 'diploma' : null;
  for (const st of s.staffMarket) st.courseType = null;
  for (const d of [...s.sponsors, ...s.sponsorOffers]) {
    d.satisfaction = 60;
    d.extraAskedSeason = 0;
  }
  s.version = 2;
}

/** Versie 3: tab Strategie (training, mentaliteit, spelplannen) en zelf te kiezen lidgeld. */
function migrateV2toV3(state: GameState): void {
  const s = state as GameState & { tactics: { style?: string } };
  const old = s.tactics.style;
  delete s.tactics.style;
  s.tactics.mentality = old === 'verdedigend' || old === 'aanvallend' ? old : 'gebalanceerd';
  s.tactics.plan = old === 'counter' || old === 'pressing' ? old : 'balbezit';
  s.tactics.trainings = 3;
  s.tactics.focus = 'conditie';
  s.youthFee = 230;
  const rng = createRng(s);
  for (const t of s.league.teams) t.plan = rng.pick(PLANS);
  assignMatchPlans(s.league.fixtures.filter((f) => f.homeGoals === undefined), s.league.teams, rng);
  s.version = 3;
}

/** Versie 4: vermoeidheid en weekoverzicht. */
function migrateV3toV4(state: GameState): void {
  for (const p of [...state.players, ...state.transferList]) p.fatigue = 0;
  state.weekHistory = [];
  state.version = 4;
}

/** Versie 5: kaarten en schorsingen, recuperatieruimte, limieten op evenementen. */
function migrateV4toV5(state: GameState): void {
  for (const p of [...state.players, ...state.transferList]) {
    p.yellowCards = 0;
    p.redCards = 0;
    p.suspended = 0;
  }
  state.infrastructure.recoveryLevel = 0;
  state.eventCounts = {};
  state.league.discipline = [];
  const rng = createRng(state);
  for (const t of state.league.teams) {
    const names = new Set<string>();
    while (names.size < 18) names.add(`${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`);
    t.roster = [...names];
  }
  state.version = 5;
}

/** Versie 6: speeltijd en evolutie, transferlijst, uitlenen en huren, evenementenlog. */
function migrateV5toV6(state: GameState): void {
  for (const p of [...state.players, ...state.transferList]) {
    p.starts = 0;
    p.periodStarts = 0;
    p.trend = 0;
    p.listed = false;
    p.askingPrice = 0;
    p.loan = null;
  }
  state.loanMarket = [];
  state.periodMatches = 0;
  state.eventLog = [];
  state.version = 6;
}

/** Versie 7: fanshop (merchandising). */
function migrateV6toV7(state: GameState): void {
  state.merch = { active: false, items: [], lastUnits: [], seasonUnits: 0 };
  state.version = 7;
}

/** Versie 8: kantine en concessies, cijfers, spelersrollen, logboek, nieuwe infrastructuur, gesplitste taken. */
function migrateV7toV8(state: GameState): void {
  const i = state.infrastructure;
  i.wifiLevel = 0;
  i.sanitairLevel = 0;
  i.parkingLevel = 0;
  i.maintenance = 'normaal';
  i.greenEnergy = false;
  state.tactics.roles = { kapitein: null, strafschop: null, hoekschop: null };
  state.canteen = { items: CANTEEN_ITEMS.map((c) => ({ id: c.id, price: c.ref })), concessions: [], lastCanteen: [], lastConcessions: [] };
  state.stats = emptyStats(state.season);
  state.statsHistory = [];
  state.requests = [];
  state.log = [];
  state.crest = 'schild';
  for (const d of state.sponsors) d.sector = d.sector ?? companySector(d.name);
  for (const o of state.sponsorOffers) o.sector = o.sector ?? companySector(o.name);
  // de oude taak "Strategie" dekte training, opstelling en tactiek samen
  const old = (state.delegation as Record<string, string | undefined>).opstelling;
  if (old) {
    state.delegation.training = old;
    state.delegation.tactiek = old;
    state.delegation.spelersrollen = old;
  }
  state.version = 8;
}

/**
 * Versie 9: scorebord, weekcijfers, loononderhandelingen, herschaalde vrijwilligers
 * (12 in plaats van 28 is voortaan normaal) en sectoren die bij de sponsornaam passen.
 */
function migrateV8toV9(state: GameState): void {
  state.infrastructure.scoreboardLevel = 0;
  state.statsWeeks = [];
  state.inflation = 1 + (state.season - 1) * 0.07;
  for (const p of [...state.players, ...state.transferList, ...state.loanMarket]) p.negotiations = 0;
  // vrijwilligers stonden op een schaal die te grof was; alles gaat door 2,4
  state.community.volunteers = Math.max(3, Math.round(state.community.volunteers / 2.4));
  for (const d of state.sponsors) d.sector = companySector(d.name);
  for (const o of state.sponsorOffers) o.sector = companySector(o.name);
  for (const pr of state.prospects) pr.sector = companySector(pr.name);
  state.version = 9;
}

/** Versie 10: de boekhoudpost "concessies" heet nu "horeca concessies". */
function migrateV9toV10(state: GameState): void {
  const rename = (totals: Partial<Record<string, number>>) => {
    const old = totals['concessies'];
    if (old !== undefined) {
      totals['horeca concessies'] = (totals['horeca concessies'] ?? 0) + old;
      delete totals['concessies'];
    }
  };
  rename(state.seasonTotals);
  rename(state.lastSeasonTotals);
  for (const w of state.weekHistory) rename(w.totals);
  for (const w of state.statsWeeks) rename(w.revenue);
  for (const e of [...state.thisWeek, ...state.lastWeek]) if ((e.category as string) === 'concessies') e.category = 'horeca concessies';
  state.version = 10;
}

/** Versie 11: eigen ploegbus als investering. */
function migrateV10toV11(state: GameState): void {
  state.infrastructure.teamBus = false;
  state.sponsors = state.sponsors.filter((d) => d.kind !== 'bus');
  state.sponsorOffers = state.sponsorOffers.filter((o) => o.kind !== 'bus');
  state.version = 11;
}

/**
 * Versie 13: bestanden die als versie 12 zijn opgeslagen door een tussenversie misten soms
 * de clubrecords. Die werden pas later aan dezelfde migratie toegevoegd.
 */
function migrateV12toV13(state: GameState): void {
  state.version = 13;
}

/**
 * Versie 14: de seizoensopening (persconferentie, voorbeschouwing en de doelen van het bestuur).
 * Ben je nog voor de eerste speeldag, dan krijg je ze alsnog; sta je al middenin het seizoen,
 * dan begint het bij de volgende seizoenstart — een persconferentie in week 30 heeft weinig zin.
 */
function migrateV13toV14(state: GameState): void {
  state.ambition ??= null;
  state.seasonGoals ??= [];
  state.lastSeasonSettlement ??= null;
  state.opening ??= state.week < MATCH_WEEKS[0] ? createOpening(state, createRng(state), [], ['Nieuwe truitjes liggen klaar in de kantine']) : null;
  state.version = 14;
}

/**
 * Versie 15: de jeugdwerking bestaat nu uit ploegen. Elke ploeg bindt vrijwilligers,
 * dus bestaande clubs krijgen het aantal ploegen dat bij hun ledenaantal hoort.
 */
function migrateV14toV15(state: GameState): void {
  state.community.youthTeams ??= teamsFor(state);
  state.version = 15;
}

/**
 * Versie 16: één aartsrivaal per reeks (in plaats van twee derby's), het weekmoment
 * en de onderlinge balans tegen die rivaal.
 */
function migrateV15toV16(state: GameState): void {
  state.derbyRecord ??= { won: 0, drawn: 0, lost: 0 };
  state.weekChoice ??= null;
  state.lastChoice ??= null;
  const rivals = state.league.teams.filter((t) => t.isRival);
  if (rivals.length !== 1) {
    for (const t of state.league.teams) t.isRival = false;
    const pick = rivals[0] ?? state.league.teams[0];
    if (pick) pick.isRival = true;
  }
  state.version = 16;
}

/**
 * Versie 17: doelpunten per speler, en reekssterktes die niet meer overlappen.
 */
function migrateV16toV17(state: GameState): void {
  for (const p of [...state.players, ...state.transferList, ...state.loanMarket]) {
    p.goals ??= 0;
    p.careerGoals ??= 0;
    p.startQuality ??= overall(p);
  }
  state.version = 17;
}

/**
 * Versie 18: Nederlandse namen voor de boekingscategorieën. De bedragen verhuizen mee,
 * zodat je cijfers per categorie en je weekgeschiedenis blijven kloppen.
 */
const RENAMED: [string, string][] = [
  ['merchandising', 'clubartikelen'],
  ['inkoop shop', 'inkoop winkel'],
  ['werking shop', 'werking winkel'],
  ['lonen staff', 'lonen personeel'],
];

function renameCategories(totals: Record<string, number | undefined> | undefined): void {
  if (!totals) return;
  for (const [from, to] of RENAMED) {
    if (totals[from] === undefined) continue;
    totals[to] = (totals[to] ?? 0) + (totals[from] ?? 0);
    delete totals[from];
  }
}

function migrateV17toV18(state: GameState): void {
  const map = new Map(RENAMED);
  for (const list of [state.lastWeek, state.thisWeek]) {
    for (const e of list ?? []) {
      const to = map.get(e.category as string);
      if (to) e.category = to as LedgerCategory;
    }
  }
  renameCategories(state.seasonTotals as Record<string, number | undefined>);
  renameCategories(state.lastSeasonTotals as Record<string, number | undefined>);
  for (const w of state.weekHistory ?? []) renameCategories(w.totals as Record<string, number | undefined>);
  for (const w of state.statsWeeks ?? []) renameCategories(w.revenue as Record<string, number | undefined>);
  for (const p of state.pending ?? []) {
    const to = map.get(p.category as string);
    if (to) p.category = to as LedgerCategory;
  }
  state.version = 18;
}

/**
 * Versie 19: twee bouwwerven tegelijk, een tribune waarvan jij de grootte kiest,
 * en zonnepanelen als bouwproject. Een lopend project verhuist naar de nieuwe lijst.
 */
function migrateV18toV19(state: GameState): void {
  const i = state.infrastructure as typeof state.infrastructure & { construction?: { upgrade: string; weeksLeft: number } | null };
  if (!i.constructions) {
    i.constructions = i.construction ? [{ upgrade: i.construction.upgrade as UpgradeId, weeksLeft: i.construction.weeksLeft, seats: i.construction.upgrade === 'tribune' ? 300 : undefined }] : [];
  }
  delete i.construction;
  state.version = 19;
}

/** Versie 20: je kunt spelers zelf op de bank houden. */
function migrateV19toV20(state: GameState): void {
  state.tactics.benched ??= [];
  state.version = 20;
}

/** Versie 21: plaatsen die je bewust openlaat in je basiself. */
function migrateV20toV21(state: GameState): void {
  state.tactics.gaps ??= {};
  state.version = 21;
}

/** Versie 22: verhaallijnen en de clubkroniek (contentlaag). */
function migrateV21toV22(state: GameState): void {
  state.storylines ??= [];
  state.chronicle ??= [];
  state.version = 22;
}

/** Versie 23: de wereld rond je club — andere clubs met budget, ambitie en momentum. */
function migrateV22toV23(state: GameState): void {
  const rng = createRng(state);
  state.world = buildWorld(rng);
  state.lastWorldMoves = [];
  linkLeagueToWorld(state, rng);
  state.version = 23;
}

/** Versie 28: je kiest je clubkleuren, en die kleuren de hele app. */
function migrateV27toV28(state: GameState): void {
  // bestaande spellen hadden geen keuze; we leiden het schema af uit de kleuren van hun
  // startclub, zodat een oud bestand er niet plots anders uitziet
  const club = START_CLUBS.find((c) => c.id === state.clubId);
  const beste = club
    ? SCHEMES.map((sch) => ({ sch, afstand: kleurAfstand(sch.colors[0], club.colors[0]) })).sort((a, b) => a.afstand - b.afstand)[0].sch
    : DEFAULT_SCHEME;
  state.scheme ??= beste.id;
  state.version = 28;
}

/** Hoe ver twee kleuren uit elkaar liggen, plat gemeten over de drie kanalen. */
function kleurAfstand(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/** Versie 27: elke investeerder speelt een ander spel. */
function migrateV26toV27(state: GameState): void {
  state.investorState = {
    coopRounds: 0,
    coopSeason: null,
    // wie al promoveerde, krijgt de klok vanaf dat seizoen; anders vanaf het begin
    lastPromotionSeason: (state.promotionsWithInvestor ?? 0) > 0 ? Math.max(0, (state.season ?? 1) - 1) : 0,
  };
  // de stadionsponsor van de aannemer schaalt voortaan met reeks, reputatie en prijspeil
  const stadion = state.sponsors?.find((d) => d.kind === 'stadion');
  if (stadion) stadion.weekly = stadiumSponsorWeekly(state);
  state.version = 27;
}

/** Versie 26: abonnementen en meerjarige sponsorcontracten. */
/**
 * Laag 17: je zet zelf wat een sponsorplaats kost.
 *
 * Een bestaand spel begint met een lege prijskaart, en dat betekent "volg de gangbare
 * prijs" — precies wat er tot nu toe gebeurde. Wie niets aanraakt, merkt dus niets.
 */
function migrateV28toV29(state: GameState): void {
  state.sponsorAsk ??= {};
  state.version = 29;
}

/** Versie 30: huurspelers kun je verlengen of kopen, en daarvoor telt hun groei mee. */
function migrateV29toV30(state: GameState): void {
  for (const p of state.players) p.startQuality ??= overall(p);
  for (const p of state.loanMarket) p.startQuality ??= overall(p);
  for (const p of state.transferList ?? []) p.startQuality ??= overall(p);
  state.version = 30;
}

function migrateV25toV26(state: GameState): void {
  state.seasonTickets ??= null;
  for (const d of state.sponsors ?? []) d.lockedSeasons ??= 1;
  state.version = 26;
}

/** Versie 25: waar de bedragen van de week vandaan kwamen. */
function migrateV24toV25(state: GameState): void {
  state.lastOrigins ??= [];
  state.version = 25;
}

/** Versie 24: je langetermijndoel en je eigen niveau als eigenaar. */
function migrateV23toV24(state: GameState): void {
  state.career ??= emptyCareer();
  state.owner ??= emptyOwner();
  // wie al seizoenen achter de rug heeft, begint niet vanaf nul
  for (const h of state.history ?? []) {
    const level = DIVISIONS.findIndex((d) => d.name === h.division);
    if (level >= 0) state.career.seasonsByLevel[level] = (state.career.seasonsByLevel[level] ?? 0) + 1;
    let points = 1;
    if (h.result === 'kampioen') points += 5;
    else if (h.result === 'promotie') points += 3;
    if (h.profit > 0) points += 2;
    state.owner.points += points;
  }
  state.owner.points += (state.milestones ?? []).length * 2;
  state.owner.level = levelFor(state.owner.points);
  state.version = 24;
}

/**
 * Koppelt de tegenstanders van de lopende competitie aan een club in de wereld. Clubs die
 * nog niet bestaan, worden aangemaakt op het niveau waarop ze spelen; hun huidige sterkte
 * blijft behouden, zodat een lopend seizoen niet plots anders aanvoelt.
 */
function linkLeagueToWorld(state: GameState, rng: Rng): void {
  const level = state.league?.divisionLevel ?? 1;
  for (const team of state.league?.teams ?? []) {
    let club = state.world.clubs.find((c) => c.name === team.name);
    if (!club) {
      club = { ...state.world.clubs[0] };
      club.id = `w${state.world.clubs.length + 500}`;
      club.name = team.name;
      club.seasons = [];
      club.lastMove = null;
      club.momentum = 0;
      club.trouble = rng.int(0, 25);
      state.world.clubs.push(club);
    }
    club.divisionLevel = level;
    club.strength = team.strength;
    club.defunct = false;
    team.clubId = club.id;
  }
}

/**
 * Vangnet: vult alles aan wat een opslagbestand nog niet kent. Zo blijft een oud bestand
 * werken, ook als er onderweg een veld bijkwam zonder eigen migratie.
 */
function repair(state: GameState): void {
  const s = state as GameState & Record<string, unknown>;
  const fallback: Array<[keyof GameState, unknown]> = [
    ['records', { attendance: 0, weekIncome: 0, seasonIncome: 0, unbeaten: 0, winStreak: 0, fanBase: state.community?.fanBase ?? 0 }],
    ['lastRecords', []],
    ['milestones', []],
    ['lastMilestones', []],
    ['statsWeeks', []],
    ['statsHistory', []],
    ['requests', []],
    ['log', []],
    ['inflation', 1 + Math.max(0, (state.season ?? 1) - 1) * 0.07],
    ['crest', 'schild'],
    ['seasonGoals', []],
    ['opening', null],
    ['ambition', null],
    ['lastSeasonSettlement', null],
    ['derbyRecord', { won: 0, drawn: 0, lost: 0 }],
    ['weekChoice', null],
    ['lastChoice', null],
    ['storylines', []],
    ['chronicle', []],
    ['lastWorldMoves', []],
    ['lastOrigins', []],
  ];
  if (s.seasonTickets === undefined) (s as Record<string, unknown>).seasonTickets = null;
  state.investorState ??= emptyInvestorState();
  if (!s.career || typeof s.career !== 'object') (s as Record<string, unknown>).career = emptyCareer();
  if (!s.owner || typeof s.owner !== 'object') (s as Record<string, unknown>).owner = emptyOwner();
  if (state.career) state.career.seasonsByLevel ??= {};
  if (state.owner) {
    state.owner.points ??= 0;
    state.owner.level = levelFor(state.owner.points);
  }
  for (const [key, value] of fallback) if (s[key] === undefined || s[key] === null) (s as Record<string, unknown>)[key] = value;
  if (state.community) state.community.youthTeams ??= teamsFor(state);
  state.sponsorAsk ??= {};
  // Het lidgeld had vroeger een vaste bovengrens van €800; die klimt nu mee met je reeks.
  // Een bestaand spel waarin je boven de nieuwe grens zat, zakt terug naar het maximum.
  if (typeof state.youthFee === 'number') state.youthFee = Math.max(0, Math.min(state.youthFee, maxYouthFee(state)));
  for (const p of [...(state.players ?? []), ...(state.transferList ?? []), ...(state.loanMarket ?? [])]) {
    p.goals ??= 0;
    p.careerGoals ??= 0;
    p.startQuality ??= overall(p);
  }
  if (!state.world || !Array.isArray(state.world.clubs) || !state.world.clubs.length) {
    const rng = createRng(state);
    state.world = buildWorld(rng);
    linkLeagueToWorld(state, rng);
  }
  for (const team of state.league?.teams ?? []) {
    if (!team.clubId) team.clubId = state.world.clubs.find((c) => c.name === team.name)?.id ?? '';
  }
  if (state.tactics) {
    state.tactics.benched ??= [];
    state.tactics.gaps ??= {};
  }
  // het weekmoment kreeg plaatshouders; een oud moment heeft die nog niet
  if (state.weekChoice) {
    state.weekChoice.vars ??= {};
    state.weekChoice.focusPlayerId ??= null;
    state.weekChoice.focusSponsorId ??= null;
  }
  const i = state.infrastructure;
  if (i) {
    i.constructions ??= [];
    i.wifiLevel ??= 0;
    i.sanitairLevel ??= 0;
    i.parkingLevel ??= 0;
    i.scoreboardLevel ??= 0;
    i.recoveryLevel ??= 0;
    i.teamBus ??= false;
    i.greenEnergy ??= false;
    i.maintenance ??= 'normaal';
  }
  if (state.tactics && !state.tactics.roles) state.tactics.roles = { kapitein: null, strafschop: null, hoekschop: null };
  if (state.stats && !state.stats.merch) state.stats = emptyStats(state.season ?? 1);
  for (const p of state.players ?? []) p.negotiations ??= 0;
}

/** Versie 12: mijlpalen. */
function migrateV11toV12(state: GameState): void {
  state.milestones = [];
  state.lastMilestones = [];
  state.records = { attendance: 0, weekIncome: 0, seasonIncome: 0, unbeaten: 0, winStreak: 0, fanBase: state.community.fanBase };
  state.lastRecords = [];
  state.version = 12;
}

export function exportToFile(state: GameState): void {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.clubName.replace(/\s+/g, '-')}-seizoen${state.season}-week${state.week}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<GameState> {
  const text = await file.text();
  return migrate(JSON.parse(text));
}
