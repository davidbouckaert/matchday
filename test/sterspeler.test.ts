import { expect } from 'chai';
import {
  STAR_KEEP_RATIO,
  STAR_RATIO,
  isStar,
  peerAverage,
  starPlayers,
  starPopularityFactor,
  starRatio,
  starShine,
  starSponsorFactor,
  weeklyStars,
} from '../src/engine/stars';
import { overall } from '../src/engine/players';
import { popularity } from '../src/engine/popularity';
import { sponsorFactors } from '../src/engine/factors';
import { migrate } from '../src/storage/save';
import { readyGame, playWeeks } from './helpers';
import type { GameState, Player } from '../src/engine/types';

/** Maakt van deze speler iemand die er duidelijk bovenuit steekt. */
function maakSter(s: GameState, p: Player): void {
  const doel = peerAverage(s, p) * 1.3;
  p.technique = Math.min(99, doel + 5);
  p.physical = Math.min(99, doel + 5);
}

/** Een kern zonder uitschieters. */
function vlakkeKern(seed = 1): GameState {
  const s = readyGame('zuidrand', 'aannemer', seed);
  for (const p of s.players) {
    p.technique = 50;
    p.physical = 50;
  }
  return s;
}

describe('Wie is een sterspeler', () => {
  it('meet hem tegen zijn positiegenoten, zichzelf niet meegeteld', () => {
    const s = vlakkeKern();
    const verdediger = s.players.find((p) => p.position === 'VERD')!;
    expect(peerAverage(s, verdediger)).to.be.closeTo(50, 0.5);
    expect(starRatio(s, verdediger)).to.be.closeTo(1, 0.02);
    expect(isStar(s, verdediger)).to.equal(false);
  });

  it('herkent het voorbeeld uit het echt: verdediging 55, hij 67', () => {
    const s = vlakkeKern();
    for (const p of s.players.filter((x) => x.position === 'VERD')) {
      p.technique = 55;
      p.physical = 55;
    }
    const held = s.players.find((p) => p.position === 'VERD')!;
    held.technique = 67;
    held.physical = 67;
    expect(overall(held)).to.equal(67);
    expect(isStar(s, held), '67 tegenover 55 is 22% erboven').to.equal(true);
  });

  it('maakt van de beste van een vlakke kern geen ster', () => {
    // dit is het verschil met "je beste speler": die heeft elke ploeg, ook de slechtste
    const s = vlakkeKern();
    const beste = s.players[0];
    beste.technique = 54;
    beste.physical = 54;
    expect(isStar(s, beste)).to.equal(false);
  });

  it('laat een uitgeleende speler niet meetellen', () => {
    const s = vlakkeKern();
    const p = s.players.find((x) => x.position === 'MIDD')!;
    maakSter(s, p);
    expect(isStar(s, p)).to.equal(true);
    p.loan = { type: 'uit', club: 'FC Elders', untilSeason: s.season, wageShare: 0.5 };
    expect(isStar(s, p), 'hij speelt hier niet, dus hij trekt hier geen volk').to.equal(false);
  });

  it('komt in een gewone kern ongeveer één keer voor', () => {
    // gemeten over veertig kernen: 1,02 per ploeg. Op 15% zouden het er twee zijn en
    // betekent het niets meer, op 25% kom je er bijna nooit een tegen
    let totaal = 0;
    const partijen = 12;
    for (let seed = 1; seed <= partijen; seed++) totaal += starPlayers(readyGame('zuidrand', 'aannemer', seed)).length;
    expect(totaal / partijen).to.be.within(0.4, 1.8);
  });

  it('gebruikt 20% als grens en 16% om het te blijven', () => {
    expect(STAR_RATIO).to.equal(1.2);
    expect(STAR_KEEP_RATIO).to.be.below(STAR_RATIO);
  });
});

describe('Wat een sterspeler oplevert', () => {
  it('trekt volk en maakt sponsorplaatsen meer waard', () => {
    const s = vlakkeKern();
    const publiekVoor = popularity(s).factor;
    const sponsorVoor = sponsorFactors(s).reduce((f, p) => f * p.value, 1);

    maakSter(s, s.players.find((p) => p.position === 'AANV')!);
    expect(starPlayers(s)).to.have.lengthOf(1);
    expect(popularity(s).factor).to.be.above(publiekVoor);
    expect(sponsorFactors(s).reduce((f, p) => f * p.value, 1)).to.be.above(sponsorVoor);
  });

  it('noemt hem bij naam in de lijst met wat je populariteit bepaalt', () => {
    const s = vlakkeKern();
    const held = s.players.find((p) => p.position === 'AANV')!;
    maakSter(s, held);
    const deel = popularity(s).parts.find((p) => p.label === 'Sterspeler');
    expect(deel, 'hij hoort als eigen factor in de lijst te staan').to.not.equal(undefined);
    expect(deel!.source).to.contain(held.name);
  });

  it('laat een tweede ster minder toevoegen dan de eerste', () => {
    // anders zou een kern vol uitschieters je publiek verdubbelen
    const s = vlakkeKern();
    maakSter(s, s.players.find((p) => p.position === 'AANV')!);
    const eerste = starShine(s);
    maakSter(s, s.players.find((p) => p.position === 'MIDD')!);
    const samen = starShine(s);
    expect(samen).to.be.above(eerste);
    expect(samen - eerste, 'de tweede telt hooguit half mee').to.be.below(eerste);
  });

  it('houdt het effect binnen de perken', () => {
    const s = vlakkeKern();
    for (const p of s.players.slice(0, 6)) maakSter(s, p);
    expect(starPopularityFactor(s)).to.be.at.most(1.25);
    expect(starSponsorFactor(s)).to.be.at.most(1.2);
  });

  it('is niets waard zonder sterspeler', () => {
    const s = vlakkeKern();
    expect(starShine(s)).to.equal(0);
    expect(starPopularityFactor(s)).to.equal(1);
    expect(starSponsorFactor(s)).to.equal(1);
  });
});

describe('Sterspelers in het nieuws', () => {
  it('meldt het zodra iemand uitgroeit tot sterspeler', () => {
    const s = vlakkeKern();
    weeklyStars(s); // beginstand: geen sterren
    expect(s.starIds).to.have.lengthOf(0);
    const held = s.players.find((p) => p.position === 'AANV')!;
    maakSter(s, held);
    const { nieuw } = weeklyStars(s);
    expect(nieuw.map((p) => p.name)).to.deep.equal([held.name]);
    expect(s.starIds).to.deep.equal([held.id]);
  });

  it('meldt het niet elke week opnieuw', () => {
    const s = vlakkeKern();
    maakSter(s, s.players.find((p) => p.position === 'AANV')!);
    weeklyStars(s);
    expect(weeklyStars(s).nieuw).to.have.lengthOf(0);
  });

  it('laat hem niet in en uit het nieuws wippen bij het minste schommeltje', () => {
    // met één vaste grens zou een speler die rond de 20% zweeft elke week nieuws zijn
    const s = vlakkeKern();
    const held = s.players.find((p) => p.position === 'AANV')!;
    held.technique = 60;
    held.physical = 60;
    expect(isStar(s, held)).to.equal(true);
    weeklyStars(s);
    held.technique = 59; // net onder de 20%, maar ruim boven de 16%
    held.physical = 59;
    expect(isStar(s, held)).to.equal(false);
    expect(weeklyStars(s).weg, 'hij blijft ster tot hij echt terugvalt').to.have.lengthOf(0);
  });

  it('meldt het wel als hij echt terugvalt', () => {
    const s = vlakkeKern();
    const held = s.players.find((p) => p.position === 'AANV')!;
    maakSter(s, held);
    weeklyStars(s);
    held.technique = 50;
    held.physical = 50;
    expect(weeklyStars(s).weg.map((w) => w.name)).to.deep.equal([held.name]);
  });

  it('schrijft het ook echt in het nieuws terwijl je speelt', () => {
    const s = readyGame('zuidrand', 'aannemer', 2);
    const na = playWeeks(s, 3);
    const bericht = na.news.find((n) => /sterspeler/i.test(n.text));
    expect(bericht, 'een kern met een uitschieter hoort er nieuws over te geven').to.not.equal(undefined);
  });

  it('laat ook andere clubs een sterspeler halen', () => {
    // dit hoort bij de levende wereld: niet alleen jij versterkt je ploeg.
    // Acht seeds in plaats van vier: het wisselsysteem (0.69.0) verbruikt extra
    // toevalsgetallen, en over vier vaste seeds viel dit kansevent toen net buiten de boot.
    let gevonden = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const na = playWeeks(readyGame('zuidrand', 'aannemer', seed), 54);
      if (na.news.some((n) => /haalde sterspeler/i.test(n.text)) || na.lastWorldMoves.some((m) => /sterspeler/i.test(m.text))) {
        gevonden = true;
        break;
      }
    }
    expect(gevonden, 'in vier seizoenen hoort er ergens een club een sterspeler te halen').to.equal(true);
  });
});

describe('Oude opslagbestanden met sterspelers', () => {
  it('krijgen een lege lijst, zodat hun huidige ster meteen in het nieuws komt', () => {
    const s = readyGame();
    const oud = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete oud.starIds;
    oud.version = 30;
    const na = migrate(oud);
    expect(na.starIds).to.deep.equal([]);
  });
});
