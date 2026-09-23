// De kopbalk, en de seizoensbalk die op de kalender staat.
//
// De kopbalk draagt drie dingen en meer niet: wie je bent, wanneer het is, en wat je nu
// kunt doen. Je clublogo en je naam krijgen daarin de ruimte die ze verdienen, met je
// clubkleuren als band over de bovenrand — je ziet in één oogopslag bij welke club je zit.
//
// De seizoensbalk hoort daar níét thuis: die toont de 52 weken in één streep met elke
// speeldag, de winterstop en de transferperiodes erop, en dat is naslag die je erbij
// haalt, geen ding dat elke seconde in je ooghoek moet staan. Ze staat op de kalender.

import type { GameState } from './../engine/types';
import { MATCH_WEEKS, SEASON_END_WEEK, WEEKS_PER_YEAR, WINTER_BREAK, formatDateLong, inWinterBreak, isTransferWindow, seasonLabel } from '../engine/calendar';
import { DIVISIONS } from '../engine/data/divisions';
import { OWN_TEAM_ID } from '../engine/league';
import { esc, euro } from './format';
import { schemeById } from './theme';
import { tipAttr } from './tooltip';
import { type CrestShape, clubInitials, crestSvg } from './crest';

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
 * De kopbalk. Drie dingen, meer niet: wie je bent, wanneer het is, en wat je nu kunt doen.
 *
 * De vorige poging propte er ook nog een seizoensbalk in. Op zich een bruikbaar ding — je
 * ziet er in één streep aan hoe het jaar loopt — maar in een kopbalk van tachtig pixels
 * werd het drukte naast een logo dat je nauwelijks zag. Die balk staat nu op de kalender,
 * waar ruimte is en waar je hem zoekt.
 *
 * Wat overblijft krijgt de plaats die het verdient: het logo is bijna twee keer zo groot,
 * de clubnaam staat er in koptekst, en de clubkleuren lopen als band over de bovenrand.
 * Je weet in één oogopslag bij welke club je zit.
 */
export function header(g: GameState): string {
  const division = DIVISIONS[g.league.divisionLevel];
  const colors = schemeById(g.scheme).colors;
  const match = weeksToMatch(g);
  const playedDays = MATCH_WEEKS.filter((w) => w < g.week).length;

  // wanneer het is, in drie korte stukken naast elkaar in plaats van een alinea
  const when = [
    `<span class="bit"><span class="cap">Week</span><strong>${g.week}<span class="of">/${WEEKS_PER_YEAR}</span></strong></span>`,
    playedDays || MATCH_WEEKS[0] <= g.week
      ? `<span class="bit"><span class="cap">Speeldag</span><strong>${playedDays}<span class="of">/${MATCH_WEEKS.length}</span></strong></span>`
      : `<span class="bit"><span class="cap">Competitie</span><strong>week ${MATCH_WEEKS[0]}</strong></span>`,
    match
      ? `<span class="bit ${match.weeks === 0 ? 'now' : ''}"><span class="cap">Volgende match</span><strong>${
          match.weeks === 0 ? 'deze week' : `over ${match.weeks} ${match.weeks === 1 ? 'week' : 'weken'}`
        }</strong></span>`
      : '',
  ].join('');

  // de kleuren van de band komen uit applyTheme, in hun bijgetrokken vorm — hier niets
  // meer inline zetten, want dan zou een witte clubkleur opnieuw onzichtbaar worden
  return `<header class="topbar">
    <span class="club-band" aria-hidden="true"></span>

    <button class="club" data-action="nav" data-id="club" ${tipAttr('Naar je clubinfo: stadion, gemeente, geschiedenis en je kleuren.')}>
      ${crestSvg(g.crest as CrestShape, colors, clubInitials(g.clubName), 58)}
      <span class="club-name">
        <strong>${esc(g.clubName)}</strong>
        <span class="muted">${esc(division.name)} · ${seasonLabel(g.startYear, g.season)}</span>
      </span>
    </button>

    <button class="when" data-action="nav" data-id="kalender" ${tipAttr('Naar de kalender: alle weken van het seizoen, met wedstrijden, uitbetalingen en de seizoensbalk.')}>
      <span class="date">${formatDateLong(g.startYear, g.season, g.week)}</span>
      <span class="bits">${when}</span>
    </button>

    <div class="head-money">
      <span class="cap">Saldo</span>
      <button class="amount ${g.cash < 0 ? 'neg' : ''}" data-action="nav" data-id="financien" ${tipAttr('Naar je financiën: prognose, posten en de herkomst van elke post.')}>${euro(g.cash)}</button>
      ${g.weeksNegative ? `<span class="small neg">${g.weeksNegative}/8 weken rood</span>` : ''}
    </div>

  </header>`;
}

/**
 * De speelbalk onderaan: altijd in beeld, waar je ook staat.
 *
 * De knoppen stonden in de kopbalk, en die scrolt weg. Halverwege een spelerslijst of een
 * kalender moest je dus naar boven om verder te spelen — of om te zien hoeveel er nog in
 * kas zat. Hier staan ze vast: links je saldo en wat er nog op je wacht, rechts de twee
 * knoppen. Op een telefoon scheelt dat nog het meest, want daar is de kopbalk het duurst.
 */
export function playBar(g: GameState, o: HeaderOpts & { open: number }): string {
  const nextTip = o.blocked
    ? o.blocked
    : o.fastWeeks >= 2
      ? `Speelt ${o.fastWeeks} rustige weken achter elkaar en stopt vlak voor de volgende wedstrijd — of eerder, zodra er iets is dat jou nodig heeft.`
      : o.fastWeeks === 1
        ? 'Volgende week wordt er al gespeeld. Gebruik gewoon "Volgende week".'
        : 'Je speelt deze week een wedstrijd. Die week speel je zelf.';

  return `<div class="playbar">
    <div class="pb-left">
      <button class="pb-cash ${g.cash < 0 ? 'neg' : ''}" data-action="nav" data-id="financien" ${tipAttr('Naar je financiën.')}>
        <span class="cap">Saldo</span><strong>${euro(g.cash)}</strong>
      </button>
      ${
        o.open
          ? `<button class="pb-open" data-action="nav" data-id="overzicht" ${tipAttr('Naar je werklijst op het dashboard.')}>
              <span class="dot"></span>${o.open} ${o.open === 1 ? 'ding wacht' : 'dingen wachten'} op jou
            </button>`
          : '<span class="pb-clear small">niets dat op jou wacht</span>'
      }
      ${o.blocked ? `<span class="pb-block small" ${tipAttr(o.blocked)}>⚠️ je ploeg is niet compleet</span>` : ''}
    </div>
    <div class="next-group">
      <button class="ghost fast" data-action="fast-forward" ${o.fastWeeks < 2 || o.busy ? 'disabled' : ''} ${tipAttr(nextTip)}>
        ▶▶ Tot de match${o.fastWeeks >= 2 ? ` <span class="small">(${o.fastWeeks})</span>` : ''}
      </button>
      <button class="primary next ${o.weekLabel.highlight ? 'season-end' : ''}" data-action="next-week"
        ${o.blocked || g.gameOver || o.busy ? 'disabled' : ''} ${tipAttr(o.blocked || o.weekLabel.tip)}>${o.weekLabel.text}</button>
    </div>
  </div>`;
}
