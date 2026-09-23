import { expect } from 'chai';
import { SCHEMES, contrast, ensureContrast, inkFor, inkForPair, luminance, schemeById, themeTokens, visibleOn } from '../src/ui/theme';

// De achtergronden waartegen de accentkleur moet werken, uit style.css.
const LIGHT = { surface: '#ffffff', ink: '#16201b' };
const DARK = { surface: '#19201c', ink: '#e8eeea' };

describe('Kleurenrekenwerk', () => {
  it('kent de uitersten', () => {
    expect(luminance('#000000')).to.equal(0);
    expect(luminance('#ffffff')).to.equal(1);
    expect(contrast('#000000', '#ffffff')).to.be.closeTo(21, 0.01);
    expect(contrast('#123456', '#123456')).to.equal(1);
  });

  it('kiest de leesbaarste tekstkleur op een achtergrond', () => {
    expect(inkFor('#ffffff')).to.equal('#111111');
    expect(inkFor('#000000')).to.equal('#ffffff');
    expect(inkFor('#f0c419'), 'op geel hoort zwarte tekst').to.equal('#111111');
    expect(inkFor('#1c4f8c'), 'op donkerblauw hoort witte tekst').to.equal('#ffffff');
  });

  it('trekt een kleur bij tot ze de drempel haalt', () => {
    // geel op wit is van zichzelf hopeloos
    expect(contrast('#f0c419', '#ffffff')).to.be.below(4.5);
    const fixed = ensureContrast('#f0c419', '#ffffff', 4.5);
    expect(contrast(fixed, '#ffffff')).to.be.at.least(4.5);
  });

  it('laat een kleur met rust die al genoeg contrast heeft', () => {
    const donker = '#14663d';
    expect(ensureContrast(donker, '#ffffff', 4.5)).to.equal(donker);
  });
});

describe('Elk kleurenschema blijft leesbaar', () => {
  for (const scheme of SCHEMES) {
    describe(scheme.naam, () => {
      for (const [naam, thema] of [
        ['licht', LIGHT],
        ['donker', DARK],
      ] as const) {
        it(`werkt in het ${naam} thema`, () => {
          const t = themeTokens(scheme.colors, thema.surface, thema.ink);

          expect(contrast(t.accent, thema.surface), `accentkleur ${t.accent} op de kaart`).to.be.at.least(4.5);
          expect(contrast(t.accent, t.accentInk), `tekst op een knop in ${t.accent}`).to.be.at.least(4.5);
          expect(contrast(t.accentSoft, thema.ink), `gewone tekst op het zachte vlak ${t.accentSoft}`).to.be.at.least(4.5);
          expect(contrast(t.accentSoft, thema.surface), 'het zachte vlak moet wel zichtbaar zijn').to.be.above(1.02);
        });
      }
    });
  }

  it('valt terug op het eerste schema bij een onbekend id', () => {
    expect(schemeById('bestaat-niet').id).to.equal(SCHEMES[0].id);
    expect(schemeById(undefined).id).to.equal(SCHEMES[0].id);
    expect(schemeById('geelzwart').naam).to.equal('Geel-zwart');
  });

  it('geeft elk schema een eigen id en naam', () => {
    expect(new Set(SCHEMES.map((s) => s.id)).size).to.equal(SCHEMES.length);
    expect(new Set(SCHEMES.map((s) => s.naam)).size).to.equal(SCHEMES.length);
  });
});

describe('Clubkleuren blijven zichtbaar als vorm', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme.naam}: beide kleuren blijven zichtbaar op een lichte en een donkere kaart`, () => {
      for (const thema of [LIGHT, DARK]) {
        for (const kleur of scheme.colors) {
          const veilig = visibleOn(kleur, thema.surface);
          expect(contrast(veilig, thema.surface), `${kleur} → ${veilig} op ${thema.surface}`).to.be.at.least(3);
        }
      }
    });
  }

  it('trekt wit bij op een witte kaart, want dat is de reden dat dit bestaat', () => {
    expect(contrast('#ffffff', '#ffffff')).to.equal(1);
    const veilig = visibleOn('#ffffff', '#ffffff');
    expect(veilig).to.not.equal('#ffffff');
    expect(contrast(veilig, '#ffffff')).to.be.at.least(3);
  });

  it('laat een kleur met rust die al genoeg afsteekt', () => {
    expect(visibleOn('#14663d', '#ffffff')).to.equal('#14663d');
  });
});

describe('De initialen op een clublogo', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme.naam}: op elke helft steekt de vulling of het randje af`, () => {
      const { fill, halo } = inkForPair(scheme.colors[0], scheme.colors[1]);
      // Eén tekstkleur haalt dit nooit op een combinatie als blauw-wit. Het randje wordt
      // rond de letter getekend, dus het volstaat dat op elke helft één van de twee
      // afsteekt: dan lees je de letter als vulling of als silhouet.
      for (const helft of scheme.colors) {
        const beste = Math.max(contrast(fill, helft), contrast(halo, helft));
        expect(beste, `vulling ${fill} en randje ${halo} verdwijnen allebei op ${helft}`).to.be.at.least(3);
      }
    });
  }

  it('kiest zwart op een licht paar en wit op een donker paar', () => {
    expect(inkForPair('#ffffff', '#f0c419').fill).to.equal('#111111');
    expect(inkForPair('#161616', '#1c4f8c').fill).to.equal('#ffffff');
  });
});
