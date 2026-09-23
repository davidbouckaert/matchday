// Clublogo's: eenvoudige wapenschilden in de clubkleuren. Je kiest er één bij de start.
//
// Twee dingen die misgingen zodra een club wit in haar kleuren had. De witte helft van
// het schild liep naadloos over in de witte kaart eronder, zodat je een halve vorm zag
// zweven. En de initialen stonden altijd in het wit, dus op die witte helft waren ze weg.
//
// Daarom heeft elk logo nu een omtrek in een kleur die tegen de ondergrond afsteekt, en
// kiezen de initialen hun kleur op basis van de twee helften samen, met een randje in de
// tegenkleur eromheen zodat ze op allebei leesbaar blijven.

import { inkForPair } from './theme';

export const CREST_SHAPES = ['schild', 'rond', 'wimpel', 'ruit', 'ster'] as const;
export type CrestShape = (typeof CREST_SHAPES)[number];

export const CREST_LABEL: Record<CrestShape, string> = {
  schild: 'Klassiek schild',
  rond: 'Ronde badge',
  wimpel: 'Wimpel',
  ruit: 'Ruit',
  ster: 'Ster',
};

/** De omtreklijn van elk logo: één pad per vorm, zodat de silhouet altijd leesbaar is. */
const OUTLINE: Record<CrestShape, string> = {
  schild: '<path d="M50 6 L92 20 V52 C92 76 72 90 50 96 C28 90 8 76 8 52 V20 Z"/>',
  rond: '<circle cx="50" cy="50" r="44"/>',
  wimpel: '<path d="M12 8 H88 V72 L50 94 L12 72 Z"/>',
  ruit: '<path d="M50 4 L94 50 L50 96 L6 50 Z"/>',
  ster: '<circle cx="50" cy="50" r="44"/>',
};

/** Tekent het logo als SVG. `initials` zijn een of twee letters uit de clubnaam. */
export function crestSvg(shape: CrestShape, colors: [string, string], initials: string, size = 44): string {
  const [a, b] = colors;
  const ink = inkForPair(a, b);
  const body =
    shape === 'schild'
      ? `<path d="M50 6 L92 20 V52 C92 76 72 90 50 96 C28 90 8 76 8 52 V20 Z" fill="${a}"/><path d="M50 6 L92 20 V52 C92 76 72 90 50 96 Z" fill="${b}"/>`
      : shape === 'rond'
        ? `<circle cx="50" cy="50" r="44" fill="${a}"/><path d="M50 6 A44 44 0 0 1 50 94 Z" fill="${b}"/><circle cx="50" cy="50" r="44" fill="none" stroke="${b}" stroke-width="5"/>`
        : shape === 'wimpel'
          ? `<path d="M12 8 H88 V72 L50 94 L12 72 Z" fill="${a}"/><path d="M50 8 H88 V72 L50 94 Z" fill="${b}"/>`
          : shape === 'ruit'
            ? `<path d="M50 4 L94 50 L50 96 L6 50 Z" fill="${a}"/><path d="M50 4 L94 50 L50 96 Z" fill="${b}"/>`
            : `<circle cx="50" cy="50" r="44" fill="${a}"/><path d="M50 14 L61 40 L89 42 L67 60 L74 88 L50 72 L26 88 L33 60 L11 42 L39 40 Z" fill="${b}"/>`;
  // de omtrek staat bovenop de vlakken, zodat ze ook een witte helft afboordt
  const outline = OUTLINE[shape].replace('/>', ' fill="none" stroke="var(--crest-line, rgba(0,0,0,.28))" stroke-width="4" stroke-linejoin="round"/>');
  return `<svg class="crest-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    ${body}
    ${outline}
    <text x="50" y="${shape === 'wimpel' ? 56 : 60}" text-anchor="middle" font-size="34" font-weight="700"
      fill="${ink.fill}" stroke="${ink.halo}" stroke-width="2.6" paint-order="stroke fill">${initials}</text>
  </svg>`;
}

/** Eén of twee letters uit de clubnaam, zonder de gebruikelijke voorvoegsels. */
export function clubInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => !['kfc', 'kvk', 'ksk', 'vk', 'fc', 'sk', 'kv'].includes(w.toLowerCase()));
  const source = words.length ? words : name.split(/\s+/);
  return source
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
