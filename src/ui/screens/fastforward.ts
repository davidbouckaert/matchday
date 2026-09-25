// Wat er gebeurde terwijl je doorspeelde. Eén venster, geen animatie: je sloeg die weken
// net over omdat je ze niet één voor één wilde zien.

import type { GameState } from '../../engine/types';
import type { FastForwardResult } from '../../engine/fastforward';
import { STOP_TEXT } from '../../engine/fastforward';
import { formatWeek } from '../../engine/calendar';
import { esc, euro, signedEuro } from '../format';
import { newsIcon } from '../newsIcon';

export function fastForwardOverlay(g: GameState, result: FastForwardResult): string {
  const { digest, weeks, from, to, reason } = result;
  const span =
    weeks === 1
      ? `week ${from.week}`
      : `week ${from.week} tot en met week ${to.week - 1 > 0 ? to.week - 1 : 52}`;

  return `<div class="overlay ff-overlay" data-action="ff-close">
    <div class="ff-card" data-stop="1">
      <header class="ff-head">
        <h2>Je speelde ${weeks} ${weeks === 1 ? 'week' : 'weken'} door</h2>
        <p class="muted small">${esc(span)} · ${esc(formatWeek(g.startYear, from.season, from.week))} → ${esc(formatWeek(g.startYear, to.season, to.week))}</p>
      </header>

      <div class="ff-net">
        <span class="muted small">Saldo over deze weken</span>
        <strong class="${digest.net < 0 ? 'neg' : 'pos'}">${signedEuro(digest.net)}</strong>
        <span class="muted small">nu ${euro(g.cash)} in kas</span>
      </div>

      ${
        digest.records.length
          ? `<div class="ff-block"><h3>Clubrecords</h3><ul>${digest.records.map((r) => `<li>🏅 ${esc(r)}</li>`).join('')}</ul></div>`
          : ''
      }
      ${
        digest.milestones.length
          ? `<div class="ff-block"><h3>Mijlpalen</h3><ul>${digest.milestones.map((m) => `<li>🎉 ${esc(m)}</li>`).join('')}</ul></div>`
          : ''
      }
      ${
        digest.news.length
          ? `<div class="ff-block"><h3>Wat er gebeurde</h3><ul class="ff-news">${digest.news
              .map((n) => {
                const icon = newsIcon(n.text);
                return `<li class="${n.tone}"><span class="muted small">week ${n.week}</span> ${icon ? `<span class="n-icon">${icon}</span>` : ''}${esc(n.text)}</li>`;
              })
              .join('')}</ul></div>`
          : '<p class="muted">Rustige weken: er gebeurde niets dat het vermelden waard is.</p>'
      }

      <footer class="ff-foot">
        <p class="small"><strong>Gestopt:</strong> ${esc(STOP_TEXT[reason])}</p>
        <button class="primary" data-action="ff-close">Sluiten en verderspelen</button>
      </footer>
    </div>
  </div>`;
}
