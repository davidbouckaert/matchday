import { expect } from 'chai';
import {
  LOAN_TALK_WEEK,
  buyLoanPlayer,
  extendLoan,
  extensionRef,
  loanIn,
  loanRequestBlock,
  loanRequestChance,
  loanStanding,
  purchaseRef,
} from '../src/engine/actions';
import { marketValue } from '../src/engine/players';
import { migrate } from '../src/storage/save';
import { readyGame, playWeeks } from './helpers';
import type { GameState, Player } from '../src/engine/types';

/** Een partij met één huurspeler in de kern, klaar om over te praten. */
function metHuurspeler(seed = 1, opts: { starts?: number; goals?: number; groei?: number } = {}): { s: GameState; p: Player } {
  const s = readyGame('zuidrand', 'aannemer', seed);
  const kandidaat = s.loanMarket[0];
  s.cash = 500_000;
  const result = loanIn(s, kandidaat.id); // huren kan alleen in de transferperiode, dus eerst
  expect(result.ok, result.message).to.equal(true);
  s.week = LOAN_TALK_WEEK + 1; // en dan doorspoelen naar de terugronde
  const p = s.players.find((x) => x.id === kandidaat.id)!;
  // hij heeft een half seizoen achter de rug
  const row = s.league.table.find((r) => r.teamId === 'club')!;
  row.played = 20;
  p.starts = opts.starts ?? 16;
  p.goals = opts.goals ?? 4;
  p.startQuality = p.startQuality - (opts.groei ?? 3);
  return { s, p };
}

describe('Een huurspeler houden', () => {
  it('kijkt naar hoeveel hij speelde, hoe hij groeide en of ze tevreden zijn', () => {
    const { s, p } = metHuurspeler();
    const stand = loanStanding(s, p);
    expect(stand.speeltijd).to.be.closeTo(0.8, 0.01);
    expect(stand.groei).to.be.at.least(3);
    expect(stand.tevreden).to.be.above(70);
  });

  it('vindt een bankzitter een mislukte uitleenbeurt', () => {
    const { s, p } = metHuurspeler(2, { starts: 2, goals: 0, groei: 0 });
    expect(loanStanding(s, p).tevreden).to.be.below(45);
  });

  it('laat je er pas in de terugronde over beginnen', () => {
    const { s, p } = metHuurspeler();
    s.week = 12;
    const blok = loanRequestBlock(s, p, 'verlengen');
    expect(blok).to.be.a('string');
    expect(extendLoan(s, p.id, 5_000).ok).to.equal(false);
  });

  it('vraagt meer voor een speler die het goed deed', () => {
    const goed = metHuurspeler(3, { starts: 18, goals: 9, groei: 5 });
    const mager = metHuurspeler(3, { starts: 2, goals: 0, groei: 0 });
    expect(extensionRef(goed.s, goed.p)).to.be.above(extensionRef(mager.s, mager.p));
    expect(purchaseRef(goed.s, goed.p)).to.be.above(purchaseRef(mager.s, mager.p));
  });

  it('vraagt voor kopen een toeslag boven zijn marktwaarde', () => {
    const { s, p } = metHuurspeler();
    expect(purchaseRef(s, p)).to.be.above(marketValue(p, s.marketIndex));
  });

  it('laat meer bieden altijd helpen', () => {
    const { s, p } = metHuurspeler();
    const ref = purchaseRef(s, p);
    expect(loanRequestChance(s, p, 'kopen', ref * 2)).to.be.above(loanRequestChance(s, p, 'kopen', ref));
    expect(loanRequestChance(s, p, 'kopen', 0)).to.be.below(0.1);
  });

  it('verlengt makkelijker als hij speelt, maar verkoopt dan juist moeilijker', () => {
    // dit is de spanning waar het om draait: speeltijd werkt de ene kant op en de andere kant af
    const speelt = metHuurspeler(4, { starts: 18, goals: 6, groei: 4 });
    const bank = metHuurspeler(4, { starts: 2, goals: 0, groei: 0 });
    // We bieden bij allebei hetzelfde deel van wat zij vragen (60%), zodat alleen de
    // prestaties het verschil maken en niet hoeveel die ene speler toevallig waard is.
    const deel = (v: { s: GameState; p: Player }, soort: 'verlengen' | 'kopen') =>
      loanRequestChance(v.s, v.p, soort, (soort === 'verlengen' ? extensionRef(v.s, v.p) : purchaseRef(v.s, v.p)) * 0.6);
    expect(deel(speelt, 'verlengen'), 'wie speelt, mag makkelijker blijven').to.be.above(deel(bank, 'verlengen'));
    expect(deel(speelt, 'kopen'), 'maar wie speelt, geven ze minder graag definitief af').to.be.below(deel(bank, 'kopen'));
  });

  it('zet je vraag op de lijst en geeft een week later antwoord', () => {
    const { s, p } = metHuurspeler();
    expect(extendLoan(s, p.id, extensionRef(s, p)).ok).to.equal(true);
    expect(s.requests.some((r) => r.kind === 'huur-verlengen' && r.targetId === p.id)).to.equal(true);
    const na = playWeeks(s, 1);
    expect(na.requests.some((r) => r.targetId === p.id), 'de vraag hoort beantwoord te zijn').to.equal(false);
  });

  it('laat je niet twee keer tegelijk vragen', () => {
    const { s, p } = metHuurspeler();
    extendLoan(s, p.id, extensionRef(s, p));
    expect(buyLoanPlayer(s, p.id, purchaseRef(s, p)).ok).to.equal(false);
  });

  it('weigert een bod dat je niet kunt betalen', () => {
    const { s, p } = metHuurspeler();
    s.cash = 100;
    const result = buyLoanPlayer(s, p.id, 50_000);
    expect(result.ok).to.equal(false);
    expect(result.message).to.contain('tekort');
  });

  it('maakt hem bij een geslaagd bod echt van jou', () => {
    // een ruim bod en een bankzitter: dan zeggen ze vrijwel zeker ja
    for (let seed = 1; seed <= 25; seed++) {
      const { s, p } = metHuurspeler(seed, { starts: 1, goals: 0, groei: 0 });
      s.cash = 2_000_000;
      buyLoanPlayer(s, p.id, purchaseRef(s, p) * 3);
      const na = playWeeks(s, 1);
      const gekocht = na.players.find((x) => x.id === p.id);
      if (gekocht && !gekocht.loan) {
        expect(gekocht.contractUntil).to.be.above(na.season);
        expect(gekocht.wage, 'hij gaat een echt loon verdienen').to.be.above(0);
        return;
      }
    }
    expect.fail('in vijfentwintig partijen lukte geen enkele aankoop, terwijl het bod driemaal de vraagprijs was');
  });

  it('laat een verlengde huurspeler niet op het einde van het seizoen vertrekken', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { s, p } = metHuurspeler(seed, { starts: 20, goals: 8, groei: 5 });
      s.cash = 2_000_000;
      extendLoan(s, p.id, extensionRef(s, p) * 3);
      const na = playWeeks(s, 1);
      const speler = na.players.find((x) => x.id === p.id);
      if (speler?.loan && speler.loan.untilSeason > na.season - 1 && speler.contractUntil > na.season) {
        const volgend = playWeeks(na, 52 - na.week + 2);
        expect(volgend.players.some((x) => x.id === p.id), 'hij hoort er volgend seizoen nog te zijn').to.equal(true);
        return;
      }
    }
    expect.fail('in vijfentwintig partijen lukte geen enkele verlenging');
  });

  it('komt er vier weken niet op terug als ze nee zeggen', () => {
    const { s, p } = metHuurspeler(7, { starts: 1, goals: 0, groei: 0 });
    buyLoanPlayer(s, p.id, 1); // een bod van één euro: dat wordt nee
    const na = playWeeks(s, 1);
    const speler = na.players.find((x) => x.id === p.id)!;
    expect(speler.loanTalks?.weeksLeft).to.equal(4);
    expect(loanRequestBlock(na, speler, 'kopen')).to.be.a('string');
  });
});

describe('Oude opslagbestanden met huurspelers', () => {
  it('krijgen voor elke speler een startkwaliteit, zodat zijn groei te meten valt', () => {
    const s = readyGame();
    const oud = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    for (const p of oud.players as Record<string, unknown>[]) delete p.startQuality;
    oud.version = 29;
    const na = migrate(oud);
    expect(na.players.every((p) => typeof p.startQuality === 'number')).to.equal(true);
    expect(na.players.every((p) => p.startQuality > 0)).to.equal(true);
  });
});
