// Het weekmoment als popup: eerst de situatie met je keuzes, daarna wat die keuze opleverde.

import type { GameState } from '../../engine/types';
import { esc } from '../format';

export function momentOverlay(s: GameState, phase: 'vraag' | 'gevolg'): string {
  const w = s.weekChoice;
  if (!w) return '';
  const done = phase === 'gevolg' && w.answer;
  const chosen = w.options.find((o) => o.id === w.answer);

  return `<div class="overlay moment-overlay">
    <div class="moment-card" role="dialog" aria-label="${esc(w.title)}">
      <div class="moment-head">
        <span class="moment-kicker">📌 Weekmoment · week ${w.week}</span>
        <h2>${esc(w.title)}</h2>
      </div>
      <p class="moment-text">${esc(w.text)}</p>
      ${
        done
          ? `<div class="moment-outcome">
              <p class="small muted">Je koos: <strong>${esc(chosen?.label ?? '')}</strong></p>
              <p class="outcome-text">${esc(w.outcome ?? '')}</p>
            </div>
            <div class="actions"><button class="primary" data-action="moment-close">Sluiten</button></div>`
          : `<div class="moment-options">
              ${w.options
                .map(
                  (o) => `<button class="moment-option" data-action="week-choice" data-id="${o.id}">
                    <strong>${esc(o.label)}</strong><span class="muted small">${esc(o.detail)}</span>
                  </button>`,
                )
                .join('')}
            </div>
            <p class="center small muted"><button class="link-btn small" data-action="moment-close">Later beslissen</button> ·
              beslis je niet voor je op "Volgende week" drukt, dan gaat de laatste optie door</p>`
      }
    </div>
  </div>`;
}
