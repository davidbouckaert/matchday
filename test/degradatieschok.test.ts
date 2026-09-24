// Degradatie beweegt de kleedkamer, en hoe hoger je valt, hoe harder.
//
// Na laag 18 was degradatie een doodvonnis: sponsorbedragen zakten naar de nieuwe reeks
// (−30 à −40% inkomsten) maar de lonen bleven op −10% hangen. "Bestaande staf" schoot
// daardoor van ~23% naar 60% faillissementen. Nu is de klap symmetrisch en progressief:
// wie uit 2de Nationale valt, houdt zijn groep grotendeels samen tegen een lager loon;
// wie uit de Pro Liga zakt, ziet een flink deel van zijn goedbetaalde spelers vertrekken.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { relegationShake } from '../src/engine/turn';
import { MIN_SQUAD, wageDemand } from '../src/engine/players';
import { createRng } from '../src/engine/rng';
import type { GameState } from '../src/engine/types';

function clubOpNiveau(level: number, seed = 42): GameState {
  const s = readyGame('heidebeke', 'aannemer', seed);
  s.league.divisionLevel = level;
  for (const p of s.players) {
    if (p.loan || (p.isYouth && p.age <= 19)) continue;
    p.wage = wageDemand(s, p); // iedereen verdient netjes de lat van dit niveau
  }
  return s;
}

describe('degradatieschok', () => {
  it('uit de top vallen beweegt meer spelers dan uit de lagere reeksen', () => {
    let uitDeTop = 0;
    let uitDeLaagte = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const top = clubOpNiveau(5, seed);
      const voorTop = top.players.length;
      relegationShake(top, 5, 4, createRng(top));
      uitDeTop += voorTop - top.players.length;

      const laag = clubOpNiveau(2, seed);
      const voorLaag = laag.players.length;
      relegationShake(laag, 2, 1, createRng(laag));
      uitDeLaagte += voorLaag - laag.players.length;
    }
    expect(uitDeTop).to.be.above(uitDeLaagte * 1.5);
    expect(uitDeLaagte / 10).to.be.below(1.5); // uit 2de Nationale vallen is geen leegloop: ~1 vertrekker
  });

  it('wie blijft, levert in richting de lat van de nieuwe reeks', () => {
    const s = clubOpNiveau(4);
    relegationShake(s, 4, 3, createRng(s));
    s.league.divisionLevel = 3;
    for (const p of s.players) {
      if (p.loan || (p.isYouth && p.age <= 19)) continue;
      expect(p.wage, p.name).to.be.at.most(wageDemand(s, p) * 1.2 + 5);
    }
  });

  it('de kern zakt nooit onder de ondergrens, en de jeugd blijft erbuiten', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = clubOpNiveau(5, seed);
      const jeugd = s.players.filter((p) => p.isYouth && p.age <= 19).map((p) => ({ id: p.id, wage: p.wage }));
      relegationShake(s, 5, 4, createRng(s));
      expect(s.players.filter((p) => p.loan?.type !== 'uit').length).to.be.at.least(MIN_SQUAD);
      for (const j of jeugd) {
        const nu = s.players.find((p) => p.id === j.id);
        expect(nu, 'een jeugdspeler hoort niet te vertrekken door een degradatie').to.not.equal(undefined);
        expect(nu!.wage).to.equal(j.wage);
      }
    }
  });
});
