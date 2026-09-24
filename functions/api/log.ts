// Het ontvangststuk van het logboek op een echte server: een Cloudflare Pages Function.
//
// De motor roept hier niets rechtstreeks aan — die kent alleen src/log/logger.ts. De browser
// stuurt gebundelde regels naar dit adres (zie src/log/browser.ts), en dit stukje schrijft ze
// weg met console.log. Dat is de "bestemming van vijftien regels" die src/log/logger.ts altijd
// al beloofde: leesbaar, live te volgen met `wrangler pages deployment tail`, zonder dat de
// motor ooit wist dat hij op een server terechtkomt.
//
// Wat hier bewust niet staat: een gedeeld geheim of een limiet per IP-adres. Dit adres is
// publiek bereikbaar en kan dus volgespamd worden — dat is een gekende, nog openstaande knoop,
// geen vergeten detail.

import { formatRecord, type LogRecord } from '../../src/log/logger';

const MAX_BODY_BYTES = 2_000_000; // een op hol geslagen logboek mag de functie niet laten crashen

function isLogRecord(waarde: unknown): waarde is LogRecord {
  if (typeof waarde !== 'object' || waarde === null) return false;
  const r = waarde as Record<string, unknown>;
  return typeof r.time === 'string' && typeof r.level === 'string' && typeof r.scope === 'string' && typeof r.message === 'string';
}

/** Haalt geldige logregels uit het verzoeklichaam; onleesbare of gemankeerde regels vallen weg. */
export function parseLogBody(body: string): LogRecord[] {
  const data: unknown = JSON.parse(body);
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).records)) return [];
  return ((data as Record<string, unknown>).records as unknown[]).filter(isLogRecord);
}

interface PagesRequestContext {
  request: Request;
}

export async function onRequestPost({ request }: PagesRequestContext): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  try {
    for (const record of parseLogBody(body)) console.log(formatRecord(record));
  } catch {
    // Een onleesbaar pakketje logregels is geen reden om de functie te laten struikelen.
  }
  return new Response(null, { status: 204 });
}
