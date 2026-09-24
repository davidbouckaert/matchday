// De instroom uit de eigen jeugd hangt aan je jeugdwerking, niet aan je reeks.
//
// De doorlichting van september 2026 mat dat een uitbestedende club tegen seizoen zes voor
// 60% uit eigen jeugd bestond en structureel boven haar reeks uitstak: doorstromers kregen
// kwaliteit "reeksniveau − 12" en werden dus vanzelf beter telkens de club promoveerde,
// aan €40 per week. Deze tests leggen vast dat die koppeling weg is en wegblijft.

import { expect } from 'chai';
import { readyGame } from './helpers';
import { youthIntakePotential, youthIntakeQuality } from '../src/engine/youth';
import { generatePlayer } from '../src/engine/players';
import { createRng } from '../src/engine/rng';
import type { Staff } from '../src/engine/types';

const coordinator = (skill: number): Staff => ({
  id: 'test-coord',
  name: 'Test Coördinator',
  role: 'jeugdcoordinator',
  skill,
  trait: 'teamspeler',
  wage: 100,
  diploma: 'geen',
  courseWeeksLeft: 0,
  courseType: null,
});

describe('jeugdinstroom', () => {
  it('de reeks verandert niets aan de kwaliteit van een doorstromer', () => {
    const s = readyGame('heidebeke');
    const basis = youthIntakeQuality(s);
    for (const level of [0, 2, 4, 5]) {
      s.league.divisionLevel = level;
      expect(youthIntakeQuality(s)).to.equal(basis);
      expect(youthIntakePotential(s)).to.be.closeTo(youthIntakePotential({ ...s, league: { ...s.league, divisionLevel: 1 } }), 1e-9);
    }
  });

  it('coördinator, opleidingscentrum en leden tillen de instroom wél op', () => {
    const s = readyGame('zuidrand');
    s.staff = s.staff.filter((m) => m.role !== 'jeugdcoordinator');
    const kaal = youthIntakeQuality(s);
    s.staff.push(coordinator(80));
    const metCoordinator = youthIntakeQuality(s);
    expect(metCoordinator).to.be.above(kaal + 8);
    s.infrastructure.academyLevel = 3;
    expect(youthIntakeQuality(s)).to.be.above(metCoordinator + 6);
  });

  it('een startclub in 3de Nationale komt uit rond het oude niveau (~46)', () => {
    // het ijkpunt uit de ontwerpregel: aan het begin van een carrière verandert er niets
    const s = readyGame('heidebeke');
    expect(youthIntakeQuality(s)).to.be.within(42, 50);
  });

  it('het plafond van de jeugdwerking ligt rond 1ste Nationale, niet hoger', () => {
    const s = readyGame('heidebeke');
    s.staff = s.staff.filter((m) => m.role !== 'jeugdcoordinator');
    s.staff.push(coordinator(95));
    s.infrastructure.academyLevel = 3;
    s.community.youthMembers = 1000; // telt maar tot 400 mee
    expect(youthIntakeQuality(s)).to.be.below(67);
  });

  it('een doorstromer begint aan €40, wat je reeks ook is', () => {
    const s = readyGame('heidebeke');
    s.league.divisionLevel = 5;
    const p = generatePlayer(s, createRng(s), { quality: 50, season: s.season, isYouth: true });
    expect(p.wage).to.equal(40);
  });
});
