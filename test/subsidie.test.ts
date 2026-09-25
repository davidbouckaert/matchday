import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { subsidieBedrag, subsidieKans } from '../src/engine/finance';
import { readyGame, playWeeks } from './helpers';

describe('de gemeentesubsidie', () => {
  it('is een aanvraag geworden: dossier indienen, twee weken wachten, antwoord in het nieuws', () => {
    let s = readyGame();
    expect(actions.vraagSubsidieAan(s).ok).to.equal(true);
    expect(s.requests.some((r) => r.kind === 'subsidie')).to.equal(true);
    expect(actions.vraagSubsidieAan(s).ok, 'niet twee keer tegelijk').to.equal(false);
    s = playWeeks(s, 2);
    const antwoord = s.news.find((n) => /subsidie/i.test(n.text) && (n.text.includes('kent') || n.text.includes('wijst')));
    expect(antwoord, 'de gemeente antwoordt').to.not.equal(undefined);
    if (antwoord!.text.includes('kent')) {
      expect(s.seasonTotals.subsidies ?? 0).to.be.greaterThan(0);
      expect(antwoord!.kind).to.equal('viering');
    } else {
      expect(antwoord!.text).to.match(/jeugdploegen|reputatie|licentie/);
    }
  });

  it('kan maar één keer per seizoen', () => {
    let s = readyGame();
    actions.vraagSubsidieAan(s);
    s = playWeeks(s, 3);
    expect(actions.vraagSubsidieAan(s).ok).to.equal(false);
  });

  it('schaalt mee met reeks en jeugdwerking, en meer jeugd geeft meer kans', () => {
    const klein = readyGame();
    const groot = readyGame();
    groot.league.divisionLevel = klein.league.divisionLevel + 2;
    groot.community.youthMembers = klein.community.youthMembers + 200;
    expect(subsidieBedrag(groot)).to.be.greaterThan(subsidieBedrag(klein));
    // kans: alleen de jeugd erbij, zelfde reeks — een promotie zónder infrastructuur
    // verzwakt je licentiedossier en dus je kans, en dat hoort zo
    const meerJeugd = readyGame();
    meerJeugd.community.youthTeams = klein.community.youthTeams + 3;
    expect(subsidieKans(meerJeugd).kans).to.be.greaterThan(subsidieKans(klein).kans);
  });

  it('betaalt niets meer vanzelf uit in week 24', () => {
    let s = readyGame();
    s = playWeeks(s, 30); // voorbij de oude subsidieweek, zonder aanvraag
    expect(s.seasonTotals.subsidies ?? 0).to.equal(0);
  });
});
