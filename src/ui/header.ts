// De kopbalk, en de seizoensbalk die op de kalender staat.
//
// De kopbalk draagt twee dingen: wie je bent, en de vijf cijfers waar je week om draait.
// Je clublogo en je naam krijgen de ruimte die ze verdienen, met je clubkleuren als band
// over de bovenrand — je ziet in één oogopslag bij welke club je zit.
//
// De seizoensbalk hoort daar níét thuis: die toont de 52 weken in één streep met elke
// speeldag, de winterstop en de transferperiodes erop, en dat is naslag die je erbij
// haalt, geen ding dat elke seconde in je ooghoek moet staan. Ze staat op de kalender.

import type { GameState } from './../engine/types';
import { MATCH_WEEKS, SEASON_END_WEEK, WEEKS_PER_YEAR, WINTER_BREAK, formatDateLong, inWinterBreak, isTransferWindow, seasonLabel } from '../engine/calendar';
import { DIVISIONS } from '../engine/data/divisions';
import { OWN_TEAM_ID, type Zone, ownPosition, zoneAt } from '../engine/league';
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
 * Waar je staat in het klassement, en wat dat betekent als het zo blijft.
 *
 * De zone komt uit dezelfde functie waarmee de engine het seizoen afrekent, dus wat hier
 * groen of rood kleurt, is precies wat er in week 46 gebeurt.
 */
function standing(g: GameState): { plaats: number; teams: number; zone: Zone; tip: string } {
  const plaats = ownPosition(g.league);
  const teams = g.league.table.length;
  const zone = zoneAt(g.league, plaats, g.league.divisionLevel, DIVISIONS.length);
  const tip =
    zone === 'kampioen'
      ? `Je staat eerste van ${teams}. Blijft dat zo, dan ben je kampioen en promoveer je naar ${DIVISIONS[g.league.divisionLevel + 1].name}.`
      : zone === 'promotie'
        ? `Je staat tweede van ${teams}. Ook de tweede promoveert, dus blijft dit zo, dan ga je naar ${DIVISIONS[g.league.divisionLevel + 1].name}.`
        : zone === 'degradatie'
          ? `Je staat ${plaats}e van ${teams}. De laatste drie zakken naar ${DIVISIONS[g.league.divisionLevel - 1].name}. Blijft dit zo, dan degradeer je.`
          : `Je staat ${plaats}e van ${teams}. De eerste twee promoveren, de laatste drie degraderen — jij zit daartussen.`;
  return { plaats, teams, zone, tip };
}

/**
 * De kopbalk. Wie je bent, en de vijf cijfers waar je week om draait.
 *
 * Links je logo, je clubnaam, je reeks en de datum — dat blok zegt waar en wanneer je
 * bent. Rechts een strook benoemde feiten: week, speeldag, klassement, volgende match,
 * saldo. Elk met een kopje erboven en elk een knop naar het scherm waar het vandaan komt.
 *
 * Je plaats in het klassement stond er tot nu toe niet, terwijl dat het cijfer is waar je
 * hele seizoen om draait, en ze kleurt mee: groen op een promotieplaats, rood in de
 * degradatiezone. Die kleur komt uit dezelfde functie waarmee de engine het seizoen
 * afrekent, dus wat hier rood staat, degradeert in week 46 ook echt.
 */
export function header(g: GameState): string {
  const division = DIVISIONS[g.league.divisionLevel];
  const colors = schemeById(g.scheme).colors;
  const match = weeksToMatch(g);
  const playedDays = MATCH_WEEKS.filter((w) => w < g.week).length;
  const st = standing(g);

  /**
   * De kerncijfers als één strook benoemde feiten.
   *
   * Ze stonden verspreid: de datum links, drie weekcijfers ernaast, het saldo helemaal
   * rechts en een halve kopbalk leeg ertussen. En je plaats in het klassement stond er
   * niet, terwijl dat het enige cijfer is waar je hele seizoen om draait. Nu staan ze op
   * één lijn, elk met een kopje erboven, elk een knop naar het scherm waar het vandaan komt.
   */
  const bit = (cap: string, value: string, opts: { to: string; tip: string; tone?: string }) =>
    `<button class="hbit ${opts.tone ?? ''}" data-action="nav" data-id="${opts.to}" ${tipAttr(opts.tip, cap)}>
      <span class="cap">${cap}</span><strong>${value}</strong>
    </button>`;

  const bits = [
    bit('Week', `${g.week}<span class="of">/${WEEKS_PER_YEAR}</span>`, {
      to: 'kalender',
      tip: `Week ${g.week} van ${WEEKS_PER_YEAR}. Naar de kalender: alle weken van het seizoen, met wedstrijden en uitbetalingen.`,
    }),
    playedDays || MATCH_WEEKS[0] <= g.week
      ? bit('Speeldag', `${playedDays}<span class="of">/${MATCH_WEEKS.length}</span>`, {
          to: 'kalender',
          tip: `Er zijn ${playedDays} van de ${MATCH_WEEKS.length} speeldagen gespeeld.`,
        })
      : bit('Competitie', `week ${MATCH_WEEKS[0]}`, {
          to: 'kalender',
          tip: `De competitie begint in week ${MATCH_WEEKS[0]}. Tot dan zijn er geen wedstrijden, dus ook geen tickets en geen wedstrijdkantine.`,
        }),
    bit('Klassement', `${st.plaats}e<span class="of">/${st.teams}</span>`, {
      to: 'competitie',
      tip: st.tip,
      tone: `zone-${st.zone}`,
    }),
    match
      ? bit('Volgende match', match.weeks === 0 ? 'deze week' : `over ${match.weeks} ${match.weeks === 1 ? 'week' : 'weken'}`, {
          to: 'competitie',
          tip: match.weeks === 0 ? 'Je speelt deze week. Zet je ploeg klaar voordat je op "Volgende week" klikt.' : `Je volgende wedstrijd is over ${match.weeks} weken, in week ${match.week}.`,
          tone: match.weeks === 0 ? 'now' : '',
        })
      : '',
    bit('Saldo', euro(g.cash), {
      to: 'financien',
      tip: `Wat er nu op de rekening staat.${g.weeksNegative ? ` Je staat al ${g.weeksNegative} van de 8 toegestane weken rood.` : ' Naar je financiën: prognose, posten en de herkomst van elke post.'}`,
      tone: g.cash < 0 ? 'neg' : 'money',
    }),
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
        <span class="date">${formatDateLong(g.startYear, g.season, g.week)}</span>
      </span>
    </button>

    <div class="head-bits">${bits}</div>
    ${g.weeksNegative ? `<span class="head-warn small" ${tipAttr(`Sta je acht weken na elkaar in het rood, dan trekt de bank de stekker eruit en is het spel voorbij. Je staat er nu ${g.weeksNegative}.`, 'Je staat rood')}>⚠️ ${g.weeksNegative}/8 weken rood</span>` : ''}
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

  // je saldo stond hier ook, maar de kopbalk blijft nu staan en toont het daar al. Twee
  // keer hetzelfde bedrag op één scherm is precies de drukte die we eruit wilden hebben.
  return `<div class="playbar">
    <div class="pb-left">
      ${
        o.open
          ? `<button class="pb-open" data-action="nav" data-id="overzicht" ${tipAttr('Naar je werklijst op je bureau.')}>
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
