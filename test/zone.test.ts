import { expect } from 'chai';
import { OWN_TEAM_ID, sortedTable, zoneAt } from '../src/engine/league';
import { DIVISIONS } from '../src/engine/data/divisions';
import { header } from '../src/ui/header';
import { readyGame, playWeeks } from './helpers';
import type { GameState } from '../src/engine/types';

const TOP = DIVISIONS.length - 1;

describe('De promotie- en degradatiezone', () => {
  const league = (teams: number) => ({ table: Array.from({ length: teams }, () => ({})) }) as never;

  it('noemt de eerste kampioen en de tweede promotie', () => {
    expect(zoneAt(league(16), 1, 1, DIVISIONS.length)).to.equal('kampioen');
    expect(zoneAt(league(16), 2, 1, DIVISIONS.length)).to.equal('promotie');
    expect(zoneAt(league(16), 3, 1, DIVISIONS.length)).to.equal('behoud');
  });

  it('rekent de laatste drie tot de degradatiezone', () => {
    for (const p of [14, 15, 16]) expect(zoneAt(league(16), p, 1, DIVISIONS.length), `plaats ${p}`).to.equal('degradatie');
    expect(zoneAt(league(16), 13, 1, DIVISIONS.length)).to.equal('behoud');
  });

  it('kent geen promotie meer in de hoogste reeks', () => {
    expect(zoneAt(league(16), 1, TOP, DIVISIONS.length)).to.equal('behoud');
    expect(zoneAt(league(16), 2, TOP, DIVISIONS.length)).to.equal('behoud');
  });

  it('kent geen degradatie in de laagste reeks', () => {
    expect(zoneAt(league(16), 16, 0, DIVISIONS.length)).to.equal('behoud');
  });

  it('schuift mee met een reeks van een andere grootte', () => {
    expect(zoneAt(league(12), 10, 1, DIVISIONS.length)).to.equal('degradatie');
    expect(zoneAt(league(12), 9, 1, DIVISIONS.length)).to.equal('behoud');
  });
});

describe('De kopbalk toont waar je staat', () => {
  /** Zet jouw club met de hand op een bepaalde plaats door de punten te herschikken. */
  function putAt(s: GameState, position: number): GameState {
    const others = s.league.table.filter((r) => r.teamId !== OWN_TEAM_ID);
    const ours = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)!;
    ours.points = 100 - position;
    others.forEach((r, i) => {
      r.points = i < position - 1 ? 100 - i : 100 - position - 1 - i;
    });
    return s;
  }

  it('zet je plaats en het aantal clubs in de kopbalk', () => {
    const s = playWeeks(readyGame(), 12);
    const plaats = sortedTable(s.league).findIndex((r) => r.teamId === OWN_TEAM_ID) + 1;
    const html = header(s);
    expect(html).to.contain('Klassement');
    expect(html).to.contain(`${plaats}e`);
    expect(html).to.contain(`/${s.league.table.length}`);
  });

  it('kleurt een promotieplaats en een degradatieplaats verschillend', () => {
    const boven = header(putAt(playWeeks(readyGame(), 12), 1));
    const onder = header(putAt(playWeeks(readyGame(), 12), 16));
    expect(boven).to.contain('zone-kampioen');
    expect(onder).to.contain('zone-degradatie');
  });

  it('toont ook week, speeldag en saldo', () => {
    const html = header(playWeeks(readyGame(), 12));
    for (const cap of ['Week', 'Speeldag', 'Klassement', 'Saldo']) expect(html, cap).to.contain(`>${cap}<`);
  });
});
