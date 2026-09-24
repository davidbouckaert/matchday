import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// base './' zorgt dat de build ook werkt op GitHub Pages (in een submap).
// De cloudflare-plugin bouwt en test de Worker (worker/index.ts, zie wrangler.jsonc) mee, zodat
// `npm run dev` en `npm run build` ook lokaal weten dat /api/log ergens anders naartoe gaat dan
// de rest van de site.
export default defineConfig({
  base: './',
  plugins: [cloudflare()],
});
