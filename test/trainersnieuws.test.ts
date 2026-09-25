import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { readyGame, playWeeks } from './helpers';

describe('trainersnieuws', () => {
  it('een eigen hoofdtrainer ontslaan is dorpsnieuws', () => {
    const s = readyGame();
    s.cash = 200_000;
    const trainer = s.staff.find((m) => m.role === 'hoofdtrainer')!;
    expect(actions.fireStaff(s, trainer.id).ok).to.equal(true);
    expect(s.news.some((n) => n.text.includes('op straat') && n.text.includes(trainer.name))).to.equal(true);
  });

  // Voor het ontslag was er al een apart, feestelijk bericht; de aanwerving kreeg nog de
  // generieke "X is de nieuwe Y"-tekst van elk ander staflid. Die asymmetrie is nu weg.
  it('een eigen hoofdtrainer aanwerven is ook feestelijk nieuws, geen generiek berichtje', () => {
    const s = readyGame();
    s.cash = 200_000;
    const zittend = s.staff.find((m) => m.role === 'hoofdtrainer')!;
    actions.fireStaff(s, zittend.id);
    const kandidaat = s.staffMarket.find((m) => m.role === 'hoofdtrainer')!;
    expect(actions.hireStaff(s, kandidaat.id).ok).to.equal(true);
    const bericht = s.news.find((n) => n.text.includes(kandidaat.name) && n.text.includes('hoofdtrainer'));
    expect(bericht, 'aanwerving van de hoofdtrainer hoort in het nieuws te staan').to.not.equal(undefined);
    expect(bericht!.text).to.not.equal(`${kandidaat.name} is de nieuwe hoofdtrainer.`);
    expect(bericht!.kind).to.equal('viering');
    expect(bericht!.tone).to.equal('goed');
  });

  it('ook bij andere clubs rollen er koppen (de reeks leeft)', function () {
    this.timeout(30_000);
    // 3,5% per speelweek: over drie seizoenshelften en vier seeds is de kans dat het
    // n\u00f3\u00f3it gebeurt verwaarloosbaar \u2014 en het bericht noemt altijd een clubnaam
    let gezien = false;
    for (const seed of [1, 2, 3, 4]) {
      const na = playWeeks(readyGame('zuidrand', 'aannemer', seed), 40);
      if (na.news.some((n) => /trainer/i.test(n.text) && /neemt over|uit elkaar|kiest voor/.test(n.text))) {
        gezien = true;
        break;
      }
    }
    expect(gezien).to.equal(true);
  });

  // Een weggekaapte jeugdspeler landt in de clubkroniek (remember()); een trainerswissel bij
  // een rivaal deed dat niet, terwijl het net zo goed clubgeschiedenis is die je later nog
  // wil kunnen terugvinden.
  it('een trainerswissel bij een rivaal komt ook in de clubkroniek terecht', function () {
    this.timeout(30_000);
    let gezien = false;
    for (const seed of [1, 2, 3, 4]) {
      const na = playWeeks(readyGame('zuidrand', 'aannemer', seed), 40);
      if ((na.chronicle ?? []).some((c) => /verving zijn trainer door/.test(c.text))) {
        gezien = true;
        break;
      }
    }
    expect(gezien).to.equal(true);
  });
});
