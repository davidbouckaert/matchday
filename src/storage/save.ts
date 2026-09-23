// Opslaan en laden. De rest van het spel praat alleen met de SaveStore-interface,
// zodat we later een online opslag (bv. een API met MongoDB erachter) kunnen toevoegen
// zonder de game zelf aan te passen.

import type { GameState, LedgerCategory, UpgradeId } from '../engine/types';
import { SAVE_VERSION } from '../engine/newGame';
import { createRng } from '../engine/rng';
import { CANTEEN_ITEMS } from '../engine/data/catalog';
import { emptyStats } from '../engine/stats';
import { createOpening } from '../engine/opening';
import { teamsFor } from '../engine/youth';
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
  ];
  for (const [key, value] of fallback) if (s[key] === undefined || s[key] === null) (s as Record<string, unknown>)[key] = value;
  if (state.community) state.community.youthTeams ??= teamsFor(state);
  for (const p of [...(state.players ?? []), ...(state.transferList ?? []), ...(state.loanMarket ?? [])]) {
    p.goals ??= 0;
    p.careerGoals ??= 0;
  }
  if (state.tactics) {
    state.tactics.benched ??= [];
    state.tactics.gaps ??= {};
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
