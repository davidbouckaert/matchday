import { expect } from 'chai';
import type { GameState } from '../src/engine/types';
import { CARRIERE_DOELEN, EIGENAARSNIVEAUS, PUNTEN } from '../src/content/careers';
import {
  addOwnerPoints,
  checkCareerGoal,
  goalDef,
  goalProgress,
  levelFor,
  loanDiscount,
  maxProjects,
  nextLevel,
  ownerLevel,
  setCareerGoal,
  sponsorBonus,
  subsidyFactor,
} from '../src/engine/career';
import * as actions from '../src/engine/actions';
import { loanOffers } from '../src/engine/loans';
import { newTestGame, playWeeks } from './helpers';

const withGoal = (id: string, seed = 42): GameState => {
  const s = newTestGame('zuidrand', 'aannemer', seed);
  setCareerGoal(s, id);
  return s;
};

describe('Het langetermijndoel', () => {
  it('biedt genoeg verschillende soorten doelen aan', () => {
    const kinds = new Set(CARRIERE_DOELEN.map((g) => g.soort));
    expect(CARRIERE_DOELEN.length).to.be.at.least(6);
    expect(kinds.has('klasse')).to.equal(true);
    expect(kinds.has('kas')).to.equal(true);
    expect(kinds.has('capaciteit')).to.equal(true);
    expect(kinds.has('jeugd')).to.equal(true);
    expect(kinds.has('seizoenen')).to.equal(true);
    expect(kinds.has('combinatie')).to.equal(true);
    for (const g of CARRIERE_DOELEN) {
      expect(g.titel, g.id).to.be.a('string').and.not.equal('');
      expect(g.beschrijving, g.id).to.not.equal('');
      expect(g.belofte, g.id).to.not.equal('');
      expect(g.looptijd, g.id).to.be.above(0);
    }
  });

  it('staat bij een nieuwe partij nog open', () => {
    const s = newTestGame();
    expect(s.career.goalId).to.equal(null);
    expect(goalDef(s)).to.equal(undefined);
    expect(goalProgress(s)).to.equal(null);
  });

  it('wordt vastgelegd via een actie en kan maar één keer', () => {
    const s = newTestGame();
    const first = actions.chooseCareerGoal(s, 'gezonde-club');
    expect(first.ok, first.message).to.equal(true);
    expect(s.career.goalId).to.equal('gezonde-club');
    expect(s.career.chosenSeason).to.equal(1);
    const second = actions.chooseCareerGoal(s, 'naar-tweede');
    expect(second.ok).to.equal(false);
    expect(s.career.goalId).to.equal('gezonde-club');
  });

  it('weigert een doel dat niet bestaat', () => {
    const s = newTestGame();
    expect(actions.chooseCareerGoal(s, 'onzin').ok).to.equal(false);
    expect(s.career.goalId).to.equal(null);
  });

  it('blijft zichtbaar en houdt de voortgang bij', () => {
    const s = withGoal('gezonde-club');
    s.cash = 125_000;
    const p = goalProgress(s)!;
    expect(p.target).to.equal(500_000);
    expect(p.value).to.equal(125_000);
    expect(p.fraction).to.be.closeTo(0.25, 0.01);
    expect(p.done).to.equal(false);
    expect(p.label).to.contain('125.000').and.contain('500.000');
  });

  it('meet een klassedoel aan de hoogste reeks waarin je speelde', () => {
    const s = withGoal('naar-eerste');
    expect(goalProgress(s)!.done).to.equal(false);
    s.league.divisionLevel = 3;
    const p = goalProgress(s)!;
    expect(p.done).to.equal(true);
    expect(p.label).to.contain('1ste Nationale');
  });

  it('meet een stadiondoel aan je capaciteit', () => {
    const s = withGoal('eigen-stadion');
    s.infrastructure.capacity = 1000;
    expect(goalProgress(s)!.fraction).to.be.closeTo(0.5, 0.01);
    s.infrastructure.capacity = 2400;
    expect(goalProgress(s)!.done).to.equal(true);
    expect(goalProgress(s)!.fraction).to.equal(1);
  });

  it('meet een jeugddoel aan het aantal jeugdploegen', () => {
    const s = withGoal('jeugdclub');
    s.community.youthTeams = 8;
    expect(goalProgress(s)!.done).to.equal(true);
  });

  it('telt seizoenen in een reeks of hoger', () => {
    const s = withGoal('gevestigde-waarde');
    s.career.seasonsByLevel = { 1: 4, 2: 3, 3: 2 };
    const p = goalProgress(s)!;
    expect(p.value).to.equal(5); // alleen niveau 2 en hoger tellen
    expect(p.done).to.equal(true);
  });

  it('vraagt bij een samengesteld doel allebei de helften', () => {
    const s = withGoal('hoog-en-gezond');
    s.league.divisionLevel = 3;
    s.cash = 10_000;
    expect(goalProgress(s)!.done, 'sportief gehaald maar financieel niet').to.equal(false);
    s.cash = 300_000;
    const p = goalProgress(s)!;
    expect(p.done).to.equal(true);
    expect(p.extra?.done).to.equal(true);
  });
});

describe('Het doel bereiken', () => {
  it('wordt vastgesteld en gemeld zodra het lukt', () => {
    const s = withGoal('gezonde-club');
    s.cash = 600_000;
    expect(checkCareerGoal(s)).to.equal(true);
    expect(s.career.achievedSeason).to.equal(s.season);
    const message = s.news.find((n) => n.text.includes('DOEL BEREIKT'));
    expect(message, 'geen melding dat het doel bereikt is').to.not.equal(undefined);
    expect(message!.tone).to.equal('goed');
  });

  it('laat een duidelijk spoor na in de clubkroniek', () => {
    const s = withGoal('gezonde-club');
    s.cash = 600_000;
    checkCareerGoal(s);
    expect(s.chronicle.some((c) => c.text.includes('Langetermijndoel bereikt'))).to.equal(true);
  });

  it('levert punten op voor je eigen niveau', () => {
    const s = withGoal('gezonde-club');
    const before = s.owner.points;
    s.cash = 600_000;
    checkCareerGoal(s);
    expect(s.owner.points).to.equal(before + PUNTEN.doelBehaald);
  });

  it('gebeurt maar één keer', () => {
    const s = withGoal('gezonde-club');
    s.cash = 600_000;
    expect(checkCareerGoal(s)).to.equal(true);
    expect(checkCareerGoal(s)).to.equal(false);
  });

  it('kan tijdens het gewone spelen binnenkomen', () => {
    const s = withGoal('gezonde-club', 9);
    s.cash = 499_000;
    const after = playWeeks(s, 1);
    // de kas beweegt elke week; het doel klikt vanzelf aan zodra hij erover gaat
    if (after.cash >= 500_000) expect(after.career.achievedSeason).to.not.equal(null);
    else expect(after.career.achievedSeason).to.equal(null);
  });
});

describe('Je eigen niveau als eigenaar', () => {
  it('heeft precies vijf niveaus met oplopende drempels', () => {
    expect(EIGENAARSNIVEAUS.length).to.equal(5);
    for (let i = 1; i < EIGENAARSNIVEAUS.length; i++) {
      expect(EIGENAARSNIVEAUS[i].punten).to.be.above(EIGENAARSNIVEAUS[i - 1].punten);
      expect(EIGENAARSNIVEAUS[i].voordeel, `niveau ${i + 1}`).to.not.equal('');
      expect(EIGENAARSNIVEAUS[i].uitleg, `niveau ${i + 1}`).to.not.equal('');
    }
  });

  it('begint op niveau één zonder voordeel', () => {
    const s = newTestGame();
    expect(s.owner.level).to.equal(1);
    expect(s.owner.points).to.equal(0);
    expect(ownerLevel(s).voordeel).to.equal('');
  });

  it('zet punten om in niveaus', () => {
    expect(levelFor(0)).to.equal(1);
    expect(levelFor(7)).to.equal(1);
    expect(levelFor(8)).to.equal(2);
    expect(levelFor(39)).to.equal(3);
    expect(levelFor(40)).to.equal(4);
    expect(levelFor(999)).to.equal(5);
  });

  it('meldt een nieuw niveau met wat het oplevert', () => {
    const s = newTestGame();
    addOwnerPoints(s, 8, 'test');
    expect(s.owner.level).to.equal(2);
    expect(s.news[0].text).to.contain('Bestuurder');
    expect(s.news[0].text).to.contain('rente');
    expect(s.chronicle.some((c) => c.text.includes('bestuurder'))).to.equal(true);
  });

  it('toont altijd wat het volgende niveau oplevert', () => {
    const s = newTestGame();
    const next = nextLevel(s)!;
    expect(next.niveau.level).to.equal(2);
    expect(next.missing).to.equal(EIGENAARSNIVEAUS[1].punten);
    expect(next.niveau.uitleg).to.not.equal('');
    addOwnerPoints(s, 999, 'test');
    expect(nextLevel(s)).to.equal(null);
  });

  it('verdient punten met een afgewerkt seizoen', () => {
    const before = newTestGame('heidebeke', 'fonds', 17);
    before.cash = 2_000_000;
    const after = playWeeks(before, 52);
    expect(after.owner.points).to.be.at.least(PUNTEN.seizoen);
    expect(after.career.seasonsByLevel[1]).to.be.at.least(1);
  });
});

describe('Wat een niveau ontgrendelt', () => {
  // niet de aannemer: die krijgt van zijn kant al een extra werf (zie investors.test)
  const at = (level: number): GameState => {
    const s = newTestGame('zuidrand', 'fonds');
    s.owner.points = EIGENAARSNIVEAUS.find((l) => l.level === level)!.punten;
    s.owner.level = level;
    return s;
  };

  it('houdt alle basismogelijkheden open vanaf niveau één', () => {
    const s = at(1);
    expect(maxProjects(s)).to.equal(2);
    expect(loanDiscount(s)).to.equal(0);
    expect(sponsorBonus(s)).to.equal(0);
    expect(subsidyFactor(s)).to.equal(1);
    // een beginnende eigenaar kan gewoon bouwen, lenen en sponsors zoeken
    s.cash = 500_000;
    expect(actions.startUpgrade(s, 'wifi').ok).to.equal(true);
    expect(loanOffers(s).length).to.be.above(0);
  });

  it('geeft vanaf niveau twee een lagere rente', () => {
    const plain = loanOffers(at(1)).map((o) => o.annualRate);
    const better = loanOffers(at(2)).map((o) => o.annualRate);
    expect(better[0]).to.be.below(plain[0]);
    expect(plain[0] - better[0]).to.be.closeTo(0.005, 0.0001);
  });

  it('geeft vanaf niveau drie een derde bouwproject', () => {
    expect(maxProjects(at(2))).to.equal(2);
    expect(maxProjects(at(3))).to.equal(3);
    const s = at(3);
    s.cash = 2_000_000;
    expect(actions.startUpgrade(s, 'wifi').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'sanitair').ok).to.equal(true);
    const third = actions.startUpgrade(s, 'parking');
    expect(third.ok, third.message).to.equal(true);
    expect(s.infrastructure.constructions.length).to.equal(3);
    expect(actions.startUpgrade(s, 'scorebord').ok, 'een vierde project zou niet mogen').to.equal(false);
  });

  it('houdt het bij twee projecten zolang je niveau twee bent', () => {
    const s = at(2);
    s.cash = 2_000_000;
    expect(actions.startUpgrade(s, 'wifi').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'sanitair').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'parking').ok).to.equal(false);
  });

  it('geeft vanaf niveau vier een extra sponsorprospect', () => {
    expect(sponsorBonus(at(3))).to.equal(0);
    expect(sponsorBonus(at(4))).to.equal(1);
  });

  it('geeft vanaf niveau vijf meer subsidie', () => {
    expect(subsidyFactor(at(4))).to.equal(1);
    expect(subsidyFactor(at(5))).to.equal(1.25);
  });

  it('blijft één enkele laag: geen tweede puntensysteem', () => {
    const s = newTestGame();
    const keys = Object.keys(s.owner);
    expect(keys.sort()).to.deep.equal(['lastUnlock', 'level', 'points']);
  });
});

describe('Opslag met de carrière', () => {
  it('geeft een bestand van versie 23 een doel en een niveau', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 23;
    delete old.career;
    delete old.owner;
    const fixed = migrate(old);
    expect(fixed.career.goalId).to.equal(null);
    expect(fixed.owner.level).to.equal(1);
    expect(fixed.version).to.be.at.least(24);
  });

  it('rekent een bestaande geschiedenis om in punten', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 23;
    delete old.career;
    delete old.owner;
    old.history = [
      { season: 1, division: '3de Nationale', position: 1, points: 70, result: 'kampioen', profit: 40_000 },
      { season: 2, division: '2de Nationale', position: 5, points: 50, result: 'behoud', profit: -5_000 },
    ];
    const fixed = migrate(old);
    // 1 + 5 + 2 voor het kampioenenjaar, 1 voor het tweede
    expect(fixed.owner.points).to.be.at.least(9);
    expect(fixed.owner.level).to.be.at.least(2);
    expect(fixed.career.seasonsByLevel[1]).to.equal(1);
    expect(fixed.career.seasonsByLevel[2]).to.equal(1);
  });

  it('blijft speelbaar na de omzetting', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 23;
    delete old.career;
    delete old.owner;
    const fixed = playWeeks(migrate(old), 8);
    expect(fixed.week).to.equal(9);
    expect(fixed.gameOver).to.equal(false);
  });
});
