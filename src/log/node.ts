// De bestemming voor alles wat in Node draait: tests, de meetscripts, en later de server.
//
// Schrijft naar een echt .log-bestand in het project en, als je dat wilt, naar de terminal.
// Dit bestand mag nooit vanuit de motor geïmporteerd worden: `node:fs` bestaat niet in een
// browser en zou de bundel breken. Alleen wie het spel opstart, haakt dit aan.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { addSink, formatRecord, type LogLevel, type LogRecord } from './logger';

export interface FileLogOptions {
  /** Waar het bestand komt. Standaard logs/voetbalclub.log in de projectmap. */
  file?: string;
  /** Vanaf welk niveau er geschreven wordt. */
  level?: LogLevel;
  /** Ook naar de terminal? Standaard ja. */
  terminal?: boolean;
  /** Regels in JSON in plaats van leesbare tekst — makkelijker door te sturen naar een server. */
  json?: boolean;
}

const FLUSH_AT = 200;

/**
 * Haak het logbestand aan.
 *
 * Regels worden opgespaard en in blokken weggeschreven: een meting van zes seizoenen schrijft
 * duizenden regels, en per regel naar de schijf gaan maakt zo'n run merkbaar trager. Wat nog
 * in de buffer zit, gaat bij het afsluiten alsnog naar het bestand.
 */
export function attachFileLog(opts: FileLogOptions = {}): () => void {
  const file = resolve(opts.file ?? 'logs/voetbalclub.log');
  const terminal = opts.terminal ?? true;
  mkdirSync(dirname(file), { recursive: true });

  let buffer: string[] = [];
  const flush = (): void => {
    if (!buffer.length) return;
    const tekst = buffer.join('\n') + '\n';
    buffer = [];
    try {
      appendFileSync(file, tekst, 'utf8');
    } catch {
      // Een log die niet weggeschreven raakt, mag het spel niet stilleggen.
    }
  };

  const detach = addSink((r: LogRecord) => {
    const regel = opts.json ? JSON.stringify(r) : formatRecord(r);
    buffer.push(regel);
    if (buffer.length >= FLUSH_AT) flush();
    if (terminal) process.stdout.write(regel + '\n');
  }, opts.level ?? 'info');

  process.once('exit', flush);

  return () => {
    flush();
    detach();
  };
}

/**
 * Zet het logbestand aan als de omgevingsvariabele erom vraagt, anders niet.
 *
 * Zo kost loggen niets tijdens een gewone testronde en zet je het aan wanneer je wilt
 * meekijken: `VCG_LOG=debug npx mocha` of `VCG_LOG=1 npm run balance`.
 */
export function attachFileLogFromEnv(file?: string): (() => void) | null {
  const vlag = process.env.VCG_LOG;
  if (!vlag || vlag === '0' || vlag === 'false') return null;
  const niveaus: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  const level = (niveaus as string[]).includes(vlag) ? (vlag as LogLevel) : 'debug';
  return attachFileLog({ level, ...(file ? { file } : {}) });
}
