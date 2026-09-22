import './style.css';
import type { Formation, GamePlan, GameState, Mentality, TaskId, TrainingFocus } from '../engine/types';
import { createNewGame } from '../engine/newGame';
import { advanceWeek } from '../engine/turn';
import * as actions from '../engine/actions';
import type { ActionResult } from '../engine/actions';
import { DIVISIONS } from '../engine/data/divisions';
import { MATCH_WEEKS, formatDateLong, formatWeek, isTransferWindow, seasonLabel, seasonPhase } from '../engine/calendar';
import { indexedDbStore, exportToFile, importFromFile } from '../storage/save';
import { defaultDraft, setupScreen, type SetupDraft } from './screens/setup';
import { overviewScreen, weekSummary } from './screens/overview';
import { squadScreen, transfersScreen } from './screens/squad';
import { staffScreen } from './screens/staff';
import { sponsorsScreen } from './screens/sponsors';
import { strategyScreen } from './screens/strategy';
import { trainingScreen } from './screens/training';
import { influencesScreen } from './screens/influences';
import { calendarScreen } from './screens/calendar';
import { merchScreen } from './screens/merch';
import { horecaScreen } from './screens/horeca';
import { numbersScreen } from './screens/numbers';
import { contractsScreen } from './screens/contracts';
import { VERSION } from '../version';
import { lineupGap } from '../engine/players';
import { animationOverlay, reportOverlay, type WeekRef } from './screens/report';
import { teamStrength } from '../engine/players';
import { OWN_TEAM_ID, ownPosition } from '../engine/league';
import { mainSponsor } from '../engine/sponsors';
import { strategyTask } from '../engine/delegation';
import { financeScreen } from './screens/finance';
import { clubScreen, eventsScreen, infraScreen, leagueScreen, saveScreen } from './screens/club';
import { avatarSvg } from './avatar';
import { type CrestShape, clubInitials, crestSvg } from './crest';
import { START_CLUBS } from '../engine/data/setup';
import { esc, euro } from './format';

const SLOT = 'slot1';

type Screen =
  | 'overzicht' | 'ploeg' | 'strategie' | 'transfers' | 'contracten' | 'staff' | 'opleiding'
  | 'kalender' | 'financien' | 'sponsors' | 'fanshop' | 'horeca' | 'cijfers' | 'evenementen' | 'infrastructuur' | 'club'
  | 'competitie' | 'invloeden' | 'opslaan';

/** Navigatie in groepen: hoofdtabs met subtabs. */
const GROUPS: { id: string; label: string; screens: [Screen, string][] }[] = [
  { id: 'overzicht', label: 'Overzicht', screens: [['overzicht', 'Overzicht']] },
  { id: 'ploeg', label: 'Ploeg', screens: [['ploeg', 'Selectie'], ['strategie', 'Strategie'], ['transfers', 'Transfers'], ['contracten', 'Contracten']] },
  { id: 'staff', label: 'Staff', screens: [['staff', 'Staff'], ['opleiding', 'Opleiding']] },
  {
    id: 'club',
    label: 'Club',
    screens: [
      ['kalender', 'Kalender'], ['financien', 'Financiën'], ['cijfers', 'Cijfers'], ['sponsors', 'Sponsors'],
      ['fanshop', 'Fanshop'], ['horeca', 'Horeca'], ['evenementen', 'Evenementen'], ['infrastructuur', 'Infrastructuur'], ['club', 'Clubinfo'],
    ],
  },
  { id: 'competitie', label: 'Competitie', screens: [['competitie', 'Stand, kalender en tucht']] },
  { id: 'invloeden', label: 'Invloeden', screens: [['invloeden', 'Invloeden']] },
  { id: 'opslaan', label: 'Opslaan', screens: [['opslaan', 'Opslaan en instellingen']] },
];

const groupOf = (screen: Screen) => GROUPS.find((g) => g.screens.some(([id]) => id === screen))!;

interface UiState {
  game: GameState | null;
  screen: Screen;
  draft: SetupDraft;
  toast: { text: string; ok: boolean } | null;
  lastSaved: string;
  confirmNewGame: boolean;
  busy: boolean;
  highlight: string;
  selectedStaff: string | null;
  sorts: Record<string, { col: number; dir: 1 | -1 }>;
  report: { phase: 'anim' | 'report'; prev: WeekRef } | null;
  animate: boolean;
  lastScreen: Record<string, Screen>; // laatst bezochte subtab per groep
}

const ui: UiState = {
  game: null,
  screen: 'overzicht',
  draft: defaultDraft(),
  toast: null,
  lastSaved: '',
  confirmNewGame: false,
  busy: false,
  highlight: '',
  selectedStaff: null,
  sorts: {},
  report: null,
  animate: readPref('vcg-anim', true),
  lastScreen: {},
};

/** Kleine voorkeur in de browser (fout = standaardwaarde). */
function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* geen opslag beschikbaar: dan onthouden we het alleen voor deze sessie */
  }
}

const root = document.getElementById('app')!;

// ---------- Opslaan ----------

async function persist(): Promise<void> {
  if (!ui.game) return;
  try {
    await indexedDbStore.save(SLOT, ui.game);
    ui.lastSaved = new Date().toLocaleTimeString('nl-BE');
  } catch (err) {
    showToast({ ok: false, message: `Opslaan mislukt: ${(err as Error).message}` });
  }
}

// ---------- Weergave ----------

function showToast(result: ActionResult): void {
  ui.toast = { text: result.message, ok: result.ok };
  window.clearTimeout((showToast as unknown as { t?: number }).t);
  (showToast as unknown as { t?: number }).t = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, 3500);
}

function renderScreen(g: GameState): string {
  switch (ui.screen) {
    case 'overzicht': return overviewScreen(g);
    case 'ploeg': return squadScreen(g);
    case 'strategie': return strategyScreen(g);
    case 'opleiding': return trainingScreen(g);
    case 'invloeden': return influencesScreen(g);
    case 'transfers': return transfersScreen(g);
    case 'staff': return staffScreen(g, ui.selectedStaff);
    case 'sponsors': return sponsorsScreen(g);
    case 'financien': return financeScreen(g);
    case 'infrastructuur': return infraScreen(g);
    case 'evenementen': return eventsScreen(g);
    case 'competitie': return leagueScreen(g);
    case 'club': return clubScreen(g);
    case 'opslaan': return saveScreen(g, ui.lastSaved, ui.animate);
    case 'kalender': return calendarScreen(g);
    case 'fanshop': return merchScreen(g);
    case 'horeca': return horecaScreen(g);
    case 'cijfers': return numbersScreen(g);
    case 'contracten': return contractsScreen(g);
  }
}

function render(): void {
  const toast = ui.toast ? `<div class="toast ${ui.toast.ok ? '' : 'bad'}" role="status">${esc(ui.toast.text)}</div>` : '';
  const g = ui.game;
  if (!g) {
    root.innerHTML = `<main class="setup-wrap">${setupScreen(ui.draft)}</main>${toast}`;
    return;
  }
  const division = DIVISIONS[g.league.divisionLevel];
  const gameOver = g.gameOver
    ? `<section class="card attention"><h2>Game over</h2><p>${esc(g.gameOverReason)}</p><p>Je hield het vol tot seizoen ${g.season}, week ${g.week}.</p><button class="primary" data-action="new-game-confirmed">Opnieuw beginnen</button></section>`
    : '';
  const strength = teamStrength(g);
  const played = g.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const main = mainSponsor(g);
  const { income, costs } = weekSummary(g.lastWeek);
  const net = income + costs;
  const group = groupOf(ui.screen);
  const gap = lineupGap(g);
  const blocked = gap.available < 11 ? `Je kunt geen elf opstellen: nog maar ${gap.available} speelklare spelers. Ga naar Ploeg › Selectie en haal spelers bij Transfers.` : '';
  const table = g.league.table.find((r) => r.teamId === OWN_TEAM_ID);
  root.innerHTML = `
    <header class="topbar">
      <div class="club">${crestSvg(g.crest as CrestShape, (START_CLUBS.find((c) => c.id === g.clubId)?.colors ?? ['#1f7a3c', '#ffffff']) as [string, string], clubInitials(g.clubName), 40)}${avatarSvg(g.avatar, 34)}<div><strong>${esc(g.clubName)}</strong><span class="muted small">${division.name} · ${seasonLabel(g.startYear, g.season)}</span></div></div>
      <div class="today"><span class="muted small">Vandaag · seizoen ${g.season}, week ${g.week}</span><strong>${formatDateLong(g.startYear, g.season, g.week)}</strong><span class="small">${seasonPhase(g.week)}${isTransferWindow(g.week) ? ' · <span class="tag">transferperiode open</span>' : ''}</span></div>
      <button class="primary next" data-action="next-week" ${blocked || g.gameOver || ui.busy ? 'disabled' : ''} title="${blocked ? esc(blocked) : 'Speel de volgende week (spatie)'}">Volgende week ▶</button>
      <div class="stats">
        <div class="stat"><span class="muted small">Teamsterkte</span><strong>${strength.total}</strong><span class="muted small">A ${strength.attack} · V ${strength.defense}</span></div>
        <div class="stat"><span class="muted small">Klassement</span><strong>${played ? `${ownPosition(g.league)}e` : '–'}</strong><span class="muted small">${played ? `${table!.points} ptn uit ${played}` : `start ${formatWeek(g.startYear, g.season, MATCH_WEEKS[0])}`}</span></div>
        <div class="stat hide-sm"><span class="muted small">Hoofdsponsor</span><strong class="ellipsis">${main ? esc(main.name) : 'geen'}</strong><span class="muted small">${main ? `${euro(main.weekly)}/week` : 'zoek er een (Club › Sponsors)'}</span></div>
        <div class="stat"><span class="muted small">Vorige week</span><strong class="${net < 0 ? 'neg' : 'pos'}">${net > 0 ? '+' : ''}${euro(net)}</strong><span class="muted small">in ${euro(income)} · uit ${euro(-costs)}</span></div>
        <div class="stat cash ${g.cash < 0 ? 'neg' : ''}"><span class="muted small">Saldo</span><strong>${euro(g.cash)}</strong><span class="muted small">${g.weeksNegative ? `${g.weeksNegative}/8 weken rood` : '&nbsp;'}</span></div>
      </div>
    </header>
    <nav class="tabs">${GROUPS.map((gr) => {
      const warn = gr.id === 'ploeg' && blocked ? '<span class="badge" title="Er is een probleem met je selectie">!</span>' : '';
      return `<button class="${gr.id === group.id ? 'on' : ''}" data-action="nav-group" data-id="${gr.id}">${gr.label}${warn}</button>`;
    }).join('')}</nav>
    ${group.screens.length > 1 ? `<nav class="subtabs">${group.screens.map(([id, label]) => `<button class="${ui.screen === id ? 'on' : ''}" data-action="nav" data-id="${id}">${label}</button>`).join('')}</nav>` : ''}
    <main class="content">${blocked ? `<section class="card attention"><h2>Je ploeg is niet compleet</h2><p>${esc(blocked)}</p></section>` : ''}${gameOver}${renderScreen(g)}</main>
    <footer class="app-footer"><span class="muted small">Clubeigenaar ${VERSION} · ${esc(g.clubName)} · seizoen ${g.season}, week ${g.week}</span></footer>
    ${ui.report ? (ui.report.phase === 'anim' ? animationOverlay(g, ui.report.prev) : reportOverlay(g, ui.report.prev)) : ''}
    ${toast}`;
  applySorts();
  measureBars();
  if (ui.screen === 'opslaan' && ui.confirmNewGame) {
    const btn = root.querySelector<HTMLButtonElement>('[data-action="new-game"]');
    if (btn) {
      btn.textContent = 'Zeker? Klik nogmaals om te bevestigen';
      btn.dataset.action = 'new-game-confirmed';
    }
  }
}

/** Houdt de kopbalk en de menubalk op hun plaats, ook als ze van hoogte veranderen. */
function measureBars(): void {
  const set = (name: string, el: Element | null) => document.documentElement.style.setProperty(name, `${el ? Math.round((el as HTMLElement).offsetHeight) : 0}px`);
  set('--topbar-h', root.querySelector('.topbar'));
  set('--tabs-h', root.querySelector('.tabs'));
}

window.addEventListener('resize', measureBars);

// ---------- Sorteren ----------

/** Sorteert elke tabel met data-sort-id volgens de gekozen kolom (klik op de kolomkop). */
function applySorts(): void {
  root.querySelectorAll<HTMLTableElement>('table[data-sort-id]').forEach((table) => {
    const id = table.dataset.sortId!;
    const headers = table.querySelectorAll<HTMLTableCellElement>('thead th');
    headers.forEach((th, i) => {
      if (th.dataset.nosort !== undefined) return;
      th.classList.add('sortable');
      th.dataset.action = 'sort';
      th.dataset.id = `${id}:${i}`;
    });
    const sort = ui.sorts[id];
    if (!sort) return;
    headers[sort.col]?.classList.add(sort.dir === 1 ? 'asc' : 'desc');
    const body = table.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    const value = (row: HTMLTableRowElement) => {
      const cell = row.cells[sort.col];
      if (!cell) return '';
      const raw = cell.dataset.v ?? cell.textContent?.trim() ?? '';
      const num = Number(raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.').match(/^[+-]?\d+(\.\d+)?/)?.[0]);
      return Number.isFinite(num) && /^[+\-€\d]/.test(raw.trim()) ? num : raw.toLowerCase();
    };
    rows.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb), 'nl') * sort.dir;
    });
    rows.forEach((r) => body.appendChild(r));
  });
}

// ---------- Een week spelen ----------

let animTimer = 0;

async function playWeek(): Promise<void> {
  if (!ui.game || ui.busy || ui.game.gameOver) return;
  ui.busy = true;
  const prev = { week: ui.game.week, season: ui.game.season };
  ui.game = advanceWeek(ui.game);
  ui.busy = false;
  await persist();
  ui.report = { phase: ui.animate ? 'anim' : 'report', prev };
  if (ui.animate) {
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      if (ui.report?.phase === 'anim') {
        ui.report.phase = 'report';
        render();
      }
    }, 1800);
  }
}

// ---------- Acties ----------

type Handler = (id: string) => ActionResult | void | Promise<ActionResult | void>;

function gameAction(fn: (g: GameState, id: string) => ActionResult): Handler {
  return (id) => (ui.game ? fn(ui.game, id) : undefined);
}

const handlers: Record<string, Handler> = {
  // setup
  'draft-skin': (id) => void (ui.draft.skin = Number(id)),
  'draft-hair': (id) => void (ui.draft.hair = Number(id)),
  'draft-shirt': (id) => void (ui.draft.shirt = Number(id)),
  'draft-background': (id) => void (ui.draft.background = id as SetupDraft['background']),
  'draft-club': (id) => void (ui.draft.clubId = id),
  'draft-crest': (id) => void (ui.draft.crest = id as SetupDraft['crest']),
  'draft-investor': (id) => void (ui.draft.investor = id as SetupDraft['investor']),
  'draft-back': () => void (ui.draft.step = Math.max(1, ui.draft.step - 1) as SetupDraft['step']),
  'draft-next': () => {
    if (ui.draft.step === 1 && !ui.draft.name.trim()) return { ok: false, message: 'Geef je eigenaar een naam.' };
    ui.draft.step = Math.min(3, ui.draft.step + 1) as SetupDraft['step'];
  },
  'draft-start': async () => {
    const d = ui.draft;
    ui.game = createNewGame({
      avatar: { name: d.name.trim(), skin: d.skin, hair: d.hair, shirt: d.shirt, background: d.background },
      clubId: d.clubId,
      investor: d.investor,
      crest: d.crest,
    });
    ui.screen = 'overzicht';
    await persist();
  },

  // navigatie
  nav: (id) => {
    ui.screen = id as Screen;
    ui.lastScreen[groupOf(ui.screen).id] = ui.screen;
    ui.confirmNewGame = false;
  },
  'nav-group': (id) => {
    const gr = GROUPS.find((x) => x.id === id)!;
    ui.screen = ui.lastScreen[gr.id] ?? gr.screens[0][0];
    ui.confirmNewGame = false;
  },
  'skip-anim': () => {
    if (ui.report) ui.report.phase = 'report';
  },
  'close-report': () => {
    ui.report = null;
    ui.screen = 'overzicht';
    ui.lastScreen.overzicht = 'overzicht';
  },
  'report-overview': () => {
    ui.report = null;
    ui.screen = 'overzicht';
  },

  'toggle-anim': () => {
    ui.animate = !ui.animate;
    writePref('vcg-anim', ui.animate);
    return { ok: true, message: ui.animate ? 'Animatie na elke week staat aan.' : 'Animatie uit: je ziet meteen het weekrapport.' };
  },
  'next-week': async () => {
    await playWeek();
  },


  sort: (id) => {
    const [table, col] = id.split(':');
    const current = ui.sorts[table];
    const c = Number(col);
    ui.sorts[table] = current && current.col === c ? { col: c, dir: current.dir === 1 ? -1 : 1 } : { col: c, dir: 1 };
  },
  'staff-open': (id) => void (ui.selectedStaff = ui.selectedStaff === id ? null : id),

  // spel
  buy: gameAction(actions.buyPlayer),
  sell: gameAction(actions.sellPlayer),
  extend: gameAction((g, id) => {
    const input = document.getElementById(`wage-${id}`) as HTMLInputElement | null;
    return actions.extendContract(g, id, input ? Number(input.value) : undefined);
  }),
  'goto-contracts': (id) => {
    ui.screen = 'contracten';
    ui.lastScreen.ploeg = 'contracten';
    ui.highlight = id;
  },
  'open-concession': gameAction((g, id) => {
    const input = document.getElementById(`margin-${id}`) as HTMLInputElement | null;
    return actions.openConcession(g, id as Parameters<typeof actions.openConcession>[1], Number(input?.value));
  }),
  'close-concession': gameAction((g, id) => actions.closeConcession(g, id as Parameters<typeof actions.closeConcession>[1])),
  maintenance: gameAction((g, id) => actions.setMaintenance(g, id as 'basis' | 'normaal' | 'premium')),
  'green-energy': gameAction((g) => actions.investGreenEnergy(g)),
  release: gameAction(actions.releasePlayer),
  'accept-offer': gameAction(actions.acceptPlayerOffer),
  'decline-offer': gameAction(actions.declinePlayerOffer),
  hire: gameAction(actions.hireStaff),
  fire: gameAction(actions.fireStaff),
  course: gameAction((g, id) => actions.startCourse(g, id, 'diploma')),
  bijscholing: gameAction((g, id) => actions.startCourse(g, id, 'bijscholing')),
  delegate: gameAction((g, id) => {
    const [task, staffId] = id.split('|') as [TaskId, string];
    const result = actions.delegateTask(g, task, g.delegation[task] === staffId ? null : staffId);
    if (result.ok && task === 'opstelling' && g.delegation.opstelling) strategyTask(g); // hij kiest meteen
    return result;
  }),
  'undelegate': gameAction((g, id) => actions.delegateTask(g, id as TaskId, null)),
  formation: gameAction((g, id) => actions.setFormation(g, id as Formation)),
  mentality: gameAction((g, id) => actions.setMentality(g, id as Mentality)),
  plan: gameAction((g, id) => actions.setPlan(g, id as GamePlan)),
  starter: gameAction(actions.toggleStarter),
  'auto-lineup': gameAction((g) => actions.autoLineup(g)),
  approach: gameAction(actions.approachProspect),
  network: gameAction((g) => actions.networkEvening(g)),
  campaign: gameAction((g) => actions.startCampaign(g)),
  'sponsor-cancel': gameAction(actions.cancelSponsor),
  'sponsor-extra': gameAction(actions.askExtra),
  'sponsor-renew': gameAction(actions.renewSponsor),
  volunteer: gameAction(actions.volunteerAction),
  list: gameAction((g, id) => {
    const input = document.getElementById(`ask-${id}`) as HTMLInputElement | null;
    return actions.listPlayer(g, id, Number(input?.value));
  }),
  unlist: gameAction(actions.unlistPlayer),
  'start-merch': gameAction((g) => actions.startMerch(g)),
  'add-merch-item': gameAction((g, id) => actions.addMerchItem(g, id as Parameters<typeof actions.addMerchItem>[1])),
  'remove-merch-item': gameAction((g, id) => actions.removeMerchItem(g, id as Parameters<typeof actions.removeMerchItem>[1])),
  'loan-out': gameAction(actions.loanOut),
  'loan-in': gameAction(actions.loanIn),
  loan: gameAction(actions.takeLoan),
  repay: gameAction(actions.repayLoan),
  'accept-sponsor': gameAction(actions.acceptSponsor),
  'decline-sponsor': gameAction(actions.declineSponsor),
  upgrade: gameAction((g, id) => actions.startUpgrade(g, id as Parameters<typeof actions.startUpgrade>[1])),
  event: gameAction(actions.organiseEvent),

  // opslaan
  export: () => {
    if (ui.game) exportToFile(ui.game);
    return { ok: true, message: 'Back-up gedownload.' };
  },
  'new-game': () => void (ui.confirmNewGame = true),
  'new-game-confirmed': async () => {
    await indexedDbStore.remove(SLOT);
    ui.game = null;
    ui.draft = defaultDraft();
    ui.confirmNewGame = false;
  },
};

root.addEventListener('click', async (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;
  const handler = handlers[target.dataset.action!];
  if (!handler) return;
  const result = await handler(target.dataset.id ?? '');
  if (result) {
    showToast(result);
    if (result.ok && ui.game) await persist();
  }
  render();
});

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'draft-name') ui.draft.name = el.value; // geen render: anders verlies je de cursor
});

// Keuzelijsten (select) met data-change
const changeHandlers: Record<string, (g: GameState, value: string, id: string) => ActionResult> = {
  trainings: (g, v) => actions.setTrainings(g, Number(v)),
  focus: (g, v) => actions.setFocus(g, v as TrainingFocus),
  formation: (g, v) => actions.setFormation(g, v as Formation),
  'ticket-price': (g, v) => actions.setTicketPrice(g, Number(v)),
  'youth-fee': (g, v) => actions.setYouthFee(g, Number(v)),
  'transfer-budget': (g, v) => actions.setTransferBudget(g, Number(v)),
  'merch-price': (g, v, id) => actions.setMerchPrice(g, id as Parameters<typeof actions.setMerchPrice>[1], Number(v)),
  'canteen-price': (g, v, id) => actions.setCanteenPrice(g, id as Parameters<typeof actions.setCanteenPrice>[1], Number(v)),
  'concession-margin': (g, v, id) => actions.renegotiateConcession(g, id as Parameters<typeof actions.renegotiateConcession>[1], Number(v)),
  'player-role': (g, v, id) => actions.setPlayerRole(g, id as 'kapitein' | 'strafschop' | 'hoekschop', v || null),
  'asking-price': (g, v, id) => actions.listPlayer(g, id, Number(v)),
};

root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  const key = el.dataset?.change;
  if (key && changeHandlers[key] && ui.game) {
    const result = changeHandlers[key](ui.game, el.value, el.dataset.id ?? '');
    showToast(result);
    if (result.ok) await persist();
    render();
    return;
  }
  if (el.id === 'import-file' && el.files?.[0]) {
    try {
      ui.game = await importFromFile(el.files[0]);
      await persist();
      showToast({ ok: true, message: 'Back-up geladen.' });
      ui.screen = 'overzicht';
    } catch (err) {
      showToast({ ok: false, message: (err as Error).message });
    }
    render();
  }
});

// Sneltoets: spatie = volgende week (behalve in invoervelden)
document.addEventListener('keydown', (e) => {
  if (!ui.game || (e.target as HTMLElement).closest('input, textarea, select')) return;
  if (e.key === 'Escape' && ui.report) {
    ui.report = null;
    ui.screen = 'overzicht';
    render();
    return;
  }
  if (e.key !== ' ' || (e.target as HTMLElement).closest('button')) return;
  e.preventDefault();
  if (ui.report?.phase === 'anim') ui.report.phase = 'report';
  else if (ui.report) {
    ui.report = null;
    ui.screen = 'overzicht';
  }
  else {
    void playWeek().then(render);
    return;
  }
  render();
});

// ---------- Start ----------

(async () => {
  try {
    ui.game = await indexedDbStore.load(SLOT);
  } catch {
    ui.game = null;
  }
  render();
})();
