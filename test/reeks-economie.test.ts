// Wat een reeks hoger spelen kost.
//
// De aanleiding: over zes seizoenen gemeten steeg de omzet van een club die alles uitbesteedde
// zes keer, en haar kosten twee keer. Elke promotie was dus gratis geld. De oorzaak zat niet in
// het personeel maar in de cijfers van de reeksen zelf: sponsorbedragen, tv-geld en publiek
// stonden allemaal op de inkomstenkant geïndexeerd op je niveau, en op de kostenkant stond
// niets. Deze tests houden die twee kanten aan elkaar vast.

import { expect } from 'chai';
import { DIVISIONS } from '../src/engine/data/divisions';
import { wageDemand } from '../src/engine/players';
import { bookWeeklyFlows } from '../src/engine/finance';
import { newTestGame } from './helpers';
import type { GameState } from '../src/engine/types';

function opNiveau(level: number): GameState {
  const s = newTestGame();
  s.league.divisionLevel = level;
  return s;
}

describe('Een reeks hoger spelen kost ook meer', () => {
  it('indexeert elke reeks op zowel de inkomsten- als de kostenkant', () => {
    // Geen enkele reeks mag haar inkomsten opkrikken zonder dat er een rekening tegenover staat.
    for (const d of DIVISIONS) {
      expect(d.wageFactor, `${d.name} heeft geen loonlat`).to.be.a('number').and.be.greaterThan(0);
      expect(d.weeklyCost, `${d.name} heeft geen competitiekosten`).to.be.a('number').and.be.greaterThan(0);
    }
  });

  it('laat de loonlat en de competitiekosten mee stijgen met de reeks', () => {
    for (let i = 1; i < DIVISIONS.length; i++) {
      const hoger = DIVISIONS[i];
      const lager = DIVISIONS[i - 1];
      expect(hoger.wageFactor, `${hoger.name} vraagt niet meer dan ${lager.name}`).to.be.greaterThan(lager.wageFactor);
      expect(hoger.weeklyCost, `${hoger.name} kost niet meer dan ${lager.name}`).to.be.greaterThan(lager.weeklyCost);
    }
  });

  it('houdt 3de Nationale op de oude lat, zodat een nieuwe carrière niets verandert', () => {
    // De startreeks is de ijking: daar is de factor één en betaal je wat je altijd betaalde.
    expect(DIVISIONS[1].name).to.equal('3de Nationale');
    expect(DIVISIONS[1].wageFactor).to.equal(1);
  });

  it('laat dezelfde speler in een hogere reeks meer vragen', () => {
    const derde = opNiveau(1);
    const pro = opNiveau(5);
    const speler = derde.players[0];
    const inDerde = wageDemand(derde, speler);
    const inPro = wageDemand(pro, speler);
    expect(inPro).to.be.greaterThan(inDerde * 5);
    expect(inPro).to.be.lessThan(inDerde * 8);
  });

  it('boekt de competitiekosten elke week, met de naam van je reeks erbij', () => {
    const s = opNiveau(3);
    s.thisWeek = [];
    bookWeeklyFlows(s);
    const post = s.thisWeek.find((e) => e.label.includes('1ste Nationale'));
    expect(post, 'geen competitiekosten geboekt').to.not.equal(undefined);
    expect(post!.amount).to.be.lessThan(0);
    expect(post!.category).to.equal('bond & verzekering');
  });

  it('maakt die kosten in de Pro Liga een veelvoud van die in 1ste Provinciale', () => {
    const kost = (level: number) => {
      const s = opNiveau(level);
      s.thisWeek = [];
      bookWeeklyFlows(s);
      return -(s.thisWeek.find((e) => e.label.startsWith('Bond, scheidsrechters'))?.amount ?? 0);
    };
    expect(kost(5)).to.be.greaterThan(kost(0) * 50);
  });

  it('laat bestaande contracten met rust: de rekening komt bij verlengen en kopen', () => {
    // Je hebt na een promotie even lucht. Dat is bewust: anders springt je loonlast omhoog in
    // een week waarin je nog niets kunt doen, en dat voelt als een straf in plaats van een keuze.
    const s = opNiveau(1);
    const lonenVoor = s.players.map((p) => p.wage);
    s.league.divisionLevel = 4;
    expect(s.players.map((p) => p.wage)).to.deep.equal(lonenVoor);
  });
});
