import { expect } from 'chai';
import { loanOut, loanHost } from '../src/engine/actions';
import { hostPlayShare, hostTrainer, overall } from '../src/engine/players';
import { createRng } from '../src/engine/rng';
import { readyGame, playWeeks } from './helpers';
import type { GameState, Player, WorldClub } from '../src/engine/types';

/** De jongste speler met de meeste groeimarge. */
function talent(s: GameState): Player {
  const p = [...s.players].filter((x) => x.age <= 22).sort((a, b) => b.potential - overall(b) - (a.potential - overall(a)))[0];
  expect(p, 'de testkern hoort een jonge speler te bevatten').to.not.equal(undefined);
  return p;
}

/** Een speler uitlenen en zijn gastclub een bepaald profiel geven. */
function uitgeleend(seed: number, profiel?: Partial<WorldClub>): { s: GameState; p: Player } {
  const s = readyGame('zuidrand', 'aannemer', seed);
  const p = talent(s);
  const result = loanOut(s, p.id);
  expect(result.ok, result.message).to.equal(true);
  if (profiel) {
    const club = s.world.clubs.find((c) => c.id === p.loan!.clubId);
    if (club) Object.assign(club, profiel);
  }
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

  it('zoekt een club waar hij in de ploeg past', () => {
    // te zwak en hij leert niets, te sterk en hij zit daar ook op de bank
    const s = readyGame('zuidrand', 'aannemer', 5);
    const p = talent(s);
    const club = loanHost(s, p, createRng(s));
    expect(Math.abs(club.strength - overall(p)), `${club.name} staat op ${club.strength}, hij op ${overall(p)}`).to.be.below(14);
  });

  it('telt de wedstrijden die hij daar speelt', () => {
    const { s } = uitgeleend(3);
    const na = playWeeks(s, 20);
    const speler = na.players.find((x) => x.loan?.type === 'uit');
    expect(speler?.loan?.matches, 'na twintig weken hoort hij ergens gespeeld te hebben').to.be.above(4);
  });

  it('laat hem vaker spelen bij een zwakkere club dan bij een sterkere', () => {
    const s = readyGame('zuidrand', 'aannemer', 6);
    const p = talent(s);
    const zwak = { strength: overall(p) - 8 } as WorldClub;
    const sterk = { strength: overall(p) + 12 } as WorldClub;
    expect(hostPlayShare(zwak, p)).to.be.above(hostPlayShare(sterk, p));
    expect(hostPlayShare(sterk, p), 'bij een veel te sterke club zit hij op de bank').to.be.below(0.5);
  });

  it('geeft een club met een betere werking meer waarde als leerschool', () => {
    const basis = { divisionLevel: 1, youth: 0 } as WorldClub;
    const beter = { divisionLevel: 1, youth: 3 } as WorldClub;
    const hoger = { divisionLevel: 4, youth: 0 } as WorldClub;
    expect(hostTrainer(beter)).to.be.above(hostTrainer(basis));
    expect(hostTrainer(hoger)).to.be.above(hostTrainer(basis));
  });
});

describe('Wat een uitleenbeurt oplevert', () => {
  /** De groei van een uitgeleend talent over een seizoen, gemiddeld over een reeks partijen. */
  function groei(profiel: Partial<WorldClub> | undefined, seeds: number[]): number {
    let som = 0;
    let n = 0;
    for (const seed of seeds) {
      const { s, p } = uitgeleend(seed, profiel);
      const voor = overall(p);
      const na = playWeeks(s, 40);
      const speler = na.players.find((x) => x.id === p.id);
      if (!speler) continue;
      som += overall(speler) - voor;
      n++;
    }
    return som / Math.max(1, n);
  }

  it('maakt hem over een seizoen merkbaar beter', () => {
    // dit is wat je als eigenaar verwacht: een jong talent dat een seizoen elders speelt,
    // komt terug met iets extra
    expect(groei(undefined, [1, 2, 3, 4, 5, 6])).to.be.above(1.5);
  });

  it('laat een verloren seizoen ook echt verloren zijn', () => {
    // bij een club die veel te sterk voor hem is en niets met jeugd doet, zit hij op de bank
    const verspild = groei({ youth: 0, divisionLevel: 0, strength: 80 }, [1, 2, 3, 4, 5, 6]);
    const zinvol = groei({ youth: 2, divisionLevel: 2, strength: 50 }, [1, 2, 3, 4, 5, 6]);
    expect(verspild).to.be.below(zinvol);
    expect(verspild, 'een seizoen op de bank levert vrijwel niets op').to.be.below(1);
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
