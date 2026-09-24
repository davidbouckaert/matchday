// Loondruk: wie ver onder de loonlat van zijn reeks betaald wordt, zakt in moraal.
//
// De doorlichting van september 2026 mat dat een club die elk seizoen promoveert haar
// zittende contracten maar +14% per trede geeft, terwijl de lat +45 à +62% stijgt: tegen
// seizoen zes betaalde ze 60 à 80% van wat haar reeks vraagt. Deze tests leggen de rem
// vast: één promotie blijft verteerbaar, twee promoties zonder heronderhandelen niet.

import { expect } from 'chai';
import { readyGame, playWeeks } from './helpers';
import { wageDemand, wagePressure } from '../src/engine/players';

describe('loondruk', () => {
  it('wie aan de lat verdient, voelt niets', () => {
    const s = readyGame('heidebeke');
    for (const p of s.players.filter((x) => !x.isYouth && !x.loan)) {
      p.wage = wageDemand(s, p);
      expect(wagePressure(s, p)).to.equal(0);
    }
  });

  it('één promotie met de gewone opslag van 14% blijft onder de grens', () => {
    const s = readyGame('heidebeke');
    const p = s.players.find((x) => !x.isYouth && !x.loan)!;
    p.wage = wageDemand(s, p) * 1.14; // de opslag van adjustWagesForDivision
    s.league.divisionLevel = 2; // lat ×1,45: verhouding 1,14 / 1,45 ≈ 0,79
    expect(wagePressure(s, p)).to.equal(0);
  });

  it('twee promoties zonder heronderhandelen wegen wél', () => {
    const s = readyGame('heidebeke');
    const p = s.players.find((x) => !x.isYouth && !x.loan)!;
    p.wage = wageDemand(s, p) * 1.14 * 1.14;
    s.league.divisionLevel = 3; // lat ×2,2: verhouding ≈ 0,59
    expect(wagePressure(s, p)).to.be.above(5);
  });

  it('eigen jeugd op leercontract en huurlingen vallen erbuiten', () => {
    const s = readyGame('heidebeke');
    const p = s.players.find((x) => !x.isYouth && !x.loan)!;
    p.wage = 40;
    s.league.divisionLevel = 4;
    expect(wagePressure(s, p)).to.be.above(0);
    p.isYouth = true;
    p.age = 19;
    expect(wagePressure(s, p)).to.equal(0);
    p.age = 24;
    expect(wagePressure(s, p)).to.be.above(0);
    p.isYouth = false;
    p.loan = { type: 'in', club: 'Testclub', untilSeason: s.season, wageShare: 1 };
    expect(wagePressure(s, p)).to.equal(0);
  });

  it('onderbetaalde spelers zakken in moraal tegenover eerlijk betaalde', () => {
    const onderbetaald = readyGame('heidebeke', 'aannemer', 7);
    const eerlijk = readyGame('heidebeke', 'aannemer', 7);
    for (const s of [onderbetaald, eerlijk]) s.league.divisionLevel = 3;
    for (const p of eerlijk.players.filter((x) => !x.isYouth && !x.loan)) p.wage = wageDemand(eerlijk, p);
    const na1 = playWeeks(onderbetaald, 12);
    const na2 = playWeeks(eerlijk, 12);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const moraal1 = avg(na1.players.map((p) => p.morale));
    const moraal2 = avg(na2.players.map((p) => p.morale));
    expect(moraal1).to.be.below(moraal2 - 3);
  });
});
