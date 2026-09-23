// De clubkleuren, en hoe ze veilig door de app lopen.
//
// Je kiest bij een nieuw spel een kleurenschema. Dat is niet alleen je logo: het is de
// accentkleur van de hele app — de actieve tab, de primaire knop, de balk van je
// vrijwilligers, de rand van de kaart die je aandacht vraagt.
//
// Dat kan makkelijk fout gaan. Kies je geel, dan is witte tekst op geel onleesbaar; kies
// je marineblauw, dan verdwijnt de zachte variant in de achtergrond. Daarom rekent dit
// bestand elke kleur door in plaats van ze rechtstreeks te gebruiken: het kiest zwarte of
// witte tekst op basis van het contrast, maakt de accentkleur donkerder of lichter tot ze
// de drempel haalt, en bouwt daar de zachte en donkere varianten uit op.
//
// De rekenregels zijn die van WCAG: relatieve helderheid en een contrastverhouding, met
// 4,5:1 als ondergrens voor gewone tekst. De tests in test/theme.test.ts controleren elk
// schema in beide thema's, zodat een nieuw schema er niet in kan glippen als het onleesbaar is.

export interface ColorScheme {
  id: string;
  naam: string;
  /** De hoofdkleur van de club en de tweede kleur, zoals op het shirt. */
  colors: [string, string];
}

/** De schema's die je bij een nieuw spel kunt kiezen. Klassieke Belgische combinaties. */
export const SCHEMES: ColorScheme[] = [
  { id: 'groenwit', naam: 'Groen-wit', colors: ['#1f6f43', '#ffffff'] },
  { id: 'roodwit', naam: 'Rood-wit', colors: ['#c0392b', '#ffffff'] },
  { id: 'blauwwit', naam: 'Blauw-wit', colors: ['#1c4f8c', '#ffffff'] },
  { id: 'geelzwart', naam: 'Geel-zwart', colors: ['#f0c419', '#161616'] },
  { id: 'zwartwit', naam: 'Zwart-wit', colors: ['#20262b', '#ffffff'] },
  { id: 'paarswit', naam: 'Paars-wit', colors: ['#6b2d8c', '#ffffff'] },
  { id: 'oranjeblauw', naam: 'Oranje-blauw', colors: ['#d4650f', '#12395e'] },
  { id: 'bordeauxgoud', naam: 'Bordeaux-goud', colors: ['#7a1f2b', '#d9b45b'] },
  { id: 'lichtblauwwit', naam: 'Hemelsblauw', colors: ['#1f86c4', '#ffffff'] },
  { id: 'groenzwart', naam: 'Groen-zwart', colors: ['#14663d', '#1b1b1b'] },
];

export const DEFAULT_SCHEME = SCHEMES[0];

/* ------------------------------------------------------------------- rekenwerk */

/** #rrggbb naar drie getallen van 0 tot 255. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Relatieve helderheid volgens WCAG. 0 is zwart, 1 is wit. */
export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** De contrastverhouding tussen twee kleuren: 1 is gelijk, 21 is zwart op wit. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Zwarte of witte tekst op deze achtergrond — wat het best leesbaar is. */
export function inkFor(background: string): string {
  return contrast(background, '#ffffff') >= contrast(background, '#111111') ? '#ffffff' : '#111111';
}

/** Een kleur stap voor stap naar een andere toe trekken. `amount` van 0 tot 1. */
function mix(color: string, towards: string, amount: number): string {
  const [r1, g1, b1] = rgb(color);
  const [r2, g2, b2] = rgb(towards);
  return hex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

/**
 * Trekt een kleur donkerder of lichter tot ze genoeg contrast heeft met de ondergrond.
 * Geel blijft geel, maar wordt okerkleurig genoeg om als tekst en als knopkleur te werken.
 */
export function ensureContrast(color: string, against: string, ratio: number): string {
  const darker = luminance(against) > 0.5; // lichte ondergrond: we moeten donkerder
  let out = color;
  for (let i = 0; i < 24 && contrast(out, against) < ratio; i++) {
    out = mix(out, darker ? '#000000' : '#ffffff', 0.06);
  }
  return out;
}

export interface ThemeTokens {
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentSoftInk: string;
  /** De tweede clubkleur, alleen voor het logo en de band — nooit voor tekst. */
  secondary: string;
}

/**
 * Van twee clubkleuren naar de tokens die de app gebruikt.
 *
 * `surface` is de achtergrond waartegen de accentkleur moet werken (wit in het lichte
 * thema, bijna zwart in het donkere), `ink` de gewone tekstkleur van dat thema.
 */
export function themeTokens(colors: [string, string], surface: string, ink: string): ThemeTokens {
  // de accentkleur moet leesbaar zijn als tekst op de kaart (tabtitel, link, cijfer)
  const accent = ensureContrast(colors[0], surface, 4.5);
  // en als achtergrond van een knop moet de tekst erop leesbaar zijn
  const accentInk = inkFor(accent);
  // de zachte variant is de accentkleur die bijna helemaal naar de ondergrond is getrokken
  let accentSoft = mix(accent, surface, luminance(surface) > 0.5 ? 0.88 : 0.82);
  // en daar moet de gewone tekst weer leesbaar op zijn
  if (contrast(accentSoft, ink) < 4.5) accentSoft = mix(accentSoft, surface, 0.4);
  return { accent, accentInk, accentSoft, accentSoftInk: accent, secondary: colors[1] };
}

/** Het schema bij een id, met terugval op het eerste. */
export function schemeById(id: string | undefined): ColorScheme {
  return SCHEMES.find((s) => s.id === id) ?? DEFAULT_SCHEME;
}

/* ----------------------------------------------------------------- toepassen */

/**
 * Zet de tokens op het document. Beide thema's worden berekend en als aparte variabelen
 * gezet; de stylesheet kiest zelf welke set hij gebruikt op basis van de systeeminstelling.
 */
export function applyTheme(colors: [string, string]): void {
  const root = document.documentElement;
  const light = themeTokens(colors, '#ffffff', '#16201b');
  const dark = themeTokens(colors, '#19201c', '#e8eeea');
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--club-1', colors[0]);
  set('--club-2', colors[1]);
  set('--accent-light', light.accent);
  set('--accent-ink-light', light.accentInk);
  set('--accent-soft-light', light.accentSoft);
  set('--accent-dark', dark.accent);
  set('--accent-ink-dark', dark.accentInk);
  set('--accent-soft-dark', dark.accentSoft);
}
