// De kopbalk.
//
// Wat er stond was een etalage: vijf kerncijfers, drie clubscores en een datum, netjes
// naast elkaar en nergens klikbaar zonder ergens anders te belanden. Sinds het dashboard
// die cijfers groot toont, stond alles er twee keer.
//
// Wat een kopbalk wél moet doen, doet hij nu: zeggen wáár in het jaar je staat, en je
// laten verderspelen. De seizoensbalk is het nieuwe stuk. Die toont de 52 weken in één
// streep, met elke speeldag als streepje, de winterstop en de transferperiodes als band,
// en een merkteken waar jij staat. Daarmee zie je zonder na te denken of het venster nog
// open is, hoeveel weken je nog hebt tot de volgende match en wanneer de rust komt —
// precies de dingen waar je beslissingen van afhangen.

import type { GameState } from './../engine/types';
import { MATCH_WEEKS, SEASON_END_WEEK, WEEKS_PER_YEAR, WINTER_BREAK, formatDateLong, inWinterBreak, isTransferWindow, seasonLabel, seasonPhase } from '../engine/calendar';
import { DIVISIONS } from '../engine/data/divisions';
import { OWN_TEAM_ID } from '../engine/league';
import { esc, euro } from './format';
import { tipAttr } from './tooltip';
import { type CrestShape, clubInitials, crestSvg } from './crest';
import { START_CLUBS } from '../engine/data/setup';

/** De transferperiodes, afgeleid uit dezelfde functie waarmee de engine rekent. */
function windows(): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let start: number | null = null;
  for (let w = 1; w <= WEEKS_PER_YEAR; w++) {
    const open = isTransferWindow(w);
    if (open && start === null) start = w;
    if (!open && start !== null) {
      out.push({ from: start, to: w - 1 });
      start = null;
    }
  }
  if (start !== null) out.push({ from: start, to: WEEKS_PER_YEAR });
  return out;
}

const pct = (week: number) => ((week - 1) / (WEEKS_PER_YEAR - 1)) * 100;
const span = (from: number, to: number) => ({ left: pct(from), width: pct(to) - pct(from) + 100 / (WEEKS_PER_YEAR - 1) });

/** Hoeveel weken tot de eerstvolgende wedstrijd van jouw ploeg. */
function weeksToMatch(s: GameState): { week: number; weeks: number } | null {
  const next = s.league.fixtures
    .filter((f) => f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .sort((a, b) => a.week - b.week)[0];
  return next ? { week: next.week, weeks: next.week - s.week } : null;
}

/**
 * De seizoensbalk. Eén streep van week 1 tot week 52 met alles erop wat je tempo bepaalt.
 */
export function seasonStrip(s: GameState): string {
  const winter = span(WINTER_BREAK.from, WINTER_BREAK.to);
  const match = weeksToMatch(s);

  const bands = windows()
    .map((w) => {
      const b = span(w.from, w.to);
      return `<span class="band window" style="left:${b.left}%;width:${b.width}%" ${tipAttr(
        `Transferperiode: week ${w.from} tot en met ${w.to}. Alleen dan kun je spelers kopen, verkopen of uitlenen.`,
        'Transferperiode',
      )}></span>`;
    })
    .join('');

  const ticks = MATCH_WEEKS.map((w, i) => {
    const played = w < s.week;
    return `<span class="tick ${played ? 'played' : ''}" style="left:${pct(w)}%" ${tipAttr(`Speeldag ${i + 1} van ${MATCH_WEEKS.length}, in week ${w}.`)}></span>`;
  }).join('');

  const playedDays = MATCH_WEEKS.filter((w) => w < s.week).length;

  return `<div class="season-strip">
    <div class="strip-rail" ${tipAttr(
      `De 52 weken van het seizoen. Elk streepje is een speeldag, de grijze band is de winterstop (week ${WINTER_BREAK.from} tot ${WINTER_BREAK.to}) en de groene banden zijn de transferperiodes. Het merkteken is waar jij staat.`,
      'Het seizoen in één streep',
    )}>
      <span class="band winter" style="left:${winter.left}%;width:${winter.width}%" ${tipAttr(
        `Winterstop: week ${WINTER_BREAK.from} tot en met ${WINTER_BREAK.to}. Geen wedstrijden, dus geen tickets, wedstrijdkantine of kraampjes — de vaste kosten lopen wel door.`,
        'Winterstop',
      )}></span>
      ${bands}
      <span class="band done" style="width:${pct(s.week)}%"></span>
      ${ticks}
      <span class="here" style="left:${pct(s.week)}%" ${tipAttr(`Je staat in week ${s.week} van ${WEEKS_PER_YEAR}.`, 'Vandaag')}></span>
      <span class="end" style="left:${pct(SEASON_END_WEEK)}%" ${tipAttr(
        `Week ${SEASON_END_WEEK}: de eindstand valt, met promotie en degradatie.`,
        'Einde competitie',
      )}></span>
    </div>
    <div class="strip-legend small">
      <span>week <strong>${s.week}</strong>/${WEEKS_PER_YEAR}</span>
      ${playedDays ? `<span>speeldag <strong>${playedDays}</strong>/${MATCH_WEEKS.length}</span>` : ''}
      ${
        match
          ? `<span>${match.weeks === 0 ? '<strong>wedstrijd deze week</strong>' : `volgende match over <strong>${match.weeks}</strong> ${match.weeks === 1 ? 'week' : 'weken'}`}</span>`
          : '<span>geen wedstrijden meer</span>'
      }
      ${isTransferWindow(s.week) ? '<span class="tag">transferperiode open</span>' : ''}
      ${inWinterBreak(s.week) ? '<span class="tag winter-tag">❄️ winterstop</span>' : ''}
    </div>
  </div>`;
}

export interface HeaderOpts {
  weekLabel: { text: string; tip: string; highlight: boolean };
  blocked: string;
  fastWeeks: number;
  busy: boolean;
}

/**
 * De hele kopbalk. Drie stukken: wie je bent, waar je staat in het jaar, en wat je nu
 * kunt doen. Verder niets — de cijfers staan op het dashboard, waar ze groot mogen zijn.
 */
export function header(g: GameState, o: HeaderOpts): string {
  const division = DIVISIONS[g.league.divisionLevel];
  const colors = (START_CLUBS.find((c) => c.id === g.clubId)?.colors ?? ['#1f7a3c', '#ffffff']) as [string, string];
  const nextTip = o.blocked
    ? o.blocked
    : o.fastWeeks >= 2
      ? `Speelt ${o.fastWeeks} rustige weken achter elkaar en stopt vlak voor de volgende wedstrijd — of eerder, zodra er iets is dat jou nodig heeft.`
      : o.fastWeeks === 1
        ? 'Volgende week wordt er al gespeeld. Gebruik gewoon "Volgende week".'
        : 'Je speelt deze week een wedstrijd. Die week speel je zelf.';

  return `<header class="topbar">
    <button class="club" data-action="nav" data-id="club" ${tipAttr('Naar je clubinfo.')}>
      ${crestSvg(g.crest as CrestShape, colors, clubInitials(g.clubName), 40)}
      <span class="club-name">
        <strong>${esc(g.clubName)}</strong>
        <span class="muted small">${esc(division.name)} · ${seasonLabel(g.startYear, g.season)}</span>
      </span>
    </button>

    <div class="when">
      <button class="today" data-action="nav" data-id="kalender" ${tipAttr('Naar de kalender met alle weken, wedstrijden en uitbetalingen.')}>
        <strong>${formatDateLong(g.startYear, g.season, g.week)}</strong>
        <span class="muted small">${esc(seasonPhase(g.week))}</span>
      </button>
      ${seasonStrip(g)}
    </div>

    <div class="head-money">
      <span class="cap">Saldo</span>
      <button class="big-num sm ${g.cash < 0 ? 'neg' : ''}" data-action="nav" data-id="financien" ${tipAttr('Naar je financiën: prognose, posten en de herkomst van elke post.')}>${euro(g.cash)}</button>
      ${g.weeksNegative ? `<span class="small neg">${g.weeksNegative}/8 weken rood</span>` : ''}
    </div>

    <div class="next-group">
      <button class="primary next ${o.weekLabel.highlight ? 'season-end' : ''}" data-action="next-week"
        ${o.blocked || g.gameOver || o.busy ? 'disabled' : ''} ${tipAttr(o.blocked || o.weekLabel.tip)}>${o.weekLabel.text}</button>
      <button class="ghost fast" data-action="fast-forward" ${o.fastWeeks < 2 || o.busy ? 'disabled' : ''} ${tipAttr(nextTip)}>
        ▶▶ Tot de volgende match${o.fastWeeks >= 2 ? ` <span class="small">(${o.fastWeeks})</span>` : ''}
      </button>
    </div>
  </header>`;
}
