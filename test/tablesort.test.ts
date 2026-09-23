import { expect } from 'chai';
import { keyOf, parseDutchNumber, sortRows } from '../src/ui/tablesort';

/**
 * Een tabel bouwen zonder browser.
 *
 * De sorteerfunctie raakt alleen `cells`, `dataset.v`, `textContent` en `querySelector`.
 * Dat namaken is minder werk dan een hele DOM optuigen, en het houdt de test snel.
 */
function cel(inhoud: { v?: string; text?: string; strong?: string }): HTMLTableCellElement {
  const text = inhoud.strong ? `${inhoud.strong}\n${inhoud.text ?? ''}` : (inhoud.text ?? '');
  return {
    dataset: inhoud.v === undefined ? {} : { v: inhoud.v },
    textContent: text,
    querySelector: (sel: string) => (sel === 'strong' && inhoud.strong ? { textContent: inhoud.strong } : null),
  } as unknown as HTMLTableCellElement;
}

function rij(...cellen: HTMLTableCellElement[]): HTMLTableRowElement {
  return { cells: cellen } as unknown as HTMLTableRowElement;
}

/** De gesorteerde kolom als leesbare lijst. */
function volgorde(rows: HTMLTableRowElement[], col: number): string[] {
  return rows.map((r) => r.cells[col].dataset.v ?? r.cells[col].textContent ?? '');
}

describe('Nederlandse getallen lezen', () => {
  it('leest een bedrag met duizendpunten', () => {
    expect(parseDutchNumber('€1.234')).to.equal(1234);
    expect(parseDutchNumber('€1.234.567')).to.equal(1234567);
  });

  it('leest een komma als decimaalteken', () => {
    expect(parseDutchNumber('3,5')).to.equal(3.5);
    expect(parseDutchNumber('€1.234,50')).to.equal(1234.5);
  });

  it('ziet een punt die géén duizendteken kan zijn als decimaalpunt', () => {
    // dit was de bug: 60.34 is zestig komma drie, niet zes miljard
    expect(parseDutchNumber('60.34210371')).to.equal(60.34210371);
    expect(parseDutchNumber('0.4')).to.equal(0.4);
  });

  it('leest een negatief getal en een getal met een eenheid erachter', () => {
    expect(parseDutchNumber('-€400')).to.equal(-400);
    expect(parseDutchNumber('12w')).to.equal(12);
    expect(parseDutchNumber('▼ -2,1')).to.equal(-2.1);
  });

  it('geeft niets terug bij een streepje of bij tekst', () => {
    expect(parseDutchNumber('–')).to.equal(null);
    expect(parseDutchNumber('∞')).to.equal(null);
    expect(parseDutchNumber('Bakkerij Van Maele')).to.equal(null);
  });
});

describe('De sorteerwaarde van een cel', () => {
  it('neemt data-v zoals het er staat, zonder opschoning', () => {
    expect(keyOf(cel({ v: '60.34210371' })).num).to.equal(60.34210371);
    expect(keyOf(cel({ v: '-0.4' })).num).to.equal(-0.4);
  });

  it('neemt bij tekst alleen de kop van de cel', () => {
    // in de spelerstabel staat achter de naam nog ★, "eigen jeugd" en zijn karakter
    const c = cel({ strong: 'Bram Debruyne', text: '★ eigen jeugd · lastpak · 2 wedstrijden geschorst' });
    expect(keyOf(c).text).to.equal('bram debruyne');
  });

  it('herkent een lege cel en een streepje als leeg', () => {
    expect(keyOf(cel({ text: '–' })).empty).to.equal(true);
    expect(keyOf(cel({ text: '' })).empty).to.equal(true);
    expect(keyOf(undefined).empty).to.equal(true);
  });
});

describe('Een kolom sorteren', () => {
  it('zet tevredenheid in de juiste volgorde', () => {
    // precies het geval dat stuk was: kommagetallen in data-v
    const rows = [59.7, 87.2, 60.34210371, 53.9, 66.0].map((v) => rij(cel({ v: String(v) })));
    const op = sortRows(rows, 0, 1).map((r) => Number(r.cells[0].dataset.v));
    expect(op).to.deep.equal([53.9, 59.7, 60.34210371, 66, 87.2]);
    const af = sortRows(rows, 0, -1).map((r) => Number(r.cells[0].dataset.v));
    expect(af).to.deep.equal([87.2, 66, 60.34210371, 59.7, 53.9]);
  });

  it('sorteert namen van a naar z', () => {
    const namen = ['Zonnepanelen Helios', 'Apotheek Declercq', 'bakkerij van maele', 'Élektro Baert'];
    const rows = namen.map((n) => rij(cel({ strong: n })));
    expect(volgorde(sortRows(rows, 0, 1), 0).map((t) => t.split('\n')[0])).to.deep.equal([
      'Apotheek Declercq',
      'bakkerij van maele',
      'Élektro Baert',
      'Zonnepanelen Helios',
    ]);
  });

  it('houdt één kolom bij één manier van vergelijken', () => {
    // een kolom met getallen én een streepje mag niet half op tekst gaan vergelijken:
    // dat is niet transitief en dan mag de browser er elke volgorde uit laten komen
    const rows = [rij(cel({ text: '9' })), rij(cel({ text: '–' })), rij(cel({ text: '10' })), rij(cel({ text: '2' }))];
    expect(volgorde(sortRows(rows, 0, 1), 0)).to.deep.equal(['2', '9', '10', '–']);
  });

  it('zet lege cellen altijd onderaan, ook omgekeerd', () => {
    const rows = [rij(cel({ text: '9' })), rij(cel({ text: '–' })), rij(cel({ text: '2' }))];
    expect(volgorde(sortRows(rows, 0, -1), 0)).to.deep.equal(['9', '2', '–']);
  });

  it('geeft twee keer sorteren hetzelfde resultaat', () => {
    const maak = () => [80, 80, 12, 45, 12, 99].map((v, i) => rij(cel({ v: String(v) }), cel({ text: `rij ${i}` })));
    const een = sortRows(maak(), 0, 1).map((r) => r.cells[1].textContent);
    const twee = sortRows(maak(), 0, 1).map((r) => r.cells[1].textContent);
    expect(een).to.deep.equal(twee);
  });

  it('houdt gelijke waarden in hun oorspronkelijke volgorde', () => {
    const rows = [
      rij(cel({ v: '50' }), cel({ text: 'eerste' })),
      rij(cel({ v: '50' }), cel({ text: 'tweede' })),
      rij(cel({ v: '50' }), cel({ text: 'derde' })),
    ];
    expect(sortRows(rows, 0, 1).map((r) => r.cells[1].textContent)).to.deep.equal(['eerste', 'tweede', 'derde']);
    expect(sortRows(rows, 0, -1).map((r) => r.cells[1].textContent)).to.deep.equal(['eerste', 'tweede', 'derde']);
  });

  it('sorteert bedragen met duizendpunten op hun waarde', () => {
    const rows = ['€900', '€1.200', '€85', '€12.000'].map((t) => rij(cel({ text: t })));
    expect(volgorde(sortRows(rows, 0, 1), 0)).to.deep.equal(['€85', '€900', '€1.200', '€12.000']);
  });
});
