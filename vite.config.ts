import { defineConfig, type Plugin } from 'vite';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const LOG_FILE = resolve('logs/voetbalclub.log');

/**
 * Het ontvangststuk van het logboek.
 *
 * De motor draait in je browser en kan zelf geen bestand schrijven. Hij stuurt zijn regels
 * daarom naar /__log, en dit stukje ontwikkelserver zet ze in hetzelfde .log-bestand dat de
 * tests en de meetscripts gebruiken — en in de terminal waar `npm run dev` draait. Zo heb je
 * één bestand met alles erin, of je nu zelf speelt of een meting laat lopen.
 *
 * Dit draait alleen tijdens ontwikkelen. Een gebouwde versie heeft geen server; daar blijft
 * het bij de console van je browser, tot er later een echte server staat die dit overneemt.
 */
function logCollector(): Plugin {
  return {
    name: 'vcg-log-collector',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(dirname(LOG_FILE), { recursive: true });
      server.middlewares.use('/__log', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 2_000_000) req.destroy(); // een op hol geslagen logboek mag de server niet opeten
        });
        req.on('end', () => {
          try {
            const { records } = JSON.parse(body) as { records: { time: string; level: string; scope: string; message: string; meta?: Record<string, unknown> }[] };
            const regels = records.map((r) => {
              const kop = `${r.time} ${r.level.padEnd(5)} [${r.scope}] ${r.message}`;
              if (!r.meta) return kop;
              const extra = Object.entries(r.meta).flatMap(([k, v]) =>
                Array.isArray(v) ? [`    ${k}:`, ...v.map((x) => `      - ${String(x)}`)] : [`    ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`],
              );
              return extra.length ? `${kop}\n${extra.join('\n')}` : kop;
            });
            if (regels.length) {
              appendFileSync(LOG_FILE, regels.join('\n') + '\n', 'utf8');
              for (const r of regels) server.config.logger.info(r);
            }
          } catch {
            // Een onleesbaar pakketje logregels is geen reden om de server te laten struikelen.
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// base './' zorgt dat de build ook werkt op GitHub Pages (in een submap).
export default defineConfig({
  base: './',
  plugins: [logCollector()],
});
