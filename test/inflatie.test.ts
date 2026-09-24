// Inflatie geldt voor de contractstromen aan twee kanten, of ze geldt niet.
//
// De doorlichting van september 2026 vond dat de grootste inkomstenpost (sponsors) en de
// grootste kostenpost (lonen) als enige buiten de inflatie stonden, terwijl onderhoud,
// bond en bouw wél elk seizoen 7% duurder werden. Deze tests leggen vast dat sponsors,
// spelerslonen, staflonen, tv-rechten, premies en subsidies het prijspeil volgen.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { fairPrice } from '../src/engine/sponsors';
import { wageDemand } from '../src/engine/players';
import { staffWage } from '../src/engine/staff';
import { seasonPrize } from '../src/engine/turn';

describe('inflatie op de contractstromen', () => {
  it('sponsorbedragen volgen het prijspeil', () => {
    const s = readyGame('heidebeke');
    const nu = fairPrice(s, 'hoofdsponsor');
    s.inflation = 1.4;
    expect(fairPrice(s, 'hoofdsponsor')).to.be.closeTo(nu * 1.4, nu * 0.02);
  });

  it('spelerslonen volgen het prijspeil', () => {
    const s = readyGame('heidebeke');
    const p = s.players[0];
    const nu = wageDemand(s, p);
    s.inflation = 1.4;
    expect(wageDemand(s, p)).to.be.closeTo(nu * 1.4, 5);
  });

  it('staflonen volgen het prijspeil', () => {
    const zonder = staffWage('hoofdtrainer', 60, 'teamspeler', 'EUFA B');
    const met = staffWage('hoofdtrainer', 60, 'teamspeler', 'EUFA B', 1.4);
    expect(met).to.be.closeTo(zonder * 1.4, 5);
  });

  it('premies volgen het prijspeil', () => {
    expect(seasonPrize(1, 'kampioen', 1.4)).to.equal(Math.round(seasonPrize(1, 'kampioen') * 1.4));
  });

  it('aan het begin van een carrière verandert er niets', () => {
    const s = readyGame('heidebeke');
    expect(s.inflation).to.equal(1);
  });
});
