import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { acceptedMargin } from '../src/engine/canteen';
import { KRAAMPJES_MAX } from '../src/engine/data/catalog';
import { migrate } from '../src/storage/save';
import { readyGame, playWeeks } from './helpers';
import type { GameState } from '../src/engine/types';

describe('uitbreidbare kraampjesplaatsen', () => {
  it('prijst de plaats naar je opkomst: meer volk = duurder (en dus dezelfde terugverdientijd)', () => {
    const klein = readyGame();
    const groot = readyGame();
    groot.community.fanBase = klein.community.fanBase * 3;
    groot.infrastructure.capacity = 2000;
    expect(actions.kraampjesCost(klein)).to.be.greaterThan(0);
    expect(actions.kraampjesCost(groot)).to.be.greaterThan(actions.kraampjesCost(klein));
  });

  it('bouwt een plaats bij, tot het plafond van het complex', () => {
    let s = readyGame();
    s.cash = 500_000;
    expect(s.infrastructure.concessionSpace).to.equal(3);
    expect(actions.startUpgrade(s, 'kraampjes').ok).to.equal(true);
    s = playWeeks(s, actions.upgradeWeeks(s, 'kraampjes') + 1);
    expect(s.infrastructure.concessionSpace).to.equal(4);
    s.infrastructure.concessionSpace = KRAAMPJES_MAX;
    const vol = actions.startUpgrade(s, 'kraampjes');
    expect(vol.ok).to.equal(false);
    expect(vol.message).to.include('niet');
  });

  it('maakt plaats voor een vierde standhouder die er eerst niet bij kon', () => {
    let s = readyGame();
    s.cash = 500_000;
    // frituur (2) + hotdog (1) vullen de drie plaatsen van een nieuwe club
    expect(actions.openConcession(s, 'frituur', acceptedMargin(s, 'frituur')).ok).to.equal(true);
    expect(actions.openConcession(s, 'hotdog', acceptedMargin(s, 'hotdog')).ok).to.equal(true);
    const geenPlaats = actions.openConcession(s, 'hamburger', acceptedMargin(s, 'hamburger'));
    expect(geenPlaats.ok).to.equal(false);
    expect(geenPlaats.message).to.include('Infrastructuur'); // de fout wijst je de weg
    expect(actions.startUpgrade(s, 'kraampjes').ok).to.equal(true);
    s = playWeeks(s, actions.upgradeWeeks(s, 'kraampjes') + 1);
    expect(actions.openConcession(s, 'hamburger', acceptedMargin(s, 'hamburger')).ok).to.equal(true);
  });

  it('geeft een oud opslagbestand de oude drie plaatsen mee', () => {
    const s = readyGame();
    delete (s.infrastructure as Partial<GameState['infrastructure']>).concessionSpace;
    (s as { version: number }).version = 37;
    const na = migrate(JSON.parse(JSON.stringify(s)));
    expect(na.infrastructure.concessionSpace).to.equal(3);
  });
});
