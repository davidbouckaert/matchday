import { expect } from 'chai';
import { MIN_SQUAD, squadBlock } from '../src/engine/players';
import { buyPlayer, delegateTask, hireStaff, startCourse } from '../src/engine/actions';
import { STAR_EFFICIENCY, pickByEfficiency, runDelegatedTasks, strategyTask, taskSkill } from '../src/engine/delegation';
import { spendPerHeadCanteen } from '../src/engine/canteen';
import { recovery } from '../src/engine/factors';
import { advanceWeek } from '../src/engine/turn';
import { createRng } from '../src/engine/rng';
import { coursePlan, skillStars } from '../src/engine/training-staff';
import { readyGame, playWeeks } from './helpers';
import type { GameState, StaffRole, TaskId } from '../src/engine/types';

/** Neemt iemand van die rol in dienst met een gekozen vaardigheid, en geeft hem de taak. */
function inDienst(s: GameState, role: StaffRole, skill: number, taak: TaskId): void {
  const kandidaat = s.staffMarket.find((x) => x.role === role);
  if (!kandidaat) throw new Error(`geen ${role} op de markt`);
  kandidaat.skill = skill;
  s.cash += 300_000;
  const result = hireStaff(s, kandidaat.id);
  expect(result.ok, result.message).to.equal(true);
  const eigen = s.staff.find((x) => x.id === kandidaat.id)!;
  expect(delegateTask(s, taak, eigen.id).ok).to.equal(true);
}

describe('Je kern heeft een harde ondergrens', () => {
  it('blokkeert de week zodra je er te weinig hebt', () => {
    const s = readyGame();
    s.players = s.players.slice(0, MIN_SQUAD - 1);
    expect(squadBlock(s)).to.be.a('string');
    expect(squadBlock(s)).to.contain(String(MIN_SQUAD));
  });

  it('laat je nooit muurvast zitten: er zijn altijd transfervrije spelers', () => {
    // Zonder dit kon het spel doodlopen: te weinig spelers om verder te gaan, en buiten de
    // transferperiode mocht je niets halen. Dan was er geen enkele zet meer mogelijk.
    let s = readyGame();
    s.week = 20; // midden in het seizoen, transferperiode gesloten
    s.players = s.players.slice(0, MIN_SQUAD - 2);
    s = advanceWeek(s);
    const vrij = s.transferList.filter((p) => p.purchasePrice === 0);
    expect(vrij.length, 'er hoort zich iemand zonder club te melden').to.be.at.least(2);
    for (const p of vrij.slice(0, 2)) expect(buyPlayer(s, p.id).ok, 'transfervrij halen mag ook buiten de periode').to.equal(true);
    expect(squadBlock(s)).to.equal(null);
  });

  it('laat buiten de transferperiode alleen transfervrije spelers toe', () => {
    const s = readyGame();
    s.week = 20;
    s.players = s.players.slice(0, MIN_SQUAD - 2);
    s.cash = 1_000_000;
    const betaald = s.transferList.find((p) => p.purchasePrice > 0);
    if (betaald) expect(buyPlayer(s, betaald.id).ok, 'een dure transfer blijft geblokkeerd').to.equal(false);
  });

  it('laat je medewerker de kern zelf aanvullen als je transfers uitbesteedt', () => {
    const s = readyGame();
    inDienst(s, 'scout', 70, 'transfers');
    s.players = s.players.slice(0, MIN_SQUAD - 2);
    const na = playWeeks(s, 3);
    expect(squadBlock(na), 'wie zijn transfers uitbesteedt, hoort niet vast te lopen').to.equal(null);
  });
});

describe('Je personeel denkt na', () => {
  it('laat de kantineverantwoordelijke de prijs zoeken die het meeste opbrengt', () => {
    // vroeger nam hij gewoon de richtprijs plus een vaste opslag, hoe goed of slecht hij ook was
    const opbrengst = (skill: number) => {
      const s = readyGame();
      inDienst(s, 'kantine', skill, 'horeca');
      runDelegatedTasks(s, createRng(s));
      return spendPerHeadCanteen(s, 400);
    };
    expect(opbrengst(90), 'een topper haalt er meer uit dan een zwakke kracht').to.be.above(opbrengst(25) * 1.1);
  });

  it('laat de trainer zwaarder trainen als je een medische staf hebt', () => {
    // dít is het punt: hij kijkt naar wat de club aan vermoeidheid kan wegwerken
    const trainingen = (medisch: boolean) => {
      const s = readyGame();
      for (const p of s.players) p.fatigue = 35;
      if (medisch) {
        s.infrastructure.recoveryLevel = 2;
        for (const rol of ['kinesist', 'verzorger'] as const) {
          const k = s.staffMarket.find((x) => x.role === rol);
          if (k) {
            k.skill = 80;
            s.cash += 300_000;
            hireStaff(s, k.id);
          }
        }
      }
      const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
      trainer.skill = 85;
      delegateTask(s, 'training', trainer.id);
      strategyTask(s);
      return { trainingen: s.tactics.trainings, herstel: recovery(s) };
    };
    const zonder = trainingen(false);
    const met = trainingen(true);
    expect(met.herstel, 'kine en verzorger horen vermoeidheid weg te werken').to.be.above(zonder.herstel);
    expect(met.trainingen, 'met die opvang durft hij zwaarder te trainen').to.be.above(zonder.trainingen);
  });

  it('laat de trainer gas terugnemen bij een uitgeputte groep', () => {
    const s = readyGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    trainer.skill = 85;
    delegateTask(s, 'training', trainer.id);
    for (const p of s.players) p.fatigue = 10;
    strategyTask(s);
    const fris = s.tactics.trainings;
    for (const p of s.players) p.fatigue = 55;
    strategyTask(s);
    expect(s.tactics.trainings, 'een doodvermoeide groep train je niet nog eens vijf keer').to.be.below(fris);
    expect(s.tactics.focus).to.equal('herstel');
  });

  it('weegt vakgebied en werklast mee in hoe goed iemand een taak doet', () => {
    const s = readyGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    const eigenVak = taskSkill(s, 'training', trainer);
    delegateTask(s, 'training', trainer.id);
    delegateTask(s, 'opstelling', trainer.id);
    delegateTask(s, 'tactiek', trainer.id);
    expect(taskSkill(s, 'training', trainer), 'wie meer taken krijgt, doet ze elk iets minder goed').to.be.below(eigenVak);
  });
});

describe('Sterren bepalen wat een medewerker uit een taak haalt', () => {
  it('loopt van de helft bij één ster tot 85% bij vijf', () => {
    expect(STAR_EFFICIENCY).to.have.lengthOf(5);
    expect(STAR_EFFICIENCY[0]).to.equal(0.5);
    expect(STAR_EFFICIENCY[4]).to.equal(0.85);
    // gelijkmatige trap: elke ster is ongeveer evenveel waard
    const stappen = STAR_EFFICIENCY.slice(1).map((v, i) => v - STAR_EFFICIENCY[i]);
    for (const stap of stappen) expect(stap).to.be.within(0.07, 0.11);
  });

  it('laat de laatste 15% voor de speler zelf', () => {
    // er bestaat een wiskundig beste keuze; die haalt geen enkel personeelslid
    expect(Math.max(...STAR_EFFICIENCY), 'uitbesteden hoort altijd iets te kosten').to.be.below(1);
  });

  it('pakt precies het deel van de winst dat bij die efficiëntie hoort', () => {
    const opties = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ optie: n, waarde: n * 10 }));
    expect(pickByEfficiency(opties, 0, 1)).to.equal(10); // alles
    expect(pickByEfficiency(opties, 0, 0.5)).to.equal(5); // de helft
    expect(pickByEfficiency(opties, 0, 0.85)).to.equal(8); // 85%, naar beneden afgerond
  });

  it('geeft meer sterren ook echt meer opbrengst aan de toog', () => {
    const opbrengst = (skill: number) => {
      const s = readyGame();
      inDienst(s, 'kantine', skill, 'horeca');
      runDelegatedTasks(s, createRng(s));
      return spendPerHeadCanteen(s, 400);
    };
    const ladder = [20, 40, 60, 80, 95].map(opbrengst);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i], `${ladder.map((v) => v.toFixed(2)).join(' → ')}`).to.be.above(ladder[i - 1]);
    }
  });
});

describe('Personeel opleiden', () => {
  it('maakt elke volgende ster duidelijk duurder en langer', () => {
    const s = readyGame();
    s.cash = 5_000_000;
    s.league.divisionLevel = 4; // hoog genoeg om alle treden te mogen
    const plannen = [20, 35, 55, 75].map((skill) => coursePlan(s, { ...s.staff[0], skill, courseWeeksLeft: 0 }));
    for (let i = 1; i < plannen.length; i++) {
      expect(plannen[i].cost, 'elke trede kost meer').to.be.above(plannen[i - 1].cost * 1.8);
      expect(plannen[i].weeks, 'en duurt langer').to.be.above(plannen[i - 1].weeks);
    }
  });

  it('houdt de bovenste treden achter je klassement', () => {
    const laag = readyGame();
    laag.cash = 5_000_000;
    laag.league.divisionLevel = 0;
    const naarVier = coursePlan(laag, { ...laag.staff[0], skill: 55, courseWeeksLeft: 0 });
    expect(naarVier.toStar).to.equal(4);
    expect(naarVier.blocked, 'in provinciale leid je niemand op tot vier sterren').to.contain('Promoveer');

    const hoog = readyGame();
    hoog.cash = 5_000_000;
    hoog.league.divisionLevel = 3;
    expect(coursePlan(hoog, { ...hoog.staff[0], skill: 55, courseWeeksLeft: 0 }).blocked).to.equal(null);
  });

  it('brengt hem met één opleiding ook echt een ster hoger', () => {
    const s = readyGame();
    s.cash = 500_000;
    s.league.divisionLevel = 2;
    const man = s.staff[0];
    man.skill = 35;
    man.courseWeeksLeft = 0;
    const voor = skillStars(man.skill);
    expect(startCourse(s, man.id, 'bijscholing').ok).to.equal(true);
    const na = playWeeks(s, coursePlan(s, man).weeks + 2);
    const zelfde = na.staff.find((x) => x.id === man.id)!;
    expect(skillStars(zelfde.skill), `van ${voor} sterren naar ${skillStars(zelfde.skill)}`).to.be.above(voor);
  });

  it('zegt duidelijk waarom het niet kan als je te weinig geld hebt', () => {
    const s = readyGame();
    s.cash = 100;
    const plan = coursePlan(s, { ...s.staff[0], skill: 35, courseWeeksLeft: 0 });
    expect(plan.blocked).to.contain('rekening');
  });
});
