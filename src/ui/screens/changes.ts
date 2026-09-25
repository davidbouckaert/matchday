// Wat is er nieuw: de changelog voor de speler, in mensentaal.
//
// De lijst zelf bestond al (CHANGELOG in version.ts wordt van dag één voor mensen
// geschreven), maar hij was alleen op GitHub te lezen. Hier staat hij in het spel,
// met een extra laag voor wie test: alles wat je nog niet als "gezien" markeerde,
// draagt een badge — en zolang er ongeziene wijzigingen zijn, staat er een stip op
// het menu. Zo hoef je nooit te scrollen en te raden welke verandering je nog niet
// geprobeerd hebt.

import { CHANGELOG, VERSION } from '../../version';
import { esc } from '../format';

/** Vergelijk twee versies ("0.78.0"): positief als a nieuwer is dan b. */
export function versionCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Tot welke versie de speler alles bekeken heeft (per toestel, niet per opslagbestand). */
export function seenVersion(): string {
  try {
    return localStorage.getItem('vcg-gezien-versie') ?? '0.0.0';
  } catch {
    return VERSION; // geen opslag: dan ook geen badges
  }
}

export function isUnseen(version: string): boolean {
  return versionCompare(version, seenVersion()) > 0;
}

/** Staat er iets in het spel dat deze speler nog niet bekeken heeft? */
export function hasUnseenChanges(): boolean {
  return isUnseen(VERSION);
}

function datum(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return `${d} ${maanden[(m ?? 1) - 1]} ${y}`;
}

export function changesScreen(): string {
  const ongezien = CHANGELOG.filter((c) => isUnseen(c.version)).length;
  return `<section class="card changes-card">
    <h2>Wat is er nieuw <span class="tag">${VERSION}</span></h2>
    <p class="muted small">Elke versie van het spel, nieuwste bovenaan, in gewone taal.
      ${ongezien ? `<strong>${ongezien} ${ongezien === 1 ? 'versie die' : 'versies die'} je nog niet bekeek</strong> ${ongezien === 1 ? 'draagt' : 'dragen'} een badge.` : 'Je bent helemaal bij.'}</p>
    ${
      ongezien
        ? `<p><button class="sm primary" data-action="changes-seen">Alles gezien tot en met ${VERSION} ✓</button>
           <span class="muted small">— de badges verdwijnen en de stip op het menu gaat uit</span></p>`
        : ''
    }
    <div class="changes-lijst">
      ${CHANGELOG.map(
        (c) => `<article class="change ${isUnseen(c.version) ? 'ongezien' : ''}">
          <h3><span class="versie">${esc(c.version)}</span> ${esc(c.title)}
            ${isUnseen(c.version) ? '<span class="tag nieuw">nieuw voor jou</span>' : ''}</h3>
          <p class="muted small">${datum(c.date)}</p>
          <ul class="small">${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        </article>`,
      ).join('')}
    </div>
  </section>`;
}
