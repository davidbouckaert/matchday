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
});
