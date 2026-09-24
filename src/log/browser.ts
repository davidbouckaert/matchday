// De bestemming voor het spel zoals jij het speelt: in een browser.
//
// Twee dingen tegelijk. De console van je browser, zodat je live kunt meekijken terwijl je
// speelt. En — als er een ontwikkelserver draait — hetzelfde .log-bestand als de tests en de
// meetscripts gebruiken, zodat je achteraf één bestand hebt met alles erin. Die tweede weg
// loopt via een klein stukje server in vite.config.ts.
//
// In een gebouwde versie op GitHub Pages is er geen server. Dan mislukt het doorsturen
// stilletjes en houd je de console over. Dat hoort zo: een spel mag niet stilvallen omdat
// zijn logboek nergens heen kan.

import { addSink, formatRecord, type LogLevel, type LogRecord } from './logger';

export interface BrowserLogOptions {
  level?: LogLevel;
  /** Waar de regels heen gestuurd worden. Leeg betekent: alleen de console. */
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
  const endpoint = opts.endpoint === undefined ? '/__log' : opts.endpoint;
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
      // Geen server: dan blijft het bij de console.
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
