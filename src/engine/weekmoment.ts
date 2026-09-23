// Het weekmoment: één concrete beslissing voor de aftrap.
// Drie zinnen, twee of drie knoppen, meteen gevolg. Geen nieuw scherm, geen nieuw systeem:
// alles wat hier gebeurt, gebruikt de knoppen die het spel al heeft (geld, sfeer, vermoeidheid, opkomst).

import type { GameState, WeekChoice } from './types';
import type { Rng } from './rng';
import { clamp, createRng } from './rng';
import { MATCH_WEEKS, inWinterBreak } from './calendar';
import { OWN_TEAM_ID, rivalTeam } from './league';
import { available } from './discipline';
import { addNews, book } from './util';

interface Situation {
  id: string;
  /** Kan dit deze week gebeuren? */
  when: (s: GameState, ctx: Ctx) => boolean;
  title: string;
  text: (s: GameState, ctx: Ctx) => string;
  options: (s: GameState, ctx: Ctx) => { id: string; label: string; detail: string }[];
  /** Het gevolg. Geeft terug wat er in het weekrapport komt. */
  apply: (s: GameState, option: string, rng: Rng) => string;
}

interface Ctx {
  match: boolean; // speelt je ploeg deze week?
  home: boolean;
  derby: boolean;
  opponent: string;
}

const money = (n: number) => `€${Math.round(n).toLocaleString('nl-BE')}`;

/** Klein hulpje: iedereen wat frisser of net wat moeier. */
function fatigueAll(s: GameState, delta: number): void {
  for (const p of s.players) p.fatigue = clamp(p.fatigue + delta, 0, 100);
}
function moraleAll(s: GameState, delta: number): void {
  for (const p of s.players) p.morale = clamp(p.morale + delta, 0, 100);
}

export const SITUATIONS: Situation[] = [
  {
    id: 'regen',
    when: (s, c) => c.match && c.home && s.infrastructure.pitch === 'natuurgras',
    title: 'Het regent al drie dagen',
    text: (_s, c) => `De grasmat tegen ${c.opponent} staat er drassig bij. De terreinverzorger vraagt of hij een zeil mag leggen.`,
    options: () => [
      { id: 'zeil', label: 'Zeil leggen (€450)', detail: 'Het veld ligt er zondag degelijk bij. Kost geld, geen risico.' },
      { id: 'gokken', label: 'Erop gokken', detail: 'Misschien droogt het op. Misschien wordt het een modderpoel.' },
    ],
    apply: (s, option, rng) => {
      if (option === 'zeil') {
        book(s, 'onderhoud & energie', -450, 'Zeil over het veld (regen)');
        return 'Het zeil lag er op tijd: een degelijk veld en een normale wedstrijd.';
      }
      if (rng.chance(0.45)) {
        s.community.fanMood = clamp(s.community.fanMood - 4, 0, 100);
        fatigueAll(s, 4);
        return 'Modderpoel. De supporters mopperen en je spelers kruipen er kapot uit.';
      }
      return 'Het klaarde op. Niets aan de hand, en je hield €450 in de kas.';
    },
  },
  {
    id: 'bus',
    when: (s, c) => c.match && !c.home && !s.infrastructure.teamBus,
    title: 'De huurbus is defect',
    text: (_s, c) => `Twee uur voor vertrek naar ${c.opponent} belt de busfirma: panne. Er is een duurdere bus vrij, of je gaat met eigen wagens.`,
    options: () => [
      { id: 'bus', label: 'Duurdere bus nemen (€600)', detail: 'Iedereen samen, op tijd, uitgerust.' },
      { id: 'wagens', label: 'Met eigen wagens', detail: 'Gratis, maar het wordt haasten en zoeken.' },
    ],
    apply: (s, option, rng) => {
      if (option === 'bus') {
        book(s, 'wedstrijdkosten', -600, 'Vervangbus op het laatste moment');
        return 'De vervangbus stond er. Iedereen op tijd aan de kleedkamer.';
      }
      fatigueAll(s, 3);
      if (rng.chance(0.3)) {
        moraleAll(s, -3);
        return 'Twee wagens reden verkeerd. Een kwartier te laat aan de kleedkamer en een trainer met rode kop.';
      }
      return 'Met vijf wagens vertrokken. Wat gedoe, maar iedereen geraakte er.';
    },
  },
  {
    id: 'blessure',
    when: (s, c) => c.match && s.players.some((p) => p.injuryWeeks === 0 && p.fatigue > 70),
    title: 'Je beste man is op',
    text: (s) => {
      const p = [...s.players].sort((a, b) => b.fatigue - a.fatigue)[0];
      return `${p.name} loopt al weken op zijn tandvlees (vermoeidheid ${Math.round(p.fatigue)}/100). De kinesist raadt rust aan, de trainer wil hem laten spelen.`;
    },
    options: () => [
      { id: 'sparen', label: 'Sparen deze week', detail: 'Hij blijft thuis, komt fris terug. Je ploeg is deze week zwakker.' },
      { id: 'spelen', label: 'Laten spelen', detail: 'Je sterkste elf, maar een verhoogd risico op een blessure.' },
    ],
    apply: (s, option, rng) => {
      const p = [...s.players].sort((a, b) => b.fatigue - a.fatigue)[0];
      if (!p) return '';
      if (option === 'sparen') {
        p.fatigue = clamp(p.fatigue - 25, 0, 100);
        s.tactics.manualXI = s.tactics.manualXI.filter((id) => id !== p.id);
        p.morale = clamp(p.morale - 2, 0, 100);
        return `${p.name} bleef aan de kant en kwam er een pak frisser uit (−25 vermoeidheid).`;
      }
      if (rng.chance(0.28)) {
        p.injuryWeeks = rng.int(2, 4);
        return `${p.name} ging er inderdaad door: ${p.injuryWeeks} weken buiten strijd. Dat zagen we aankomen.`;
      }
      p.fatigue = clamp(p.fatigue + 6, 0, 100);
      return `${p.name} speelde en hield het. Moe, maar heel.`;
    },
  },
  {
    id: 'derbyavond',
    when: (_s, c) => c.match && c.derby && c.home,
    title: 'De derby komt eraan',
    text: (_s, c) => `Half het dorp komt zondag naar ${c.opponent} kijken. De supportersclub vraagt of ze een tent mogen zetten met een extra tap.`,
    options: () => [
      { id: 'tent', label: 'Tent en extra tap (€350)', detail: 'Meer volk, meer pinten, meer sfeer — maar ook meer vrijwilligers nodig.' },
      { id: 'sober', label: 'Gewoon houden', detail: 'Geen kosten, geen gedoe.' },
    ],
    apply: (s, option) => {
      if (option !== 'tent') return 'Je hield het sober. Een derby is ook zonder tent een derby.';
      book(s, 'kantine', -350, 'Tent en extra tap voor de derby');
      s.community.fanMood = clamp(s.community.fanMood + 5, 0, 100);
      s.community.reputation = clamp(s.community.reputation + 1, 0, 100);
      return 'De tent stond vol. Sfeer van jewelste en een kantine die niet stilviel.';
    },
  },
  {
    id: 'sponsorbezoek',
    when: (s, c) => c.match && c.home && s.sponsors.length > 0,
    title: 'Je hoofdsponsor komt kijken',
    text: (s) => {
      const d = [...s.sponsors].sort((a, b) => b.weekly - a.weekly)[0];
      return `${d.name} komt zondag met tien klanten naar de match. Zijn contract loopt nog even, maar de indruk van vandaag telt.`;
    },
    options: () => [
      { id: 'vip', label: 'Ontvangst met hapjes (€300)', detail: 'Tafel apart, iemand die hen opvangt. Sponsors onthouden dat.' },
      { id: 'gewoon', label: 'Gewoon een plaatsje op de tribune', detail: 'Gratis. Ze komen voor het voetbal, toch?' },
    ],
    apply: (s, option) => {
      const d = [...s.sponsors].sort((a, b) => b.weekly - a.weekly)[0];
      if (!d) return '';
      if (option === 'vip') {
        book(s, 'kantine', -300, `Sponsorontvangst ${d.name}`);
        d.satisfaction = clamp(d.satisfaction + 8, 0, 100);
        return `${d.name} ging tevreden naar huis (+8 tevredenheid).`;
      }
      d.satisfaction = clamp(d.satisfaction - 3, 0, 100);
      return `${d.name} stond in de regen tussen de rest. "Ook goed", zei hij. (−3 tevredenheid.)`;
    },
  },
  {
    id: 'scheidsrechter',
    when: (_s, c) => c.match && c.home,
    title: 'De scheidsrechter is er niet',
    text: (_s, c) => `Een kwartier voor de aftrap tegen ${c.opponent} is er nog geen ref. De bond stelt een vervanger voor die pas over een uur kan.`,
    options: () => [
      { id: 'wachten', label: 'Wachten op de bondsref', detail: 'Een uur later aftrappen. Het publiek zit intussen in de kantine.' },
      { id: 'clubref', label: 'Een clubscheidsrechter vragen', detail: 'Meteen spelen, maar de bezoekers zullen morren bij elke fluitstoot.' },
    ],
    apply: (s, option, rng) => {
      if (option === 'wachten') {
        book(s, 'kantine', 420, 'Extra kantineverbruik tijdens het wachten op de scheidsrechter');
        s.community.fanMood = clamp(s.community.fanMood - 2, 0, 100);
        return `Een uur later afgetrapt. De supporters mopperden, maar de kantine draaide: ${money(420)} extra.`;
      }
      if (rng.chance(0.35)) {
        book(s, 'boetes', -250, 'Klacht bezoekende club over de clubscheidsrechter');
        return 'De bezoekers dienden klacht in. €250 boete en een brief van de bond.';
      }
      return 'De clubref floot een degelijke partij. Niemand die er nog over sprak.';
    },
  },
  {
    id: 'ketel',
    when: (s, c) => !c.match && s.infrastructure.kantineLevel >= 2,
    title: 'De verwarmingsketel stottert',
    text: () => 'De installateur zegt: nu herstellen of wachten tot ze het echt begeeft. Het is een vrije week, dus het kan.',
    options: (s) => [
      { id: 'nu', label: `Nu herstellen (${money(900 * s.inflation)})`, detail: 'Klaar voor de winter, geen verrassingen.' },
      { id: 'wachten', label: 'Laten hangen', detail: 'Gratis, tot ze stukgaat. Dan is het duurder én koud.' },
    ],
    apply: (s, option, rng) => {
      if (option === 'nu') {
        const cost = Math.round(900 * s.inflation);
        book(s, 'onderhoud & energie', -cost, 'Herstelling verwarmingsketel');
        return `Ketel hersteld voor ${money(cost)}. Een zorg minder.`;
      }
      if (rng.chance(0.4)) {
        const cost = Math.round(2400 * s.inflation);
        book(s, 'tegenslagen', -cost, 'Verwarmingsketel begeven');
        s.community.fanMood = clamp(s.community.fanMood - 3, 0, 100);
        return `De ketel begaf het een week later: ${money(cost)} en een koude kantine.`;
      }
      return 'De ketel stottert nog altijd, maar doet het. Voorlopig.';
    },
  },
  {
    id: 'jeugdtornooi',
    when: (s, c) => !c.match && s.community.youthTeams >= 3,
    title: 'Uitnodiging voor een jeugdtornooi',
    text: (s) => `Een club uit de streek nodigt je ${s.community.youthTeams} jeugdploegen uit voor een tornooi. Inschrijving en verplaatsing kosten geld, maar het is een dag uit.`,
    options: (s) => [
      { id: 'gaan', label: `Inschrijven (${money(s.community.youthTeams * 120)})`, detail: 'Blije ouders, zichtbaarheid in de streek, en de vrijwilligers doen graag mee.' },
      { id: 'thuis', label: 'Bedanken', detail: 'Geen kosten. Ook geen verhaal om over te vertellen.' },
    ],
    apply: (s, option) => {
      if (option !== 'gaan') return 'Je bedankte vriendelijk. De jeugd traint gewoon verder.';
      const cost = s.community.youthTeams * 120;
      book(s, 'onderhoud & energie', -cost, 'Jeugdtornooi (inschrijving en verplaatsing)');
      s.community.reputation = clamp(s.community.reputation + 2, 0, 100);
      s.community.volunteerLoyaltyWeeks = Math.max(s.community.volunteerLoyaltyWeeks, 4);
      return `Een geslaagde tornooidag voor ${money(cost)}: +2 reputatie en vrijwilligers die er weer een maand tegen kunnen.`;
    },
  },
  {
    id: 'kernspeler',
    when: (s, c) => c.match && s.players.some((p) => p.morale < 40),
    title: 'Een speler is de sfeer aan het verzieken',
    text: (s) => {
      const p = [...s.players].sort((a, b) => a.morale - b.morale)[0];
      return `${p.name} loopt al weken te morren in de kleedkamer (moraal ${Math.round(p.morale)}/100). De trainer vraagt wat jij ervan vindt.`;
    },
    options: () => [
      { id: 'gesprek', label: 'Zelf een gesprek voeren', detail: 'Een half uur van je tijd. Werkt vaak, soms niet.' },
      { id: 'bank', label: 'Naar de B-kern', detail: 'Duidelijk signaal. Hij is kwaad, de rest weet waar de grens ligt.' },
      { id: 'niets', label: 'Laten waaien', detail: 'Het gaat wel over. Of niet.' },
    ],
    apply: (s, option, rng) => {
      const p = [...s.players].sort((a, b) => a.morale - b.morale)[0];
      if (!p) return '';
      if (option === 'gesprek') {
        if (rng.chance(0.7)) {
          p.morale = clamp(p.morale + 18, 0, 100);
          return `Het gesprek met ${p.name} deed deugd: hij is er weer bij (+18 moraal).`;
        }
        p.morale = clamp(p.morale + 4, 0, 100);
        return `${p.name} knikte beleefd en bleef mokken. Een beetje beter, meer niet.`;
      }
      if (option === 'bank') {
        p.morale = clamp(p.morale - 10, 0, 100);
        s.tactics.manualXI = s.tactics.manualXI.filter((id) => id !== p.id);
        moraleAll(s, 2);
        return `${p.name} naar de B-kern. Hij is niet blij, de rest van de groep wel (+2 moraal).`;
      }
      moraleAll(s, -1);
      return 'Je liet het waaien. Het gemor kroop langzaam door de hele kleedkamer (−1 moraal).';
    },
  },
  {
    id: 'kaartverkoop',
    when: (s, c) => c.match && c.home && s.infrastructure.capacity >= 400,
    title: 'Een bus supporters van de tegenstander',
    text: (_s, c) => `${c.opponent} meldt dat er twee bussen supporters komen. Wil je een extra ingang en een aparte tap openen?`,
    options: () => [
      { id: 'open', label: 'Extra ingang en tap (€200)', detail: 'Meer bezoekers binnen, meer verbruik, en geen rijen aan de poort.' },
      { id: 'niet', label: 'Eén ingang volstaat', detail: 'Gratis, maar een deel haakt af aan de rij.' },
    ],
    apply: (s, option, rng) => {
      if (option === 'open') {
        book(s, 'wedstrijdkosten', -200, 'Extra ingang en tap voor bezoekende supporters');
        const extra = Math.round(rng.range(0.9, 1.6) * 60 * s.ticketPrice);
        book(s, 'tickets', extra, 'Extra bezoekers dankzij de tweede ingang');
        return `Twee bussen volk zonder aanschuiven: ${money(extra)} extra aan de kassa.`;
      }
      s.community.fanMood = clamp(s.community.fanMood - 1, 0, 100);
      return 'Lange rij aan de poort. Een deel van de bezoekers zag het niet zitten en bleef in de bus.';
    },
  },
];

const momentKey = (id: string) => `moment-${id}`;
export const MOMENT_COOLDOWN = 12; // weken voor dezelfde situatie opnieuw mag opduiken

/** De situaties die deze week kunnen spelen. */
function context(state: GameState): Ctx {
  const f = state.league.fixtures.find((x) => x.week === state.week && x.homeGoals === undefined && (x.homeId === OWN_TEAM_ID || x.awayId === OWN_TEAM_ID));
  const rival = rivalTeam(state);
  if (!f) return { match: false, home: false, derby: false, opponent: '' };
  const home = f.homeId === OWN_TEAM_ID;
  const oppId = home ? f.awayId : f.homeId;
  return {
    match: true,
    home,
    derby: !!rival && rival.id === oppId,
    opponent: state.league.teams.find((t) => t.id === oppId)?.name ?? 'de tegenstander',
  };
}

/**
 * Zet het weekmoment klaar voor de week die eraan komt. Niet elke week: ongeveer twee op de drie
 * wedstrijdweken en af en toe een vrije week, zodat het een moment blijft en geen formulier wordt.
 */
export function makeWeekChoice(state: GameState, rng: Rng): WeekChoice | null {
  if (state.gameOver) return null;
  if (inWinterBreak(state.week) && rng.chance(0.7)) return null;
  if (state.week > MATCH_WEEKS[MATCH_WEEKS.length - 1]) return null;
  if (available(state.players).length < 11) return null;
  const ctx = context(state);
  if (!rng.chance(ctx.match ? 0.62 : 0.3)) return null;

  // elke situatie heeft een wachttijd, anders krijg je elke week dezelfde melding
  const options = SITUATIONS.filter((x) => x.when(state, ctx) && (state.eventCooldowns[momentKey(x.id)] ?? 0) <= 0);
  if (!options.length) return null;
  const pick = rng.pick(options);
  state.eventCooldowns[momentKey(pick.id)] = MOMENT_COOLDOWN;
  return {
    id: pick.id,
    season: state.season,
    week: state.week,
    title: pick.title,
    text: pick.text(state, ctx),
    options: pick.options(state, ctx),
    answer: null,
    outcome: null,
  };
}

/** De eigenaar kiest. Het gevolg is meteen zichtbaar. */
export function answerWeekChoice(state: GameState, optionId: string): string | null {
  const choice = state.weekChoice;
  if (!choice || choice.answer) return null;
  const situation = SITUATIONS.find((x) => x.id === choice.id);
  if (!situation || !choice.options.some((o) => o.id === optionId)) return null;
  const rng = createRng(state);
  choice.answer = optionId;
  choice.outcome = situation.apply(state, optionId, rng);
  addNews(state, 'neutraal', `Weekmoment — ${choice.title}: ${choice.outcome}`);
  return choice.outcome;
}

/** Wie niets beslist, beslist ook iets: de laatste optie (meestal "niets doen") gaat door. */
export function resolveWeekChoice(state: GameState, rng: Rng): void {
  const choice = state.weekChoice;
  if (!choice) return;
  if (!choice.answer) {
    const situation = SITUATIONS.find((x) => x.id === choice.id);
    const fallback = choice.options[choice.options.length - 1];
    if (situation && fallback) {
      choice.answer = fallback.id;
      choice.outcome = `Je besliste niets, dus "${fallback.label}" ging door. ${situation.apply(state, fallback.id, rng)}`;
    }
  }
  state.lastChoice = choice.outcome ? { title: choice.title, outcome: choice.outcome } : null;
  state.weekChoice = null;
}
