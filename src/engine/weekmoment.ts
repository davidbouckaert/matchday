// Het weekmoment: één concrete beslissing voor de aftrap.
//
// De situaties zelf staan in src/content/moments.ts. Dit bestand doet alleen het loten,
// het vastzetten van de focus en het afhandelen van de keuze. Een nieuw weekmoment vraagt
// dus geen enkele wijziging hier.

import type { Gevolg, Keuze, MomentDef } from '../content/types';
import type { GameState, WeekChoice } from './types';
import type { Rng } from './rng';
import { createRng } from './rng';
import { MOMENTS } from '../content/moments';
import { apply, baseVars, fill, LAST_MATCH_WEEK, pickPlayer, storyline, test, value, worldContext } from './content';
import type { Focus, WorldCtx } from './content';
import { inWinterBreak } from './calendar';
import { available } from './discipline';
import { addNews, euro } from './util';

export const MOMENT_COOLDOWN = 12; // weken voor dezelfde situatie opnieuw mag opduiken

const momentKey = (id: string) => `moment-${id}`;

/** Alleen voor tests en het overzicht: de situaties zoals ze in de data staan. */
export { MOMENTS };

function definition(id: string): MomentDef | undefined {
  return MOMENTS.find((m) => m.id === id);
}

/** Zet de focus vast: over welke speler en welke sponsor dit moment gaat. */
function resolveFocus(state: GameState, rng: Rng, def: MomentDef): Focus {
  const focus: Focus = { playerId: null, sponsorId: null };
  if (def.focusSpeler) focus.playerId = pickPlayer(state, rng, def.focusSpeler)?.id ?? null;
  if (def.focusSponsor === 'grootste') focus.sponsorId = [...state.sponsors].sort((a, b) => b.weekly - a.weekly)[0]?.id ?? null;
  else if (def.focusSponsor === 'willekeurig' && state.sponsors.length) focus.sponsorId = rng.pick(state.sponsors).id;
  return focus;
}

/** De knoptekst met het bedrag erin, als de keuze er een heeft. */
function optionLabel(state: GameState, rng: Rng, keuze: Keuze, vars: Record<string, string>): string {
  const kost: Record<string, string> = {};
  if (keuze.kost !== undefined) kost.kost = euro(Math.abs(value(state, rng, keuze.kost)));
  return fill(keuze.label, vars, kost);
}

/** Loten met gewichten, zodat een zeldzaam moment ook echt zeldzaam blijft. */
function weightedPick(rng: Rng, options: MomentDef[]): MomentDef {
  const total = options.reduce((sum, m) => sum + (m.gewicht ?? 1), 0);
  let roll = rng.range(0, total);
  for (const m of options) {
    roll -= m.gewicht ?? 1;
    if (roll <= 0) return m;
  }
  return options[options.length - 1];
}

/**
 * Zet het weekmoment klaar voor de week die eraan komt. Niet elke week: ongeveer twee op de drie
 * wedstrijdweken en af en toe een vrije week, zodat het een moment blijft en geen formulier wordt.
 */
export function makeWeekChoice(state: GameState, rng: Rng): WeekChoice | null {
  if (state.gameOver) return null;
  if (inWinterBreak(state.week) && rng.chance(0.7)) return null;
  if (state.week > LAST_MATCH_WEEK) return null;
  if (available(state.players).length < 11) return null;
  const ctx = worldContext(state);
  if (!rng.chance(ctx.match ? 0.62 : 0.3)) return null;

  // elke situatie heeft een wachttijd, anders krijg je elke week dezelfde melding
  const options = MOMENTS.filter((m) => test(state, ctx, m.wanneer) && (state.eventCooldowns[momentKey(m.id)] ?? 0) <= 0);
  if (!options.length) return null;
  const pick = weightedPick(rng, options);
  state.eventCooldowns[momentKey(pick.id)] = pick.cooldown ?? MOMENT_COOLDOWN;

  const focus = resolveFocus(state, rng, pick);
  // een vervolgmoment erft de namen en bedragen van de gebeurtenis waar het op voortbouwt
  const vars = { ...baseVars(state, ctx, focus), ...(pick.verhaal ? storyline(state, pick.verhaal)?.vars : undefined) };
  return {
    id: pick.id,
    season: state.season,
    week: state.week,
    title: fill(pick.titel, vars),
    text: fill(pick.tekst, vars),
    options: pick.keuzes.map((k) => ({ id: k.id, label: optionLabel(state, rng, k, vars), detail: fill(k.uitleg, vars) })),
    answer: null,
    outcome: null,
    vars,
    focusPlayerId: focus.playerId ?? null,
    focusSponsorId: focus.sponsorId ?? null,
  };
}

/** Welk gevolg het wordt: de eerste waarvan de kans valt, anders het laatste. */
function rollOutcome(rng: Rng, keuze: Keuze): Gevolg | undefined {
  for (const g of keuze.gevolgen) {
    if (g.kans === undefined) return g;
    if (rng.chance(g.kans)) return g;
  }
  return keuze.gevolgen[keuze.gevolgen.length - 1];
}

/** Voert één keuze uit en geeft de zin terug die in het weekrapport komt. */
function run(state: GameState, rng: Rng, choice: WeekChoice, optionId: string): string {
  const def = definition(choice.id);
  const keuze = def?.keuzes.find((k) => k.id === optionId);
  if (!def || !keuze) return '';
  const gevolg = rollOutcome(rng, keuze);
  if (!gevolg) return '';
  const focus: Focus = { playerId: choice.focusPlayerId, sponsorId: choice.focusSponsorId };
  // de plaatshouders van het moment gaan mee in de effecten, zodat nieuws en kroniek
  // dezelfde namen gebruiken als de vraag die je kreeg
  const produced = apply(state, rng, gevolg.effecten, focus, worldContext(state), { ...choice.vars });
  return fill(gevolg.tekst, produced);
}

/** De eigenaar kiest. Het gevolg is meteen zichtbaar. */
export function answerWeekChoice(state: GameState, optionId: string): string | null {
  const choice = state.weekChoice;
  if (!choice || choice.answer) return null;
  if (!choice.options.some((o) => o.id === optionId)) return null;
  const rng = createRng(state);
  choice.answer = optionId;
  choice.outcome = run(state, rng, choice, optionId);
  addNews(state, 'neutraal', `Weekmoment — ${choice.title}: ${choice.outcome}`);
  return choice.outcome;
}

/** Wie niets beslist, beslist ook iets: de laatste optie (meestal "niets doen") gaat door. */
export function resolveWeekChoice(state: GameState, rng: Rng): void {
  const choice = state.weekChoice;
  if (!choice) return;
  if (!choice.answer) {
    const fallback = choice.options[choice.options.length - 1];
    if (fallback) {
      choice.answer = fallback.id;
      choice.outcome = `Je besliste niets, dus "${fallback.label}" ging door. ${run(state, rng, choice, fallback.id)}`;
    }
  }
  state.lastChoice = choice.outcome ? { title: choice.title, outcome: choice.outcome } : null;
  state.weekChoice = null;
}

/** Alleen voor de UI: onder welke noemer dit moment valt. */
export function momentCategory(id: string): string {
  return definition(id)?.categorie ?? 'bestuur';
}

/** Hulpje voor tests: bouwt de wereldcontext van deze week. */
export { worldContext as momentContext };
export type { WorldCtx };
