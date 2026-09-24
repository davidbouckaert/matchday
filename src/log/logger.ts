// De logkern.
//
// Dit bestand weet niet of het in een browser of in Node draait, en dat is met opzet. De motor
// van dit spel draait in de browser, en daar bestaat geen bestandssysteem: `winston` kan daar
// niet eens geladen worden. Tegelijk wil je je logs wél in een .log-bestand, en later op een
// server. De enige vorm die allebei aankan is deze: de motor roept hier iets aan, en waar die
// regel daarna terechtkomt, beslist degene die het spel opstart.
//
// Zonder aangehaakte bestemming doet loggen niets. Dat is de veilige stand: een test die geen
// logs wil, krijgt er geen, en de motor blijft even snel.
//
// De niveaus en de vorm van een regel zijn bewust dezelfde als die van winston (error, warn,
// info, debug). Wil je later echt winston op de server, dan schrijf je één bestemming van
// vijftien regels die `record` doorgeeft aan `winston.log()`, en verandert er verder niets.

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export interface LogRecord {
  /** Wanneer, in ISO-vorm. */
  time: string;
  level: LogLevel;
  /** Welk deel van het spel dit schreef, bijvoorbeeld 'brein'. */
  scope: string;
  message: string;
  /** Wat er verder bij hoort: cijfers, stappen, namen. */
  meta?: Record<string, unknown>;
}

/** Een bestemming: een bestand, de terminal, de console, een server. */
export type LogSink = (record: LogRecord) => void;

interface Attached {
  sink: LogSink;
  level: LogLevel;
}

let sinks: Attached[] = [];

/**
 * Haak een bestemming aan. Geeft een functie terug die hem weer loskoppelt, zodat een test
 * kan meelezen zonder dat de volgende test zijn regels erbij krijgt.
 */
export function addSink(sink: LogSink, level: LogLevel = 'info'): () => void {
  const entry: Attached = { sink, level };
  sinks.push(entry);
  return () => {
    sinks = sinks.filter((s) => s !== entry);
  };
}

/** Alle bestemmingen loskoppelen. */
export function clearSinks(): void {
  sinks = [];
}

/** Draait er iets mee? Handig om werk over te slaan dat alleen voor de log nodig is. */
export function logging(level: LogLevel = 'info'): boolean {
  return sinks.some((s) => ORDER[level] <= ORDER[s.level]);
}

export function log(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (!sinks.length) return;
  const record: LogRecord = { time: new Date().toISOString(), level, scope, message, ...(meta ? { meta } : {}) };
  for (const s of sinks) {
    if (ORDER[level] > ORDER[s.level]) continue;
    try {
      s.sink(record);
    } catch {
      // Een kapotte bestemming mag nooit het spel stilleggen.
    }
  }
}

export const logError = (scope: string, message: string, meta?: Record<string, unknown>) => log('error', scope, message, meta);
export const logWarn = (scope: string, message: string, meta?: Record<string, unknown>) => log('warn', scope, message, meta);
export const logInfo = (scope: string, message: string, meta?: Record<string, unknown>) => log('info', scope, message, meta);
export const logDebug = (scope: string, message: string, meta?: Record<string, unknown>) => log('debug', scope, message, meta);

/**
 * Eén regel in leesbare vorm, voor in een bestand of een terminal.
 *
 * Meerregelige inhoud — de stappen van een berekening — komt eronder met inspringing, zodat je
 * met `grep` nog altijd op de kopregel kunt zoeken en de uitleg erbij ziet staan.
 */
export function formatRecord(r: LogRecord): string {
  const kop = `${r.time} ${r.level.padEnd(5)} [${r.scope}] ${r.message}`;
  if (!r.meta) return kop;
  const regels: string[] = [];
  for (const [sleutel, waarde] of Object.entries(r.meta)) {
    if (Array.isArray(waarde)) {
      regels.push(`    ${sleutel}:`);
      for (const v of waarde) regels.push(`      - ${String(v)}`);
    } else if (waarde !== undefined) {
      regels.push(`    ${sleutel}: ${typeof waarde === 'object' ? JSON.stringify(waarde) : String(waarde)}`);
    }
  }
  return regels.length ? `${kop}\n${regels.join('\n')}` : kop;
}
