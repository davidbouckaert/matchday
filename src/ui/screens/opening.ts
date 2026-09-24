// De seizoensopening: het scherm dat je in week 1 te zien krijgt voor je iets anders kunt doen.
// Affiche, voorbeschouwing van de pers, doorstromers, de doelen van het bestuur en jouw persconferentie.

import type { GameState } from '../../engine/types';
import { AMBITIONS, promiseBase } from '../../engine/opening';
import { seasonLabel } from '../../engine/calendar';
import { MATCH_WEEKS } from '../../engine/calendar';
import { type CrestShape, clubInitials, crestSvg } from '../crest';
import { START_CLUBS } from '../../engine/data/setup';
import { esc, euro } from '../format';

const CATEGORY: Record<string, string> = { sportief: '⚽ Sportief', financieel: '💶 Financieel', gemeenschap: '🤝 Gemeenschap' };

export function openingOverlay(s: GameState): string {
  const o = s.opening!;
  const base = promiseBase(s);
  const teams = s.league.table.length;

  return `<div class="overlay opening-overlay">
    <div class="opening-card" role="dialog" aria-label="Seizoensopening">
      <div class="opening-hero">
        <div class="opening-crest">${crestSvg(
          s.crest as CrestShape,
          (START_CLUBS.find((c) => c.id === s.clubId)?.colors ?? ['#1f7a3c', '#ffffff']) as [string, string],
          clubInitials(s.clubName),
          76,
        )}</div>
        <div>
          <span class="opening-kicker">Seizoen ${seasonLabel(s.startYear, o.season)} · ${esc(o.division)}</span>
          <h2>${esc(s.clubName)}</h2>
          <p class="opening-sub">De kleedkamer is geschilderd, het gras ligt erbij als een biljart en de eerste speeldag is week ${MATCH_WEEKS[0]}.</p>
        </div>
      </div>

      <div class="opening-body">
        <section class="opening-press">
          <h3>De voorbeschouwing</h3>
          <blockquote>“${esc(o.pressQuote)}”<cite>${esc(o.pressSource)}</cite></blockquote>
          <p class="small muted">De pers zet je op <strong>plaats ${o.pressPlace}</strong> van ${teams}. Bewijs maar dat ze ernaast zitten.</p>
        </section>

        <section class="opening-col">
          <h3>Deze zomer</h3>
          <ul class="small opening-list">${o.summer.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${
            o.newcomers.length
              ? `<h3>Uit de eigen jeugd</h3><ul class="small opening-list youth">${o.newcomers.map((x) => `<li>🌱 ${esc(x)}</li>`).join('')}</ul>`
              : ''
          }
        </section>

        <section class="opening-goals">
          <h3>De doelen van het bestuur</h3>
          <p class="small muted">Haal je ze, dan volgt een premie op het einde van het seizoen.</p>
          <ul class="goal-list">
            ${o.goals
              .map(
                (g) => `<li><span class="goal-cat">${CATEGORY[g.category]}</span>
                  <strong>${esc(g.label)}</strong>
                  <span class="goal-reward">${euro(g.reward)}</span></li>`,
              )
              .join('')}
          </ul>
        </section>

        <!-- Dit blok is de enige weg vooruit, en dat mocht je vroeger zelf uitzoeken: het
             stond even grijs en dicht op de rest als de achtergrondinfo erboven. Nu draagt
             het de clubkleur, zegt de kop letterlijk dat je moet kiezen, en heeft elke
             kaart een echte knop — drie keuzes, één klik, seizoen gestart. -->
        <section class="opening-mic">
          <h3>🎙️ De persconferentie <span class="mic-stap">kies om te starten</span></h3>
          <p class="small">De zaal zit vol en wacht op één zin: waar gaat ${esc(s.clubName)} dit jaar voor?
            <strong>Kies één van de drie uitspraken — daarmee begint je seizoen.</strong>
            Supporters, spelers en sponsors reageren meteen, en op je belofte word je afgerekend.</p>
          <div class="ambition-grid">
            ${AMBITIONS.map(
              (a) => `<button class="ambition" data-action="choose-ambition" data-id="${a.id}">
                <strong>${esc(a.label)}</strong>
                <span class="quote small">${esc(a.quote)}</span>
                <span class="effects small">
                  <span>${chip('Supporters', a.fanMood)}</span>
                  <span>${chip('Spelers', a.morale)}</span>
                  <span>${chip('Sponsors', a.satisfaction)}</span>
                </span>
                <span class="promise small">Belofte: <strong>${esc(a.belofte)}</strong><br/>
                  lukt → ${euro(Math.round(base * a.bonusFactor))} · mislukt → ${euro(-Math.round(base * a.malusFactor))} en een reputatiedeuk</span>
                <span class="kies">Dit zeg ik ▸</span>
              </button>`,
            ).join('')}
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function chip(label: string, value: number): string {
  if (!value) return `<span class="chip zero">${label} =</span>`;
  return `<span class="chip ${value > 0 ? 'up' : 'down'}">${label} ${value > 0 ? '+' : ''}${value}</span>`;
}
