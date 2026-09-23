import { expect } from 'chai';
import { FORECAST_WEEKS, forecast, topLines } from '../src/engine/forecast';
import { BOND_FEE_WEEK, SUBSIDY_WEEK, MATCH_WEEKS } from '../src/engine/calendar';
import { YOUTH_FEE_WEEK } from '../src/engine/actions';
import { advanceWeek } from '../src/engine/turn';
import type { LedgerCategory } from '../src/engine/types';
import { newTestGame, readyGame } from './helpers';

describe('De kasprognose', () => {
  it('kijkt standaard acht weken vooruit', () => {
    const s = readyGame();
    const f = forecast(s);
    expect(f.weeks.length).to.equal(FORECAST_WEEKS);
    expect(f.weeks[0].week).to.equal(s.week);
    expect(f.weeks[f.weeks.length - 1].week).to.equal(s.week + FORECAST_WEEKS - 1);
  });

  it('verandert niets aan de spelstand', () => {
    const s = readyGame();
    const before = JSON.stringify(s);
    forecast(s);
    expect(JSON.stringify(s)).to.equal(before);
  });

  it('telt het saldo per week netjes op', () => {
    const s = readyGame();
    const f = forecast(s);
    let running = s.cash;
    for (const w of f.weeks) {
      expect(w.net).to.equal(w.income + w.costs);
      running += w.net;
      expect(w.balance, `week ${w.week}`).to.equal(running);
    }
    expect(f.net).to.equal(running - s.cash);
  });

  it('stopt aan de seizoensgrens, want daarna verandert te veel', () => {
    const s = readyGame();
    s.week = 50;
    const f = forecast(s);
    expect(f.weeks.length).to.equal(3); // week 50, 51 en 52
    expect(f.weeks.every((w) => w.season === s.season)).to.equal(true);
  });

  it('neemt de vaste stromen mee die elke week terugkomen', () => {
    const s = readyGame();
    const labels = forecast(s).weeks[0].lines.map((l) => l.label);
    expect(labels.some((l) => /Spelersvergoedingen/.test(l))).to.equal(true);
    expect(labels.some((l) => /Lonen personeel/.test(l))).to.equal(true);
    expect(labels.some((l) => /Onderhoud/.test(l))).to.equal(true);
    expect(labels.some((l) => /Sponsorcontracten/.test(l))).to.equal(true);
    expect(labels.some((l) => /trainingen/.test(l))).to.equal(true);
  });

  it('herkent thuis- en uitwedstrijden en zet de tegenstander erbij', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0];
    const f = forecast(s);
    const matchWeeks = f.weeks.filter((w) => w.match);
    expect(matchWeeks.length).to.be.above(0);
    for (const w of matchWeeks) {
      expect(w.opponent, `week ${w.week}`).to.not.equal('');
      expect(['thuis', 'uit']).to.include(w.match!);
    }
  });

  it('raamt de kassa en de kantine bij een thuiswedstrijd, en merkt die als raming', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0];
    const home = forecast(s).weeks.find((w) => w.match === 'thuis');
    expect(home, 'geen thuiswedstrijd binnen acht weken').to.not.equal(undefined);
    const tickets = home!.lines.find((l) => l.category === 'tickets');
    expect(tickets, 'geen ticketinkomsten geraamd').to.not.equal(undefined);
    expect(tickets!.amount).to.be.above(0);
    expect(tickets!.estimate).to.equal(true);
    expect(home!.lines.some((l) => l.category === 'kantine' && l.estimate)).to.equal(true);
  });

  it('rekent bij een uitwedstrijd het busvervoer en geen kassa', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0];
    const away = forecast(s).weeks.find((w) => w.match === 'uit');
    expect(away, 'geen uitwedstrijd binnen acht weken').to.not.equal(undefined);
    expect(away!.lines.some((l) => /Busvervoer/.test(l.label))).to.equal(true);
    expect(away!.lines.some((l) => l.category === 'tickets')).to.equal(false);
  });

  it('rekent een wedstrijdweek duurder aan lonen dan een vrije week', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0];
    const f = forecast(s);
    const withMatch = f.weeks.find((w) => w.match);
    const wages = (w: typeof f.weeks[number]) => w.lines.find((l) => l.category === 'lonen spelers')!.amount;
    s.week = 1;
    const quiet = forecast(s).weeks[0];
    expect(Math.abs(wages(withMatch!))).to.be.above(Math.abs(wages(quiet)));
  });

  it('zet de vaste momenten van het jaar op de juiste week', () => {
    const s = readyGame();
    s.week = BOND_FEE_WEEK;
    expect(forecast(s).weeks[0].lines.some((l) => l.category === 'bond & verzekering')).to.equal(true);
    s.week = SUBSIDY_WEEK;
    expect(forecast(s).weeks[0].lines.some((l) => l.category === 'subsidies')).to.equal(true);
    s.week = YOUTH_FEE_WEEK;
    expect(forecast(s).weeks[0].lines.some((l) => l.category === 'lidgelden')).to.equal(true);
  });

  it('neemt opbrengsten mee die al onderweg zijn', () => {
    const s = readyGame();
    s.pending.push({ weeksLeft: 3, amount: 4_000, category: 'evenementen', label: 'Opbrengst eetfestijn' });
    const f = forecast(s);
    const week = f.weeks[2]; // weeksLeft 3 = de derde week vanaf nu
    expect(week.lines.some((l) => l.label === 'Opbrengst eetfestijn' && l.amount === 4_000)).to.equal(true);
  });

  it('rekent een lening mee zolang ze loopt, en daarna niet meer', () => {
    const s = readyGame();
    s.loans = [{ id: 'l1', label: 'Testlening', principal: 10_000, remaining: 10_000, annualRate: 0.05, weeklyPayment: 200, weeksLeft: 3 }];
    const f = forecast(s);
    const paying = f.weeks.filter((w) => w.lines.some((l) => l.label === 'Afbetaling Testlening'));
    expect(paying.length).to.equal(3);
  });

  it('waarschuwt wanneer je onder nul zou duiken', () => {
    const s = readyGame();
    s.cash = 1_000;
    const f = forecast(s);
    expect(f.trouble, 'geen waarschuwing terwijl de kas bijna leeg is').to.not.equal(null);
    expect(f.lowest.balance).to.be.below(1_000);
    const first = f.weeks.find((w) => w.balance < 0);
    expect(f.trouble!.week).to.equal(first!.week);
  });

  it('waarschuwt niet wanneer er ruim genoeg in kas zit', () => {
    const s = readyGame();
    s.cash = 5_000_000;
    expect(forecast(s).trouble).to.equal(null);
  });

  it('houdt het laagste punt bij', () => {
    const s = readyGame();
    const f = forecast(s);
    const lowest = Math.min(s.cash, ...f.weeks.map((w) => w.balance));
    expect(f.lowest.balance).to.equal(lowest);
  });

  it('komt in de buurt van wat er daarna echt gebeurt', () => {
    // Een prognose hoeft niet exact te zijn, maar wel bruikbaar. We vergelijken alleen wat
    // ze ook belooft: de gewone werking. Een transfer die toevallig die week doorgaat, een
    // meevaller of een aflossing zegt ze zelf niet te voorspellen — en dan mag een test
    // haar daar ook niet op afrekenen.
    const BUITEN_DE_WERKING: LedgerCategory[] = ['leningen', 'investeerder', 'aflossingen', 'transfers', 'infrastructuur', 'meevallers', 'tegenslagen'];
    const s = readyGame('heidebeke', 'fonds', 8);
    s.week = 2; // vrije week, geen wedstrijd
    const predicted = forecast(s)
      .weeks[0].lines.filter((l) => !BUITEN_DE_WERKING.includes(l.category))
      .reduce((sum, l) => sum + l.amount, 0);
    const after = advanceWeek(s);
    const actual = after.lastWeek.filter((e) => !BUITEN_DE_WERKING.includes(e.category)).reduce((sum, e) => sum + e.amount, 0);
    const margin = Math.max(2_000, Math.abs(predicted) * 0.35);
    expect(Math.abs(actual - predicted), `voorspeld ${predicted}, werd ${actual}`).to.be.below(margin);
  });

  it('geeft de grootste posten terug, grootste eerst', () => {
    const s = readyGame();
    const week = forecast(s).weeks[0];
    const top = topLines(week, 4);
    expect(top.length).to.be.at.most(4);
    for (let i = 1; i < top.length; i++) {
      expect(Math.abs(top[i - 1].amount)).to.be.at.least(Math.abs(top[i].amount));
    }
  });

  it('werkt ook meteen bij een nieuw spel', () => {
    const f = forecast(newTestGame());
    expect(f.weeks.length).to.be.above(0);
    expect(f.weeks[0].lines.length).to.be.above(3);
  });
});
