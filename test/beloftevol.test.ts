// "Beloftevol": een label voor jonge spelers met veel ruimte tot hun potentieel, zodat je
// op de transfermarkt en in je kern in één oogopslag ziet wie het overwegen waard is,
// ook al staat zijn kwaliteit nu nog niet hoog. Het voorbeeld uit de aanvraag ("19j 45/65")
// is precies de grens: 19 jaar, 20 punten ruimte.

import { expect } from 'chai';
import { isPromising, PROMISING_GAP, PROMISING_MAX_AGE } from '../src/engine/players';
import type { Player } from '../src/engine/types';

function speler(overrides: Partial<Player>): Player {
  return {
    position: 'MIDD',
    technique: 45,
    physical: 45, // MIDD weegt techniek 0.65/fysiek 0.35, maar gelijke waarden geven overall = die waarde
    age: 19,
    potential: 65,
    ...overrides,
  } as Player;
}

describe('isPromising: het beloftevol-label', () => {
  it('herkent het voorbeeld uit de aanvraag: 19 jaar, 45 nu, 65 potentieel', () => {
    expect(isPromising(speler({}))).to.equal(true);
  });

  it('vraagt minstens 15 punten ruimte tussen kwaliteit en potentieel', () => {
    expect(isPromising(speler({ potential: 45 + PROMISING_GAP }))).to.equal(true);
    expect(isPromising(speler({ potential: 45 + PROMISING_GAP - 1 }))).to.equal(false);
  });

  it('is voorbij de twintigste verjaardag geen belofte meer, ook met veel potentieel', () => {
    expect(isPromising(speler({ age: PROMISING_MAX_AGE - 1 }))).to.equal(true);
    expect(isPromising(speler({ age: PROMISING_MAX_AGE }))).to.equal(false);
    expect(isPromising(speler({ age: PROMISING_MAX_AGE + 1 }))).to.equal(false);
  });

  it('een speler die al dicht bij zijn potentieel zit, is geen belofte', () => {
    expect(isPromising(speler({ potential: 50 }))).to.equal(false);
  });
});
