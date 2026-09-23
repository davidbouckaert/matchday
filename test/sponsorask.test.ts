import { expect } from 'chai';
import { createRng } from '../src/engine/rng';
import {
  askFactor,
  askPrice,
  askVerdict,
  bestAskRatio,
  fairPrice,
  prospectChance,
  renewSponsor,
  resetSponsorAsk,
  sponsorPull,
  setSponsorAsk,
  weeklySponsors,
} from '../src/engine/sponsors';
import { migrate } from '../src/storage/save';
import { readyGame } from './helpers';
import type { GameState, SponsorProspect } from '../src/engine/types';

/** Een contact dat zeker in aanmerking komt voor een reclamebord. */
function bordContact(s: GameState, interest = 80): SponsorProspect {
  const p: SponsorProspect = {
    id: 'pr-test',
    name: 'Testbedrijf',
    sector: 'Lokale handel',
    maxKind: 'bord',
    interest,
    cooldown: 0,
    approached: false,
  };
  s.prospects = [p];
  return p;
}

/** Hoe vaak een benaderd contact ja zegt, over veel partijen. */
function tekenkans(fee: number | null, pogingen = 120): number {
  let ja = 0;
  for (let seed = 1; seed <= pogingen; seed++) {
    const s = readyGame('zuidrand', 'aannemer', seed);
    if (fee === null) resetSponsorAsk(s, 'bord');
    else setSponsorAsk(s, 'bord', fee);
    const p = bordContact(s);
    p.approached = true;
    const voor = s.sponsorOffers.length;
    weeklySponsors(s, createRng(s));
    if (s.sponsorOffers.length > voor) ja++;
  }
  return ja / pogingen;
}

describe('Je zet zelf de prijs van een sponsorplaats', () => {
  it('vraagt zonder dat je iets doet gewoon de gangbare prijs', () => {
    // wie het scherm nooit opent, mag niets merken van deze hele laag
    const s = readyGame();
    expect(s.sponsorAsk).to.deep.equal({});
    expect(askPrice(s, 'bord')).to.equal(fairPrice(s, 'bord'));
    expect(askFactor(s, 'bord'), 'de gangbare prijs verandert je kansen niet').to.be.closeTo(1, 0.05);
    expect(askVerdict(s, 'bord').woord).to.be.oneOf(['gangbaar', 'scherp']);
  });

  it('onthoudt je bedrag en zet het terug op gangbaar als je dat vraagt', () => {
    const s = readyGame();
    const gangbaar = fairPrice(s, 'bord');
    expect(setSponsorAsk(s, 'bord', 80).ok).to.equal(true);
    expect(askPrice(s, 'bord')).to.equal(80);
    expect(resetSponsorAsk(s, 'bord').ok).to.equal(true);
    expect(askPrice(s, 'bord')).to.equal(gangbaar);
  });

  it('raakt alleen de plaats die je aanpast', () => {
    const s = readyGame();
    const shirt = askPrice(s, 'shirt');
    setSponsorAsk(s, 'bord', 200);
    expect(askPrice(s, 'shirt')).to.equal(shirt);
  });

  it('laat de stadionnaam met rust: die hoort bij je investeerder', () => {
    const s = readyGame();
    const result = setSponsorAsk(s, 'stadion', 900);
    expect(result.ok).to.equal(false);
    expect(result.message).to.contain('investeerder');
  });

  it('weigert een bedrag dat geen bedrag is', () => {
    const s = readyGame();
    expect(setSponsorAsk(s, 'bord', -50).ok).to.equal(false);
    expect(setSponsorAsk(s, 'bord', Number.NaN).ok).to.equal(false);
  });
});

describe('Je prijs beslist mee wie ja zegt', () => {
  it('helpt je kansen als je goedkoper bent en schaadt ze als je duurder bent', () => {
    const s = readyGame();
    const gangbaar = fairPrice(s, 'bord');
    setSponsorAsk(s, 'bord', Math.round(gangbaar / 2));
    const goedkoop = askFactor(s, 'bord');
    setSponsorAsk(s, 'bord', gangbaar * 2);
    const duur = askFactor(s, 'bord');
    const absurd = (setSponsorAsk(s, 'bord', gangbaar * 6), askFactor(s, 'bord'));
    expect(goedkoop).to.be.above(1);
    expect(duur).to.be.below(0.6);
    expect(absurd, 'een absurde prijs laat vrijwel niemand over').to.be.below(0.05);
  });

  it('gaat steeds sneller bergaf naarmate je verder boven de markt gaat', () => {
    // een rechte lijn maakte de hele keuze zinloos: kans maal prijs was dan altijd precies
    // op het gangbare bedrag het hoogst, voor elke club
    const s = readyGame();
    const gangbaar = fairPrice(s, 'bord');
    const bij = (x: number) => (setSponsorAsk(s, 'bord', Math.round(gangbaar * x)), askFactor(s, 'bord'));
    const stap1 = bij(1) - bij(1.3);
    const stap2 = bij(1.3) - bij(1.6);
    expect(stap2, 'de tweede stap van 30% hoort minder te kosten dan de eerste').to.be.below(stap1);
  });

  it('zegt in woorden wat de bedrijven ervan vinden', () => {
    const s = readyGame();
    const gangbaar = fairPrice(s, 'bord');
    setSponsorAsk(s, 'bord', Math.round(gangbaar * 0.5));
    expect(askVerdict(s, 'bord').woord).to.equal('te goedkoop');
    setSponsorAsk(s, 'bord', Math.round(gangbaar * bestAskRatio(s)));
    expect(askVerdict(s, 'bord').woord, 'precies op de beste prijs').to.equal('goed gemikt');
    setSponsorAsk(s, 'bord', Math.round(gangbaar * bestAskRatio(s) * 3));
    expect(askVerdict(s, 'bord').toon).to.equal('bad');
  });

  it('laat een lage prijs vaker tekenen dan een hoge', () => {
    // dít is waar het om draait: de prijs op het scherm stuurt echt wat er gebeurt
    const gangbaar = fairPrice(readyGame(), 'bord');
    const goedkoop = tekenkans(Math.round(gangbaar * 0.5));
    const normaal = tekenkans(null);
    const duur = tekenkans(Math.round(gangbaar * 1.8));
    const absurd = tekenkans(Math.round(gangbaar * 5));
    expect(goedkoop).to.be.above(normaal);
    expect(normaal).to.be.above(duur);
    expect(duur).to.be.above(absurd);
    // gemeten: 62% als je de markt volgt, 35% op 1,8x, 6% op 5x. Er blijft altijd een
    // enthousiasteling over, maar van een prijskaart op vijf keer de markt leeft geen club
    expect(absurd, 'vijf keer het gangbare bedrag levert bijna niets meer op').to.be.below(0.1);
  });

  it('boekt een getekend contract aan jouw prijs, niet aan die van de sponsor', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = readyGame('zuidrand', 'aannemer', seed);
      setSponsorAsk(s, 'bord', 95);
      const p = bordContact(s, 95);
      p.approached = true;
      weeklySponsors(s, createRng(s));
      const nieuw = s.sponsorOffers.find((o) => o.name === 'Testbedrijf');
      if (nieuw) {
        expect(nieuw.weekly, `seed ${seed}`).to.equal(95);
        return;
      }
    }
    expect.fail('in zestig partijen tekende er niemand, terwijl de prijs gangbaar was');
  });

  it('toont op het scherm exact de kans die het spel zelf gebruikt', () => {
    const s = readyGame();
    const p = bordContact(s, 70);
    const { kans, kind } = prospectChance(s, p);
    expect(kind).to.equal('bord');

    setSponsorAsk(s, 'bord', fairPrice(s, 'bord') * 2);
    expect(prospectChance(s, p).kans, 'duurder vragen hoort de kans te doen zakken').to.be.below(kans);

    // gemeten tegen de werkelijkheid: bij deze kans hoort dit aantal handtekeningen
    resetSponsorAsk(s, 'bord');
    const verwacht = prospectChance(s, p).kans;
    let ja = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = readyGame('zuidrand', 'aannemer', seed);
      const q = bordContact(g, 70);
      q.approached = true;
      const voor = g.sponsorOffers.length;
      weeklySponsors(g, createRng(g));
      if (g.sponsorOffers.length > voor) ja++;
    }
    expect(ja / 200, `het scherm belooft ${Math.round(verwacht * 100)}%`).to.be.closeTo(verwacht, 0.12);
  });

  it('geeft geen kans als er geen vrije plaats in hun klasse is', () => {
    const s = readyGame();
    const p = bordContact(s);
    // alle bordplaatsen vol
    const bord = s.sponsors.find((d) => d.kind === 'bord');
    if (bord) for (let i = s.sponsors.filter((d) => d.kind === 'bord').length; i < 16; i++) s.sponsors.push({ ...bord, id: `sp-vul-${i}` });
    const { kans, kind } = prospectChance(s, p);
    expect(kind).to.equal(null);
    expect(kans).to.equal(0);
  });
});

/** Een club waar bedrijven graag bij horen. */
function sterkeClub(): GameState {
  const s = readyGame('zuidrand');
  s.community.reputation = 95;
  s.community.fanMood = 90;
  s.league.divisionLevel = 4;
  const co = s.staffMarket.find((x) => x.role === 'commercieel');
  if (co) {
    co.skill = 90;
    s.staff.push({ ...co });
  }
  return s;
}

/** Een club waar niemand over praat. */
function zwakkeClub(): GameState {
  const s = readyGame('zuidrand');
  s.community.reputation = 15;
  s.community.fanMood = 25;
  s.staff = s.staff.filter((x) => x.role !== 'commercieel');
  s.avatar.background = 'exspeler';
  return s;
}

describe('Een club met een naam kan meer vragen', () => {
  it('geeft een betere club meer trekkracht, binnen grenzen', () => {
    expect(sponsorPull(sterkeClub())).to.be.above(sponsorPull(readyGame('zuidrand')));
    expect(sponsorPull(readyGame('zuidrand'))).to.be.above(sponsorPull(zwakkeClub()));
    expect(sponsorPull(sterkeClub())).to.be.at.most(1.6);
    expect(sponsorPull(zwakkeClub())).to.be.at.least(0.7);
  });

  it('verliest bij dezelfde verhoging minder bedrijven als de club sterker staat', () => {
    // net als bij het lidgeld: de helling zelf verandert, niet alleen het niveau
    const bijHelft = (s: GameState) => {
      setSponsorAsk(s, 'bord', Math.round(fairPrice(s, 'bord') * 1.5));
      return askFactor(s, 'bord');
    };
    expect(bijHelft(sterkeClub())).to.be.above(bijHelft(zwakkeClub()));
  });

  it('laat een zwakke club niets extra vragen en een sterke club de helft meer', () => {
    expect(bestAskRatio(zwakkeClub()), 'zonder naam is het gangbare bedrag het beste').to.equal(1);
    expect(bestAskRatio(sterkeClub())).to.be.above(1.5);
  });

  it('maakt het uiterste nooit de beste keuze, ook niet voor een topclub', () => {
    // dit was de fout die bij het lidgeld boven kwam: blijven verhogen bleef lonen
    for (const s of [zwakkeClub(), readyGame('zuidrand'), sterkeClub()]) {
      const fair = fairPrice(s, 'bord');
      let beste = { ratio: 0, waarde: 0 };
      for (let r = 0.4; r <= 5.001; r += 0.05) {
        setSponsorAsk(s, 'bord', Math.round(fair * r));
        const waarde = askFactor(s, 'bord') * r;
        if (waarde > beste.waarde) beste = { ratio: r, waarde };
      }
      expect(beste.ratio, `beste prijs ${beste.ratio.toFixed(2)}x het gangbare bedrag`).to.be.below(2.5);
    }
  });
});

describe('Je prijskaart geldt ook voor wie al sponsor is', () => {
  it('verlengt een tevreden sponsor aan jouw nieuwe prijs', () => {
    const s = readyGame();
    const d = s.sponsors.find((x) => x.kind === 'bord')!;
    d.weeksLeft = 20;
    d.satisfaction = 80;
    setSponsorAsk(s, 'bord', Math.round(d.weekly * 1.1));
    const result = renewSponsor(s, d.id);
    expect(result.ok).to.equal(true);
    expect(d.weekly).to.equal(Math.round(askPrice(s, 'bord')));
  });

  it('laat een sponsor afhaken als je de prijs plots verdubbelt', () => {
    const s = readyGame();
    const d = s.sponsors.find((x) => x.kind === 'bord')!;
    d.weeksLeft = 20;
    d.satisfaction = 80;
    const oud = d.weekly;
    setSponsorAsk(s, 'bord', d.weekly * 2);
    const result = renewSponsor(s, d.id);
    expect(result.ok).to.equal(false);
    expect(d.weekly, 'het lopende contract blijft gewoon doorlopen').to.equal(oud);
  });
});

describe('Oude opslagbestanden', () => {
  it('krijgen een lege prijskaart en volgen dus de gangbare prijs', () => {
    const s = readyGame();
    const oud = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete oud.sponsorAsk;
    oud.version = 28;
    const na = migrate(oud);
    expect(na.sponsorAsk).to.deep.equal({});
    expect(askPrice(na, 'bord')).to.equal(fairPrice(na, 'bord'));
  });
});
