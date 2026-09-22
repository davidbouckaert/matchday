// Kleine helper voor tooltips. Eén plek, zodat ze overal hetzelfde werken:
// je ziet een stippellijn onder de tekst en de uitleg verschijnt als je erover gaat.

import { esc } from './format';

/** Zet dit in een tag: `<span ${tip('uitleg')}>tekst</span>`. */
export function tip(text: string): string {
  return `class="has-tip" title="${esc(text)}"`;
}

/** Een klein vraagteken met uitleg, voor naast een titel of label. */
export function hint(text: string): string {
  return `<span class="hint" title="${esc(text)}" aria-label="${esc(text)}">?</span>`;
}
