import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { CLUB_EVENTS, MERCH_START_COST, TASKS, merchDef } from '../src/engine/data/catalog';
import { newTestGame, playWeeks } from './helpers';
import { transferWillingness } from '../src/engine/appeal';
import { FORMATIONS, POSITIONS, declineFactor, growthFactor, lineupGap, overall, pickScorers, playEffect, selectLineup, teamStrength, trainingEffect } from '../src/engine/players';
import { bestPrice, expectedUnits, refPrice } from '../src/engine/merch';
import { acceptedMargin, expectedCanteenUnits } from '../src/engine/canteen';
import { AWAY_SHARE, expectedAttendance, facilityCost } from '../src/engine/finance';
import { injuryFactors } from '../src/engine/factors';
import { SECTORS } from '../src/engine/data/names';
import { runDelegatedTasks, taskCapacity, taskSkill, tasksOf } from '../src/engine/delegation';
import { PLANS, matchup, nextOpponent, scoutingReport } from '../src/engine/strategy';
import { product, sponsorFactors } from '../src/engine/factors';
import { KIND_MAX, companySector, kindLock, kindRange, sponsorsAfterSeason } from '../src/engine/sponsors';
import { cardsForOwnTeam } from '../src/engine/discipline';
import { createRng } from '../src/engine/rng';
import { checkMilestones } from '../src/engine/milestones';
import { checkRecords, currentStreak } from '../src/engine/records';
import { createLeague, rivalTeam, simulateMatch, side, teamLevel } from '../src/engine/league';
import { advanceWeek, seasonPrize } from '../src/engine/turn';
import { ambitionDef, chooseAmbition, settleSeason } from '../src/engine/opening';
import { boundVolunteers, freeVolunteers, maxYouthTeams, teamsFor, youthShortage } from '../src/engine/youth';
import { volunteerSatisfaction, weeksIdle } from '../src/engine/turn';
import { MOMENT_COOLDOWN, answerWeekChoice } from '../src/engine/weekmoment';
import { loanOffers, loanScale } from '../src/engine/loans';
import { SAVE_VERSION } from '../src/engine/newGame';
import { migrate } from '../src/storage/save';

describe('Acties', () => {
  it('koopt een speler: interesse deze week, handtekening de volgende', () => {
    let s = newTestGame();
    s.cash = 1_000_000;
    // neem er een die zeker wil (kans 1): dan is het antwoord deterministisch ja
    const target = s.transferList.find((p) => transferWillingness(s, p).kans >= 1) ?? s.transferList[0];
    const before = s.players.length;
    const result = actions.buyPlayer(s, target.id);
    expect(result.ok).to.equal(true);
    expect(result.message).to.include('Volgende week'); // nog geen handtekening
    expect(s.players).to.have.lengthOf(before, 'hij tekent pas na het gesprek');
    expect(s.requests.some((r) => r.kind === 'transfer-koop' && r.targetId === target.id)).to.equal(true);
    s = playWeeks(s, 1);
    expect(s.players.some((p) => p.id === target.id), 'na een week is hij van jou').to.equal(true);
    expect(s.seasonTotals.transfers ?? 0).to.be.at.most(-target.purchasePrice); // de som is geboekt
    expect(s.news.some((n) => n.kind === 'viering' && n.text.includes(target.name)), 'het tekenen is een viering in het verslag').to.equal(true);
  });

  it('tekent meteen als je kern onder de elf zit (geen wachtweek naast een forfait)', () => {
    const s = newTestGame();
    s.cash = 1_000_000;
    s.players = s.players.slice(0, 9); // spoed: geen elf meer
    const target = s.transferList.find((p) => transferWillingness(s, p).kans >= 1) ?? s.transferList[0];
    expect(actions.buyPlayer(s, target.id).ok).to.equal(true);
    expect(s.players.some((p) => p.id === target.id), 'bij spoed geen gesprek maar een handtekening').to.equal(true);
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

  it('bouwt een tribune van de gekozen grootte', () => {
    let s = newTestGame();
    s.cash = 2_000_000;
    const before = s.infrastructure.capacity;
    expect(actions.startUpgrade(s, 'tribune', 600).ok).to.equal(true);
    expect(s.infrastructure.constructions[0].seats).to.equal(600);
    s = playWeeks(s, actions.tribuneWeeks(600));
    expect(s.infrastructure.capacity).to.equal(before + 600);
    expect(s.infrastructure.constructions).to.have.length(0);
  });

  it('twee bouwprojecten mogen samen lopen, een derde niet', () => {
    const s = newTestGame('zuidrand', 'fonds'); // de aannemer mag er drie, zie investors.test
    s.cash = 3_000_000;
    expect(actions.projectLimit(s)).to.equal(2);
    expect(actions.startUpgrade(s, 'tribune', 300).ok).to.equal(true);
    expect(actions.startUpgrade(s, 'kantine').ok).to.equal(true);
    const third = actions.startUpgrade(s, 'wifi');
    expect(third.ok).to.equal(false);
    expect(third.message).to.include('2 bouwprojecten');
    expect(actions.startUpgrade(s, 'kantine').ok).to.equal(false); // en niet twee keer hetzelfde
  });

  it('hoe groter de tribune, hoe goedkoper per zitje', () => {
    const s = newTestGame();
    const p100 = actions.tribunePerSeat(s, 100);
    const p1000 = actions.tribunePerSeat(s, 1000);
    const p2000 = actions.tribunePerSeat(s, 2000);
    expect(p1000).to.be.below(p100);
    expect(p2000).to.be.below(p1000);
    // een grote bestelling is minstens 45% goedkoper per zitje
    expect(p2000).to.be.below(p100 * 0.55);
    // en de korting versnelt: elke volgende honderd zitjes kosten minder dan de vorige honderd
    const marginal = (from: number, to: number) => (actions.tribuneCost(s, to) - actions.tribuneCost(s, from)) / (to - from);
    const steps = [100, 500, 1000, 1500, 2000].slice(0, -1).map((n, idx) => marginal(n, [100, 500, 1000, 1500, 2000][idx + 1]));
    for (let idx = 1; idx < steps.length; idx++) expect(steps[idx]).to.be.below(steps[idx - 1]);
    // het totaal stijgt natuurlijk wel, en grotere werken duren langer
    expect(actions.tribuneCost(s, 1000)).to.be.above(actions.tribuneCost(s, 300));
    expect(actions.tribuneWeeks(1000)).to.be.above(actions.tribuneWeeks(200));
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
    expect(s.cash).to.equal(cash - actions.eventCost(s, def));
    expect(s.pending).to.have.lengthOf(1);
    expect(s.pending[0].amount).to.be.within(min, max);
    expect(actions.organiseEvent(s, 'spaghetti').ok).to.equal(false); // wachttijd
    s = playWeeks(s, def.payoutWeeks);
    expect(s.pending).to.have.lengthOf(0);
    expect(s.seasonTotals.evenementen).to.be.above(-actions.eventCost(s, def));
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
    // de prognose beweegt mee met populariteit en sfeer in die tien weken, en de
    // inschrijvingen zelf hebben sinds 0.28.0 een toevalsmarge van ongeveer 12%
    expect(s.community.youthMembers).to.be.within(expected * 0.8, expected * 1.25);
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
    // 320 is de ondergrens van de shirtsponsor in KIND_RANGE; verandert die, dan hoort dit mee te bewegen
    const [min] = kindRange(s, 'shirt');
    expect(Math.abs(min - 320 * product(sponsorFactors(s)))).to.be.below(5);
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

  it('een huurspeler komt (na het gesprek) en vertrekt op het einde van het seizoen', () => {
    let s = newTestGame();
    s.cash = 1_000_000;
    expect(s.loanMarket.length).to.be.above(0);
    // huren is een gesprek: neem wie zeker wil, dan is het ja deterministisch
    const target = s.loanMarket.find((p) => transferWillingness(s, p, true).kans >= 1) ?? s.loanMarket[0];
    expect(actions.loanIn(s, target.id).ok).to.equal(true);
    expect(s.players.some((x) => x.id === target.id), 'eerst het gesprek').to.equal(false);
    s = playWeeks(s, 1);
    expect(s.players.some((x) => x.id === target.id), 'na een week is hij er').to.equal(true);
    s = playWeeks(s, 51);
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
    const revenue = s.weekHistory.reduce((sum, w) => sum + (w.totals['clubartikelen'] ?? 0), 0);
    const cost = s.weekHistory.reduce((sum, w) => sum + (w.totals['inkoop winkel'] ?? 0), 0);
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
    const risico = product(injuryFactors(s));
    actions.setMaintenance(s, 'basis');
    expect(facilityCost(s)).to.be.below(normal);
    // een verwaarloosd veld is een blessureveld, en sponsors hangen er niet graag naast
    expect(product(injuryFactors(s))).to.be.above(risico);
    actions.setMaintenance(s, 'premium');
    expect(facilityCost(s)).to.be.above(normal);
    expect(product(injuryFactors(s))).to.be.below(risico);
  });

  it('zonnepanelen zijn een bouwproject en verlagen daarna de vaste kosten', () => {
    let s = newTestGame();
    s.cash = 1_000_000;
    const before = facilityCost(s);
    expect(actions.investGreenEnergy(s).ok).to.equal(true);
    expect(s.infrastructure.solarPanels).to.equal(false); // eerst bouwen
    expect(facilityCost(s)).to.equal(before);
    s = playWeeks(s, actions.upgradeWeeks(s, 'zonnepanelen'));
    expect(s.infrastructure.solarPanels).to.equal(true);
    expect(facilityCost(s)).to.be.below(facilityCost({ ...s, infrastructure: { ...s.infrastructure, solarPanels: false } }));
  });
});

describe('Vrijwilligers en logboek', () => {
  it('ontevreden vrijwilligers haken af', () => {
    let s = newTestGame();
    s.community.fanMood = 0;
    s.community.reputation = 0;
    s.staff = s.staff.filter((x) => x.role !== 'jeugdcoordinator'); // niemand die de boel bijeenhoudt
    s = playWeeks(s, 30);
    // (er kunnen intussen ook nieuwe bijkomen via een toevalsgebeurtenis, dus we kijken naar het nieuws)
    expect(s.news.some((n) => /vrijwilligers? haa?kt? af/.test(n.text))).to.equal(true);
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
    const ref = actions.youthFeeRef(s);
    expect(s.youthFee, 'hij blijft binnen een redelijke band rond het gangbare bedrag').to.be.within(Math.round(ref * 0.5), Math.round(ref * 2.2));
    // en hij kiest beter dan allebei de uitersten van die band
    const opbrengst = (fee: number) => actions.youthTarget(s, fee) * fee;
    expect(opbrengst(s.youthFee)).to.be.above(opbrengst(Math.round(ref * 0.5)));
    expect(opbrengst(s.youthFee)).to.be.above(opbrengst(Math.round(ref * 2.2)));
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
    // de piramide: veel sectoren die een bord aankunnen, weinig die de borst aankunnen
    const borden = SECTORS.filter(([, k]) => k === 'bord').length;
    const groot = SECTORS.filter(([, k]) => k === 'hoofdsponsor').length;
    expect(borden).to.be.above(groot * 2);
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
    // Een topper doet er drie, niet vier: met vier hield je met drie goede mensen je hele
    // club draaiende en was delegeren een eenmalige aankoop in plaats van een afweging.
    const weak = { ...s.staff[0], skill: 30 };
    const middle = { ...s.staff[0], skill: 60 };
    const strong = { ...s.staff[0], skill: 90 };
    expect(taskCapacity(weak)).to.equal(1);
    expect(taskCapacity(middle)).to.equal(2);
    expect(taskCapacity(strong)).to.equal(3);
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

describe('Vergoedingen en sponsors bij promotie', () => {
  it('zonder wedstrijd betaal je alleen het vaste deel van de spelersvergoeding', () => {
    let s = newTestGame();
    s = playWeeks(s, 3); // week 3: geen competitie
    const quiet = s.lastWeek.find((e) => e.category === 'lonen spelers')!;
    s = playWeeks(s, 4); // week 7: eerste speeldag
    const matchWeek = s.lastWeek.filter((e) => e.category === 'lonen spelers').reduce((sum, e) => sum + e.amount, 0);
    expect(Math.abs(matchWeek)).to.be.above(Math.abs(quiet.amount));
    expect(quiet.label).to.include('geen wedstrijdpremie');
  });

  it('een zege kost een winstpremie', () => {
    let s = newTestGame();
    for (let i = 0; i < 40 && !s.gameOver; i++) {
      s = advanceWeek(s);
      const won = s.lastMatch && s.lastMatch.week === s.week - 1 && s.lastMatch.goalsFor > s.lastMatch.goalsAgainst;
      if (won) {
        expect(s.lastWeek.some((e) => e.label.includes('Winstpremie'))).to.equal(true);
        return;
      }
    }
  });

  it('bij promotie bieden sponsors meer of worden ze tevredener', () => {
    const s = newTestGame();
    const before = s.sponsors.filter((d) => d.kind !== 'stadion').map((d) => d.satisfaction);
    sponsorsAfterSeason(s, createRng(s), 'kampioen', s.league.divisionLevel + 1);
    const after = s.sponsors.filter((d) => d.kind !== 'stadion').map((d) => d.satisfaction);
    expect(after.every((v, i) => v >= before[i])).to.equal(true);
    expect(s.sponsorOffers.length + s.news.filter((n) => n.text.includes('promotie')).length).to.be.above(0);
  });

  it('bij degradatie zakt de tevredenheid van sponsors', () => {
    const s = newTestGame();
    const deal = s.sponsors.find((d) => d.kind !== 'stadion')!;
    const before = deal.satisfaction;
    sponsorsAfterSeason(s, createRng(s), 'degradatie', Math.max(0, s.league.divisionLevel - 1));
    expect(deal.satisfaction).to.be.below(before);
  });
});

describe('Promotie: inkomsten en kosten', () => {
  it('bij promotie stijgen de lonen van spelers en staff', () => {
    let s = newTestGame('zuidrand', 'fonds', 5);
    s = playWeeks(s, 43);
    // sinds 0.48.0 gaat een promotie alleen door mét licentie voor de nieuwe reeks
    s.infrastructure.lightingLevel = 2;
    s.infrastructure.capacity = Math.max(s.infrastructure.capacity, 900);
    for (const r of s.league.table) if (r.teamId === 'club') r.points = 999;
    const wages = s.players.reduce((t, p) => t + p.wage, 0);
    const staff = s.staff.reduce((t, x) => t + x.wage, 0);
    s = playWeeks(s, 1);
    expect(s.history[s.history.length - 1].result).to.equal('kampioen');
    expect(s.players.reduce((t, p) => t + p.wage, 0)).to.be.above(wages);
    expect(s.staff.reduce((t, x) => t + x.wage, 0)).to.be.above(staff);
    expect(s.lastWeek.some((e) => e.category === 'premies' && /premie/i.test(e.label))).to.equal(true);
  });

  it('de kampioenenpremie staat apart in de boekhouding en in de clubgeschiedenis', () => {
    let s = newTestGame('zuidrand', 'fonds', 5);
    s = playWeeks(s, 43);
    s.infrastructure.lightingLevel = 2;
    s.infrastructure.capacity = Math.max(s.infrastructure.capacity, 900);
    for (const r of s.league.table) if (r.teamId === 'club') r.points = 999;
    const level = s.league.divisionLevel;
    s = playWeeks(s, 1);
    const prize = seasonPrize(level, 'kampioen');
    // de kampioenenpremie staat als eigen boeking tussen de premies (naast eventuele doelen van het bestuur)
    const booked = s.lastWeek.filter((e) => e.category === 'premies' && /[Kk]ampioenenpremie|Prijzengeld/.test(e.label));
    expect(booked).to.have.length(1);
    expect(booked[0].amount).to.equal(prize);
    expect(s.seasonTotals.premies).to.be.at.least(prize);
    expect(s.history[s.history.length - 1].prize).to.equal(prize);
  });

  it('plaats 2 levert een kleinere premie op dan de titel', () => {
    expect(seasonPrize(1, 'kampioen')).to.equal(4_500);
    expect(seasonPrize(1, 'promotie')).to.equal(2_500);
    expect(seasonPrize(4, 'promotie')).to.be.below(seasonPrize(4, 'kampioen'));
  });

  it('de fanshop vraagt meer in een hogere reeks', () => {
    const low = newTestGame();
    const high = newTestGame();
    high.league.divisionLevel = 4;
    expect(refPrice(high, 'sjaal')).to.be.above(refPrice(low, 'sjaal'));
  });
});

describe('Seizoensopening', () => {
  it('een nieuwe club krijgt een opening met drie doelen en een voorbeschouwing', () => {
    const s = newTestGame();
    expect(s.opening).to.not.equal(null);
    expect(s.opening!.done).to.equal(false);
    expect(s.seasonGoals).to.have.length(3);
    expect(s.seasonGoals.map((g) => g.category)).to.have.members(['sportief', 'financieel', 'gemeenschap']);
    expect(s.opening!.pressPlace).to.be.within(1, s.league.table.length);
    expect(s.opening!.pressQuote).to.include(s.clubName);
    expect(s.ambition).to.equal(null);
  });

  it('de persconferentie verandert de stemming en kan maar één keer', () => {
    const s = newTestGame();
    const mood = s.community.fanMood;
    const morale = s.players.reduce((t, p) => t + p.morale, 0);
    chooseAmbition(s, 'grootspraak');
    expect(s.ambition).to.equal('grootspraak');
    expect(s.opening!.done).to.equal(true);
    expect(s.community.fanMood).to.be.above(mood);
    expect(s.players.reduce((t, p) => t + p.morale, 0)).to.be.below(morale);
  });

  it('elke keuze belooft iets anders', () => {
    expect(ambitionDef('bescheiden').place).to.be.below(0); // "niet bij de laatste drie"
    expect(ambitionDef('ambitieus').place).to.equal(5);
    expect(ambitionDef('grootspraak').place).to.equal(1);
  });

  it('een waargemaakte belofte levert geld op, een mislukte kost geld', () => {
    const win = newTestGame();
    chooseAmbition(win, 'grootspraak');
    const before = win.cash;
    settleSeason(win, 1);
    expect(win.cash).to.be.above(before);
    expect(win.lastWeek.concat(win.thisWeek).some((e) => e.category === 'premies' && /Belofte waargemaakt/.test(e.label))).to.equal(true);

    const fail = newTestGame();
    chooseAmbition(fail, 'grootspraak');
    const cash = fail.cash;
    const rep = fail.community.reputation;
    settleSeason(fail, 9);
    expect(fail.cash).to.be.below(cash);
    expect(fail.community.reputation).to.be.below(rep);
  });

  it('een behaald doel van het bestuur wordt uitbetaald', () => {
    const s = newTestGame();
    s.seasonGoals = [{ id: 'g', category: 'financieel', kind: 'kas', label: 'Test', target: 1, reward: 5_000, unit: '€' }];
    const before = s.cash;
    const out = settleSeason(s, 5);
    expect(s.cash).to.equal(before + 5_000);
    expect(out.goals[0]).to.include('✅');
  });

  it('bij een nieuw seizoen staat er een verse opening klaar', () => {
    let s = newTestGame('zuidrand', 'fonds', 5);
    chooseAmbition(s, 'ambitieus');
    s = playWeeks(s, 52);
    expect(s.season).to.equal(2);
    expect(s.opening?.season).to.equal(2);
    expect(s.opening?.done).to.equal(false);
    expect(s.ambition).to.equal(null);
    expect(s.lastSeasonSettlement).to.not.equal(null);
    expect(s.seasonGoals).to.have.length(3);
  });
});

describe('Oude opslagbestanden', () => {
  it('een bestand zonder clubrecords blijft speelbaar', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    // zoals een bestand dat door een tussenversie als versie 12 werd weggeschreven
    raw.version = 12;
    delete raw.records;
    delete raw.lastRecords;
    delete raw.statsWeeks;
    delete raw.inflation;
    const repaired = migrate(raw);
    expect(repaired.records).to.not.equal(undefined);
    expect(repaired.inflation).to.be.at.least(1);
    let g = repaired;
    for (let i = 0; i < 3; i++) g = advanceWeek(g);
    expect(g.week).to.equal(s.week + 3);
  });
});

describe('Jeugdwerking', () => {
  it('een nieuwe club heeft al ploegen en een jeugdcoördinator', () => {
    const s = newTestGame();
    expect(s.community.youthTeams).to.be.at.least(3);
    expect(s.community.youthTeams).to.be.at.most(maxYouthTeams(s));
    expect(s.staff.some((x) => x.role === 'jeugdcoordinator')).to.equal(true);
    expect(boundVolunteers(s)).to.equal(s.community.youthTeams * 2);
  });

  it('jeugdploegen binden vrijwilligers, evenementen gebruiken alleen de rest', () => {
    const s = newTestGame();
    s.community.volunteers = boundVolunteers(s) + 2;
    expect(freeVolunteers(s)).to.equal(2);
    const big = CLUB_EVENTS.find((e) => e.volunteers > 2)!;
    const result = actions.organiseEvent(s, big.id);
    expect(result.ok).to.equal(false);
    expect(result.message).to.include('vast bij de jeugd');
  });

  it('te weinig begeleiding remt de instroom en drukt de tevredenheid', () => {
    const ok = newTestGame();
    ok.community.volunteers = boundVolunteers(ok) + 6;
    const krap = newTestGame();
    krap.community.volunteers = 2;
    expect(youthShortage(krap)).to.be.above(0);
    expect(actions.youthTarget(krap)).to.be.below(actions.youthTarget(ok));
    expect(volunteerSatisfaction(krap)).to.be.below(volunteerSatisfaction(ok));
  });

  it('de accommodatie begrenst het aantal ploegen', () => {
    const s = newTestGame();
    s.community.youthMembers = 2000;
    expect(teamsFor(s)).to.equal(maxYouthTeams(s));
    const before = maxYouthTeams(s);
    s.infrastructure.academyLevel = 2;
    expect(maxYouthTeams(s)).to.equal(before + 4);
  });

  it('een coördinator aanwerven vraagt minstens drie ploegen', () => {
    const s = newTestGame();
    s.community.youthTeams = 2;
    expect(actions.staffLock(s, 'jeugdcoordinator')).to.contain('3 jeugdploegen');
    s.community.youthTeams = 4;
    expect(actions.staffLock(s, 'jeugdcoordinator')).to.equal(null);
  });

  it('ploegen volgen het ledenaantal, één stap per seizoen', () => {
    let s = newTestGame();
    s.infrastructure.academyLevel = 3; // plaats genoeg
    const before = s.community.youthTeams;
    s.community.youthMembers = 600;
    s = playWeeks(s, 11); // voorbij de inschrijvingen in week 10
    expect(s.community.youthTeams).to.equal(before + 1);
  });

  it('een oud opslagbestand krijgt ploegen die bij zijn ledenaantal passen', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 14;
    delete (raw.community as Record<string, unknown>).youthTeams;
    const repaired = migrate(raw);
    expect(repaired.community.youthTeams).to.equal(teamsFor(repaired));
  });
});

describe('Rivaliteit, weekmoment en stilstand', () => {
  it('elke reeks heeft zijn eigen clubs', () => {
    const rng = createRng({ rngState: 99 });
    const derde = createLeague(rng, 1).teams.map((t) => t.name);
    const tweede = createLeague(rng, 2).teams.map((t) => t.name);
    const overlap = derde.filter((n) => tweede.includes(n));
    expect(overlap.length).to.be.below(5); // enkel promovendi en degradanten
    expect(tweede.some((n) => !derde.includes(n))).to.equal(true);
  });

  it('er is precies één aartsrivaal', () => {
    const s = newTestGame();
    expect(s.league.teams.filter((t) => t.isRival)).to.have.length(1);
    expect(rivalTeam(s)).to.not.equal(undefined);
  });

  it('een derby levert meer volk op', () => {
    const s = newTestGame();
    const input = { weather: 'bewolkt' as const, positionFactor: 1 };
    expect(expectedAttendance(s, { ...input, derby: true })).to.be.above(expectedAttendance(s, { ...input, derby: false }));
  });

  it('het weekmoment wordt beantwoord en heeft gevolg', () => {
    let s = newTestGame();
    let guard = 0;
    while (!s.weekChoice && guard++ < 30) s = playWeeks(s, 1);
    expect(s.weekChoice, 'er komt binnen 30 weken een weekmoment').to.not.equal(null);
    const choice = s.weekChoice!;
    const outcome = answerWeekChoice(s, choice.options[0].id);
    expect(outcome).to.be.a('string');
    expect(s.weekChoice!.answer).to.equal(choice.options[0].id);
    // een tweede antwoord verandert niets meer
    expect(answerWeekChoice(s, choice.options[0].id)).to.equal(null);
    s = playWeeks(s, 1);
    expect(s.lastChoice?.title).to.equal(choice.title);
  });

  it('niets beslissen kost sfeer, beslissen niet', () => {
    // in een week zonder wedstrijd is de stilstand het enige wat aan de sfeer trekt,
    // zodat deze test niet afhangt van hoe de bal die week rolde
    const idle = newTestGame();
    idle.week = 25; // winterstop: geen wedstrijd, dus geen ruis van uitslagen
    const busy = structuredClone(idle);
    busy.log.unshift({ season: 1, week: 24, kind: 'beslissing', text: 'Ticketprijs aangepast' });
    expect(weeksIdle(idle)).to.be.at.least(10);
    expect(weeksIdle(busy)).to.be.below(2);
    const after = { idle: playWeeks(idle, 1), busy: playWeeks(busy, 1) };
    expect(after.busy.community.fanMood).to.be.above(after.idle.community.fanMood);
    expect(after.busy.community.reputation).to.be.above(after.idle.community.reputation);
  });

  it('meldt de stilstand in het nieuws zodra ze lang genoeg duurt', () => {
    const lui = playWeeks(newTestGame(), 20);
    expect(weeksIdle(lui)).to.be.at.least(10);
    expect(lui.news.some((n) => /geen beweging|stilstand|niets van het bestuur/.test(n.text))).to.equal(true);
  });

  it('houdt een actieve club over 20 weken in betere sfeer dan een stilstaande', function () {
    this.timeout(60_000);
    // Dit mat vroeger iets anders dan het beweerde: de "actieve" club paste elke week haar
    // ticketprijs aan, en die prijs trekt zelf aan de opkomst en de sfeer. Het verschil dat
    // eruit kwam ging dus over tickets, niet over stilstand, en het sloeg om zodra de
    // uitslagen anders vielen. Nu spelen beide clubs exact dezelfde wedstrijden en is het
    // enige verschil dat de ene wél beslissingen neemt.
    // Tweeëndertig partijen. Eerst waren het er zestien, maar het wisselsysteem (0.69.0)
    // verbruikt per wedstrijd extra toevalsgetallen, en zodra de twee clubs uit de pas
    // lopen (het stilstandsbericht verbruikt er zelf al één) stapelt dat verschil op.
    // Over zestien partijen kon de uitslagenruis het sfeereffect dan weer omkeren;
    // over tweeëndertig blijft het staan.
    const seeds = Array.from({ length: 32 }, (_, i) => i + 1);
    let actiefSom = 0;
    let stilSom = 0;
    for (const seed of seeds) {
      const basis = newTestGame('zuidrand', 'aannemer', seed);
      let actief = structuredClone(basis);
      let stilstaand = basis;
      for (let i = 0; i < 20; i++) {
        actief.log.unshift({ season: actief.season, week: actief.week, kind: 'beslissing', text: 'Beslissing van de week' });
        actief = playWeeks(actief, 1);
        stilstaand = playWeeks(stilstaand, 1);
      }
      expect(weeksIdle(stilstaand)).to.be.at.least(10);
      actiefSom += actief.community.fanMood;
      stilSom += stilstaand.community.fanMood;
    }
    expect(actiefSom / seeds.length).to.be.above(stilSom / seeds.length);
  });
});

describe('Wedstrijdverslag en reekssterkte', () => {
  it('elke reeks ligt duidelijk boven de vorige', () => {
    const rng = createRng({ rngState: 7 });
    const avg = (level: number) => {
      const t = createLeague(rng, level).teams.map((x) => x.strength);
      return { avg: t.reduce((a, b) => a + b, 0) / t.length, min: Math.min(...t) };
    };
    const derde = avg(1);
    const tweede = avg(2);
    const eerste = avg(3);
    expect(tweede.avg).to.be.above(derde.avg);
    expect(eerste.avg).to.be.above(tweede.avg);
    // de zwakste ploeg van een hogere reeks is sterker dan die van de reeks eronder
    expect(tweede.min).to.be.above(derde.min);
    expect(eerste.min).to.be.above(tweede.min);
  });

  it('een promovendus is niet meteen de sterkste', () => {
    const rng = createRng({ rngState: 11 });
    const promo = [...Array(40)].map(() => teamLevel(rng, 2, 'promovendus'));
    const eigen = [...Array(40)].map(() => teamLevel(rng, 2, 'eigen'));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(promo)).to.be.below(avg(eigen));
  });

  it('doelpunten krijgen een maker, meestal een aanvaller', () => {
    const s = newTestGame();
    const rng = createRng(s);
    const { lineup } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI);
    let forwards = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const scorers = pickScorers(s, lineup, 1, rng);
      expect(scorers).to.have.length(1);
      const p = lineup.find((x) => x.name === scorers[0].name)!;
      if (p.position === 'AANV') forwards++;
      total++;
    }
    expect(forwards / total).to.be.above(0.3);
    expect(s.players.reduce((t, p) => t + p.goals, 0)).to.equal(200);
  });

  it('het wedstrijdverslag bevat de opstelling en de doelpuntenmakers', () => {
    let s = newTestGame();
    let guard = 0;
    while ((!s.lastMatch || s.lastMatch.goalsFor === 0) && guard++ < 25) s = playWeeks(s, 1);
    expect(s.lastMatch!.lineup).to.have.length(11);
    expect(s.lastMatch!.scorers!.length).to.equal(s.lastMatch!.goalsFor);
    for (const g of s.lastMatch!.scorers!) expect(g.minute).to.be.within(1, 90);
  });

  it('leningen schalen mee met de reeks en de inflatie', () => {
    const klein = newTestGame();
    const groot = newTestGame();
    groot.league.divisionLevel = 4;
    groot.inflation = 1.5;
    for (const p of groot.players) p.wage *= 3;
    expect(loanScale(groot)).to.be.above(loanScale(klein) * 2);
    expect(loanOffers(groot)[0].principal).to.be.above(loanOffers(klein)[0].principal);
  });
});

describe('Nederlandse boekingscategorieën', () => {
  it('een oud bestand verhuist zijn bedragen naar de nieuwe namen', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 17;
    raw.seasonTotals = { merchandising: 5000, 'inkoop shop': -1200, 'werking shop': -300, 'lonen staff': -2000, tickets: 900 };
    raw.lastWeek = [{ category: 'lonen staff', amount: -500, label: 'Lonen staff' }];
    raw.weekHistory = [{ season: 1, week: 1, totals: { merchandising: 200 } }];
    const m = migrate(raw);
    expect(m.seasonTotals.clubartikelen).to.equal(5000);
    expect(m.seasonTotals['inkoop winkel']).to.equal(-1200);
    expect(m.seasonTotals['werking winkel']).to.equal(-300);
    expect(m.seasonTotals['lonen personeel']).to.equal(-2000);
    expect(m.seasonTotals.tickets).to.equal(900);
    expect((m.seasonTotals as Record<string, number>).merchandising).to.equal(undefined);
    expect(m.lastWeek[0].category).to.equal('lonen personeel');
    expect(m.weekHistory[0].totals.clubartikelen).to.equal(200);
  });

  it('blijft speelbaar na de omzetting', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 17;
    let g = migrate(raw);
    for (let i = 0; i < 3; i++) g = advanceWeek(g);
    expect(g.week).to.equal(s.week + 3);
    expect(g.version).to.equal(SAVE_VERSION);
  });
});

describe('Bouwprojecten uit een oud bestand', () => {
  it('een lopend project verhuist naar de nieuwe lijst', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 18;
    (raw.infrastructure as Record<string, unknown>).construction = { upgrade: 'tribune', weeksLeft: 4 };
    delete (raw.infrastructure as Record<string, unknown>).constructions;
    let g = migrate(raw);
    expect(g.infrastructure.constructions).to.have.length(1);
    expect(g.infrastructure.constructions[0].seats).to.equal(300);
    const before = g.infrastructure.capacity;
    g = playWeeks(g, 4);
    expect(g.infrastructure.capacity).to.equal(before + 300);
  });
});

describe('Basiself samenstellen', () => {
  it('een vastgezette speler staat in de basis en verdringt de zwakste van zijn linie', () => {
    const s = newTestGame();
    const keepers = s.players.filter((p) => p.position === 'DOEL' && p.injuryWeeks === 0).sort((a, b) => overall(a) - overall(b));
    const zwak = keepers[0];
    const ander = keepers[1];
    expect(actions.toggleStarter(s, zwak.id).ok).to.equal(true);
    expect(selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched).lineup.map((p) => p.id)).to.include(zwak.id);
    // nog een keeper vastzetten: de zwakste maakt plaats, geen foutmelding
    const tweede = actions.toggleStarter(s, ander.id);
    expect(tweede.ok).to.equal(true);
    expect(tweede.message).to.include('maakt plaats');
    expect(s.tactics.manualXI).to.deep.equal([ander.id]);
  });

  it('nogmaals klikken laat de speler weer los', () => {
    const s = newTestGame();
    const p = s.players[3];
    actions.toggleStarter(s, p.id);
    expect(s.tactics.manualXI).to.include(p.id);
    actions.toggleStarter(s, p.id);
    expect(s.tactics.manualXI).to.not.include(p.id);
  });

  it('wie op de bank staat, wordt niet opgesteld', () => {
    const s = newTestGame();
    const best = [...s.players].sort((a, b) => overall(b) - overall(a))[0];
    const before = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched).lineup;
    expect(before.map((p) => p.id)).to.include(best.id);
    expect(actions.toggleBench(s, best.id).ok).to.equal(true);
    const after = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup;
    expect(after.map((p) => p.id)).to.not.include(best.id);
    expect(after).to.have.length(11); // de trainer vult zijn plaats: de bank is geen uitsluitknop meer
    // en hij speelt ook echt niet mee
    const played = playWeeks(s, 7).lastMatch;
    if (played && !played.forfeit) expect(played.lineup!.map((x) => x.id)).to.not.include(best.id);
  });

  it('vastzetten en op de bank zetten sluiten elkaar uit', () => {
    const s = newTestGame();
    const p = s.players[5];
    actions.toggleBench(s, p.id);
    actions.toggleStarter(s, p.id);
    expect(s.tactics.benched).to.not.include(p.id);
    expect(s.tactics.manualXI).to.include(p.id);
  });

  it('een basisspeler op de wisselbank zetten haalt hem uit de elf, en de trainer vult aan', () => {
    // sinds het echte wisselsysteem (0.69.0) is de bank geen uitsluitknop meer: wie erop
    // staat kan invallen, en de trainer zet gewoon een ander in de basis
    const s = newTestGame();
    const keeper = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup.find(
      (p) => p.position === 'DOEL',
    )!;
    const result = actions.toggleBench(s, keeper.id);
    expect(result.message).to.include('wisselbank');
    const na = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps);
    expect(na.lineup.map((p) => p.id)).to.not.include(keeper.id);
    expect(na.lineup).to.have.length(11);
    expect(lineupGap(s).openTotal).to.equal(0);
  });

  it('van de bank halen maakt hem weer opstelbaar, zonder gaten', () => {
    const s = newTestGame();
    const starter = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup[3];
    actions.toggleBench(s, starter.id);
    expect(lineupGap(s).openTotal).to.equal(0);
    actions.toggleBench(s, starter.id);
    expect(s.tactics.benched).to.have.length(0);
    expect(selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup).to.have.length(11);
  });

  it('de wisselbank is vol bij vijf spelers', () => {
    const s = newTestGame();
    const fit = s.players.filter((p) => p.injuryWeeks === 0 && p.suspended === 0);
    for (let i = 0; i < 5; i++) expect(actions.toggleBench(s, fit[i].id).ok).to.equal(true);
    const zesde = actions.toggleBench(s, fit[5].id);
    expect(zesde.ok).to.equal(false);
    expect(zesde.message).to.include('vol');
  });

  it('een reservespeler op de bank zetten verandert niets aan je elftal', () => {
    const s = newTestGame();
    const xi = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup.map((p) => p.id);
    const reserve = s.players.find((p) => !xi.includes(p.id) && p.injuryWeeks === 0)!;
    actions.toggleBench(s, reserve.id);
    expect(lineupGap(s).openTotal).to.equal(0);
    expect(selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup).to.have.length(11);
  });

  it('alles loslaten geeft de opstelling terug aan je trainer', () => {
    const s = newTestGame();
    const xi = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup;
    actions.toggleBench(s, xi[0].id);
    actions.toggleBench(s, xi[1].id);
    expect(s.tactics.benched).to.have.length(2); // bank blijft bank: geen gaten meer
    actions.autoLineup(s);
    expect(lineupGap(s).openTotal).to.equal(0);
    expect(selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup).to.have.length(11);
  });

  it('de teller per linie telt wat er echt staat', () => {
    const s = newTestGame();
    const { slots } = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched);
    for (const pos of POSITIONS) {
      expect(slots.filter((x) => x.zone === pos)).to.have.length(FORMATIONS[s.tactics.formation][pos]);
    }
    expect(slots).to.have.length(11);
    expect(lineupGap(s).available).to.equal(11);
  });
});

describe('Evenementen schalen mee', () => {
  it('kosten en opbrengsten stijgen met de reeks en de inflatie', () => {
    const klein = newTestGame();
    const groot = newTestGame();
    groot.league.divisionLevel = 3;
    groot.inflation = 1.3;
    groot.community.fanBase = klein.community.fanBase * 3;
    const def = CLUB_EVENTS.find((e) => e.id === 'spaghetti')!;
    expect(actions.eventCost(groot, def)).to.be.above(actions.eventCost(klein, def));
    expect(actions.eventForecast(groot, def)[0]).to.be.above(actions.eventForecast(klein, def)[0]);
    // en de verhouding blijft gezond: het blijft winstgevend
    expect(actions.eventForecast(groot, def)[0]).to.be.above(actions.eventCost(groot, def));
  });

  it('de grote evenementen zijn pas beschikbaar in een hogere reeks', () => {
    const s = newTestGame();
    s.cash = 1_000_000;
    const gala = CLUB_EVENTS.find((e) => e.id === 'oefenmatch')!;
    expect(actions.canOrganise(s, gala)).to.contain('Pas mogelijk vanaf');
    s.league.divisionLevel = 3;
    expect(actions.canOrganise(s, gala)).to.contain('plaatsen nodig'); // tribune te klein
    s.infrastructure.capacity = 2_000;
    s.community.volunteers = 40; // zo'n dag vraagt veel volk
    expect(actions.canOrganise(s, gala)).to.equal(null);
    expect(actions.organiseEvent(s, 'oefenmatch').ok).to.equal(true);
  });

  it('elke reeks heeft er minstens één nieuw evenement bij', () => {
    const levels = CLUB_EVENTS.map((e) => e.minLevel ?? 0);
    for (const level of [2, 3, 4]) expect(levels.filter((l) => l === level).length).to.be.at.least(1);
  });
});

describe('Open plaatsen uit een oud bestand', () => {
  it('een bestand zonder open plaatsen blijft gewoon werken', () => {
    const s = newTestGame();
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 20;
    delete (raw.tactics as Record<string, unknown>).gaps;
    let g = migrate(raw);
    expect(g.tactics.gaps).to.deep.equal({});
    expect(lineupGap(g).openTotal).to.equal(0);
    g = playWeeks(g, 2);
    expect(g.week).to.equal(s.week + 2);
  });

  it('een uitbestede opstelling laat geen plaatsen open en wist je bank', () => {
    const s = newTestGame();
    const xi = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup;
    actions.toggleBench(s, xi[0].id);
    expect(s.tactics.benched).to.have.length(1);
    const trainer = s.staff.find((x) => x.role === 'hoofdtrainer')!;
    trainer.skill = 80;
    actions.delegateTask(s, 'opstelling', trainer.id);
    const na = playWeeks(s, 1);
    expect(na.tactics.gaps).to.deep.equal({});
    expect(na.tactics.benched).to.have.length(0);
  });
});

describe('Weekmoment', () => {
  it('dezelfde situatie komt niet elke week terug', () => {
    let s = newTestGame('zuidrand', 'fonds', 9);
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      if (s.weekChoice) seen.push(`${s.week}:${s.weekChoice.id}`);
      s = playWeeks(s, 1);
    }
    const ids = seen.map((x) => x.split(':')[1]);
    // geen twee keer dezelfde situatie binnen 12 weken
    for (let i = 1; i < seen.length; i++) {
      if (ids[i] !== ids[i - 1]) continue;
      const gap = Number(seen[i].split(':')[0]) - Number(seen[i - 1].split(':')[0]);
      expect(gap, `${ids[i]} herhaalt te snel`).to.be.at.least(MOMENT_COOLDOWN);
    }
    expect(new Set(ids).size).to.be.above(2); // en er is afwisseling
  });

  it('een beantwoord moment blijft staan met zijn gevolg tot de volgende week', () => {
    let s = newTestGame();
    let guard = 0;
    while (!s.weekChoice && guard++ < 30) s = playWeeks(s, 1);
    const choice = s.weekChoice!;
    const outcome = answerWeekChoice(s, choice.options[0].id);
    expect(outcome).to.be.a('string');
    expect(s.weekChoice!.answer).to.equal(choice.options[0].id);
    expect(s.weekChoice!.outcome).to.equal(outcome);
    s = playWeeks(s, 1);
    expect(s.lastChoice?.outcome).to.equal(outcome);
  });
});
