import { expect } from 'chai';
import { loyaltyRate } from '../src/engine/seasontickets';
import { bookHomeMatch, expectedAttendance, type Weather } from '../src/engine/finance';
import { readyGame } from './helpers';
import type { GameState } from '../src/engine/types';

/** Speelt één thuiswedstrijd en geeft de opkomst en de kassaopbrengst terug. */
function thuismatch(s: GameState, weather: Weather): { opkomst: number; kassa: number } {
  const kopie: GameState = structuredClone(s);
  const opkomst = bookHomeMatch(kopie, { weather, derby: false, positionFactor: 1 }, 'KSK Testclub');
  const kassa = kopie.thisWeek.filter((e) => e.category === 'tickets').reduce((sum, e) => sum + e.amount, 0);
  return { opkomst, kassa };
}

function metAbonnees(sold: number): GameState {
  const s = readyGame('zuidrand');
  s.seasonTickets = sold ? { season: s.season, price: 115, sold, revenue: sold * 115 } : null;
  return s;
}

describe('Wat een abonnement écht doet', () => {
  it('laat abonnees niet meer aan de kassa betalen', () => {
    const zonder = thuismatch(metAbonnees(0), 'bewolkt');
    const met = thuismatch(metAbonnees(300), 'bewolkt');
    expect(met.kassa, 'wie vooruit betaalde, betaalt niet nog eens').to.be.below(zonder.kassa);
  });

  it('houdt de tribune voller naarmate het weer slechter is', () => {
    // dít is waar je een abonnement voor koopt, en het deed het eerst niet: de oude
    // ondergrens van 85% van je abonnees lag altijd onder de gewone opkomst, dus ze
    // sloeg nooit aan
    const winst = (w: Weather) => thuismatch(metAbonnees(400), w).opkomst - thuismatch(metAbonnees(0), w).opkomst;
    expect(winst('storm'), 'bij storm hoort het verschil het grootst te zijn').to.be.above(winst('regen'));
    expect(winst('regen')).to.be.above(winst('bewolkt'));
    expect(winst('storm')).to.be.above(20);
  });

  it('levert meer volk in de kantine op, ook al brengt het geen ticketgeld op', () => {
    const zonder = thuismatch(metAbonnees(0), 'storm');
    const met = thuismatch(metAbonnees(400), 'storm');
    // meer toeschouwers, minder kassa — precies de ruil die een abonnement is
    expect(met.opkomst).to.be.above(zonder.opkomst);
    expect(met.kassa).to.be.below(zonder.kassa);
  });

  it('verkoopt de plaats van een afwezige abonnee door als de tribune vol zit', () => {
    const s = metAbonnees(150);
    s.infrastructure.capacity = 300;
    const r = thuismatch(s, 'bewolkt');
    // 150 abonnees, maar niet allemaal aanwezig: de vrijgekomen plaatsen gaan naar de kassa
    const aanwezig = Math.round(150 * loyaltyRate(Math.min(1, expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 }) / s.community.fanBase)));
    expect(aanwezig, 'niet elke abonnee komt').to.be.below(150);
    expect(r.kassa / 10, 'meer betalende bezoekers dan de plaatsen die overbleven als iedereen kwam').to.be.above(300 - 150);
    expect(r.opkomst, 'meer dan de tribune aankan kan niet').to.be.at.most(300);
  });

  it('laat een abonnee trouwer komen dan iemand die aan de kassa beslist', () => {
    for (const rate of [0.2, 0.44, 0.8]) {
      expect(loyaltyRate(rate), `bij een gewone opkomst van ${rate}`).to.be.above(rate);
      expect(loyaltyRate(rate)).to.be.at.most(0.95);
    }
  });

  it('kan de tribune nooit overvol maken', () => {
    const s = metAbonnees(700);
    s.infrastructure.capacity = 300;
    expect(thuismatch(s, 'zon').opkomst).to.be.at.most(300);
  });
});
