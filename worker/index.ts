// De Cloudflare Worker naast de statische site. wrangler.jsonc stuurt alleen /api/* hierheen
// (run_worker_first); al het overige bedient Cloudflare rechtstreeks vanuit dist/, zonder dat dit
// bestand ooit aangeroepen wordt.
//
// Dit is het ontvangststuk van het logboek op een echte server — de "bestemming van vijftien
// regels" die src/log/logger.ts altijd al beloofde. "observability.enabled" in wrangler.jsonc
// maakt console.log hier live doorzoekbaar in het Cloudflare-dashboard, zonder extra dienst.
//
// Wat hier bewust niet staat: een gedeeld geheim of een limiet per IP-adres. Dit adres is
// publiek bereikbaar en kan dus volgespamd worden — een gekende, nog openstaande knoop.

import { formatRecord } from '../src/log/logger';
import { parseLogBody } from '../src/log/parseRecords';
import { VERSION } from '../src/version';

const MAX_BODY_BYTES = 2_000_000; // een op hol geslagen logboek mag de Worker niet laten crashen

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Welke versie draait hier? Hetzelfde nummer als onderaan elke pagina en als de git-tag,
    // maar opvraagbaar zonder de site te openen — zo zie je over alle systemen heen wat er
    // gedeployed staat: version.ts → git-tag → GitHub → dit adres.
    if (url.pathname === '/api/version') {
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      return new Response(JSON.stringify({ name: 'matchday', version: VERSION }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    if (url.pathname !== '/api/log') return new Response(null, { status: 404 });
    if (request.method !== 'POST') return new Response(null, { status: 405 });

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
    try {
      for (const record of parseLogBody(body)) console.log(formatRecord(record));
    } catch {
      // Een onleesbaar pakketje logregels is geen reden om de Worker te laten struikelen.
    }
    return new Response(null, { status: 204 });
  },
};
