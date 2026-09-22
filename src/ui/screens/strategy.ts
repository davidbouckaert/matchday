import type { Formation, GamePlan, GameState, Mentality, TrainingFocus } from '../../engine/types';
import { FORMATIONS, FORMATION_MOD, teamStrength } from '../../engine/players';
import {
  FOCUS_INFO,
  MENTALITY_INFO,
  PLANS,
  PLAN_INFO,
  TRAINING_INFO,
  TRAININGS_MAX,
  TRAININGS_MIN,
  matchup,
  nextOpponent,
  scoutingReport,
  trainingCost,
} from '../../engine/strategy';
import { NATURAL_RECOVERY, matchLoad, recovery, trainingLoad } from '../../engine/factors';
import { opponentSuspensions } from '../../engine/discipline';
import { delegate } from '../../engine/delegation';
import { roleDef } from '../../engine/data/catalog';
import { esc, euro } from '../format';

function signed(n: number): string {
  return `<span class="${n < 0 ? 'neg' : n > 0 ? 'pos' : 'muted'}">${n > 0 ? '+' : ''}${n}</span>`;
}

const MU_LABEL: Record<number, string> = { 1: 'voordeel', 0: 'neutraal', [-1]: 'nadeel' };

/** Pokémon-achtige tabel: wie wint van wie. */
function matrix(): string {
  const head = PLANS.map((p) => `<th title="${esc(PLAN_INFO[p].text)}">${PLAN_INFO[p].label}</th>`).join('');
  const rows = PLANS.map((ours) => {
    const cells = PLANS.map((theirs) => {
      const m = matchup(ours, theirs);
      const why = m === 1 ? PLAN_INFO[ours].why[theirs] : m === -1 ? PLAN_INFO[theirs].why[ours] : 'geen voor- of nadeel';
      return `<td class="mu mu${m}" title="${esc(`${PLAN_INFO[ours].label} tegen ${PLAN_INFO[theirs].label}: ${why}`)}">${m === 1 ? '▲ sterk' : m === -1 ? '▼ zwak' : '–'}</td>`;
    }).join('');
    return `<tr><th>${PLAN_INFO[ours].label}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="compact matrix"><thead><tr><th>Jij \\ tegenstander</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function strategyScreen(s: GameState): string {
  const t = s.tactics;
  const coach = delegate(s, 'opstelling');
  const lockTip = coach
    ? `Uitbesteed aan ${coach.name} (${roleDef(coach.role).label}). Neem de taak "Strategie" terug bij Staff om hier zelf te beslissen.`
    : '';
  const fs = (inner: string) =>
    coach ? `<fieldset class="locked" disabled title="${esc(lockTip)}">${inner}</fieldset>` : `<fieldset>${inner}</fieldset>`;

  const opp = nextOpponent(s);
  const base = teamStrength(s);
  const vsOpp = opp ? teamStrength(s, { strength: opp.strength, plan: opp.knownPlan }) : null;

  const rep = scoutingReport(s);
  const oppCard = rep
    ? `<section class="card">
        <h2>Scoutingrapport: ${rep.home ? 'thuis' : 'uit'} tegen ${esc(rep.name)}</h2>
        <p class="small muted">Week ${rep.week}${rep.week === s.week ? ' (deze week)' : ''} · ${rep.position}e in het klassement · ${rep.points} punten uit ${rep.played} wedstrijden · doelsaldo ${rep.goalsFor}-${rep.goalsAgainst}</p>
        <div class="tiles">
          <div class="tile"><span class="label">Hun aanval / verdediging</span><strong>${rep.attack} / ${rep.defense}</strong><span class="muted small">sterkte ${rep.strength.toFixed(1)}</span></div>
          <div class="tile"><span class="label">Jouw aanval / verdediging</span><strong>${vsOpp!.attack} / ${vsOpp!.defense}</strong><span class="small">totaal ${vsOpp!.total} (vermoeidheid ×${vsOpp!.fatigueFactor.toFixed(2)})</span></div>
          <div class="tile"><span class="label">Vorm (laatste 5)</span>
            <div class="formrow">${rep.form.length ? rep.form.map((r) => `<span class="${r}">${r}</span>`).join('') : '<span class="muted small">nog niet gespeeld</span>'}</div>
            <span class="muted small">W = winst, G = gelijk, V = verlies</span></div>
          <div class="tile"><span class="label">Hun spelplan</span><strong class="plan-name">${PLAN_INFO[rep.knownPlan].label}</strong>
            <span class="muted small">${rep.certain ? 'zeker: je analist bekeek hun voorbereiding' : `gebruikelijk plan; 1 op 4 keer wijken ze af. Een data-analist weet het zeker.`}</span></div>
          <div class="tile mu${vsOpp!.matchup}"><span class="label">Jouw spelplan</span><strong class="plan-name">${PLAN_INFO[t.plan].label}</strong>
            <span class="small">${MU_LABEL[vsOpp!.matchup]}: aanval ${signed(vsOpp!.matchupBonus.att)}, verdediging ${signed(vsOpp!.matchupBonus.def)}</span></div>
        </div>
        ${opponentSuspensions(s, s.league.teams.find((x) => x.name === rep.name)!.id) ? `<p class="small">Geschorst bij hen: <strong>${opponentSuspensions(s, s.league.teams.find((x) => x.name === rep.name)!.id)}</strong> speler(s) (verzwakt hun ploeg).</p>` : ''}
        <p class="small">Gespeelde spelplannen in hun laatste wedstrijden: ${rep.recentPlans.length ? rep.recentPlans.map((p) => `<span class="tag">${PLAN_INFO[p].label}</span>`).join(' ') : '<span class="muted">nog geen</span>'}</p>
        <p class="small">Tip: tegen ${PLAN_INFO[rep.knownPlan].label.toLowerCase()} werken <strong>${PLANS.filter((p) => matchup(p, rep.knownPlan) === 1).map((p) => PLAN_INFO[p].label.toLowerCase()).join(' en ')}</strong> het best;
        ${PLANS.filter((p) => matchup(p, rep.knownPlan) === -1).map((p) => PLAN_INFO[p].label.toLowerCase()).join(' en ')} zijn af te raden.
        ${rep.attack > rep.defense + 1 ? 'Hun aanval is hun sterkste wapen: een verdedigende mentaliteit beperkt de schade.' : rep.defense > rep.attack + 1 ? 'Ze verdedigen beter dan ze aanvallen: een aanvallende mentaliteit is minder riskant.' : ''}</p>
      </section>`
    : '<section class="card"><h2>Scoutingrapport</h2><p class="muted">Geen wedstrijden meer dit seizoen.</p></section>';

  const trainingCard = `<section class="card">
    <h2>Training</h2>
    ${fs(`
      <label>Trainingen per week
        <select data-change="trainings">
          ${Array.from({ length: TRAININGS_MAX - TRAININGS_MIN + 1 }, (_, i) => TRAININGS_MIN + i)
            .map((n) => `<option value="${n}" ${t.trainings === n ? 'selected' : ''}>${n} trainingen</option>`)
            .join('')}
        </select>
      </label>
      <p class="muted small">${esc(TRAINING_INFO[t.trainings])} Kost ${euro(trainingCost(s))}/week. Scherpte ${signed(base.sharpness)}.</p>
      <p class="small">Vermoeidheid basiself: <strong class="${base.fatigue > 35 ? 'fatigue-hi' : ''}">${base.fatigue}/100</strong> → aanval en verdediging ×${base.fatigueFactor.toFixed(3)}. Per week: ${Math.round(NATURAL_RECOVERY * 100)}% natuurlijk herstel, opbouw training +${trainingLoad(s).toFixed(1)}, wedstrijd +${matchLoad(s).toFixed(1)}, extra herstel −${recovery(s).toFixed(1)} (kinesist, verzorger, voeding, conditietrainer, recuperatieruimte, focus herstel). Boven 50 riskeren spelers blessures op training.</p>
      <label>Trainingsfocus
        <select data-change="focus">
          ${(Object.keys(FOCUS_INFO) as TrainingFocus[]).map((f) => `<option value="${f}" ${t.focus === f ? 'selected' : ''}>${FOCUS_INFO[f].label}</option>`).join('')}
        </select>
      </label>
      <p class="muted small">${esc(FOCUS_INFO[t.focus].text)}</p>
    `)}
  </section>`;

  const lineupCard = `<section class="card">
    <h2>Opstelling</h2>
    ${fs(`
      <label>Formatie
        <select data-change="formation">
          ${(Object.keys(FORMATIONS) as Formation[])
            .map((f) => {
              const m = FORMATION_MOD[f];
              return `<option value="${f}" ${t.formation === f ? 'selected' : ''}>${f} (aanval ${m.att >= 0 ? '+' : ''}${m.att}, verdediging ${m.def >= 0 ? '+' : ''}${m.def})</option>`;
            })
            .join('')}
        </select>
      </label>
      <p class="small">Basiself: ${t.manualXI.length ? `${t.manualXI.length} speler(s) zelf gekozen, de rest vult de computer aan met de besten.` : 'automatisch de beste elf.'}
      Spelers vastzetten doe je met ☆ in de tab Ploeg.
      ${t.manualXI.length ? '<button class="sm" data-action="auto-lineup">Alles automatisch</button>' : ''}</p>
    `)}
  </section>`;

  const tacticCard = `<section class="card">
    <h2>Wedstrijdtactiek</h2>
    ${fs(`
      <div class="btn-row"><span class="muted small">Mentaliteit</span>
        ${(Object.keys(MENTALITY_INFO) as Mentality[])
          .map((m) => `<button class="sm ${t.mentality === m ? 'primary' : ''}" data-action="mentality" data-id="${m}" title="${esc(MENTALITY_INFO[m].text)}">${m}</button>`)
          .join('')}
      </div>
      <p class="muted small">${esc(MENTALITY_INFO[t.mentality].text)}</p>
      <h3>Spelplan</h3>
      <div class="plans">
        ${PLANS.map((p: GamePlan) => {
          const trial = teamStrength({ ...s, tactics: { ...t, plan: p } }, opp ? { strength: opp.strength, plan: opp.knownPlan } : undefined);
          const m = opp ? matchup(p, opp.knownPlan) : 0;
          return `<button class="plan ${t.plan === p ? 'sel' : ''} mu${m}" data-action="plan" data-id="${p}">
            <strong>${PLAN_INFO[p].label}</strong>
            <span class="small">${esc(PLAN_INFO[p].text)}</span>
            <span class="small muted">Nodig: ${esc(PLAN_INFO[p].needs)}</span>
            <span class="small">Past bij je spelers: ${signed(trial.planFit)}</span>
            ${opp ? `<span class="small">Tegen ${PLAN_INFO[opp.knownPlan].label.toLowerCase()}: <strong>${MU_LABEL[m]}</strong></span>` : ''}
            <span class="small">Sterkte: <strong>${trial.total}</strong></span>
          </button>`;
        }).join('')}
      </div>
    `)}
  </section>`;

  return `
  ${coach ? `<p class="attention-inline">🔒 ${esc(lockTip)}</p>` : ''}
  ${oppCard}
  <div class="grid">
    ${trainingCard}
    ${lineupCard}
  </div>
  ${tacticCard}
  <section class="card">
    <h2>Welk spelplan wint van welk?</h2>
    <p class="muted small">Zoals bij Pokémon: elk spelplan is sterk tegen twee andere en zwak tegen twee andere. Een voordeel geeft ongeveer +2 aanval en +1,2 verdediging, een nadeel evenveel minder.
    Een betere hoofdtrainer en de trainingsfocus "tactiek" versterken dat. Beweeg over een vakje voor de uitleg.</p>
    ${matrix()}
  </section>`;
}
