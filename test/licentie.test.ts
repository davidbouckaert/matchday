// De licentie heeft tanden: zonder licentie voor de hogere reeks gaat een promotie niet
// door, en bij degradatie zakken de sponsorbedragen mee naar de nieuwe reeks.
//
// De doorlichting van september 2026 mat dat een club seizoenen lang 1ste Nationale
// speelde met 500 plaatsen (boete: verwaarloosbaar), en dat een degradatieseizoen
// €981.000 winst draaide omdat elke sponsor op het oude niveau bleef doorbetalen.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { advanceWeek, licenceProblems } from '../src/engine/turn';
import { sponsorsAfterSeason, fairPrice } from '../src/engine/sponsors';
import { createRng } from '../src/engine/rng';
import { OWN_TEAM_ID } from '../src/engine/league';
import { DIVISIONS } from '../src/engine/data/divisions';
import type { GameState } from '../src/engine/types';

/** Zet de eindstand zo dat de club kampioen wordt, en spoel door naar het seizoenseinde. */
function kampioenTegenWeek44(s: GameState): GameState {
  s.week = 44;
  for (const r of s.league.table) {
    r.played = 30;
    r.points = r.teamId === OWN_TEAM_ID ? 75 : 40;
  }
  return advanceWeek(s);
}

describe('licentie met tanden', () => {
  it('somt op wat er ontbreekt voor een hogere reeks', () => {
    const s = readyGame('heidebeke'); // 500 plaatsen: te klein voor 2de Nationale (800)
    const problems = licenceProblems(s, 2);
    expect(problems.join(' ')).to.contain('plaatsen');
  });

  it('weigert de promotie van een kampioen zonder licentie', () => {
    const s = readyGame('heidebeke');
    expect(licenceProblems(s, 2).length).to.be.above(0);
    const na = kampioenTegenWeek44(s);
    expect(na.nextDivisionLevel).to.equal(1); // hij blijft in 3de Nationale
    expect(na.news.some((n) => n.text.includes('weigert je licentie'))).to.equal(true);
    // de eer en de premie blijven: hij wérd kampioen
    expect(na.news.some((n) => n.text.includes('KAMPIOEN'))).to.equal(true);
  });

  it('laat de promotie door zodra de accommodatie in orde is', () => {
    const s = readyGame('heidebeke');
    s.infrastructure.capacity = 900;
    s.infrastructure.lightingLevel = 2;
    // de rest van de licentie (trainer, afgevaardigde) heeft heidebeke al
    expect(licenceProblems(s, 2)).to.deep.equal([]);
    const na = kampioenTegenWeek44(s);
    expect(na.nextDivisionLevel).to.equal(2);
  });

  it('waarschuwt in de loop van het seizoen wie op een promotieplaats staat', () => {
    const s = readyGame('heidebeke');
    s.week = 30;
    for (const r of s.league.table) {
      r.played = 15;
      r.points = r.teamId === OWN_TEAM_ID ? 40 : 20;
    }
    const na = advanceWeek(s);
    expect(na.news.some((n) => n.text.includes('zonder licentie'))).to.equal(true);
  });
});

describe('degradatie laat sponsors mee zakken', () => {
  it('bedragen boven het prijspeil van de nieuwe reeks worden herzien', () => {
    const s = readyGame('heidebeke');
    const deal = s.sponsors.find((d) => d.kind === 'hoofdsponsor')!;
    deal.weekly = 2_000; // een bedrag van een hogere reeks
    sponsorsAfterSeason(s, createRng(s), 'degradatie', 0);
    s.league.divisionLevel = 0;
    expect(deal.weekly).to.be.at.most(fairPrice(s, 'hoofdsponsor') * 1.1 + 5);
  });

  it('wie voor meerdere seizoenen tekende, betaalt gewoon door', () => {
    const s = readyGame('heidebeke');
    const deal = s.sponsors.find((d) => d.kind === 'hoofdsponsor')!;
    deal.weekly = 2_000;
    deal.lockedSeasons = 3;
    deal.weeksLeft = 120;
    sponsorsAfterSeason(s, createRng(s), 'degradatie', 0);
    expect(deal.weekly).to.equal(2_000);
  });

  it('de reeksen van het spel staan hier los van: niets aan de tabel veranderd', () => {
    // regressiecontrole: sponsorsAfterSeason zet divisionLevel tijdelijk om en hoort hem terug te zetten
    const s = readyGame('heidebeke');
    const level = s.league.divisionLevel;
    sponsorsAfterSeason(s, createRng(s), 'degradatie', 0);
    expect(s.league.divisionLevel).to.equal(level);
    expect(DIVISIONS[s.league.divisionLevel].name).to.equal('3de Nationale');
  });
});
