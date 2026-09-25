// De medische cel: het beleid achter je recuperatieruimte.
//
// Zichtbaar zodra je een recuperatieruimte hebt gebouwd (Club › Infrastructuur).
// Twee beleidskeuzes met een echte weekkost in je boekhouding (categorie "medische
// cel"), plus het overzicht van je hele medische keten: wie je in dienst hebt, wat de
// ruimte doet, en wie er in de lappenmand ligt.

import type { GameState } from '../../engine/types';
import { PREVENTIE, VOEDING, type Voeding, blessureFactor, genezingKans, medischeKost, moeFactor, voedingSterkte } from '../../engine/medisch';
import { staffSkill } from '../../engine/staff';
import { delegate } from '../../engine/delegation';
import { taskPicker } from '../taskpicker';
import { esc, euro } from '../format';
import { hint, tipAttr } from '../tooltip';
import { weeks } from '../../engine/util';

export function medischScreen(s: GameState): string {
  if (s.infrastructure.recoveryLevel < 1) {
    return `<section class="card">
      <h2>Medische cel</h2>
      <p class="muted">Hier komt het beleid van je medische cel — voeding, preventie en herstel — zodra je een
        <strong>recuperatieruimte</strong> hebt. Die bouw je bij <button class="link-btn" data-action="nav" data-id="infrastructuur">Club › Infrastructuur</button> (🚪 Afdelingen).</p>
    </section>`;
  }

  const locked = !!delegate(s, 'medisch');
  const m = s.medical;
  const geblesseerd = s.players.filter((p) => p.injuryWeeks > 0);
  const kine = staffSkill(s, 'kinesist');
  const verzorger = staffSkill(s, 'verzorger');
  const voedingskundige = staffSkill(s, 'voeding');

  const voedingKeuze = (stand: Voeding) => {
    const def = VOEDING[stand];
    const kost = Math.round(def.kost * s.inflation);
    return `<div class="choice ${m.voeding === stand ? 'sel' : 'static'}" ${locked ? '' : `data-action="voeding" data-id="${stand}"`}>
      <strong>${def.label}</strong>
      <span class="muted small">${def.uitleg}</span>
      ${
        stand === 'geen'
          ? '<span class="muted small">geen effect, geen kost</span>'
          : `<span class="small">−${Math.round(def.moe * voedingSterkte(s) * 100)}% vermoeidheidsopbouw · −${Math.round(def.blessure * voedingSterkte(s) * 100)}% blessurekans</span>`
      }
      <span class="big">${kost ? `${euro(kost)}<span class="muted small">/week</span>` : 'gratis'}</span>
    </div>`;
  };

  return `${taskPicker(s, ['medisch'])}<div class="grid">
    <section class="card span2">
      <h2>Voeding ${hint('Wat de groep eet, elke week opnieuw. De kost loopt gewoon door je boekhouding (post "medische cel"); een voedingsdeskundige haalt meer uit hetzelfde budget.')}</h2>
      ${locked ? `<p class="attention-inline small">${esc(delegate(s, 'medisch')!.name)} beheert de medische cel. Neem de taak terug bij Personeel om zelf te kiezen.</p>` : ''}
      <div class="choice-grid three">
        ${voedingKeuze('geen')}${voedingKeuze('basis')}${voedingKeuze('volledig')}
      </div>
      ${voedingskundige ? `<p class="muted small">Je voedingsdeskundige (vaardigheid ${Math.round(voedingskundige)}) versterkt de effecten met ×${voedingSterkte(s).toFixed(2)}.</p>` : '<p class="muted small">Nog geen voedingsdeskundige in dienst: die versterkt deze effecten (Personeel).</p>'}
    </section>

    <section class="card span2">
      <h2>Preventie ${hint('Rek- en stabilisatieoefeningen vóór elke training. Minder blessures, maar het gaat van de trainingstijd af: je levert wat wedstrijdscherpte in — en het drukwerk en materiaal kosten geld.')}</h2>
      <div class="choice-grid two">
        <div class="choice ${m.preventie ? 'static' : 'sel'}" ${locked ? '' : 'data-action="preventie" data-id="uit"'}>
          <strong>Uit</strong><span class="muted small">Alle trainingstijd naar voetbal.</span><span class="big">gratis</span>
        </div>
        <div class="choice ${m.preventie ? 'sel' : 'static'}" ${locked ? '' : 'data-action="preventie" data-id="aan"'}>
          <strong>Aan</strong>
          <span class="small">−${Math.round((1 - PREVENTIE.blessureFactor) * 100)}% blessurekans · −${PREVENTIE.scherpte} wedstrijdscherpte</span>
          <span class="big">${euro(Math.round(PREVENTIE.kost * s.inflation))}<span class="muted small">/week</span></span>
        </div>
      </div>
    </section>

    <section class="card span-all">
      <h2>Je medische keten ${hint('Alles wat samen bepaalt hoe fit je groep blijft en hoe snel geblesseerden terugkeren.')}</h2>
      <dl class="facts">
        <dt>Recuperatieruimte</dt><dd>niveau ${s.infrastructure.recoveryLevel}/2 — sneller vermoeidheidsherstel én geblesseerden genezen sneller</dd>
        <dt>Kinesist</dt><dd>${kine ? `vaardigheid ${Math.round(kine)} — voorkomt en geneest` : 'niet in dienst (Personeel)'}</dd>
        <dt>Verzorger</dt><dd>${verzorger ? `vaardigheid ${Math.round(verzorger)} — sneller recupereren` : 'niet in dienst (Personeel)'}</dd>
        <dt>Genezingskans</dt><dd ${tipAttr('De kans per week dat een blessure een week sneller geneest: kinesist plus recuperatieruimte.')}>${Math.round(genezingKans(s) * 100)}% per week op een week sneller terug</dd>
        <dt>Blessurekans</dt><dd>×${blessureFactor(s).toFixed(2)} door voeding en preventie · vermoeidheidsopbouw ×${moeFactor(s).toFixed(2)}</dd>
        <dt>Weekkost</dt><dd>${medischeKost(s) ? `${euro(medischeKost(s))} (post "medische cel" op Financiën)` : 'niets — je hebt alles uitstaan'}</dd>
      </dl>
      <h3>In de lappenmand ${geblesseerd.length ? `<span class="tag bad">${geblesseerd.length}</span>` : ''}</h3>
      ${
        geblesseerd.length
          ? `<ul class="small">${geblesseerd.map((p) => `<li><strong>${esc(p.name)}</strong> (${p.position}) — nog ${weeks(p.injuryWeeks)}</li>`).join('')}</ul>`
          : '<p class="muted small">Niemand geblesseerd. Hout vasthouden.</p>'
      }
    </section>
  </div>`;
}
