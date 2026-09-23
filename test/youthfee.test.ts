import { expect } from 'chai';
import { maxYouthFee, youthFeeRef, youthForecast, youthPriceFactor, youthTarget } from '../src/engine/actions';
import { DIVISIONS } from '../src/engine/data/divisions';
import { readyGame, playWeeks } from './helpers';
import type { GameState } from '../src/engine/types';

/** De opbrengst bij elke prijs die de schuifbalk toelaat, in stappen van €10. */
function curve(s: GameState, of: (fee: number) => number): { fee: number; value: number }[] {
  const out: { fee: number; value: number }[] = [];
  for (let fee = 0; fee <= maxYouthFee(s); fee += 10) out.push({ fee, value: of(fee) * fee });
  return out;
}

/** De prijs die het meeste opbrengt. */
function bestePrijs(punten: { fee: number; value: number }[]): { fee: number; value: number } {
  return punten.reduce((a, b) => (b.value > a.value ? b : a));
}

describe('Het lidgeld heeft een top in plaats van een vluchtstrook', () => {
  it('laat de opbrengst dalen zodra je ver boven het gangbare bedrag zit', () => {
    const s = readyGame();
    const punten = curve(s, (fee) => youthTarget(s, fee));
    const top = punten.reduce((a, b) => (b.value > a.value ? b : a));
    const uiterste = punten[punten.length - 1];

    expect(top.fee, 'de top hoort niet aan het uiterste van de schuifbalk te liggen').to.be.below(maxYouthFee(s) * 0.8);
    expect(uiterste.value, 'het maximum vragen hoort duidelijk minder op te brengen dan de top').to.be.below(top.value * 0.6);
  });

  it('maakt het uiterste van de schuifbalk nooit de beste keuze', () => {
    // dit was precies de klacht: je kon blijven verhogen en het bleef beter worden, tot je
    // aan het maximum stond met een handvol leden en de hoogste opbrengst van de hele reeks
    for (const level of [0, 1, 3, DIVISIONS.length - 1]) {
      for (const leden of [40, 210, 500]) {
        const s = readyGame();
        s.league.divisionLevel = level;
        s.community.youthMembers = leden;
        for (const soort of ['op termijn', 'volgend seizoen'] as const) {
          const punten = curve(s, (fee) => (soort === 'op termijn' ? youthTarget(s, fee) : youthForecast(s, fee)));
          const beste = bestePrijs(punten);
          expect(
            beste.fee,
            `${DIVISIONS[level].name}, ${leden} leden, ${soort}: de beste prijs is €${beste.fee} van een maximum van €${maxYouthFee(s)}`,
          ).to.be.below(maxYouthFee(s) * 0.8);
        }
      }
    }
  });

  it('wordt alleen maar slechter naarmate je verder boven de top gaat', () => {
    const s = readyGame();
    const punten = curve(s, (fee) => youthTarget(s, fee));
    const top = punten.reduce((a, b) => (b.value > a.value ? b : a));
    const erna = punten.filter((p) => p.fee > top.fee + 100);
    // in stappen van €100 mag er geen enkele stijging meer in zitten
    for (let i = 10; i < erna.length; i += 10) {
      expect(erna[i].value, `€${erna[i].fee} tegenover €${erna[i - 10].fee}`).to.be.below(erna[i - 10].value);
    }
  });

  it('houdt ook je bestaande leden niet eeuwig vast', () => {
    // de tweede laag van dezelfde fout: wie vorig jaar lid was, bleef elke prijs betalen
    const s = readyGame();
    s.community.youthMembers = 400;
    const duur = maxYouthFee(s);
    expect(youthForecast(s, duur), 'bij een absurde prijs blijft er bijna niemand').to.be.below(60);
    expect(youthForecast(s, duur) * duur).to.be.below(youthForecast(s, youthFeeRef(s)) * youthFeeRef(s));
  });

  it('geeft meer leden naarmate je goedkoper bent, maar niet eindeloos', () => {
    const s = readyGame();
    expect(youthTarget(s, 100)).to.be.above(youthTarget(s, 400));
    expect(youthPriceFactor(0), 'gratis levert hooguit 1,8 keer zoveel leden op').to.be.at.most(1.8);
    expect(youthPriceFactor(1_000_000), 'een absurde prijs laat vrijwel niemand over').to.be.below(0.01);
  });

  it('laat het gangbare bedrag meegroeien met de reeks', () => {
    const laag = readyGame();
    laag.league.divisionLevel = 0;
    const hoog = readyGame();
    hoog.league.divisionLevel = DIVISIONS.length - 1;
    expect(youthFeeRef(hoog)).to.be.above(youthFeeRef(laag));
    expect(maxYouthFee(hoog), 'een profclub mag meer vragen dan de oude grens van €800').to.be.above(800);
  });

  it('geeft niet elk seizoen precies hetzelfde aantal inschrijvingen', () => {
    // zonder toeval kon je de tabel aflezen en perfect optimaliseren
    const aantallen = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = playWeeks(readyGame('zuidrand', 'aannemer', seed), 10);
      aantallen.add(s.community.youthMembers);
    }
    expect(aantallen.size, 'zes partijen horen niet allemaal op hetzelfde getal uit te komen').to.be.above(1);
  });

  it('blijft binnen wat de prognose beloofde', () => {
    // het toeval mag de schatting niet onherkenbaar maken
    for (const seed of [11, 12, 13, 14]) {
      const start = readyGame('zuidrand', 'aannemer', seed);
      const verwacht = youthForecast(start);
      const na = playWeeks(start, 10);
      expect(na.community.youthMembers, `seed ${seed}`).to.be.within(verwacht * 0.75, verwacht * 1.3);
    }
  });
});
