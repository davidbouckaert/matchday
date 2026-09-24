import { expect } from 'chai';
import { PRINT_PRICE, shirtFame, shirtRanking, topShirtName } from '../src/engine/merch';
import { migrate } from '../src/storage/save';
import { readyGame, playWeeks } from './helpers';
import type { GameState } from '../src/engine/types';

/** Een club met een draaiende winkel waar het wedstrijdshirt in de rekken ligt. */
function metWinkel(seed = 7): GameState {
  const s = readyGame('zuidrand', 'aannemer', seed);
  s.cash = 500_000;
  s.community.fanBase = 900; // volk genoeg om elke week shirts te verkopen
  s.merch.active = true;
  s.merch.items.push({ id: 'shirt', price: 45, addedSeason: s.season, soldTotal: 0 });
  return s;
}

describe('shirts met spelersnamen', () => {
  it('laat een topschutter zwaarder wegen dan een bankzitter', () => {
    const s = readyGame();
    const [spits, bank] = s.players;
    spits.starts = 10;
    spits.goals = 8;
    bank.starts = 0;
    bank.goals = 0;
    expect(shirtFame(s, spits)).to.be.greaterThan(shirtFame(s, bank) * 3);
  });

  it('verkoopt niets van een uitgeleende speler', () => {
    const s = readyGame();
    const p = s.players[0];
    p.goals = 12;
    p.loan = { type: 'uit', club: 'SK Elders', untilSeason: s.season, wageShare: 0.5 };
    expect(shirtFame(s, p)).to.equal(0);
    expect(shirtRanking(s).some((x) => x.p.id === p.id)).to.equal(false);
  });

  it('drukt namen zodra er shirts verkopen, en boekt de meerprijs', () => {
    let s = metWinkel();
    const voor = s.cash;
    s = playWeeks(s, 8);
    const gedrukt = s.merch.shirtNames.reduce((sum, x) => sum + x.aantal, 0);
    expect(gedrukt).to.be.greaterThan(0);
    // de omzet van de bedrukking staat in de boeken (clubartikelen, samen met de shirts)
    expect(s.seasonTotals.clubartikelen ?? 0).to.be.greaterThan(gedrukt * PRINT_PRICE - 1);
    expect(s.cash).to.not.equal(voor); // er is echt geld bewogen
  });

  it('kroont wie het vaakst gedrukt wordt tot publiekslieveling', () => {
    let s = metWinkel();
    s = playWeeks(s, 10);
    const top = topShirtName(s);
    expect(top).to.not.equal(null);
    const alle = [...s.merch.shirtNames].sort((a, b) => b.aantal - a.aantal);
    expect(top!.id).to.equal(alle[0].id);
  });

  it('herbegint de ranglijst bij een nieuw seizoen', () => {
    let s = metWinkel();
    s = playWeeks(s, 10);
    expect(s.merch.shirtNames.length).to.be.greaterThan(0);
    while (s.season === 1 && !s.gameOver) s = playWeeks(s, 1);
    expect(s.merch.shirtNames.length).to.equal(0);
  });

  it('geeft een oud opslagbestand een lege ranglijst mee', () => {
    const s = readyGame();
    delete (s.merch as Partial<GameState['merch']>).shirtNames;
    delete (s.merch as Partial<GameState['merch']>).lastPrints;
    (s as { version: number }).version = 34;
    const na = migrate(JSON.parse(JSON.stringify(s)));
    expect(na.merch.shirtNames).to.deep.equal([]);
    expect(na.merch.lastPrints).to.deep.equal({ aantal: 0, omzet: 0 });
  });
});
