import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { CLUB_EVENTS, MERCH_START_COST, TASKS, UPGRADES, merchDef } from '../src/engine/data/catalog';
import { newTestGame, playWeeks } from './helpers';
import { declineFactor, growthFactor, overall, playEffect, selectLineup, teamStrength, trainingEffect } from '../src/engine/players';
import { bestPrice, expectedUnits } from '../src/engine/merch';
import { acceptedMargin, expectedCanteenUnits } from '../src/engine/canteen';
import { AWAY_SHARE, breakdownChance, expectedAttendance, facilityCost } from '../src/engine/finance';
import { SECTORS } from '../src/engine/data/names';
import { runDelegatedTasks, taskCapacity, taskSkill, tasksOf } from '../src/engine/delegation';
import { PLANS, matchup, nextOpponent, scoutingReport } from '../src/engine/strategy';
import { product, sponsorFactors } from '../src/engine/factors';
import { KIND_MAX, companySector, kindLock, kindRange } from '../src/engine/sponsors';
import { cardsForOwnTeam } from '../src/engine/discipline';
import { createRng } from '../src/engine/rng';
import { checkMilestones } from '../src/engine/milestones';
import { checkRecords, currentStreak } from '../src/engine/records';
import { simulateMatch, side } from '../src/engine/league';
import { advanceWeek } from '../src/engine/turn';

describe('Acties', () => {
  it('koopt een speler tijdens de transferperiode', () => {
    const s = newTestGame();
    s.cash = 1_000_000;
    const target = s.transferList[0];
    const before = s.players.length;
    const result = actions.buyPlayer(s, target.id);
    expect(result.ok).to.equal(true);
    expect(s.players).to.have.lengthOf(before + 1);
    expect(s.cash).to.equal(1_000_000 - target.purchasePrice);
  });

  it('weigert aankopen buiten de transferperiode', () => {
    const s = playWeeks(newTestGame(), 12);
    s.transferList.push({ ...s.players[0], id: 'extra' });
    expect(actions.buyPlayer(s, 'extra').ok).to.equal(false);
  });

  it('verkoopt een speler en boekt de opbrengst', () => {
    const s = newTestGame();
    const p = s.players[0];
    const cashBefore = s.cash;
    const result = actions.sellPlayer(s, p.id);
    expect(result.ok).to.equal(true);
    expect(s.players.find((x) => x.id === p.id)).to.equal(undefined);
    expect(s.cash).to.be.above(cashBefore);
  });

  it('het fonds pakt 30% van de transferwinst', () => {
    const s = newTestGame('zuidrand', 'fonds');
    const p = s.players[0];
    p.purchasePrice = 0;
    actions.sellPlayer(s, p.id);
    const fee = s.thisWeek.find((e) => e.category === 'investeerder');
    const sale = s.thisWeek.find((e) => e.category === 'transfers')!;
    expect(fee!.amount).to.equal(Math.round(-sale.amount * 0.3));
  });

  it('een kredietaanvraag krijgt pas na een week antwoord en wordt daarna afbetaald', () => {
    let s = newTestGame('heidebeke');
    s.community.reputation = 90; // een goed dossier
    const result = actions.takeLoan(s, 'middel');
    expect(result.ok).to.equal(true);
    expect(s.loans).to.have.lengthOf(0); // nog niets ontvangen
    expect(s.requests.some((r) => r.kind === 'lening')).to.equal(true);
    expect(actions.takeLoan(s, 'kort').ok).to.equal(false); // één aanvraag tegelijk
    s = playWeeks(s, 1);
    expect(s.requests.some((r) => r.kind === 'lening')).to.equal(false);
    expect(s.log.some((l) => l.kind === 'antwoord' && /[Kk]rediet/.test(l.text))).to.equal(true);
    if (!s.loans.length) return; // de bank mag ook weigeren
    const loan = s.loans[0];
    s = playWeeks(s, 1);
    expect(s.loans[0].remaining).to.be.below(loan.remaining);
  });

  it('bouwt een tribune en verhoogt de capaciteit', () => {
    let s = newTestGame();
    s.cash = 1_000_000;
    const before = s.infrastructure.capacity;
    expect(actions.startUpgrade(s, 'tribune').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'kantine').ok).to.equal(false); // één project tegelijk
    s = playWeeks(s, UPGRADES.find((u) => u.id === 'tribune')!.weeks);
    expect(s.infrastructure.capacity).to.equal(before + 300);
    expect(s.infrastructure.construction).to.equal(null);
  });

  it('stuurt een trainer op opleiding en geeft hem een hoger diploma', () => {
    let s = newTestGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    expect(trainer.diploma).to.equal('EUFA B');
    expect(actions.startCourse(s, trainer.id).ok).to.equal(true);
    s = playWeeks(s, 20);
    expect(s.staff.find((x) => x.id === trainer.id)!.diploma).to.equal('EUFA A');
  });

  it('een evenement kost nu geld en betaalt later uit, binnen de prognose', () => {
    let s = newTestGame('heidebeke');
    const def = CLUB_EVENTS.find((e) => e.id === 'spaghetti')!;
    const [min, max] = actions.eventForecast(s, def);
    const cash = s.cash;
    expect(actions.organiseEvent(s, 'spaghetti').ok).to.equal(true);
    expect(s.cash).to.equal(cash - def.cost);
    expect(s.pending).to.have.lengthOf(1);
    expect(s.pending[0].amount).to.be.within(min, max);
    expect(actions.organiseEvent(s, 'spaghetti').ok).to.equal(false); // wachttijd
    s = playWeeks(s, def.payoutWeeks);
    expect(s.pending).to.have.lengthOf(0);
    expect(s.seasonTotals.evenementen).to.be.above(-def.cost);
  });

  it('een evenement vraagt genoeg vrijwilligers', () => {
    const s = newTestGame();
    s.community.volunteers = 5;
    const result = actions.organiseEvent(s, 'mosselfeest');
    expect(result.ok).to.equal(false);
    expect(result.message).to.include('vrijwilligers');
  });

  it('vrijwilligers werven levert later nieuwe vrijwilligers op', () => {
    let s = newTestGame();
    s.community.volunteers = 10;
    expect(actions.volunteerAction(s, 'infoavond').ok).to.equal(true);
    const expected = 10 + s.pending[0].volunteers!;
    s = playWeeks(s, 2);
    expect(s.community.volunteers).to.be.at.least(expected - 3); // intussen kan er iemand afhaken
  });

  it('ticketprijs moet realistisch zijn', () => {
    const s = newTestGame();
    expect(actions.setTicketPrice(s, -1).ok).to.equal(false);
    expect(actions.setTicketPrice(s, 12).ok).to.equal(true);
    expect(s.ticketPrice).to.equal(12);
  });
});

describe('Opstelling en tactiek', () => {
  it('formatie bepaalt het aantal spelers per linie', () => {
    const s = newTestGame();
    actions.setFormation(s, '4-3-3');
    const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI);
    expect(slots.filter((x) => x.zone === 'AANV')).to.have.lengthOf(3);
    expect(slots.filter((x) => x.zone === 'MIDD')).to.have.lengthOf(3);
  });

  it('aanvallend spelen verhoogt de aanval en verlaagt de verdediging', () => {
    const s = newTestGame();
    const before = teamStrength(s);
    actions.setMentality(s, 'aanvallend');
    const after = teamStrength(s);
    expect(after.attack).to.be.above(before.attack);
    expect(after.defense).to.be.below(before.defense);
  });

  it('een zelfgekozen basisspeler staat altijd in de elf', () => {
    const s = newTestGame();
    const weakest = [...s.players].filter((p) => p.position === 'MIDD').sort((a, b) => overall(a) - overall(b))[0];
    expect(actions.toggleStarter(s, weakest.id).ok).to.equal(true);
    const { lineup } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI);
    expect(lineup.map((p) => p.id)).to.include(weakest.id);
  });

  it('een keepertrainer verbetert de doellinie', () => {
    const s = newTestGame();
    const before = teamStrength(s).zones.DOEL;
    s.staff.push({ ...s.staff[0], id: 'kt', role: 'keepertrainer', skill: 70 });
    expect(teamStrength(s).zones.DOEL).to.be.above(before);
  });
});

describe('Delegeren', () => {
  it('de trainer neemt de opstelling over en de eigenaar kan dan niet meer ingrijpen', () => {
    let s = newTestGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    expect(actions.delegateTask(s, 'opstelling', trainer.id).ok).to.equal(true);
    expect(actions.setFormation(s, '5-3-2').ok).to.equal(false);
    s = playWeeks(s, 1);
    expect(s.tactics.manualXI).to.have.lengthOf(0);
  });

  it('een staflid kan alleen taken van zijn vakgebied overnemen', () => {
    const s = newTestGame();
    const delegate = s.staff.find((x) => x.role === 'afgevaardigde')!;
    expect(actions.delegateTask(s, 'sponsoring', delegate.id).ok).to.equal(false);
    expect(actions.delegateTask(s, 'contracten', delegate.id).ok).to.equal(true);
  });

  it('bij ontslag gaat de taak terug naar de eigenaar', () => {
    const s = newTestGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    actions.delegateTask(s, 'opstelling', trainer.id);
    actions.fireStaff(s, trainer.id);
    expect(s.delegation.opstelling).to.equal(undefined);
  });

  it('een commercieel medewerker benadert zelf bedrijven', () => {
    let s = newTestGame();
    const sales = s.staffMarket.find((x) => x.role === 'commercieel')!;
    actions.hireStaff(s, sales.id);
    actions.delegateTask(s, 'sponsoring', sales.id);
    s.prospects.forEach((p) => (p.interest = 60));
    const dealsBefore = s.sponsors.length;
    s = playWeeks(s, 3); // hij plant om de twee weken een gesprek
    // hij heeft iemand gesproken: er ligt een voorstel, er is er een getekend, of dat bedrijf wacht nu even
    const answered = s.sponsorOffers.length > 0 || s.sponsors.length > dealsBefore || s.prospects.some((p) => p.cooldown > 0);
    expect(answered).to.equal(true);
  });
});

describe('Sponsors', () => {
  it('een bedrijf benaderen levert volgende week een antwoord op', () => {
    let s = newTestGame();
    const target = [...s.prospects].sort((a, b) => b.interest - a.interest)[0];
    target.interest = 100;
    s.sponsors = s.sponsors.filter((d) => d.kind !== 'bord');
    expect(actions.approachProspect(s, target.id).ok).to.equal(true);
    s = playWeeks(s, 1);
    expect(s.prospects.some((p) => p.approached)).to.equal(false);
    // antwoord: een voorstel, of een afwijzing (dan moet je een tijd wachten)
    const offer = s.sponsorOffers.some((o) => o.name === target.name);
    const refused = s.prospects.find((p) => p.name === target.name)?.cooldown ?? 0;
    expect(offer || refused > 0).to.equal(true);
  });

  it('stopzetten maakt de plaats vrij', () => {
    const s = newTestGame();
    const main = s.sponsors.find((d) => d.kind === 'hoofdsponsor')!;
    expect(actions.cancelSponsor(s, main.id).ok).to.equal(true);
    expect(s.sponsors.some((d) => d.kind === 'hoofdsponsor')).to.equal(false);
  });

  it('extra bijdrage vragen kan maar één keer per seizoen', () => {
    const s = newTestGame();
    const deal = s.sponsors[0];
    actions.askExtra(s, deal.id);
    const again = actions.askExtra(s, deal.id);
    expect(again.ok).to.equal(false);
    expect(again.message).to.include('al');
  });
});

describe('Strategie', () => {
  it('elk spelplan is sterk tegen twee en zwak tegen twee andere', () => {
    for (const a of PLANS) {
      const wins = PLANS.filter((b) => matchup(a, b) === 1).length;
      const losses = PLANS.filter((b) => matchup(a, b) === -1).length;
      expect(wins).to.equal(2);
      expect(losses).to.equal(2);
      for (const b of PLANS) expect(matchup(a, b)).to.equal(-matchup(b, a));
    }
  });

  it('een gunstig spelplan maakt je sterker dan een ongunstig', () => {
    const s = newTestGame();
    actions.setPlan(s, 'counter');
    const good = teamStrength(s, { strength: 52, plan: 'balbezit' });
    const bad = teamStrength(s, { strength: 52, plan: 'lange bal' });
    expect(good.matchup).to.equal(1);
    expect(bad.matchup).to.equal(-1);
    expect(good.total).to.be.above(bad.total);
  });

  it('meer trainingen kosten meer en maken scherper', () => {
    let s = newTestGame();
    actions.setTrainings(s, 5);
    expect(teamStrength(s).sharpness).to.be.above(0);
    s = playWeeks(s, 1);
    const cost = s.lastWeek.find((e) => e.category === 'trainingen')!.amount;
    expect(cost).to.equal(-5 * (60 + s.league.divisionLevel * 30));
    expect(actions.setTrainings(s, 7).ok).to.equal(false);
  });

  it('als de T1 de strategie regelt, zijn alle keuzes vergrendeld', () => {
    const s = newTestGame();
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    trainer.skill = 88; // genoeg ervaring om drie taken te dragen
    for (const task of ['opstelling', 'training', 'tactiek'] as const) expect(actions.delegateTask(s, task, trainer.id).ok, task).to.equal(true);
    for (const r of [actions.setPlan(s, 'pressing'), actions.setTrainings(s, 4), actions.setFocus(s, 'herstel'), actions.setMentality(s, 'verdedigend'), actions.toggleStarter(s, s.players[0].id)]) {
      expect(r.ok).to.equal(false);
      expect(r.message).to.include(trainer.name);
    }
  });

  it('de T1 kiest een spelplan dat niet verliest van het verwachte plan', () => {
    let s = newTestGame();
    const analyst = s.staffMarket.find((x) => x.role === 'analist')!;
    analyst.skill = 90;
    s.infrastructure.wifiLevel = 1; // een analist heeft wifi nodig
    expect(actions.hireStaff(s, analyst.id).ok).to.equal(true);
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    trainer.skill = 95;
    for (const task of ['opstelling', 'training', 'tactiek'] as const) actions.delegateTask(s, task, trainer.id);
    s = playWeeks(s, 6); // tot vlak voor de eerste speeldag
    const opp = nextOpponent(s)!;
    s = playWeeks(s, 1);
    expect(opp.knownPlan).to.equal(s.lastMatch!.theirPlan); // de analist kende hun plan
    expect(s.lastMatch!.matchup).to.be.at.least(0);
  });
});

describe('Lidgeld jeugd', () => {
  it('een hoger lidgeld geeft minder leden', () => {
    const s = newTestGame();
    expect(actions.youthForecast(s, 400)).to.be.below(actions.youthForecast(s, 150));
  });

  it('de inschrijvingen in week 10 gebruiken het gekozen lidgeld', () => {
    let s = newTestGame();
    actions.setYouthFee(s, 300);
    const expected = actions.youthForecast(s);
    s = playWeeks(s, 10);
    const entry = s.lastWeek.find((e) => e.category === 'lidgelden')!;
    // de prognose beweegt lichtjes mee met populariteit en sfeer in die tien weken
    expect(s.community.youthMembers).to.be.within(expected * 0.9, expected * 1.1);
    expect(entry.amount).to.equal(s.community.youthMembers * 300);
  });
});

describe('Vermoeidheid', () => {
  it('meer trainingen maken spelers vermoeider', () => {
    let light = newTestGame('zuidrand', 'aannemer', 7);
    let heavy = newTestGame('zuidrand', 'aannemer', 7);
    actions.setTrainings(light, 2);
    actions.setTrainings(heavy, 5);
    light = playWeeks(light, 10);
    heavy = playWeeks(heavy, 10);
    const avg = (s: typeof light) => s.players.reduce((a, p) => a + p.fatigue, 0) / s.players.length;
    expect(avg(heavy)).to.be.above(avg(light));
  });

  it('vermoeide spelers verlagen aanval en verdediging', () => {
    const s = newTestGame();
    const fresh = teamStrength(s);
    s.players.forEach((p) => (p.fatigue = 60));
    const tired = teamStrength(s);
    expect(tired.fatigueFactor).to.be.below(1);
    expect(tired.attack).to.be.below(fresh.attack);
    expect(tired.defense).to.be.below(fresh.defense);
  });

  it('een conditietrainer laat spelers sneller herstellen', () => {
    let a = newTestGame('zuidrand', 'aannemer', 3);
    let b = newTestGame('zuidrand', 'aannemer', 3);
    b.staff.push({ ...b.staff[0], id: 'ct', role: 'conditietrainer', skill: 80 });
    a = playWeeks(a, 12);
    b = playWeeks(b, 12);
    const avg = (s: typeof a) => s.players.reduce((x, p) => x + p.fatigue, 0) / s.players.length;
    expect(avg(b)).to.be.below(avg(a));
  });
});

describe('Scouting en weekoverzicht', () => {
  it('het scoutingrapport toont stand, vorm en gespeelde spelplannen', () => {
    const s = playWeeks(newTestGame(), 12);
    const r = scoutingReport(s)!;
    expect(r.position).to.be.within(1, 16);
    expect(r.form.length).to.be.within(1, 5);
    expect(r.recentPlans.length).to.equal(r.form.length);
  });

  it('elke week wordt per categorie bijgehouden', () => {
    const s = playWeeks(newTestGame(), 5);
    expect(s.weekHistory).to.have.lengthOf(5);
    expect(s.weekHistory[4].week).to.equal(5);
    expect(s.weekHistory[4].totals['lonen spelers']).to.be.below(0);
  });

  it('de sponsorvermenigvuldiger is het product van de getoonde factoren', () => {
    const s = newTestGame();
    const [min] = kindRange(s, 'shirt');
    expect(Math.abs(min - 250 * product(sponsorFactors(s)))).to.be.below(5);
  });
});

describe('Kaarten, schorsingen en forfait', () => {
  it('na 5 gele kaarten volgt een schorsing en de speler speelt niet', () => {
    const s = newTestGame();
    const p = s.players.find((x) => x.position === 'MIDD')!;
    p.yellowCards = 4;
    // geef hem kaarten tot de schorsing valt
    let guard = 0;
    while (p.suspended === 0 && guard++ < 200) cardsForOwnTeam(s, createRng(s), [p], false);
    expect(p.suspended).to.be.at.least(1);
    const { lineup } = selectLineup(s.players, s.tactics.formation, [p.id]);
    expect(lineup.map((x) => x.id)).to.not.include(p.id);
  });

  it('een schorsing wordt uitgezeten in de volgende wedstrijd', () => {
    let s = playWeeks(newTestGame(), 6);
    const p = s.players[3];
    p.suspended = 1;
    s = playWeeks(s, 1); // speeldag in week 7
    expect(s.players.find((x) => x.id === p.id)!.suspended).to.equal(0);
  });

  it('met minder dan 11 beschikbare spelers volgt forfait (0-5) en een boete', () => {
    let s = playWeeks(newTestGame(), 6);
    s.players.slice(0, 12).forEach((p) => (p.injuryWeeks = 5));
    s = playWeeks(s, 1);
    expect(s.lastMatch!.forfeit).to.equal(true);
    expect(s.lastMatch!.goalsAgainst).to.equal(5);
    expect(s.lastWeek.some((e) => e.label.startsWith('Forfaitboete'))).to.equal(true);
  });

  it('ook spelers van andere ploegen krijgen kaarten', () => {
    const s = playWeeks(newTestGame(), 20);
    const teams = new Set(s.league.discipline.map((d) => d.teamId));
    expect(teams.size).to.be.above(5);
    expect(s.players.some((p) => p.yellowCards > 0)).to.equal(true);
  });
});

describe('Herstel en limieten', () => {
  it('een verzorger en recuperatieruimte verlagen de vermoeidheid', () => {
    let a = newTestGame('zuidrand', 'aannemer', 9);
    let b = newTestGame('zuidrand', 'aannemer', 9);
    b.staff.push({ ...b.staff[0], id: 'vz', role: 'verzorger', skill: 70 });
    b.infrastructure.recoveryLevel = 2;
    a = playWeeks(a, 15);
    b = playWeeks(b, 15);
    const avg = (s: typeof a) => s.players.reduce((x, p) => x + p.fatigue, 0) / s.players.length;
    expect(avg(b)).to.be.below(avg(a));
  });

  it('maximaal één evenement per week', () => {
    const s = newTestGame('heidebeke');
    expect(actions.organiseEvent(s, 'quiz').ok).to.equal(true);
    const second = actions.organiseEvent(s, 'koekjes');
    expect(second.ok).to.equal(false);
    expect(second.message).to.include('per week');
  });

  it('een evenement heeft een maximum per seizoen', () => {
    let s = newTestGame('heidebeke');
    const def = CLUB_EVENTS.find((e) => e.id === 'mosselfeest')!;
    s.community.volunteers = 60;
    s.cash = 1_000_000;
    expect(actions.organiseEvent(s, 'mosselfeest').ok).to.equal(true);
    s = playWeeks(s, def.cooldown + 1);
    const again = actions.organiseEvent(s, 'mosselfeest');
    expect(again.ok).to.equal(false);
    expect(again.message).to.include('per seizoen');
  });
});

describe('Evolutie, verkopen en huren', () => {
  it('veel spelen en trainen doet groeien, niet spelen en weinig trainen doet dalen', () => {
    const s = newTestGame();
    const young = s.players.find((p) => p.age <= 23 && p.potential > overall(p) + 5) ?? s.players[0];
    expect(playEffect(young, 1)).to.be.above(0);
    expect(playEffect(young, 0)).to.be.below(0);
    expect(trainingEffect(5)).to.be.above(0);
    expect(trainingEffect(2)).to.be.below(0);
  });

  it('elke 4 weken krijgt elke speler een trend', () => {
    const s = playWeeks(newTestGame(), 12);
    expect(s.players.some((p) => p.trend !== 0)).to.equal(true);
    expect(s.news.some((n) => n.text.startsWith('Spelersevolutie'))).to.equal(true);
  });

  it('basisspelers krijgen speeltijd bij', () => {
    const s = playWeeks(newTestGame(), 10);
    expect(Math.max(...s.players.map((p) => p.starts))).to.be.at.least(3);
  });

  it('een speler uitlenen: de andere club betaalt mee en hij speelt niet voor jou', () => {
    let s = newTestGame();
    const p = [...s.players].sort((a, b) => overall(b) - overall(a))[5];
    expect(actions.loanOut(s, p.id).ok).to.equal(true);
    const { lineup } = selectLineup(s.players, s.tactics.formation, [p.id]);
    expect(lineup.map((x) => x.id)).to.not.include(p.id);
    expect(actions.sellPlayer(s, p.id).ok).to.equal(false);
    s = playWeeks(s, 1);
    const wages = -s.lastWeek.find((e) => e.category === 'lonen spelers')!.amount;
    const full = s.players.reduce((a, x) => a + x.wage, 0);
    expect(wages).to.be.below(full);
  });

  it('een huurspeler komt en vertrekt op het einde van het seizoen', () => {
    let s = newTestGame();
    s.cash = 1_000_000;
    expect(s.loanMarket.length).to.be.above(0);
    const target = s.loanMarket[0];
    expect(actions.loanIn(s, target.id).ok).to.equal(true);
    expect(s.players.some((x) => x.id === target.id)).to.equal(true);
    s = playWeeks(s, 52);
    expect(s.players.some((x) => x.id === target.id)).to.equal(false);
  });

  it('een speler te koop zetten', () => {
    const s = newTestGame();
    const p = s.players[2];
    expect(actions.listPlayer(s, p.id, 5000).ok).to.equal(true);
    expect(p.listed).to.equal(true);
    expect(actions.unlistPlayer(s, p.id).ok).to.equal(true);
    expect(p.listed).to.equal(false);
  });
});

describe('Fanshop', () => {
  it('opstarten kost geld en zet meteen sjaals in de rekken', () => {
    const s = newTestGame();
    s.cash = 100_000;
    const before = s.cash;
    expect(actions.startMerch(s).ok).to.equal(true);
    expect(s.merch.active).to.equal(true);
    expect(s.merch.items.map((i) => i.id)).to.include('sjaal');
    expect(s.cash).to.be.below(before - MERCH_START_COST + 1);
    expect(actions.startMerch(s).ok).to.equal(false);
  });

  it('een artikel toevoegen en weer weghalen', () => {
    const s = newTestGame();
    s.cash = 100_000;
    actions.startMerch(s);
    expect(actions.addMerchItem(s, 'mok').ok).to.equal(true);
    expect(actions.addMerchItem(s, 'mok').ok).to.equal(false);
    expect(actions.removeMerchItem(s, 'mok').ok).to.equal(true);
    expect(s.merch.items.some((i) => i.id === 'mok')).to.equal(false);
  });

  it('een hogere prijs betekent minder verkoop', () => {
    const s = newTestGame();
    s.cash = 100_000;
    actions.startMerch(s);
    const item = s.merch.items[0];
    actions.setMerchPrice(s, item.id, 12);
    const cheap = expectedUnits(s, item);
    actions.setMerchPrice(s, item.id, 30);
    expect(expectedUnits(s, item)).to.be.below(cheap);
  });

  it('verkoopt tijdens de week en boekt omzet en inkoop', () => {
    let s = newTestGame();
    s.cash = 100_000;
    actions.startMerch(s);
    actions.addMerchItem(s, 'tshirt');
    s = playWeeks(s, 10);
    const revenue = s.weekHistory.reduce((sum, w) => sum + (w.totals['merchandising'] ?? 0), 0);
    const cost = s.weekHistory.reduce((sum, w) => sum + (w.totals['inkoop shop'] ?? 0), 0);
    expect(revenue).to.be.above(0);
    expect(cost).to.be.below(0);
    expect(s.merch.seasonUnits).to.be.above(0);
  });

  it('de beste prijs ligt boven de inkoopprijs en rond de richtprijs', () => {
    const s = newTestGame();
    const best = bestPrice(s, 'sjaal');
    expect(best).to.be.above(merchDef('sjaal').buy);
    expect(best).to.be.within(10, 30);
  });
});

describe('Leeftijd en evolutie', () => {
  it('jonger is meer groei; vanaf 31 jaar groeit niemand nog', () => {
    expect(growthFactor(17)).to.be.above(1); // tieners krijgen een extra duw
    expect(growthFactor(20)).to.be.above(growthFactor(24));
    expect(growthFactor(24)).to.be.above(growthFactor(28));
    expect(growthFactor(31)).to.equal(0);
    expect(growthFactor(34)).to.equal(0);
  });

  it('achteruitgang begint pas rond 27 en versnelt', () => {
    expect(declineFactor(25)).to.equal(0);
    expect(declineFactor(31)).to.be.above(0);
    expect(declineFactor(35)).to.be.above(declineFactor(31));
  });

  it('speeltijd weegt zwaarder bij jonge spelers', () => {
    const young = playEffect({ age: 18 } as never, 1);
    const old = playEffect({ age: 33 } as never, 1);
    expect(young).to.be.above(old);
  });
});

describe('Kern van de ploeg beschermen', () => {
  it('je laatste doelmannen kun je niet verkopen of uitlenen', () => {
    const s = newTestGame();
    s.cash = 500_000;
    const keepers = s.players.filter((p) => p.position === 'DOEL');
    expect(keepers.length).to.be.at.least(3);
    // tot er nog twee over zijn, mag het
    expect(actions.sellPlayer(s, keepers[0].id).ok).to.equal(true);
    const left = s.players.filter((p) => p.position === 'DOEL');
    const result = actions.sellPlayer(s, left[0].id);
    expect(result.ok).to.equal(false);
    expect(result.message).to.include('doelman');
    expect(actions.loanOut(s, left[0].id).ok).to.equal(false);
  });

  it('onder 16 spelers mag niemand vertrekken', () => {
    const s = newTestGame();
    while (s.players.length > 16) {
      const spare = s.players.find((p) => !actions.departureBlockReason(s, p));
      if (!spare) break;
      actions.sellPlayer(s, spare.id);
    }
    expect(s.players.length).to.be.at.least(16);
    for (const p of s.players) expect(actions.departureBlockReason(s, p)).to.be.a('string');
  });
});

describe('Contracten', () => {
  it('te weinig bieden wordt geweigerd en kost moraal', () => {
    const s = newTestGame();
    const p = s.players.find((x) => x.contractUntil <= s.season) ?? s.players[0];
    p.morale = 60;
    const ask = actions.askingWage(s, p);
    const before = p.morale;
    const result = actions.extendContract(s, p.id, Math.round(ask * 0.5));
    expect(result.ok).to.equal(false);
    expect(p.morale).to.be.below(before);
  });

  it('royaal bieden geeft een hoge kans en een blije speler', () => {
    const s = newTestGame();
    const p = s.players[1];
    const ask = actions.askingWage(s, p);
    const effect = actions.wageOfferEffect(s, p, Math.round(ask * 1.3));
    expect(effect.chance).to.be.above(0.9);
    expect(effect.morale).to.be.above(0);
  });
});

describe('Kantine en concessies', () => {
  it('een hogere prijs betekent minder consumpties', () => {
    const s = newTestGame();
    actions.setCanteenPrice(s, 'pils', 2);
    const cheap = expectedCanteenUnits(s, 'pils', 400);
    actions.setCanteenPrice(s, 'pils', 5);
    expect(expectedCanteenUnits(s, 'pils', 400)).to.be.below(cheap);
  });

  it('een te hoge marge wordt geweigerd door de standhouder', () => {
    const s = newTestGame();
    expect(actions.openConcession(s, 'frituur', 55).ok).to.equal(false);
    expect(actions.openConcession(s, 'frituur', acceptedMargin(s, 'frituur')).ok).to.equal(true);
    expect(s.canteen.concessions).to.have.lengthOf(1);
  });

  it('een thuiswedstrijd levert kantine- en concessieomzet op', () => {
    let s = newTestGame();
    actions.openConcession(s, 'hotdog', acceptedMargin(s, 'hotdog'));
    s = playWeeks(s, 10);
    const canteen = s.weekHistory.reduce((sum, w) => sum + (w.totals['kantine'] ?? 0), 0);
    const stands = s.weekHistory.reduce((sum, w) => sum + (w.totals['horeca concessies'] ?? 0), 0);
    expect(canteen).to.be.above(0);
    expect(stands).to.be.above(0);
    expect(s.stats.canteen.pils).to.be.above(0);
    expect(s.stats.tickets).to.be.above(0);
  });
});

describe('Spelersrollen', () => {
  it('een kapitein met leiderschap maakt de ploeg sterker', () => {
    const s = newTestGame();
    const before = teamStrength(s).total;
    const leader = selectLineup(s.players, s.tactics.formation).lineup[0];
    leader.trait = 'leider';
    actions.setPlayerRole(s, 'kapitein', leader.id);
    expect(teamStrength(s).total).to.be.above(before);
  });

  it('een uitgeleende speler kan geen rol krijgen', () => {
    const s = newTestGame();
    const p = s.players[5];
    p.loan = { type: 'uit', club: 'KFC Test', untilSeason: s.season, wageShare: 0.5 };
    expect(actions.setPlayerRole(s, 'strafschop', p.id).ok).to.equal(false);
  });
});

describe('Populariteit en onderhoud', () => {
  it('populariteit weegt op de verwachte opkomst', () => {
    const s = newTestGame();
    const before = expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    s.community.fanMood = 95;
    s.community.reputation = 95;
    expect(expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 })).to.be.above(before);
  });

  it('minder onderhoud is goedkoper maar riskanter', () => {
    const s = newTestGame();
    const normal = facilityCost(s);
    actions.setMaintenance(s, 'basis');
    expect(facilityCost(s)).to.be.below(normal);
    expect(breakdownChance(s)).to.be.above(0.02);
    actions.setMaintenance(s, 'premium');
    expect(facilityCost(s)).to.be.above(normal);
  });

  it('zonnepanelen verlagen de vaste kosten blijvend', () => {
    const s = newTestGame();
    const before = facilityCost(s);
    expect(actions.investGreenEnergy(s).ok).to.equal(true);
    expect(facilityCost(s)).to.be.below(before);
  });
});

describe('Vrijwilligers en logboek', () => {
  it('ontevreden vrijwilligers haken af', () => {
    let s = newTestGame();
    s.community.fanMood = 5;
    s.community.reputation = 5;
    const before = s.community.volunteers;
    s = playWeeks(s, 20);
    expect(s.community.volunteers).to.be.below(before);
  });

  it('een extra bijdrage komt pas volgende week en staat in het logboek', () => {
    let s = newTestGame();
    const deal = s.sponsors.find((d) => d.kind !== 'stadion')!;
    const cash = s.cash;
    expect(actions.askExtra(s, deal.id).ok).to.equal(true);
    expect(s.cash).to.equal(cash); // nog niets ontvangen
    expect(s.requests).to.have.lengthOf(1);
    s = playWeeks(s, 1);
    expect(s.requests).to.have.lengthOf(0);
    expect(s.log.some((l) => l.kind === 'antwoord')).to.equal(true);
  });
});

describe('Onderhandelen en inflatie', () => {
  it('blijven laagbieden werkt niet: hij vraagt meer en haakt af', () => {
    const s = newTestGame();
    const p = s.players.find((x) => x.contractUntil <= s.season + 1)!;
    p.morale = 70;
    const firstAsk = actions.askingWage(s, p);
    for (let i = 0; i < actions.MAX_NEGOTIATIONS; i++) expect(actions.extendContract(s, p.id, 40).ok).to.equal(false);
    expect(p.negotiations).to.be.at.least(2);
    expect(actions.askingWage(s, p)).to.be.above(firstAsk);
    expect(p.morale).to.be.below(70);
    // hij praat niet meer, ook niet als je plots heel royaal wordt
    expect(actions.extendContract(s, p.id, 10_000).ok).to.equal(false);
  });

  it('kosten stijgen elk seizoen', () => {
    let s = newTestGame();
    const before = facilityCost(s);
    s = playWeeks(s, 52);
    expect(s.inflation).to.be.above(1);
    expect(facilityCost(s)).to.be.above(before);
  });
});

describe('Cijfers per week', () => {
  it('houdt aantallen en opbrengst per week bij', () => {
    let s = newTestGame();
    s.cash = 200_000;
    actions.startMerch(s);
    s = playWeeks(s, 9);
    expect(s.statsWeeks.length).to.equal(9);
    const matchWeek = s.statsWeeks.find((w) => w.tickets > 0);
    expect(matchWeek, 'een week met een thuiswedstrijd').to.not.equal(undefined);
    expect(matchWeek!.canteen).to.be.above(0);
    expect(matchWeek!.revenue.kantine).to.be.above(0);
  });
});

describe('Ontgrendelingen', () => {
  it('een kinesist kan pas met een recuperatieruimte, een analist pas met wifi', () => {
    const s = newTestGame();
    expect(actions.staffLock(s, 'kinesist')).to.be.a('string');
    expect(actions.staffLock(s, 'analist')).to.be.a('string');
    s.infrastructure.recoveryLevel = 1;
    s.infrastructure.wifiLevel = 1;
    expect(actions.staffLock(s, 'kinesist')).to.equal(null);
    expect(actions.staffLock(s, 'analist')).to.equal(null);
  });

  it('het scorebord is een bouwproject dat sponsors meer waard vindt', () => {
    const s = newTestGame();
    s.cash = 200_000;
    const before = product(sponsorFactors(s));
    expect(actions.startUpgrade(s, 'scorebord').ok).to.equal(true);
    s.infrastructure.scoreboardLevel = 1;
    expect(product(sponsorFactors(s))).to.be.above(before);
  });
});

describe('Sponsors: naam en sector', () => {
  it('elke sponsor en elk bedrijf heeft de sector die bij zijn naam hoort', () => {
    const s = newTestGame();
    for (const d of s.sponsors.filter((x) => x.kind !== 'stadion')) expect(d.sector).to.equal(companySector(d.name));
    for (const p of s.prospects) expect(p.sector).to.equal(companySector(p.name));
  });
});

describe('Delegeren, sponsors en tickets', () => {
  it('elke taak kan naar iemand die in dienst is', () => {
    const s = newTestGame();
    for (const t of TASKS) expect(t.roles.length, t.id).to.be.at.least(1);
    const kantine = s.staffMarket.find((x) => x.role === 'kantine')!;
    s.infrastructure.kantineLevel = 3;
    expect(actions.hireStaff(s, kantine.id).ok).to.equal(true);
    const theirs = TASKS.filter((t) => t.roles.includes('kantine'));
    expect(theirs.length).to.be.at.least(3);
    const capacity = taskCapacity(kantine);
    theirs.forEach((t, i) => {
      const result = actions.delegateTask(s, t.id, kantine.id);
      expect(result.ok, `${t.id} (plaats ${i + 1} van ${capacity})`).to.equal(i < capacity);
    });
    expect(tasksOf(s, kantine.id).length).to.equal(capacity);
  });

  it('de jeugdcoördinator kiest een lidgeld dat meer opbrengt dan het uiterste', () => {
    const s = newTestGame();
    const coach = s.staffMarket.find((x) => x.role === 'jeugdcoordinator')!;
    coach.skill = 80;
    s.community.youthMembers = 120;
    actions.hireStaff(s, coach.id);
    actions.delegateTask(s, 'jeugd', coach.id);
    runDelegatedTasks(s, createRng(s));
    expect(s.youthFee).to.be.within(100, 500);
    expect(actions.youthForecast(s) * s.youthFee).to.be.above(actions.youthForecast(s, 500) * 500 * 0.9);
  });

  it('de kinesist schroeft de belasting terug bij een vermoeide groep', () => {
    const s = newTestGame();
    s.infrastructure.recoveryLevel = 1;
    const kine = s.staffMarket.find((x) => x.role === 'kinesist')!;
    actions.hireStaff(s, kine.id);
    actions.delegateTask(s, 'medisch', kine.id);
    actions.setTrainings(s, 5);
    for (const p of s.players) p.fatigue = 60;
    runDelegatedTasks(s, createRng(s));
    expect(s.tactics.trainings).to.be.below(5);
    expect(s.tactics.focus).to.equal('herstel');
  });

  it('er zijn meer soorten sponsorplaatsen dan alleen hoofdsponsor', () => {
    const s = newTestGame();
    const kinds = new Set(SECTORS.map(([, k]) => k));
    expect(kinds.size).to.be.at.least(6);
    const big = SECTORS.filter(([, k]) => k === 'hoofdsponsor').length;
    const shirt = SECTORS.filter(([, k]) => k === 'shirt').length;
    expect(big).to.be.at.most(shirt + 1); // geen overschot aan hoofdsponsors
    expect(KIND_MAX.bord).to.be.above(KIND_MAX.hoofdsponsor);
    s.infrastructure.kantineLevel = 1;
    expect(kindLock(s, 'scherm')).to.be.a('string'); // vraagt eerst een betere kantine
    s.infrastructure.kantineLevel = 3;
    expect(kindLock(s, 'scherm')).to.equal(null);
  });

  it('ticketinkomsten en het aandeel van de bezoekers staan apart', () => {
    let s = newTestGame();
    actions.setTicketPrice(s, 8);
    s = playWeeks(s, 9);
    const match = s.lastMatch;
    if (!match || !match.home) return; // week 9 is niet altijd thuis
    const tickets = s.lastWeek.find((e) => e.category === 'tickets')!;
    expect(tickets.amount).to.equal(match.attendance * 8);
    const share = s.lastWeek.find((e) => e.label.includes('Aandeel bezoekers'))!;
    expect(share.amount).to.equal(-Math.round(match.attendance * 8 * AWAY_SHARE));
  });

  it('een uitgeleende speler kun je nog altijd een nieuw contract geven', () => {
    const s = newTestGame();
    const p = s.players.find((x) => x.contractUntil <= s.season)!;
    p.loan = { type: 'uit', club: 'KFC Test', untilSeason: s.season, wageShare: 0.5 };
    const result = actions.extendContract(s, p.id, actions.askingWage(s, p) * 1.5);
    expect(result.ok).to.equal(true);
    expect(p.contractUntil).to.be.above(s.season);
  });
});

describe('Taken en specialisatie', () => {
  it('buiten zijn vakgebied werkt iemand op een lager niveau', () => {
    const s = newTestGame();
    s.infrastructure.kantineLevel = 3;
    const kantine = s.staffMarket.find((x) => x.role === 'kantine')!;
    kantine.skill = 70;
    actions.hireStaff(s, kantine.id);
    const own = taskSkill(s, 'horeca', kantine); // kantine staat eerst bij deze taak
    const other = taskSkill(s, 'merchandising', kantine); // daar is hij derde keuze
    expect(own).to.be.above(other);
    expect(other).to.be.below(kantine.skill);
  });

  it('hoe beter het staflid, hoe meer taken hij aankan', () => {
    const s = newTestGame();
    const weak = { ...s.staff[0], skill: 30 };
    const strong = { ...s.staff[0], skill: 90 };
    expect(taskCapacity(weak)).to.equal(1);
    expect(taskCapacity(strong)).to.equal(4);
  });
});

describe('Mijlpalen, thuisvoordeel en groei', () => {
  it('een mijlpaal komt één keer voor en levert iets op', () => {
    const s = newTestGame();
    s.community.fanBase = 600;
    const cash = s.cash;
    const hit = checkMilestones(s);
    expect(hit.some((m) => m.id === 'fans-500')).to.equal(true);
    expect(s.cash).to.be.above(cash);
    expect(checkMilestones(s).some((m) => m.id === 'fans-500')).to.equal(false);
  });

  it('thuisploegen scoren gemiddeld meer dan uitploegen', () => {
    const rng = createRng(newTestGame());
    let home = 0;
    let away = 0;
    for (let i = 0; i < 400; i++) {
      const [h, a] = simulateMatch(rng, side(55), side(55));
      home += h;
      away += a;
    }
    expect(home).to.be.above(away);
  });

  it('een ploeg die wint, groeit sneller in supporters', () => {
    const win = newTestGame();
    const lose = newTestGame();
    for (const s of [win, lose]) {
      s.community.fanBase = 300;
      s.community.reputation = 60;
    }
    // doe alsof alle gespeelde wedstrijden gewonnen (of verloren) zijn
    const fake = (s: typeof win, won: boolean) => {
      for (const f of s.league.fixtures.filter((x) => x.week <= 12 && (x.homeId === 'club' || x.awayId === 'club'))) {
        const home = f.homeId === 'club';
        f.homeGoals = home === won ? 2 : 0;
        f.awayGoals = home === won ? 0 : 2;
      }
    };
    fake(win, true);
    fake(lose, false);
    const grown = (s: typeof win) => {
      let g = s;
      for (let i = 0; i < 10; i++) g = advanceWeek(g);
      return g.community.fanBase;
    };
    expect(grown(win)).to.be.above(grown(lose));
  });
});

describe('Records en reeksen', () => {
  it('houdt de reeks zonder nederlaag bij', () => {
    const s = newTestGame();
    for (const f of s.league.fixtures.filter((x) => x.week <= 12 && (x.homeId === 'club' || x.awayId === 'club'))) {
      const home = f.homeId === 'club';
      f.homeGoals = home ? 2 : 0;
      f.awayGoals = home ? 0 : 2;
    }
    const streak = currentStreak(s);
    expect(streak.wins).to.be.at.least(3);
    expect(streak.unbeaten).to.equal(streak.wins);
  });

  it('een recordopkomst wordt één keer gevierd', () => {
    let s = newTestGame();
    s = playWeeks(s, 9);
    expect(s.records.attendance).to.be.above(0);
    const before = s.records.attendance;
    s.lastMatch = { ...s.lastMatch!, home: true, week: s.week, attendance: before + 50 };
    const broken = checkRecords(s);
    expect(broken.some((b) => b.includes('Recordopkomst'))).to.equal(true);
    expect(checkRecords(s).some((b) => b.includes('Recordopkomst'))).to.equal(false);
  });
});
