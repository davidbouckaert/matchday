// Doelen en carrière. Alles waar je naartoe werkt, op één plek.
//
// Dit stond vroeger op het dashboard, maar het hoort er niet: je langetermijndoel
// verandert niet van week tot week, en het duwde de cijfers die je wél elke week nodig
// hebt naar beneden. Hier staat het rustig bij elkaar — je eigen doel, je niveau als
// eigenaar, de doelen van het bestuur voor dit seizoen, en het logboek van wat je besliste.

import type { GameState } from '../../engine/types';
import { OWN_TEAM_ID, ownPosition } from '../../engine/league';
import { esc, signedEuro } from '../format';
import { hint } from '../tooltip';
import { ambitionDef, goalProgress } from '../../engine/opening';
import { CARRIERE_DOELEN, EIGENAARSNIVEAUS, goalDef as careerGoalDef, goalProgress as careerProgress, nextLevel, ownerLevel } from '../../engine/career';

/** Je niveau als eigenaar, met wat het volgende oplevert. */
function ownerBlock(s: GameState): string {
  const niveau = ownerLevel(s);
  const next = nextLevel(s);
  return `<section class="card">
    <h2>Jij als eigenaar</h2>
    <div class="money-fig">
      <span class="big-num sm">${esc(niveau.naam)}</span>
      <span class="sub">niveau ${niveau.level} van ${EIGENAARSNIVEAUS.length} · ${s.owner.points} punten</span>
    </div>
    ${niveau.voordeel ? `<p class="small"><strong>${esc(niveau.voordeel)}</strong> — ${esc(niveau.uitleg)}</p>` : ''}
    ${
      next
        ? `<p class="small muted">Volgend niveau: <strong>${esc(next.niveau.naam)}</strong> over ${next.missing} ${next.missing === 1 ? 'punt' : 'punten'} — ${esc(next.niveau.uitleg)}</p>
           <div class="meter"><div class="track"><span style="width:${Math.round((s.owner.points / next.niveau.punten) * 100)}%"></span></div></div>`
        : '<p class="small muted">Je hebt het hoogste niveau bereikt. Verder groeit alleen de club nog.</p>'
    }
    <p class="tiny muted">Punten verdien je met elk afgewerkt seizoen, met promoties en titels, met mijlpalen, met een seizoen in de plus — en met je langetermijndoel.</p>
  </section>`;
}

/** Het doel waar je de hele carrière naartoe werkt. Je kiest het één keer. */
function careerCard(s: GameState): string {
  const goal = careerGoalDef(s);

  if (!goal) {
    return `<section class="card career choose">
      <h2>Waar wil je met deze club naartoe? ${hint('Eén doel voor de lange termijn. Het verandert niets aan de regels, maar het geeft je carrière een richting — en je ziet hier hoever je staat. Je kiest maar één keer.')}</h2>
      <p class="muted small">Kies het doel waar je de komende jaren naartoe werkt. Je legt het één keer vast.</p>
      <div class="goal-choices">${CARRIERE_DOELEN.map(
        (g) => `<button class="goal-choice" data-action="career-goal" data-id="${g.id}">
          <strong>${esc(g.titel)}</strong>
          <span class="small">${esc(g.beschrijving)}</span>
          <span class="muted small">richttermijn ${g.looptijd} seizoenen · ${esc(g.belofte)}</span>
        </button>`,
      ).join('')}</div>
    </section>`;
  }

  const p = careerProgress(s)!;
  const done = s.career.achievedSeason !== null;
  const seasons = s.career.chosenSeason ? s.season - s.career.chosenSeason + 1 : s.season;
  return `<section class="card career ${done ? 'done' : ''}">
    <h2>Je langetermijndoel ${hint('Het blijft hier staan tot je het haalt, met telkens de actuele stand erbij.')}</h2>
    <p class="big-num sm">${esc(goal.titel)}</p>
    <p class="muted small">${esc(goal.beschrijving)}</p>
    ${
      done
        ? `<p class="pos"><strong>Behaald in seizoen ${s.career.achievedSeason}.</strong> ${esc(goal.belofte)}</p>`
        : `<div class="meter">
             <div class="top"><span class="mname">${esc(p.label)}</span></div>
             <div class="track"><span style="width:${Math.round(p.fraction * 100)}%"></span></div>
           </div>
           ${
             p.extra
               ? `<div class="meter">
                    <div class="top"><span class="mname">${esc(p.extra.label)}</span></div>
                    <div class="track"><span style="width:${Math.round(Math.min(1, p.extra.value / Math.max(1, p.extra.target)) * 100)}%"></span></div>
                  </div>`
               : ''
           }
           <p class="tiny muted">Bezig sinds seizoen ${s.career.chosenSeason ?? 1} — dit is seizoen ${seasons} van je poging. Richttermijn: ${goal.looptijd}.</p>`
    }
  </section>`;
}

const GOAL_ICON: Record<string, string> = { sportief: '⚽', financieel: '💶', gemeenschap: '🤝' };

/** De drie doelen van het bestuur en je eigen belofte van de persconferentie. */
function seasonGoalsCard(s: GameState): string {
  if (!s.seasonGoals.length && !s.ambition) return '';
  const def = s.ambition ? ambitionDef(s.ambition) : null;
  const teams = s.league.table.length;
  const pos = ownPosition(s.league);
  const onTrack = def ? (def.place < 0 ? pos <= teams + def.place : pos <= def.place) : false;

  const rows = s.seasonGoals
    .map((g) => {
      const p = goalProgress(s, g);
      const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
      const value =
        g.kind === 'plaats' ? (played ? `${p.now}e` : 'nog niet gespeeld') : g.unit === '€' ? `€${Math.round(p.now).toLocaleString('nl-BE')}` : p.now.toLocaleString('nl-BE');
      const target = g.kind === 'plaats' ? `top ${g.target}` : g.unit === '€' ? `€${g.target.toLocaleString('nl-BE')}` : `${g.target.toLocaleString('nl-BE')}`;
      return `<li class="${p.done ? 'done' : ''}">
        <span class="goal-cat">${GOAL_ICON[g.category]}</span>
        <span class="goal-text"><strong>${esc(g.label)}</strong><span class="muted small">nu ${value} van ${target} · premie ${signedEuro(g.reward)}</span>
          <span class="goal-bar"><span style="width:${Math.round(p.pct)}%"></span></span></span>
        <span class="goal-state">${p.done ? '✅' : '⏳'}</span>
      </li>`;
    })
    .join('');

  return `<section class="card goals">
    <h2>Dit seizoen ${hint('Drie doelen van je bestuur, één per categorie van je clubscore, plus de belofte die je zelf deed op de persconferentie. Op het einde van het seizoen wordt er afgerekend.')}</h2>
    ${
      def
        ? `<p class="promise-line ${onTrack ? 'ok' : 'off'}">🎙️ Jouw belofte: <strong>${esc(def.belofte)}</strong> — ${
            pos ? (onTrack ? `je staat ${pos}e, dat volstaat voorlopig` : `je staat ${pos}e, dus daar moet nog wat gebeuren`) : 'de competitie moet nog beginnen'
          }</p>`
        : ''
    }
    ${rows ? `<ul class="goal-list live">${rows}</ul>` : ''}
  </section>`;
}

/** Wat je besliste en welk antwoord je daarop kreeg, in volgorde. */
function logCard(s: GameState): string {
  return `<section class="card">
    <h2>Logboek ${hint('Alles wat jij besliste en elk antwoord dat je daarop kreeg, in volgorde. Handig om terug te vinden wat je vorige week vroeg.')}</h2>
    ${
      s.log.length
        ? `<ul class="news-feed">${s.log
            .slice(0, 25)
            .map(
              (l) => `<li class="${l.kind === 'antwoord' ? 'goed' : 'neutraal'}"><span class="when">S${l.season} W${l.week}</span>
                <span class="what"><span class="tag">${esc(l.kind)}</span> ${esc(l.text)}</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="muted small">Nog niets beslist.</p>'
    }
  </section>`;
}

/**
 * De indeling hangt af van waar je staat.
 *
 * Moet je je langetermijndoel nog kiezen, dan ís die keuze het scherm: negen doelen die
 * elk een paar zinnen nodig hebben. Die stonden in een kolom van een derde van de pagina,
 * dus je scrolde langs negen kaartjes met tweederde wit ernaast. Nu krijgt de keuze de
 * volle breedte, en de rest komt eronder.
 *
 * Heb je gekozen, dan is die kaart compact en staan de drie dingen die je volgt naast
 * elkaar: je langetermijndoel, dit seizoen, en hoe ver je zelf staat als eigenaar.
 */
export function goalsScreen(s: GameState): string {
  const choosing = !careerGoalDef(s);

  if (choosing) {
    return `${careerCard(s)}
    <div class="cols-2">
      <div class="col">${seasonGoalsCard(s)}</div>
      <div class="col">${ownerBlock(s)}</div>
    </div>
    ${logCard(s)}`;
  }

  return `<div class="cols-3">
    <div class="col">${careerCard(s)}</div>
    <div class="col">${seasonGoalsCard(s)}</div>
    <div class="col">${ownerBlock(s)}</div>
  </div>
  ${logCard(s)}`;
}
