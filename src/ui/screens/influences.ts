import type { GameState } from '../../engine/types';
import type { Factor } from '../../engine/factors';
import { allModifiers } from '../../engine/modifiers';
import { esc } from '../format';

function show(f: Factor): string {
  if (f.kind === 'x') {
    const pct = Math.round((f.value - 1) * 1000) / 10;
    const cls = pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'muted';
    return `<span class="${cls}">×${f.value.toFixed(2)}</span> <span class="muted small">(${pct > 0 ? '+' : ''}${pct}%)</span>`;
  }
  const v = Math.round(f.value * 100) / 100;
  return `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}">${v > 0 ? '+' : ''}${v.toLocaleString('nl-BE')}</span>`;
}

export function influencesScreen(s: GameState): string {
  const groups = allModifiers(s);
  return `
  <section class="card" data-tour-doel="invloeden-kaart">
    <h2>Invloeden</h2>
    <p class="muted small">Alle vermenigvuldigers (×) en bonussen (+) die nu meespelen. Het spel rekent met exact deze cijfers.
    Groen helpt, rood kost. Bij een vermenigvuldiger staat het procentuele effect tussen haakjes.</p>
  </section>
  <div class="grid">
    ${groups
      .map(
        (g) => `<section class="card">
        <h2>${esc(g.title)}</h2>
        <p class="muted small">${esc(g.explain)}</p>
        ${
          g.factors.length
            ? `<table class="compact"><tbody>${g.factors
                .map((f) => `<tr><td>${esc(f.label)}<br/><span class="muted small">${esc(f.source)}</span></td><td class="num">${show(f)}</td></tr>`)
                .join('')}</tbody></table>`
            : '<p class="muted small">Geen extra invloeden.</p>'
        }
        <p class="result"><strong>${esc(g.result)}</strong></p>
      </section>`,
      )
      .join('')}
  </div>`;
}
