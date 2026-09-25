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
import { POSITIONS, currentBid, isCorePlayer, isPromising, marketValue, overall } from '../../engine/players';
import { delegate } from '../../engine/delegation';
import { isTransferWindow } from '../../engine/calendar';
import { esc, euro } from '../format';
import { tipAttr } from '../tooltip';
import { isStar, starLabel } from '../../engine/stars';

/**
 * Wat een karakter doet, in één zin. Niet "leider" als los woord waar je zelf maar bij
 * moet bedenken wat je ermee bent: er staat bij wat het hém en jou oplevert.
 */
const TRAITS: Record<string, { icon: string; uitleg: string }> = {
  professioneel: { icon: '🎓', uitleg: 'Traint hard (groeit 1,3× zo snel), pakt weinig kaarten en tekent makkelijker bij.' },
  leider: { icon: '🎖️', uitleg: 'Als kapitein tilt hij de ploeg op: een flinke plus op samenwerking.' },
  lastpak: { icon: '😠', uitleg: 'Pakt 2,5× zoveel kaarten, vraagt meer loon en is een slechte kapitein.' },
  gevoelig: { icon: '💭', uitleg: 'Zijn moraal schommelt sterk, en hij pakt iets sneller een kaart.' },
  'harde werker': { icon: '🛠️', uitleg: 'Traint hard (groeit 1,3× zo snel) en tekent makkelijker bij.' },
  feestbeest: { icon: '🎉', uitleg: 'Raakt sneller geblesseerd, groeit trager (0,7×) en pakt meer kaarten.' },
};

/** Hoeveel seizoenen loopt zijn contract nog? "S2" zei niemand iets. */
export function contractLabel(s: GameState, p: Player): { kort: string; lang: string } {
  const rest = p.contractUntil - s.season;
  if (rest <= 0) return { kort: 'laatste seizoen', lang: 'Zijn contract loopt af op het einde van dit seizoen. Verleng je niet, dan vertrekt hij gratis.' };
  if (rest === 1) return { kort: 'nog 1 seizoen', lang: 'Na dit seizoen loopt zijn contract nog één seizoen. Daarna moet je verlengen of verkoop je hem nu het nog iets opbrengt.' };
  return { kort: `nog ${rest} seizoenen`, lang: `Zijn contract loopt nog ${rest} seizoenen na dit seizoen. Je hebt dus tijd, en hij houdt zijn marktwaarde vast.` };
}

/** In welke toestand staat deze speler? Dezelfde drie als in de tabel. */
function state(s: GameState, p: Player, inLineup: boolean): { kind: 'in' | 'bank' | 'out'; label: string; tip: string } {
  if (p.injuryWeeks > 0) return { kind: 'out', label: `${p.injuryWeeks}w geblesseerd`, tip: `Hij is geblesseerd en valt nog ${p.injuryWeeks} ${p.injuryWeeks === 1 ? 'week' : 'weken'} uit.` };
  if (p.suspended > 0) return { kind: 'out', label: `${p.suspended} geschorst`, tip: `Hij is geschorst voor ${p.suspended} ${p.suspended === 1 ? 'wedstrijd' : 'wedstrijden'}.` };
  if (p.loan?.type === 'uit') {
    const gespeeld = p.loan.matches ?? 0;
    const groei = Math.round((overall(p) - (p.loan.quality ?? overall(p))) * 10) / 10;
    return {
      kind: 'out',
      label: 'uitgeleend',
      tip: `Uitgeleend aan ${p.loan.club} tot het einde van het seizoen. Hij speelde er ${gespeeld} ${
        gespeeld === 1 ? 'wedstrijd' : 'wedstrijden'
      } en werd er ${groei > 0 ? `${groei} punten sterker` : 'nog niet beter'} van. Hij speelt daar elke week en ontwikkelt zich gewoon verder.`,
    };
  }
  if (inLineup) return { kind: 'in', label: 'in de basis', tip: 'Hij staat zondag in de basiself.' };
  if (s.tactics.benched.includes(p.id)) return { kind: 'bank', label: 'op de wisselbank', tip: 'Grote kans dat hij invalt: speelminuten en wedstrijdritme voor zijn groei. Maar hij start nooit vanzelf — haal hem van de bank als je hem in de basis wil.' };
  return { kind: 'bank', label: 'reserve', tip: 'Speelklaar, maar hij haalt de beste elf niet.' };
}

/** De twee tot vier dingen die op dit moment iets zeggen over deze speler. */
function badges(s: GameState, p: Player): string {
  const out: string[] = [];
  const chip = (icon: string, text: string, tone: string, tip: string) =>
    `<span class="pc-badge ${tone}" ${tipAttr(tip)}><span aria-hidden="true">${icon}</span>${esc(text)}</span>`;

  // de sterspeler eerst: dat is het enige kaartje dat over de hele club iets zegt
  if (isStar(s, p)) out.push(chip('⭐', 'sterspeler', 'good', `Hij steekt er duidelijk bovenuit: ${starLabel(s, p)}. Daar komt volk voor naar het veld, het loopt door in je kantine en je clubwinkel, en sponsors betalen er meer voor een plaats.`));

  if (p.form > 1) out.push(chip('🔥', `vorm +${Math.round(p.form)}`, 'good', `Hij is in vorm: +${Math.round(p.form)} bovenop zijn kwaliteit zolang dat duurt.`));
  else if (p.form < -1) out.push(chip('🧊', `vorm ${Math.round(p.form)}`, 'bad', `Hij zit in een dip: ${Math.round(p.form)} op zijn kwaliteit.`));

  if (p.fatigue > 35) out.push(chip('🥵', `moe ${Math.round(p.fatigue)}`, 'bad', `Vermoeidheid ${Math.round(p.fatigue)}/100. Boven de 50 loopt hij meer kans op een blessure en speelt hij onder zijn niveau.`));
  if (p.morale < 40) out.push(chip('😒', `moraal ${Math.round(p.morale)}`, 'bad', `Lage moraal (${Math.round(p.morale)}/100) drukt zijn prestaties en maakt een contractverlenging moeilijker.`));
  if (p.contractUntil <= s.season) out.push(chip('📄', 'contract loopt af', 'bad', `Zijn contract loopt af na dit seizoen. Verleng je niet, dan vertrekt hij gratis.`));
  if (p.trend > 0.2) out.push(chip('📈', `+${p.trend.toFixed(1)}`, 'good', `Hij ging ${p.trend.toFixed(1)} vooruit bij de laatste evolutie (om de vier weken).`));
  else if (p.trend < -0.2) out.push(chip('📉', `${p.trend.toFixed(1)}`, 'bad', `Hij ging ${Math.abs(p.trend).toFixed(1)} achteruit bij de laatste evolutie.`));
  if (p.listed) out.push(chip('🏷️', 'te koop', 'neutral', `Je zette hem te koop voor ${euro(p.askingPrice)}.`));
  if (p.loan?.type === 'in') out.push(chip('↙', `van ${p.loan.club}`, 'neutral', `Gehuurd van ${p.loan.club} tot het einde van het seizoen.`));

  return out.slice(0, 4).join('');
}

/**
 * Wie hij ís, tegenover wat er met hem aan de hand is.
 *
 * Vroeger stond dat door elkaar op één regel: "30 jaar · leider · kernspeler". Dat leest
 * als een zin waar je zelf de komma's in moet zetten. Het zijn drie losse feiten, dus
 * staan ze nu als drie losse kaartjes, elk met een icoontje en een uitleg eronder.
 */
function tags(s: GameState, p: Player): string {
  const tag = (icon: string, text: string, tip: string, extra = '') =>
    `<span class="pc-tag ${extra}" ${tipAttr(tip)}><span aria-hidden="true">${icon}</span>${esc(text)}</span>`;

  const leeftijd =
    p.age <= 21
      ? 'Jong: hij groeit nog het snelst naar zijn plafond toe.'
      : p.age <= 28
        ? 'In zijn beste jaren: hij zit dicht bij zijn niveau en houdt dat vast.'
        : p.age <= 31
          ? 'Ervaren: hij groeit niet meer, maar zakt nog niet.'
          : 'Op leeftijd: hij gaat elk seizoen wat achteruit en raakt sneller geblesseerd.';

  const t = TRAITS[p.trait];
  return [
    tag('🎂', `${p.age} jaar`, leeftijd),
    t ? tag(t.icon, p.trait, t.uitleg) : tag('🙂', p.trait, 'Zijn karakter.'),
    isCorePlayer(s, p)
      ? tag('⭐', 'kernspeler', 'Eén van je beste spelers. Verkoop je hem, dan voelt je publiek dat — en je ploeg ook.', 'core')
      : '',
    p.isYouth ? tag('🌱', 'eigen jeugd', 'Hij kwam uit je eigen jeugdwerking. Dat telt mee voor je clubscore.', 'youth') : '',
    isPromising(p)
      ? tag('💎', 'beloftevol', `Jong en met veel ruimte om te groeien: ${p.age} jaar, kwaliteit ${overall(p)} van een mogelijke ${Math.round(p.potential)}.`, 'promising')
      : '',
  ].join('');
}

/** Eén spelerskaart. */
function card(s: GameState, p: Player, inLineup: boolean, pinned: boolean, window: boolean, coach: boolean): string {
  const st = state(s, p, inLineup);
  const groeit = p.potential - overall(p);

  const con = contractLabel(s, p);
  const aflopend = p.contractUntil <= s.season;

  return `<article class="pcard ${st.kind}">
    <header class="pc-top">
      <span class="pstate ${st.kind}" ${tipAttr(st.tip, p.name)}></span>
      <span class="pc-pos" ${tipAttr(`Zijn positie: ${p.position}.`)}>${p.position}</span>
      <span class="pc-name">
        <strong>${esc(p.name)}</strong>
        <span class="pc-state-label">${esc(st.label)}</span>
      </span>
      <span class="pc-rating" ${tipAttr(`Kwaliteit ${overall(p)} van een mogelijke ${Math.round(p.potential)}. ${groeit > 8 ? 'Daar zit nog veel in.' : groeit > 3 ? 'Er zit nog wat groei in.' : 'Hij zit dicht bij zijn plafond.'}`)}>
        <strong>${overall(p)}</strong><span class="of">/${Math.round(p.potential)}</span>
      </span>
    </header>

    <div class="pc-tags">${tags(s, p)}</div>

    ${badges(s, p) ? `<div class="pc-badges">${badges(s, p)}</div>` : ''}

    <div class="pc-facts">
      <span class="pc-fact" ${tipAttr(`Je betaalt hem ${euro(p.wage)} per week, 52 weken per jaar. Zijn marktwaarde is ${euro(marketValue(p, s.marketIndex))}.`, 'Loon')}>
        <span class="cap">Loon</span><strong>${euro(p.wage)}</strong><span class="unit">/week</span>
      </span>
      <span class="pc-fact ${aflopend ? 'warn' : ''}" ${tipAttr(con.lang, 'Contract')}>
        <span class="cap">Contract</span><strong>${con.kort}</strong>
      </span>
    </div>

    <footer class="pc-acts">
      <div class="pc-row">
        ${
          coach || st.kind === 'out'
            ? ''
            : `<button class="pc-btn star ${pinned ? 'on' : ''}" data-action="starter" data-id="${p.id}" ${tipAttr(
                pinned
                  ? 'Hij staat vast in je basiself. Klik om hem weer los te laten: je trainer kiest dan zelf.'
                  : 'Zet hem vast in je basiself, zodat je trainer hem altijd opstelt.',
                'Vast in de basis',
              )}><span aria-hidden="true">${pinned ? '★' : inLineup ? '✓' : '☆'}</span>${pinned ? 'Vast' : inLineup ? 'Speelt' : 'Vastzetten'}</button>`
        }
        <button class="pc-btn" data-action="goto-contracts" data-id="${p.id}" ${tipAttr('Naar Ploeg › Contracten, met hem al geselecteerd. Daar onderhandel je over loon en looptijd.', 'Contract bespreken')}>
          <span aria-hidden="true">📄</span>Contract
        </button>
      </div>
      ${
        window
          ? `<button class="pc-btn sell" data-action="sell" data-id="${p.id}" data-confirm="${esc(p.name)} verkopen voor ${euro(currentBid(p, s.marketIndex))}?" ${tipAttr(
              `Verkoop hem nu voor ${euro(currentBid(p, s.marketIndex))}. Dat bod verandert elke week en geldt alleen tijdens de transferperiode.`,
              'Verkopen',
            )}><span aria-hidden="true">💶</span>${euro(currentBid(p, s.marketIndex))}</button>`
          : ''
      }
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
