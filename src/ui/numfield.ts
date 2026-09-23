// Getalinvoer. Eén component, overal dezelfde.
//
// De ingebouwde pijltjes van `<input type="number">` zijn een paar pixels groot, ze
// verschijnen pas als je over het veld zweeft, en op de ene browser staan ze links en op
// de andere rechts. Onbruikbaar voor iets waar je elke week aan draait.
//
// Hier zijn het twee echte knoppen van volle hoogte, met het tekstveld ertussen. Je kunt
// dus nog altijd gewoon een getal intikken — dat blijft de snelste manier als je precies
// weet wat je wil — maar één euro erbij is één klik op een knop die je kunt raken.
// Ingedrukt houden laat het getal doorlopen, en shift maakt de stap tien keer zo groot.

import { esc } from './format';

export interface NumFieldOpts {
  /** Waarde en grenzen. */
  value: number;
  min?: number;
  max?: number;
  /** De stap van één klik. */
  step?: number;
  /** Het aantal cijfers na de komma (voor prijzen aan de toog). */
  decimals?: number;
  /** Wat er voor of achter het getal staat: '€' of '%'. */
  prefix?: string;
  suffix?: string;
  /**
   * Het id dat in data-change terechtkomt, plus een eventuele rij-id. Laat het weg voor
   * een veld dat pas uitgelezen wordt als je op een knop ernaast drukt (een loonvoorstel,
   * een vraagprijs): dan hoeft elke toetsaanslag niets te boeken.
   */
  change?: string;
  rowId?: string;
  /** Een eigen id op het invoerveld, als een ander stuk code het moet uitlezen. */
  inputId?: string;
  label: string;
  /** Een schuifbalk onder het veld. Alleen zinvol bij een duidelijk bereik. */
  slider?: boolean;
  /** Extra classes op de buitenste doos. */
  extra?: string;
  /** Laat iets anders op het scherm meerekenen terwijl je typt (zie data-live in main.ts). */
  live?: string;
}

/**
 * Bouwt het veld. De knoppen dragen alles wat ze nodig hebben in hun data-attributen,
 * zodat de afhandeling in main.ts generiek kan blijven: zij rekent de nieuwe waarde uit,
 * schrijft ze in het veld en vuurt hetzelfde change-event als wanneer jij zelf typt.
 */
export function numField(o: NumFieldOpts): string {
  const step = o.step ?? 1;
  const dec = o.decimals ?? 0;
  const id = o.inputId ?? `num-${o.change ?? 'veld'}${o.rowId ? `-${o.rowId}` : ''}`;
  const bounds = `${o.min !== undefined ? ` data-min="${o.min}"` : ''}${o.max !== undefined ? ` data-max="${o.max}"` : ''}`;
  const row = o.rowId ? ` data-id="${esc(o.rowId)}"` : '';
  const btn = (dir: -1 | 1) =>
    `<button type="button" class="numbtn ${dir < 0 ? 'minus' : 'plus'}" data-action="num-step" data-for="${id}" data-dir="${dir}"
       aria-label="${dir < 0 ? 'Minder' : 'Meer'}: ${esc(o.label)}" tabindex="-1">${dir < 0 ? '−' : '+'}</button>`;

  // Hoe breed moet het tekstvak zijn?
  //
  // Het had een vaste minimumbreedte, en die wist niets van het getal dat erin moest. Bij
  // een lidgeld van €230 in een veld dat tot €800 loopt bleef er veertig pixels over, en
  // dan las je "23(" — de nul viel eruit.
  //
  // De eerste poging rekende de breedte uit in `ch`. Dat leek de juiste eenheid (`1ch` is
  // de breedte van een nul) maar klopte niet: de browser gaf hier 8,1 pixels per `ch`
  // terwijl de cijfers in dit vette, tabellarische lettertype er ruim veertien innemen.
  // Vijf `ch` was dus veertig pixels voor een getal dat er zevenenveertig nodig had.
  //
  // Daarom nu `size`, het attribuut dat precies hiervoor bestaat: de browser meet zelf hoe
  // breed dat aantal tekens is in het lettertype dat er echt staat. Wij tellen alleen hoe
  // veel tekens het grootst mogelijke getal telt, inclusief duizendpunten en decimalen.
  const grootste = Math.max(Math.abs(o.max ?? o.value * 10), Math.abs(o.value), 1);
  const chars = Math.max(Math.floor(grootste).toLocaleString('nl-BE').length + (dec ? dec + 1 : 0), 2);

  return `<div class="numfield${o.slider ? ' with-slider' : ''}${o.extra ? ` ${o.extra}` : ''}">
    <div class="numrow">
      ${btn(-1)}
      <span class="numbox">
        ${o.prefix ? `<span class="affix pre">${esc(o.prefix)}</span>` : ''}
        <input id="${id}" type="text" inputmode="decimal" class="numinput" size="${chars}"
          value="${o.value.toFixed(dec)}" data-step="${step}" data-dec="${dec}"${bounds}
          ${o.change ? `data-change="${esc(o.change)}"` : ''}${o.live ? ` data-live="${esc(o.live)}"` : ''}${row} aria-label="${esc(o.label)}"/>
        ${o.suffix ? `<span class="affix post">${esc(o.suffix)}</span>` : ''}
      </span>
      ${btn(1)}
    </div>
    ${
      o.slider && o.min !== undefined && o.max !== undefined
        ? `<input type="range" class="numslider" min="${o.min}" max="${o.max}" step="${step}" value="${o.value}"
             data-slider-for="${id}" aria-label="${esc(o.label)} (schuifbalk)" tabindex="-1"/>`
        : ''
    }
  </div>`;
}

/* ------------------------------------------------------------------ afhandeling */

const num = (v: string | null, fallback: number) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

/** Leest de grenzen en de stap die in het veld zelf staan. */
function specs(input: HTMLInputElement) {
  return {
    step: num(input.dataset.step ?? null, 1),
    dec: num(input.dataset.dec ?? null, 0),
    min: input.dataset.min === undefined ? -Infinity : num(input.dataset.min, -Infinity),
    max: input.dataset.max === undefined ? Infinity : num(input.dataset.max, Infinity),
  };
}

/** Zet een nieuwe waarde in het veld en laat de rest van de app het weten. */
function commit(input: HTMLInputElement, value: number, live: boolean): void {
  const { dec, min, max } = specs(input);
  const clamped = Math.min(max, Math.max(min, value));
  input.value = clamped.toFixed(dec);
  const slider = document.querySelector<HTMLInputElement>(`[data-slider-for="${input.id}"]`);
  if (slider) slider.value = String(clamped);
  // 'input' voor wie meeleest terwijl je sleept, 'change' voor wie pas bij het loslaten boekt
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (!live) input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Eén stap erbij of eraf. Shift maakt de stap tien keer zo groot. */
function stepOnce(input: HTMLInputElement, dir: number, big: boolean): void {
  const { step } = specs(input);
  commit(input, num(input.value, 0) + dir * step * (big ? 10 : 1), false);
}

/**
 * Eén keer aanzetten bij het opstarten. Alles via delegatie, zodat een hertekend scherm
 * vanzelf meedoet.
 */
export function initNumFields(): void {
  let repeat: number | undefined;
  let accelerate: number | undefined;

  const stop = () => {
    window.clearInterval(repeat);
    window.clearTimeout(accelerate);
    repeat = undefined;
    accelerate = undefined;
  };

  document.addEventListener('pointerdown', (e) => {
    const btn = (e.target as Element)?.closest?.('.numbtn') as HTMLElement | null;
    if (!btn) return;
    const input = document.getElementById(btn.dataset.for ?? '') as HTMLInputElement | null;
    if (!input) return;
    e.preventDefault(); // niet het veld verliezen dat je aan het aanpassen bent
    const dir = Number(btn.dataset.dir ?? 1);
    const big = (e as PointerEvent).shiftKey;
    const fieldId = input.id;
    stepOnce(input, dir, big);
    // ingedrukt houden: eerst een pauze, dan doorlopen, en na een tijdje sneller
    accelerate = window.setTimeout(() => {
      repeat = window.setInterval(() => stopOrStep(fieldId, dir, big), 110);
      window.setTimeout(() => {
        if (!repeat) return;
        window.clearInterval(repeat);
        repeat = window.setInterval(() => stopOrStep(fieldId, dir, big), 40);
      }, 1400);
    }, 420);
  });

  /**
   * Elke stap kan een hertekening uitlokken, waarna het oude element weg is. We zoeken
   * het veld dus elke keer opnieuw op zijn id in plaats van het vast te houden —
   * anders stopt de knop met doorlopen zodra er iets geboekt wordt.
   */
  const stopOrStep = (fieldId: string, dir: number, big: boolean) => {
    const live = document.getElementById(fieldId) as HTMLInputElement | null;
    if (!live) return stop();
    stepOnce(live, dir, big);
  };

  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) {
    document.addEventListener(ev, stop, true);
  }

  // de schuifbalk stuurt het tekstveld aan, niet omgekeerd
  document.addEventListener('input', (e) => {
    const slider = e.target as HTMLInputElement;
    if (!slider.matches?.('.numslider')) return;
    const input = document.getElementById(slider.dataset.sliderFor ?? '') as HTMLInputElement | null;
    if (input) commit(input, num(slider.value, 0), true);
  });
  document.addEventListener('change', (e) => {
    const slider = e.target as HTMLInputElement;
    if (!slider.matches?.('.numslider')) return;
    const input = document.getElementById(slider.dataset.sliderFor ?? '') as HTMLInputElement | null;
    if (input) commit(input, num(slider.value, 0), false);
  });

  // pijltjestoetsen in het veld zelf, zoals bij een echt getalveld
  document.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches?.('.numinput')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepOnce(input, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
    }
    if (e.key === 'Enter') input.blur(); // afsluiten en boeken
  });

  // wat je intikt hoeft pas te kloppen als je het veld verlaat
  document.addEventListener(
    'blur',
    (e) => {
      const input = e.target as HTMLInputElement;
      if (input.matches?.('.numinput')) commit(input, num(input.value, 0), false);
    },
    true,
  );
}
