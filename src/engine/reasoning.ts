// Het logboek van het brein: wat je personeel heeft uitgerekend voor het iets deed.
//
// De regels van dit spel zitten in functies die elke week opnieuw rekenen, maar je zag
// daar niets van. Je zag dat er vier keer getraind werd, niet waaróm — en al helemaal niet
// dat het vorige week nog drie was omdat je intussen een kinesist in dienst hebt.
//
// Elke beslissing die een personeelslid neemt, schrijft daarom hier een regel: wat hij koos,
// wat het vorige week was, welke stappen hij daarvoor gezet heeft en met welke efficiëntie
// hij werkt. Dat is bedoeld om na te kijken of de motor doet wat hij belooft — de cijfers in
// deze regels komen uit dezelfde functies die daarna ook echt het werk doen.

import type { GameState, TaskId } from './types';
import { logInfo } from '../log/logger';

export interface ReasoningEntry {
  season: number;
  week: number;
  task: TaskId;
  /** Wie de beslissing nam. */
  staff: string;
  /** Waar de beslissing over ging, bijvoorbeeld "Trainingen per week". */
  subject: string;
  /** Wat het was, als het al iets was. */
  from: string | null;
  /** Wat het geworden is. */
  to: string;
  /** Is er iets veranderd tegenover vorige week? */
  changed: boolean;
  /** Zijn efficiëntie op dit moment, van 0 tot 1. */
  efficiency: number;
  /** De stappen van de berekening, in gewone taal. */
  steps: string[];
}

const MAX_ENTRIES = 120;

// Waar deze regels terechtkomen, staat niet hier. De motor schrijft ze naar de logkern in
// src/log, en wie het spel opstart beslist waar ze heen gaan: de console van je browser, het
// .log-bestand in de projectmap, de terminal, later een server. Zie src/log/logger.ts.

/** De kopregel van een beslissing, zoals hij op het scherm en in de log staat. */
export function decisionLine(e: ReasoningEntry): string {
  const waarde = e.from !== null && e.changed ? `${e.from} → ${e.to}` : e.to;
  return `[${e.season}-${String(e.week).padStart(2, '0')}] ${e.staff} · ${e.subject}: ${waarde}`;
}

export function logDecision(state: GameState, entry: Omit<ReasoningEntry, 'season' | 'week'>): void {
  const volledig: ReasoningEntry = { season: state.season, week: state.week, ...entry };
  state.reasoning = [volledig, ...(state.reasoning ?? [])].slice(0, MAX_ENTRIES);
  logInfo('brein', decisionLine(volledig), {
    taak: volledig.task,
    efficientie: `${Math.round(volledig.efficiency * 100)}%`,
    gewijzigd: volledig.changed,
    stappen: volledig.steps,
  });
}

/**
 * De wekelijkse doorlichting van de club.
 *
 * Voor je personeel aan het werk gaat, kijkt het eerst rond: wie is er in dienst, wat staat
 * er, hoe ligt de groep erbij. Dat is wat "hun keuzes zijn niet statisch" concreet betekent,
 * en daarom staat het als eerste regel in het logboek — ook als er niets veranderd is. Zo
 * kun je nakijken dat de analyse écht elke week gebeurt en niet alleen als het toevallig
 * opvalt.
 */
export interface ClubScan {
  staf: string;
  omkadering: string;
  groep: string;
  wijzigingen: string[];
}

export function logScan(state: GameState, scan: ClubScan): void {
  logDecision(state, {
    task: 'training',
    staff: 'Doorlichting',
    subject: 'Wekelijkse analyse van de club',
    from: null,
    to: scan.wijzigingen.length ? `${scan.wijzigingen.length} ${scan.wijzigingen.length === 1 ? 'wijziging' : 'wijzigingen'}` : 'niets veranderd',
    changed: scan.wijzigingen.length > 0,
    efficiency: 1,
    steps: [scan.staf, scan.omkadering, scan.groep, ...scan.wijzigingen.map((w) => `Veranderd: ${w}`)],
  });
}

/** De beslissingen van de laatste weken, nieuwste eerst. */
export function recentReasoning(state: GameState, limit = 20): ReasoningEntry[] {
  return (state.reasoning ?? []).slice(0, limit);
}

/** Alleen wat er deze week veranderd is tegenover de week ervoor. */
export function changedThisWeek(state: GameState): ReasoningEntry[] {
  return (state.reasoning ?? []).filter((e) => e.season === state.season && e.week === state.week && e.changed);
}
