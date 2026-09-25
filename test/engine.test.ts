import { expect } from 'chai';
import { createRng } from '../src/engine/rng';
import { advanceWeek } from '../src/engine/turn';
import { OWN_TEAM_ID } from '../src/engine/league';
import { annuity } from '../src/engine/loans';
import { overall, teamStrength } from '../src/engine/players';
import { clubRatings } from '../src/engine/ratings';
import { INVESTORS } from '../src/engine/data/setup';
import { migrate } from '../src/storage/save';
import { createNewGame, SAVE_VERSION } from '../src/engine/newGame';
import { newTestGame, playWeeks } from './helpers';

describe('Toevalsgenerator', () => {
  it('geeft met dezelfde seed dezelfde reeks', () => {
    const a = createRng({ rngState: 7 });
    const b = createRng({ rngState: 7 });
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).to.deep.equal(seqB);
  });

  it('blijft binnen de grenzen', () => {
    const r = createRng({ rngState: 1 });
    for (let i = 0; i < 1000; i++) {
      const n = r.int(3, 6);
      expect(n).to.be.at.least(3);
      expect(n).to.be.at.most(6);
    }
  });
});

describe('Nieuw spel', () => {
  it('maakt een volledige club aan', () => {
    const s = newTestGame();
    expect(s.players).to.have.lengthOf(22);
    expect(s.staff.some((x) => x.role === 'hoofdtrainer')).to.equal(true);
    expect(s.league.teams).to.have.lengthOf(15);
    expect(s.league.table).to.have.lengthOf(16);
    expect(s.transferList.length).to.be.above(0);
  });

  // Bug: het welkomstbericht en de seizoensopening noemden altijd de vooraf gedefinieerde
  // clubnaam, ook als de speler bij het opzetten zelf een andere naam had gekozen.
  it('gebruikt de zelfgekozen clubnaam in het welkomstbericht', () => {
    const s = createNewGame({
      avatar: { name: 'Test', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' },
      clubId: 'zuidrand',
      investor: 'aannemer',
      clubName: 'FC Testdorp',
      seed: 42,
    });
    expect(s.clubName).to.equal('FC Testdorp');
    expect(s.news.some((n) => n.text.includes('FC Testdorp'))).to.equal(true);
    expect(s.news.some((n) => n.text.includes('Zuidrand'))).to.equal(false);
    expect(s.opening?.summer.some((x) => x.includes('FC Testdorp'))).to.equal(true);
  });

  it('voegt het kapitaal van de investeerder toe', () => {
    const fonds = newTestGame('heidebeke', 'fonds');
    const coop = newTestGame('heidebeke', 'cooperatie');
    const diff = INVESTORS.find((i) => i.id === 'fonds')!.capital - INVESTORS.find((i) => i.id === 'cooperatie')!.capital;
    expect(fonds.cash - coop.cash).to.equal(diff);
  });

  it('plant 30 wedstrijden per club, 15 thuis en 15 uit', () => {
    const s = newTestGame();
    const ours = s.league.fixtures.filter((f) => f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID);
    expect(ours).to.have.lengthOf(30);
    expect(ours.filter((f) => f.homeId === OWN_TEAM_ID)).to.have.lengthOf(15);
    const weeks = new Set(ours.map((f) => f.week));
    expect(weeks.size).to.equal(30);
  });

  it('laat geen club meer dan 3 keer na elkaar thuis of uit spelen', () => {
    const s = newTestGame();
    for (const row of s.league.table) {
      const fx = s.league.fixtures.filter((f) => f.homeId === row.teamId || f.awayId === row.teamId).sort((a, b) => a.round - b.round);
      let streak = 0;
      let prev = '';
      for (const f of fx) {
        const side = f.homeId === row.teamId ? 'thuis' : 'uit';
        streak = side === prev ? streak + 1 : 1;
        prev = side;
        expect(streak).to.be.at.most(3);
      }
    }
  });

  it('is deterministisch met dezelfde seed', () => {
    const a = playWeeks(newTestGame('zuidrand', 'aannemer', 99), 20);
    const b = playWeeks(newTestGame('zuidrand', 'aannemer', 99), 20);
    expect(a.cash).to.equal(b.cash);
    expect(a.league.table).to.deep.equal(b.league.table);
  });
});

describe('Een beurt spelen', () => {
  it('verandert de oude toestand niet', () => {
    const before = newTestGame();
    const snapshot = JSON.stringify(before);
    const after = advanceWeek(before);
    expect(JSON.stringify(before)).to.equal(snapshot);
    expect(after.week).to.equal(2);
  });

  it('boekt lonen en sponsors elke week', () => {
    const s = advanceWeek(newTestGame());
    const categories = s.lastWeek.map((e) => e.category);
    expect(categories).to.include('lonen spelers');
    expect(categories).to.include('sponsors');
  });

  it('speelt een volledig seizoen en start een nieuw', () => {
    const s = playWeeks(newTestGame('heidebeke', 'fonds', 5), 52);
    expect(s.season).to.equal(2);
    expect(s.week).to.equal(1);
    expect(s.history).to.have.lengthOf(1);
    expect(s.history[0].position).to.be.within(1, 16);
  });

  it('speelt alle wedstrijden van een seizoen', () => {
    const s = playWeeks(newTestGame('heidebeke', 'fonds', 11), 44);
    expect(s.league.fixtures.every((f) => f.homeGoals !== undefined)).to.equal(true);
    const row = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)!;
    expect(row.played).to.equal(30);
  });
});

describe('Faillissement', () => {
  it('eindigt het spel na 8 weken onder nul', () => {
    let s = newTestGame();
    s.cash = -5_000_000;
    s = playWeeks(s, 7);
    expect(s.gameOver).to.equal(false);
    s = advanceWeek(s);
    expect(s.gameOver).to.equal(true);
  });

  it('biedt een noodlening aan in week 3 onder nul', () => {
    let s = newTestGame();
    s.cash = -5_000_000;
    s = playWeeks(s, 3);
    expect(s.emergencyLoanOffered).to.equal(true);
  });
});

describe('Leningen', () => {
  it('annuïteit lost de lening precies af', () => {
    const principal = 100_000;
    const rate = 0.05;
    const weeks = 156;
    const payment = annuity(principal, rate, weeks);
    let remaining = principal;
    for (let i = 0; i < weeks; i++) remaining = remaining * (1 + rate / 52) - payment;
    expect(Math.abs(remaining)).to.be.below(1);
  });
});

describe('Spelers en ratings', () => {
  it('berekent een logische teamsterkte', () => {
    const s = newTestGame();
    const strength = teamStrength(s);
    expect(strength.quality).to.be.within(40, 70);
    expect(s.players.every((p) => overall(p) > 0)).to.equal(true);
  });

  it('geeft drie ratings van 1 tot 5 sterren', () => {
    const ratings = clubRatings(newTestGame());
    expect(ratings.map((r) => r.key)).to.deep.equal(['sportief', 'financieel', 'gemeenschap']);
    for (const r of ratings) expect(r.stars).to.be.within(1, 5);
  });
});

describe('Opslaan', () => {
  it('overleeft een JSON-rondreis', () => {
    const s = playWeeks(newTestGame(), 10);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(advanceWeek(restored).cash).to.equal(advanceWeek(s).cash);
  });

  it('zet een opslag van versie 1 om naar de huidige versie', () => {
    const s = playWeeks(newTestGame(), 5) as unknown as Record<string, unknown>;
    const old = JSON.parse(JSON.stringify(s));
    old.version = 1;
    for (const k of ['pending', 'tactics', 'delegation', 'transferBudget', 'prospects', 'sponsorCampaignWeeks', 'youthFee', 'weekHistory']) delete old[k];
    for (const p of old.players) {
      delete p.fatigue;
      delete p.yellowCards;
      delete p.redCards;
      delete p.suspended;
    }
    delete old.eventCounts;
    delete old.loanMarket;
    delete old.periodMatches;
    delete old.eventLog;
    delete old.league.discipline;
    delete old.infrastructure.recoveryLevel;
    for (const t of old.league.teams) delete t.roster;
    old.community.volunteerEnergy = 80;
    delete old.community.volunteerLoyaltyWeeks;
    delete old.infrastructure.academyLevel;
    const migrated = migrate(old);
    expect(migrated.version).to.equal(SAVE_VERSION);
    expect(migrated.players.every((p) => p.fatigue === 0)).to.equal(true);
    expect(migrated.tactics.trainings).to.equal(3);
    expect(migrated.prospects.length).to.be.above(0);
    expect(playWeeks(migrated, 10).week).to.equal(16);
  });

  it('weigert een ongeldig bestand', () => {
    expect(() => migrate({ foo: 1 })).to.throw();
  });
});
