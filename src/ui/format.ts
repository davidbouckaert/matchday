export function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function euro(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}€${Math.abs(Math.round(amount)).toLocaleString('nl-BE')}`;
}

export function signedEuro(amount: number): string {
  return `<span class="${amount < 0 ? 'neg' : 'pos'}">${amount > 0 ? '+' : ''}${euro(amount)}</span>`;
}

export function stars(n: number): string {
  return `<span class="stars" aria-label="${n} op 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
}

export function bar(value: number, max = 100): string {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = pct >= 66 ? 'good' : pct >= 33 ? 'mid' : 'bad';
  return `<span class="bar"><span class="fill ${tone}" style="width:${pct}%"></span></span>`;
}

/** Klein lijndiagram van het saldo. */
export function sparkline(values: number[], width = 320, height = 70): string {
  if (values.length < 2) return '<p class="muted">Nog geen verloop: speel een paar weken.</p>';
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zero = y(0).toFixed(1);
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Verloop van het saldo">
    <line x1="0" x2="${width}" y1="${zero}" y2="${zero}" class="zero"/>
    <polyline points="${points}" fill="none"/>
  </svg>`;
}

/** Icoon bij een uitslag: winst, gelijkspel of verlies. */
export function resultIcon(goalsFor: number, goalsAgainst: number): string {
  if (goalsFor > goalsAgainst) return '<span class="result win" data-tip="Gewonnen">🏆</span>';
  if (goalsFor < goalsAgainst) return '<span class="result loss" data-tip="Verloren">🥀</span>';
  return '<span class="result draw" data-tip="Gelijkspel">🤝</span>';
}

/** "Thuis" of "Uit" met een icoon. */
export function venue(home: boolean): string {
  return `<span class="venue ${home ? 'home' : 'away'}">${home ? '🏠 Thuis' : '🚌 Uit'}</span>`;
}

/**
 * Wanneer iets gebeurde, als woorden in plaats van als code.
 *
 * Hier stond overal "S1 W17". Dat is kort, maar je moet eerst leren dat de S van seizoen
 * komt en de W van week — en dat is precies het soort kleine leerdrempel waar een spel
 * niets aan heeft. In een lijst waar alles uit hetzelfde seizoen komt, laten we het
 * seizoen zelfs helemaal weg: dan volstaat "week 17".
 */
export function whenLabel(season: number, week: number, currentSeason?: number): string {
  return currentSeason === season ? `week ${week}` : `seizoen ${season}, week ${week}`;
}

/**
 * Enkelvoud of meervoud, met het getal ervoor.
 *
 * "3 speler(s)" en "1 wedstrijd(en)" zijn formuliertaal: je leest de haakjes en moet zelf
 * de juiste vorm kiezen. Eén speler is één speler.
 */
export function count(n: number, enkelvoud: string, meervoud = `${enkelvoud}s`): string {
  return `${n} ${n === 1 ? enkelvoud : meervoud}`;
}
