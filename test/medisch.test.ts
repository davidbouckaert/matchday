import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { PREVENTIE, VOEDING, blessureFactor, effectieveVoeding, genezingKans, medischeKost, moeFactor, voedingSterkte } from '../src/engine/medisch';
import { readyGame, playWeeks } from './helpers';

/** Een club mét recuperatieruimte: zonder ruimte bestaat de medische cel niet. */
function metRuimte(seed = 1) {
  const s = readyGame('zuidrand', 'aannemer', seed);
  s.infrastructure.recoveryLevel = 1;
  return s;
}

/** Zet een voedingsdeskundige op de payroll: het volledige plan is zijn maatwerk. */
function metDeskundige(s: ReturnType<typeof metRuimte>) {
  s.staff.push({ id: 'vd1', name: 'Test Deskundige', role: 'voeding', skill: 60, trait: 'loyaal', wage: 120, diploma: 'geen', courseWeeksLeft: 0, courseType: null });
  return s;
}

describe('de medische cel', () => {
  it('bestaat pas met een recuperatieruimte', () => {
    const s = readyGame();
    expect(actions.setVoeding(s, 'basis').ok).to.equal(false);
    s.infrastructure.recoveryLevel = 1;
    expect(actions.setVoeding(s, 'basis').ok).to.equal(true);
  });

  it('elk voordeel heeft een kost die echt geboekt wordt', () => {
    let s = metDeskundige(metRuimte());
    actions.setVoeding(s, 'volledig');
    actions.setPreventie(s, true);
    const verwacht = medischeKost(s);
    expect(verwacht).to.be.greaterThan(0);
    s = playWeeks(s, 1);
    expect(-(s.seasonTotals['medische cel'] ?? 0)).to.be.at.least(verwacht);
  });

  it('voeding drukt vermoeidheidsopbouw en blessurekans, preventie drukt de kans verder maar kost scherpte', () => {
    const s = metDeskundige(metRuimte());
    expect(moeFactor(s)).to.equal(1);
    expect(blessureFactor(s)).to.equal(1);
    actions.setVoeding(s, 'volledig');
    expect(moeFactor(s)).to.be.lessThan(1);
    expect(blessureFactor(s)).to.be.lessThan(1);
    const zonder = blessureFactor(s);
    actions.setPreventie(s, true);
    expect(blessureFactor(s)).to.be.lessThan(zonder);
    expect(PREVENTIE.scherpte).to.be.greaterThan(0); // de prijs naast het geld
  });

  // Davids vaststelling (0.81.0): je kon een volledig voedingsschema draaien zonder
  // voedingsdeskundige op de payroll, terwijl die deskundige achter kantine niveau 3 zat —
  // voeding spande zo over twee losse takken. Nu is het één verhaal in de medische keten:
  // de deskundige vereist de recuperatieruimte (als kinesist en verzorger), en het
  // volledige plan ("maatwerk per speler") bestaat alleen zolang híj het schrijft.
  it('het volledige voedingsplan vereist een voedingsdeskundige', () => {
    const s = metRuimte();
    expect(actions.setVoeding(s, 'volledig').ok, 'zonder deskundige: geweigerd').to.equal(false);
    expect(actions.setVoeding(s, 'basis').ok, 'basis kan iedereen regelen').to.equal(true);
    metDeskundige(s);
    expect(actions.setVoeding(s, 'volledig').ok).to.equal(true);
  });

  it('valt de deskundige weg, dan valt volledig terug op basis — ook in de kost', () => {
    const s = metDeskundige(metRuimte());
    actions.setVoeding(s, 'volledig');
    const kostVolledig = medischeKost(s);
    s.staff = s.staff.filter((m) => m.role !== 'voeding');
    expect(effectieveVoeding(s)).to.equal('basis');
    expect(medischeKost(s), 'je betaalt nooit voor een plan dat niemand meer opstelt').to.be.lessThan(kostVolledig);
    // en de effecten zijn die van basis (deskundige weg, dus versterking ×1)
    expect(voedingSterkte(s)).to.equal(1);
    expect(moeFactor(s)).to.equal(Math.max(0.75, 1 - VOEDING.basis.moe));
  });

  it('de voedingsdeskundige hoort bij de medische keten, niet bij de kantine', () => {
    const s = readyGame();
    s.infrastructure.kantineLevel = 5; // een topkeuken helpt niet zonder medische cel
    expect(actions.staffLock(s, 'voeding')).to.be.a('string');
    s.infrastructure.recoveryLevel = 1;
    s.infrastructure.kantineLevel = 1; // en een basickantine houdt hem niet tegen
    expect(actions.staffLock(s, 'voeding')).to.equal(null);
  });

  it('de recuperatieruimte geneest nu ook: hogere genezingskans per niveau', () => {
    const s = readyGame();
    const zonder = genezingKans(s);
    s.infrastructure.recoveryLevel = 2;
    expect(genezingKans(s)).to.be.greaterThan(zonder);
  });
});
