// De spiegel van de spelerswil: wie boven zijn club is uitgegroeid, wil weg.
//
// De doorlichting vond de "eeuwige kampioen": een club die elk jaar 3de Nationale wint,
// elk jaar de licentie geweigerd ziet, en wier sterren braaf blijven zitten. Nu niet meer:
// wie duidelijk boven het niveau van zijn club staat, verlengt niet (tegen geen enkel
// loon), trekt vaker biedingen aan en zakt in moraal zolang hij vastzit. Ook de reeks
// zelf reageert: rivalen van een club die bovenaan blijft hangen, verhogen hun ambitie.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { clubAppeal, wantsAway } from '../src/engine/appeal';
import { extendContract } from '../src/engine/actions';
import { runWorldSeason, clubsAtLevel } from '../src/engine/world';
import { createRng } from '../src/engine/rng';

describe('wil hogerop', () => {
  it('een uitgegroeide sterkhouder wil niet meer verlengen', () => {
    const s = readyGame('heidebeke');
    const p = s.players.find((x) => !x.loan && !x.isYouth && x.age >= 24)!;
    const boven = Math.round(clubAppeal(s) + 8);
    p.technique = boven;
    p.physical = boven;
    p.potential = boven;
    p.contractUntil = s.season; // loopt af: verlengen zou nu moeten kunnen
    p.morale = 70;
    expect(wantsAway(s, p)).to.equal(true);
    const result = extendContract(s, p.id);
    expect(result.ok).to.equal(false);
    expect(result.message).to.contain('hogere reeks');
  });

  it('wie op zijn niveau speelt, jong is of gehuurd wordt, blijft gewoon', () => {
    const s = readyGame('heidebeke');
    const p = s.players.find((x) => !x.loan && x.age >= 24)!;
    expect(wantsAway(s, p)).to.equal(false);
    const boven = Math.round(clubAppeal(s) + 8);
    const jonkie = { ...p, technique: boven, physical: boven, potential: boven, age: 19 };
    expect(wantsAway(s, jonkie)).to.equal(false);
    const huurling = { ...p, technique: boven, physical: boven, potential: boven, age: 24, loan: { type: 'in' as const, club: 'Testclub', untilSeason: s.season, wageShare: 1 } };
    expect(wantsAway(s, huurling)).to.equal(false);
  });
});

describe('de reeks vecht terug', () => {
  it('rivalen verhogen hun ambitie als jij bovenaan blijft hangen', () => {
    const s = readyGame('heidebeke');
    s.season = 2;
    s.nextDivisionLevel = s.league.divisionLevel;
    s.history.push({ season: 1, division: '3de Nationale', position: 1, points: 72, result: 'behoud', profit: 0, prize: 0 });
    const rivalen = clubsAtLevel(s.world, s.league.divisionLevel).map((c) => ({ id: c.id, ambitie: c.ambition }));
    runWorldSeason(s, createRng(s));
    for (const r of rivalen) {
      const club = s.world.clubs.find((c) => c.id === r.id)!;
      expect(club.ambition).to.equal(Math.min(95, r.ambitie + 10));
    }
  });

  it('wie in de middenmoot eindigt, verandert niets aan de ambitie van de reeks', () => {
    const s = readyGame('heidebeke');
    s.season = 2;
    s.nextDivisionLevel = s.league.divisionLevel;
    s.history.push({ season: 1, division: '3de Nationale', position: 8, points: 40, result: 'behoud', profit: 0, prize: 0 });
    const voor = new Map(s.world.clubs.map((c) => [c.id, c.ambition]));
    runWorldSeason(s, createRng(s));
    for (const club of s.world.clubs) expect(club.ambition).to.equal(voor.get(club.id));
  });
});
