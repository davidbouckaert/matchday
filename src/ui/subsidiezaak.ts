import type { GameState, SubsidieZaak } from '../engine/types';
import { subsidieBedrag, subsidieKans } from '../engine/finance';
import { esc, euro } from './format';

export function subsidieResult(z: SubsidieZaak): string {
  if (z.status === 'toegekend' && z.antwoord) return `Toegekend · ${euro(z.antwoord.bedrag)} ontvangen`;
  if (z.status === 'afgewezen') return 'Niet toegekend';
  return 'Uitkomst niet als dossier bewaard';
}

export function subsidieRows(s: GameState, pending: boolean): string {
  const zaken = pending ? s.subsidieZaken.filter((z) => s.requests.some((r) => r.id === z.id))
    : s.subsidieZaken.filter((z) => z.antwoord).slice(-3).reverse();
  return zaken.map((z) => {
    const r = s.requests.find((r) => r.id === z.id);
    return `<div class="case-row"><div><strong>Gemeentesubsidie · seizoen ${z.seizoen}</strong>
      <p>${r ? `Bij de gemeente · antwoord na nog ${r.weeksLeft} ${r.weeksLeft === 1 ? 'gespeelde week' : 'gespeelde weken'}` : esc(subsidieResult(z))}</p>
      ${r ? '<span class="muted small">Je hoeft nu niets te doen.</span>' : `<span class="muted small">Antwoord in seizoen ${z.antwoord!.seizoen}, week ${z.antwoord!.week}</span>`}</div>
      <button class="sm" data-action="subsidie-open" data-id="${esc(z.id)}">Bekijk dossier</button></div>`;
  }).join('');
}

export function subsidieOutcome(z: SubsidieZaak): string {
  return `<div class="case-outcome ${z.status === 'toegekend' ? 'granted' : ''}">
    <strong>${z.status === 'toegekend' ? '✓ ' : ''}${esc(subsidieResult(z))}</strong>
    ${z.antwoord ? `<p>Werkelijk resultaat bij antwoord · seizoen ${z.antwoord.seizoen}, week ${z.antwoord.week}.</p>` : ''}
    ${z.status === 'afgewezen' ? `<p>Dossierzwakte in het antwoord: ${esc(z.antwoord?.dossierzwakte ?? 'niet bewaard')}. Ook met een sterk dossier is toekenning niet zeker.</p><p>Volgend seizoen kun je opnieuw indienen.</p>` : ''}
  </div>`;
}

/** Eén kaart, herkenbaar vóór de aanvraag en na het antwoord; nooit historie uit proza raden. */
export function subsidieCard(s: GameState, selected?: string, backLabel?: string): string {
  const z = s.subsidieZaken.find((z) => z.id === selected)
    ?? [...s.subsidieZaken].reverse().find((z) => z.seizoen === s.season || s.requests.some((r) => r.id === z.id));
  const r = z && s.requests.find((r) => r.id === z.id);
  const { kans, zwakstePlek } = subsidieKans(s);
  const canApply = s.subsidieSeizoen !== s.season && !s.requests.some((r) => r.kind === 'subsidie');
  const current = !z || z.seizoen === s.season || !!r;
  return `<section class="card slice subsidy-case" data-tour-doel="subsidie">
    ${backLabel ? `<button class="link-btn case-back" data-action="subsidie-back">← Terug naar ${esc(backLabel)}</button>` : ''}
    <div class="slice-heading"><h2 id="subsidie-heading" tabindex="-1">Gemeentesubsidie</h2><span class="tag">Seizoen ${z?.seizoen ?? s.season}</span></div>
    ${z ? r ? `<div class="case-outcome"><strong>Bij de gemeente</strong><p>Antwoord na nog ${r.weeksLeft} ${r.weeksLeft === 1 ? 'gespeelde week' : 'gespeelde weken'}.</p><p>Je hoeft nu niets te doen.</p></div>` : subsidieOutcome(z) : ''}
    ${z ? `<details class="case-evidence"><summary>Aanvraag en toelichting</summary>
      <p>${z.ingediendWeek !== undefined ? `Ingediend in seizoen ${z.seizoen}, week ${z.ingediendWeek}.` : 'De aanvraagdatum is niet bewaard in je bestaande spel.'}</p>
      <p>Raming bij aanvraag: <strong>${z.raming !== undefined ? euro(z.raming) : 'niet bewaard'}</strong>.
      Kans toen: ${z.kansBijAanvraag !== undefined ? `${Math.round(z.kansBijAanvraag * 100)}%` : 'niet bewaard'}.</p>
      <p>De gemeente berekent kans en bedrag bij het antwoord opnieuw. Je jeugdwerking, reputatie en licentiedossier tellen mee. Een raming is geen toezegging.</p>
      ${z.status === 'onbekend' ? '<button class="sm" data-action="nav" data-id="doelen">Bekijk het bestaande logboek</button>' : ''}</details>` : ''}
    ${canApply && current ? `<p class="case-intro">Een jaarlijkse bijdrage van de gemeente aan je club.</p>
      <div class="case-facts"><div><span>Raming bij aanvraag</span><strong>${euro(subsidieBedrag(s))}</strong></div><div><span>Kans nu, ongeveer</span><strong>${Math.round(kans * 100)}%</strong></div><div><span>Antwoord na</span><strong>2 gespeelde weken</strong></div></div>
      <p class="small">Zwakkere plek in je dossier: ${esc(zwakstePlek)}. De gemeente beoordeelt je club bij het antwoord; bedrag en kans kunnen nog veranderen.</p>
      <div class="case-action"><button class="primary" data-action="subsidie-aanvragen">Dossier indienen</button><span class="muted small">Eén aanvraag per seizoen, ook na een afwijzing.</span></div>` : !z ? '<p>Dit seizoen al aangevraagd. De historische uitkomst is niet bewaard.</p>' : ''}
    ${!current ? '<button class="sm" data-action="subsidie-open" data-id="">Naar dit seizoen</button>' : ''}
    ${s.subsidieZaken.some((item) => item.id !== z?.id) ? `<details class="case-history"><summary>Eerdere dossiers</summary>${s.subsidieZaken.filter((item) => item.id !== z?.id).slice().reverse().map((item) => `<p><button class="link-btn" data-action="subsidie-open" data-id="${esc(item.id)}">Seizoen ${item.seizoen} · ${esc(subsidieResult(item))}</button></p>`).join('')}</details>` : ''}
  </section>`;
}
