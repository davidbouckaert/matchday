// Clublogo's: eenvoudige wapenschilden in de clubkleuren. Je kiest er één bij de start.

export const CREST_SHAPES = ['schild', 'rond', 'wimpel', 'ruit', 'ster'] as const;
export type CrestShape = (typeof CREST_SHAPES)[number];

export const CREST_LABEL: Record<CrestShape, string> = {
  schild: 'Klassiek schild',
  rond: 'Ronde badge',
  wimpel: 'Wimpel',
  ruit: 'Ruit',
  ster: 'Ster',
};

/** Tekent het logo als SVG. `initials` zijn een of twee letters uit de clubnaam. */
export function crestSvg(shape: CrestShape, colors: [string, string], initials: string, size = 44): string {
  const [a, b] = colors;
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
  return `<svg class="crest-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    ${body}
    <text x="50" y="${shape === 'wimpel' ? 56 : 60}" text-anchor="middle" font-size="34" font-weight="700" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="1">${initials}</text>
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
