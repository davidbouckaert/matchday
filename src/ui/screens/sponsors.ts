import type { GameState, SponsorDeal } from '../../engine/types';
import { CAMPAIGN, KIND_INFO, KIND_LABEL, KIND_MAX, KIND_SHORT, NETWORK_EVENING, SPONSOR_TERMS, askPrice, askVerdict, bestAskRatio, fairPrice, kindLock, prospectChance, satisfactionParts, termTotal } from '../../engine/sponsors';
import { sponsorWeekly } from '../../engine/loans';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import { bar, esc, euro } from '../format';
import { hint, tip, tipAttr } from '../tooltip';
import { taskPicker } from '../taskpicker';
import { numField } from '../numfield';

const KINDS: SponsorDeal['kind'][] = ['hoofdsponsor', 'shirt', 'mouw', 'bus', 'evenement', 'scherm', 'jeugd', 'bal', 'bord'];

export function sponsorsScreen(s: GameState, filter: SponsorDeal['kind'] | null = null): string {
  const who = delegate(s, 'sponsoring');
  /** Hoeveel boven het gangbare bedrag jouw club aankan. Eén keer berekend, voor de hele kaart. */
  const ruimte = bestAskRatio(s);
  /**
   * Je prijskaart: per soort plaats wat jij ervoor vraagt.
   *
   * Vroeger noemde het bedrijf een bedrag en zei jij ja of nee. Nu hang jij de prijs aan de
   * muur en beslissen zij. Bij elk bedrag staat meteen wat de bedrijven in de streek ervan
   * vinden, want anders zet je een getal in het wilde weg en weet je pas weken later dat
   * er niemand meer belt.
   */
  const slots = KINDS.map((k) => {
    const used = s.sponsors.filter((d) => d.kind === k).length;
    const lock = kindLock(s, k);
    const fair = fairPrice(s, k);
    const ask = askPrice(s, k);
    const oordeel = askVerdict(s, k);
    const eigen = s.sponsorAsk?.[k] !== undefined;
    const vol = used >= KIND_MAX[k];

    // let op: niet de class 'full' gebruiken — dat is de opmaakhulp die een element over
    // alle kolommen laat lopen, en dan werd een bezette plaats een balk over de hele breedte
    //
    // De bezetting staat als badge in de kop. Ze stond als voetnootje ónder het
    // invoerveld (11 pixels, vaag grijs) en werd daar door niemand gezien — gemeld als
    // "het aantal plaatsen per soort zie ik niet meer staan", terwijl het er stond.
    // Vier vaste zones per tegel — kop, invoerveld, oordeel, notitie — die er ook staan
    // als ze leeg zijn. Anders verspringt de hoogte per tegel met wat er toevallig in
    // staat ("te goedkoop" + "terug naar" tegenover alleen "volgt de markt") en oogt de
    // rij scheef en slordig.
    return `<div class="tile slot ${lock ? 'locked' : vol ? 'filled' : ''} ${filter === k ? 'filter-on' : ''}">
      <span class="slot-head">
        <button class="label filter-pick ${filter === k ? 'on' : ''} has-tip" data-action="sponsor-filter" data-id="${k}" ${tipAttr(
          `${KIND_LABEL[k]}. ${KIND_INFO[k]}${lock ? ` ${lock}.` : ''} Klik om je sponsors en contacten op deze plaats te filteren${filter === k ? ' — nog eens klikken haalt de filter weg' : ''}.`,
        )}>${KIND_SHORT[k]}${filter === k ? ' ●' : ''}</button>
        <span class="slot-badge ${lock ? 'leeg' : vol ? 'vol' : 'vrij'} has-tip" ${tipAttr(
          lock
            ? `Deze plaats bestaat bij je club nog niet. ${lock}.`
            : `${used} van de ${KIND_MAX[k]} ${KIND_MAX[k] === 1 ? 'plaats' : 'plaatsen'} voor ${KIND_LABEL[k].toLowerCase()} ${used === 1 ? 'is' : 'zijn'} bezet${vol ? '. Zet een contract stop om plaats te maken' : ''}.`,
        )}>${lock ? 'op slot' : vol ? 'vol' : `nog ${KIND_MAX[k] - used} vrij`}</span>
      </span>
      <span class="slot-body">${
        lock
          ? `<span class="slot-lock">🔒 ${esc(lock)}</span>`
          : numField({
              value: ask,
              min: 0,
              max: Math.max(50, fair * 5),
              step: 5,
              prefix: '€',
              change: 'sponsor-ask',
              rowId: k,
              label: `Vraagprijs ${KIND_LABEL[k]} per week`,
            })
      }</span>
      <span class="slot-line">${
        !lock && eigen
          ? `<span class="slot-verdict ${oordeel.toon} has-tip" ${tipAttr(
              `Gangbaar voor zo'n plaats is bij jouw club ${euro(fair)} per week. Jij vraagt ${euro(ask)}, en dat vinden de bedrijven in de streek ${oordeel.woord}. Hoe hoger je gaat, hoe minder vaak een bedrijf ja zegt, maar wie tekent betaalt wel jouw prijs.`,
            )}>${oordeel.woord}</span>`
          : ''
      }</span>
      <span class="slot-line">${
        lock
          ? ''
          : eigen
            ? `<span class="slot-note"><button class="link-btn" data-action="sponsor-ask-reset" data-id="${k}">terug naar ${euro(fair)}</button></span>`
            : `<span class="slot-note has-tip" ${tipAttr(
                `Dit is wat bedrijven in de streek normaal betalen voor ${KIND_LABEL[k].toLowerCase()} bij een club als de jouwe. Zet er zelf een ander bedrag in en je ziet meteen wat ze ervan vinden.`,
              )}>volgt de markt</span>`
      }</span>
    </div>`;
  }).join('');

  const offers = s.sponsorOffers
    .map((o) => {
      const old = o.renewalOf ? s.sponsors.find((d) => d.id === o.renewalOf) : undefined;
      if (o.renewalOf) {
        return `<li><strong>${esc(o.name)}</strong> · verlenging · <strong>${euro(o.weekly)}/week</strong>${old ? ` (nu ${euro(old.weekly)})` : ''} · ${o.weeksLeft} weken
          <span class="muted small">(vervalt over ${weeks(o.expiresInWeeks)})</span>
          <span class="btns"><button class="sm primary" data-action="accept-sponsor" data-id="${o.id}">Tekenen</button><button class="sm" data-action="decline-sponsor" data-id="${o.id}">Weigeren</button></span></li>`;
      }
      // een nieuw contract leg je zelf vast: hoe langer, hoe meer per week — maar je zit eraan vast
      return `<li class="offer"><strong>${esc(o.name)}</strong> · ${KIND_LABEL[o.kind]} · basisbedrag <strong>${euro(o.weekly)}/week</strong>
        <span class="muted small">(vervalt over ${weeks(o.expiresInWeeks)})</span>
        <div class="terms">${SPONSOR_TERMS.map(
          (t) => `<button class="term ${t.seasons === 1 ? 'primary' : ''}" data-action="accept-sponsor" data-id="${o.id}:${t.seasons}" data-tip="${esc(t.detail)}">
            <strong>${esc(t.label)}</strong>
            <span>${euro(Math.round(o.weekly * t.factor))}/week</span>
            <span class="muted small">samen ${euro(termTotal(o.weekly, t.seasons))}</span>
          </button>`,
        ).join('')}
        <button class="term decline" data-action="decline-sponsor" data-id="${o.id}">Weigeren</button></div></li>`;
    })
    .join('');

  const satisfactionTip = (g: GameState) =>
    `Tevredenheid groeit traag naar een doelwaarde. Nu: ${satisfactionParts(g)
      .map((p) => `${p.label} ${p.value >= 0 ? '+' : ''}${p.value} (${p.detail})`)
      .join(', ')}. Onder 40 wil niemand verlengen; boven 55 krijg je vanzelf een verlengingsvoorstel. Een extra bijdrage vragen kost tevredenheid.`;

  const gefilterdeDeals = filter ? s.sponsors.filter((d) => d.kind === filter) : s.sponsors;
  const deals = gefilterdeDeals
    .map((d) => {
      const askedNow = d.extraAskedSeason === s.season;
      return `<tr>
        <td><strong>${esc(d.name)}</strong><br/><span class="muted small">${esc(d.sector)} · ${KIND_LABEL[d.kind]}</span></td>
        <td data-v="${d.weekly}" class="num">${euro(d.weekly)}</td>
        <td data-v="${d.kind === 'stadion' ? 9999 : d.weeksLeft}" class="num">${d.kind === 'stadion' ? '∞' : `${d.weeksLeft}w`}</td>
        <td data-v="${d.satisfaction}" ${tip(satisfactionTip(s))}>${bar(d.satisfaction)} ${Math.round(d.satisfaction)}</td>
        <td class="btns stack-sm">${
          d.kind === 'stadion'
            ? '<span class="muted small">hoort bij je investeerder</span>'
            : `<button class="sm" data-action="sponsor-extra" data-id="${d.id}" ${askedNow ? 'disabled data-tip="Dit seizoen al gevraagd"' : 'data-tip="Hij denkt erover na: je hoort het antwoord volgende week in het weekrapport. De kans hangt af van zijn tevredenheid."'}>Extra bijdrage vragen</button>
               ${d.weeksLeft <= 26 ? `<button class="sm" data-action="sponsor-renew" data-id="${d.id}">Verlengen</button>` : ''}
               <button class="sm ghost" data-action="sponsor-cancel" data-id="${d.id}">Stopzetten</button>`
        }</td>
      </tr>`;
    })
    .join('');

  const gefilterdeProspects = [...s.prospects]
    .sort((a, b) => b.interest - a.interest)
    .filter((p) => !filter || prospectChance(s, p).kind === filter);
  const prospects = gefilterdeProspects
    .map((p) => {
      const { kans, kind } = prospectChance(s, p);
      const status = p.approached ? '<span class="tag">gesprek loopt</span>' : p.cooldown ? `<span class="muted small">opnieuw over ${weeks(p.cooldown)}</span>` : `<button class="sm primary" data-action="approach" data-id="${p.id}">Benaderen</button>`;
      return `<tr>
        <td><strong>${esc(p.name)}</strong> <span class="muted small">${esc(p.sector)}</span><br/><span class="muted small">tot ${KIND_LABEL[p.maxKind].toLowerCase()} · ${
          // de plaats die hij écht zou krijgen: zijn beste plaats is misschien al bezet, en
          // dan zakt hij een trapje — met de prijs die daarbij hoort
          kind ? `vrije plaats: ${KIND_SHORT[kind].toLowerCase()} aan ${euro(askPrice(s, kind))}/week` : 'geen vrije plaats in hun klasse'
        }</span></td>
        <td data-v="${p.interest}">${bar(p.interest)} ${p.interest}%</td>
        <td data-v="${Math.round(kans * 100)}" ${tip(
          kind
            ? `Als je ${p.name} deze week benadert, zegt hij met ongeveer ${Math.round(kans * 100)}% kans ja op ${KIND_SHORT[kind].toLowerCase()} aan ${euro(askPrice(s, kind))} per week. Dat hangt af van zijn interesse, je commercieel medewerker en hoe scherp je prijs staat.`
            : 'Je hebt geen vrije plaats in hun budgetklasse, dus benaderen heeft nu geen zin.',
        )}>${kind ? `${Math.round(kans * 100)}%` : '–'}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join('');

  const netWait = s.eventCooldowns['netwerk'] ?? 0;

  const filterChip = filter
    ? `<button class="filter-chip" data-action="sponsor-filter" data-id="${filter}" aria-label="Filter op ${KIND_LABEL[filter]} weghalen">${KIND_SHORT[filter]} ✕</button>`
    : '';

  // Bovenaan wat je doet, eronder wat je hebt.
  //
  // Dit scherm stond in de dashboard-indeling: een brede kolom met een smalle kolom
  // ernaast. Op een breed scherm viel die brede kolom zelf nog eens in tweeën, en dan
  // werden de twee tabellen — zestien sponsors met vijf kolommen, dertien contacten met
  // vier — in een vak van tweehonderdvijftig pixels geperst, waar elke cel over drie
  // regels brak. Eén kaart belandde alleen onderaan met tweederde wit ernaast.
  //
  // Nu staan de twee dingen waar je iets mee doet bovenaan naast elkaar — je plaatsen en
  // wat er op tafel ligt — en krijgen de twee tabellen elk de volle breedte.
  //
  // Sinds je je prijzen zelf zet, draagt elke plaats een invoerveld. In een halve kolom
  // pasten er drie naast elkaar, dus stond de prijskaart drie rijen hoog terwijl de andere
  // helft van het scherm leeg bleef. Ze krijgt nu de volle breedte — negen plaatsen op één
  // rij — en de twee korte kaarten staan eronder naast elkaar.
  return `${taskPicker(s, ['sponsoring'])}
  <section class="card">
    <h2>Sponsoring: ${euro(sponsorWeekly(s))}/week</h2>
    ${who ? `<p class="attention-inline small">${esc(who.name)} regelt de sponsorwerving: hij benadert om de twee weken het meest geïnteresseerde bedrijf, tekent aanbiedingen en verlengt tevreden sponsors. Je kunt zelf nog altijd ingrijpen.</p>` : ''}
    <h3>Je prijskaart ${hint(
      'Jij zet hier wat elke plaats per week kost. Vraag je minder dan gangbaar, dan tekenen meer bedrijven; vraag je meer, dan minder, maar elk contract brengt meer op. Het gangbare bedrag groeit mee met je reeks, reputatie, medewerker en ondernemersachtergrond.',
    )}</h3>
    <p class="attention-inline small" ${tip(
      `Hoe graag bedrijven bij je club willen horen, hangt af van je reputatie (${Math.round(s.community.reputation)}/100), de sfeer rond de club (${Math.round(s.community.fanMood)}/100), je populariteit, je reeks en je commercieel medewerker. Hoe liever ze erbij horen, hoe minder ze afhaken als je meer vraagt.`,
    )}>${
      ruimte > 1.12
        ? `Bedrijven willen graag bij je club horen: tot ongeveer ${Math.round((ruimte - 1) * 100)}% boven het gangbare bedrag haken er te weinig af om je geld te kosten.`
        : 'Je club heeft in de streek nog weinig naam. Meer vragen dan het gangbare bedrag kost je nu meer contracten dan het opbrengt.'
    }</p>
    <div class="tiles slots">${slots}</div>
  </section>

  ${
    offers
      ? `<section class="card attention"><h2>Op tafel <span class="tag bad">${s.sponsorOffers.length}</span></h2><ul class="offers">${offers}</ul></section>`
      : ''
  }

  <div class="cols-2">
    <div class="col">
      <section class="card">
        <h2>Huidige sponsors <span class="tag">${gefilterdeDeals.length}${filter ? ` van ${s.sponsors.length}` : ''}</span> ${filterChip}</h2>
        <p class="muted small">Tevredenheid stijgt met goede resultaten, sfeer en reputatie. Tevreden sponsors stellen zelf een verlenging voor, geven sneller een extra bijdrage en blijven langer.</p>
        <div class="table-wrap"><table class="compact" data-sort-id="sponsors">
          <thead><tr><th>Sponsor</th><th class="num">Per week</th><th class="num">Resterend</th><th>Tevredenheid</th><th data-nosort></th></tr></thead>
          <tbody>${deals || `<tr><td colspan="5" class="muted">${filter ? `Geen sponsors op ${KIND_LABEL[filter].toLowerCase()}. Haal de filter weg met het kruisje hierboven.` : 'Nog geen sponsors.'}</td></tr>`}</tbody>
        </table></div>
      </section>
    </div>
    <div class="col">
      ${offers ? '' : '<section class="card"><h2>Op tafel</h2><p class="muted small">Geen voorstellen op dit moment. Benader een contact of hou een netwerkavond.</p></section>'}
      <section class="card">
        <h2>Contacten <span class="tag">${gefilterdeProspects.length}${filter ? ` van ${s.prospects.length}` : ''}</span> ${filterChip}</h2>
        <p class="muted small">Benader een bedrijf: volgende week hoor je of het een voorstel doet. De kans hangt af van hun interesse.</p>
        <div class="table-wrap"><table class="compact" data-sort-id="prospects">
          <thead><tr><th>Bedrijf</th><th>Interesse</th><th class="num" data-tip="Hoe vaak dit bedrijf ja zegt op de prijs die jij vraagt. Vraag je minder, dan stijgt de kans; vraag je meer, dan daalt ze.">Zegt ja</th><th data-nosort></th></tr></thead>
          <tbody>${prospects || `<tr><td colspan="4" class="muted">${filter ? `Geen contacten die op ${KIND_LABEL[filter].toLowerCase()} zouden tekenen. Haal de filter weg met het kruisje hierboven.` : 'Geen contacten. Hou een netwerkavond of schakel een bureau in.'}</td></tr>`}</tbody>
        </table></div>
      </section>
      <section class="card">
        <h2>Nieuwe namen vinden</h2>
        <p class="muted small">Een netwerkavond verhoogt de interesse van alle bedrijven; een bureau zoekt grotere sponsors.</p>
        <div class="stack-btns">
          <button data-action="network" ${netWait ? 'disabled' : ''}>Netwerkavond (${euro(NETWORK_EVENING.cost)})${netWait ? ` · nog ${weeks(netWait)}` : ''}</button>
          <button data-action="campaign" ${s.sponsorCampaignWeeks ? 'disabled' : ''}>Sponsorbureau (${euro(CAMPAIGN.cost)}, ${CAMPAIGN.weeks} weken)${s.sponsorCampaignWeeks ? ` · nog ${weeks(s.sponsorCampaignWeeks)}` : ''}</button>
        </div>
      </section>
    </div>
  </div>`;
}
