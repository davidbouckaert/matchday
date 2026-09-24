import { expect } from 'chai';
import { loanOut } from '../src/engine/actions';
import { overall } from '../src/engine/players';
import { readyGame, playWeeks } from './helpers';
import type { GameState, Player } from '../src/engine/types';

/** De jongste speler met de meeste groeimarge. */
function talent(s: GameState): Player {
  const p = [...s.players].filter((x) => x.age <= 22).sort((a, b) => b.potential - overall(b) - (a.potential - overall(a)))[0];
  expect(p, 'de testkern hoort een jonge speler te bevatten').to.not.equal(undefined);
  return p;
}

/** Een speler uitlenen. */
function uitgeleend(seed: number): { s: GameState; p: Player } {
  const s = readyGame('zuidrand', 'aannemer', seed);
  const p = talent(s);
  const result = loanOut(s, p.id);
  expect(result.ok, result.message).to.equal(true);
  return { s, p };
}

describe('Een uitgeleende speler speelt ergens echt', () => {
  it('komt terecht bij een club uit de wereld, niet bij een naam uit het niets', () => {
    const { s, p } = uitgeleend(1);
    expect(p.loan?.type).to.equal('uit');
    expect(p.loan?.clubId, 'de gastclub hoort een echte club te zijn').to.be.a('string').and.not.equal('');
    expect(s.world.clubs.some((c) => c.id === p.loan!.clubId && c.name === p.loan!.club)).to.equal(true);
  });

  it('onthoudt waar hij stond toen hij vertrok', () => {
    const { p } = uitgeleend(2);
    expect(p.loan?.quality).to.equal(overall(p));
    expect(p.loan?.matches).to.equal(0);
  });

  it('telt de wedstrijden die hij daar speelt', () => {
    const { s } = uitgeleend(3);
    const na = playWeeks(s, 20);
    const speler = na.players.find((x) => x.loan?.type === 'uit');
    expect(speler?.loan?.matches, 'na twintig weken hoort hij ergens gespeeld te hebben').to.be.above(4);
  });

});

describe('Wat een uitleenbeurt oplevert', () => {
  /** De groei van een uitgeleend talent over een seizoen, gemiddeld over een reeks partijen. */
  function groei(seeds: number[], uitlenen: boolean): number {
    let som = 0;
    let n = 0;
    for (const seed of seeds) {
      const s = readyGame('zuidrand', 'aannemer', seed);
      const p = talent(s);
      const voor = overall(p);
      if (uitlenen) expect(loanOut(s, p.id).ok).to.equal(true);
      else s.tactics.benched = [p.id];
      const na = playWeeks(s, 40);
      const speler = na.players.find((x) => x.id === p.id);
      if (!speler) continue;
      som += overall(speler) - voor;
      n++;
    }
    return som / Math.max(1, n);
  }

  it('maakt hem over een seizoen merkbaar beter', () => {
    // dit is waar het om gaat: een jong talent dat een seizoen elders speelt, komt terug
    // met iets extra. Hoeveel precies hoeft niemand uit te rekenen
    expect(groei([1, 2, 3, 4, 5, 6], true)).to.be.above(1.5);
  });

  it('levert hem meer op dan een seizoen op jouw bank', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    expect(groei(seeds, true)).to.be.above(groei(seeds, false));
  });

  it('vertelt bij zijn terugkeer wat het opleverde', () => {
    const { s } = uitgeleend(4);
    const na = playWeeks(s, 54); // over het seizoenseinde heen
    const bericht = na.news.find((n) => /terug van/i.test(n.text));
    expect(bericht, 'er hoort een bericht over zijn terugkeer te staan').to.not.equal(undefined);
    expect(bericht!.text).to.match(/wedstrijden|spelen/);
    expect(na.players.find((x) => x.loan?.type === 'uit'), 'zijn uitleenbeurt hoort afgelopen te zijn').to.equal(undefined);
  });
});
