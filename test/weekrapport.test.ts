// Het weekrapport bouwt spanning op in plaats van ze te verklappen.
//
// Bovenaan het rapport stond een rij kaartjes met het resultaat en de uitslag — de hele
// week samengevat vóór de rollende cijfers en het scorebord ook maar iets konden
// vertellen. Die zijn weg. En de animatie vooraf is een tijdlijn geworden: elk doelpunt
// van beide kanten verschijnt op het moment in de wedstrijd waarop het viel, en pas
// daarna klinkt het affluiten met de uitslag.

import { expect } from 'chai';
import { readyGame, playWeeks } from './helpers';
import { animationOverlay, reportOverlay } from '../src/ui/screens/report';
import { advanceWeek } from '../src/engine/turn';
import type { GameState, MatchReport } from '../src/engine/types';

/** Speel door tot een week met een wedstrijd mét doelpunten aan beide kanten. */
function totDoelpuntrijkeMatch(seed = 11): { s: GameState; m: MatchReport; prev: { week: number; season: number } } {
  let s = readyGame('heidebeke', 'aannemer', seed);
  for (let i = 0; i < 40; i++) {
    const prev = { week: s.week, season: s.season };
    s = advanceWeek(s);
    const m = s.lastMatch;
    if (m && m.week === prev.week && !m.forfeit && m.goalsFor > 0 && m.goalsAgainst > 0) return { s, m, prev };
  }
  throw new Error('geen wedstrijd met doelpunten aan beide kanten gevonden');
}

describe('de wedstrijd als tijdlijn', () => {
  it('elk doelpunt van beide kanten staat erin, in wedstrijdvolgorde, en de laatste tussenstand is de uitslag', () => {
    const { m } = totDoelpuntrijkeMatch();
    const moments = m.moments!;
    expect(moments).to.have.length(m.goalsFor + m.goalsAgainst);
    expect(moments.filter((g) => g.us)).to.have.length(m.goalsFor);
    for (let i = 1; i < moments.length; i++) expect(moments[i].minute).to.be.above(moments[i - 1].minute);
    const hg = m.home ? m.goalsFor : m.goalsAgainst;
    const ag = m.home ? m.goalsAgainst : m.goalsFor;
    expect(moments[moments.length - 1].score).to.equal(`${hg}-${ag}`);
  });

  it('de animatie toont de tijdlijn met aftrap en affluiten, elk moment op zijn eigen tel', () => {
    const { s, m, prev } = totDoelpuntrijkeMatch();
    const html = animationOverlay(s, prev);
    expect(html).to.contain('match-ticker');
    expect(html).to.contain('Aftrap');
    const hg = m.home ? m.goalsFor : m.goalsAgainst;
    const ag = m.home ? m.goalsAgainst : m.goalsFor;
    expect(html).to.contain(`Affluiten: ${hg} - ${ag}`);
    // een vroeg doelpunt komt vroeger in beeld dan een laat doelpunt
    const delays = [...html.matchAll(/animation-delay:([\d.]+)s/g)].map((x) => Number(x[1]));
    const oplopend = [...delays].sort((a, b) => a - b);
    expect(delays).to.deep.equal(oplopend);
  });

  it('dezelfde week opnieuw spelen geeft exact dezelfde tijdlijn', () => {
    let s = readyGame('heidebeke', 'aannemer', 11);
    s = playWeeks(s, 6);
    const a = advanceWeek(s);
    const b = advanceWeek(s);
    expect(a.lastMatch?.moments).to.deep.equal(b.lastMatch?.moments);
    expect(a.cash).to.equal(b.cash);
  });
});

describe('het rapport zonder spoilers', () => {
  it('de kaartjes met resultaat en uitslag staan er niet meer boven', () => {
    const { s, prev } = totDoelpuntrijkeMatch();
    const html = reportOverlay(s, prev);
    expect(html).to.not.contain('report-chips');
    expect(html).to.not.contain('>Resultaat<');
    // de uitslag staat er maar op één plek: het scorebord
    expect(html).to.contain('scoreboard');
  });
});
