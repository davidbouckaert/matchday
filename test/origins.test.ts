import { expect } from 'chai';
import type { Factor } from '../src/engine/factors';
import { biggestFactors, clearOrigins, factorEffect, recordOrigin, sortedOrigins } from '../src/engine/origins';
import { attendanceOrigin } from '../src/engine/finance';
import { MATCH_WEEKS } from '../src/engine/calendar';
import { advanceWeek } from '../src/engine/turn';
import { readyGame, playWeeks } from './helpers';

const x = (label: string, value: number, source = ''): Factor => ({ label, value, kind: 'x', source });

/** Speelt door tot er een thuiswedstrijd gespeeld is, en geeft die toestand terug. */
function playUntilHomeMatch(seed = 4) {
  let s = readyGame('zuidrand', 'aannemer', seed);
  for (let i = 0; i < 40; i++) {
    const before = s.week;
    s = advanceWeek(s);
    if (s.lastOrigins.some((o) => o.category === 'tickets')) return s;
    if (before > MATCH_WEEKS[MATCH_WEEKS.length - 1]) break;
  }
  return null;
}

describe('Wat een factor je opleverde', () => {
  it('rekent het verschil uit met een wereld zonder die factor', () => {
    // €1.000 met een factor van 1,25: zonder die factor was het €800, dus hij bracht €200 op
    expect(factorEffect(1000, x('Sfeer', 1.25))).to.equal(200);
    // een factor onder de 1 kost je geld
    expect(factorEffect(800, x('Regen', 0.8))).to.equal(-200);
  });

  it('geeft nul voor een factor die niets doet', () => {
    expect(factorEffect(1000, x('Niets', 1))).to.equal(0);
  });

  it('negeert optelfactoren', () => {
    expect(factorEffect(1000, { label: 'Bonus', value: 50, kind: '+', source: '' })).to.equal(0);
  });
});

describe('De herkomst vastleggen', () => {
  it('bewaart het bedrag, de factoren en het basisbedrag', () => {
    const s = readyGame();
    clearOrigins(s);
    recordOrigin(s, 'kantine', 'Test', 1200, [x('A', 1.2), x('B', 0.5)]);
    const o = s.lastOrigins[0];
    expect(o.category).to.equal('kantine');
    expect(o.amount).to.equal(1200);
    expect(o.base).to.equal(2000); // 1200 / (1,2 × 0,5)
    expect(o.factors.length).to.equal(2);
  });

  it('slaat bedragen van niets over', () => {
    const s = readyGame();
    clearOrigins(s);
    recordOrigin(s, 'kantine', 'Niets', 0, [x('A', 1.2)]);
    expect(s.lastOrigins.length).to.equal(0);
  });

  it('sorteert de posten op grootte', () => {
    const s = readyGame();
    clearOrigins(s);
    recordOrigin(s, 'kantine', 'Klein', 200, [x('A', 1.1)]);
    recordOrigin(s, 'tickets', 'Groot', 5000, [x('B', 1.1)]);
    recordOrigin(s, 'clubartikelen', 'Midden', -900, [x('C', 1.1)]);
    expect(sortedOrigins(s).map((o) => o.label)).to.deep.equal(['Groot', 'Midden', 'Klein']);
  });

  it('geeft de zwaarstwegende factoren eerst', () => {
    const s = readyGame();
    clearOrigins(s);
    recordOrigin(s, 'tickets', 'Test', 10_000, [x('Klein', 1.02), x('Groot', 1.5), x('Middel', 1.1)]);
    expect(biggestFactors(s.lastOrigins[0]).map((f) => f.label)).to.deep.equal(['Groot', 'Middel', 'Klein']);
  });

  it('laat factoren weg die niets uithaalden', () => {
    const s = readyGame();
    clearOrigins(s);
    recordOrigin(s, 'tickets', 'Test', 1000, [x('Niets', 1), x('Wel', 1.3)]);
    expect(biggestFactors(s.lastOrigins[0]).map((f) => f.label)).to.deep.equal(['Wel']);
  });
});

describe('De herkomst tijdens het spelen', () => {
  it('begint elke week met een schone lei', () => {
    const s = readyGame();
    const a = advanceWeek(s);
    const b = advanceWeek(a);
    expect(b.lastOrigins.every((o) => o.amount !== 0)).to.equal(true);
    // de posten van week a mogen niet blijven staan in week b
    expect(b.lastOrigins.length).to.be.at.most(a.lastOrigins.length + 3);
  });

  it('legt de kantine van een gewone week vast', () => {
    const s = advanceWeek(readyGame());
    const bar = s.lastOrigins.find((o) => o.category === 'kantine');
    expect(bar, 'geen kantinepost vastgelegd').to.not.equal(undefined);
    expect(bar!.amount).to.be.above(0);
    expect(bar!.factors.some((f) => f.label === 'Vrijwilligers')).to.equal(true);
    expect(bar!.factors.some((f) => f.label === 'Kantineniveau')).to.equal(true);
  });

  it('legt de ticketinkomsten van een thuiswedstrijd vast, met het weer erbij', () => {
    const s = playUntilHomeMatch();
    expect(s, 'geen thuiswedstrijd gevonden').to.not.equal(null);
    const tickets = s!.lastOrigins.find((o) => o.category === 'tickets')!;
    expect(tickets.amount).to.be.above(0);
    const labels = tickets.factors.map((f) => f.label);
    expect(labels).to.include('Weer');
    expect(labels).to.include('Sfeer');
    expect(labels).to.include('Ticketprijs');
  });

  it('legt ook de kantine van de wedstrijddag apart vast', () => {
    const s = playUntilHomeMatch();
    expect(s).to.not.equal(null);
    const matchday = s!.lastOrigins.filter((o) => o.category === 'kantine');
    expect(matchday.length, 'de wedstrijdkantine staat niet apart').to.be.at.least(2);
    expect(matchday.some((o) => /wedstrijddag/.test(o.label))).to.equal(true);
  });

  it('laat zien waarom een dure ticketprijs je opkomst kost', () => {
    const goedkoop = readyGame('zuidrand', 'aannemer', 4);
    const duur = readyGame('zuidrand', 'aannemer', 4);
    duur.ticketPrice = 25; // veel boven de normale prijs van de reeks
    const a = attendanceOrigin(goedkoop, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    const b = attendanceOrigin(duur, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    const price = (list: Factor[]) => list.find((f) => f.label === 'Ticketprijs')!.value;
    expect(price(b)).to.be.below(price(a));
  });

  it('zet de derby en het weer alleen in de lijst wanneer ze meespelen', () => {
    const s = readyGame();
    const plain = attendanceOrigin(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    const derby = attendanceOrigin(s, { weather: 'storm', derby: true, positionFactor: 1.15 });
    expect(plain.some((f) => f.label === 'Derby')).to.equal(false);
    expect(plain.some((f) => f.label === 'Klassement')).to.equal(false);
    expect(derby.some((f) => f.label === 'Derby')).to.equal(true);
    expect(derby.some((f) => f.label === 'Klassement')).to.equal(true);
    const weather = (list: Factor[]) => list.find((f) => f.label === 'Weer')!.value;
    expect(weather(derby)).to.be.below(weather(plain)); // storm houdt volk thuis
  });

  it('klopt met het bedrag dat echt geboekt werd', () => {
    const s = advanceWeek(readyGame());
    for (const o of s.lastOrigins) {
      const booked = s.lastWeek
        .filter((e) => e.category === o.category)
        .reduce((sum, e) => sum + e.amount, 0);
      // de post moet terug te vinden zijn in wat er die week geboekt is
      expect(Math.abs(booked), `${o.label}`).to.be.at.least(Math.abs(o.amount) - 1);
    }
  });

  it('overleeft een paar seizoenen zonder vol te lopen', () => {
    const s = playWeeks(readyGame('heidebeke', 'fonds', 6), 60);
    expect(s.lastOrigins.length).to.be.at.most(8);
  });
});

describe('Opslag met de herkomst', () => {
  it('geeft een bestand van versie 24 een lege lijst', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(readyGame())) as Record<string, unknown>;
    old.version = 24;
    delete old.lastOrigins;
    const fixed = migrate(old);
    expect(fixed.lastOrigins).to.deep.equal([]);
    expect(fixed.version).to.be.at.least(25);
  });
});
