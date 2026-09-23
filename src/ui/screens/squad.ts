import type { GameState, Player, Position } from '../../engine/types';
import { formatWeek, isTransferWindow } from '../../engine/calendar';
import { DIVISIONS } from '../../engine/data/divisions';
import { FORMATIONS, POSITIONS, currentBid, isCorePlayer, lineupGap, marketValue, overall, selectLineup, teamStrength } from '../../engine/players';
import { PLAN_INFO } from '../../engine/strategy';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import * as actions from '../../engine/actions';
import { available } from '../../engine/discipline';
import { OPPONENT_STAFF_BONUS } from '../../engine/league';
import { esc, euro, bar } from '../format';
import { hint, tip } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';
import { lineupBoard } from './lineup';

const ZONE_LABEL: Record<Position, string> = { DOEL: 'Doel', VERD: 'Verdediging', MIDD: 'Middenveld', AANV: 'Aanval' };

function friendsOf(s: GameState, p: Player): string {
  const names = p.friends.map((id) => s.players.find((x) => x.id === id)?.name.split(' ')[0]).filter(Boolean);
  return names.length ? `🤝 ${names.join(', ')}` : '';
}

function signed(n: number): string {
  return `<span class="${n < 0 ? 'neg' : n > 0 ? 'pos' : 'muted'}">${n > 0 ? '+' : ''}${n}</span>`;
}

/** Tegel met één cijfer, vergeleken met de gemiddelde tegenstander. */
function tile(label: string, value: number, ref: number, sub = ''): string {
  const diff = Math.round((value - ref) * 10) / 10;
  return `<div class="tile"><span class="label">${label}</span><strong>${value}</strong>
    <span class="small">${signed(diff)} <span class="muted">t.o.v. gemiddelde tegenstander</span></span>${sub ? `<span class="muted small">${sub}</span>` : ''}</div>`;
}

export function squadStats(s: GameState): string {
  const st = teamStrength(s);
  const ref = DIVISIONS[s.league.divisionLevel].opponentStrength + OPPONENT_STAFF_BONUS;
  const depth = POSITIONS.map((pos) => {
    const all = s.players.filter((p) => p.position === pos);
    const fit = all.filter((p) => p.injuryWeeks === 0 && p.suspended === 0).length;
    const out = all.length - fit;
    return `${ZONE_LABEL[pos]}: ${fit}${out ? ` <span class="neg">(+${out} geblesseerd/geschorst)</span>` : ''}`;
  });
  const avail = available(s.players).length;
  const gap = lineupGap(s);
  const complete = gap.available >= 11;
  const shortOf = POSITIONS.filter((pos) => gap.missing[pos] > 0).map((pos) => `${gap.missing[pos]} ${ZONE_LABEL[pos].toLowerCase()}`);
  return `<section class="card">
    <div class="lineup-count ${complete ? 'ok' : 'bad'}" ${tip(complete ? 'Je kunt een volledige ploeg opstellen.' : 'Met minder dan 11 beschikbare spelers verlies je automatisch met 0-5 en betaal je €1.000 boete. Haal spelers bij Transfers of wacht tot iemand fit is.')}>
      <strong>${gap.available}/11</strong> speelklare spelers ${complete ? '✅' : '⛔'}
      ${complete ? '' : `<span class="small">tekort: ${shortOf.join(', ') || 'spelers'} — je kunt pas verder naar de volgende week als je 11 speelklare spelers hebt</span>`}
    </div>
    ${avail < 13 && complete ? `<p class="attention-inline small">Let op: slechts ${avail} spelers beschikbaar. Eén blessure erbij en je kunt geen elf meer opstellen.</p>` : ''}
    <h2>Ploegsterkte</h2>
    <div class="tiles">
      ${tile('Totaal', st.total, ref)}
      ${tile('Aanvalskracht', st.attack, ref, '30% middenveld + 70% aanval')}
      ${tile('Verdedigingskracht', st.defense, ref, '20% doel + 55% verdediging + 25% middenveld')}
    </div>
    <h3>Per linie (kwaliteit van de basisspelers)</h3>
    <div class="tiles four">
      ${POSITIONS.map((pos) => `<div class="tile"><span class="label">${ZONE_LABEL[pos]}</span><strong>${st.zones[pos]}</strong>${bar(st.zones[pos] - 20, 60)}</div>`).join('')}
    </div>
    <h3>Bonussen en minpunten</h3>
    <div class="mods">
      <span>Samenwerking ${signed(st.chemistry)}</span>
      <span>Personeel (hoofdtrainer, assistent-trainer, data-analist) ${signed(st.trainer)}</span>
      <span>Moraal ${signed(st.morale)}</span>
      <span>Vorm ${signed(st.form)}</span>
      <span>Training (scherpte) ${signed(st.sharpness)}</span>
      <span ${tip('Kapitein met leiderschap en ervaring, plus vaste strafschop- en hoekschopnemers. Staan ze niet in de basis, dan telt hun bonus niet mee.')}>Spelersrollen ${signed(st.roles)}</span>
      <span>Vermoeidheid ${st.fatigue}/100 → ×${st.fatigueFactor.toFixed(3)}</span>
      <span>Formatie en mentaliteit: aanval ${signed(st.tactic.att)} · verdediging ${signed(st.tactic.def)}</span>
      <span>Spelplan ${PLAN_INFO[s.tactics.plan].label.toLowerCase()} past bij je spelers ${signed(st.planFit)}</span>
      ${st.outOfPosition ? `<span class="neg">${st.outOfPosition} speler(s) buiten hun positie (−8 elk)</span>` : ''}
      ${st.missing ? `<span class="neg">${st.missing} plaats(en) niet ingevuld</span>` : ''}
    </div>
    <p class="muted small">Beschikbaar per linie: ${depth.join(' · ')}. Het voor- of nadeel van je spelplan tegen de volgende tegenstander zie je bij Strategie.</p>
  </section>`;
}

const ROLE_LABEL: Record<string, string> = { kapitein: 'Kapitein', strafschop: 'Strafschopnemer', hoekschop: 'Hoekschopnemer' };
const ROLE_ICON: Record<string, string> = { kapitein: '🅒', strafschop: '⚽', hoekschop: '🚩' };

function roleTag(s: GameState, playerId: string): string {
  return (Object.keys(ROLE_LABEL) as (keyof typeof s.tactics.roles)[])
    .filter((r) => s.tactics.roles[r] === playerId)
    .map((r) => ` <span class="tag" data-tip="${ROLE_LABEL[r]}">${ROLE_ICON[r]} ${ROLE_LABEL[r]}</span>`)
    .join('');
}

/** Kapitein en de nemers kiezen. */
export function rolesCard(s: GameState): string {
  const coach = delegate(s, 'spelersrollen');
  const options = [...s.players].filter((p) => p.loan?.type !== 'uit').sort((a, b) => overall(b) - overall(a));
  const select = (role: keyof typeof s.tactics.roles) => {
    const current = s.tactics.roles[role];
    if (coach) {
      const p = options.find((x) => x.id === current);
      return `<strong>${p ? esc(p.name) : 'niemand'}</strong> <span class="muted small">gekozen door ${esc(coach.name)}</span>`;
    }
    return `<select data-change="player-role" data-id="${role}" aria-label="${ROLE_LABEL[role]}">
      <option value="">— niemand —</option>
      ${options.map((p) => `<option value="${p.id}" ${current === p.id ? 'selected' : ''}>${esc(p.name)} (${p.position}, ${overall(p)})</option>`).join('')}
    </select>`;
  };
  return `<section class="card">
    <h2>Spelersrollen ${hint('De kapitein tilt de ploeg op als hij leiderschap heeft en in de basis staat; een lastpak als kapitein werkt averechts. De nemers van strafschoppen en hoekschoppen leveren extra doelpunten uit stilstaande fases, zeker met trainingsfocus spelhervattingen.')}</h2>
    <div class="role-grid">
      ${(['kapitein', 'strafschop', 'hoekschop'] as const)
        .map((role) => `<div><span class="label">${ROLE_ICON[role]} ${ROLE_LABEL[role]}</span>${select(role)}</div>`)
        .join('')}
    </div>
    <p class="muted small">Samen goed voor ${s.tactics.roles.kapitein || s.tactics.roles.strafschop || s.tactics.roles.hoekschop ? `${teamStrength(s).roles > 0 ? '+' : ''}${teamStrength(s).roles}` : '0'} op je teamsterkte. Wijzigingen zijn meteen actief.</p>
  </section>`;
}

/** Wie er in de basis staat per linie, met een teller tegenover je formatie. */
export function lineupCard(s: GameState): string {
  const need = FORMATIONS[s.tactics.formation];
  const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps);
  const coach = delegate(s, 'opstelling');

  const lines = POSITIONS.map((pos) => {
    const filled = slots.filter((x) => x.zone === pos);
    const own = filled.filter((x) => x.player.position === pos).length;
    const foreign = filled.length - own;
    const ready = s.players.filter(
      (p) => p.position === pos && p.injuryWeeks === 0 && p.suspended === 0 && p.loan?.type !== 'uit' && !s.tactics.benched.includes(p.id),
    ).length;
    const openHere = Math.min(need[pos], s.tactics.gaps?.[pos] ?? 0);
    const ok = filled.length >= need[pos] && !foreign;
    return `<div class="line ${ok ? 'ok' : filled.length < need[pos] ? 'bad' : 'warn'}">
      <span class="line-head"><strong>${ZONE_LABEL[pos]}</strong>
        <span class="count">${filled.length}/${need[pos]}</span></span>
      <span class="muted small">${ready} speelklaar in de kern${foreign ? ` · <span class="neg">${foreign} buiten positie</span>` : ''}${
        openHere ? ` · <span class="neg">${openHere} plaats(en) die jij openliet</span>` : filled.length < need[pos] ? ` · <span class="neg">${need[pos] - filled.length} plaats(en) leeg</span>` : ''
      }</span>
      <ul class="line-players small">
        ${Array.from({ length: openHere }, () => '<li class="neg open-slot">— open, duid zelf iemand aan —</li>').join('')}
        ${filled
          .sort((a, b) => b.rating - a.rating)
          .map(
            (x) => `<li>${s.tactics.manualXI.includes(x.player.id) ? '<span class="pin" data-tip="door jou vastgezet">★</span>' : '<span class="auto" data-tip="gekozen door je trainer">✓</span>'}
              ${esc(x.player.name)} <span class="muted">${overall(x.player)}</span>${
                x.player.position !== pos ? ` <span class="tag bad" data-tip="eigenlijk ${x.player.position}">${x.player.position}</span>` : ''
              }${roleTag(s, x.player.id)}</li>`,
          )
          .join('') || (openHere ? '' : '<li class="neg">niemand</li>')}
      </ul>
    </div>`;
  }).join('');

  const total = slots.length;
  const pinned = s.tactics.manualXI.length;
  const benched = s.tactics.benched.length;
  return `<section class="card">
    <h2>Basiself: <span class="${total < 11 ? 'neg' : ''}">${total}/11</span> ${hint('De teller per linie komt uit je formatie. ★ = door jou vastgezet, ✓ = aangevuld door je trainer. Staat er iemand buiten zijn positie, dan verliest hij 8 punten kwaliteit.')}</h2>
    <p class="muted small">Formatie <strong>${s.tactics.formation}</strong>${coach ? ` · gekozen door ${esc(coach.name)}` : ''} · wijzig de formatie bij Ploeg › Strategie.
      ${pinned ? `<strong>${pinned}</strong> speler(s) vastgezet` : 'Je trainer kiest voorlopig alles zelf'}${benched ? ` · <strong>${benched}</strong> op de bank gezet` : ''}.</p>
    <div class="lineup-lines">${lines}</div>
    ${
      coach || (!pinned && !benched)
        ? ''
        : '<p class="actions left"><button class="sm ghost" data-action="auto-lineup">Alles loslaten (trainer kiest)</button></p>'
    }
  </section>`;
}

/** Eén rij in de spelerstabel. */
function playerRow(s: GameState, p: Player, zoneOf: Map<string, Position>, window: boolean, coach: ReturnType<typeof delegate>, lockTip: string): string {
  const expiring = p.contractUntil <= s.season;
  const zone = zoneOf.get(p.id);
  const pinned = s.tactics.manualXI.includes(p.id);
  const benched = s.tactics.benched.includes(p.id);
  const unavailable = p.injuryWeeks > 0 || p.suspended > 0 || p.loan?.type === 'uit';
  const pick = coach
    ? `<span class="locked-cell" data-tip="${esc(lockTip)}"><button class="star" disabled>${zone ? '✓' : '☆'}</button></span>`
    : unavailable
      ? '<span class="muted">–</span>'
      : `<button class="star ${pinned ? 'on' : ''}" data-action="starter" data-id="${p.id}" data-tip="${
          pinned ? 'Niet meer vastzetten: je trainer kiest weer' : 'Vast in de basis zetten'
        }">${pinned ? '★' : zone ? '✓' : '☆'}</button>
        <button class="bench ${benched ? 'on' : ''}" data-action="bench" data-id="${p.id}" data-tip="${
          benched ? 'Weer beschikbaar maken' : 'Deze week niet opstellen'
        }">${benched ? '⛔' : '🪑'}</button>`;
  return `<tr class="${zone ? 'starter' : benched ? 'benched' : ''}">
    <td data-v="${zone ? 0 : benched ? 2 : 1}" class="pick-cell">${pick}${zone && zone !== p.position ? ` <span class="tag bad" data-tip="speelt buiten zijn positie">${zone}</span>` : ''}</td>
    <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
    <td><strong>${esc(p.name)}</strong>${isCorePlayer(s, p) ? ` <span class="core" data-tip="Kernspeler: bij je beste elf of een groot talent">★</span>` : ''}${roleTag(s, p.id)}${p.isYouth ? ' <span class="tag">eigen jeugd</span>' : ''}${p.injuryWeeks ? ` <span class="tag bad">🩹 ${p.injuryWeeks}w</span>` : ''}${p.suspended ? ` <span class="tag bad" data-tip="geschorst">⛔ ${p.suspended} wedstr.</span>` : ''}${p.loan?.type === 'uit' ? ` <span class="tag">uitgeleend aan ${esc(p.loan.club)}</span>` : ''}${p.loan?.type === 'in' ? ` <span class="tag">gehuurd van ${esc(p.loan.club)}</span>` : ''}${p.listed ? ' <span class="tag">te koop</span>' : ''}<br/><span class="muted small">${esc(p.trait)} ${friendsOf(s, p)}</span></td>
    <td>${p.age}</td>
    <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
    <td data-v="${p.trend}" class="small ${p.trend > 0 ? 'pos' : p.trend < 0 ? 'neg' : 'muted'}" data-tip="Verandering bij de laatste evolutie (om de 4 weken)">${p.trend > 0 ? `▲ +${p.trend}` : p.trend < 0 ? `▼ ${p.trend}` : '–'}</td>
    <td class="small" data-v="${p.technique}">T ${Math.round(p.technique)} · F ${Math.round(p.physical)}</td>
    <td data-v="${p.starts}" data-tip="Basisplaatsen dit seizoen (deze periode: ${p.periodStarts})">${p.starts}</td>
    <td data-v="${p.goals}" data-tip="Doelpunten dit seizoen">${p.goals ? `⚽ ${p.goals}` : '–'}</td>
    <td data-v="${p.morale}">${bar(p.morale)}</td>
    <td data-v="${p.form}">${signed(Math.round(p.form))}</td>
    <td data-v="${p.fatigue}" class="${p.fatigue > 35 ? 'fatigue-hi' : ''}">${Math.round(p.fatigue)}</td>
    <td data-v="${p.yellowCards * 10 + p.redCards * 30}" class="small">${p.yellowCards ? `🟨${p.yellowCards}` : ''}${p.redCards ? ` 🟥${p.redCards}` : ''}</td>
    <td data-v="${p.wage}">${euro(p.wage)}</td>
    <td data-v="${p.contractUntil}" class="${expiring ? 'neg' : ''}">S${p.contractUntil}</td>
    <td data-v="${marketValue(p, s.marketIndex)}">${euro(marketValue(p, s.marketIndex))}</td>
    <td class="btns">
      <button class="sm" data-action="goto-contracts" data-id="${p.id}" data-tip="Onderhandelen over een nieuw contract (tab Contracten)">Contract</button>
      ${window ? `<button class="sm" data-action="sell" data-id="${p.id}" data-tip="Verkoop tegen het bod van deze week">Verkoop ${euro(currentBid(p, s.marketIndex))}</button>` : ''}
      <button class="sm ghost" data-action="release" data-id="${p.id}" data-tip="Contract ontbinden">Ontbind</button>
    </td>
  </tr>`;
}

const TABLE_HEAD = `<thead><tr><th>Basis</th><th>Pos</th><th>Speler</th><th>Leeftijd</th><th>Kwal/Pot</th><th data-tip="Evolutie om de 4 weken">Trend</th><th>Techn/Fys</th><th data-tip="Basisplaatsen dit seizoen">Basis</th><th data-tip="Doelpunten dit seizoen">Goals</th><th>Moraal</th><th>Vorm</th><th data-tip="Vermoeidheid 0-100">Moe</th><th>Kaarten</th><th>Loon/w</th><th>Contract</th><th>Waarde</th><th data-nosort></th></tr></thead>`;

export function squadScreen(s: GameState, open: Record<string, boolean> = { basis: false, bank: false, out: false }, pick: string | null = null): string {
  const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps);
  const zoneOf = new Map(slots.map((x) => [x.player.id, x.zone]));
  const window = isTransferWindow(s.week);
  const wages = s.players.reduce((sum, p) => sum + p.wage, 0);
  const coach = delegate(s, 'opstelling');
  const lockTip = coach ? `De basiself wordt gekozen door ${coach.name}. Neem de taak "Strategie" terug bij Personeel om zelf spelers vast te zetten.` : '';

  const offers = s.playerOffers
    .map((o) => {
      const p = s.players.find((x) => x.id === o.playerId);
      if (!p) return '';
      return `<li><strong>${esc(o.club)}</strong> biedt <strong>${euro(o.amount)}</strong> voor ${esc(p.name)} (marktwaarde ${euro(marketValue(p, s.marketIndex))}, nog ${weeks(o.expiresInWeeks)})
        <span class="btns"><button class="primary sm" data-action="accept-offer" data-id="${o.id}">Aanvaarden</button><button class="sm" data-action="decline-offer" data-id="${o.id}">Weigeren</button></span></li>`;
    })
    .join('');

  const order = (a: Player, b: Player) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || overall(b) - overall(a);
  const unavailable = (p: Player) => p.injuryWeeks > 0 || p.suspended > 0 || p.loan?.type === 'uit';
  const starters = s.players.filter((p) => zoneOf.has(p.id)).sort(order);
  const bench = s.players.filter((p) => !zoneOf.has(p.id) && !unavailable(p)).sort(order);
  const out = s.players.filter((p) => !zoneOf.has(p.id) && unavailable(p)).sort(order);

  const table = (title: string, list: Player[], hintText: string, empty: string, id: string) => `<section class="card">
    <details data-table="${id}" ${open[id] ? 'open' : ''}>
      <summary><span class="table-title">${title} <span class="muted">(${list.length})</span></span> ${hint(hintText)}</summary>
      ${
        list.length
          ? `<div class="table-wrap"><table data-sort-id="${id}">${TABLE_HEAD}
              <tbody>${list.map((p) => playerRow(s, p, zoneOf, window, coach, lockTip)).join('')}</tbody>
            </table></div>`
          : `<p class="muted">${empty}</p>`
      }
    </details>
  </section>`;

  // Het veld met de kern ernaast is het werkblad; de tabellen met alle cijfers staan
  // eronder, ingeklapt, voor wie wil sorteren op loon, waarde of contract.
  return `${taskPicker(s, ['opstelling', 'spelersrollen'])}
  ${offers ? `<section class="card attention"><h2>Biedingen op je spelers <span class="tag bad">${s.playerOffers.length}</span></h2><ul class="offers">${offers}</ul></section>` : ''}
  ${lineupBoard(s, pick)}
  <div class="cols-2">
    <div class="col">${squadStats(s)}</div>
    <div class="col">${rolesCard(s)}</div>
  </div>
  <section class="card">
    <p class="muted small">Alle cijfers per speler, om te sorteren en te vergelijken. Klik op een kolomkop om te sorteren.
      Kern: ${s.players.length} spelers voor ${euro(wages)}/week.${window ? '' : ' Verkopen kan alleen tijdens de transferperiode.'}</p>
    ${table('A-kern: de basiself', starters, '★ = door jou vastgezet, ✓ = aangevuld door je trainer. Klik op de ster om iemand vast te zetten of weer los te laten; met 🪑 zet je hem deze week op de bank.', 'Nog niemand opgesteld.', 'basis')}
    ${table('Bank en reserve', bench, 'Speelklaar, maar niet in de basis. Wie jij met ⛔ op de bank hield, wordt niet opgesteld; klik nogmaals om hem weer beschikbaar te maken.', 'Geen reserves beschikbaar — dat is gevaarlijk bij een blessure.', 'bank')}
    ${out.length ? table('Niet beschikbaar', out, 'Geblesseerd, geschorst of uitgeleend. Zij kunnen deze week niet spelen.', '', 'out') : ''}
  </section>`;
}

function offersList(s: GameState): string {
  return s.playerOffers
    .map((o) => {
      const p = s.players.find((x) => x.id === o.playerId);
      if (!p) return '';
      return `<li><strong>${esc(o.club)}</strong> biedt <strong>${euro(o.amount)}</strong> voor ${esc(p.name)} (marktwaarde ${euro(marketValue(p, s.marketIndex))}, nog ${weeks(o.expiresInWeeks)})
        <span class="btns"><button class="primary sm" data-action="accept-offer" data-id="${o.id}">Aanvaarden</button><button class="sm" data-action="decline-offer" data-id="${o.id}">Weigeren</button></span></li>`;
    })
    .join('');
}

/** Laatste week van de lopende transferperiode. */
function nextWindowEnd(s: GameState): number {
  let w = s.week;
  while (w < 52 && isTransferWindow(w + 1)) w++;
  return w;
}

/** Eerste week van de volgende transferperiode. */
function nextWindowStart(s: GameState): number {
  for (let w = s.week + 1; w <= 52; w++) if (isTransferWindow(w)) return w;
  return 1;
}

export function transfersScreen(s: GameState): string {
  const window = isTransferWindow(s.week);
  const scout = delegate(s, 'transfers');
  const offers = offersList(s);

  const buyRows = s.transferList
    .map(
      (p) => `<tr>
      <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
      <td><strong>${esc(p.name)}</strong><br/><span class="muted small">${esc(p.trait)}</span></td>
      <td>${p.age}</td>
      <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
      <td class="small" data-v="${p.technique}">T ${Math.round(p.technique)} · F ${Math.round(p.physical)}</td>
      <td data-v="${p.wage}">${euro(p.wage)}</td>
      <td data-v="${p.purchasePrice}">${p.purchasePrice ? euro(p.purchasePrice) : '<span class="tag">transfervrij</span>'}</td>
      <td>${window ? `<button class="sm primary" data-action="buy" data-id="${p.id}">Aanwerven</button>` : ''}</td>
    </tr>`,
    )
    .join('');

  const loanRows = s.loanMarket
    .map(
      (p) => `<tr>
      <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
      <td><strong>${esc(p.name)}</strong><br/><span class="muted small">van ${esc(p.loan?.club ?? '')}</span></td>
      <td>${p.age}</td>
      <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
      <td data-v="${p.wage}">${euro(p.wage)}</td>
      <td data-v="${p.purchasePrice}">${euro(p.purchasePrice)}</td>
      <td>${window ? `<button class="sm primary" data-action="loan-in" data-id="${p.id}">Huren</button>` : ''}</td>
    </tr>`,
    )
    .join('');

  const ownRows = [...s.players]
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || overall(b) - overall(a))
    .map((p) => {
      const value = marketValue(p, s.marketIndex);
      let status = '';
      let actionsHtml = '';
      if (p.loan?.type === 'in') {
        status = `gehuurd van ${esc(p.loan.club)}`;
        actionsHtml = `<button class="sm ghost" data-action="release" data-id="${p.id}">Huur beëindigen</button>`;
      } else if (p.loan?.type === 'uit') {
        status = `uitgeleend aan ${esc(p.loan.club)} (${Math.round(p.loan.wageShare * 100)}% loon betaald)`;
      } else {
        const block = actions.departureBlockReason(s, p);
        status = p.listed ? `<span class="tag">te koop: ${euro(p.askingPrice)}</span>` : '';
        if (block) status += `<br/><span class="muted small" data-tip="${esc(block)}">🔒 onmisbaar deze week</span>`;
        const share = Math.round(actions.loanWageShare(s, p) * 100);
        actionsHtml = `
          ${window ? `<button class="sm" data-action="sell" data-id="${p.id}" ${block ? `disabled data-tip="${esc(block)}"` : 'data-tip="Verkoop meteen tegen het bod van deze week"'}>Nu verkopen ${euro(currentBid(p, s.marketIndex))}</button>` : ''}
          ${
            p.listed
              ? `<button class="sm" data-action="unlist" data-id="${p.id}">Van de lijst</button>`
              : `<span class="ask">${numField({ value: Math.round(value / 500) * 500, min: 0, step: 500, prefix: '€', inputId: `ask-${p.id}`, label: `Vraagprijs voor ${p.name}` })}<button class="sm" data-action="list" data-id="${p.id}">Te koop zetten</button></span>`
          }
          ${window ? `<button class="sm" data-action="loan-out" data-id="${p.id}" ${block ? `disabled data-tip="${esc(block)}"` : `data-tip="De andere club betaalt ${share}% van zijn loon; hij speelt daar en ontwikkelt zich"`}>Uitlenen (${share}% loon betaald)</button>` : ''}`;
      }
      return `<tr>
        <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
        <td><strong>${esc(p.name)}</strong>${isCorePlayer(s, p) ? ` <span class="core" data-tip="Kernspeler: hij hoort bij je beste elf of is een groot talent. Verkoop je hem, dan verzwak je meteen.">★</span>` : ''}<br/><span class="muted small">${p.age} jaar · ${p.starts} basisplaatsen</span></td>
        <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
        <td data-v="${value}">${euro(value)}</td>
        <td data-v="${p.wage}">${euro(p.wage)}</td>
        <td class="small">${status}</td>
        <td class="btns">${actionsHtml}</td>
      </tr>`;
    })
    .join('');

  return `${taskPicker(s, ['transfers'])}
  <section class="card window-banner ${window ? 'open' : 'shut'}">
    <h2>${window ? '🟢 Transferperiode open' : '🔴 Transferperiode gesloten'}</h2>
    <p class="muted small">${
      window
        ? `Kopen, verkopen, uitlenen en huren kan tot en met week ${nextWindowEnd(s)}. Daarna kun je alleen nog spelers te koop zetten en rondkijken.`
        : `De volgende transferperiode start in week ${nextWindowStart(s)} (${formatWeek(s.startYear, s.season, nextWindowStart(s))}). Tot dan kun je wel al te koop zetten en de markt volgen.`
    }</p>
  </section>
  ${offers ? `<section class="card attention"><h2>Biedingen op je spelers (${s.playerOffers.length})</h2><ul class="offers">${offers}</ul></section>` : ''}
  <section class="card">
    <h2>Transfermarkt: kopen</h2>
    <p class="muted small">${window ? 'De transferperiode is open. Elke week verdwijnen er spelers en komen er nieuwe bij.' : 'De transferperiode is gesloten. Je kunt al rondkijken; kopen, verkopen en huren kan van mei tot eind augustus en in januari.'}
    Een scout zorgt voor meer en betere spelers en lagere prijzen, een analist helpt hem.</p>
    ${
      scout
        ? `<div class="inline-form"><label>Transferbudget voor ${esc(scout.name)}${numField({ value: s.transferBudget, min: 0, step: 1000, prefix: '€', change: 'transfer-budget', inputId: 'transfer-budget', label: 'Transferbudget', extra: 'narrow' })}</label><span class="muted small">wordt meteen toegepast</span></div>
           <p class="muted small">De scout vult zelf tekorten per linie aan (minstens 2 doelmannen, 6 verdedigers, 6 middenvelders, 4 aanvallers), zolang het budget het toelaat.</p>`
        : ''
    }
    <div class="table-wrap"><table data-sort-id="transfers">
      <thead><tr><th>Pos</th><th>Speler</th><th>Leeftijd</th><th>Kwal/Pot</th><th>Techn/Fys</th><th>Loon/w</th><th>Prijs</th><th data-nosort></th></tr></thead>
      <tbody>${buyRows || '<tr><td colspan="8" class="muted">Geen spelers beschikbaar.</td></tr>'}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Huren van profclubs</h2>
    <p class="muted small">Jonge spelers die beter zijn dan je niveau, tot het einde van het seizoen. Je betaalt een huurvergoeding en een deel van hun loon; daarna keren ze terug. Nieuw aanbod in juli en januari.</p>
    <div class="table-wrap"><table data-sort-id="huur">
      <thead><tr><th>Pos</th><th>Speler</th><th>Leeftijd</th><th>Kwal/Pot</th><th>Jouw loondeel/w</th><th>Huurvergoeding</th><th data-nosort></th></tr></thead>
      <tbody>${loanRows || `<tr><td colspan="7" class="muted">${window ? 'Geen huurspelers meer beschikbaar.' : 'Buiten de transferperiode is er geen huuraanbod.'}</td></tr>`}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Jouw spelers: verkopen, te koop zetten of uitlenen ${hint('★ = kernspeler. Een slotje betekent dat hij deze week niet weg mag: je zou onder 16 spelers zakken of zonder reserve vallen op zijn positie (je laatste doelman kun je dus nooit verkopen of uitlenen).')}</h2>
    <p class="muted small"><strong>Nu verkopen</strong>: meteen weg tegen het bod van deze week (schommelt). <strong>Te koop zetten</strong>: clubs kunnen tijdens de transferperiode een bod doen; hoe realistischer je vraagprijs, hoe groter de kans. De speler vindt het niet leuk (−4 moraal).
    <strong>Uitlenen</strong>: tot het einde van het seizoen; de andere club betaalt een deel van zijn loon en hij krijgt speelminuten, dus hij blijft groeien.</p>
    <div class="table-wrap"><table data-sort-id="eigen">
      <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Waarde</th><th>Loon/w</th><th>Status</th><th data-nosort></th></tr></thead>
      <tbody>${ownRows}</tbody>
    </table></div>
  </section>`;
}
