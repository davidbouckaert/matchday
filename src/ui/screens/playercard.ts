// De kaartweergave van je kern.
//
// De tabel heeft zeventien kolommen. Dat is precies wat je wil als je wil sorteren op
// loon of contract, of als je twee spelers op één cijfer wil vergelijken. Het is precies
// niet wat je wil als je gewoon door je kern wandelt: dan lees je een raster van
// getallen waarin niets eruit springt.
//
// Deze weergave toont dezelfde spelers als kaartjes: de naam groot, één stip voor zijn
// toestand, zijn kwaliteit als cijfer, en de drie of vier dingen die er nu toe doen als
// kaartje — vorm, vermoeidheid, contract dat afloopt. De rest staat in de tooltip.
//
// Ze vervangt de tabel niet; je schakelt ertussen. Wat je nodig hebt hangt af van wat je
// aan het doen bent, en dat verschilt van week tot week.

import type { GameState, Player } from '../../engine/types';
import { POSITIONS, currentBid, isCorePlayer, marketValue, overall } from '../../engine/players';
import { delegate } from '../../engine/delegation';
import { isTransferWindow } from '../../engine/calendar';
import { esc, euro } from '../format';
import { tipAttr } from '../tooltip';

/** In welke toestand staat deze speler? Dezelfde drie als in de tabel. */
function state(s: GameState, p: Player, inLineup: boolean): { kind: 'in' | 'bank' | 'out'; label: string; tip: string } {
  if (p.injuryWeeks > 0) return { kind: 'out', label: `${p.injuryWeeks}w geblesseerd`, tip: `Hij is geblesseerd en valt nog ${p.injuryWeeks} ${p.injuryWeeks === 1 ? 'week' : 'weken'} uit.` };
  if (p.suspended > 0) return { kind: 'out', label: `${p.suspended} geschorst`, tip: `Hij is geschorst voor ${p.suspended} ${p.suspended === 1 ? 'wedstrijd' : 'wedstrijden'}.` };
  if (p.loan?.type === 'uit') return { kind: 'out', label: 'uitgeleend', tip: `Uitgeleend aan ${p.loan.club} tot het einde van het seizoen.` };
  if (inLineup) return { kind: 'in', label: 'in de basis', tip: 'Hij staat zondag in de basiself.' };
  if (s.tactics.benched.includes(p.id)) return { kind: 'bank', label: 'op de bank', tip: 'Jij hield hem deze week uit de ploeg.' };
  return { kind: 'bank', label: 'reserve', tip: 'Speelklaar, maar hij haalt de beste elf niet.' };
}

/** De twee tot vier dingen die op dit moment iets zeggen over deze speler. */
function badges(s: GameState, p: Player): string {
  const out: string[] = [];
  const chip = (icon: string, text: string, tone: string, tip: string) =>
    `<span class="pc-badge ${tone}" ${tipAttr(tip)}><span aria-hidden="true">${icon}</span>${esc(text)}</span>`;

  if (p.form > 1) out.push(chip('🔥', `vorm +${Math.round(p.form)}`, 'good', `Hij is in vorm: +${Math.round(p.form)} bovenop zijn kwaliteit zolang dat duurt.`));
  else if (p.form < -1) out.push(chip('🧊', `vorm ${Math.round(p.form)}`, 'bad', `Hij zit in een dip: ${Math.round(p.form)} op zijn kwaliteit.`));

  if (p.fatigue > 35) out.push(chip('🥵', `moe ${Math.round(p.fatigue)}`, 'bad', `Vermoeidheid ${Math.round(p.fatigue)}/100. Boven de 50 loopt hij meer kans op een blessure en speelt hij onder zijn niveau.`));
  if (p.morale < 40) out.push(chip('😒', `moraal ${Math.round(p.morale)}`, 'bad', `Lage moraal (${Math.round(p.morale)}/100) drukt zijn prestaties en maakt een contractverlenging moeilijker.`));
  if (p.contractUntil <= s.season) out.push(chip('📄', 'contract loopt af', 'bad', `Zijn contract loopt af na dit seizoen. Verleng je niet, dan vertrekt hij gratis.`));
  if (p.trend > 0.2) out.push(chip('📈', `+${p.trend.toFixed(1)}`, 'good', `Hij ging ${p.trend.toFixed(1)} vooruit bij de laatste evolutie (om de vier weken).`));
  else if (p.trend < -0.2) out.push(chip('📉', `${p.trend.toFixed(1)}`, 'bad', `Hij ging ${Math.abs(p.trend).toFixed(1)} achteruit bij de laatste evolutie.`));
  if (p.listed) out.push(chip('🏷️', 'te koop', 'neutral', `Je zette hem te koop voor ${euro(p.askingPrice)}.`));
  if (p.loan?.type === 'in') out.push(chip('↙', `van ${p.loan.club}`, 'neutral', `Gehuurd van ${p.loan.club} tot het einde van het seizoen.`));
  if (p.isYouth) out.push(chip('🌱', 'eigen jeugd', 'good', 'Hij kwam uit je eigen jeugdwerking. Dat telt mee voor je clubscore.'));

  return out.slice(0, 4).join('');
}

/** Eén spelerskaart. */
function card(s: GameState, p: Player, inLineup: boolean, pinned: boolean, window: boolean, coach: boolean): string {
  const st = state(s, p, inLineup);
  const groeit = p.potential - overall(p);

  return `<article class="pcard ${st.kind}">
    <header class="pc-top">
      <span class="pstate ${st.kind}" ${tipAttr(st.tip, p.name)}></span>
      <span class="pc-pos" ${tipAttr(`Zijn positie: ${p.position}.`)}>${p.position}</span>
      <span class="pc-name">
        <strong>${esc(p.name)}</strong>
        <span class="muted tiny">${p.age} jaar · ${esc(p.trait)}${isCorePlayer(s, p) ? ' · kernspeler' : ''}</span>
      </span>
      <span class="pc-rating" ${tipAttr(`Kwaliteit ${overall(p)} van een mogelijke ${Math.round(p.potential)}. ${groeit > 8 ? 'Daar zit nog veel in.' : groeit > 3 ? 'Er zit nog wat groei in.' : 'Hij zit dicht bij zijn plafond.'}`)}>
        <strong>${overall(p)}</strong><span class="of">/${Math.round(p.potential)}</span>
      </span>
    </header>

    <div class="pc-badges">${badges(s, p) || `<span class="pc-badge neutral"><span aria-hidden="true">✓</span>${esc(st.label)}</span>`}</div>

    <footer class="pc-foot">
      <span class="pc-money" ${tipAttr(`Loon ${euro(p.wage)} per week. Marktwaarde ${euro(marketValue(p, s.marketIndex))}. Contract tot einde seizoen ${p.contractUntil}.`)}>
        ${euro(p.wage)}<span class="muted tiny">/week · S${p.contractUntil}</span>
      </span>
      <span class="pc-acts">
        ${
          coach || st.kind === 'out'
            ? ''
            : `<button class="star ${pinned ? 'on' : ''}" data-action="starter" data-id="${p.id}" ${tipAttr(
                pinned ? 'Niet meer vastzetten: je trainer kiest weer.' : 'Vast in de basis zetten.',
              )}>${pinned ? '★' : inLineup ? '✓' : '☆'}</button>`
        }
        <button class="sm" data-action="goto-contracts" data-id="${p.id}" ${tipAttr('Onderhandelen over een nieuw contract.')}>Contract</button>
        ${window ? `<button class="sm" data-action="sell" data-id="${p.id}" ${tipAttr('Verkoop tegen het bod van deze week.')}>${euro(currentBid(p, s.marketIndex))}</button>` : ''}
      </span>
    </footer>
  </article>`;
}

/**
 * De hele kern als kaarten, gegroepeerd per linie zodat je ziet waar je dun zit.
 */
export function playerCards(s: GameState, inLineup: Set<string>): string {
  const window = isTransferWindow(s.week);
  const coach = !!delegate(s, 'opstelling');

  return POSITIONS.map((pos) => {
    const list = s.players.filter((p) => p.position === pos).sort((a, b) => overall(b) - overall(a));
    if (!list.length) return '';
    const inBasis = list.filter((p) => inLineup.has(p.id)).length;
    return `<section class="pc-line">
      <h3 class="pc-line-head">${pos} <span class="muted small">${list.length} in de kern · ${inBasis} in de basis</span></h3>
      <div class="pc-grid">
        ${list.map((p) => card(s, p, inLineup.has(p.id), s.tactics.manualXI.includes(p.id), window, coach)).join('')}
      </div>
    </section>`;
  }).join('');
}
