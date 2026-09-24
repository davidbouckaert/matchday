// Personeel vervangen in één beslissing, en een kandidatenlijst die vooraf zegt wat kan.
//
// Je kon in de kandidatenlijst op "Aanwerven" klikken en pas dáárna horen dat de plaats
// bezet was. Nu staat bij elke kandidaat of zijn functie vrij is, bezet (door wie) of op
// slot — en bij bezet is de knop een eerlijke "Vervang X": opzegvergoeding plus tekengeld
// in één keer, en de taken van de vertrekker gaan mee naar zijn opvolger.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { delegateTask, hireStaff, replaceStaff, staffLock } from '../src/engine/actions';
import { staffScreen } from '../src/ui/screens/staff';

describe('personeel vervangen', () => {
  it('wisselt de zittende voor de kandidaat en boekt beide vergoedingen', () => {
    const s = readyGame('heidebeke');
    s.cash = 500_000;
    const zittend = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    const kandidaat = s.staffMarket.find((c) => c.role === 'hoofdtrainer')!;
    const kasVooraf = s.cash;
    const result = replaceStaff(s, kandidaat.id);
    expect(result.ok, result.message).to.equal(true);
    expect(s.staff.some((x) => x.id === zittend.id)).to.equal(false);
    expect(s.staff.some((x) => x.id === kandidaat.id)).to.equal(true);
    expect(kasVooraf - s.cash).to.equal(zittend.wage * 8 + kandidaat.wage * 2);
  });

  it('de taken van de vertrekker verhuizen mee naar zijn opvolger', () => {
    const s = readyGame('heidebeke');
    s.cash = 500_000;
    const zittend = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    expect(delegateTask(s, 'tactiek', zittend.id).ok).to.equal(true);
    const kandidaat = s.staffMarket.find((c) => c.role === 'hoofdtrainer')!;
    expect(replaceStaff(s, kandidaat.id).ok).to.equal(true);
    expect(s.delegation.tactiek).to.equal(kandidaat.id);
  });

  it('op een vrije functie werft vervangen gewoon aan', () => {
    const s = readyGame('heidebeke');
    s.cash = 500_000;
    const kandidaat = s.staffMarket.find((c) => c.role === 'commercieel')!;
    expect(s.staff.some((x) => x.role === 'commercieel')).to.equal(false);
    expect(replaceStaff(s, kandidaat.id).ok).to.equal(true);
    expect(s.staff.some((x) => x.id === kandidaat.id)).to.equal(true);
  });

  it('zonder genoeg geld voor beide vergoedingen gaat het niet door', () => {
    const s = readyGame('heidebeke');
    const kandidaat = s.staffMarket.find((c) => c.role === 'hoofdtrainer')!;
    s.cash = 100;
    const voor = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    expect(replaceStaff(s, kandidaat.id).ok).to.equal(false);
    expect(s.staff.some((x) => x.id === voor.id)).to.equal(true);
  });

  it('de kandidatenlijst zegt vooraf wat kan: vrij, bezet of op slot', () => {
    const s = readyGame('heidebeke');
    const html = staffScreen(s, null);
    expect(html).to.contain('functie vrij');
    expect(html).to.contain('bezet: ');
    expect(html).to.contain('Vervang ');
    expect(html).to.contain('op slot');
  });

  it('de aanwerf-knop staat alleen bij vrije functies: "geen plaats" bestaat niet meer', () => {
    const s = readyGame('heidebeke');
    const html = staffScreen(s, null);
    const aanwerfKnoppen = (html.match(/data-action="hire"(?!-)/g) ?? []).length;
    // het overzicht toont de beste kandidaat per functie: één knop per vrije, open functie
    const vrijeRollen = new Set(s.staffMarket.filter((c) => !s.staff.some((x) => x.role === c.role) && !staffLock(s, c.role)).map((c) => c.role));
    expect(aanwerfKnoppen).to.equal(vrijeRollen.size);
    // en op een bezette functie zou de oude knop ook echt geweigerd hebben
    const bezet = s.staffMarket.find((c) => s.staff.some((x) => x.role === c.role))!;
    expect(hireStaff(structuredClone(s), bezet.id).ok).to.equal(false);
  });
});
