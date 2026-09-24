// Laat TypeScript weten dat CSS-bestanden geïmporteerd mogen worden (Vite verwerkt ze).
declare module '*.css';

// Vite zet hier zijn eigen vlaggen in. We gebruiken er één: PROD is waar in een gebouwde versie
// en onwaar tijdens `npm run dev`, zodat het logboek alleen naar een server gestuurd wordt als
// die er ook echt is (functions/api/log.ts, dat alleen op de productiehost draait).
interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean; readonly MODE: string };
}
