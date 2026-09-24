// Laat TypeScript weten dat CSS-bestanden geïmporteerd mogen worden (Vite verwerkt ze).
declare module '*.css';

// Vite zet hier zijn eigen vlaggen in. We gebruiken er één: DEV is waar tijdens `npm run dev`
// en onwaar in een gebouwde versie, zodat het logboek alleen doorgestuurd wordt als er een
// server is om het te ontvangen.
interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean; readonly MODE: string };
}
