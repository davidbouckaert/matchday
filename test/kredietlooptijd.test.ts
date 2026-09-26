import { expect } from 'chai';
import { readyGame } from './helpers';
import { annuity, loanOffers, loanTermWeeks } from '../src/engine/loans';

describe('grote kredieten drukken geleidelijk meer op de weekbegroting', () => {
  // Geen sprong bij €250.000: meer totale schuld betekent stapsgewijs korter afbetalen.
  it('verkort tien jaar geleidelijk tot vijf jaar bij 250.000 en drie jaar bij een miljoen', () => {
    const s = readyGame(); s.loans = [];
    expect(loanTermWeeks(s, 250000, 520)).to.equal(260);
    expect(loanTermWeeks(s, 1000000, 520)).to.equal(156);
    let previous = 520;
    for (let amount = 1000; amount <= 1500000; amount += 1000) {
      const term = loanTermWeeks(s, amount, 520);
      expect(term).to.be.at.most(previous).and.at.least(156);
      expect(previous - term).to.be.at.most(3);
      previous = term;
    }
  });
  // De druk komt van de gezamenlijke schuld, niet van het aantal of het etiket.
  it('gebruikt bestaande schuld zodat kleine vervolgleningen de termijn niet terugzetten', () => {
    const s = readyGame(); s.loans = [];
    const full = loanTermWeeks(s, 750000, 520);
    s.loans = [{ id: 'l', label: 'Eerder krediet', principal: 500000, remaining: 500000, weeklyPayment: 1000, annualRate: .05, weeksLeft: 520 }];
    const before = structuredClone(s);
    expect(loanTermWeeks(s, 250000, 520)).to.equal(full);
    loanOffers(s);
    expect(s).to.deep.equal(before); // geen herprijzing van bestaande contracten
  });
  // Inflatie mag dezelfde investering niet vanzelf strenger maken.
  it('houdt rekening met inflatie en laat één- en driejaarskredieten hun korte termijn houden', () => {
    const s = readyGame(); s.loans = [];
    const term = loanTermWeeks(s, 250000, 520); s.inflation = 2;
    expect(loanTermWeeks(s, 500000, 520)).to.equal(term);
    expect(loanTermWeeks(s, 1000000, 52)).to.equal(52);
    expect(loanTermWeeks(s, 1000000, 156)).to.equal(156);
  });
  // Aanbod en afbetalingsberekening delen werkelijk de kortere termijn, niet alleen de copy.
  it('rekent de hogere weeklast werkelijk door in het aanbod', () => {
    const s = readyGame(); const offer = loanOffers(s).find((o) => o.key === 'lang')!;
    expect(offer.weeks).to.equal(loanTermWeeks(s, offer.principal, 520));
    expect(offer.weeklyPayment).to.be.closeTo(annuity(offer.principal, offer.annualRate, offer.weeks), 1);
    expect(offer.weeklyPayment).to.be.greaterThan(annuity(offer.principal, offer.annualRate, 520));
    expect(offer.weeklyPayment * offer.weeks).to.be.lessThan(annuity(offer.principal, offer.annualRate, 520) * 520);
  });
});
