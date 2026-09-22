// Opslaan en laden. De rest van het spel praat alleen met de SaveStore-interface,
// zodat we later een online opslag (bv. een API met MongoDB erachter) kunnen toevoegen
// zonder de game zelf aan te passen.

import type { GameState } from '../engine/types';
import { SAVE_VERSION } from '../engine/newGame';
import { createRng } from '../engine/rng';
import { CANTEEN_ITEMS } from '../engine/data/catalog';
import { emptyStats } from '../engine/stats';
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
