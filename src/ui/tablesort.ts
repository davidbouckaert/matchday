// Sorteren van een tabel op een kolom.
//
// Dit zat als twintig regels in main.ts en was op drie manieren stuk.
//
// 1. Het haalde de duizendpunten uit elk getal — nodig voor "€1.234", maar fataal voor een
//    `data-v` die rechtstreeks uit een JavaScript-getal komt. De tevredenheid van een
//    sponsor is een kommagetal, dus `data-v="60.34210371"` werd 6.034.210.371. Elke sponsor
//    kreeg zo een willekeurig getal van tien cijfers en de kolom stond volledig door elkaar.
//
// 2. Het besliste per cel of die een getal was. Een kolom met één streepje ertussen leverde
//    dus deels getallen en deels tekst op, en de vergelijking viel dan terug op tekst — maar
//    alleen voor dát paar. Een sorteervergelijking die niet voor alle paren hetzelfde doet,
//    is niet transitief: de browser mag er dan élke volgorde uit laten komen, en dat deed hij.
//
// 3. Bij tekst nam het de volledige inhoud van de cel. In de spelerstabel staat daar naast
//    de naam ook ★, "eigen jeugd", "2 wedstrijden geschorst" en zijn karakter in. A–Z
//    sorteerde dus op naam-plus-alles-eromheen.
//
// Daarom bepaalt dit bestand het soort van de hele kolom in één keer, laat het `data-v` met
// rust omdat wij dat zelf schrijven, en neemt het bij tekst alleen de kop van de cel.

/** Wat er in een cel staat als sorteerwaarde: een getal, of anders tekst. */
export interface SortKey {
  /** Het getal, of null als deze cel geen getal bevat. */
  num: number | null;
  /** De tekst waarop gesorteerd wordt als de kolom geen getallenkolom is. */
  text: string;
  /** Een lege cel of een streepje: die hoort altijd onderaan, hoe je ook sorteert. */
  empty: boolean;
}

const PLACEHOLDER = new Set(['', '-', '–', '—', '·', 'n.v.t.']);

/**
 * Een Nederlands geschreven getal naar een echt getal.
 *
 * "€1.234,50" is duizend tweehonderdvierendertig euro vijftig; "1.234" is duizend
 * tweehonderdvierendertig; "3,5" is drieënhalf. Het punt is dus alleen een duizendteken als
 * het ook echt op die plaats staat — anders is het gewoon een decimaalpunt.
 */
export function parseDutchNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[€%\s  ]/g, '')
    // de pijltjes zijn versiering: het minteken staat al in de tekst zelf
    .replace(/^[▲▼]/, '')
    .replace(/[a-z]+$/i, ''); // "12w" → "12"
  if (!cleaned || PLACEHOLDER.has(cleaned)) return null;

  let normalised = cleaned;
  if (cleaned.includes(',')) {
    // komma = decimaalteken, dus elk punt is een duizendteken
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // alleen punten, en ze staan precies om de drie cijfers: duizendtekens
    normalised = cleaned.replace(/\./g, '');
  }

  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/**
 * De kop van een cel: de naam, niet alles wat er als kaartje achter hangt.
 *
 * Staat er een `<strong>` vooraan, dan is dát waar de cel over gaat. Anders nemen we de
 * tekst tot de eerste regelovergang.
 */
function headText(cell: HTMLTableCellElement): string {
  const strong = cell.querySelector('strong');
  if (strong?.textContent?.trim()) return strong.textContent.trim();
  const first = (cell.textContent ?? '').split('\n')[0];
  return first.trim();
}

/** De sorteerwaarde van één cel. */
export function keyOf(cell: HTMLTableCellElement | undefined): SortKey {
  if (!cell) return { num: null, text: '', empty: true };

  // `data-v` schrijven wij zelf, rechtstreeks uit een JavaScript-getal. Daar hoort geen
  // enkele opschoning op: "60.34210371" is zestig komma drie, niet zes miljard.
  const raw = cell.dataset.v;
  if (raw !== undefined) {
    const n = Number(raw);
    if (Number.isFinite(n)) return { num: n, text: raw, empty: false };
    return { num: null, text: raw.toLowerCase(), empty: PLACEHOLDER.has(raw.trim()) };
  }

  const text = headText(cell);
  if (PLACEHOLDER.has(text)) return { num: null, text: '', empty: true };
  return { num: parseDutchNumber(text), text: text.toLowerCase(), empty: false };
}

/**
 * Sorteert de rijen op één kolom.
 *
 * Het soort van de kolom wordt één keer bepaald, over alle rijen samen: pas als élke gevulde
 * cel een getal oplevert, is het een getallenkolom. Zo kan de vergelijking niet halverwege
 * van methode wisselen, en blijft de volgorde die eruit komt dezelfde als je nog eens sorteert.
 */
export function sortRows(rows: HTMLTableRowElement[], col: number, dir: 1 | -1): HTMLTableRowElement[] {
  const keys = new Map<HTMLTableRowElement, SortKey>();
  for (const row of rows) keys.set(row, keyOf(row.cells[col]));

  const gevuld = [...keys.values()].filter((k) => !k.empty);
  const numeriek = gevuld.length > 0 && gevuld.every((k) => k.num !== null);

  // stabiel blijven bij gelijke waarden: de oorspronkelijke volgorde als laatste scheidsrechter
  const index = new Map(rows.map((r, i) => [r, i]));

  return [...rows].sort((a, b) => {
    const ka = keys.get(a)!;
    const kb = keys.get(b)!;
    // lege cellen onderaan, ongeacht de richting — "geen waarde" is geen kleine waarde
    if (ka.empty !== kb.empty) return ka.empty ? 1 : -1;
    if (ka.empty && kb.empty) return index.get(a)! - index.get(b)!;

    const verschil = numeriek
      ? ka.num! - kb.num!
      : ka.text.localeCompare(kb.text, 'nl', { numeric: true, sensitivity: 'base' });

    return verschil !== 0 ? verschil * dir : index.get(a)! - index.get(b)!;
  });
}
