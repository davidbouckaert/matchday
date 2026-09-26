import type { ActionResult, GameState, Position } from '../engine/types';
import * as actions from '../engine/actions';
import { FORMATIONS, overall, selectLineup, teamStrength } from '../engine/players';
import { delegate, taskCapacity } from '../engine/delegation';
import { TASKS, roleDef } from '../engine/data/catalog';
import { playerImpact, staffImpact } from '../engine/impact';
import { transferWillingness, wantsAway } from '../engine/appeal';
import { round } from '../engine/rng';
import { bar, esc, euro } from './format';
import { impactChips } from './impact';
import { staffComparison } from './staff-comparison';
import { contractLabel } from './screens/playercard';

export interface Workflow {
  kind: 'squad' | 'staff' | 'contract' | 'buy' | 'loan';
  id: string;
  candidate?: string;
  wage?: string;
  result?: ActionResult;
  done?: boolean;
  scroll: number;
  focus: string | null;
  week: number;
  season: number;
}

export function workflowValid(s: GameState, w: Workflow): boolean {
  if (s.week !== w.week || s.season !== w.season) return false;
  if (w.done) return true;
  if (w.kind === 'staff') return s.staffMarket.some((p) => p.id === w.id);
  if (w.kind === 'buy' || w.kind === 'loan') return (w.kind === 'buy' ? s.transferList : s.loanMarket).some((p) => p.id === w.id);
  if (w.id.startsWith('leeg:')) {
    const zone = w.id.split(':')[1] as Position;
    const slots = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).slots;
    return w.kind === 'squad' && slots.filter((slot) => slot.zone === zone).length < FORMATIONS[s.tactics.formation][zone];
  }
  return s.players.some((p) => p.id === w.id);
}

/** Beide presentaties gebruiken dezelfde bestaande actie, inclusief de lege plaats. */
export function replaceSquad(s: GameState, out: string, incoming: string): ActionResult {
  return out.startsWith('leeg:') ? actions.toggleStarter(s, incoming) : actions.swapInLineup(s, out, incoming);
}

export function squadPreview(s: GameState, out: string, incoming: string) {
  const copy = structuredClone(s);
  const result = replaceSquad(copy, out, incoming);
  return { result, before: teamStrength(s).total, after: teamStrength(copy).total };
}

export function performWorkflow(s: GameState, w: Workflow): ActionResult {
  if (!workflowValid(s, w) || w.done) return { ok: false, message: 'Deze keuze is niet meer beschikbaar. Sluit het paneel en bekijk het overzicht.' };
  switch (w.kind) {
    case 'squad': return w.candidate ? replaceSquad(s, w.id, w.candidate) : { ok: false, message: 'Kies eerst een vervanger.' };
    case 'staff': {
      const c = s.staffMarket.find((p) => p.id === w.id)!;
      return s.staff.some((p) => p.role === c.role) ? actions.replaceStaff(s, w.id) : actions.hireStaff(s, w.id);
    }
    case 'contract': {
      if (delegate(s, 'contracten')) return { ok: false, message: 'Neem Contractverlengingen eerst terug om zelf te onderhandelen.' };
      const wage = Number(w.wage);
      if (!w.wage?.trim() || !Number.isFinite(wage) || wage < 40) return { ok: false, message: 'Vul een loonvoorstel van minstens €40 per week in.' };
      return actions.extendContract(s, w.id, wage);
    }
    case 'buy': return actions.buyPlayer(s, w.id);
    case 'loan': return actions.loanIn(s, w.id);
  }
}

const fact = (label: string, value: string) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
const names = (ids: string[]) => ids.map((id) => TASKS.find((t) => t.id === id)?.label ?? id).join(', ') || 'geen';

export function contractProposal(s: GameState, id: string, value: string): string {
  const p = s.players.find((p) => p.id === id);
  const wage = Number(value);
  if (!p || !value.trim() || !Number.isFinite(wage) || wage < 40) return 'Vul minstens €40 per week in.';
  const offer = round(wage, 5);
  const result = actions.wageOfferEffect(s, p, offer);
  return `${euro(offer)}/week na afronding op €5 · ${euro(offer - p.wage)} loonverschil per week · ${Math.round(result.chance * 100)}% kans op akkoord. Moraalreactie: ${result.morale > 0 ? '+' : ''}${result.morale}. Een afwijzing kan zijn moraal verlagen.`;
}

export function workflowPanel(s: GameState, w: Workflow): string {
  let title = '', body = '', verb = 'Bevestigen', blocked = false;
  if (w.done) {
    title = 'Resultaat';
    body = '<p>Je overzicht blijft op dezelfde plaats staan. Sluit dit paneel om verder te gaan.</p>';
  } else if (w.kind === 'squad') {
    const selected = s.players.find((p) => p.id === w.id);
    const slots = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).slots;
    const zone = slots.find((x) => x.player.id === w.id)?.zone ?? (w.id.split(':')[1] as Position) ?? selected?.position;
    title = selected ? `${selected.name} vervangen` : `Open plaats · ${zone}`;
    const choices = s.players.filter((p) => p.id !== w.id && !slots.some((x) => x.player.id === p.id));
    const incoming = choices.find((p) => p.id === w.candidate);
    const preview = incoming ? squadPreview(s, w.id, incoming.id) : null;
    blocked = !preview?.result.ok;
    body = `<div class="workflow-source"><strong>${selected ? esc(selected.name) : 'Open plaats'}</strong> · ${esc(zone ?? '')}${selected ? ` · kwaliteit ${overall(selected)}` : ''}<br/>Ploegsterkte nu: ${teamStrength(s).total.toFixed(1)}</div>
      <label>Vervanger<select id="workflow-candidate" data-workflow-field="candidate"><option value="">Kies een speler</option>${choices.map((p) => `<option value="${p.id}" ${p.id === w.candidate ? 'selected' : ''}>${esc(p.name)} · ${p.position} · ${overall(p)}${p.injuryWeeks ? ' · geblesseerd' : p.suspended ? ' · geschorst' : p.loan?.type === 'uit' ? ' · uitgeleend' : ''}</option>`).join('')}</select></label>
      ${!choices.length ? '<p>Er zijn geen vervangers beschikbaar.</p>' : ''}
      ${incoming && preview ? `<dl class="workflow-facts">${fact('Kandidaat', esc(incoming.name))}${fact('Positie', `${incoming.position}${incoming.position === zone ? ' · past op deze plaats' : ' · buiten eigen positie'}`)}${fact('Kwaliteit', `${overall(incoming)} ${bar(overall(incoming))}`)}${fact('Beschikbaarheid', incoming.injuryWeeks ? `${incoming.injuryWeeks} weken geblesseerd` : incoming.suspended ? `${incoming.suspended} wedstrijden geschorst` : incoming.loan?.type === 'uit' ? 'Uitgeleend' : 'Speelklaar')}${fact('Vermoeidheid', `${Math.round(incoming.fatigue)}/100`)}${fact('Ploegsterkte na wissel', `${preview.after.toFixed(1)} (${preview.after - preview.before >= 0 ? '+' : ''}${(preview.after - preview.before).toFixed(1)})`)}</dl>${!preview.result.ok ? `<p class="workflow-error">${esc(preview.result.message)}</p>` : ''}` : '<p>Kies een speler om de gevolgen te vergelijken. Je opstelling verandert pas bij bevestigen.</p>'}`;
    verb = 'Wissel bevestigen';
  } else if (w.kind === 'staff') {
    const c = s.staffMarket.find((p) => p.id === w.id)!;
    const comparison = staffComparison(s, c);
    const current = comparison.current;
    title = `${roleDef(c.role).label} vergelijken`;
    blocked = !!comparison.reason;
    body = `<div class="workflow-source">Nu: ${current ? `${esc(current.name)} · ${current.skill}/100 ${bar(current.skill)} · ${euro(current.wage)}/week · ${current.diploma} · ${taskCapacity(current)} taakplaatsen` : 'Vacature'}</div>
      <h3>${esc(c.name)}</h3><p>${c.skill}/100 ${bar(c.skill)} · ${esc(c.trait)} · ${c.diploma} · ${taskCapacity(c)} taakplaatsen</p>
      ${impactChips(staffImpact(s, c.role, c.skill))}
      <dl class="workflow-facts">${fact('Eenmalig totaal', euro(comparison.cost))}${fact('Nieuw weekloon', euro(c.wage))}${fact('Weekverschil', euro(comparison.weeklyDelta))}${fact('Taken gaan mee', esc(names(comparison.taken)))}${fact('Taken terug naar jou', esc(names(comparison.returned)))}</dl>
      ${current?.role === 'hoofdtrainer' ? '<p>Het ontslag van de hoofdtrainer verlaagt de moraal van je spelers.</p>' : ''}
      ${comparison.reason ? `<p class="workflow-error">${esc(comparison.reason)}</p>` : ''}`;
    verb = current ? 'Vervanging bevestigen' : 'Aanwerven';
  } else if (w.kind === 'contract') {
    const p = s.players.find((p) => p.id === w.id)!;
    title = `Contract · ${p.name}`;
    const higher = wantsAway(s, p);
    blocked = !!delegate(s, 'contracten') || higher;
    body = `<div class="workflow-source">${esc(p.name)} · ${p.position} · ${overall(p)} kwaliteit</div>
      <dl class="workflow-facts">${fact('Huidig contract', esc(contractLabel(s, p).kort))}${fact('Loon nu', `${euro(p.wage)}/week`)}${fact('Gevraagd loon', `${euro(actions.askingWage(s, p))}/week`)}${fact('Bij akkoord', `Einde seizoen ${p.contractUntil + 1} · één seizoen langer`)}</dl>
      ${higher ? '<p>Hij wil hogerop en verlengt niet, tegen geen enkel loon. Je kunt hem verkopen of je club verder ontwikkelen.</p>' : blocked ? '<p>Je personeel regelt Contractverlengingen. Neem de taak in het overzicht terug om zelf te onderhandelen.</p>' : `<label>Loonvoorstel per week (€)<input id="workflow-wage" inputmode="decimal" data-workflow-field="wage" value="${esc(w.wage ?? '')}" autocomplete="off" /></label><p id="workflow-proposal">${esc(contractProposal(s, p.id, w.wage ?? ''))}</p>`}`;
    verb = 'Dit bod doen';
  } else {
    const p = (w.kind === 'buy' ? s.transferList : s.loanMarket).find((p) => p.id === w.id)!;
    const willingness = transferWillingness(s, p, w.kind === 'loan');
    const signed = structuredClone(s);
    const player = structuredClone(p);
    if (w.kind === 'buy') actions.completeSigning(signed, player, willingness); else actions.completeLoanIn(signed, player);
    const copy = structuredClone(s);
    const preview = w.kind === 'buy' ? actions.buyPlayer(copy, p.id) : actions.loanIn(copy, p.id);
    // Een inhoudelijke weigering is een mogelijk resultaat, geen vooruitgespoilde beslissing.
    const pending = copy.requests.some((r) => r.targetId === p.id);
    blocked = !preview.ok && (w.kind === 'buy' ? copy.transferList : copy.loanMarket).some((c) => c.id === p.id);
    title = `${w.kind === 'buy' ? 'Aanwerven' : 'Huren'} · ${p.name}`;
    body = `<div class="workflow-source">${esc(p.name)} · ${p.position} · ${p.age} jaar · ${esc(p.trait)}</div>
      <dl class="workflow-facts">${fact('Kwaliteit / potentieel', `${overall(p)} / ${Math.round(p.potential)}`)}${fact('Eenmalige prijs', euro(p.purchasePrice))}${fact('Loon bij tekenen', `${euro(player.wage)}/week`)}${fact('Kans dat hij komt', `${Math.round(willingness.kans * 100)}%`)}</dl>
      ${impactChips(playerImpact(s, p))}<p>Dit loon gebruikt de bestaande contractregels voor de stap naar jouw club. Kosten worden pas geboekt als hij tekent.</p>
      ${blocked ? `<p class="workflow-error">${esc(preview.message)}</p>` : `<p>${pending ? 'Je meldt interesse. Het antwoord komt bij de volgende week; dit is nog geen getekend contract.' : 'Bij een tekort aan speelklare spelers wordt de komst meteen afgehandeld.'}</p>`}`;
    verb = w.kind === 'buy' ? 'Interesse bevestigen' : 'Huur bevestigen';
  }
  return `<div class="overlay workflow-overlay" data-action="workflow-close"><section class="workflow-panel" role="dialog" aria-modal="true" aria-labelledby="workflow-title" data-action="noop" tabindex="-1">
    <header><h2 id="workflow-title">${esc(title)}</h2><button data-action="workflow-close" aria-label="Paneel sluiten">✕</button></header>
    <div class="workflow-body">${w.result ? `<p class="workflow-result ${w.result.ok ? '' : 'workflow-error'}" role="status" tabindex="-1">${esc(w.result.message)}</p>` : ''}${body}</div>
    <footer><button data-action="workflow-close">${w.done ? 'Terug naar overzicht' : 'Annuleren'}</button>${w.done ? '' : `<button class="primary" data-action="workflow-confirm" ${blocked ? 'disabled' : ''}>${verb}</button>`}</footer>
  </section></div>`;
}
