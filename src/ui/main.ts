import './style.css';
import type { Formation, GamePlan, GameState, Mentality, TaskId, TrainingFocus } from '../engine/types';
import { createNewGame } from '../engine/newGame';
import { advanceWeek } from '../engine/turn';
import * as actions from '../engine/actions';
import type { ActionResult } from '../engine/actions';
import { MATCH_WEEKS, SEASON_END_WEEK, WEEKS_PER_YEAR, WINTER_BREAK, inWinterBreak } from '../engine/calendar';
import { indexedDbStore, exportToFile, importFromFile } from '../storage/save';
import { defaultDraft, setupScreen, type SetupDraft } from './screens/setup';
import { dashboardScreen, todos } from './screens/dashboard';
import { goalsScreen } from './screens/goals';
import { squadScreen, transfersScreen } from './screens/squad';
import { staffScreen } from './screens/staff';
import { sponsorsScreen } from './screens/sponsors';
import { strategyScreen } from './screens/strategy';
import { trainingScreen } from './screens/training';
import { influencesScreen } from './screens/influences';
import { calendarScreen } from './screens/calendar';
import { guideScreen } from './screens/guide';
import { merchScreen } from './screens/merch';
import { horecaScreen } from './screens/horeca';
import { numbersScreen } from './screens/numbers';
import { contractsScreen } from './screens/contracts';
import { VERSION } from '../version';
import { lineupGap } from '../engine/players';
import { animationOverlay, reportOverlay, type WeekRef } from './screens/report';
import { fastForwardOverlay } from './screens/fastforward';
import { canFastForward, playAhead as playAheadEngine, type FastForwardResult } from '../engine/fastforward';
import { openingOverlay } from './screens/opening';
import { momentOverlay } from './screens/moment';
import { museumScreen } from './screens/museum';
import { AMBITIONS, chooseAmbition } from '../engine/opening';
import { answerWeekChoice } from '../engine/weekmoment';
import { strategyTask } from '../engine/delegation';
import { financeScreen } from './screens/finance';
import { pricesScreen, subscriptionInfo } from './screens/prices';
import { clubScreen, eventsScreen, infraScreen, leagueScreen, saveScreen } from './screens/club';
import { initTooltips } from './tooltip';
import { initNumFields } from './numfield';
import { header, playBar } from './header';
import { applyTheme, schemeById } from './theme';
import { impactChips } from './impact';
import { upgradeImpact } from '../engine/impact';
import { esc, euro } from './format';

const SLOT = 'slot1';

type Screen =
  | 'overzicht' | 'ploeg' | 'strategie' | 'transfers' | 'contracten' | 'staff' | 'opleiding'
  | 'kalender' | 'financien' | 'prijzen' | 'sponsors' | 'clubwinkel' | 'horeca' | 'cijfers' | 'evenementen' | 'infrastructuur' | 'club' | 'doelen'
  | 'competitie' | 'invloeden' | 'opslaan' | 'handleiding' | 'museum';

/**
 * Navigatie in groepen: hoofdtabs met subtabs.
 *
 * De oude indeling had één groep "Club" met tien subtabs erin — van je kalender tot je
 * museum. Alles wat niet bij je ploeg hoorde belandde daar, en dus vond je er niets meer
 * terug. Nu groepeert elke tab dingen die je in dezelfde denkbui doet: je elftal, je
 * mensen, je geld, je accommodatie, je competitie.
 */
const GROUPS: { id: string; label: string; screens: [Screen, string][] }[] = [
  { id: 'overzicht', label: 'Bureau', screens: [['overzicht', 'Bureau'], ['kalender', 'Agenda']] },
  { id: 'ploeg', label: 'Ploeg', screens: [['ploeg', 'Selectie'], ['strategie', 'Strategie'], ['transfers', 'Transfers'], ['contracten', 'Contracten']] },
  { id: 'staff', label: 'Personeel', screens: [['staff', 'Personeel en taken'], ['opleiding', 'Opleiding']] },
  { id: 'geld', label: 'Geld', screens: [['financien', 'Financiën'], ['prijzen', 'Tickets en lidgeld'], ['sponsors', 'Sponsors'], ['cijfers', 'Cijfers']] },
  {
    id: 'club',
    label: 'Club',
    screens: [
      ['infrastructuur', 'Infrastructuur'], ['horeca', 'Horeca'], ['clubwinkel', 'Clubwinkel'], ['evenementen', 'Evenementen'],
      ['doelen', 'Doelen'], ['museum', 'Museum'], ['club', 'Clubinfo'],
    ],
  },
  { id: 'competitie', label: 'Competitie', screens: [['competitie', 'Stand en tucht']] },
  { id: 'menu', label: 'Menu', screens: [['handleiding', 'Handleiding'], ['invloeden', 'Wat beïnvloedt wat'], ['opslaan', 'Opslaan en instellingen']] },
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
  statsView: 'seizoen' | 'week';
  menuOpen: boolean;
  selectedStaff: string | null;
  sorts: Record<string, { col: number; dir: 1 | -1 }>;
  report: { phase: 'anim' | 'report'; prev: WeekRef } | null;
  fastForward: FastForwardResult | null; // wat er gebeurde toen je meerdere weken doorspeelde
  animate: boolean;
  lastScreen: Record<string, Screen>; // laatst bezochte subtab per groep
  openTables: Record<string, boolean>; // welke inklapbare tabellen openstaan
  moment: 'dicht' | 'vraag' | 'gevolg'; // popup van het weekmoment
  onboardOpen: boolean; // staat de startlijst open?
  pitchPick: string | null; // wie je op het veld aanklikte om te vervangen
  squadView: 'tabel' | 'kaarten'; // hoe je je kern bekijkt
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
  statsView: 'seizoen',
  menuOpen: false,
  selectedStaff: null,
  sorts: {},
  report: null,
  fastForward: null,
  animate: readPref('vcg-anim', true),
  lastScreen: {},
  openTables: { basis: true, bank: false, out: false },
  moment: 'dicht',
  onboardOpen: false,
  pitchPick: null,
  squadView: readPref('vcg-squad-cards', true) ? 'kaarten' : 'tabel',
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
    case 'overzicht': return dashboardScreen(g, ui.onboardOpen);
    case 'doelen': return goalsScreen(g);
    case 'ploeg': return squadScreen(g, ui.openTables, ui.pitchPick, ui.squadView);
    case 'strategie': return strategyScreen(g);
    case 'opleiding': return trainingScreen(g);
    case 'invloeden': return influencesScreen(g);
    case 'transfers': return transfersScreen(g);
    case 'staff': return staffScreen(g, ui.selectedStaff);
    case 'prijzen': return pricesScreen(g);
    case 'sponsors': return sponsorsScreen(g);
    case 'financien': return financeScreen(g);
    case 'infrastructuur': return infraScreen(g);
    case 'evenementen': return eventsScreen(g);
    case 'competitie': return leagueScreen(g);
    case 'club': return clubScreen(g);
    case 'opslaan': return saveScreen(g, ui.lastSaved, ui.animate);
    case 'kalender': return calendarScreen(g);
    case 'handleiding': return guideScreen(g);
    case 'clubwinkel': return merchScreen(g);
    case 'horeca': return horecaScreen(g);
    case 'cijfers': return numbersScreen(g, ui.statsView);
    case 'contracten': return contractsScreen(g);
    case 'museum': return museumScreen(g);
  }
}

function render(): void {
  const toast = ui.toast ? `<div class="toast ${ui.toast.ok ? '' : 'bad'}" role="status">${esc(ui.toast.text)}</div>` : '';
  const g = ui.game;
  // de clubkleuren staan in het opslagbestand, dus ze moeten bij elke tekening goed staan
  applyTheme(g ? schemeById(g.scheme).colors : schemeById(ui.draft.scheme).colors);
  if (!g) {
    root.innerHTML = `<main class="setup-wrap">${setupScreen(ui.draft)}</main>${toast}`;
    return;
  }
  const gameOver = g.gameOver
    ? `<section class="card attention"><h2>Game over</h2><p>${esc(g.gameOverReason)}</p><p>Je hield het vol tot seizoen ${g.season}, week ${g.week}.</p><button class="primary" data-action="new-game-confirmed">Opnieuw beginnen</button></section>`
    : '';
  const group = groupOf(ui.screen);
  const weekLabel = nextWeekLabel(g);
  const gap = lineupGap(g);
  const ZONES: Record<string, string> = { DOEL: 'doel', VERD: 'verdediging', MIDD: 'middenveld', AANV: 'aanval' };
  const openLines = Object.entries(g.tactics.gaps ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([pos, n]) => `${n}× ${ZONES[pos] ?? pos}`);
  const blocked =
    gap.available < 11
      ? `Je kunt geen elf opstellen: nog maar ${gap.available} speelklare spelers. Ga naar Ploeg › Selectie en haal spelers bij Transfers.`
      : openLines.length
        ? `Je liet plaatsen open in je basiself (${openLines.join(', ')}). Duid bij Ploeg › Selectie zelf iemand aan met de ster, of klik op "Alles loslaten" om je trainer te laten aanvullen.`
        : '';
  const fastWeeks = blocked ? 0 : canFastForward(g);
  // onthouden waar de cursor stond: elke wijziging tekent het scherm opnieuw, en wie net
  // een prijs aan het intikken is mag daar niet uit geduwd worden
  const focused = grabFocus();
  root.innerHTML = `
    <div class="bars">
    ${header(g)}
    <nav class="tabs">${GROUPS.filter((gr) => gr.id !== 'menu')
      .map((gr) => {
        const warn = gr.id === 'ploeg' && blocked ? '<span class="badge" data-tip="Er is een probleem met je selectie">!</span>' : '';
        return `<button class="${gr.id === group.id ? 'on' : ''}" data-action="nav-group" data-id="${gr.id}">${gr.label}${warn}</button>`;
      })
      .join('')}
      <button class="hamburger ${group.id === 'menu' ? 'on' : ''}" data-action="toggle-menu" data-tip="Menu: handleiding en opslaan" aria-label="Menu">☰</button>
    </nav>
    ${
      ui.menuOpen
        ? `<div class="menu-pop">
            <button data-action="nav" data-id="handleiding">📖 Handleiding en veelgestelde vragen</button>
            <button data-action="nav" data-id="invloeden">🔗 Wat beïnvloedt wat</button>
            <button data-action="nav" data-id="opslaan">💾 Opslaan en instellingen</button>
          </div>`
        : ''
    }
    ${group.screens.length > 1 ? `<nav class="subtabs">${group.screens.map(([id, label]) => `<button class="${ui.screen === id ? 'on' : ''}" data-action="nav" data-id="${id}">${label}</button>`).join('')}</nav>` : ''}
    </div>
    <main class="content">${
      inWinterBreak(g.week)
        ? `<section class="card winter"><h2>❄️ Winterstop</h2><p>De competitie ligt stil tot week ${WINTER_BREAK.to + 1}. Geen wedstrijden betekent geen tickets, geen wedstrijdkantine en geen kraampjes; sponsors, lidgelden, lonen en vaste kosten lopen gewoon door. Goede weken om te bouwen, op te leiden of de clubwinkel te laten draaien.</p></section>`
        : ''
    }${blocked ? `<section class="card attention"><h2>Je ploeg is niet compleet</h2><p>${esc(blocked)}</p></section>` : ''}${gameOver}${renderScreen(g)}</main>
    ${playBar(g, { weekLabel, blocked, fastWeeks, busy: ui.busy, open: todos(g).length + (g.weekChoice && !g.weekChoice.answer ? 1 : 0) })}
    <footer class="app-footer"><span class="muted small">Clubeigenaar ${VERSION} · ${esc(g.clubName)} · seizoen ${g.season}, week ${g.week}</span></footer>
    ${ui.fastForward ? fastForwardOverlay(g, ui.fastForward) : ''}
    ${!ui.fastForward && ui.report ? (ui.report.phase === 'anim' ? animationOverlay(g, ui.report.prev) : reportOverlay(g, ui.report.prev)) : ''}
    ${!ui.report && !ui.fastForward && g.opening && !g.opening.done ? openingOverlay(g) : ''}
    ${!ui.report && !ui.fastForward && !(g.opening && !g.opening.done) && ui.moment !== 'dicht' && g.weekChoice ? momentOverlay(g, ui.moment === 'gevolg' ? 'gevolg' : 'vraag') : ''}
    ${toast}`;
  restoreFocus(focused);
  applySorts();
  measureBars();
  rollNumbers();
  if (ui.report?.phase === 'report') revealLines(`${ui.report.prev.season}-${ui.report.prev.week}`);
  if (ui.screen === 'opslaan' && ui.confirmNewGame) {
    const btn = root.querySelector<HTMLButtonElement>('[data-action="new-game"]');
    if (btn) {
      btn.textContent = 'Zeker? Klik nogmaals om te bevestigen';
      btn.dataset.action = 'new-game-confirmed';
    }
  }
}

/** Welk invoerveld had de cursor, en waar stond die in de tekst? */
function grabFocus(): { id: string; start: number | null; end: number | null } | null {
  const el = document.activeElement as HTMLInputElement | null;
  if (!el || !el.id || !el.matches?.('input, select')) return null;
  const text = el.type === 'text' || el.type === 'number';
  return { id: el.id, start: text ? el.selectionStart : null, end: text ? el.selectionEnd : null };
}

/** Na de hertekening de cursor terugzetten waar hij stond. */
function restoreFocus(saved: { id: string; start: number | null; end: number | null } | null): void {
  if (!saved) return;
  const el = document.getElementById(saved.id) as HTMLInputElement | null;
  if (!el) return;
  el.focus({ preventScroll: true });
  if (saved.start !== null && saved.end !== null) {
    try {
      el.setSelectionRange(saved.start, saved.end);
    } catch {
      /* niet elk veldtype laat dat toe */
    }
  }
}

/**
 * Laat de bedragen in het weekrapport oplopen, zoals een teller in een casino.
 * Zet je de animatie uit bij Opslaan, dan staan de cijfers er meteen.
 */
function rollNumbers(): void {
  const targets = [...root.querySelectorAll<HTMLElement>('.roll[data-to]')];
  if (!targets.length) return;
  // let op: signedEuro levert HTML met kleur; hier zetten we platte tekst, de kleur staat al op de cel
  const format = (el: HTMLElement, value: number) => {
    const rounded = Math.round(value);
    return el.dataset.signed === '1' && rounded > 0 ? `+${euro(rounded)}` : euro(rounded);
  };
  if (!ui.animate) {
    for (const el of targets) el.textContent = format(el, Number(el.dataset.to));
    return;
  }
  // post per post: elke regel start iets later en telt in ~650 ms naar zijn eindbedrag
  const stagger = Math.min(205, 1680 / Math.max(1, targets.length));
  const duration = 780;
  const start = performance.now();
  const step = (now: number) => {
    let busy = false;
    targets.forEach((el, i) => {
      const t = Math.min(1, Math.max(0, now - start - i * stagger) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(el, Number(el.dataset.to) * eased);
      if (t >= 1) el.classList.add('landed');
      else busy = true;
    });
    if (busy) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// voor welk weekrapport de regels al binnengerold zijn; zo begint het niet opnieuw bij elke hertekening
let revealedFor = '';

/**
 * Nieuws en "in afwachting" rollen regel per regel binnen (niet letter per letter),
 * samen met de cijfertellers. Staat de animatie uit, dan staat alles er meteen.
 */
function revealLines(key: string): void {
  const lists = [...root.querySelectorAll<HTMLElement>('.report-grid .reveal-lines')];
  if (!lists.length) return;
  const items = lists.flatMap((ul) => [...ul.querySelectorAll<HTMLElement>(':scope > li')]);
  if (!ui.animate || revealedFor === key) {
    for (const li of items) li.classList.add('shown');
    return;
  }
  revealedFor = key;
  for (const ul of lists) ul.classList.add('staged');
  // ongeveer 260 ms per regel: je kunt elke regel lezen terwijl hij verschijnt
  const stagger = Math.min(260, 3200 / Math.max(1, items.length));
  requestAnimationFrame(() => {
    items.forEach((li, i) => {
      window.setTimeout(() => li.classList.add('shown'), 300 + i * stagger);
    });
  });
}

/** Wat er volgende week gebeurt, in de knop zelf. */
function nextWeekLabel(g: GameState): { text: string; tip: string; highlight: boolean } {
  const last = MATCH_WEEKS[MATCH_WEEKS.length - 1];
  const open = g.weekChoice && !g.weekChoice.answer ? ` Let op: "${g.weekChoice.title}" staat nog open op je overzicht — beslis je niet, dan gaat de laatste optie door.` : '';
  if (open && g.week !== last && g.week !== SEASON_END_WEEK && g.week !== WEEKS_PER_YEAR) {
    return { text: 'Volgende week ▶', tip: `Speel de volgende week (spatie).${open}`, highlight: false };
  }
  if (g.week === last) {
    return { text: 'Laatste speeldag ▶', tip: 'De laatste wedstrijd van het seizoen. Daarna vallen de beslissingen over promotie en degradatie.', highlight: true };
  }
  if (g.week === SEASON_END_WEEK) {
    return { text: 'Seizoen afsluiten ▶', tip: 'Deze week wordt de eindstand vastgelegd: kampioen, promotie en degradatie. Je krijgt meteen het seizoensrapport.', highlight: true };
  }
  if (g.week > last && g.week < SEASON_END_WEEK) return { text: 'Volgende week ▶', tip: 'De competitie is gespeeld; de eindafrekening volgt in week ' + SEASON_END_WEEK + '.', highlight: false };
  if (g.week === WEEKS_PER_YEAR) return { text: 'Nieuw seizoen starten ▶', tip: 'Contracten lopen af, de jeugd stroomt door en er komt een nieuwe kalender.', highlight: true };
  return { text: 'Volgende week ▶', tip: 'Speel de volgende week (spatie)', highlight: false };
}

/**
 * Houdt de balken op hun plaats, ook als ze van hoogte veranderen.
 *
 * De kopbalk, de menubalk en de subbalk zitten samen in één `.bars`, en dát ding plakt.
 * Vroeger plakten ze elk apart, elk op de hoogte van de vorige: zodra er één van hoogte
 * veranderde of wegviel, bleef er een band over waar de tabel doorheen schoof. Eén sticky
 * blok kan dat niet, want er is geen afstand meer om verkeerd te rekenen.
 */
function measureBars(): void {
  const set = (name: string, el: Element | null) => document.documentElement.style.setProperty(name, `${el ? Math.round((el as HTMLElement).offsetHeight) : 0}px`);
  set('--topbar-h', root.querySelector('.topbar'));
  set('--tabs-h', root.querySelector('.tabs'));
  set('--bars-h', root.querySelector('.bars'));
  set('--playbar-h', root.querySelector('.playbar'));
}

window.addEventListener('resize', measureBars);

/**
 * Alleen om te weten of je bovenaan staat.
 *
 * De kopbalk kromp hier vroeger mee — kleiner logo, datumregel weg — om hoogte te winnen.
 * Dat is eruit: een balk die onder je handen van vorm verandert kost je meer tijd dan de
 * twintig pixels opleveren, want je zoekt een cijfer dat er net nog stond. Wat overblijft
 * is één schaduwrandje onder de balk zodra er iets achter langs schuift, zodat je ziet
 * dat de balk boven de pagina zweeft en niet erin staat.
 */
function watchScroll(): void {
  const apply = () => {
    document.documentElement.classList.toggle('scrolled', window.scrollY > 48);
    measureBars();
  };
  window.addEventListener('scroll', apply, { passive: true });
  apply();
}

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

/** De tribuneschuifregelaar rekent live mee terwijl je sleept. */
function updateTribuneInfo(): void {
  const g = ui.game;
  const slider = root.querySelector<HTMLInputElement>('#tribune-seats');
  const info = root.querySelector<HTMLElement>('#tribune-info');
  if (!g || !slider || !info) return;
  const seats = Number(slider.value);
  info.innerHTML = `<strong>${seats} plaatsen</strong> · ${euro(actions.tribuneCost(g, seats))}
    <span class="muted">(€${actions.tribunePerSeat(g, seats)} per zitje)</span> · ${actions.tribuneWeeks(seats)} weken bouwtijd`;
  // de gevolgen rekenen mee terwijl je sleept: meer plaatsen is ook meer onderhoud
  const gevolgen = root.querySelector<HTMLElement>('#tribune-impact');
  if (gevolgen) gevolgen.innerHTML = impactChips(upgradeImpact(g, 'tribune', seats), 5);
  const button = root.querySelector<HTMLButtonElement>('[data-action="upgrade"][data-id="tribune"]');
  if (button) button.disabled = g.cash < actions.tribuneCost(g, seats);
}

// inklapbare tabellen: onthouden wat je openliet
root.addEventListener('toggle', (e) => {
  const el = e.target as HTMLDetailsElement;
  if (el?.tagName === 'DETAILS' && el.dataset.table) ui.openTables[el.dataset.table] = el.open;
}, true);

/** De abonnementenschuifregelaar rekent live mee terwijl je sleept. */
function updateSubsInfo(): void {
  const g = ui.game;
  const slider = root.querySelector<HTMLInputElement>('#subs-price');
  const info = root.querySelector<HTMLElement>('#subs-info');
  if (!g || !slider || !info) return;
  info.innerHTML = subscriptionInfo(g, Number(slider.value));
}

root.addEventListener('input', (e) => {
  const live = (e.target as HTMLElement).dataset?.live;
  if (live === 'tribune') updateTribuneInfo();
  if (live === 'subs') updateSubsInfo();
});

// ---------- Een week spelen ----------

let animTimer = 0;

/** Hoe lang de animatie na een week duurt. */
const ANIM_MS = 3600;

async function playWeek(): Promise<void> {
  if (!ui.game || ui.busy || ui.game.gameOver) return;
  // eerst de persconferentie: de zaal zit te wachten
  if (ui.game.opening && !ui.game.opening.done) return;
  ui.busy = true;
  const prev = { week: ui.game.week, season: ui.game.season };
  try {
    ui.game = advanceWeek(ui.game);
  } catch (err) {
    // liever een duidelijke melding dan een knop die niets doet
    ui.busy = false;
    showToast({ ok: false, message: `Er ging iets mis bij het spelen van week ${prev.week}: ${(err as Error).message}. Maak een back-up bij Opslaan en stuur die door.` });
    render();
    return;
  }
  ui.busy = false;
  await persist();
  ui.moment = 'dicht';
  ui.report = { phase: ui.animate ? 'anim' : 'report', prev };
  if (ui.animate) {
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      if (ui.report?.phase === 'anim') {
        ui.report.phase = 'report';
        render();
      }
    }, ANIM_MS);
  }
}

/** Meerdere rustige weken achter elkaar. Stopt zodra er iets is dat jou nodig heeft. */
async function playAhead(): Promise<void> {
  if (!ui.game || ui.busy || ui.game.gameOver) return;
  if (ui.game.opening && !ui.game.opening.done) return;
  if (!canFastForward(ui.game)) return;
  ui.busy = true;
  const from = { week: ui.game.week, season: ui.game.season };
  let result;
  try {
    result = playAheadEngine(ui.game);
  } catch (err) {
    ui.busy = false;
    showToast({ ok: false, message: `Er ging iets mis bij het doorspelen vanaf week ${from.week}: ${(err as Error).message}. Maak een back-up bij Opslaan en stuur die door.` });
    render();
    return;
  }
  ui.game = result.state;
  ui.busy = false;
  await persist();
  ui.moment = 'dicht';
  ui.report = null;
  ui.fastForward = result;
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
  'draft-scheme': (id) => {
    ui.draft.scheme = id;
    applyTheme(schemeById(id).colors); // meteen zien wat je kiest, in het hele scherm
  },
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
      scheme: d.scheme,
      clubName: d.clubName,
    });
    ui.screen = 'overzicht';
    await persist();
  },

  // navigatie
  nav: (id) => {
    ui.screen = id as Screen;
    ui.menuOpen = false;
    ui.lastScreen[groupOf(ui.screen).id] = ui.screen;
    ui.confirmNewGame = false;
  },
  'nav-group': (id) => {
    ui.menuOpen = false;
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
    if (ui.game?.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
  },
  'report-overview': () => {
    ui.report = null;
    ui.screen = 'overzicht';
    if (ui.game?.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
  },
  'week-choice': (id) => {
    if (!ui.game?.weekChoice || ui.game.weekChoice.answer) return;
    const outcome = answerWeekChoice(ui.game, id);
    if (!outcome) return;
    ui.moment = 'gevolg'; // het gevolg verschijnt in hetzelfde venster
    void persist();
  },
  'moment-open': () => void (ui.moment = ui.game?.weekChoice?.answer ? 'gevolg' : 'vraag'),
  'career-goal': (id) => {
    if (!ui.game) return;
    const result = actions.chooseCareerGoal(ui.game, id);
    if (result.ok) void persist();
    return result;
  },
  'moment-close': () => void (ui.moment = 'dicht'),
  'choose-ambition': (id) => {
    if (!ui.game?.opening || ui.game.opening.done) return;
    const def = AMBITIONS.find((a) => a.id === id);
    if (!def) return;
    chooseAmbition(ui.game, def.id);
    void persist();
    return { ok: true, message: `Uitgesproken: "${def.label}". Nu waarmaken.` };
  },

  'toggle-anim': () => {
    ui.animate = !ui.animate;
    writePref('vcg-anim', ui.animate);
    return { ok: true, message: ui.animate ? 'Animatie na elke week staat aan.' : 'Animatie uit: je ziet meteen het weekrapport.' };
  },
  'next-week': async () => {
    await playWeek();
  },
  'fast-forward': async () => {
    await playAhead();
  },
  'ff-close': () => {
    ui.fastForward = null;
    // meteen na het doorspelen kan er een beslissing klaarliggen
    if (ui.game?.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
  },


  sort: (id) => {
    const [table, col] = id.split(':');
    const current = ui.sorts[table];
    const c = Number(col);
    ui.sorts[table] = current && current.col === c ? { col: c, dir: current.dir === 1 ? -1 : 1 } : { col: c, dir: 1 };
  },
  'staff-open': (id) => void (ui.selectedStaff = ui.selectedStaff === id ? null : id),
  'stats-view': (id) => void (ui.statsView = id as 'seizoen' | 'week'),
  'toggle-menu': () => void (ui.menuOpen = !ui.menuOpen),
  'toggle-onboard': () => void (ui.onboardOpen = !ui.onboardOpen),
  'squad-view': (id) => {
    ui.squadView = id === 'tabel' ? 'tabel' : 'kaarten';
    writePref('vcg-squad-cards', ui.squadView === 'kaarten'); // je keuze blijft staan
  },
  // het veld: eerst wie eruit moet aanklikken, dan wie erin komt
  'pitch-pick': (id) => void (ui.pitchPick = ui.pitchPick === id ? null : id),
  'pitch-cancel': () => void (ui.pitchPick = null),

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
  bench: gameAction(actions.toggleBench),
  'auto-lineup': gameAction((g) => {
    ui.pitchPick = null;
    return actions.autoLineup(g);
  }),
  'squad-swap': gameAction((g, inId) => {
    const outId = ui.pitchPick;
    ui.pitchPick = null;
    if (!outId) return { ok: false, message: 'Klik eerst wie eruit moet.' };
    // een lege plaats: er gaat niemand uit, je vult ze gewoon op
    if (outId.startsWith('leeg:')) return actions.toggleStarter(g, inId);
    return actions.swapInLineup(g, outId, inId);
  }),
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
  upgrade: gameAction((g, id) => {
    // bij de tribune bepaalt de schuifregelaar hoeveel plaatsen erbij komen
    const slider = root.querySelector<HTMLInputElement>('#tribune-seats');
    const seats = id === 'tribune' && slider ? Number(slider.value) : undefined;
    return actions.startUpgrade(g, id as Parameters<typeof actions.startUpgrade>[1], seats);
  }),
  event: gameAction(actions.organiseEvent),
  'member-round': gameAction(actions.holdMemberRound),
  'sell-subs': gameAction((g) => {
    const slider = root.querySelector<HTMLInputElement>('#subs-price');
    return actions.sellSubscriptions(g, slider ? slider.value : '0');
  }),

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

// inklapbare tabellen: onthouden wat je openliet
root.addEventListener('toggle', (e) => {
  const el = e.target as HTMLDetailsElement;
  if (el?.tagName === 'DETAILS' && el.dataset.table) ui.openTables[el.dataset.table] = el.open;
}, true);

root.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'draft-name') ui.draft.name = el.value; // geen render: anders verlies je de cursor
  if (el.id === 'draft-clubname') ui.draft.clubName = el.value;
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
  'delegate-task': (g, v, id) => {
    const result = actions.delegateTask(g, id as TaskId, v || null);
    if (result.ok) strategyTask(g); // de trainer bereidt meteen voor
    return result;
  },
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
  if (e.key === 'Escape' && (ui.report || ui.fastForward)) {
    ui.report = null;
    if (ui.fastForward) {
      ui.fastForward = null;
      if (ui.game.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
    }
    ui.screen = 'overzicht';
    render();
    return;
  }
  if (e.key !== ' ' || (e.target as HTMLElement).closest('button')) return;
  e.preventDefault();
  if (ui.fastForward) {
    ui.fastForward = null;
    if (ui.game.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
  }
  else if (ui.report?.phase === 'anim') ui.report.phase = 'report';
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
  // eenmalig: tooltips en getalvelden werken met delegatie, dus ze overleven elke hertekening
  initTooltips();
  initNumFields();
  watchScroll();
  try {
    ui.game = await indexedDbStore.load(SLOT);
  } catch {
    ui.game = null;
  }
  render();
})();
