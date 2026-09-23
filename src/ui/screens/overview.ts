import type { GameState, LedgerEntry } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { MATCH_WEEKS, WINTER_BREAK, inWinterBreak, isTransferWindow } from '../../engine/calendar';
import { OPPONENT_STAFF_BONUS, OWN_TEAM_ID, nextDerby, ownPosition, rivalTeam, teamName } from '../../engine/league';
import { clubRatings } from '../../engine/ratings';
import { teamStrength } from '../../engine/players';
import { esc, resultIcon, signedEuro, sparkline, stars } from '../format';
import { hint } from '../tooltip';
import { onboardingCard } from './onboarding';
import { weeks } from '../../engine/util';
import { available } from '../../engine/discipline';
import { ambitionDef, goalProgress } from '../../engine/opening';
import { CARRIERE_DOELEN, EIGENAARSNIVEAUS, goalDef as careerGoalDef, goalProgress as careerProgress, nextLevel, ownerLevel } from '../../engine/career';

export function weekSummary(entries: LedgerEntry[]): { income: number; costs: number } {
  let income = 0;
  let costs = 0;
  for (const e of entries) {
    if (e.category === 'leningen' || e.category === 'investeerder') continue;
    if (e.amount > 0) income += e.amount;
    else costs += e.amount;
  }
  return { income, costs };
}

/** Het weekmoment: één beslissing voor de aftrap. */
function weekChoiceCard(s: GameState): string {
  const w = s.weekChoice;
  if (!w) return '';
  if (w.answer) {
    return `<section class="card full moment done">
      <h2>📌 ${esc(w.title)}</h2>
      <p class="small">${esc(w.outcome ?? '')}</p>
    </section>`;
  }
  return `<section class="card full moment open">
    <h2>📌 ${esc(w.title)} ${hint('Elke week ligt er iets op je bureau dat nu beslist moet worden. Beslis je niet voor je op "Volgende week" drukt, dan gaat de laatste optie door.')}</h2>
    <p>${esc(w.text)}</p>
    <p class="actions left"><button class="primary" data-action="moment-open">Beslissen (${w.options.length} keuzes)</button></p>
  </section>`;
}


/**
 * Je carrière: het langetermijndoel waar je naartoe werkt, en hoever je zelf staat
 * als eigenaar. Zolang je nog geen doel koos, staat hier de keuze.
 */
function careerCard(s: GameState): string {
  const goal = careerGoalDef(s);
  const niveau = ownerLevel(s);
  const next = nextLevel(s);

  const ownerBlock = `<div class="owner-block">
      <div class="owner-level">
        <span class="muted small">Jij als eigenaar</span>
        <strong>${esc(niveau.naam)}</strong>
        <span class="muted small">niveau ${niveau.level} van ${EIGENAARSNIVEAUS.length} · ${s.owner.points} punten</span>
      </div>
      ${niveau.voordeel ? `<p class="small"><strong>${esc(niveau.voordeel)}</strong> — ${esc(niveau.uitleg)}</p>` : ''}
      ${
        next
          ? `<p class="small muted">Volgend niveau: <strong>${esc(next.niveau.naam)}</strong> over ${next.missing} ${next.missing === 1 ? 'punt' : 'punten'} — ${esc(next.niveau.uitleg)}</p>
             <div class="bar"><span style="width:${Math.round((s.owner.points / next.niveau.punten) * 100)}%"></span></div>`
          : '<p class="small muted">Je hebt het hoogste niveau bereikt. Verder groeit alleen de club nog.</p>'
      }
      <p class="small muted">Punten verdien je met elk afgewerkt seizoen, met promoties en titels, met mijlpalen, met een seizoen in de plus — en met je langetermijndoel.</p>
    </div>`;

  if (!goal) {
    return `<section class="card full career choose">
      <h2>🎯 Waar wil je met deze club naartoe? ${hint('Eén doel voor de lange termijn. Het bepaalt niets aan de regels, maar het geeft je carrière een richting — en je ziet elke week hoever je staat. Je kiest maar één keer.')}</h2>
      <p class="muted small">Kies het doel waar je de komende jaren naartoe werkt. Je legt het één keer vast.</p>
      <div class="goal-choices">${CARRIERE_DOELEN.map(
        (g) => `<button class="goal-choice" data-action="career-goal" data-id="${g.id}">
          <strong>${esc(g.titel)}</strong>
          <span class="small">${esc(g.beschrijving)}</span>
          <span class="muted small">richttermijn ${g.looptijd} seizoenen · ${esc(g.belofte)}</span>
        </button>`,
      ).join('')}</div>
      ${ownerBlock}
    </section>`;
  }

  const p = careerProgress(s)!;
  const done = s.career.achievedSeason !== null;
  const seasons = s.career.chosenSeason ? s.season - s.career.chosenSeason + 1 : s.season;
  return `<section class="card full career ${done ? 'done' : ''}">
    <h2>🎯 ${esc(goal.titel)} ${hint('Je langetermijndoel. Het blijft hier staan tot je het haalt, met telkens de actuele stand erbij.')}</h2>
    <p class="muted small">${esc(goal.beschrijving)}</p>
    ${
      done
        ? `<p class="pos"><strong>Behaald in seizoen ${s.career.achievedSeason}.</strong> ${esc(goal.belofte)}</p>`
        : `<div class="goal-line">
             <span>${esc(p.label)}</span>
             <div class="bar"><span style="width:${Math.round(p.fraction * 100)}%"></span></div>
           </div>
           ${
             p.extra
               ? `<div class="goal-line">
                    <span>${esc(p.extra.label)}</span>
                    <div class="bar"><span style="width:${Math.round(Math.min(1, p.extra.value / Math.max(1, p.extra.target)) * 100)}%"></span></div>
                  </div>`
               : ''
           }
           <p class="muted small">Bezig sinds seizoen ${s.career.chosenSeason ?? 1} — dit is seizoen ${seasons} van je poging. Richttermijn: ${goal.looptijd}.</p>`
    }
    ${ownerBlock}
  </section>`;
}

const GOAL_ICON: Record<string, string> = { sportief: '⚽', financieel: '💶', gemeenschap: '🤝' };

/** Je belofte van de persconferentie en de drie doelen van het bestuur, met hoever je staat. */
function goalsCard(s: GameState): string {
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

  return `<section class="card full goals">
    <h2>Seizoensdoelen ${hint('Drie doelen van je bestuur, één per categorie van je clubscore, plus de belofte die je zelf deed op de persconferentie. Op het einde van het seizoen wordt er afgerekend.')}</h2>
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

export function overviewScreen(s: GameState): string {
  const ratings = clubRatings(s);
  const next = s.league.fixtures
    .filter((f) => f.homeGoals === undefined && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID))
    .sort((a, b) => a.week - b.week)[0];
  const rival = rivalTeam(s);
  const nextIsDerby = !!next && !!rival && (next.homeId === rival.id || next.awayId === rival.id);
  const nextLabel = next
    ? `<span class="venue ${next.homeId === OWN_TEAM_ID ? 'home' : 'away'}">${next.homeId === OWN_TEAM_ID ? '🏠 Thuis' : '🚌 Uit'}</span> tegen <strong>${esc(teamName(s, next.homeId === OWN_TEAM_ID ? next.awayId : next.homeId))}</strong>${nextIsDerby ? ' <span class="tag derby">🔥 DERBY</span>' : ''} in week ${next.week}${next.week === s.week ? ' (deze week)' : ''}`
    : MATCH_WEEKS[0] > s.week
      ? `Competitie start in week ${MATCH_WEEKS[0]}`
      : 'Geen wedstrijden meer dit seizoen';
  const strength = teamStrength(s);
  const division = DIVISIONS[s.league.divisionLevel];
  const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const { income, costs } = weekSummary(s.lastWeek);
  const derbyWeek = nextDerby(s);
  const derby = s.derbyRecord.won + s.derbyRecord.drawn + s.derbyRecord.lost > 0;
  const m = s.lastMatch;

  const warnings: { text: string; screen: string; where: string }[] = [];
  const warn = (text: string, screen: string, where: string) => warnings.push({ text, screen, where });
  if (s.weekChoice && !s.weekChoice.answer) {
    warn(`Er ligt een beslissing op je bureau: ${s.weekChoice.title}. Beslis je niet, dan gaat de laatste optie vanzelf door.`, 'moment', 'Beslissen →');
  }
  if (s.weeksNegative > 0) warn(`Saldo al ${weeks(s.weeksNegative)} onder nul. Na 8 weken is de club failliet.`, 'financien', 'Financiën');
  if (s.emergencyLoanOffered) warn('De bank biedt een noodlening aan.', 'financien', 'Financiën');
  if (s.playerOffers.length) warn(s.playerOffers.length === 1 ? 'Er ligt een bod op een van je spelers.' : `Er liggen ${s.playerOffers.length} biedingen op je spelers.`, 'transfers', 'Transfers');
  if (s.sponsorOffers.length) warn(s.sponsorOffers.length === 1 ? 'Er is een nieuw sponsoraanbod.' : `Er zijn ${s.sponsorOffers.length} sponsoraanbiedingen.`, 'sponsors', 'Sponsors');
  if (s.requests.length) warn(`Je wacht op antwoord: ${s.requests.map((r) => r.label).join(', ')}.`, 'overzicht', 'Logboek hieronder');
  const expiring = s.players.filter((p) => p.contractUntil <= s.season).length;
  if (expiring && s.week > 30) warn(`${expiring} contract(en) lopen af op het einde van dit seizoen.`, 'contracten', 'Contracten');
  if (isTransferWindow(s.week)) warn('De transferperiode is open.', 'transfers', 'Transfers');
  if (inWinterBreak(s.week)) warn(`❄️ Winterstop tot week ${WINTER_BREAK.to + 1}: geen wedstrijden, dus geen tickets, wedstrijdkantine of kraampjes. De vaste kosten lopen door.`, 'kalender', 'Kalender');
  const avail = available(s.players).length;
  if (avail < 11) warn(`Slechts ${avail} spelers beschikbaar (geblesseerd of geschorst): de volgende wedstrijd wordt forfait (0-5)!`, 'ploeg', 'Selectie');
  else if (avail < 13) warn(`Slechts ${avail} spelers beschikbaar. Onder de 11 volgt forfait.`, 'ploeg', 'Selectie');

  return `
  <div class="grid">
    ${onboardingCard(s)}
    <section class="card span2">
      <h2>Clubscore</h2>
      <div class="ratings">
        ${ratings
          .map(
            (r) => `<div class="rating"><span class="label">${r.label}</span>${stars(r.stars)}<span class="muted small">${r.score}/100</span></div>`,
          )
          .join('')}
      </div>
    </section>

    ${weekChoiceCard(s)}
    ${careerCard(s)}
    ${goalsCard(s)}

    <section class="card">
      <h2>Volgende wedstrijd</h2>
      <p>${nextLabel}</p>
      <p class="muted small">Teamsterkte ${strength.total} · gemiddelde tegenstander ${division.opponentStrength + OPPONENT_STAFF_BONUS}</p>
      ${played ? `<p>Stand: <strong>${ownPosition(s.league)}e</strong> in ${division.name}</p>` : ''}
      ${rival ? `<p class="small muted">Aartsrivaal: <strong>${esc(rival.name)}</strong>${derby ? ` · onderling ${s.derbyRecord.won}W ${s.derbyRecord.drawn}G ${s.derbyRecord.lost}V` : ''}${derbyWeek ? ` · volgende derby in week ${derbyWeek.week} (${derbyWeek.home ? 'thuis' : 'uit'})` : ''}</p>` : ''}
    </section>

    <section class="card">
      <h2>Vorige week</h2>
      <p>Inkomsten ${signedEuro(income)}<br/>Kosten ${signedEuro(costs)}<br/>Resultaat <strong>${signedEuro(income + costs)}</strong></p>
      ${m && m.week === s.week - 1 ? `<p class="small">${resultIcon(m.goalsFor, m.goalsAgainst)} <span class="venue ${m.home ? 'home' : 'away'}">${m.home ? '🏠 Thuis' : '🚌 Uit'}</span> vs ${esc(m.opponent)}: <strong>${m.goalsFor}-${m.goalsAgainst}</strong>${m.forfeit ? ' · <span class="neg">forfait</span>' : m.home ? ` · ${m.attendance} toeschouwers · ${m.weather}` : ''}${m.cards ? `<br/>${esc(m.cards)}` : ''}</p>` : ''}
    </section>

    ${
      warnings.length
        ? `<section class="card full attention"><h2>Aandacht</h2><ul class="attention-list">${warnings
            .map(
              (w) => `<li>${esc(w.text)} <button class="link-btn small" data-action="${w.screen === 'moment' ? 'moment-open' : 'nav'}" ${
                w.screen === 'moment' ? '' : `data-id="${w.screen}"`
              }>${esc(w.where)}${w.screen === 'moment' ? '' : ' →'}</button></li>`,
            )
            .join('')}</ul></section>`
        : ''
    }

    <section class="card full">
      <h2>Saldo (laatste ${s.cashHistory.length} weken)</h2>
      ${sparkline(s.cashHistory)}
    </section>

    <section class="card full">
      <h2>Logboek ${hint('Alles wat jij besliste en elk antwoord dat je daarop kreeg, in volgorde. Handig om terug te vinden wat je vorige week vroeg.')}</h2>
      ${
        s.log.length
          ? `<ul class="news log">${s.log
              .slice(0, 20)
              .map((l) => `<li class="${l.kind === 'antwoord' ? 'goed' : 'neutraal'}"><span class="muted small">S${l.season} W${l.week}</span> <span class="tag">${l.kind}</span> ${esc(l.text)}</li>`)
              .join('')}</ul>`
          : '<p class="muted">Nog niets beslist deze week.</p>'
      }
    </section>

    <section class="card full">
      <h2>Nieuws</h2>
      <ul class="news">
        ${s.news
          .slice(0, 14)
          .map((n) => `<li class="${n.tone}"><span class="muted small">S${n.season} W${n.week}</span> ${esc(n.text)}</li>`)
          .join('')}
      </ul>
    </section>
  </div>`;
}
