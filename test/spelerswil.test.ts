// Spelerswil: een speler beslist mee of hij voor jouw club wil spelen.
//
// Geld was het enige criterium: wie het bedrag had, kreeg elke handtekening. Nu weegt de
// speler je club — reeks, stand, accommodatie, trainer, kleedkamer — zoals een bedrijf bij
// de sponsors jouw vraagprijs weegt. Tot twee punten boven het niveau van je club tekent
// iedereen gewoon (de noodaankoop onder de achttien-grens kan dus nooit vastlopen);
// daarboven zakt de kans, en wie tóch tekent laat zich de stap betalen.

import { expect } from 'chai';
import { playWeeks, readyGame } from './helpers';
import { clubAppeal, playerLevel, stepPremium, transferWillingness } from '../src/engine/appeal';
import { buyPlayer } from '../src/engine/actions';
import { overall } from '../src/engine/players';
import { OWN_TEAM_ID } from '../src/engine/league';

describe('spelerswil', () => {
  it('een speler op of onder jouw niveau tekent altijd', () => {
    const s = readyGame('heidebeke');
    const bereikbaar = s.transferList.filter((p) => playerLevel(p) <= clubAppeal(s) + 2);
    expect(bereikbaar.length).to.be.above(0);
    for (const p of bereikbaar) expect(transferWillingness(s, p).kans).to.equal(1);
  });

  it('een sterspeler ziet een hekkensluiter niet zitten', () => {
    const s = readyGame('heidebeke');
    const boven = Math.round(clubAppeal(s) + 7);
    const ster = { ...s.transferList[0], technique: boven, physical: boven, potential: boven, age: 26 };
    const goed = transferWillingness(s, ster);
    expect(goed.kans).to.be.below(0.6);
    expect(goed.kans).to.be.above(0.05);
    // en als de club óók nog laatste staat, zakt de kans verder
    for (const r of s.league.table) {
      r.played = 10;
      r.points = r.teamId === OWN_TEAM_ID ? 0 : 15;
    }
    const laatste = transferWillingness(s, ster);
    expect(laatste.kans).to.be.below(goed.kans);
  });

  it('stand, trainer en accommodatie tillen de aantrekkingskracht op', () => {
    const s = readyGame('heidebeke');
    const basis = clubAppeal(s);
    for (const r of s.league.table) {
      r.played = 10;
      r.points = r.teamId === OWN_TEAM_ID ? 30 : 10;
    }
    const kampioen = clubAppeal(s);
    expect(kampioen).to.be.above(basis);
    s.infrastructure.academyLevel = 2;
    s.infrastructure.recoveryLevel = 1;
    expect(clubAppeal(s)).to.be.above(kampioen);
  });

  it('een jong talent rekent zijn potentieel mee', () => {
    const s = readyGame('heidebeke');
    const p = { ...s.transferList[0], age: 18, technique: 50, physical: 50, potential: 72 };
    expect(playerLevel(p)).to.be.above(overall(p) + 4);
  });

  it('wie boven jouw niveau tóch tekent, vraagt een hogere vergoeding', () => {
    // kopen is een gesprek (0.77.0): interesse, week spelen, antwoord. We proberen
    // seeds tot hij een keer ja zegt, en kijken dan naar zijn loon.
    for (let seed = 1; seed <= 30; seed++) {
      let s = readyGame('heidebeke', 'aannemer', seed);
      s.cash = 1_000_000;
      const p = s.transferList[0];
      const boven = Math.round(clubAppeal(s) + 6);
      p.technique = boven;
      p.physical = boven;
      p.potential = boven;
      p.age = 25;
      const wil = transferWillingness(s, p);
      expect(wil.kans).to.be.below(1);
      const loonVooraf = p.wage;
      expect(buyPlayer(s, p.id).ok, 'interesse maken lukt altijd').to.equal(true);
      expect(s.transferList.some((x) => x.id === p.id), 'hij is gereserveerd, van de markt').to.equal(false);
      s = playWeeks(s, 1);
      const getekend = s.players.find((x) => x.id === p.id);
      if (getekend) {
        expect(getekend.wage).to.be.above(loonVooraf);
        expect(stepPremium(wil)).to.be.above(1);
        return;
      }
      // geweigerd: dan staat het antwoord in het nieuws — ook dat is het afgesproken gedrag
      expect(s.news.some((n) => n.text.includes(p.name) && n.text.includes('andere club'))).to.equal(true);
    }
    throw new Error('in dertig pogingen zei geen enkele speler ja: de kans staat te laag');
  });

  it('een huurspeler aanvaardt sneller een stap omlaag dan een koopspeler', () => {
    const s = readyGame('heidebeke');
    const boven = Math.round(clubAppeal(s) + 6);
    const p = { ...s.transferList[0], technique: boven, physical: boven, age: 26, potential: boven };
    expect(transferWillingness(s, p, true).kans).to.be.above(transferWillingness(s, p).kans);
  });
});
