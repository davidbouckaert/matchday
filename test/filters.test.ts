// Klikken om te filteren: een functie op Personeel filtert de kandidaten, een tegel-kop
// op Sponsors filtert je sponsors en je contacten. Actief = accent met een bolletje, en
// bij de lijst staat een chip met een kruisje; nog eens klikken haalt de filter ook weg
// (dat togglen zit in main.ts, hier testen we wat de schermen met de filter doen).

import { expect } from 'chai';
import { readyGame } from './helpers';
import { staffScreen } from '../src/ui/screens/staff';
import { sponsorsScreen } from '../src/ui/screens/sponsors';
import { prospectChance } from '../src/engine/sponsors';

describe('filteren door aan te klikken', () => {
  it('een functie aanklikken filtert de kandidatenlijst tot die rol', () => {
    const s = readyGame('heidebeke');
    const rol = s.staffMarket[0].role;
    const html = staffScreen(s, null, rol);
    const verwacht = s.staffMarket.filter((c) => c.role === rol).length;
    const rijen = (html.match(/data-action="hire/g) ?? []).length + (html.match(/🔒 op slot/g) ?? []).length;
    expect(rijen).to.be.at.least(verwacht);
    // alle andere rollen zijn uit de kandidatenlijst verdwenen
    for (const c of s.staffMarket) {
      if (c.role === rol) continue;
      expect(html.split('Kandidaten')[1]).to.not.contain(esc(c.name));
    }
    expect(html, 'de chip met het kruisje staat bij de gefilterde lijst').to.contain('✕');
    expect(html).to.contain(`${verwacht} van ${s.staffMarket.length}`);
  });

  it('zonder filter zie je de beste kandidaat per functie, zonder kruisje', () => {
    const s = readyGame('heidebeke');
    const html = staffScreen(s, null);
    const rollen = [...new Set(s.staffMarket.map((c) => c.role))];
    for (const rol of rollen) {
      const beste = s.staffMarket.filter((c) => c.role === rol).sort((a, b) => b.skill - a.skill)[0];
      expect(html, rol).to.contain(beste.name);
    }
    expect(html).to.not.contain('✕');
  });

  it('een sponsortegel aanklikken filtert sponsors én contacten op die plaats', () => {
    const s = readyGame('heidebeke');
    const html = sponsorsScreen(s, 'bord');
    const borden = s.sponsors.filter((d) => d.kind === 'bord').length;
    expect(html).to.contain(`${borden} van ${s.sponsors.length}`);
    // geen hoofdsponsor in de gefilterde sponsortabel
    const hoofdsponsor = s.sponsors.find((d) => d.kind === 'hoofdsponsor')!;
    expect(html.split('Huidige sponsors')[1]).to.not.contain(hoofdsponsor.name);
    // contacten: alleen wie echt op een bord zou tekenen
    const past = s.prospects.filter((p) => prospectChance(s, p).kind === 'bord').length;
    expect(html).to.contain(`${past} van ${s.prospects.length}`);
    expect(html).to.contain('✕');
  });
});

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
