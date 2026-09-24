// Evenementen: gasten × wat een gast uitgeeft, niet je sponsorportefeuille × een factor.
//
// De doorlichting van september 2026 mat dat evenementen de op één na grootste
// inkomstenpost waren (€714.000 netto per seizoen in de Challenger Pro Liga, opbrengst/kost
// tot 28,6×), omdat de opbrengst de volledige reeksschaal van sponsors en supporters erfde
// terwijl de kost alleen inflatie droeg. Deze tests leggen de nieuwe vorm vast: de gasten
// zijn fysiek begrensd, alleen het bedrag per gast stijgt met je niveau.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { CLUB_EVENTS } from '../src/engine/data/catalog';
import { eventCost, eventForecast, eventPrestige } from '../src/engine/actions';

const def = (id: string) => CLUB_EVENTS.find((e) => e.id === id)!;
const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

describe('evenementen als gasten × bedrag per gast', () => {
  it('een vollere kantine, niet meer supporters, bepaalt het plafond van de quiz', () => {
    const s = readyGame('heidebeke');
    s.community.fanBase = 10_000; // de zaal is nu de grens
    const basis = mid(eventForecast(s, def('quiz')));
    s.community.fanBase = 100_000;
    expect(mid(eventForecast(s, def('quiz')))).to.equal(basis);
    s.infrastructure.kantineLevel += 2;
    expect(mid(eventForecast(s, def('quiz')))).to.be.above(basis);
  });

  it('het bedrag per gast stijgt met de reeks, maar begrensd', () => {
    const s = readyGame('heidebeke');
    expect(eventPrestige(s)).to.be.closeTo(1, 0.01);
    s.league.divisionLevel = 4;
    expect(eventPrestige(s)).to.be.closeTo(1.9, 0.01);
    s.league.divisionLevel = 5;
    expect(eventPrestige(s)).to.be.at.most(3.1);
  });

  it('de businessclub-lunch is in de top winstgevend maar geen geldmachine meer', () => {
    const s = readyGame('heidebeke');
    s.league.divisionLevel = 4; // Challenger Pro Liga
    s.inflation = 1.4;
    s.infrastructure.kantineLevel = 4;
    const lunch = def('businessclub');
    const verhouding = mid(eventForecast(s, lunch)) / eventCost(s, lunch);
    expect(verhouding).to.be.above(1.2);
    expect(verhouding).to.be.below(4);
  });

  it('elk evenement blijft op zijn eigen niveau de moeite waard, behalve de fandag', () => {
    // de fandag koopt supporters en sfeer, geen geld — dat mag, als het maar een keuze is
    const s = readyGame('heidebeke');
    s.community.volunteers = 40;
    s.infrastructure.kantineLevel = 4;
    s.infrastructure.capacity = 4_000;
    s.community.fanBase = 900;
    for (const e of CLUB_EVENTS) {
      s.league.divisionLevel = Math.max(1, e.minLevel ?? 1);
      const verhouding = mid(eventForecast(s, e)) / eventCost(s, e);
      if (e.id === 'fandag') expect(verhouding).to.be.below(1.5);
      else expect(verhouding, e.id).to.be.above(1);
      expect(verhouding, e.id).to.be.below(8);
    }
  });
});
