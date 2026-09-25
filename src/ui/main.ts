import './style.css';
import { attachBrowserLog } from '../log/browser';
import type { Formation, GamePlan, GameState, Mentality, SponsorDeal, StaffRole, TaskId, TrainingFocus } from '../engine/types';

type SponsorKind = SponsorDeal['kind'];
import { createNewGame } from '../engine/newGame';
import { advanceWeek } from '../engine/turn';
import { TOUR_CHAPTERS, rememberDoneSteps, tourChapter, tourFlags, tourMarkSeen, tourStepDone } from '../engine/tour';
import * as actions from '../engine/actions';
import type { ActionResult } from '../engine/actions';
import { MATCH_WEEKS, SEASON_END_WEEK, WEEKS_PER_YEAR, WINTER_BREAK, inWinterBreak } from '../engine/calendar';
import { indexedDbStore, exportToFile, importFromFile } from '../storage/save';
import { defaultDraft, setupScreen, type SetupDraft } from './screens/setup';
import { changesScreen, hasUnseenChanges } from './screens/changes';
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
import { lineupGap, squadBlock } from '../engine/players';
import { ANIM_MATCH_MS, ANIM_T, ANIM_WEEK_MS, animationOverlay, reportOverlay, type WeekRef } from './screens/report';
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
import { sortRows } from './tablesort';
import { upgradeImpact } from '../engine/impact';
import { esc, euro } from './format';

const SLOT = 'slot1';

type Screen =
  | 'overzicht' | 'ploeg' | 'strategie' | 'transfers' | 'contracten' | 'staff' | 'opleiding'
  | 'nieuw' | 'kalender' | 'financien' | 'prijzen' | 'sponsors' | 'clubwinkel' | 'horeca' | 'cijfers' | 'evenementen' | 'infrastructuur' | 'club' | 'doelen'
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
  { id: 'menu', label: 'Menu', screens: [['handleiding', 'Handleiding'], ['invloeden', 'Wat beïnvloedt wat'], ['nieuw', 'Wat is er nieuw'], ['opslaan', 'Opslaan en instellingen']] },
];

const groupOf = (screen: Screen) => GROUPS.find((g) => g.screens.some(([id]) => id === screen))!;

interface UiState {
  game: GameState | null;
  screen: Screen;
  draft: SetupDraft;
  toast: { text: string; ok: boolean; viering?: { icon: string; kop: string; sub?: string } } | null;
  lastSaved: string;
  confirmNewGame: boolean;
  busy: boolean;
  highlight: string;
  statsView: 'seizoen' | 'week';
  menuOpen: boolean;
  selectedStaff: string | null;
  /** Rolfilter op de kandidatenlijst (Personeel) en plaatsfilter op Sponsors: klik op een
   *  functie of tegel om te filteren, nog eens (of op het kruisje) om hem weg te halen. */
  staffFilter: StaffRole | null;
  sponsorFilter: SponsorKind | null;
  sorts: Record<string, { col: number; dir: 1 | -1 }>;
  report: { phase: 'anim' | 'report'; prev: WeekRef } | null;
  /**
   * De stand die de kopbalk nog toont zolang het weekverslag (of de animatie ervoor)
   * openstaat. Zonder dit sprong je saldo in de kopbalk al naar het nieuwe bedrag op het
   * moment dat je op "Volgende week" klikte — je las de uitkomst van de week vóór het
   * verslag ze kon vertellen. De kopbalk loopt nu pas bij wanneer jij het verslag sluit.
   */
  held: GameState | null;
  /** Het anker (data-tour-doel) dat na de volgende hertekening de rondleidingswijzer
   *  krijgt: een stuiterend handje plus een omlijning op de plek waar je moet zijn.
   *  Elke andere klik haalt hem weer weg. */
  tourAim: string | null;
  /** Ben je via een rondleidingsstap naar een scherm gebracht? Dan hangt er in de
   *  speelbalk een terugweg naar het Bureau, tot je daar weer bent. */
  tourLoop: boolean;
  /** De bevestigingspopup voor een ingrijpende beslissing: welke actie, en met welke uitleg. */
  confirmAction: { action: string; id: string; title: string; body: string; verb: string } | null;
  /** De versie die de server draait als die nieuwer is dan deze bundle: dan staat er een
   *  banner "ververs". Een open tabblad draait anders wekenlang stil een oude versie door. */
  updateAvailable: string | null;
  fastForward: FastForwardResult | null; // wat er gebeurde toen je meerdere weken doorspeelde
  animate: boolean;
  lastScreen: Record<string, Screen>; // laatst bezochte subtab per groep
  openTables: Record<string, boolean>; // welke inklapbare tabellen openstaan
  moment: 'dicht' | 'vraag' | 'gevolg'; // popup van het weekmoment
  pitchPick: string | null; // wie je op het veld aanklikte om te vervangen
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
  staffFilter: null,
  sponsorFilter: null,
  sorts: {},
  report: null,
  held: null,
  tourAim: null,
  tourLoop: false,
  confirmAction: null,
  updateAvailable: null,
  fastForward: null,
  animate: readPref('vcg-anim', true),
  lastScreen: {},
  openTables: { basis: true, bank: false, out: false },
  moment: 'dicht',
  pitchPick: null,
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
  ui.toast = { text: result.message, ok: result.ok, viering: result.ok ? result.viering : undefined };
  window.clearTimeout((showToast as unknown as { t?: number }).t);
  // een feestje mag iets langer blijven hangen dan een gewone melding
  (showToast as unknown as { t?: number }).t = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, ui.toast.viering ? 5000 : 3500);
}

/** Handtekeningen en contracten verdienen meer dan een grijze regel: een feesttoast met
 *  een handvol confettisnippers. De snippers zijn pure CSS; wie animaties uitzette in
 *  Opslaan krijgt dezelfde kaart zonder gedwarrel. */
function toastHtml(): string {
  if (!ui.toast) return '';
  const v = ui.toast.viering;
  if (!v) return `<div class="toast ${ui.toast.ok ? '' : 'bad'}" role="status">${esc(ui.toast.text)}</div>`;
  const snippers = ui.animate ? `<span class="snippers" aria-hidden="true">${'<i></i>'.repeat(14)}</span>` : '';
  return `<div class="toast feest" role="status">${snippers}<span class="feest-icon">${v.icon}</span><span class="feest-tekst"><b>${esc(v.kop)}</b>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}</span></div>`;
}

/** Kijk-stappen van de rondleiding: een bezoek aan het scherm is genoeg. */
function markTourSeen(): void {
  if (ui.game && tourMarkSeen(ui.game, ui.screen)) void persist();
}

/**
 * Vinkt een klik een rondleidingsstap af, dan hoor je dat meteen — anders mist wie niet
 * toevallig op zijn Bureau staat de hele vooruitgang. Geeft de toast-tekst terug, of null.
 */
function tourMelding(voor: ReturnType<typeof tourFlags>): string | null {
  if (!ui.game || !voor) return null;
  const nu = tourFlags(ui.game);
  if (!nu || nu.nr !== voor.nr) return null; // hoofdstuk wisselde (weekwissel): dan geen stap-toast
  if (!nu.flags.some((f, i) => f && !voor.flags[i])) return null;
  const rest = nu.flags.filter((f) => !f).length;
  return rest
    ? `📚 Stap afgevinkt! Nog ${rest === 1 ? 'één stap' : `${rest} stappen`} in dit hoofdstuk — je vindt ze op je Bureau.`
    : `📚 Hoofdstuk "${TOUR_CHAPTERS[nu.nr - 1].title}" is helemaal klaar. Volgende week ligt het volgende voor je klaar.`;
}

function renderScreen(g: GameState): string {
  switch (ui.screen) {
    case 'overzicht': return dashboardScreen(g);
    case 'doelen': return goalsScreen(g);
    case 'ploeg': return squadScreen(g, ui.openTables, ui.pitchPick);
    case 'strategie': return strategyScreen(g);
    case 'opleiding': return trainingScreen(g);
    case 'invloeden': return influencesScreen(g);
    case 'transfers': return transfersScreen(g);
    case 'staff': return staffScreen(g, ui.selectedStaff, ui.staffFilter);
    case 'prijzen': return pricesScreen(g);
    case 'sponsors': return sponsorsScreen(g, ui.sponsorFilter);
    case 'financien': return financeScreen(g);
    case 'infrastructuur': return infraScreen(g);
    case 'evenementen': return eventsScreen(g);
    case 'competitie': return leagueScreen(g);
    case 'club': return clubScreen(g);
    case 'opslaan': return saveScreen(g, ui.lastSaved, ui.animate);
    case 'nieuw': return changesScreen();
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
  const toast = toastHtml();
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
    squadBlock(g) ??
    (gap.available < 11
      ? `Je kunt geen elf opstellen: nog maar ${gap.available} speelklare spelers. Ga naar Ploeg › Selectie en haal spelers bij Transfers.`
      : openLines.length
        ? `Je liet plaatsen open in je basiself (${openLines.join(', ')}). Duid bij Ploeg › Selectie zelf iemand aan met de ster, of klik op "Alles loslaten" om je trainer te laten aanvullen.`
        : '');
  const fastWeeks = blocked ? 0 : canFastForward(g);
  // onthouden waar de cursor stond: elke wijziging tekent het scherm opnieuw, en wie net
  // een prijs aan het intikken is mag daar niet uit geduwd worden
  const focused = grabFocus();
  const updateBanner = ui.updateAvailable
    ? `<div class="update-banner" role="status">Er staat een nieuwe versie klaar (${esc(ui.updateAvailable)}, jij speelt ${VERSION}). Je spel is opgeslagen.
        <button class="sm primary" data-action="reload">Ververs de pagina</button></div>`
    : '';
  root.innerHTML = `${updateBanner}
    <div class="bars">
    ${header(ui.report && ui.held ? ui.held : g)}
    <nav class="tabs">${GROUPS.filter((gr) => gr.id !== 'menu')
      .map((gr) => {
        const warn = gr.id === 'ploeg' && blocked ? '<span class="badge" data-tip="Er is een probleem met je selectie">!</span>' : '';
        return `<button class="${gr.id === group.id ? 'on' : ''}" data-action="nav-group" data-id="${gr.id}">${gr.label}${warn}</button>`;
      })
      .join('')}
      <button class="hamburger ${group.id === 'menu' ? 'on' : ''}" data-action="toggle-menu" data-tip="Menu: handleiding, wat is er nieuw, en opslaan" aria-label="Menu">☰${hasUnseenChanges() ? '<span class="menu-stip" aria-label="nieuwe wijzigingen"></span>' : ''}</button>
    </nav>
    ${
      ui.menuOpen
        ? `<div class="menu-pop">
            <button data-action="nav" data-id="handleiding">📖 Handleiding en veelgestelde vragen</button>
            <button data-action="nav" data-id="invloeden">🔗 Wat beïnvloedt wat</button>
            <button data-action="nav" data-id="nieuw">🆕 Wat is er nieuw${hasUnseenChanges() ? ' <span class="menu-stip"></span>' : ''}</button>
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
    ${playBar(g, {
      weekLabel,
      blocked,
      fastWeeks,
      busy: ui.busy,
      open: todos(g).length + (g.weekChoice && !g.weekChoice.answer ? 1 : 0),
      urgent: todos(g).some((t) => t.level === 'urgent'),
      tourLoop: ui.tourLoop && ui.screen !== 'overzicht' && !!tourChapter(g),
      thuis: ui.screen === 'overzicht',
      tourReady: (() => {
        const t = tourChapter(g);
        return !!t && t.chapter.steps.every((_, i) => tourStepDone(g, t.nr - 1, i));
      })(),
    })}
    <footer class="app-footer"><span class="muted small">Clubeigenaar ${VERSION} · ${esc(g.clubName)} · seizoen ${g.season}, week ${g.week}</span></footer>
    ${ui.fastForward ? fastForwardOverlay(g, ui.fastForward) : ''}
    ${!ui.fastForward && ui.report ? (ui.report.phase === 'anim' ? animationOverlay(g, ui.report.prev) : reportOverlay(g, ui.report.prev)) : ''}
    ${!ui.report && !ui.fastForward && g.opening && !g.opening.done ? openingOverlay(g) : ''}
    ${!ui.report && !ui.fastForward && !(g.opening && !g.opening.done) && ui.moment !== 'dicht' && g.weekChoice ? momentOverlay(g, ui.moment === 'gevolg' ? 'gevolg' : 'vraag') : ''}
    ${
      ui.confirmAction
        ? `<div class="overlay confirm-overlay" data-action="confirm-no">
            <div class="confirm-card" role="alertdialog" aria-modal="true" aria-label="${esc(ui.confirmAction.title)}" data-action="noop">
              <h2>${esc(ui.confirmAction.title)}</h2>
              ${ui.confirmAction.body ? `<p class="small">${esc(ui.confirmAction.body)}</p>` : ''}
              <div class="confirm-btns">
                <button data-action="confirm-no">Annuleren</button>
                <button class="danger-solid" data-action="confirm-yes">${esc(ui.confirmAction.verb)}</button>
              </div>
            </div>
          </div>`
        : ''
    }
    ${toast}`;
  restoreFocus(focused);
  // Staat er een venster open, dan zit de tooltip rechtsonder precies voor de knop van dat
  // venster. Hij wijkt dan uit naar links; de stylesheet regelt de rest.
  document.documentElement.classList.toggle('overlay-open', !!root.querySelector('.overlay, .moment-overlay'));
  applySorts();
  measureBars();
  rollNumbers();
  driveMatchClock();
  if (ui.report?.phase === 'report') revealLines(`${ui.report.prev.season}-${ui.report.prev.week}`);
  if (getekendScherm !== ui.screen) {
    window.scrollTo(0, 0);
    getekendScherm = ui.screen;
  }
  // een sprong naar een speler: naar zijn rij scrollen en hem even laten oplichten
  if (ui.highlight) {
    const doel = root.querySelector(`[data-speler="${ui.highlight}"]`);
    if (doel) {
      doel.classList.add('flits');
      doel.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      ui.highlight = '';
    }
  }
  if (ui.tourAim) root.querySelector(`[data-tour-doel="${ui.tourAim}"]`)?.classList.add('tour-doel');
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

// het scherm dat nu getekend staat: wissel je van scherm, dan begin je bovenaan —
// anders landde je (bijvoorbeeld via de Bureau-knop) midden in de vorige scrollpositie
let getekendScherm: Screen | null = null;

/**
 * Nieuws en "in afwachting" rollen regel per regel binnen (niet letter per letter),
 * samen met de cijfertellers. Staat de animatie uit, dan staat alles er meteen.
 */
function revealLines(key: string): void {
  const lists = [...root.querySelectorAll<HTMLElement>('.report-grid .reveal-lines')];
  const kaarten = [...root.querySelectorAll<HTMLElement>('.report-grid .viering-kaart')];
  if (!lists.length && !kaarten.length) return;
  const items = lists.flatMap((ul) => [...ul.querySelectorAll<HTMLElement>(':scope > li')]);
  if (!ui.animate || revealedFor === key) {
    for (const li of items) li.classList.add('shown');
    // de feestkaartjes staan er dan meteen, zonder pop-in — ook bij een hertekening,
    // anders vieren ze hetzelfde succes bij elke klik opnieuw
    for (const k of kaarten) k.classList.add('meteen');
    return;
  }
  revealedFor = key;
  for (const ul of lists) ul.classList.add('staged');
  // ongeveer 260 ms per regel, en pas nádat de cijfertellers hun werk deden: eerst het
  // geld dat binnenrolt, dan de nieuwsflitsen — dezelfde volgorde als de spanning
  const stagger = Math.min(260, 3200 / Math.max(1, items.length));
  requestAnimationFrame(() => {
    items.forEach((li, i) => {
      window.setTimeout(() => li.classList.add('shown'), 1500 + i * stagger);
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
    // het eigenlijke sorteren staat in tablesort.ts, zodat het te testen is zonder browser
    for (const row of sortRows([...body.rows], sort.col, sort.dir)) body.appendChild(row);
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

/** Wat je in het veld typt, staat in het veld — niet in de spelstand. */
function bodVoor(soort: 'verlengen' | 'kopen', playerId: string): number {
  const veld = document.getElementById(`huur-${soort}-${playerId}`) as HTMLInputElement | null;
  return Number(String(veld?.value ?? '0').replace(',', '.'));
}

/**
 * De kans dat de eigenaar ja zegt, rekent mee terwijl je aan het bedrag draait.
 *
 * Anders zie je pas na het klikken wat je bod waard was, en dat is precies het moment waarop
 * je het niet meer kunt veranderen.
 */
function updateLoanChances(): void {
  const g = ui.game;
  if (!g) return;
  for (const el of root.querySelectorAll<HTMLElement>('.lk-kans')) {
    const [, soort, ...rest] = el.id.split('-');
    const playerId = rest.join('-');
    const speler = g.players.find((p) => p.id === playerId);
    if (!speler || (soort !== 'verlengen' && soort !== 'kopen')) continue;
    const kans = actions.loanRequestChance(g, speler, soort, bodVoor(soort, playerId));
    el.textContent = `${Math.round(kans * 100)}% kans`;
    el.classList.toggle('good', kans >= 0.6);
    el.classList.toggle('bad', kans < 0.25);
  }
}

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
  if (live === 'huur') updateLoanChances();
});

// ---------- Een week spelen ----------

let animTimer = 0;
/** Wanneer de animatie startte: de lopende wedstrijdklok rekent hiermee, ook na een hertekening. */
let animStartedAt = 0;

async function playWeek(): Promise<void> {
  if (!ui.game || ui.busy || ui.game.gameOver) return;
  // eerst de persconferentie: de zaal zit te wachten
  if (ui.game.opening && !ui.game.opening.done) return;
  ui.busy = true;
  const prev = { week: ui.game.week, season: ui.game.season };
  const voordien = ui.game; // de kopbalk blijft dit tonen tot het verslag gesloten is
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
  ui.held = voordien;
  if (ui.animate) {
    // een wedstrijdweek krijgt de langere tijdlijn (klok, rust, wissels); een gewone week de korte balk
    const m = ui.game.lastMatch;
    const metTijdlijn = !!(m && m.week === prev.week && m.moments && !m.forfeit);
    animStartedAt = performance.now();
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      if (ui.report?.phase === 'anim') {
        ui.report.phase = 'report';
        render();
      }
    }, metTijdlijn ? ANIM_MATCH_MS : ANIM_WEEK_MS);
  }
}

/**
 * De lopende wedstrijdklok in de animatie: telt de eerste helft naar 45, valt stil op
 * "Rust", telt de tweede helft naar 90 en blijft daar staan bij het affluiten. Rekent
 * vanaf animStartedAt, dus een hertekening onderweg zet de klok niet terug.
 */
let clockToken = 0;
function driveMatchClock(): void {
  const el = root.querySelector<HTMLElement>('.match-clock');
  clockToken++;
  if (!el || ui.report?.phase !== 'anim') return;
  const token = clockToken;
  const tick = () => {
    if (token !== clockToken || !el.isConnected) return;
    const t = (performance.now() - animStartedAt) / 1000;
    if (t < ANIM_T.start) el.textContent = "1'";
    else if (t < ANIM_T.h1) el.textContent = `${Math.min(45, Math.round(1 + ((t - ANIM_T.start) / (ANIM_T.h1 - ANIM_T.start)) * 44))}'`;
    else if (t < ANIM_T.h2) el.textContent = 'Rust';
    else if (t < ANIM_T.end) el.textContent = `${Math.min(90, Math.round(46 + ((t - ANIM_T.h2) / (ANIM_T.end - ANIM_T.h2)) * 44))}'`;
    else if (t < ANIM_T.fin) el.textContent = "90'";
    else {
      el.textContent = el.dataset.fin ?? "90'";
      el.classList.add('af');
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
  ui.held = null;
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
    if (ui.screen === 'overzicht') ui.tourLoop = false;
    markTourSeen();
  },
  'nav-group': (id) => {
    ui.menuOpen = false;
    const gr = GROUPS.find((x) => x.id === id)!;
    ui.screen = ui.lastScreen[gr.id] ?? gr.screens[0][0];
    ui.confirmNewGame = false;
    if (ui.screen === 'overzicht') ui.tourLoop = false;
    markTourSeen();
  },
  // een rondleidingsstap: navigeren én de wijzer zetten op de plek waar je moet zijn
  'tour-go': (id) => {
    const [scherm, aim] = id.split(':');
    ui.screen = scherm as Screen;
    ui.menuOpen = false;
    ui.lastScreen[groupOf(ui.screen).id] = ui.screen;
    ui.tourAim = aim || null;
    ui.tourLoop = true;
    markTourSeen();
  },
  // "Ik ken het spel al": komt hier via de bevestigingspopup, dus dit is al de ja-klik
  'tour-hide': () => {
    if (!ui.game?.tour) return;
    ui.game.tour.hidden = true;
    ui.tourLoop = false;
    void persist();
    return { ok: true, message: 'De rondleiding is weg. Veel plezier — je kent de weg.' };
  },
  'skip-anim': () => {
    if (ui.report) ui.report.phase = 'report';
  },
  // Sluiten laat je staan waar je was; de knop rechtsonder brengt je naar je bureau. Ze
  // deden allebei precies hetzelfde — rapport weg en naar het overzicht — en dan heeft een
  // tweede knop geen bestaansreden. Wie midden in zijn selectie zat, wil daar terug.
  'close-report': () => {
    ui.report = null;
  ui.held = null;
    if (ui.game?.weekChoice && !ui.game.weekChoice.answer) ui.moment = 'vraag';
  },
  'report-overview': () => {
    ui.report = null;
  ui.held = null;
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
  'no-extend': gameAction(actions.toggleNoExtend),
  // "alles gezien": de badges uit en de stip op het menu doven, per toestel onthouden
  'changes-seen': () => {
    try {
      localStorage.setItem('vcg-gezien-versie', VERSION);
    } catch {
      /* geen opslag: dan blijft de stip gewoon staan */
    }
    return { ok: true, message: `Bijgewerkt: alles tot en met ${VERSION} staat als gezien.` };
  },
  'goto-contracts': (id) => {
    ui.screen = 'contracten';
    ui.lastScreen.ploeg = 'contracten';
    ui.highlight = id;
  },
  // vanuit een bod (of waar ook) rechtstreeks naar de speler in je kernlijst springen
  'goto-speler': (id) => {
    ui.screen = 'ploeg';
    ui.lastScreen.ploeg = 'ploeg';
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
  reload: () => {
    window.location.reload();
  },
  'confirm-no': () => {
    ui.confirmAction = null;
  },
  'confirm-yes': async () => {
    const c = ui.confirmAction;
    ui.confirmAction = null;
    if (!c) return;
    const handler = handlers[c.action];
    return handler ? await handler(c.id) : undefined;
  },
  'staff-filter': (id) => {
    ui.staffFilter = ui.staffFilter === id ? null : (id as StaffRole);
  },
  'sponsor-filter': (id) => {
    ui.sponsorFilter = ui.sponsorFilter === id ? null : (id as SponsorKind);
  },
  hire: gameAction(actions.hireStaff),
  'hire-replace': gameAction(actions.replaceStaff),
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
  'sponsor-ask-reset': gameAction((g, id) => actions.resetSponsorAsk(g, id as Parameters<typeof actions.resetSponsorAsk>[1])),
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
  'loan-extend': gameAction((g, id) => actions.extendLoan(g, id, bodVoor('verlengen', id))),
  'loan-buy': gameAction((g, id) => actions.buyLoanPlayer(g, id, bodVoor('kopen', id))),
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
  // Ingrijpende knoppen — stopzetten, ontslaan, wegsturen, verkopen — openen eerst een
  // kleine bevestigingspopup met de vraag en de gevolgen. Dat is het patroon dat iedereen
  // kent; een dubbelklik-op-dezelfde-knop bleek dat niet.
  if (target.dataset.confirm) {
    ui.confirmAction = {
      action: target.dataset.action!,
      id: target.dataset.id ?? '',
      title: target.dataset.confirm,
      body: (target.dataset.tip ?? '').replace(/^Ingrijpend: /, '').replace(/^./, (c) => c.toUpperCase()),
      verb: (target.textContent ?? 'Doorgaan').trim(),
    };
    render();
    return;
  }
  const handler = handlers[target.dataset.action!];
  if (!handler) return;
  if (target.dataset.action !== 'tour-go') ui.tourAim = null; // elke andere klik haalt de wijzer weg
  const tourVoor = ui.game ? tourFlags(ui.game) : null;
  const result = await handler(target.dataset.id ?? '');
  if (ui.game) rememberDoneSteps(ui.game);
  const melding = tourMelding(tourVoor);
  if (result) {
    // een feesttoast laten we met rust; een gewone toast krijgt de vooruitgang erbij
    showToast(melding && result.ok && !result.viering ? { ...result, message: `${result.message} ${melding}` } : result);
    if (result.ok && ui.game) await persist();
  } else if (melding) {
    showToast({ ok: true, message: melding });
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
  'sponsor-ask': (g, v, id) => actions.setSponsorAsk(g, id as Parameters<typeof actions.setSponsorAsk>[1], Number(v)),
};

root.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  const key = el.dataset?.change;
  if (key && changeHandlers[key] && ui.game) {
    const tourVoor = tourFlags(ui.game);
    const result = changeHandlers[key](ui.game, el.value, el.dataset.id ?? '');
    rememberDoneSteps(ui.game);
    const melding = tourMelding(tourVoor);
    showToast(melding && result.ok ? { ...result, message: `${result.message} ${melding}` } : result);
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
  if (e.key === 'Escape' && ui.confirmAction) {
    ui.confirmAction = null;
    render();
    return;
  }
  if (e.key === 'Escape' && (ui.report || ui.fastForward)) {
    ui.report = null;
  ui.held = null;
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
  ui.held = null;
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
  // Het logboek van de motor gaat altijd naar de console van je browser. In een gebouwde
  // productieversie ook naar functions/api/log.ts, zodat jij als eigenaar van het project kunt
  // meekijken. Tijdens `npm run dev` bestaat dat pad niet — daar blijft het bij de console, zodat
  // lokaal testen niet tussen de regels van echte spelers terechtkomt.
  attachBrowserLog({ level: 'debug', endpoint: import.meta.env.PROD ? '/api/log' : null });
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

// ---------- Nieuwe versie klaar? ----------
//
// Een browsertabblad draait de bundle die het bij het openen laadde, en blijft dat doen —
// ook dagen na een deploy (Safari zet een tabblad zelfs terug zonder herladen). De server
// zelf weet wél welke versie er staat: /api/version. We kijken er elke vijf minuten naar,
// en meteen wanneer je naar het tabblad terugkeert; verschilt het van deze bundle, dan
// verschijnt bovenaan een banner met een ververs-knop. Alleen in productie: tijdens
// npm run dev is "de server" gewoon deze code zelf.
async function checkForUpdate(): Promise<void> {
  try {
    const r = await fetch('/api/version', { cache: 'no-store' });
    if (!r.ok) return;
    const { version } = (await r.json()) as { version?: string };
    if (version && version !== VERSION && ui.updateAvailable !== version) {
      ui.updateAvailable = version;
      render();
    }
  } catch {
    /* offline of onderweg: dan proberen we het straks gewoon opnieuw */
  }
}

if (import.meta.env.PROD) {
  window.setInterval(checkForUpdate, 5 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
}
