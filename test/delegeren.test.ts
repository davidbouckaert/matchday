import { expect } from 'chai';
import { MIN_SQUAD, squadBlock } from '../src/engine/players';
import { delegateTask, hireStaff, loanOut, releasePlayer, sellPlayer, startCourse } from '../src/engine/actions';
import { STAR_EFFICIENCY, pickByEfficiency, runDelegatedTasks, strategyTask, taskEfficiency, taskSkill } from '../src/engine/delegation';
import { MIN_SUPPORT, supportReport } from '../src/engine/support';
import { addSink, clearSinks, type LogRecord } from '../src/log/logger';
import { spendPerHeadCanteen } from '../src/engine/canteen';
import { recovery } from '../src/engine/factors';
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

  it('kan nooit ongewild onder dat minimum zakken', () => {
    // Buiten de transferperiode verandert je kern niet: verkopen, uitlenen en iemand laten
    // gaan kan alleen tijdens de periode. Daarom is er geen nooduitgang nodig — je komt hier
    // alleen terecht door zelf spelers weg te doen, en dan is de periode nog open.
    const s = readyGame();
    s.week = 20; // midden in het seizoen
    const speler = s.players[0];
    expect(sellPlayer(s, speler.id).ok, 'verkopen kan niet buiten de periode').to.equal(false);
    expect(loanOut(s, speler.id).ok, 'uitlenen evenmin').to.equal(false);
    expect(releasePlayer(s, speler.id).ok, 'en laten gaan ook niet').to.equal(false);
    expect(s.players.length, 'je kern blijft dus even groot').to.be.at.least(MIN_SQUAD);
  });

  it('houdt genoeg marge voor blessures en schorsingen', () => {
    // achttien en niet elf: die zeven extra zijn je bank, want bijhalen kan niet altijd
    expect(MIN_SQUAD).to.be.at.least(18);
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

describe('Wat je club om een medewerker heen heeft, telt mee', () => {
  it('drukt de efficiëntie van een topper die niets om zich heen heeft', () => {
    // Dit is het punt: sterren zeggen hoe goed hij is, de rest van je club of hij zijn werk
    // kán doen. Een trainer van vijf sterren zonder medische ploeg haalt minder dan een
    // trainer van drie sterren met alles achter zich.
    const kaal = readyGame();
    const topper = kaal.staff.find((x) => x.role === 'hoofdtrainer')!;
    topper.skill = 95;
    delegateTask(kaal, 'training', topper.id);
    const zonder = taskEfficiency(kaal, 'training', topper);

    const rijk = readyGame();
    const zelfde = rijk.staff.find((x) => x.role === 'hoofdtrainer')!;
    zelfde.skill = 95;
    rijk.infrastructure.recoveryLevel = 2;
    rijk.cash += 500_000;
    for (const rol of ['kinesist', 'verzorger', 'conditietrainer'] as const) {
      const k = rijk.staffMarket.find((x) => x.role === rol);
      if (k) {
        k.skill = 75;
        hireStaff(rijk, k.id);
      }
    }
    delegateTask(rijk, 'training', zelfde.id);
    expect(taskEfficiency(rijk, 'training', zelfde)).to.be.above(zonder * 1.4);
  });

  it('valt nooit lager terug dan de bodem', () => {
    const s = readyGame();
    for (const taak of ['training', 'horeca', 'ticketing', 'transfers'] as const) {
      expect(supportReport(s, taak).factor).to.be.at.least(MIN_SUPPORT);
      expect(supportReport(s, taak).factor).to.be.at.most(1);
    }
  });

  it('zegt wat er ontbreekt en wat je eraan kunt doen', () => {
    const s = readyGame();
    const rapport = supportReport(s, 'training');
    expect(rapport.missing, 'een startende club mist zeker iets').to.not.equal(null);
    expect(rapport.missing!.hint, 'en er hoort bij te staan wat je eraan doet').to.be.a('string').with.length.above(20);
  });
});

describe('Het logboek van de rekenkern', () => {
  // Dit is een ontwikkelaarslog, geen spelfeature: de regels gaan naar src/log en niet naar
  // het scherm of de browserconsole. Wat hier getest wordt is dat de waarden waarmee gerekend
  // is ook echt in de log terechtkomen, en dat er niets gebeurt als niemand meeluistert.
  afterEach(() => clearSinks());

  it('legt de berekening van de trainer vast met de waarden erbij', () => {
    const gezien: LogRecord[] = [];
    addSink((r) => gezien.push(r), 'debug');
    const s = readyGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    delegateTask(s, 'training', trainer.id);
    strategyTask(s);
    const regel = gezien.find((r) => r.scope === 'delegatie.training');
    expect(regel, 'de trainer hoort zijn rekenwerk in de log te zetten').to.not.equal(undefined);
    const meta = regel!.meta!;
    expect(meta.staff).to.equal(trainer.id);
    expect(meta.to).to.equal(s.tactics.trainings);
    expect(meta.eff, 'de efficiëntie waarmee hij werkte').to.be.a('number');
    expect(meta.baseline, 'de waarde zonder ingrijpen').to.be.a('number');
    expect(meta.candidates, 'elke optie met zijn waarde').to.be.an('object');
    expect(meta.optimum, 'het meetbare optimum').to.be.a('number');
  });

  it('laat in de log zien dat een beslissing meeverandert met de club', () => {
    // het concrete voorbeeld: van 3 naar 4 trainingen zodra er een kinesist in dienst is
    const gezien: LogRecord[] = [];
    addSink((r) => gezien.push(r), 'debug');
    const s = readyGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    trainer.skill = 85;
    delegateTask(s, 'training', trainer.id);
    for (const p of s.players) p.fatigue = 30;
    strategyTask(s);
    const eerst = s.tactics.trainings;

    s.infrastructure.recoveryLevel = 2;
    s.cash += 500_000;
    for (const rol of ['kinesist', 'verzorger'] as const) {
      const k = s.staffMarket.find((x) => x.role === rol);
      if (k) {
        k.skill = 78;
        hireStaff(s, k.id);
      }
    }
    s.week++;
    strategyTask(s);
    expect(s.tactics.trainings, 'met opvang erbij mag er zwaarder getraind worden').to.be.above(eerst);
    const laatste = gezien.filter((r) => r.scope === 'delegatie.training').at(-1)!;
    expect(laatste.meta!.from, 'de log hoort te tonen waar hij vandaan kwam').to.equal(eerst);
    expect(laatste.meta!.to).to.equal(s.tactics.trainings);
  });

  it('schrijft de wekelijkse doorlichting van de club weg', () => {
    const gezien: LogRecord[] = [];
    addSink((r) => gezien.push(r), 'debug');
    const s = readyGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    delegateTask(s, 'training', trainer.id);
    runDelegatedTasks(s, createRng(s));
    const scan = gezien.find((r) => r.scope === 'delegatie.scan');
    expect(scan, 'de doorlichting hoort elke week in de log te staan').to.not.equal(undefined);
    expect(scan!.meta!.delegated).to.be.a('string');
    expect(scan!.meta!.support).to.be.an('object');
  });

  it('kost niets als er geen bestemming aanhangt', () => {
    // De motor mag niet trager worden door een log waar niemand naar luistert, en er mag al
    // helemaal niets van in de opgeslagen stand terechtkomen.
    clearSinks();
    const s = readyGame();
    delegateTask(s, 'training', s.staff.find((x) => x.role === 'hoofdtrainer')!.id);
    expect(() => strategyTask(s)).to.not.throw();
    expect((s as unknown as Record<string, unknown>).reasoning, 'het logboek hoort niet in de state te zitten').to.equal(undefined);
  });
});
