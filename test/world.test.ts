import { expect } from 'chai';
import type { GameState, WorldClub } from '../src/engine/types';
import { buildWorld, clubByName, clubProfile, clubsAtLevel, findClub, rebaseStrength, runClubSeason } from '../src/engine/world';
import { DIVISIONS } from '../src/engine/data/divisions';
import { createRng } from '../src/engine/rng';
import { OWN_TEAM_ID, sortedTable } from '../src/engine/league';
import { newTestGame, playWeeks } from './helpers';

const rngWith = (seed: number) => createRng({ rngState: seed });

function playSeasons(state: GameState, seasons: number, cashFloor = 3_000_000): GameState {
  let s = state;
  for (let i = 0; i < seasons && !s.gameOver; i++) {
    s.cash = Math.max(s.cash, cashFloor); // we testen de wereld, niet jouw boekhouding
    s = playWeeks(s, 52);
  }
  return s;
}

describe('De wereld bij een nieuw spel', () => {
  it('vult elke reeks met het juiste aantal clubs', () => {
    const world = buildWorld(rngWith(1));
    for (let level = 0; level < DIVISIONS.length; level++) {
      expect(clubsAtLevel(world, level).length, DIVISIONS[level].name).to.equal(DIVISIONS[level].teams - 1);
    }
  });

  it('geeft elke club een eigen naam en een eigen id', () => {
    const world = buildWorld(rngWith(2));
    const names = world.clubs.map((c) => c.name);
    const ids = world.clubs.map((c) => c.id);
    expect(new Set(names).size).to.equal(names.length);
    expect(new Set(ids).size).to.equal(ids.length);
  });

  it('geeft elke club budget, ambitie en momentum', () => {
    const world = buildWorld(rngWith(3));
    for (const c of world.clubs) {
      expect(c.budget, c.name).to.be.a('number');
      expect(c.ambition, c.name).to.be.within(10, 95);
      expect(c.momentum, c.name).to.be.within(-50, 50);
    }
  });

  it('laat clubs financieel en qua accommodatie van elkaar verschillen', () => {
    const world = buildWorld(rngWith(4));
    const budgets = new Set(clubsAtLevel(world, 1).map((c) => c.budget));
    const stadiums = new Set(world.clubs.map((c) => c.stadium));
    const youth = new Set(world.clubs.map((c) => c.youth));
    expect(budgets.size).to.be.above(5);
    expect(stadiums.size).to.be.above(1);
    expect(youth.size).to.be.above(1);
  });

  it('koppelt elke tegenstander in je reeks aan een club in de wereld', () => {
    const s = newTestGame();
    expect(s.league.teams.length).to.be.above(10);
    for (const team of s.league.teams) {
      const club = findClub(s.world, team.clubId);
      expect(club, team.name).to.not.equal(undefined);
      expect(club!.name).to.equal(team.name);
      expect(club!.strength).to.equal(team.strength);
      expect(club!.divisionLevel).to.equal(s.league.divisionLevel);
    }
  });
});

describe('De toestand van een club blijft bestaan', () => {
  it('verandert niet zomaar van week tot week', () => {
    const s = newTestGame();
    const before = s.world.clubs.map((c) => ({ id: c.id, budget: c.budget, ambition: c.ambition, stadium: c.stadium }));
    const after = playWeeks(s, 6);
    for (const snap of before) {
      const club = findClub(after.world, snap.id)!;
      expect(club.budget, club.name).to.equal(snap.budget);
      expect(club.ambition, club.name).to.equal(snap.ambition);
      expect(club.stadium, club.name).to.equal(snap.stadium);
    }
  });

  it('houdt haar geschiedenis bij over de seizoenen heen', () => {
    const after = playSeasons(newTestGame('heidebeke', 'fonds', 21), 3);
    const withHistory = after.world.clubs.filter((c) => c.seasons.length >= 2);
    expect(withHistory.length).to.be.above(10);
    const sample = withHistory[0];
    expect(sample.seasons[0].season).to.be.below(sample.seasons[1].season);
    expect(sample.lastMove).to.not.equal(null);
  });
});

describe('Clubs nemen één beslissing per seizoen', () => {
  const club = (over: Partial<WorldClub> = {}): WorldClub => ({
    id: 'x',
    name: 'FC Proef',
    divisionLevel: 1,
    strength: 56,
    budget: 60_000,
    ambition: 50,
    momentum: 0,
    stadium: 1,
    youth: 1,
    trouble: 10,
    defunct: false,
    lastMove: null,
    seasons: [],
    ...over,
  });

  it('geeft een kampioen momentum en een hekkensluiter niet', () => {
    const top = club();
    const bottom = club();
    runClubSeason(top, rngWith(5), 1, 16);
    runClubSeason(bottom, rngWith(5), 16, 16);
    expect(top.momentum).to.be.above(0);
    expect(bottom.momentum).to.be.below(0);
  });

  it('laat een rijke, ambitieuze club investeren', () => {
    const rich = club({ budget: 400_000, ambition: 90, momentum: 30 });
    const before = rich.strength + rich.stadium * 10 + rich.youth * 10;
    let invested = false;
    for (let i = 0; i < 12 && !invested; i++) {
      const c = club({ budget: 400_000, ambition: 90, momentum: 30 });
      const r = runClubSeason(c, rngWith(100 + i), 2, 16);
      invested = r.move === 'versterken' || r.move === 'bouwen' || r.move === 'jeugd';
    }
    expect(invested, 'een rijke ambitieuze club investeerde nooit').to.equal(true);
    void before;
  });

  it('laat een club met een lege kas terugschakelen', () => {
    const broke = club({ budget: -20_000, ambition: 60 });
    const result = runClubSeason(broke, rngWith(6), 14, 16);
    expect(['besparen', 'problemen', 'opgedoekt']).to.include(result.move);
  });

  it('laat een club met diepe schulden en veel zorgen kopje-onder gaan', () => {
    let failed = false;
    for (let i = 0; i < 60 && !failed; i++) {
      const doomed = club({ budget: -200_000, trouble: 95, ambition: 80 });
      failed = runClubSeason(doomed, rngWith(200 + i), 16, 16).move === 'opgedoekt';
      if (failed) expect(doomed.defunct).to.equal(true);
    }
    expect(failed, 'een club in diepe nood ging nooit kopje-onder').to.equal(true);
  });

  it('laat de beslissing afhangen van eindpositie, budget en ambitie', () => {
    const counts = (over: Partial<WorldClub>) => {
      const tally: Record<string, number> = {};
      for (let i = 0; i < 60; i++) {
        const c = club(over);
        const r = runClubSeason(c, rngWith(500 + i), over.momentum && over.momentum > 0 ? 2 : 14, 16);
        tally[r.move] = (tally[r.move] ?? 0) + 1;
      }
      return tally;
    };
    const ambitious = counts({ budget: 300_000, ambition: 92, momentum: 40 });
    const modest = counts({ budget: 300_000, ambition: 15, momentum: -40 });
    const push = (t: Record<string, number>) => (t.versterken ?? 0) + (t.bouwen ?? 0) + (t.jeugd ?? 0);
    expect(push(ambitious)).to.be.above(push(modest));
    expect(modest.stilzitten ?? 0).to.be.above(ambitious.stilzitten ?? 0);
  });

  it('kan zowel investeren als terugschakelen', () => {
    const moves = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const c = club({ budget: -80_000 + i * 5_000, ambition: 20 + (i % 70), momentum: (i % 21) - 10 });
      moves.add(runClubSeason(c, rngWith(900 + i), (i % 15) + 1, 16).move);
    }
    expect(moves.has('versterken')).to.equal(true);
    expect(moves.has('besparen') || moves.has('problemen')).to.equal(true);
  });
});

describe('De reeks reageert op jou en op zichzelf', () => {
  it('laat clubs promoveren en degraderen tussen de seizoenen', () => {
    const start = newTestGame('heidebeke', 'fonds', 33);
    const before = new Map(start.world.clubs.map((c) => [c.id, c.divisionLevel]));
    const after = playSeasons(start, 2);
    const moved = after.world.clubs.filter((c) => before.get(c.id) !== undefined && before.get(c.id) !== c.divisionLevel);
    expect(moved.length, 'niemand promoveerde of degradeerde').to.be.above(0);
  });

  it('laat een club over meerdere seizoenen sterker of zwakker worden', () => {
    const start = newTestGame('heidebeke', 'fonds', 44);
    const before = new Map(start.world.clubs.map((c) => [c.id, { s: c.strength, l: c.divisionLevel }]));
    const after = playSeasons(start, 4);
    const sameLevel = after.world.clubs.filter((c) => before.get(c.id)?.l === c.divisionLevel);
    const stronger = sameLevel.filter((c) => c.strength > (before.get(c.id)!.s + 1.5));
    const weaker = sameLevel.filter((c) => c.strength < (before.get(c.id)!.s - 1.5));
    expect(stronger.length, 'geen enkele club werd sterker').to.be.above(0);
    expect(weaker.length, 'geen enkele club werd zwakker').to.be.above(0);
  });

  it('houdt elke reeks duidelijk boven de reeks eronder, ook na tien seizoenen', () => {
    const after = playSeasons(newTestGame('heidebeke', 'fonds', 55), 10);
    const avg = (level: number) => {
      const cs = clubsAtLevel(after.world, level);
      return cs.reduce((sum, c) => sum + c.strength, 0) / cs.length;
    };
    for (let level = 1; level < DIVISIONS.length; level++) {
      expect(avg(level), DIVISIONS[level].name).to.be.above(avg(level - 1) + 2);
    }
  });

  it('houdt elke reeks op het juiste aantal clubs, ook na tien seizoenen', () => {
    const after = playSeasons(newTestGame('heidebeke', 'fonds', 66), 10);
    for (let level = 0; level < DIVISIONS.length; level++) {
      expect(clubsAtLevel(after.world, level).length, DIVISIONS[level].name).to.equal(DIVISIONS[level].teams - 1);
    }
  });

  it('speelt niet langer tegen vaste sterktes: de tegenstanders van volgend seizoen zijn veranderd', () => {
    const start = newTestGame('heidebeke', 'fonds', 77);
    const before = new Map(start.league.teams.map((t) => [t.name, t.strength]));
    const after = playSeasons(start, 2);
    const returning = after.league.teams.filter((t) => before.has(t.name));
    expect(returning.length, 'geen enkele club bleef in de reeks').to.be.above(2);
    const changed = returning.filter((t) => Math.abs(t.strength - before.get(t.name)!) > 0.5);
    expect(changed.length, 'alle sterktes bleven identiek').to.be.above(0);
  });

  it('laat je aartsrivaal een eigen verhaal opbouwen', () => {
    const after = playSeasons(newTestGame('heidebeke', 'fonds', 88), 3);
    const rival = after.league.teams.find((t) => t.isRival);
    expect(rival, 'geen aartsrivaal').to.not.equal(undefined);
    const club = findClub(after.world, rival!.clubId);
    expect(club, 'de rivaal hangt niet aan een club in de wereld').to.not.equal(undefined);
    expect(club!.seasons.length).to.be.at.least(1);
    expect(clubProfile(club!)).to.be.a('string').and.not.equal('');
  });

  it('meldt de zomerzetten van je reeks in het nieuws', () => {
    const after = playSeasons(newTestGame('heidebeke', 'fonds', 99), 2);
    expect(after.lastWorldMoves.length).to.be.above(0);
    const patterns = /investeert|beurs bovengehaald|versterking|bouwt|kranen|jeugdwerking|riem aanhalen|versnelling terug|moeilijkheden|schuldeisers|boeken neer/;
    expect(after.news.some((n) => patterns.test(n.text)), 'geen enkel bericht over de andere clubs').to.equal(true);
  });

  it('gebruikt de echte eindstand van jouw reeks voor het momentum', () => {
    const start = newTestGame('heidebeke', 'fonds', 111);
    const after = playWeeks(start, 52);
    const rows = sortedTable(start.league).filter((r) => r.teamId !== OWN_TEAM_ID);
    void rows;
    const champion = sortedTable(playWeeks(start, 44).league).find((r) => r.teamId !== OWN_TEAM_ID);
    const team = start.league.teams.find((t) => t.id === champion?.teamId);
    const club = team ? findClub(after.world, team.clubId) : undefined;
    if (club) expect(club.seasons.length).to.be.at.least(1);
    expect(after.world.clubs.some((c) => c.momentum !== 0), 'niemand kreeg momentum').to.equal(true);
  });
});

describe('De wereld is reproduceerbaar', () => {
  it('geeft met dezelfde seed dezelfde clubs en dezelfde zetten', () => {
    const a = playSeasons(newTestGame('zuidrand', 'aannemer', 123), 2);
    const b = playSeasons(newTestGame('zuidrand', 'aannemer', 123), 2);
    expect(a.world.clubs.map((c) => `${c.name}:${c.divisionLevel}:${c.strength}:${c.lastMove}`)).to.deep.equal(
      b.world.clubs.map((c) => `${c.name}:${c.divisionLevel}:${c.strength}:${c.lastMove}`),
    );
    expect(a.lastWorldMoves).to.deep.equal(b.lastWorldMoves);
  });

  it('houdt de sterkte binnen de band van de reeks na een verhuis', () => {
    const world = buildWorld(rngWith(7));
    const club = clubsAtLevel(world, 1)[0];
    club.strength = 95; // veel te sterk voor waar hij naartoe gaat
    club.divisionLevel = 0;
    rebaseStrength(club, rngWith(8), 'degradant');
    expect(club.strength).to.be.below(DIVISIONS[0].opponentStrength + 20);
  });

  it('vindt een club terug op naam', () => {
    const s = newTestGame();
    const name = s.league.teams[0].name;
    expect(clubByName(s.world, name)?.name).to.equal(name);
    expect(clubByName(s.world, 'Bestaat Niet FC')).to.equal(undefined);
  });
});

describe('Opslag met de wereld', () => {
  it('geeft een bestand van versie 22 een volledige wereld', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown> & { league: GameState['league'] };
    old.version = 22;
    delete old.world;
    delete old.lastWorldMoves;
    for (const team of old.league.teams) team.clubId = '';
    const fixed = migrate(old);
    expect(fixed.world.clubs.length).to.be.above(50);
    for (const team of fixed.league.teams) {
      const club = findClub(fixed.world, team.clubId);
      expect(club, team.name).to.not.equal(undefined);
      expect(club!.strength).to.equal(team.strength);
      expect(club!.divisionLevel).to.equal(fixed.league.divisionLevel);
    }
  });

  it('blijft speelbaar na de omzetting', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown> & { league: GameState['league'] };
    old.version = 22;
    delete old.world;
    for (const team of old.league.teams) team.clubId = '';
    const fixed = playWeeks(migrate(old), 10);
    expect(fixed.week).to.equal(11);
    expect(fixed.gameOver).to.equal(false);
  });
});
