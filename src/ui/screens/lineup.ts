// De opstelling: links het veld, rechts je kern.
//
// Wat er stond was één tabel van zeventien kolommen, met een sterretje per rij om iemand
// vast te zetten. Alles stond erin, maar de vraag die je stelt als je hiernaar kijkt —
// "wie staat er zondag, en wie mis ik?" — kon je er niet aan aflezen. Je moest de
// formatie in je hoofd houden en rij per rij nagaan wie er een vinkje had.
//
// Nu zie je de elf staan zoals ze zondag staan. Klik iemand op het veld aan en de kern
// ernaast toont wie hem kan vervangen; klik die en ze wisselen. De tabel met alle cijfers
// blijft bestaan, maar ingeklapt, voor als je wil sorteren op loon of contract.

import type { Formation, GameState, Player, Position } from '../../engine/types';
import { FORMATIONS, POSITIONS, isCorePlayer, marketValue, overall, selectLineup } from '../../engine/players';
import { delegate } from '../../engine/delegation';
import { esc, euro } from '../format';
import { hint, tipAttr } from '../tooltip';

/* --------------------------------------------------------------- hulpstukken */

/** Kan deze speler zondag spelen? */
export function playable(p: Player): boolean {
  return p.injuryWeeks === 0 && p.suspended === 0 && p.loan?.type !== 'uit';
}

/** Waarom iemand niet beschikbaar is, in één woord voor op een kaartje. */
function blockLabel(p: Player): string {
  if (p.injuryWeeks > 0) return `🩹 ${p.injuryWeeks}w`;
  if (p.suspended > 0) return `⛔ ${p.suspended}`;
  if (p.loan?.type === 'uit') return '↗ uit';
  return '';
}

/** Vermoeidheid als vier blokjes: vol = fris, leeg = op. */
function fitness(p: Player): string {
  const level = Math.max(0, Math.min(4, 4 - Math.round(p.fatigue / 15)));
  return `<span class="fit f${level}" ${tipAttr(
    `Vermoeidheid ${Math.round(p.fatigue)}/100. Boven de 25 gaat het ten koste van zijn spel, boven de 50 riskeert hij een blessure op training.`,
    'Frisheid',
  )}>${'▰'.repeat(level)}${'▱'.repeat(4 - level)}</span>`;
}

const trend = (p: Player) =>
  p.trend > 0 ? `<span class="pos">▲${p.trend.toFixed(1)}</span>` : p.trend < 0 ? `<span class="neg">▼${Math.abs(p.trend).toFixed(1)}</span>` : '<span class="muted">–</span>';

/** Het rolletje van een speler: kapitein, strafschop, hoekschop. */
function roleMark(s: GameState, id: string): string {
  const r = s.tactics.roles;
  const marks: string[] = [];
  if (r.kapitein === id) marks.push(`<span class="role-mark" ${tipAttr('Kapitein', 'Rol')}>Ⓒ</span>`);
  if (r.strafschop === id) marks.push(`<span class="role-mark" ${tipAttr('Strafschopnemer', 'Rol')}>⊙</span>`);
  if (r.hoekschop === id) marks.push(`<span class="role-mark" ${tipAttr('Hoekschopnemer', 'Rol')}>⌐</span>`);
  return marks.join('');
}

/* ------------------------------------------------------------------- het veld */

/** Eén speler op het veld. */
function pitchChip(s: GameState, p: Player, zone: Position, selected: string | null, locked: boolean): string {
  const pinned = s.tactics.manualXI.includes(p.id);
  const wrong = p.position !== zone;
  const isSel = selected === p.id;
  return `<button class="chip-player ${isSel ? 'sel' : ''} ${pinned ? 'pinned' : 'auto'}" ${locked ? 'disabled' : ''}
    data-action="pitch-pick" data-id="${p.id}"
    ${tipAttr(
      locked
        ? 'Je trainer stelt op. Neem de taak "Opstelling" terug bij Personeel om zelf te kiezen.'
        : isSel
          ? 'Gekozen. Klik nu iemand in je kern om te wisselen, of klik hem opnieuw om te annuleren.'
          : `${p.name}, ${p.position}, kwaliteit ${overall(p)}. Klik om hem te vervangen.${pinned ? ' Door jou vastgezet.' : ' Gekozen door je trainer.'}`,
      p.name,
    )}>
    <span class="chip-top">
      <span class="chip-rating">${overall(p)}</span>
      ${pinned ? '<span class="chip-pin" aria-label="vastgezet">★</span>' : ''}
    </span>
    <span class="chip-name">${esc(p.name.split(' ').at(-1) ?? p.name)}</span>
    <span class="chip-foot">${fitness(p)}${roleMark(s, p.id)}${wrong ? `<span class="chip-wrong" ${tipAttr(`${p.name} is ${p.position}, maar staat hier als ${zone}. Dat kost hem punten.`, 'Buiten positie')}>${zone}</span>` : ''}</span>
  </button>`;
}

/** Een lege plaats: jij hebt iemand weggehaald en nog niemand aangeduid. */
function emptySlot(zone: Position, locked: boolean): string {
  return `<button class="chip-player empty" ${locked ? 'disabled' : ''} data-action="pitch-pick" data-id="leeg:${zone}"
    ${tipAttr(`Deze plaats in de ${zone.toLowerCase()} staat open. Klik en duid dan iemand uit je kern aan.`, 'Open plaats')}>
    <span class="chip-top"><span class="chip-rating">–</span></span>
    <span class="chip-name">open</span>
    <span class="chip-foot">${zone}</span>
  </button>`;
}

/**
 * Het veld. De rijen staan zoals je een ploeg tekent: doel onderaan, aanval bovenaan.
 */
function pitch(s: GameState, selected: string | null): string {
  const locked = !!delegate(s, 'opstelling');
  const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps);
  const counts = FORMATIONS[s.tactics.formation];
  const gaps = s.tactics.gaps ?? {};

  // van aanval naar doel, zoals je naar een veld kijkt
  const rows = ([...POSITIONS].reverse() as Position[]).map((zone) => {
    const here = slots.filter((x) => x.zone === zone);
    const open = Math.max(0, counts[zone] - here.length);
    const chips = [
      ...here.map((x) => pitchChip(s, x.player, zone, selected, locked)),
      ...Array.from({ length: open }, () => emptySlot(zone, locked)),
    ].join('');
    return `<div class="pitch-row" data-zone="${zone}">
      <span class="row-label" ${tipAttr(`${counts[zone]} ${counts[zone] === 1 ? 'plaats' : 'plaatsen'} in ${s.tactics.formation}${(gaps[zone] ?? 0) ? `, waarvan ${gaps[zone]} open` : ''}.`)}>${zone}</span>
      <div class="row-chips">${chips}</div>
    </div>`;
  });

  const filled = slots.length;
  return `<section class="card pitch-card">
    <h2>Opstelling
      <span class="tag ${filled < 11 ? 'bad' : ''}">${filled}/11</span>
      ${hint('Zo staat je ploeg zondag op het veld. Klik iemand aan en kies daarna in je kern wie zijn plaats inneemt. Een ster betekent dat jij hem vastzette; zonder ster koos je trainer hem.')}
    </h2>
    <div class="formation-line">
      <label>Formatie
        <select data-change="formation" ${locked ? 'disabled' : ''} aria-label="Formatie">
          ${(Object.keys(FORMATIONS) as Formation[])
            .map((f) => `<option value="${f}" ${f === s.tactics.formation ? 'selected' : ''}>${f}</option>`)
            .join('')}
        </select>
      </label>
      ${locked ? '' : '<button class="ghost sm" data-action="auto-lineup" ' + tipAttr('Laat alles los: je trainer stelt weer volledig zelf op.') + '>Trainer laten kiezen</button>'}
    </div>
    <div class="pitch">${rows.join('')}</div>
    <p class="pitch-legend tiny muted">
      <span>★ door jou vastgezet</span><span>▰ frisheid</span><span>Ⓒ kapitein</span><span class="chip-wrong-demo">VERD</span><span>speelt buiten zijn positie</span>
    </p>
  </section>`;
}

/* ------------------------------------------------------------------- de kern */

/** Eén speler in de kernlijst. */
function squadRow(s: GameState, p: Player, inXI: boolean, selected: string | null, selZone: Position | null, locked: boolean): string {
  const benched = s.tactics.benched.includes(p.id);
  const blocked = blockLabel(p);
  const swapping = !!selected && !inXI && playable(p);
  const suggested = swapping && selZone === p.position;

  const action = locked
    ? ''
    : swapping
      ? `data-action="squad-swap" data-id="${p.id}"`
      : inXI
        ? `data-action="pitch-pick" data-id="${p.id}"`
        : blocked
          ? ''
          : `data-action="starter" data-id="${p.id}"`;

  const tipText = locked
    ? 'Je trainer stelt op. Neem de taak "Opstelling" terug bij Personeel om zelf te kiezen.'
    : swapping
      ? `Klik om ${p.name} in de ploeg te brengen.${suggested ? '' : ` Let op: hij is ${p.position}, dus hij speelt dan buiten zijn positie.`}`
      : inXI
        ? 'Staat in de basis. Klik om hem te vervangen.'
        : blocked
          ? `Niet beschikbaar: ${p.injuryWeeks ? `geblesseerd, nog ${p.injuryWeeks} weken` : p.suspended ? `geschorst voor ${p.suspended} wedstrijd(en)` : `uitgeleend aan ${p.loan?.club}`}.`
          : 'Klik om hem vast in de basis te zetten.';

  return `<div class="squad-row ${inXI ? 'in-xi' : ''} ${benched ? 'benched' : ''} ${blocked ? 'blocked' : ''} ${suggested ? 'suggested' : ''} ${swapping ? 'swappable' : ''}"
    ${action} ${tipAttr(tipText, p.name)} ${action ? 'role="button" tabindex="0"' : ''}>
    <span class="sr-state">${inXI ? '<span class="dot-in" aria-label="in de basis"></span>' : benched ? '<span class="dot-bench" aria-label="op de bank"></span>' : '<span class="dot-out" aria-label="in de kern"></span>'}</span>
    <span class="sr-name">
      <strong>${esc(p.name)}</strong>${isCorePlayer(s, p) ? ' <span class="core" ' + tipAttr('Kernspeler: hij hoort bij je beste elf of is een groot talent.') + '>★</span>' : ''}${roleMark(s, p.id)}
      <span class="sr-sub">${p.age}j · ${esc(p.trait)}${p.isYouth ? ' · eigen jeugd' : ''}${p.loan?.type === 'in' ? ` · gehuurd van ${esc(p.loan.club)}` : ''}${p.listed ? ' · te koop' : ''}</span>
    </span>
    <span class="sr-rating"><strong>${overall(p)}</strong><span class="muted">/${Math.round(p.potential)}</span></span>
    <span class="sr-trend">${trend(p)}</span>
    <span class="sr-fit">${blocked ? `<span class="tag bad">${blocked}</span>` : fitness(p)}</span>
    ${locked || blocked ? '<span class="sr-btn"></span>' : `<button class="sr-btn bench-btn ${benched ? 'on' : ''}" data-action="bench" data-id="${p.id}"
      ${tipAttr(benched ? `${p.name} staat op de bank. Klik om hem weer beschikbaar te maken.` : `${p.name} deze week niet opstellen. Zijn plaats blijft dan open.`, 'Bank')}>${benched ? '⛔' : '🪑'}</button>`}
  </div>`;
}

/** De hele kern, per linie, met de basiself bovenaan elke linie. */
function squadPanel(s: GameState, selected: string | null): string {
  const locked = !!delegate(s, 'opstelling');
  const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps);
  const inXI = new Set(slots.map((x) => x.player.id));
  const selPlayer = selected && !selected.startsWith('leeg:') ? s.players.find((p) => p.id === selected) : undefined;
  const selZone = selected?.startsWith('leeg:')
    ? (selected.split(':')[1] as Position)
    : (slots.find((x) => x.player.id === selected)?.zone ?? selPlayer?.position ?? null);

  const groups = POSITIONS.map((pos) => {
    const list = s.players
      .filter((p) => p.position === pos)
      .sort((a, b) => Number(inXI.has(b.id)) - Number(inXI.has(a.id)) || Number(playable(b)) - Number(playable(a)) || overall(b) - overall(a));
    if (!list.length) return '';
    const starting = list.filter((p) => inXI.has(p.id)).length;
    const need = FORMATIONS[s.tactics.formation][pos];
    return `<div class="squad-group ${selZone === pos ? 'highlight' : ''}">
      <div class="group-head">
        <span class="cap">${pos}</span>
        <span class="muted small">${starting}/${need} in de basis · ${list.length} in de kern</span>
      </div>
      ${list.map((p) => squadRow(s, p, inXI.has(p.id), selected, selZone, locked)).join('')}
    </div>`;
  }).join('');

  const wages = s.players.reduce((sum, p) => sum + p.wage, 0);
  const value = s.players.reduce((sum, p) => sum + marketValue(p, s.marketIndex), 0);

  return `<section class="card squad-card">
    <h2>Je kern <span class="tag">${s.players.length}</span>
      ${hint('Alle spelers, per linie. Bovenaan elke linie staat wie er zondag begint. Klik iemand om hem vast in de basis te zetten; met het stoeltje hou je hem een week aan de kant.')}
    </h2>
    ${
      selected
        ? `<p class="swap-hint attention-inline small">${
            selPlayer ? `<strong>${esc(selPlayer.name)}</strong> gaat eruit.` : 'Er staat een plaats open.'
          } Klik nu wie er in zijn plaats komt. <button class="link-btn" data-action="pitch-cancel">Annuleren</button></p>`
        : ''
    }
    <div class="squad-list">${groups}</div>
    <p class="tiny muted">Samen ${euro(wages)} loon per week · geschatte waarde ${euro(value)} · marktindex ${(s.marketIndex * 100).toFixed(0)}%</p>
  </section>`;
}

/* -------------------------------------------------------------------- scherm */

/** Het veld en de kern naast elkaar. */
export function lineupBoard(s: GameState, selected: string | null): string {
  return `<div class="lineup-board">
    ${pitch(s, selected)}
    ${squadPanel(s, selected)}
  </div>`;
}
