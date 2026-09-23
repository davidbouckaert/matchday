import { expect } from 'chai';
import { numField } from '../src/ui/numfield';

/** Het aantal tekens waar het veld ruimte voor vraagt, via het size-attribuut. */
function chars(html: string): number {
  const m = html.match(/size="(\d+)"/);
  expect(m, 'het veld hoort een size mee te geven').to.not.equal(null);
  return Number(m![1]);
}

describe('Het getalveld maakt zich breed genoeg', () => {
  it('telt de cijfers van het maximum, niet die van de huidige waarde', () => {
    // dit was de bug: een lidgeld van €230 in een veld dat tot €800 loopt werd "23("
    const veld = numField({ value: 230, min: 0, max: 800, step: 10, prefix: '€', label: 'Lidgeld' });
    expect(chars(veld)).to.be.at.least('800'.length);
  });

  it('houdt rekening met duizendpunten', () => {
    const veld = numField({ value: 1000, min: 0, max: 50000, step: 500, prefix: '€', label: 'Budget' });
    // 50.000 telt zes tekens inclusief het duizendpunt
    expect(chars(veld)).to.be.at.least('50.000'.length);
  });

  it('houdt rekening met de komma en de decimalen', () => {
    const veld = numField({ value: 2.5, min: 1, max: 8, step: 0.1, decimals: 2, prefix: '€', label: 'Prijs pils' });
    expect(chars(veld)).to.be.at.least('8,00'.length);
  });

  it('zet het voor- en achtervoegsel naast het veld, niet erin', () => {
    const veld = numField({ value: 40, min: 0, max: 100, suffix: '%', label: 'Aandeel' });
    expect(chars(veld), 'size telt alleen het getal').to.equal('100'.length);
    expect(veld, 'het procentteken staat als eigen element ernaast').to.contain('class="affix post"');
  });

  it('schat een bovengrens als er geen maximum is opgegeven', () => {
    const zonder = numField({ value: 50000, min: 0, step: 1000, prefix: '€', label: 'Transferbudget' });
    expect(chars(zonder), 'een bedrag van vijf cijfers moet kunnen groeien').to.be.at.least(6);
  });

  it('blijft ook bij een piepklein veld leesbaar', () => {
    expect(chars(numField({ value: 0, min: 0, max: 3, label: 'Aantal' }))).to.be.at.least(2);
  });
});
