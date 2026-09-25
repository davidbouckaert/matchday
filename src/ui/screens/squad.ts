import { deadlineBadge } from '../signals';
import type { GameState, Player, Position } from '../../engine/types';
import { formatWeek, isTransferWindow } from '../../engine/calendar';
import { FORMATIONS, POSITIONS, currentBid, isCorePlayer, isPromising, lineupGap, marketValue, overall, selectLineup, teamStrength } from '../../engine/players';
import { PLAN_INFO } from '../../engine/strategy';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import * as actions from '../../engine/actions';
import { available } from '../../engine/discipline';
import { transferWillingness } from '../../engine/appeal';
import { count, esc, euro, bar, starMark } from '../format';
import { hint, tip, tipAttr } from '../tooltip';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';
import { lineupBoard } from './lineup';
import { contractLabel } from './playercard';
import { ZONE_LABEL } from './lineup';
import { impactChips } from '../impact';
import { playerImpact } from '../../engine/impact';


/** Positielabels voor de filterknoppen op de transfermarkt (enkelvoud, zoals een speler zelf is). */
export const POSITION_LABEL: Record<Position, string> = { DOEL: 'Doelman', VERD: 'Verdediger', MIDD: 'Middenvelder', AANV: 'Aanvaller' };

function friendsOf(s: GameState, p: Player): string {
  const names = p.friends.map((id) => s.players.find((x) => x.id === id)?.name.split(' ')[0]).filter(Boolean);
  return names.length ? `🤝 ${names.join(', ')}` : '';
}

function signed(n: number): string {
  return `<span class="${n < 0 ? 'neg' : n > 0 ? 'pos' : 'muted'}">${n > 0 ? '+' : ''}${n}</span>`;
}

export function squadStats(s: GameState): string {
  const st = teamStrength(s);
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
    <!-- De grote sterktetegels en de linietegels stonden hier dubbel: de banner boven het
         veld toont totaal/aanval/verdediging al, en de linielabels op het veld de rest.
         Wat overblijft is het enige dat nérgens anders staat: waar die sterkte vandaan komt. -->
    <h2>Waar je sterkte vandaan komt</h2>
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
      ${st.outOfPosition ? `<span class="neg">${count(st.outOfPosition, 'speler')} buiten hun positie (elk 8 kwaliteit minder)</span>` : ''}
      ${st.missing ? `<span class="neg">${count(st.missing, 'plaats', 'plaatsen')} niet ingevuld</span>` : ''}
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
  return `<section class="card" data-tour-doel="kapitein">
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
        openHere ? ` · <span class="neg">${count(openHere, 'plaats', 'plaatsen')} die jij openliet</span>` : filled.length < need[pos] ? ` · <span class="neg">${count(need[pos] - filled.length, 'plaats', 'plaatsen')} leeg</span>` : ''
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
      ${pinned ? `<strong>${count(pinned, 'speler')}</strong> vastgezet` : 'Je trainer kiest voorlopig alles zelf'}${benched ? ` · <strong>${benched}</strong> op de wisselbank` : ''}.</p>
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
          benched ? 'Van de wisselbank halen' : 'Op de wisselbank zetten: hij kan invallen en pakt speelminuten'
        }">🔁</button>`;
  // Eén stip vertelt de toestand: groen staat opgesteld, geel zit op de bank, rood kan
  // niet spelen. Vroeger moest je dat afleiden uit ★ ✓ ☆ 🪑 ⛔ 🩹 door elkaar.
  const staat = unavailable ? 'out' : zone ? 'in' : 'bank';
  const staatTip = unavailable
    ? p.injuryWeeks
      ? `Geblesseerd, nog ${p.injuryWeeks} ${p.injuryWeeks === 1 ? 'week' : 'weken'}.`
      : p.suspended
        ? `Geschorst voor ${p.suspended} ${p.suspended === 1 ? 'wedstrijd' : 'wedstrijden'}.`
        : `Uitgeleend aan ${p.loan?.club ?? 'een andere club'}.`
    : zone
      ? `Staat zondag in de basis${zone !== p.position ? `, op ${zone} en dus buiten zijn positie` : ''}.`
      : benched
        ? 'Jij hield hem deze week uit de ploeg.'
        : 'Speelklaar, maar niet in de beste elf.';

  return `<tr class="${zone ? 'starter' : benched ? 'benched' : ''}">
    <td data-v="${zone ? 0 : benched ? 2 : 1}" class="pick-cell">
      <span class="pstate ${staat}" ${tipAttr(staatTip, esc(p.name))}></span>${pick}${
        zone && zone !== p.position ? ` <span class="tag bad" ${tipAttr(`Hij speelt op ${zone} terwijl hij ${p.position} is. Dat kost een stuk van zijn kwaliteit.`)}>${zone}</span>` : ''
      }</td>
    <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
    <td><strong>${esc(p.name)}</strong>${starMark(s, p)}${isCorePlayer(s, p) ? ` <span class="core" data-tip="Kernspeler: bij je beste elf of een groot talent">★</span>` : ''}${isPromising(p) ? ` <span class="tag good" data-tip="Beloftevol: ${p.age} jaar, kwaliteit ${overall(p)} van een mogelijke ${Math.round(p.potential)}">💎 beloftevol</span>` : ''}${roleTag(s, p.id)}${p.isYouth ? ' <span class="tag">eigen jeugd</span>' : ''}${p.injuryWeeks ? ` <span class="tag bad">${p.injuryWeeks}w geblesseerd</span>` : ''}${p.suspended ? ` <span class="tag bad">${p.suspended} ${p.suspended === 1 ? 'wedstrijd' : 'wedstrijden'} geschorst</span>` : ''}${p.loan?.type === 'uit' ? ` <span class="tag">uitgeleend aan ${esc(p.loan.club)}</span>` : ''}${p.loan?.type === 'in' ? ` <span class="tag">gehuurd van ${esc(p.loan.club)}</span>` : ''}${p.listed ? ' <span class="tag">te koop</span>' : ''}<br/><span class="muted small">${esc(p.trait)} ${friendsOf(s, p)}</span></td>
    <td>${p.age}</td>
    <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
    <td data-v="${p.trend}" class="small ${p.trend > 0 ? 'pos' : p.trend < 0 ? 'neg' : 'muted'}" data-tip="Verandering bij de laatste evolutie (om de 4 weken)">${p.trend > 0 ? `▲ +${p.trend}` : p.trend < 0 ? `▼ ${p.trend}` : '–'}</td>
    <td class="small" data-v="${p.technique}" ${tipAttr(`Techniek ${Math.round(p.technique)}, fysiek ${Math.round(p.physical)}.`, p.name)}>${Math.round(p.technique)} / ${Math.round(p.physical)}</td>
    <td data-v="${p.starts}" data-tip="Basisplaatsen dit seizoen (deze periode: ${p.periodStarts})">${p.starts}</td>
    <td data-v="${p.goals}" data-tip="Doelpunten dit seizoen">${p.goals ? `⚽ ${p.goals}` : '–'}</td>
    <td data-v="${p.morale}">${bar(p.morale)}</td>
    <td data-v="${p.form}">${signed(Math.round(p.form))}</td>
    <td data-v="${p.fatigue}" class="${p.fatigue > 35 ? 'fatigue-hi' : ''}">${Math.round(p.fatigue)}</td>
    <td data-v="${p.yellowCards * 10 + p.redCards * 30}" class="small">${p.yellowCards ? `🟨${p.yellowCards}` : ''}${p.redCards ? ` 🟥${p.redCards}` : ''}</td>
    <td data-v="${p.wage}">${euro(p.wage)}</td>
    <td data-v="${p.contractUntil}" class="${expiring ? 'neg' : ''}">${contractLabel(s, p).kort}</td>
    <td data-v="${marketValue(p, s.marketIndex)}">${euro(marketValue(p, s.marketIndex))}</td>
    <td class="btns">
      <button class="sm" data-action="goto-contracts" data-id="${p.id}" data-tip="Ga naar Contracten om met hem over een nieuw contract te praten">Contract verlengen</button>
      ${window ? `<button class="sm" data-action="sell" data-id="${p.id}" data-confirm="${esc(p.name)} verkopen voor ${euro(currentBid(p, s.marketIndex))}?" data-tip="Ingrijpend: hij is meteen en definitief verkocht tegen het bod van deze week.">Verkoop ${euro(currentBid(p, s.marketIndex))}</button>` : ''}
      <button class="sm ghost danger" data-action="release" data-id="${p.id}" data-confirm="${esc(p.name)} wegsturen?" data-tip="Ingrijpend: je betaalt zijn contract af en hij is meteen en definitief vertrokken — zonder overnamesom.">Wegsturen</button>
    </td>
  </tr>`;
}

/**
 * De kolomkoppen.
 *
 * Hier stond "Pos · Kwal/Pot · Techn/Fys · Moe · Loon/w", en de helft daarvan had geen
 * uitleg. Dat zijn vijf afkortingen op één regel die je eerst moet leren lezen, op het
 * scherm dat je elke week opent. Nu staan de woorden er voluit; wat niet in één woord
 * past, staat in de tooltip in plaats van in een afkorting.
 */
const TABLE_HEAD = `<thead><tr>
  <th data-tip="Staat hij zondag in de basiself?">Basis</th>
  <th data-tip="Zijn positie: doelman, verdediger, middenvelder of aanvaller">Positie</th>
  <th>Speler</th>
  <th>Leeftijd</th>
  <th data-tip="Zijn kwaliteit nu, en hoe goed hij ooit kan worden">Kwaliteit</th>
  <th data-tip="Hoeveel hij vooruit of achteruit ging bij de laatste evolutie, om de vier weken">Evolutie</th>
  <th data-tip="Techniek en fysiek. Techniek telt zwaarder voor aanvallers, fysiek voor verdedigers.">Techniek en fysiek</th>
  <th data-tip="Hoe vaak hij dit seizoen in de basiself stond">Gespeeld</th>
  <th data-tip="Doelpunten dit seizoen">Doelpunten</th>
  <th data-tip="Hoe goed hij in zijn vel zit, van 0 tot 100. Lage moraal drukt zijn prestaties.">Moraal</th>
  <th data-tip="Zit hij in een goede of slechte periode? Dit komt bovenop zijn kwaliteit.">Vorm</th>
  <th data-tip="Vermoeidheid van 0 tot 100. Boven de 50 speelt hij onder zijn niveau en raakt hij sneller geblesseerd.">Vermoeid</th>
  <th data-tip="Gele en rode kaarten dit seizoen">Kaarten</th>
  <th data-tip="Wat hij je elke week kost">Loon per week</th>
  <th data-tip="Hoelang hij nog vastligt">Contract</th>
  <th data-tip="Wat hij ongeveer waard is op de transfermarkt">Waarde</th>
  <th data-nosort></th>
</tr></thead>`;

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
      return `<li>${deadlineBadge(o.expiresInWeeks)} <strong>${esc(o.club)}</strong> biedt <strong>${euro(o.amount)}</strong> voor <button class="link-btn speler-link" data-action="goto-speler" data-id="${p.id}" data-tip="Spring naar ${esc(p.name)} in je kernlijst: zo zie je meteen wie hij is.">${esc(p.name)}</button> (marktwaarde ${euro(marketValue(p, s.marketIndex))}, nog ${weeks(o.expiresInWeeks)})
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
  ${offers ? `<section class="card attention"><h2>Biedingen op je spelers <span class="tag">${s.playerOffers.length}</span></h2><ul class="offers">${offers}</ul></section>` : ''}
  ${lineupBoard(s, pick, squadStats(s) + rolesCard(s))}
  <!-- Hier stond ook een kaarten-weergave van de kern, maar die toonde dezelfde spelers
       als het paneel naast het veld. Alleen de tabel bleef: die kan iets wat nergens
       anders kan — sorteren op loon, waarde en contract. -->
  <section class="card">
    <div class="view-switch">
      <h2>Alle cijfers <span class="tag">${s.players.length}</span></h2>
      <span class="muted small">${euro(wages)} loon per week${window ? '' : ' · verkopen kan alleen tijdens de transferperiode'}</span>
    </div>
    <p class="muted small">Klik op een kolomkop om te sorteren.</p>
    ${table('A-kern: de basiself', starters, '★ = door jou vastgezet, ✓ = aangevuld door je trainer. Klik op de ster om iemand vast te zetten of weer los te laten; met 🔁 zet je hem op de wisselbank.', 'Nog niemand opgesteld.', 'basis')}
    ${table('Bank en reserve', bench, 'Speelklaar, maar niet in de basis. Wie jij met 🔁 op de wisselbank zette, start niet maar kan invallen: speelminuten voor je beloften.', 'Geen reserves beschikbaar — dat is gevaarlijk bij een blessure.', 'bank')}
    ${out.length ? table('Niet beschikbaar', out, 'Geblesseerd, geschorst of uitgeleend. Zij kunnen deze week niet spelen.', '', 'out') : ''}
  </section>`;
}

function offersList(s: GameState): string {
  return s.playerOffers
    .map((o) => {
      const p = s.players.find((x) => x.id === o.playerId);
      if (!p) return '';
      return `<li>${deadlineBadge(o.expiresInWeeks)} <strong>${esc(o.club)}</strong> biedt <strong>${euro(o.amount)}</strong> voor <button class="link-btn speler-link" data-action="goto-speler" data-id="${p.id}" data-tip="Spring naar ${esc(p.name)} in je kernlijst: zo zie je meteen wie hij is.">${esc(p.name)}</button> (marktwaarde ${euro(marketValue(p, s.marketIndex))}, nog ${weeks(o.expiresInWeeks)})
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

/**
 * Je huurspelers houden.
 *
 * Een huurcontract loopt af op het einde van het seizoen. Wil je hem houden, dan moet je het
 * vragen aan de club die eigenaar is — en zíj beslissen. Daarom staat bij elk bedrag meteen
 * hoe groot de kans is dat ze ja zeggen, en die kans beweegt mee terwijl je aan het bedrag
 * draait. Het is dezelfde rekensom die een week later het antwoord maakt.
 */
export function loanKeepCard(s: GameState): string {
  const gehuurd = s.players.filter((p) => p.loan?.type === 'in');
  if (!gehuurd.length) return '';
  const vroeg = s.week < actions.LOAN_TALK_WEEK;

  const optie = (p: Player, soort: 'verlengen' | 'kopen', ref: number) => {
    const stand = actions.loanStanding(s, p);
    const rem = actions.loanRequestBlock(s, p, soort);
    const kans = actions.loanRequestChance(s, p, soort, ref);
    return `<div class="lk-rij">${numField({
      value: ref,
      min: 0,
      max: Math.max(1000, ref * 4),
      step: soort === 'verlengen' ? 250 : 500,
      prefix: '\u20ac',
      inputId: `huur-${soort}-${p.id}`,
      live: 'huur',
      label: `Bod om ${p.name} te ${soort}`,
    })}<button class="sm primary" data-action="loan-${soort === 'verlengen' ? 'extend' : 'buy'}" data-id="${p.id}"${
      rem ? ` disabled data-tip="${esc(rem)}"` : ''
    }>${soort === 'verlengen' ? 'Vragen' : 'Bieden'}</button></div>
    <span class="small muted lk-kans" id="kans-${soort}-${p.id}" ${tipAttr(
      `De kans dat ${p.loan!.club} ja zegt op dit bedrag. Meer bieden helpt altijd. Wat verder meetelt: hoeveel hij bij jou speelt (${Math.round(
        stand.speeltijd * 100,
      )}% van de wedstrijden) en hoeveel hij erop vooruitging (${stand.groei >= 0 ? '+' : ''}${stand.groei}). Speelt hij veel, dan verlengen ze graag maar verkopen ze hem niet graag; zit hij op de bank, dan is het net omgekeerd.`,
      'Kans op ja',
    )}>${Math.round(kans * 100)}% kans</span>`;
  };

  const rijen = gehuurd
    .map((p) => {
      const stand = actions.loanStanding(s, p);
      return `<tr>
        <td>${p.position}</td>
        <td><strong>${esc(p.name)}</strong>${starMark(s, p)}<br/>
          <span class="muted small">${p.age} jaar \u00b7 ${count(p.starts, 'basisplaats', 'basisplaatsen')} \u00b7 ${count(p.goals, 'doelpunt', 'doelpunten')} \u00b7 ${
            stand.groei >= 0 ? 'gegroeid +' : 'gezakt '
          }${stand.groei}</span></td>
        <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
        <td>${esc(p.loan!.club)}<br/><span class="muted small">${
          stand.tevreden >= 70 ? 'tevreden' : stand.tevreden >= 45 ? 'redelijk tevreden' : 'niet tevreden'
        } (${stand.tevreden}/100)</span></td>
        <td>${optie(p, 'verlengen', actions.extensionRef(s, p))}</td>
        <td>${optie(p, 'kopen', actions.purchaseRef(s, p))}</td>
      </tr>`;
    })
    .join('');

  return `<section class="card span-all">
    <h2>Huurspelers: houden of kopen <span class="tag">${gehuurd.length}</span></h2>
    <p class="muted small">${
      vroeg
        ? `Een huurspeler keert op het einde van het seizoen terug naar zijn club. Vanaf week ${actions.LOAN_TALK_WEEK} kun je vragen of hij mag blijven, of hem proberen te kopen.`
        : 'Zij beslissen, niet jij. Hoeveel hij speelt, hoeveel hij erop vooruitging en wat je biedt, bepalen samen of het ja of nee wordt. Zeggen ze nee, dan kun je het vier weken later opnieuw proberen.'
    }</p>
    <div class="table-wrap"><table class="compact contract-tabel huur-tabel">
      <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Gehuurd van</th>
        <th ${tipAttr('Hij blijft nog een seizoen op huurbasis. Zijn club wil vooral dat hij speelt en beter wordt.')}>Nog een seizoen huren</th>
        <th ${tipAttr('Hij wordt van jou en tekent een contract. Een profclub verkoopt niet graag aan een amateurclub.')}>Definitief kopen</th></tr></thead>
      <tbody>${rijen}</tbody>
    </table></div>
  </section>`;
}

/** Beloftevol-label naast een naam, ook in de compacte transfertabellen. */
function promisingTag(p: Player): string {
  return isPromising(p) ? ` <span class="tag good" data-tip="Beloftevol: ${p.age} jaar, kwaliteit ${overall(p)} van een mogelijke ${Math.round(p.potential)}">💎 beloftevol</span>` : '';
}

export function transfersScreen(s: GameState, filter: Position | null = null): string {
  const window = isTransferWindow(s.week);
  const scout = delegate(s, 'transfers');
  const offers = offersList(s);

  const transferList = filter ? s.transferList.filter((p) => p.position === filter) : s.transferList;
  const loanMarket = filter ? s.loanMarket.filter((p) => p.position === filter) : s.loanMarket;
  const ownPlayers = filter ? s.players.filter((p) => p.position === filter) : s.players;

  const filterBar = `<div class="transfer-filters">
    ${POSITIONS.map(
      (pos) =>
        `<button class="filter-pick ${filter === pos ? 'on' : ''}" data-action="transfer-filter" data-id="${pos}" ${tipAttr(
          `Toon alleen ${POSITION_LABEL[pos].toLowerCase()}s in de drie tabellen hieronder${filter === pos ? ' — nog eens klikken haalt de filter weg' : ''}.`,
        )}>${POSITION_LABEL[pos]}${filter === pos ? ' ●' : ''}</button>`,
    ).join('')}
    ${filter ? `<button class="filter-chip" data-action="transfer-filter" data-id="${filter}" aria-label="Filter op ${POSITION_LABEL[filter]} weghalen">${POSITION_LABEL[filter]} ✕</button>` : ''}
  </div>`;

  const buyRows = transferList
    .map((p) => {
      const wil = transferWillingness(s, p);
      return `<tr>
      <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
      <td><strong>${esc(p.name)}</strong>${promisingTag(p)}<br/><span class="muted small">${esc(p.trait)}</span></td>
      <td>${p.age}</td>
      <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
      <td class="small" data-v="${p.technique}" ${tipAttr(`Techniek ${Math.round(p.technique)}, fysiek ${Math.round(p.physical)}.`, p.name)}>${Math.round(p.technique)} / ${Math.round(p.physical)}</td>
      <td data-v="${p.wage}">${euro(p.wage)}</td>
      <td data-v="${p.purchasePrice}">${p.purchasePrice ? euro(p.purchasePrice) : '<span class="tag">transfervrij</span>'}</td>
      <td data-v="${Math.round(wil.kans * 100)}" class="small ${wil.toon}" ${tipAttr(
        wil.kans >= 1
          ? 'Jouw club is een ploeg van zijn niveau: hij tekent als jij wil.'
          : `Hij mikt hoger dan wat jouw club vandaag te bieden heeft: reeks, stand, accommodatie, trainer en kleedkamer wegen mee. Kans dat hij tekent: ${Math.round(wil.kans * 100)}%. Zegt hij nee, dan verdwijnt hij van je lijst — en tekent hij wél, dan vraagt hij een hoger loon voor de stap.`,
        p.name,
      )}>${wil.woord}</td>
      <td>${impactChips(playerImpact(s, p), 3)}</td>
      <td>${window ? `<button class="sm primary" data-action="buy" data-id="${p.id}">Aanwerven</button>` : ''}</td>
    </tr>`;
    })
    .join('');

  const loanRows = loanMarket
    .map((p) => {
      const wil = transferWillingness(s, p, true);
      return `<tr>
      <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
      <td><strong>${esc(p.name)}</strong>${promisingTag(p)}<br/><span class="muted small">van ${esc(p.loan?.club ?? '')}</span></td>
      <td>${p.age}</td>
      <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
      <td data-v="${p.wage}">${euro(p.wage)}</td>
      <td data-v="${p.purchasePrice}">${euro(p.purchasePrice)}</td>
      <td data-v="${Math.round(wil.kans * 100)}" class="small ${wil.toon}" ${tipAttr(
        wil.kans >= 1
          ? 'Een uitleenbeurt bij jou past in zijn plan: hij komt als jij wil.'
          : `Zelfs voor een uitleenbeurt vindt hij jouw club aan de kleine kant. Kans dat hij komt: ${Math.round(wil.kans * 100)}%.`,
        p.name,
      )}>${wil.woord}</td>
      <td>${window ? `<button class="sm primary" data-action="loan-in" data-id="${p.id}">Huren</button>` : ''}</td>
    </tr>`;
    })
    .join('');

  // Eén gedeelde breedte voor alle vraagprijsvelden in de kolom: anders wordt elk veld
  // breed naar de waarde van zíjn eigen speler, en schuiven "Te koop zetten" en de kolom
  // "Uitlenen" ernaast per rij een beetje op — precies het uitlijningsprobleem dat opviel.
  const askWidthHint = Math.max(1, ...ownPlayers.map((p) => marketValue(p, s.marketIndex))) * 10;

  const ownRows = [...ownPlayers]
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || overall(b) - overall(a))
    .map((p) => {
      const value = marketValue(p, s.marketIndex);
      let status = '';
      let sellHtml = '';
      let listHtml = '';
      let loanHtml = '';
      if (p.loan?.type === 'in') {
        status = `gehuurd van ${esc(p.loan.club)}`;
        sellHtml = `<button class="sm ghost danger" data-action="release" data-id="${p.id}" data-confirm="Huur van ${esc(p.name)} beëindigen?" data-tip="Ingrijpend: hij gaat meteen terug naar zijn club en komt dit seizoen niet meer voor je spelen.">Huur beëindigen</button>`;
      } else if (p.loan?.type === 'uit') {
        // wat zijn uitleenbeurt tot nu toe opleverde: anders is hij een naam die verdwijnt
        const gespeeld = p.loan.matches ?? 0;
        const groei = Math.round((overall(p) - (p.loan.quality ?? overall(p))) * 10) / 10;
        status = `uitgeleend aan ${esc(p.loan.club)} (${Math.round(p.loan.wageShare * 100)}% loon betaald)
          <br/><span class="muted small">${count(gespeeld, 'wedstrijd', 'wedstrijden')} gespeeld${
            groei > 0 ? ` · ${groei} punten sterker` : gespeeld > 6 ? ' · nog geen vooruitgang' : ''
          }</span>`;
      } else {
        const block = actions.departureBlockReason(s, p);
        status = p.listed ? `<span class="tag">te koop: ${euro(p.askingPrice)}</span>` : '';
        if (block) status += `<br/><span class="muted small" data-tip="${esc(block)}">🔒 onmisbaar deze week</span>`;
        const share = Math.round(actions.loanWageShare(s, p) * 100);
        sellHtml = window
          ? `<button class="sm" data-action="sell" data-id="${p.id}" data-confirm="${esc(p.name)} verkopen voor ${euro(currentBid(p, s.marketIndex))}?" ${block ? `disabled data-tip="${esc(block)}"` : 'data-tip="Ingrijpend: hij is meteen en definitief verkocht tegen het bod van deze week."'}>Nu verkopen ${euro(currentBid(p, s.marketIndex))}</button>`
          : '';
        listHtml = p.listed
          ? `<button class="sm" data-action="unlist" data-id="${p.id}">Van de lijst</button>`
          : `<span class="ask">${numField({ value: Math.round(value / 500) * 500, min: 0, step: 500, prefix: '€', inputId: `ask-${p.id}`, label: `Vraagprijs voor ${p.name}`, widthHint: askWidthHint })}<button class="sm" data-action="list" data-id="${p.id}">Te koop zetten</button></span>`;
        loanHtml = window
          ? `<button class="sm" data-action="loan-out" data-id="${p.id}" ${block ? `disabled data-tip="${esc(block)}"` : `data-tip="De andere club betaalt ${share}% van zijn loon; hij speelt daar en ontwikkelt zich"`}>Uitlenen (${share}% loon betaald)</button>`
          : '';
      }
      return `<tr>
        <td data-v="${POSITIONS.indexOf(p.position)}">${p.position}</td>
        <td><strong>${esc(p.name)}</strong>${starMark(s, p)}${isCorePlayer(s, p) ? ` <span class="core" data-tip="Kernspeler: hij hoort bij je beste elf of is een groot talent. Verkoop je hem, dan verzwak je meteen.">★</span>` : ''}${promisingTag(p)}<br/><span class="muted small">${p.age} jaar · ${p.starts} basisplaatsen</span></td>
        <td data-v="${overall(p)}"><strong>${overall(p)}</strong><span class="muted small"> / ${Math.round(p.potential)}</span></td>
        <td data-v="${value}">${euro(value)}</td>
        <td data-v="${p.wage}">${euro(p.wage)}</td>
        <td class="small">${status}</td>
        <td class="btns">${sellHtml}</td>
        <td class="btns">${listHtml}</td>
        <td class="btns">${loanHtml}</td>
      </tr>`;
    })
    .join('');

  return `<div class="cols-3 even">
    ${taskPicker(s, ['transfers'])}
    <section class="card window-banner ${window ? 'open' : 'shut'}">
      <h2>${window ? '🟢 Transferperiode open' : '🔴 Transferperiode gesloten'}</h2>
      <p class="muted small">${
        window
          ? `Kopen, verkopen, uitlenen en huren kan tot en met week ${nextWindowEnd(s)}. Daarna kun je alleen nog spelers te koop zetten en rondkijken.`
          : `De volgende transferperiode start in week ${nextWindowStart(s)} (${formatWeek(s.startYear, s.season, nextWindowStart(s))}). Tot dan kun je wel al te koop zetten en de markt volgen.`
      }</p>
    </section>
    <section class="card">
      <h2>Filter op positie ${hint('Klik op een positie om de drie tabellen hieronder (kopen, huren en je eigen kern) tot die positie te beperken. Nog eens klikken op dezelfde knop, of op het kruisje, haalt de filter weer weg.')}</h2>
      ${filterBar}
    </section>
  </div>
  ${offers ? `<section class="card attention"><h2>Biedingen op je spelers (${s.playerOffers.length})</h2><ul class="offers">${offers}</ul></section>` : ''}
  ${
    s.players.some((p) => p.loan?.type === 'in')
      ? `<p class="muted small">🤝 Je huurspelers verlengen of definitief kopen doe je bij <button class="link-btn" data-action="nav" data-id="contracten">Ploeg › Contracten</button> — daar staat alles over wie blijft.</p>`
      : ''
  }
  <section class="card" data-tour-doel="transfers">
    <h2>Transfermarkt: kopen</h2>
    <p class="muted small">${window ? 'De transferperiode is open. Elke week verdwijnen er spelers en komen er nieuwe bij.' : 'De transferperiode is gesloten. Je kunt al rondkijken; kopen, verkopen en huren kan van mei tot eind augustus en in januari.'}
    Een scout zorgt voor meer en betere spelers en lagere prijzen, een analist helpt hem.
    In de kolom "wat hij toevoegt" staat wat hij met jouw beste elf doet — vaak is dat niets, en dan betaal je voor de bank.
    En de speler beslist zelf mee: wie duidelijk boven jouw niveau speelt, komt niet zomaar — de kolom "Wil hij komen?" toont hoe hij naar je club kijkt, met dezelfde rekensom die zijn antwoord bepaalt.</p>
    ${
      scout
        ? `<div class="inline-form"><label>Transferbudget voor ${esc(scout.name)}${numField({ value: s.transferBudget, min: 0, step: 1000, prefix: '€', change: 'transfer-budget', inputId: 'transfer-budget', label: 'Transferbudget', extra: 'narrow' })}</label><span class="muted small">wordt meteen toegepast</span></div>
           <p class="muted small">De scout vult zelf tekorten per linie aan (minstens 2 doelmannen, 6 verdedigers, 6 middenvelders, 4 aanvallers), zolang het budget het toelaat.</p>`
        : ''
    }
    <div class="table-wrap"><table data-sort-id="transfers">
      <thead><tr><th>Pos</th><th>Speler</th><th>Leeftijd</th><th>Kwal/Pot</th><th>Techn/Fys</th><th>Loon/w</th><th>Prijs</th><th>Wil hij komen?</th><th data-nosort>Wat hij toevoegt</th><th data-nosort></th></tr></thead>
      <tbody>${buyRows || `<tr><td colspan="10" class="muted">${filter ? `Geen ${POSITION_LABEL[filter].toLowerCase()}s beschikbaar — haal de filter weg voor de hele markt.` : 'Geen spelers beschikbaar.'}</td></tr>`}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Huren van profclubs</h2>
    <p class="muted small">Jonge spelers die beter zijn dan je niveau, tot het einde van het seizoen. Je betaalt een huurvergoeding en een deel van hun loon; daarna keren ze terug. Nieuw aanbod in juli en januari.</p>
    <div class="table-wrap"><table data-sort-id="huur">
      <thead><tr><th>Pos</th><th>Speler</th><th>Leeftijd</th><th>Kwal/Pot</th><th>Jouw loondeel/w</th><th>Huurvergoeding</th><th>Wil hij komen?</th><th data-nosort></th></tr></thead>
      <tbody>${loanRows || `<tr><td colspan="8" class="muted">${filter ? `Geen ${POSITION_LABEL[filter].toLowerCase()}s te huur — haal de filter weg voor de hele markt.` : window ? 'Geen huurspelers meer beschikbaar.' : 'Buiten de transferperiode is er geen huuraanbod.'}</td></tr>`}</tbody>
    </table></div>
  </section>
  <section class="card">
    <h2>Jouw spelers: verkopen, te koop zetten of uitlenen ${hint('★ = kernspeler. Een slotje betekent dat hij deze week niet weg mag: je zou onder 16 spelers zakken of zonder reserve vallen op zijn positie (je laatste doelman kun je dus nooit verkopen of uitlenen).')}</h2>
    <p class="muted small"><strong>Nu verkopen</strong>: meteen weg tegen het bod van deze week (schommelt). <strong>Te koop zetten</strong>: clubs kunnen tijdens de transferperiode een bod doen; hoe realistischer je vraagprijs, hoe groter de kans. De speler vindt het niet leuk (−4 moraal).
    <strong>Uitlenen</strong>: tot het einde van het seizoen; de andere club betaalt een deel van zijn loon en hij krijgt speelminuten, dus hij blijft groeien.</p>
    <div class="table-wrap"><table data-sort-id="eigen">
      <thead><tr><th>Pos</th><th>Speler</th><th>Kwal/Pot</th><th>Waarde</th><th>Loon/w</th><th>Status</th><th data-nosort></th><th data-nosort></th><th data-nosort></th></tr></thead>
      <tbody>${ownRows || `<tr><td colspan="9" class="muted">Geen ${filter ? POSITION_LABEL[filter].toLowerCase() + 's' : 'spelers'} in je kern.</td></tr>`}</tbody>
    </table></div>
  </section>`;
}
