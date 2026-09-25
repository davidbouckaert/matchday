// Sneltoetsen: één plek voor de labels, zodat knop, tooltip en handleiding
// hetzelfde zeggen.
//
// "Volgende week" zit bewust achter een combo (Ctrl/Cmd+Enter): een losse toets speelde
// te makkelijk per ongeluk een week door — precies de klacht over de oude spatiebalk.
// Bureau is gewone navigatie, dus daar volstaat een losse B.

/** Draait dit op een Mac-toetsenbord? Bepaalt of we ⌘ of Ctrl tonen. */
export const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Kort, voor in de knop zelf. */
export const WEEK_KBD = MAC ? '⌘↵' : 'Ctrl+↵';

/** Voluit, voor in tooltips en de handleiding. */
export const WEEK_COMBO = MAC ? 'Cmd+Enter' : 'Ctrl+Enter';

/** De kbd-chip in een knoplabel. Verdwijnt op aanraakschermen (zie style.css). */
export function kbd(label: string): string {
  return `<kbd class="knop-kbd">${label}</kbd>`;
}
