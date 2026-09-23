import type { GameState } from '../../engine/types';
import { CLUB_EVENTS, UPGRADES, VOLUNTEER_ACTIONS } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { BACKGROUNDS, INVESTORS } from '../../engine/data/setup';
import {
  GREEN_ENERGY_SAVING, TRIBUNE_MAX, TRIBUNE_MIN, TRIBUNE_STEP,
  canOrganise, canUpgrade, eventForecast, projectLimit, eventsThisSeason, tribuneCost, tribunePerSeat, tribuneWeeks, upgradeCost, upgradeWeeks, youthForecast,
} from '../../engine/actions';
import { MAINTENANCE_FACTOR, facilityCost } from '../../engine/finance';
import { volunteerSatisfaction } from '../../engine/turn';
import { MEMBERS_PER_TEAM, VOLUNTEERS_PER_TEAM, boundVolunteers, coordinatorTeams, freeVolunteers, maxYouthTeams, teamNames, teamsFor, youthCapacityFactor, youthShortage } from '../../engine/youth';
import { delegate } from '../../engine/delegation';
import { LEVEL_WORDS, findClub } from '../../engine/world';
import { weeks } from '../../engine/util';
import { RED_FINE, YELLOW_FINE, YELLOW_LIMIT } from '../../engine/discipline';
import { OWN_TEAM_ID, sortedTable, teamName } from '../../engine/league';
import { clubRatings } from '../../engine/ratings';
import { seasonLabel } from '../../engine/calendar';
import { CHANGELOG, VERSION } from '../../version';
import { avatarSvg } from '../avatar';
import { bar, count, esc, euro, signedEuro, stars } from '../format';
import { hint, tip } from '../tooltip';
import { impactChips } from '../impact';
import { upgradeImpact } from '../../engine/impact';
import { taskPicker } from '../taskpicker';

/** De tribune: jij kiest hoeveel plaatsen erbij komen, en hoe groter je bestelt hoe goedkoper per zitje. */
function tribuneCard(s: GameState): string {
  const i = s.infrastructure;
  const busy = i.constructions.find((c) => c.upgrade === 'tribune');
  const reason = canUpgrade(s, 'tribune');
  const seats = 300;
  const division = DIVISIONS[s.league.divisionLevel];
  const next = DIVISIONS[Math.min(DIVISIONS.length - 1, s.league.divisionLevel + 1)];
  const needed = Math.max(0, next.requiredCapacity - i.capacity);

  return `<div class="tribune-builder">
    <h3>Tribune uitbreiden ${hint('De aannemer rekent minder per zitje naarmate je er meer bestelt: dezelfde opstart, dezelfde kraan, dezelfde ploeg. Grotere werken duren wel langer.')}</h3>
    <p class="muted small">Nu ${i.capacity} plaatsen. Nodig in ${esc(division.name)}: ${division.requiredCapacity}${
      needed ? ` · voor ${esc(next.name)} kom je nog <strong>${needed}</strong> plaatsen te kort` : ' · ook de volgende reeks is in orde'
    }.</p>
    ${
      busy
        ? `<p class="attention-inline">🏗️ Er wordt gebouwd: +${busy.seats} plaatsen, nog ${weeks(busy.weeksLeft)}.</p>`
        : reason
          ? `<p class="muted small">${esc(reason)}</p>`
          : `<div class="slider-row">
              <input type="range" id="tribune-seats" min="${TRIBUNE_MIN}" max="${TRIBUNE_MAX}" step="${TRIBUNE_STEP}" value="${seats}" data-live="tribune" aria-label="Aantal plaatsen"/>
              <button class="primary" data-action="upgrade" data-id="tribune">Werken starten</button>
            </div>
            <p id="tribune-info" class="tribune-info"><strong>${seats} plaatsen</strong> · ${euro(tribuneCost(s, seats))}
              <span class="muted">(€${tribunePerSeat(s, seats)} per zitje)</span> · ${tribuneWeeks(seats)} weken bouwtijd</p>
            <div id="tribune-impact">${impactChips(upgradeImpact(s, 'tribune', seats), 5)}</div>`
    }
  </div>`;
}

export function infraScreen(s: GameState): string {
  const i = s.infrastructure;
  const division = DIVISIONS[s.league.divisionLevel];
  const next = DIVISIONS[Math.min(DIVISIONS.length - 1, s.league.divisionLevel + 1)];

  return `${taskPicker(s, ['infrastructuur'])}<div class="grid">
    <section class="card">
      <h2>Accommodatie</h2>
      <dl class="facts">
        <dt>Tribune</dt><dd>${i.capacity} plaatsen <span class="muted small">(nodig: ${division.requiredCapacity}, volgende reeks ${next.requiredCapacity})</span></dd>
        <dt>Kantine</dt><dd>niveau ${i.kantineLevel}/5</dd>
        <dt>Terrein</dt><dd>${i.pitch}</dd>
        <dt>Verlichting</dt><dd>niveau ${i.lightingLevel}/3 <span class="muted small">(nodig: ${division.requiredLighting}, volgende reeks ${next.requiredLighting})</span></dd>
        <dt>Recuperatieruimte</dt><dd>${i.recoveryLevel ? `niveau ${i.recoveryLevel}/2 (−${i.recoveryLevel * 3} vermoeidheid per week)` : 'geen'}</dd>
        <dt>Opleidingscentrum</dt><dd>${i.academyLevel ? `niveau ${i.academyLevel}/3` : 'geen'} <span class="muted small">(${i.academyLevel ? `${count(i.academyLevel, 'doorstromer')} extra per seizoen, en betere talenten` : 'jeugd traint op het A-terrein'})</span></dd>
      </dl>
      ${
        i.constructions.length
          ? `<p class="attention-inline">🏗️ Bezig: ${i.constructions
              .map((c) => `${esc(UPGRADES.find((u) => u.id === c.upgrade)!.label)}${c.seats ? ` (+${c.seats} plaatsen)` : ''}, nog ${weeks(c.weeksLeft)}`)
              .join(' · ')}</p>`
          : ''
      }
    </section>
    <section class="card">
      <h2>Onderhoud en energie ${hint('Dit is de post "onderhoud & energie" op je weekrekening: gras, verwarming, verlichting, poetsen en klein herstel. Minder onderhouden is goedkoper, maar het complex ziet er slechter uit (minder toeschouwers) en er gaat vaker iets stuk.')}</h2>
      <p>Nu: <strong>${euro(facilityCost(s))} per week</strong>.</p>
      <div class="choice-grid three">
        ${(['basis', 'normaal', 'premium'] as const)
          .map(
            (level) => `<div class="choice ${i.maintenance === level ? 'on' : ''}" data-action="maintenance" data-id="${level}">
            <strong>${level === 'basis' ? 'Basis' : level === 'normaal' ? 'Normaal' : 'Premium'}</strong>
            <span class="muted small">${level === 'basis' ? '25% goedkoper · 6% kans per week op een defect · minder toeschouwers' : level === 'normaal' ? 'standaard · 1,5% kans op een defect' : '30% duurder · alles piekfijn · meer toeschouwers'}</span>
            <span class="big">${euro(Math.round(facilityCost(s) / MAINTENANCE_FACTOR[i.maintenance] * MAINTENANCE_FACTOR[level]))}<span class="muted small">/week</span></span>
          </div>`,
          )
          .join('')}
      </div>
      <p class="muted small">☀️ Zonnepanelen en led drukken deze factuur met ${Math.round(GREEN_ENERGY_SAVING * 100)}%
      (${euro(Math.round(facilityCost(s) * GREEN_ENERGY_SAVING))} per week). ${
        i.greenEnergy ? 'Ze liggen er al.' : 'Je vindt ze bij de bouwprojecten hieronder.'
      }</p>
    </section>
    <section class="card span2">
      <h2>Bouwprojecten ${hint(`Er mogen ${projectLimit(s)} werven tegelijk lopen. Elk project wordt meteen betaald en is klaar na de vermelde bouwtijd.`)}</h2>
      <p class="muted small">Maximaal ${projectLimit(s)} projecten tegelijk — nu bezig: <strong>${i.constructions.length}</strong>.
        Te weinig geld? Neem een lening bij Financiën.${s.investor === 'aannemer' ? ' Je aannemer bouwt 15% goedkoper.' : ''}</p>
      ${tribuneCard(s)}
      <div class="choice-grid two">
        ${UPGRADES.filter((u) => u.id !== 'tribune')
          .map((u) => {
            const reason = canUpgrade(s, u.id);
            const busy = s.infrastructure.constructions.find((c) => c.upgrade === u.id);
            return `<div class="choice static"><strong>${esc(u.label)}</strong><span>${esc(u.description)}</span>
            ${impactChips(upgradeImpact(s, u.id), 5)}
            <span class="big">${euro(upgradeCost(s, u.id))}</span><span class="muted small">${upgradeWeeks(s, u.id)} weken bouwtijd</span>
            ${
              busy
                ? `<span class="attention-inline small">🏗️ bezig, nog ${weeks(busy.weeksLeft)}</span>`
                : reason
                  ? `<span class="muted small">${esc(reason)}</span>`
                  : `<button class="sm primary" data-action="upgrade" data-id="${u.id}" ${s.cash < upgradeCost(s, u.id) ? 'disabled' : ''}>Bouwen</button>`
            }</div>`;
          })
          .join('')}
      </div>
    </section>
  </div>`;
}

/** De jeugdwerking: welke ploegen je in competitie hebt en wat ze vragen. */
function youthCard(s: GameState): string {
  const c = s.community;
  const max = maxYouthTeams(s);
  const want = teamsFor(s);
  const shortage = youthShortage(s);
  const coach = s.staff.find((x) => x.role === 'jeugdcoordinator');
  const factor = youthCapacityFactor(s);

  const reasons: string[] = [];
  if (s.infrastructure.pitch !== 'kunstgras') reasons.push('kunstgras (+2 ploegen)');
  if (s.infrastructure.lightingLevel < 2) reasons.push('verlichting niveau 2 (+1)');
  if (s.infrastructure.academyLevel < 3) reasons.push(`opleidingscentrum (+2 per niveau, nu ${s.infrastructure.academyLevel}/3)`);
  // een jeugdcoördinator krijgt ploegen georganiseerd die je anders niet gedraaid kreeg
  if (coordinatorTeams(s) < 2) {
    reasons.push(
      coach
        ? `een betere jeugdcoördinator (${coach.name} zit op ${coach.skill}; vanaf 45 krijg je er een ploeg bij, vanaf 75 twee)`
        : 'een jeugdcoördinator aanwerven (+1 ploeg vanaf vaardigheid 45, +2 vanaf 75)',
    );
  }

  return `<section class="card span2">
    <h2>Jeugdwerking: ${c.youthTeams} ploegen ${hint(`Elke ploeg telt ongeveer ${MEMBERS_PER_TEAM} leden en bindt ${VOLUNTEERS_PER_TEAM} vrijwilligers: een jeugdtrainer en een ploegafgevaardigde. Zit je aan het plafond van je accommodatie, dan haken ouders af en groeit je ledenaantal niet meer.`)}</h2>
    <p class="small">${teamNames(s).map((t) => `<span class="tag">${t}</span>`).join(' ')}</p>
    <dl class="facts">
      <dt>Leden</dt><dd>${c.youthMembers} <span class="muted small">(ongeveer ${MEMBERS_PER_TEAM} per ploeg)</span></dd>
      <dt>Begeleiding</dt><dd class="${shortage ? 'neg' : ''}">${boundVolunteers(s)} vrijwilligers nodig, ${Math.min(c.volunteers, boundVolunteers(s))} beschikbaar${
        shortage ? ` — <strong>${shortage} te kort</strong>: ouders haken af en je vrijwilligers branden op` : ''
      }</dd>
      <dt>Coördinator</dt><dd>${coach ? `${esc(coach.name)} (${coach.skill}/100)${coordinatorTeams(s) ? ` — goed voor ${count(coordinatorTeams(s), 'ploeg', 'ploegen')} extra` : ''}` : '<span class="neg">geen — je jeugd draait op goodwill</span>'}</dd>
      <dt>Plaats op het complex</dt><dd class="${c.youthTeams >= max ? 'neg' : ''}">${c.youthTeams} van ${max} ploegen${c.youthTeams >= max ? ' — vol' : ''}</dd>
      <dt>Instroom</dt><dd>${Math.round(factor * 100)}% van normaal${factor < 1 ? ' door plaatsgebrek of te weinig begeleiding' : ''}</dd>
      <dt>Bij dit ledenaantal</dt><dd>${want} ploegen ${want > c.youthTeams ? '<span class="pos">(er komt er een bij in week 10)</span>' : want < c.youthTeams ? '<span class="neg">(er verdwijnt er een in week 10)</span>' : '(stabiel)'}</dd>
    </dl>
    <p class="muted small">Meer ploegen betekent meer leden, meer lidgeld, meer subsidie en meer doorstroming naar je A-kern — maar ook meer vrijwilligers die je niet voor evenementen kunt inzetten.
    ${reasons.length ? `Meer plaats maken kan met: ${reasons.join(', ')}.` : 'Je complex kan geen ploegen meer bijnemen.'}</p>
  </section>`;
}

export function eventsScreen(s: GameState): string {
  const c = s.community;
  const sat = volunteerSatisfaction(s);
  const organiser = delegate(s, 'evenementen');
  const recruiter = delegate(s, 'vrijwilligers');
  const pending = s.pending
    .map((p) => `<li>${esc(p.label)}: ${p.volunteers !== undefined ? 'nieuwe vrijwilligers' : euro(p.amount)} <span class="muted small">over ${weeks(p.weeksLeft)}</span></li>`)
    .join('');
  return `${taskPicker(s, ['evenementen', 'vrijwilligers'])}
  <section class="card">
    <h2>Vrijwilligers: ${c.volunteers} ${hint('Zonder vrijwilligers draait er niets: geen kantine, geen jeugdploegen, geen evenementen.')}</h2>
    <p class="muted small">Elke jeugdploeg houdt er twee bezig — een jeugdtrainer en een ploegafgevaardigde. Alleen wie overblijft kun je voor een evenement inzetten.
    Of ze blijven, hangt af van de sfeer, je reputatie, je kantineverantwoordelijke, je jeugdcoördinator, en of je ze niet te veel weekends na elkaar laat opdraven.</p>
    <p class="small"><span class="tag">${boundVolunteers(s)} bij de jeugd</span> <span class="tag">${freeVolunteers(s)} vrij voor evenementen</span>
      ${youthShortage(s) ? `<span class="tag bad">${youthShortage(s)} te kort bij de jeugd</span>` : ''}</p>
    <p class="muted small">Tevredenheid: <strong class="${sat < 45 ? 'neg' : sat > 65 ? 'pos' : ''}">${Math.round(sat)}/100</strong> — ${sat < 45 ? 'er haken regelmatig mensen af' : sat > 65 ? 'er sluiten spontaan mensen aan' : 'stabiel'}.
    Elk evenement vraagt een minimum aantal vrijwilligers en weegt daarna een aantal weken op de groep${c.volunteerLoyaltyWeeks ? `; dankzij het vrijwilligersfeest haakt er de komende ${weeks(c.volunteerLoyaltyWeeks)} bijna niemand af` : ''}.</p>
    ${recruiter ? `<p class="attention-inline small">${esc(recruiter.name)} regelt de werving van vrijwilligers.</p>` : ''}
    <div class="choice-grid three">
      ${VOLUNTEER_ACTIONS.map((a) => {
        const wait = s.eventCooldowns[`vrijwilligers-${a.id}`] ?? 0;
        const [min, max] = a.gain(c.youthMembers);
        return `<div class="choice static"><strong>${esc(a.label)}</strong><span>${esc(a.description)}</span>
          <dl class="mini"><dt>Kost</dt><dd>${euro(a.cost)}</dd><dt>Levert op</dt><dd>${min} tot ${max} vrijwilligers</dd><dt>Je hoort het</dt><dd>na ${weeks(a.weeks)}</dd></dl>
          ${wait ? `<span class="tag">opnieuw over ${weeks(wait)}</span>` : `<button class="sm primary" data-action="volunteer" data-id="${a.id}">Vrijwilligers zoeken</button>`}</div>`;
      }).join('')}
    </div>
  </section>
  ${pending ? `<section class="card"><h2>Nog te ontvangen</h2><ul>${pending}</ul></section>` : ''}
  <section class="card">
    <h2>Evenementen</h2>
    ${organiser ? `<p class="attention-inline small">${esc(organiser.name)} organiseert automatisch het evenement met de beste verwachte winst (maximaal één per 5 weken).</p>` : ''}
    <p class="muted small">De opbrengst is een prognose: het weer en de opkomst bepalen waar je uitkomt. Het geld komt pas binnen na de vermelde periode.
    Maximaal één evenement per week, en elk evenement heeft een maximum per seizoen (de buurt komt niet elke maand spaghetti eten).</p>
    <div class="choice-grid three">
      ${CLUB_EVENTS.map((e) => {
        const [min, max] = eventForecast(s, e);
        const reason = canOrganise(s, e);
        const netMin = min - e.cost;
        const netMax = max - e.cost;
        return `<div class="choice static"><strong>${esc(e.label)}</strong><span>${esc(e.description)}</span>
          <dl class="mini">
            <dt>Kost</dt><dd>${euro(e.cost)}</dd>
            <dt>Opbrengst</dt><dd>${euro(min)} tot ${euro(max)}</dd>
            <dt>Netto</dt><dd><span class="${netMin < 0 ? 'neg' : 'pos'}">${euro(netMin)}</span> tot <span class="${netMax < 0 ? 'neg' : 'pos'}">${euro(netMax)}</span></dd>
            <dt>Uitbetaling</dt><dd>na ${weeks(e.payoutWeeks)}</dd>
            <dt>Vrijwilligers</dt><dd class="${freeVolunteers(s) < e.volunteers ? 'neg' : ''}">${e.volunteers} vrij nodig ${freeVolunteers(s) < e.volunteers ? `<span class="muted small">(je hebt er ${freeVolunteers(s)} vrij)</span>` : ''}</dd>
            <dt>Daarna</dt><dd>${e.cooldown} weken wachten</dd>
            <dt>Dit seizoen</dt><dd class="${eventsThisSeason(s, e.id) >= e.maxPerSeason ? 'neg' : ''}">${eventsThisSeason(s, e.id)}/${e.maxPerSeason}</dd>
          </dl>
          ${reason ? `<span class="muted small">${esc(reason)}</span>` : `<button class="sm primary" data-action="event" data-id="${e.id}">Organiseren</button>`}</div>`;
      }).join('')}
    </div>
  </section>`;
}

export function leagueScreen(s: GameState): string {
  const table = sortedTable(s.league);
  const division = DIVISIONS[s.league.divisionLevel];
  const ours = s.league.fixtures.filter((f) => f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID).sort((a, b) => a.week - b.week);
  return `<div class="grid">
    <section class="card span2">
      <h2>${division.name} · ${seasonLabel(s.startYear, s.season)}</h2>
      <p class="muted small">1e = kampioen, 2e promoveert ook. De laatste 3 degraderen. Bij evenveel punten telt eerst het doelpuntensaldo.</p>
      <div class="table-wrap"><table class="compact league">
        <thead><tr>
          <th data-tip="De plaats in het klassement">Plaats</th><th>Club</th>
          <th class="num" ${tip('Gespeelde wedstrijden')}>Gespeeld</th>
          <th class="num" ${tip('Gewonnen wedstrijden (3 punten)')}>Winst</th>
          <th class="num" ${tip('Gelijkspelen (1 punt)')}>Gelijk</th>
          <th class="num" ${tip('Verloren wedstrijden')}>Verlies</th>
          <th class="num" ${tip('Doelpunten gemaakt')}>Voor</th>
          <th class="num" ${tip('Doelpunten tegengekregen')}>Tegen</th>
          <th class="num" ${tip('Doelpuntensaldo: gemaakt min tegengekregen')}>Saldo</th>
          <th class="num">Punten</th>
        </tr></thead>
        <tbody>${table
          .map((r, i) => {
            const diff = r.goalsFor - r.goalsAgainst;
            return `<tr class="${r.teamId === OWN_TEAM_ID ? 'own' : ''} ${i < 2 ? 'up' : i >= table.length - 3 ? 'down' : ''}">
            <td>${i + 1}</td><td>${esc(teamName(s, r.teamId))}${s.league.teams.find((t) => t.id === r.teamId)?.isRival ? ' <span class="tag">derby</span>' : ''}</td>
            <td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.drawn}</td><td class="num">${r.lost}</td>
            <td class="num">${r.goalsFor}</td><td class="num">${r.goalsAgainst}</td>
            <td class="num ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
            <td class="num"><strong>${r.points}</strong></td></tr>`;
          })
          .join('')}</tbody>
      </table></div>
    </section>
    ${rivalsCard(s)}
    <section class="card span2">
      <h2>Jouw wedstrijden</h2>
      <p class="muted small">Alles wat je dit seizoen speelde en nog speelt. De volledige agenda — met transferperiodes, uitbetalingen en vaste momenten — staat bij Bureau &rsaquo; Agenda.</p>
      <div class="table-wrap"><table class="compact">
        <tbody>${ours
          .map((f) => {
            const home = f.homeId === OWN_TEAM_ID;
            const opp = teamName(s, home ? f.awayId : f.homeId);
            const played = f.homeGoals !== undefined;
            const gf = home ? f.homeGoals : f.awayGoals;
            const ga = home ? f.awayGoals : f.homeGoals;
            const cls = played ? (gf! > ga! ? 'pos' : gf! < ga! ? 'neg' : '') : '';
            const icon = played ? (gf! > ga! ? '🏆' : gf! < ga! ? '🥀' : '🤝') : '';
            return `<tr><td>week ${f.week}</td><td><span class="venue ${home ? 'home' : 'away'}">${home ? '🏠 Thuis' : '🚌 Uit'}</span></td><td>${esc(opp)}</td><td class="num ${cls}">${played ? `${icon} ${gf}-${ga}` : ''}</td></tr>`;
          })
          .join('')}</tbody>
      </table></div>
    </section>
  </div>
  ${disciplineCard(s)}`;
}

/** Tuchtoverzicht: kaarten en schorsingen van alle ploegen. */
function disciplineCard(s: GameState): string {
  const rows: { name: string; team: string; own: boolean; y: number; r: number; susp: number }[] = [
    ...s.players.filter((p) => p.yellowCards || p.redCards || p.suspended).map((p) => ({ name: p.name, team: s.clubName, own: true, y: p.yellowCards, r: p.redCards, susp: p.suspended })),
    ...s.league.discipline.map((d) => ({ name: d.name, team: teamName(s, d.teamId), own: false, y: d.yellows, r: d.reds, susp: d.suspended })),
  ];
  const body = rows
    .sort((a, b) => b.susp - a.susp || b.r - a.r || b.y - a.y)
    .map(
      (r) => `<tr class="${r.own ? 'own' : ''}"><td>${esc(r.name)}</td><td>${esc(r.team)}</td>
        <td class="num" data-v="${r.y}">${r.y ? `🟨 ${r.y}` : ''}${r.y && r.y % YELLOW_LIMIT === YELLOW_LIMIT - 1 ? ' <span class="tag bad" data-tip="volgende gele kaart = schorsing">!</span>' : ''}</td>
        <td class="num" data-v="${r.r}">${r.r ? `🟥 ${r.r}` : ''}</td>
        <td class="num" data-v="${r.susp}">${r.susp ? `<span class="tag bad">${count(r.susp, 'wedstrijd', 'wedstrijden')}</span>` : ''}</td></tr>`,
    )
    .join('');
  return `<section class="card">
    <h2>Tuchtzaken</h2>
    <p class="muted small">Elke ${YELLOW_LIMIT}de gele kaart = 1 wedstrijd schorsing. Twee keer geel in één wedstrijd = rood (1 wedstrijd), direct rood = 1 tot 3 wedstrijden.
    Gele kaarten tellen per seizoen. Jouw club betaalt €${YELLOW_FINE} per gele en €${RED_FINE} per rode kaart. Een "!" betekent: nog één gele kaart tot een schorsing.</p>
    <div class="table-wrap tall"><table class="compact" data-sort-id="tucht">
      <thead><tr><th>Speler</th><th>Club</th><th class="num">Geel</th><th class="num">Rood</th><th class="num">Geschorst</th></tr></thead>
      <tbody>${body || '<tr><td colspan="5" class="muted">Nog geen kaarten dit seizoen.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

export function clubScreen(s: GameState): string {
  const ratings = clubRatings(s);
  const investor = INVESTORS.find((i) => i.id === s.investor)!;
  const background = BACKGROUNDS.find((b) => b.id === s.avatar.background)!;
  const c = s.community;
  return `${taskPicker(s, ['jeugd', 'medisch'])}<div class="grid">
    <section class="card">
      <h2>Eigenaar</h2>
      <div class="owner">${avatarSvg(s.avatar, 80)}<div><strong>${esc(s.avatar.name)}</strong><br/>${esc(background.name)}<br/><span class="muted small">${esc(background.perk)}</span></div></div>
    </section>
    <section class="card">
      <h2>Investeerder</h2>
      <p><strong>${esc(investor.name)}</strong> ${s.investorActive ? '' : '<span class="tag bad">teruggetrokken</span>'}</p>
      <ul class="small">${investor.conditions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${s.investor === 'fonds' && s.investorActive ? `<p class="small">Promoties sinds de start: ${s.promotionsWithInvestor}. Seizoen ${s.season} van 3.</p>` : ''}
    </section>
    ${ratings
      .map(
        (r) => `<section class="card"><h2>${r.label} ${stars(r.stars)}</h2>
        <div class="table-wrap"><table class="compact"><tbody>${r.parts.map((p) => `<tr><td>${p.label}</td><td>${bar(p.score)}</td><td class="num">${p.score}</td></tr>`).join('')}</tbody></table></div></section>`,
      )
      .join('')}
    ${youthCard(s)}
    <section class="card">
      <h2>Lidgeld jeugd</h2>
      <p>Ouders betalen nu <strong>€${s.youthFee}</strong> per seizoen, goed voor ongeveer <strong>${youthForecast(s)} leden</strong>.</p>
      <p class="muted small">Het bedrag zelf zet je bij Geld &rsaquo; Tickets en lidgeld, samen met je ticketprijs en je abonnementen.</p>
      <button data-action="nav" data-id="prijzen">Naar Tickets en lidgeld</button>
    </section>
    <section class="card">
      <h2>Kerncijfers</h2>
      <dl class="facts">
        <dt>Supporters</dt><dd>${c.fanBase}</dd>
        <dt>Sfeer</dt><dd>${bar(c.fanMood)} ${Math.round(c.fanMood)}</dd>
        <dt>Vrijwilligers</dt><dd>${c.volunteers} <span class="muted small">(${boundVolunteers(s)} bij de jeugd, ${freeVolunteers(s)} vrij)</span></dd>
        <dt>Reputatie</dt><dd>${bar(c.reputation)} ${Math.round(c.reputation)}</dd>
        <dt>Jeugdleden</dt><dd>${c.youthMembers} <span class="muted small">in ${c.youthTeams} ploegen</span></dd>
      </dl>
    </section>
    <section class="card span2">
      <h2>Clubgeschiedenis</h2>
      ${
        s.history.length
          ? `<div class="table-wrap"><table class="compact"><thead><tr><th>Seizoen</th><th>Reeks</th><th class="num">Plaats</th><th class="num">Punten</th><th>Resultaat</th><th class="num">Premie</th><th class="num">Financieel</th></tr></thead><tbody>
          ${s.history.map((h) => `<tr><td>${seasonLabel(s.startYear, h.season)}</td><td>${h.division}</td><td class="num">${h.position}</td><td class="num">${h.points}</td><td>${h.result}</td><td class="num">${h.prize ? euro(h.prize) : '–'}</td><td class="num">${signedEuro(h.profit)}</td></tr>`).join('')}
          </tbody></table></div>`
          : '<p class="muted">Nog geen afgewerkt seizoen.</p>'
      }
    </section>
  </div>`;
}

export function saveScreen(s: GameState, lastSaved: string, animate: boolean): string {
  return `<section class="card">
    <h2>Instellingen</h2>
    <label class="check"><input type="checkbox" data-action="toggle-anim" ${animate ? 'checked' : ''}/>
      <span>Animatie tonen na elke week<br/><span class="muted small">Uit = je ziet meteen het weekrapport. Sneltoetsen: spatie = volgende week of rapport sluiten, Esc = rapport sluiten.</span></span></label>
  </section>
  <section class="card">
    <h2>Versie ${VERSION}</h2>
    <p class="muted small">Wat er in deze en vorige versies veranderde.</p>
    ${CHANGELOG.slice(0, 3)
      .map((c) => `<details ${c.version === VERSION ? 'open' : ''}><summary><strong>${c.version}</strong> — ${esc(c.title)} <span class="muted small">${c.date}</span></summary><ul class="small">${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>`)
      .join('')}
  </section>
  <section class="card">
    <h2>Opslaan</h2>
    <p>Het spel wordt automatisch opgeslagen in deze browser na elke week en elke actie. ${lastSaved ? `<span class="muted small">Laatst opgeslagen: ${esc(lastSaved)}</span>` : ''}</p>
    <p class="muted small">Browsergegevens wissen = spel kwijt. Maak dus af en toe een back-up als bestand. Met dat bestand kun je ook op een andere computer verder spelen.</p>
    <div class="actions left">
      <button class="primary" data-action="export">Back-up downloaden</button>
      <label class="button">Back-up laden<input id="import-file" type="file" accept="application/json,.json" hidden/></label>
    </div>
    <h3>Nieuw spel</h3>
    <p class="muted small">Start opnieuw. Je huidige spel (${esc(s.clubName)}, seizoen ${s.season}) wordt overschreven, tenzij je eerst een back-up maakt.</p>
    <button class="danger" data-action="new-game">Nieuw spel starten</button>
  </section>`;
}

/**
 * De andere clubs in je reeks: wat ze vorige zomer deden en hoe ze ervoor staan.
 * Dit is de plek waar je merkt dat de reeks leeft — wie investeerde, wie moest inbinden.
 */
function rivalsCard(s: GameState): string {
  const rows = s.league.teams
    .map((t) => ({ team: t, club: findClub(s.world, t.clubId) }))
    .filter((x) => x.club)
    .sort((a, b) => b.club!.strength - a.club!.strength);
  if (!rows.length) return '';
  const moveWords: Record<string, string> = {
    versterken: 'versterkte de kern',
    bouwen: 'bouwde aan de accommodatie',
    jeugd: 'breidde de jeugd uit',
    besparen: 'haalde de riem aan',
    problemen: 'financiële zorgen',
    stilzitten: 'hield het bij het oude',
    opgedoekt: 'legde de boeken neer',
  };
  return `<section class="card span2">
      <h2>De clubs in je reeks</h2>
      <p class="muted small">Elke club heeft haar eigen bestuur, budget en ambitie. Wat ze deze zomer beslisten, merk je dit seizoen op het veld.</p>
      <div class="table-wrap"><table class="compact">
        <thead><tr>
          <th>Club</th>
          <th class="num" ${tip('Hoe sterk hun kern is, op dezelfde schaal als die van jou')}>Sterkte</th>
          <th ${tip('Hoe graag dit bestuur hogerop wil')}>Ambitie</th>
          <th ${tip('Accommodatie en jeugdwerking')}>Werking</th>
          <th>Vorige zomer</th>
        </tr></thead>
        <tbody>${rows
          .map(({ team, club }) => {
            const c = club!;
            const ambition = c.ambition >= 70 ? 'hoog' : c.ambition >= 45 ? 'gemiddeld' : 'laag';
            const trouble = c.trouble >= 70 ? ' <span class="tag neg">in nood</span>' : '';
            return `<tr>
              <td>${esc(team.name)}${team.isRival ? ' <span class="tag">derby</span>' : ''}${trouble}</td>
              <td class="num">${c.strength.toFixed(1)}</td>
              <td>${ambition}</td>
              <td class="small muted">accommodatie: ${LEVEL_WORDS[c.stadium]} · jeugd: ${LEVEL_WORDS[c.youth]}</td>
              <td class="small">${c.lastMove ? moveWords[c.lastMove] ?? '—' : 'nog geen zomer meegemaakt'}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
    </section>
`;
}
