import type { GameState, SponsorDeal } from '../../engine/types';
import { CAMPAIGN, KIND_INFO, KIND_LABEL, KIND_MAX, NETWORK_EVENING, SPONSOR_TERMS, kindLock, kindRange, satisfactionParts, termTotal } from '../../engine/sponsors';
import { sponsorWeekly } from '../../engine/loans';
import { delegate } from '../../engine/delegation';
import { weeks } from '../../engine/util';
import { bar, esc, euro } from '../format';
import { tip } from '../tooltip';
import { taskPicker } from '../taskpicker';

const KINDS: SponsorDeal['kind'][] = ['hoofdsponsor', 'shirt', 'mouw', 'bus', 'evenement', 'scherm', 'jeugd', 'bal', 'bord'];

export function sponsorsScreen(s: GameState): string {
  const who = delegate(s, 'sponsoring');
  const slots = KINDS.map((k) => {
    const used = s.sponsors.filter((d) => d.kind === k).length;
    const [min, max] = kindRange(s, k);
    const lock = kindLock(s, k);
    return `<div class="tile ${lock ? 'locked' : used >= KIND_MAX[k] ? 'full' : ''}" ${tip(`${KIND_INFO[k]}${lock ? ` ${lock}` : ''}`)}>
      <span class="label">${KIND_LABEL[k]}</span><strong>${used}/${KIND_MAX[k]}</strong>
      <span class="muted small">${lock ? `🔒 ${esc(lock)}` : `markt: ${euro(min)}–${euro(max)}/week`}</span></div>`;
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

  const deals = s.sponsors
    .map((d) => {
      const askedNow = d.extraAskedSeason === s.season;
      return `<tr>
        <td><strong>${esc(d.name)}</strong><br/><span class="muted small">${esc(d.sector)}</span></td>
        <td data-v="${KINDS.indexOf(d.kind as SponsorDeal['kind'])}">${KIND_LABEL[d.kind]}</td>
        <td data-v="${d.weekly}" class="num">${euro(d.weekly)}</td>
        <td data-v="${d.kind === 'stadion' ? 9999 : d.weeksLeft}" class="num">${d.kind === 'stadion' ? '∞' : `${d.weeksLeft}w`}</td>
        <td data-v="${d.satisfaction}" ${tip(satisfactionTip(s))}>${bar(d.satisfaction)} ${Math.round(d.satisfaction)}</td>
        <td class="btns">${
          d.kind === 'stadion'
            ? '<span class="muted small">hoort bij je investeerder</span>'
            : `<button class="sm" data-action="sponsor-extra" data-id="${d.id}" ${askedNow ? 'disabled data-tip="Dit seizoen al gevraagd"' : 'data-tip="Hij denkt erover na: je hoort het antwoord volgende week in het weekrapport. De kans hangt af van zijn tevredenheid."'}>Extra bijdrage vragen</button>
               ${d.weeksLeft <= 26 ? `<button class="sm" data-action="sponsor-renew" data-id="${d.id}">Verlengen</button>` : ''}
               <button class="sm ghost" data-action="sponsor-cancel" data-id="${d.id}">Stopzetten</button>`
        }</td>
      </tr>`;
    })
    .join('');

  const prospects = [...s.prospects]
    .sort((a, b) => b.interest - a.interest)
    .map((p) => {
      const [min, max] = kindRange(s, p.maxKind);
      const status = p.approached ? '<span class="tag">gesprek loopt</span>' : p.cooldown ? `<span class="muted small">opnieuw over ${weeks(p.cooldown)}</span>` : `<button class="sm primary" data-action="approach" data-id="${p.id}">Benaderen</button>`;
      return `<tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.sector)}</td>
        <td data-v="${KINDS.length - KINDS.indexOf(p.maxKind)}">tot ${KIND_LABEL[p.maxKind].toLowerCase()}<br/><span class="muted small">${euro(min)}–${euro(max)}/week</span></td>
        <td data-v="${p.interest}">${bar(p.interest)} ${p.interest}%</td>
        <td>${status}</td>
      </tr>`;
    })
    .join('');

  const netWait = s.eventCooldowns['netwerk'] ?? 0;
  return `${taskPicker(s, ['sponsoring'])}
  <section class="card">
    <h2>Sponsoring: ${euro(sponsorWeekly(s))}/week</h2>
    ${who ? `<p class="attention-inline small">${esc(who.name)} regelt de sponsorwerving: hij benadert om de twee weken het meest geïnteresseerde bedrijf, tekent aanbiedingen en verlengt tevreden sponsors. Je kunt zelf nog altijd ingrijpen.</p>` : ''}
    <div class="tiles four">${slots}</div>
    <p class="muted small">Het bedrag dat een sponsor wil geven, stijgt met je reeks, reputatie, een commercieel medewerker en je achtergrond als ondernemer.</p>
  </section>

  ${offers ? `<section class="card attention"><h2>Voorstellen</h2><ul class="offers">${offers}</ul></section>` : ''}

  <section class="card">
    <h2>Nieuwe sponsors zoeken</h2>
    <p class="muted small">Benader een bedrijf: volgende week hoor je of het een voorstel doet. De kans hangt af van hun interesse. Een netwerkavond verhoogt de interesse van alle bedrijven; een bureau zoekt grotere sponsors.</p>
    <div class="btn-row">
      <button class="sm" data-action="network" ${netWait ? 'disabled' : ''}>Netwerkavond (${euro(NETWORK_EVENING.cost)})${netWait ? ` · nog ${weeks(netWait)}` : ''}</button>
      <button class="sm" data-action="campaign" ${s.sponsorCampaignWeeks ? 'disabled' : ''}>Sponsorbureau inschakelen (${euro(CAMPAIGN.cost)}, ${CAMPAIGN.weeks} weken)${s.sponsorCampaignWeeks ? ` · nog ${weeks(s.sponsorCampaignWeeks)}` : ''}</button>
    </div>
    <div class="table-wrap"><table data-sort-id="prospects">
      <thead><tr><th>Bedrijf</th><th>Sector</th><th>Budget</th><th>Interesse</th><th data-nosort></th></tr></thead>
      <tbody>${prospects || '<tr><td colspan="5" class="muted">Geen contacten. Hou een netwerkavond of schakel een bureau in.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section class="card">
    <h2>Huidige sponsors</h2>
    <p class="muted small">Tevredenheid stijgt met goede resultaten, sfeer en reputatie. Tevreden sponsors stellen zelf een verlenging voor, geven sneller een extra bijdrage en blijven langer.</p>
    <div class="table-wrap"><table data-sort-id="sponsors">
      <thead><tr><th>Sponsor</th><th>Type</th><th class="num">Per week</th><th class="num">Resterend</th><th>Tevredenheid</th><th data-nosort></th></tr></thead>
      <tbody>${deals}</tbody>
    </table></div>
  </section>`;
}
