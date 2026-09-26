import { expect } from 'chai';
import { readyGame, playWeeks } from './helpers';
import { takeLoan, vraagSubsidieAan } from '../src/engine/actions';
import { resolveRequests } from '../src/engine/sponsors';
import { createRng } from '../src/engine/rng';
import { migrate } from '../src/storage/save';
import { financeScreen } from '../src/ui/screens/finance';
import { subsidieCard } from '../src/ui/subsidiezaak';
import { staffScreen } from '../src/ui/screens/staff';
import { lineupBoard } from '../src/ui/screens/lineup';
import { creditLimit, totalDebt, loanOffers, interestRate, payLoanWeek } from '../src/engine/loans';

// Gezonde werking, zodat deze tests kredietaanvragen meten in plaats van tekorten.
function healthyGame() {
  const s = readyGame();
  s.sponsors[0].weekly += 2500;
  return s;
}

describe('aanvragen en hun zichtbare status', () => {
  // Dubbelklikken of een ander krediet kiezen mag nooit een tweede dossier maken.
  it('blokkeert alle gewone kredietknoppen zolang één aanvraag loopt', () => {
    const s = healthyGame();
    expect(takeLoan(s, 'kort').ok).to.equal(true);
    const before = structuredClone(s);
    expect(takeLoan(s, 'middel').ok).to.equal(false);
    expect(s).to.deep.equal(before);
    const html = financeScreen(s);
    expect(html).to.contain('Aanvraag in behandeling').and.contain('Antwoord na nog 1 gespeelde week');
    const buttons = html.match(/<button[^>]*data-action="loan"[^>]*>[^<]*<\/button>/g)!;
    expect(buttons.length).to.be.greaterThan(0);
    buttons.forEach((button) => expect(button).to.contain('disabled').and.contain('Aanvraag loopt'));
  });
  // Een bestaande lening of afwijzing is geen nieuwe UI-limiet: de bank blijft beslissen.
  for (const approved of [true, false]) {
    it(`laat na ${approved ? 'goedkeuring' : 'afwijzing'} opnieuw aanvragen zonder nieuwe limiet`, () => {
      const s = healthyGame(); takeLoan(s, 'kort');
      resolveRequests(s, { ...createRng(s), chance: () => approved });
      s.week++;
      const restored = migrate(JSON.parse(JSON.stringify(s)));
      expect(financeScreen(restored)).not.to.contain('Aanvraag in behandeling');
      expect(financeScreen(restored)).to.contain('Lening aanvragen');
      expect(takeLoan(restored, 'kort').ok).to.equal(true);
    });
  }
  // Oude saves krijgen geen verzonnen historiek; een lopende aanvraag blijft wel beschermd.
  it('ondersteunt oude saves en houdt de eenmalige noodlening beschikbaar', () => {
    const s = migrate(JSON.parse(JSON.stringify(healthyGame())));
    takeLoan(s, 'kort'); s.emergencyLoanOffered = true;
    expect(financeScreen(s)).to.match(/data-id="nood"\s*>Noodlening opnemen/);
    expect(takeLoan(s, 'nood').ok).to.equal(true);
    expect(takeLoan(s, 'nood').ok).to.equal(false);
    expect(s.requests.filter((r) => r.kind === 'lening')).to.have.length(1);
  });
  // Subsidies hebben al een strengere jaarlimiet; de aanvraagknop moet verdwijnen.
  it('vervangt de subsidieactie door lopende status en verhindert herhalen na antwoord', () => {
    const s = healthyGame(); expect(vraagSubsidieAan(s).ok).to.equal(true);
    expect(subsidieCard(s)).to.contain('Bij de gemeente').and.not.contain('data-action="subsidie-aanvragen"');
    expect(vraagSubsidieAan(s).ok).to.equal(false);
    const next = playWeeks(s, 2);
    expect(vraagSubsidieAan(next).ok).to.equal(false);
    expect(subsidieCard(next)).not.to.contain('data-action="subsidie-aanvragen"');
  });
});

describe('rating blijft een cijfer én een gekleurde balk', () => {
  // De visuele vergelijking moet de werkelijke vaardigheid tonen, ook bij lage kandidaten.
  it('toont personeel op dezelfde 0–100-schaal met rood en groen', () => {
    const s = healthyGame();
    const candidate = s.staffMarket.find((m) => m.role === 'hoofdtrainer')!;
    candidate.skill = 30;
    expect(staffScreen(s, null, 'hoofdtrainer')).to.contain('fill bad" style="width:30%');
    candidate.skill = 70;
    expect(staffScreen(s, null, 'hoofdtrainer')).to.contain('fill good" style="width:70%');
  });
  // Spelersbalken gebruiken overall; potentieel blijft een apart getal.
  it('toont in de kern een balk op basis van bestaande spelerskwaliteit', () => {
    const s = healthyGame();
    const ratings = [...lineupBoard(s, null).matchAll(/class="sr-rating"><strong>([\d.]+)<\/strong>.*?style="width:([\d.]+)%/g)];
    expect(ratings).to.have.length(s.players.length);
    ratings.forEach((rating) => expect(Number(rating[2])).to.be.closeTo(Number(rating[1]), 0.00001));
  });
});


describe('kleine kredieten omzeilen de totale schuldgrens niet', () => {
  // Voor de bank telt de som van alle openstaande schuld, niet hoeveel contracten die vormen.
  it('beoordeelt drie kleine schulden hetzelfde als één even grote schuld', () => {
    const single = readyGame(), split = structuredClone(single);
    const loan = { id: 'test', label: 'Testkrediet', principal: 90000, remaining: 90000, annualRate: 0.08, weeklyPayment: 1900, weeksLeft: 52 };
    single.loans = [loan];
    split.loans = [1, 2, 3].map((n) => ({ ...loan, id: String(n), principal: 30000, remaining: 30000, weeklyPayment: 1900 / 3 }));
    expect(totalDebt(split)).to.equal(totalDebt(single));
    expect(creditLimit(split)).to.equal(creditLimit(single));
    expect(interestRate(split)).to.equal(interestRate(single));
    expect(loanOffers(split)).to.deep.equal(loanOffers(single));
    expect(split.loans.reduce((sum, l) => sum + payLoanWeek(l), 0)).to.be.closeTo(payLoanWeek(single.loans[0]), 0.00001);
  });
  // Zelfs als iedere kansproef gunstig uitvalt, raakt de gezamenlijke kredietruimte op.
  it('stopt herhaald klein lenen vóór de totale kredietgrens, zonder gratis vermogensgroei', () => {
    const s = healthyGame();
    const capacity = creditLimit(s), debtBefore = totalDebt(s), cashBefore = s.cash;
    let accepted = 0;
    while (accepted < 100 && takeLoan(s, 'kort').ok) {
      resolveRequests(s, { ...createRng(s), chance: () => true });
      accepted++;
      expect(totalDebt(s) - debtBefore).to.be.at.most(capacity);
      expect(s.cash - cashBefore).to.equal(totalDebt(s) - debtBefore);
    }
    expect(accepted).to.be.greaterThan(1).and.lessThan(100);
    expect(loanOffers(s).find((o) => o.key === 'kort')).not.to.equal(undefined); // betaalbaarheid bindt eerder dan onderpand
    expect(takeLoan(s, 'kort').ok).to.equal(false);
  });
  // Kredietruimte wordt bij het antwoord opnieuw berekend, ook als het dossier al onderweg is.
  it('weigert een klein aangevraagd krediet wanneer de totale schuld inmiddels te hoog is', () => {
    const s = healthyGame(); takeLoan(s, 'kort');
    s.loans.push({ id: 'schuld', label: 'Bestaande schuld', principal: 10000000, remaining: 10000000, annualRate: 0.08, weeklyPayment: 20000, weeksLeft: 520 });
    const cash = s.cash, debt = totalDebt(s);
    resolveRequests(s, { ...createRng(s), chance: () => true });
    expect(s.cash).to.equal(cash); expect(totalDebt(s)).to.equal(debt);
    expect(s.news.some((n) => n.text.includes('bank wijst je kredietaanvraag af'))).to.equal(true);
  });
});
