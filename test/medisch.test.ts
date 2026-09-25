import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { PREVENTIE, blessureFactor, genezingKans, medischeKost, moeFactor } from '../src/engine/medisch';
import { readyGame, playWeeks } from './helpers';

/** Een club mét recuperatieruimte: zonder ruimte bestaat de medische cel niet. */
function metRuimte(seed = 1) {
  const s = readyGame('zuidrand', 'aannemer', seed);
  s.infrastructure.recoveryLevel = 1;
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
    let s = metRuimte();
    actions.setVoeding(s, 'volledig');
    actions.setPreventie(s, true);
    const verwacht = medischeKost(s);
    expect(verwacht).to.be.greaterThan(0);
    s = playWeeks(s, 1);
    expect(-(s.seasonTotals['medische cel'] ?? 0)).to.be.at.least(verwacht);
  });

  it('voeding drukt vermoeidheidsopbouw en blessurekans, preventie drukt de kans verder maar kost scherpte', () => {
    const s = metRuimte();
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

  it('de recuperatieruimte geneest nu ook: hogere genezingskans per niveau', () => {
    const s = readyGame();
    const zonder = genezingKans(s);
    s.infrastructure.recoveryLevel = 2;
    expect(genezingKans(s)).to.be.greaterThan(zonder);
  });
});
