// De bestemming voor het spel zoals jij het speelt: in een browser.
//
// Twee dingen tegelijk. De console van je browser, zodat je live kunt meekijken terwijl je
// speelt. En — als er een `endpoint` is opgegeven — dezelfde regels naar een echte server, zodat
// jij als eigenaar van het project kunt meekijken bij wie er ook speelt. Wie het spel opstart
// beslist of en waarheen: zonder endpoint blijft het bij de console.
//
// Op productie (Cloudflare Pages) wijst dat endpoint naar functions/api/log.ts. Tijdens
// `npm run dev` bestaat dat pad niet, dus daar hoort geen endpoint aan te hangen — dan zou
// lokaal testen tussen de regels van echte spelers terechtkomen.

import { addSink, formatRecord, type LogLevel, type LogRecord } from './logger';

export interface BrowserLogOptions {
  level?: LogLevel;
  /** Waar de regels heen gestuurd worden. Leeg (null of weggelaten) betekent: alleen de console. */
  endpoint?: string | null;
  /** Ook naar de console van je browser? */
  console?: boolean;
}

const BATCH_MS = 1000;
const BATCH_MAX = 50;

/**
 * Haak de browserbestemming aan.
 *
 * Regels worden per seconde gebundeld doorgestuurd in plaats van één voor één: een week
 * simuleren schrijft er tientallen, en evenveel losse verzoeken zou je beeld laten haperen.
 */
export function attachBrowserLog(opts: BrowserLogOptions = {}): () => void {
  const endpoint = opts.endpoint ?? null;
  const naarConsole = opts.console ?? true;
  let wachtrij: LogRecord[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const verstuur = (): void => {
    timer = null;
    if (!wachtrij.length || !endpoint) return;
    const lading = JSON.stringify({ records: wachtrij });
    wachtrij = [];
    // keepalive zorgt dat de laatste regels nog vertrekken als je het tabblad sluit.
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: lading, keepalive: true }).catch(() => {
      // Geen server bereikbaar: dan blijft het bij de console.
    });
  };

  const detach = addSink((r: LogRecord) => {
    if (naarConsole) {
      const tekst = formatRecord(r);
      if (r.level === 'error') console.error(tekst);
      else if (r.level === 'warn') console.warn(tekst);
      else if (r.level === 'debug') console.debug(tekst);
      else console.info(tekst);
    }
    if (!endpoint) return;
    wachtrij.push(r);
    if (wachtrij.length >= BATCH_MAX) {
      if (timer) clearTimeout(timer);
      verstuur();
    } else if (!timer) {
      timer = setTimeout(verstuur, BATCH_MS);
    }
  }, opts.level ?? 'info');

  return () => {
    if (timer) clearTimeout(timer);
    verstuur();
    detach();
  };
}
