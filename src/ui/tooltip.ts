// Tooltips. Eén plek, zodat ze overal hetzelfde werken.
//
// Niet de tooltip van de browser: die is klein, traag, staat waar je muis toevallig is
// en verdwijnt terwijl je leest. Deze verschijnt altijd op dezelfde plek — rechtsonder in
// beeld — in een formaat dat je zonder moeite leest. Je ogen weten dus waar te kijken, en
// de uitleg dekt nooit af waar je net naar wees.
//
// Gebruik:
//   <span ${tip('uitleg')}>tekst</span>          een woord met een stippellijn eronder
//   ${hint('uitleg')}                            een vraagteken naast een titel
//   <button ${tip('wat deze knop doet')}>…       werkt op elk element

import { esc } from './format';

/** Het attribuut dat de uitleg draagt. Eén naam, overal. */
export const TIP_ATTR = 'data-tip';

/** Zet dit in een tag: `<span ${tip('uitleg')}>tekst</span>`. */
export function tip(text: string, title?: string): string {
  return `class="has-tip" ${TIP_ATTR}="${esc(text)}"${title ? ` data-tip-title="${esc(title)}"` : ''}`;
}

/**
 * Hetzelfde, maar voor een element dat al een class heeft. Geeft alleen het attribuut
 * terug, zodat je je eigen class kunt blijven schrijven.
 */
export function tipAttr(text: string, title?: string): string {
  return `${TIP_ATTR}="${esc(text)}"${title ? ` data-tip-title="${esc(title)}"` : ''}`;
}

/** Een klein vraagteken met uitleg, voor naast een titel of label. */
export function hint(text: string, title?: string): string {
  return `<button type="button" class="hint" ${TIP_ATTR}="${esc(text)}"${title ? ` data-tip-title="${esc(title)}"` : ''} aria-label="Uitleg: ${esc(text)}">?</button>`;
}

/* ------------------------------------------------------------------ het paneel */

let panel: HTMLElement | null = null;
let hideTimer: number | undefined;
let pinned = false; // op aanraking of na een klik blijft hij staan tot je ergens anders klikt

function ensurePanel(): HTMLElement {
  if (panel && panel.isConnected) return panel;
  panel = document.createElement('div');
  panel.className = 'tip-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  document.body.appendChild(panel);
  return panel;
}

function show(el: HTMLElement): void {
  if (!el.isConnected || el.closest('[inert]')) return;
  if (document.querySelector('.overlay, .moment-overlay') && !el.closest('.overlay, .moment-overlay')) return;
  const text = el.getAttribute(TIP_ATTR);
  if (!text) return;
  const title = el.getAttribute('data-tip-title');
  const p = ensurePanel();
  window.clearTimeout(hideTimer);
  p.innerHTML = `${title ? `<strong class="tip-title">${esc(title)}</strong>` : ''}<span class="tip-text">${esc(text)}</span>`;
  p.hidden = false;
  p.classList.add('on');
}

function hide(immediate = false): void {
  if (pinned && !immediate) return;
  window.clearTimeout(hideTimer);
  // een korte nasleep: ga je met de muis van het ene naar het andere woord, dan flikkert het niet
  hideTimer = window.setTimeout(() => {
    panel?.classList.remove('on');
    if (panel) panel.hidden = true;
  }, immediate ? 0 : 120);
}

/** Het dichtstbijzijnde element met uitleg, ook als je op iets erbinnen wijst. */
function tipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? (node.closest(`[${TIP_ATTR}]`) as HTMLElement | null) : null;
}

/**
 * Eén keer aanzetten bij het opstarten. Werkt met delegatie, dus schermen die opnieuw
 * getekend worden hoeven niets te doen — en tooltips overleven een hertekening.
 */
export function initTooltips(): void {
  document.addEventListener(
    'pointerover',
    (e) => {
      const el = tipTarget(e.target);
      if (el) {
        pinned = false;
        show(el);
      } else if (!pinned) hide();
    },
    { passive: true },
  );

  // toetsenbord: wie tabt, krijgt dezelfde uitleg
  document.addEventListener('focusin', (e) => {
    const el = tipTarget(e.target);
    if (el) {
      pinned = false;
      show(el);
    }
  });
  document.addEventListener('focusout', () => hide());

  // aanraking en klik: blijft staan tot je ergens anders tikt
  document.addEventListener('click', (e) => {
    const el = tipTarget(e.target);
    if (el) {
      pinned = true;
      show(el);
      // een vraagteken is alleen een vraagteken: laat het geen knop-actie worden
      if ((e.target as Element).classList?.contains('hint')) e.preventDefault();
      return;
    }
    pinned = false;
    hide(true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      pinned = false;
      hide(true);
    }
  });

  // tijdens het scrollen is de uitleg meestal niet meer wat je zoekt
  window.addEventListener('scroll', () => !pinned && hide(true), { passive: true });
}

/** Een tip hoort bij zijn bronnode; na hertekenen is die context verdwenen. */
export function dismissTooltips(): void {
  pinned = false;
  window.clearTimeout(hideTimer);
  panel?.classList.remove('on');
  if (panel) panel.hidden = true;
}
