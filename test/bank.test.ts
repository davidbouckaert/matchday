import { expect } from 'chai';
import { readyGame } from './helpers';
import { bankCapacity, assessLoan } from '../src/engine/bank';
import { loanOffers, totalDebt, creditLimit } from '../src/engine/loans';
import { takeLoan } from '../src/engine/actions';
import { resolveRequests } from '../src/engine/sponsors';
import { createRng } from '../src/engine/rng';
import { financeScreen } from '../src/ui/screens/finance';

function healthyGame() {
  const s = readyGame(); s.sponsors[0].weekly += 2500; return s;
}

describe('de bank toetst gezamenlijke betaalbaarheid', () => {
  // Onderpand en veel geleend geld mogen een structureel tekort niet maskeren.
  it('weigert verlieslatende werking ook met veel kasgeld en onderpand', () => {
    const s = readyGame(); s.staff[0].wage += 10000;
    s.cash = 10000000;
    expect(creditLimit(s)).to.be.greaterThan(0);
    const before = structuredClone(s);
    for (let i = 0; i < 5; i++) expect(takeLoan(s, 'kort').ok).to.equal(false);
    expect(s).to.deep.equal(before);
    expect(bankCapacity(s).annualOperating).to.be.lessThan(0);
    const assessment = assessLoan(s, loanOffers(s)[0]);
    expect(assessment.chance).to.equal(0);
    expect(financeScreen(s)).to.contain(assessment.reason).and.contain('Nu niet betaalbaar');
  });
  // Splitsen wijzigt noch de last, noch de kans op krediet.
  it('geeft drie kleine contracten dezelfde beoordeling als één even grote lening', () => {
    const s = healthyGame(), split = structuredClone(s);
    const loan = { id: 'l', label: 'Krediet', principal: 90000, remaining: 90000, annualRate: 0.08, weeklyPayment: 1800, weeksLeft: 52 };
    s.loans = [loan];
    split.loans = [1, 2, 3].map((n) => ({ ...loan, id: String(n), principal: 30000, remaining: 30000, weeklyPayment: 600 }));
    const a = assessLoan(s, loanOffers(s)[0]), b = assessLoan(split, loanOffers(split)[0]);
    expect(b.allowed).to.equal(a.allowed);
    expect(b.chance).to.equal(a.chance);
    expect(b.existingPayments).to.be.closeTo(a.existingPayments, 0.000001);
    expect(b.requiredOperating).to.equal(a.requiredOperating);
  });
  // Zelfs gegarandeerd gunstige kansproeven mogen afwijzing nooit weggooien.
  it('stopt opeenvolgende kleine leningen zodra alle afbetalingen te groot worden', () => {
    const s = healthyGame(); let approved = 0;
    while (approved < 100 && takeLoan(s, 'kort').ok) {
      resolveRequests(s, { ...createRng(s), chance: () => true }); approved++;
    }
    expect(approved).to.be.greaterThan(1).and.lessThan(100);
    expect(creditLimit(s)).to.be.greaterThan(10000);
    const cash = s.cash, debt = totalDebt(s);
    for (let week = 0; week < 5; week++) {
      s.week++;
      expect(takeLoan(s, 'kort').ok).to.equal(false);
      resolveRequests(s, { ...createRng(s), chance: () => true });
    }
    expect(s.cash).to.equal(cash); expect(totalDebt(s)).to.equal(debt);
  });
  // Verbetering van de werking opent ruimte, ongeacht het aantal eerdere leningen.
  it('laat meer dan drie kredieten toe wanneer de club ze kan dragen', () => {
    const s = healthyGame(); s.sponsors[0].weekly += 4000;
    for (let n = 0; n < 5; n++) {
      expect(takeLoan(s, 'kort').ok).to.equal(true);
      resolveRequests(s, { ...createRng(s), chance: () => true });
    }
    expect(s.loans).to.have.length(6); // de kunstgraslening liep al bij de start
  });
  // De eerste check reserveert geen ja: verslechtering tijdens de aanvraag telt mee.
  it('controleert opnieuw bij het antwoord en verklaart een betaalbaarheidsweigering', () => {
    const s = healthyGame(); expect(takeLoan(s, 'kort').ok).to.equal(true);
    s.staff[0].wage += 10000;
    const cash = s.cash, debt = totalDebt(s);
    let rolls = 0;
    resolveRequests(s, { ...createRng(s), chance: () => { rolls++; return true; } });
    expect(rolls).to.equal(0);
    expect(s.cash).to.equal(cash); expect(totalDebt(s)).to.equal(debt);
    expect(s.requests).to.have.length(0);
    expect(s.news[0].text).to.contain('vaste kosten');
  });
  // De raming mag geen spelweek simuleren in de echte save, en kent geen RNG.
  it('blijft zuiver, onafhankelijk van kasgeld en kalenderweek', () => {
    const s = healthyGame(), before = structuredClone(s);
    const capacity = bankCapacity(s);
    financeScreen(s); assessLoan(s, loanOffers(s)[0]);
    expect(s).to.deep.equal(before);
    s.cash += 1000000; s.pending.push({ weeksLeft: 1, amount: 1000000, category: 'transfers', label: 'Eenmalig' });
    for (const week of [1, 24, 52]) { s.week = week; expect(bankCapacity(s)).to.deep.equal(capacity); }
  });
  // Een lening die deze week afloopt mag een gezonde club geen heel jaar blokkeren.
  it('telt alleen resterende betalingen en laat verbetering opnieuw krediet openen', () => {
    const s = readyGame();
    const offer = loanOffers(s)[0];
    expect(assessLoan(s, offer).allowed).to.equal(false);
    s.loans = [{ id: 'laatste', label: 'Laatste termijn', principal: 10000, remaining: 100, annualRate: 0, weeklyPayment: 500, weeksLeft: 1 }];
    expect(bankCapacity(s).existingPayments).to.equal(100);
    s.sponsors[0].weekly += 1500;
    expect(takeLoan(s, 'kort').ok).to.equal(true);
  });
  // Een grote sponsor die nog één week betaalt is geen jaar lang draagkracht.
  it('telt aflopende sponsors slechts tot hun contracteinde mee', () => {
    const s = healthyGame(), before = bankCapacity(s).annualOperating;
    const deal = s.sponsors[0]; deal.weeksLeft = 1;
    expect(bankCapacity(s).annualOperating).to.equal(before - 51 * deal.weekly);
    expect(takeLoan(s, 'kort').ok).to.equal(false);
  });
  // Niet vooraf uitgekeerd geld, maar opbrengst uit verkochte abonnementen telt in het jaar.
  it('rekent bestaande abonnementen en medische kosten mee', () => {
    const s = healthyGame(); const before = bankCapacity(s).annualOperating;
    s.seasonTickets = { season: s.season, sold: 0, price: 100, revenue: 1000 };
    expect(bankCapacity(s).annualOperating).to.equal(before + 1000);
    s.medical.voeding = 'basis';
    expect(bankCapacity(s).annualOperating).to.equal(before + 1000 - 52 * 120 * s.inflation);
  });
});
