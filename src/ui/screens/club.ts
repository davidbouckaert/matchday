import type { GameState } from '../../engine/types';
import { CLUB_EVENTS, UPGRADES, VOLUNTEER_ACTIONS } from '../../engine/data/catalog';
import { DIVISIONS } from '../../engine/data/divisions';
import { BACKGROUNDS, INVESTORS } from '../../engine/data/setup';
import { GREEN_ENERGY_SAVING, greenEnergyCost, YOUTH_FEE_REF, YOUTH_FEE_WEEK, eventsThisSeason, canOrganise, canUpgrade, eventForecast, upgradeCost, youthForecast, youthTarget } from '../../engine/actions';
import { MAINTENANCE_FACTOR, facilityCost } from '../../engine/finance';
import { volunteerSatisfaction } from '../../engine/turn';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import { RED_FINE, YELLOW_FINE, YELLOW_LIMIT } from '../../engine/discipline';
import { OWN_TEAM_ID, sortedTable, teamName } from '../../engine/league';
import { clubRatings } from '../../engine/ratings';
import { seasonLabel } from '../../engine/calendar';
import { CHANGELOG, VERSION } from '../../version';
import { avatarSvg } from '../avatar';
import { bar, esc, euro, signedEuro, stars } from '../format';
import { hint, tip } from '../tooltip';

export function infraScreen(s: GameState): string {
  const i = s.infrastructure;
  const division = DIVISIONS[s.league.divisionLevel];
  const next = DIVISIONS[Math.min(DIVISIONS.length - 1, s.league.divisionLevel + 1)];
  const building = i.construction ? UPGRADES.find((u) => u.id === i.construction!.upgrade) : null;
  return `<div class="grid">
    <section class="card">
      <h2>Accommodatie</h2>
      <dl class="facts">
        <dt>Tribune</dt><dd>${i.capacity} plaatsen <span class="muted small">(nodig: ${division.requiredCapacity}, volgende reeks ${next.requiredCapacity})</span></dd>
        <dt>Kantine</dt><dd>niveau ${i.kantineLevel}/5</dd>
        <dt>Terrein</dt><dd>${i.pitch}</dd>
        <dt>Verlichting</dt><dd>niveau ${i.lightingLevel}/3 <span class="muted small">(nodig: ${division.requiredLighting}, volgende reeks ${next.requiredLighting})</span></dd>
        <dt>Recuperatieruimte</dt><dd>${i.recoveryLevel ? `niveau ${i.recoveryLevel}/2 (−${i.recoveryLevel * 3} vermoeidheid per week)` : 'geen'}</dd>
        <dt>Opleidingscentrum</dt><dd>${i.academyLevel ? `niveau ${i.academyLevel}/3` : 'geen'} <span class="muted small">(${i.academyLevel ? `+${i.academyLevel} doorstromer(s) per seizoen, betere talenten` : 'jeugd traint op het A-terrein'})</span></dd>
      </dl>
      ${building ? `<p class="attention-inline">🏗️ Bezig: ${esc(building.label)}, nog ${i.construction!.weeksLeft} weken.</p>` : ''}
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
      <h3>Zonnepanelen en led</h3>
      <p class="muted small">Eenmalige investering van ${euro(greenEnergyCost(s))}: daarna betaal je elke week ${Math.round(GREEN_ENERGY_SAVING * 100)}% minder
      (${euro(Math.round(facilityCost(s) * GREEN_ENERGY_SAVING))} per week). Terugverdiend na ongeveer drie seizoenen; de prijs hangt af van hoe groot je complex is.</p>
      ${
        i.greenEnergy
          ? `<p class="attention-inline small">☀️ De panelen liggen er: ${Math.round(GREEN_ENERGY_SAVING * 100)}% minder vaste kosten.</p>`
          : `<button class="primary" data-action="green-energy" ${s.cash < greenEnergyCost(s) ? 'disabled' : ''}>Zonnepanelen plaatsen (${euro(greenEnergyCost(s))})</button>`
      }
    </section>
    <section class="card span2">
      <h2>Bouwprojecten</h2>
      <p class="muted small">Eén project tegelijk. Te weinig geld? Neem een lening bij Financiën.${s.investor === 'aannemer' ? ' Je aannemer bouwt 15% goedkoper.' : ''}</p>
      <div class="choice-grid two">
        ${UPGRADES.map((u) => {
          const reason = canUpgrade(s, u.id);
          return `<div class="choice static"><strong>${esc(u.label)}</strong><span>${esc(u.description)}</span>
            <span class="big">${euro(upgradeCost(s, u.id))}</span><span class="muted small">${u.weeks} weken bouwtijd</span>
            ${reason ? `<span class="muted small">${esc(reason)}</span>` : `<button class="sm primary" data-action="upgrade" data-id="${u.id}">Starten</button>`}</div>`;
        }).join('')}
      </div>
    </section>
  </div>`;
}

export function eventsScreen(s: GameState): string {
  const c = s.community;
  const sat = volunteerSatisfaction(s);
  const organiser = delegate(s, 'evenementen');
  const recruiter = delegate(s, 'vrijwilligers');
  const pending = s.pending
    .map((p) => `<li>${esc(p.label)}: ${p.volunteers !== undefined ? 'nieuwe vrijwilligers' : euro(p.amount)} <span class="muted small">over ${weeks(p.weeksLeft)}</span></li>`)
    .join('');
  return `
  <section class="card">
    <h2>Vrijwilligers: ${c.volunteers} ${hint('Vrijwilligers dragen de kantine en elk evenement. Hun tevredenheid hangt af van de sfeer, je reputatie, je kantineverantwoordelijke en hoeveel evenementen je kort na elkaar organiseert. Onder 50 haken er mensen af, boven 65 sluiten er spontaan mensen aan.')}</h2>
    <p class="muted small">Tevredenheid: <strong class="${sat < 45 ? 'neg' : sat > 65 ? 'pos' : ''}">${Math.round(sat)}/100</strong> — ${sat < 45 ? 'er haken regelmatig mensen af' : sat > 65 ? 'er sluiten spontaan mensen aan' : 'stabiel'}.
    Elk evenement vraagt een minimum aantal vrijwilligers en weegt daarna een aantal weken op de groep${c.volunteerLoyaltyWeeks ? `; dankzij het vrijwilligersfeest haakt er de komende ${weeks(c.volunteerLoyaltyWeeks)} bijna niemand af` : ''}.</p>
    ${recruiter ? `<p class="attention-inline small">${esc(recruiter.name)} regelt de werving van vrijwilligers.</p>` : ''}
    <div class="choice-grid three">
      ${VOLUNTEER_ACTIONS.map((a) => {
        const wait = s.eventCooldowns[`vrijwilligers-${a.id}`] ?? 0;
        const [min, max] = a.gain(c.youthMembers);
        return `<div class="choice static"><strong>${esc(a.label)}</strong><span>${esc(a.description)}</span>
          <dl class="mini"><dt>Kost</dt><dd>${euro(a.cost)}</dd><dt>Verwacht</dt><dd>+${min} tot +${max} vrijwilligers</dd><dt>Resultaat</dt><dd>na ${weeks(a.weeks)}</dd></dl>
          ${wait ? `<span class="tag">opnieuw over ${weeks(wait)}</span>` : `<button class="sm primary" data-action="volunteer" data-id="${a.id}">Starten</button>`}</div>`;
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
            <dt>Vrijwilligers</dt><dd class="${c.volunteers < e.volunteers ? 'neg' : ''}">${e.volunteers} nodig ${c.volunteers < e.volunteers ? `<span class="muted small">(je hebt er ${c.volunteers})</span>` : ''}</dd>
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
          <th>#</th><th>Club</th>
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
    <section class="card span2">
      <h2>Kalender</h2>
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
            return `<tr><td>W${f.week}</td><td><span class="venue ${home ? 'home' : 'away'}">${home ? '🏠 Thuis' : '🚌 Uit'}</span></td><td>${esc(opp)}</td><td class="num ${cls}">${played ? `${icon} ${gf}-${ga}` : ''}</td></tr>`;
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
        <td class="num" data-v="${r.y}">${r.y ? `🟨 ${r.y}` : ''}${r.y && r.y % YELLOW_LIMIT === YELLOW_LIMIT - 1 ? ' <span class="tag bad" title="volgende gele kaart = schorsing">!</span>' : ''}</td>
        <td class="num" data-v="${r.r}">${r.r ? `🟥 ${r.r}` : ''}</td>
        <td class="num" data-v="${r.susp}">${r.susp ? `<span class="tag bad">${r.susp} wedstr.</span>` : ''}</td></tr>`,
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
  return `<div class="grid">
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
        <table class="compact"><tbody>${r.parts.map((p) => `<tr><td>${p.label}</td><td>${bar(p.score)}</td><td class="num">${p.score}</td></tr>`).join('')}</tbody></table></section>`,
      )
      .join('')}
    <section class="card">
      <h2>Clubbeleid: lidgeld jeugd</h2>
      <div class="inline-form">
        <label>Lidgeld per seizoen (€)<input id="youth-fee" type="number" min="0" max="800" step="10" value="${s.youthFee}" data-change="youth-fee"/></label>
        <span class="muted small">wordt meteen toegepast</span>
      </div>
      <p class="small">Inschrijvingen in week ${YOUTH_FEE_WEEK}. Verwacht bij €${s.youthFee}: <strong>~${youthForecast(s)} leden</strong> → ${euro(youthForecast(s) * s.youthFee)}.</p>
      <table class="compact"><thead><tr><th>Lidgeld</th><th class="num">Leden dit seizoen</th><th class="num">Opbrengst</th><th class="num">Leden op termijn</th><th class="num">Opbrengst op termijn</th></tr></thead><tbody>
        ${[...new Set([150, 190, 230, 280, 340, s.youthFee])].sort((a, b) => a - b).map((fee) => `<tr${fee === s.youthFee ? ' class="own"' : ''}><td>€${fee}</td><td class="num">${youthForecast(s, fee)}</td><td class="num">${euro(youthForecast(s, fee) * fee)}</td><td class="num">${youthTarget(s, fee)}</td><td class="num">${euro(youthTarget(s, fee) * fee)}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted small">Het aantal leden schuift elk seizoen maar half op naar het niveau "op termijn": een prijsverhoging lijkt eerst voordelig, maar ouders haken geleidelijk af.</p>
      <p class="muted small">Gangbaar in de regio: €${YOUTH_FEE_REF}. Duurder = minder leden (en boven €${Math.round(YOUTH_FEE_REF * 1.5)} morren de supporters); goedkoper = meer leden en wat reputatie. Meer leden betekent ook meer subsidie, kantine-omzet en talent, maar ook meer werkingskosten (€3 per lid per week).</p>
    </section>
    <section class="card">
      <h2>Kerncijfers</h2>
      <dl class="facts">
        <dt>Supporters</dt><dd>${c.fanBase}</dd>
        <dt>Sfeer</dt><dd>${bar(c.fanMood)} ${Math.round(c.fanMood)}</dd>
        <dt>Vrijwilligers</dt><dd>${c.volunteers}</dd>
        <dt>Reputatie</dt><dd>${bar(c.reputation)} ${Math.round(c.reputation)}</dd>
        <dt>Jeugdleden</dt><dd>${c.youthMembers}</dd>
      </dl>
    </section>
    <section class="card span2">
      <h2>Clubgeschiedenis</h2>
      ${
        s.history.length
          ? `<table class="compact"><thead><tr><th>Seizoen</th><th>Reeks</th><th class="num">Plaats</th><th class="num">Ptn</th><th>Resultaat</th><th class="num">Premie</th><th class="num">Financieel</th></tr></thead><tbody>
          ${s.history.map((h) => `<tr><td>${seasonLabel(s.startYear, h.season)}</td><td>${h.division}</td><td class="num">${h.position}</td><td class="num">${h.points}</td><td>${h.result}</td><td class="num">${h.prize ? euro(h.prize) : '–'}</td><td class="num">${signedEuro(h.profit)}</td></tr>`).join('')}
          </tbody></table>`
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
