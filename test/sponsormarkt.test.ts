import { expect } from 'chai';
import { SPONSOR_COMPANIES, sectorKind } from '../src/engine/data/names';
import { KIND_MAX } from '../src/engine/sponsors';
import { readyGame, playWeeks } from './helpers';
import type { SponsorKind } from '../src/engine/types';

/** Hoeveel bedrijven er in de streek zijn per soort plaats die ze aankunnen. */
function aanbod(): Record<string, number> {
  const per: Record<string, number> = {};
  for (const c of SPONSOR_COMPANIES) {
    const k = sectorKind(c.sector);
    per[k] = (per[k] ?? 0) + 1;
  }
  return per;
}

describe('De sponsormarkt staat als een piramide', () => {
  it('heeft veel kleine handelaars en weinig grote namen', () => {
    // dit stond op zijn kop: eenentwintig bedrijven voor de shirt- en borstplaats (samen twee
    // plaatsen) en drie die een bord konden betalen (zestien plaatsen)
    const per = aanbod();
    expect(per.bord, 'er horen meer bordklanten te zijn dan bordplaatsen').to.be.at.least(KIND_MAX.bord);
    expect(per.bord).to.be.above(per.hoofdsponsor * 2);
    expect(per.bal).to.be.above(per.shirt);
  });

  it('heeft voor elke soort plaats bedrijven die ze aankunnen', () => {
    const per = aanbod();
    const soorten: SponsorKind[] = ['bord', 'bal', 'jeugd', 'scherm', 'evenement', 'bus', 'mouw', 'shirt', 'hoofdsponsor'];
    for (const k of soorten) expect(per[k] ?? 0, `geen enkel bedrijf kan ${k} aan`).to.be.above(0);
  });

  it('gebruikt elke bedrijfsnaam maar één keer', () => {
    const namen = SPONSOR_COMPANIES.map((c) => c.name);
    expect(new Set(namen).size).to.equal(namen.length);
  });

  it('zet op je contactenlijst vooral handelaars, niet alleen banken en brouwerijen', () => {
    const s = playWeeks(readyGame(), 12);
    const groot = s.prospects.filter((p) => p.maxKind === 'hoofdsponsor' || p.maxKind === 'shirt').length;
    expect(groot, 'de grote namen horen de uitzondering te zijn').to.be.below(s.prospects.length / 2);
  });
});

describe('De contactenlijst draait', () => {
  it('zet om de twee weken nieuwe namen op je lijst', () => {
    const s = readyGame();
    const start = new Set(s.prospects.map((p) => p.name));
    const na = playWeeks(s, 4);
    const nieuw = na.prospects.filter((p) => !start.has(p.name));
    expect(nieuw.length, 'in vier weken horen er nieuwe bedrijven bij te komen').to.be.above(0);
  });

  it('laat de lijst na een half seizoen grotendeels vernieuwd zijn', () => {
    // vroeger keek je het hele seizoen naar dezelfde dertien namen
    const s = readyGame();
    const start = new Set(s.prospects.map((p) => p.name));
    const na = playWeeks(s, 20);
    const gebleven = na.prospects.filter((p) => start.has(p.name)).length;
    expect(gebleven).to.be.below(na.prospects.length * 0.7);
  });

  it('houdt de lijst binnen de perken', () => {
    const s = playWeeks(readyGame(), 30);
    expect(s.prospects.length).to.be.at.most(16);
    expect(s.prospects.length, 'en laat ze niet leeglopen').to.be.above(5);
  });

  it('gooit nooit een bedrijf weg waarmee een gesprek loopt', () => {
    const s = readyGame();
    // vul de lijst tot over de rand, met één lopend gesprek dat bijna niemand interesseert
    const gesprek = s.prospects[0];
    gesprek.approached = true;
    gesprek.interest = 5;
    for (let i = 0; i < 20; i++) s.prospects.push({ ...s.prospects[1], id: `pr-vul-${i}`, name: `Vulbedrijf ${i}`, interest: 90, approached: false });
    const na = playWeeks(s, 2);
    expect(na.prospects.some((p) => p.name === gesprek.name) || na.sponsorOffers.some((o) => o.name === gesprek.name)).to.equal(true);
  });
});
