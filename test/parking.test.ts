// Parking en tribune zijn verbonden: een tribune van 2.000 met een dorpsparking raakt
// nooit vol. Geen harde lijn — mensen parkeren ook elders — maar wel minder volk en een
// tik op de sfeer als de parking het eerst volloopt.
//
// De doorlichting van september 2026 mat dat 99% van de thuiswedstrijden uitverkocht was
// en dat alle publieksknoppen daardoor dood stonden. Uitverkocht is nu zichtbaar (je leest
// hoeveel volk er niet binnen geraakte), en de parking is de eerste publieksknop die
// wérkt op het bindende deel: de effectieve capaciteit in plaats van de vraag.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { attendanceDemand, bookHomeMatch, expectedAttendance, parkingSupport } from '../src/engine/finance';

const INPUT = { weather: 'bewolkt', derby: false, positionFactor: 1 } as const;

describe('parking en tribune', () => {
  it('een dorpsclub onder de parkinggrens merkt er niets van', () => {
    const s = readyGame('heidebeke'); // 500 plaatsen, vraag onder de 600 die te voet komen
    expect(expectedAttendance(s, INPUT)).to.be.at.most(parkingSupport(s));
  });

  it('een grote tribune zonder parking raakt niet vol', () => {
    const s = readyGame('heidebeke');
    s.infrastructure.capacity = 2_000;
    s.community.fanBase = 8_000; // vraag genoeg voor een volle tribune
    const zonder = expectedAttendance(s, INPUT);
    expect(attendanceDemand(s, INPUT)).to.be.above(2_000);
    expect(zonder).to.be.below(2_000);
    expect(zonder).to.be.above(parkingSupport(s)); // maar geen harde lijn: er komt wél meer volk dan de parking aankan
    s.infrastructure.parkingLevel = 2;
    expect(expectedAttendance(s, INPUT)).to.be.above(zonder);
  });

  it('uitverkocht is zichtbaar: je leest hoeveel volk er niet binnen geraakte', () => {
    const s = readyGame('heidebeke');
    s.community.fanBase = 5_000;
    bookHomeMatch(s, INPUT, 'Testclub');
    expect(s.news.some((n) => n.text.includes('geraakten er maar'))).to.equal(true);
  });

  it('een volgelopen parking kost sfeer', () => {
    const s = readyGame('heidebeke');
    s.infrastructure.capacity = 2_000;
    s.community.fanBase = 8_000;
    const sfeer = s.community.fanMood;
    bookHomeMatch(s, INPUT, 'Testclub');
    expect(s.community.fanMood).to.be.below(sfeer);
  });
});
