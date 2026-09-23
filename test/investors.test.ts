import { expect } from 'chai';
import type { GameState, InvestorId } from '../src/engine/types';
import {
  FUND_PATIENCE,
  FUND_PRIZE_SHARE,
  FUND_WITHDRAWAL,
  baseProjects,
  buildDiscount,
  buildSpeed,
  canHoldRound,
  checkFundPatience,
  forcedSaleCandidate,
  holdRound,
  investorSummary,
  notePromotion,
  roundForecast,
  seasonsLeft,
  stadiumSponsorWeekly,
  takePrizeShare,
  updateStadiumSponsor,
  volunteerCap,
} from '../src/engine/investors';
import { volunteerFactor } from '../src/engine/factors';
import * as actions from '../src/engine/actions';
import { createRng } from '../src/engine/rng';
import { MATCH_WEEKS } from '../src/engine/calendar';
import { DIVISIONS } from '../src/engine/data/divisions';
import { advanceWeek } from '../src/engine/turn';
import { newTestGame, readyGame, playWeeks } from './helpers';

const game = (investor: InvestorId, clubId = 'zuidrand', seed = 42) => readyGame(clubId, investor, seed);

describe('De aannemer: bouwen is zijn ding', () => {
  it('laat de stadionnaam meegroeien met je reeks', () => {
    const basis = game('aannemer');
    // een doorsnee club (reputatie 50) in jaar één: dat is de ijkwaarde van €600
    const s = { ...basis, inflation: 1, community: { ...basis.community, reputation: 50 } };
    const at = (level: number) => stadiumSponsorWeekly({ ...s, league: { ...s.league, divisionLevel: level } });
    expect(at(1)).to.equal(600);
    expect(at(0)).to.be.below(at(1));
    expect(at(3)).to.be.above(at(1) * 2);
    for (let level = 1; level < DIVISIONS.length; level++) {
      expect(at(level), `reeks ${level}`).to.be.above(at(level - 1));
    }
  });

  it('laat de stadionnaam ook meegroeien met je reputatie en het prijspeil', () => {
    const s = game('aannemer');
    const basis = stadiumSponsorWeekly(s);
    const beroemd = stadiumSponsorWeekly({ ...s, community: { ...s.community, reputation: s.community.reputation + 30 } });
    expect(beroemd, 'een bekendere club is meer waard voor een naamsponsor').to.be.above(basis);
    const later = stadiumSponsorWeekly({ ...s, inflation: s.inflation * 1.5 });
    expect(later, 'het bedrag mag niet stilstaan terwijl alles duurder wordt').to.be.above(basis);
  });

  it('geeft hem bij de start een stadionsponsor op het niveau van zijn reeks', () => {
    const s = game('aannemer');
    const deal = s.sponsors.find((d) => d.kind === 'stadion');
    expect(deal, 'geen stadionsponsor').to.not.equal(undefined);
    expect(deal!.weekly).to.equal(stadiumSponsorWeekly(s));
  });

  it('trekt de stadionsponsor op na een promotie', () => {
    const s = game('aannemer');
    const deal = s.sponsors.find((d) => d.kind === 'stadion')!;
    const before = deal.weekly;
    s.league.divisionLevel++;
    updateStadiumSponsor(s, 'reeks');
    expect(deal.weekly).to.be.above(before);
    expect(s.news.some((n) => /naamsponsor/.test(n.text))).to.equal(true);
  });

  it('laat de naamsponsor nooit achterop hinken op de rest van de club', () => {
    // dit contract loopt zolang de aannemer blijft en wordt dus nooit heronderhandeld,
    // terwijl elke andere sponsor om de één à drie seizoenen opnieuw tekent op het
    // actuele niveau. Zonder jaarlijkse herziening verdampt het vanzelf.
    const na = playWeeks(game('aannemer'), 52 * 3);
    const deal = na.sponsors.find((d) => d.kind === 'stadion');
    if (!deal) return; // de aannemer kan er tussenuit zijn; dan valt er niets te meten
    // het bedrag wordt bij het begin van elk seizoen vastgelegd en ligt dan een jaar vast,
    // dus het mag binnen het seizoen wat afwijken — maar het mag niet wegdrijven
    const ratio = deal.weekly / stadiumSponsorWeekly(na);
    expect(ratio, `naamsponsor €${deal.weekly} tegenover €${stadiumSponsorWeekly(na)} nu`).to.be.within(0.8, 1.25);
  });

  it('haalt de naamsponsor mee omhoog met de inflatie als de club in dezelfde reeks blijft', () => {
    const s = game('aannemer');
    const start = s.sponsors.find((d) => d.kind === 'stadion')!.weekly;
    const na = playWeeks(s, 52 * 3);
    const deal = na.sponsors.find((d) => d.kind === 'stadion');
    if (!deal || na.league.divisionLevel !== s.league.divisionLevel) return; // andere reeks: dan meet dit iets anders
    expect(deal.weekly, 'drie seizoenen inflatie en het bedrag stond stil').to.be.above(start);
  });

  it('maakt bouwen goedkoper en sneller', () => {
    const bouwer = game('aannemer');
    const ander = game('fonds');
    expect(buildDiscount(bouwer)).to.be.below(buildDiscount(ander));
    expect(buildSpeed(bouwer)).to.be.below(buildSpeed(ander));
    expect(actions.upgradeCost(bouwer, 'kantine')).to.be.below(actions.upgradeCost(ander, 'kantine'));
    expect(actions.upgradeWeeks(bouwer, 'kantine')).to.be.below(actions.upgradeWeeks(ander, 'kantine'));
  });

  it('geeft hem een derde werf van bij de start', () => {
    expect(baseProjects(game('aannemer'))).to.equal(3);
    expect(baseProjects(game('fonds'))).to.equal(2);
    const s = game('aannemer');
    s.cash = 3_000_000;
    expect(actions.projectLimit(s)).to.equal(3);
    expect(actions.startUpgrade(s, 'wifi').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'sanitair').ok).to.equal(true);
    expect(actions.startUpgrade(s, 'parking').ok, 'de derde werf hoort te mogen').to.equal(true);
    expect(actions.startUpgrade(s, 'scorebord').ok, 'een vierde niet').to.equal(false);
  });

  it('stapelt met je eigen niveau als eigenaar', () => {
    const s = game('aannemer');
    s.owner.points = 20;
    s.owner.level = 3;
    expect(actions.projectLimit(s)).to.equal(4);
  });
});

describe('Het fonds: veel geld, weinig geduld', () => {
  it('neemt een deel van je prijzengeld, en daar valt niet aan te ontkomen', () => {
    const s = game('fonds');
    const before = s.cash;
    takePrizeShare(s, 10_000);
    expect(s.cash).to.equal(before - 10_000 * FUND_PRIZE_SHARE);
    expect(s.news[0].text).to.contain('prijzengeld');
  });

  it('laat het prijzengeld van de anderen met rust', () => {
    for (const inv of ['aannemer', 'cooperatie'] as InvestorId[]) {
      const s = game(inv);
      const before = s.cash;
      takePrizeShare(s, 10_000);
      expect(s.cash, inv).to.equal(before);
    }
  });

  it('houdt een klok bij die opnieuw begint bij elke promotie', () => {
    const s = game('fonds');
    expect(seasonsLeft(s)).to.equal(FUND_PATIENCE);
    s.season = 3;
    expect(seasonsLeft(s), 'seizoen 3 is je laatste kans').to.equal(1);
    s.season = 2;
    expect(seasonsLeft(s)).to.equal(2);
    s.season = 3;
    notePromotion(s);
    expect(seasonsLeft(s), 'na een promotie begint de klok opnieuw').to.equal(FUND_PATIENCE);
  });

  it('waarschuwt een seizoen voordat het geduld op is', () => {
    const s = game('fonds');
    s.season = FUND_PATIENCE - 1; // na dit seizoen heb je er nog één
    checkFundPatience(s);
    expect(s.investorActive).to.equal(true);
    expect(s.news[0].text).to.contain('ongeduldig');
  });

  it('trekt zijn geld terug en stapt op als je niet promoveert', () => {
    const s = game('fonds');
    s.season = FUND_PATIENCE; // drie seizoenen zonder promotie
    const before = s.cash;
    checkFundPatience(s);
    expect(s.investorActive).to.equal(false);
    expect(s.cash).to.equal(before - FUND_WITHDRAWAL);
    expect(s.chronicle.some((c) => c.text.includes('stapte op'))).to.equal(true);
  });

  it('blijft aan boord zolang je blijft promoveren', () => {
    const s = game('fonds');
    for (let season = 1; season <= 9; season++) {
      s.season = season;
      if (season % 2 === 0) notePromotion(s);
      checkFundPatience(s);
    }
    expect(s.investorActive, 'het fonds stapte op terwijl je bleef promoveren').to.equal(true);
  });

  it('herkent een stevig bod op een jonge speler als gedwongen verkoop', () => {
    const s = game('fonds');
    const young = s.players.find((p) => p.age <= 24 && !p.loan)!;
    young.purchasePrice = 10_000;
    s.playerOffers.push({ id: 'o1', playerId: young.id, club: 'KV Test', amount: 40_000, expiresInWeeks: 2 });
    const forced = forcedSaleCandidate(s);
    expect(forced, 'het fonds liet dit bod liggen').to.not.equal(null);
    expect(forced!.playerId).to.equal(young.id);
  });

  it('laat een bescheiden bod en een oudere speler met rust', () => {
    const s = game('fonds');
    const young = s.players.find((p) => p.age <= 24 && !p.loan)!;
    young.purchasePrice = 10_000;
    s.playerOffers.push({ id: 'o1', playerId: young.id, club: 'KV Test', amount: 12_000, expiresInWeeks: 2 });
    expect(forcedSaleCandidate(s), 'een klein bod hoort genegeerd te worden').to.equal(null);
    s.playerOffers = [];
    const old = s.players.find((p) => p.age >= 28) ?? s.players[0];
    old.age = 30;
    s.playerOffers.push({ id: 'o2', playerId: old.id, club: 'KV Test', amount: 80_000, expiresInWeeks: 2 });
    expect(forcedSaleCandidate(s), 'een oudere speler interesseert het fonds niet').to.equal(null);
  });

  it('bemoeit zich niet bij de andere investeerders', () => {
    for (const inv of ['aannemer', 'cooperatie'] as InvestorId[]) {
      const s = game(inv);
      const young = s.players.find((p) => p.age <= 24 && !p.loan)!;
      young.purchasePrice = 10_000;
      s.playerOffers.push({ id: 'o1', playerId: young.id, club: 'KV Test', amount: 60_000, expiresInWeeks: 2 });
      expect(forcedSaleCandidate(s), inv).to.equal(null);
    }
  });

  it('verkoopt de speler echt, en de kleedkamer merkt het', () => {
    const s = game('fonds');
    s.week = 5; // transferperiode
    const young = s.players.find((p) => p.age <= 24 && !p.loan)!;
    young.purchasePrice = 10_000;
    s.playerOffers.push({ id: 'o1', playerId: young.id, club: 'KV Test', amount: 60_000, expiresInWeeks: 2 });
    const mood = s.community.fanMood;
    const after = advanceWeek(s);
    expect(after.players.some((p) => p.id === young.id), 'de speler staat er nog').to.equal(false);
    expect(after.community.fanMood).to.be.below(mood);
    expect(after.news.some((n) => /tekende zelf/.test(n.text))).to.equal(true);
  });
});

describe('De coöperatie: de gemeenschap is je kapitaal', () => {
  it('laat vrijwilligers zwaarder doorwegen', () => {
    expect(volunteerCap(game('cooperatie'))).to.be.above(volunteerCap(game('fonds')));
    const coop = game('cooperatie', 'heidebeke');
    const ander = game('fonds', 'heidebeke');
    coop.community.volunteers = 25;
    ander.community.volunteers = 25;
    expect(volunteerFactor(coop)).to.be.above(volunteerFactor(ander));
  });

  it('geeft de coöperatie de vrijwilligers waar ze recht op heeft', () => {
    // de data belooft +40%; die belofte hoort ook in de cijfers te staan
    for (const clubId of ['zuidrand', 'heidebeke']) {
      const coop = game('cooperatie', clubId);
      const ander = game('fonds', clubId);
      expect(coop.community.volunteers / ander.community.volunteers, clubId).to.be.closeTo(1.4, 0.06);
    }
  });
});

describe('Vrijwilligers blijven altijd iets opleveren', () => {
  // dit was kapot: de factor zat vast op een hard plafond, en clubs zaten daar vanaf week
  // één al tegenaan. Elke vrijwilliger die daarna bijkwam — en dus ook de +40% van de
  // coöperatie en de +30% van de lokale figuur — was letterlijk niets waard.
  it('geeft elke extra vrijwilliger nog iets mee, hoeveel je er ook al hebt', () => {
    for (const inv of ['fonds', 'cooperatie'] as InvestorId[]) {
      const s = game(inv, 'heidebeke');
      for (const n of [14, 18, 22, 30, 45, 70]) {
        const hier = volunteerFactor({ ...s, community: { ...s.community, volunteers: n } });
        const meer = volunteerFactor({ ...s, community: { ...s.community, volunteers: n + 2 } });
        expect(meer, `${inv}: van ${n} naar ${n + 2} vrijwilligers levert niets op`).to.be.above(hier);
      }
    }
  });

  it('geeft geen enkele startcombinatie een factor die al vastzit', () => {
    for (const clubId of ['zuidrand', 'heidebeke']) {
      for (const inv of ['fonds', 'aannemer', 'cooperatie'] as InvestorId[]) {
        const s = game(inv, clubId);
        const nu = volunteerFactor(s);
        const meer = volunteerFactor({ ...s, community: { ...s.community, volunteers: s.community.volunteers + 3 } });
        expect(meer, `${clubId}/${inv} start al aan het plafond`).to.be.above(nu);
      }
    }
  });

  it('laat het wel afvlakken: de tiende vrijwilliger erbij doet minder dan de eerste', () => {
    const s = game('fonds', 'heidebeke');
    const f = (n: number) => volunteerFactor({ ...s, community: { ...s.community, volunteers: n } });
    const eerste = f(16) - f(14);
    const tiende = f(34) - f(32);
    expect(tiende).to.be.below(eerste);
    expect(tiende).to.be.above(0);
  });

  it('straft een onderbemande club nog altijd hard af', () => {
    const s = game('fonds');
    expect(volunteerFactor({ ...s, community: { ...s.community, volunteers: 7 } })).to.be.closeTo(0.5, 0.01);
    expect(volunteerFactor({ ...s, community: { ...s.community, volunteers: 2 } })).to.equal(0.35);
  });

  it('kan één ledenronde per seizoen houden, voor de competitie start', () => {
    const s = game('cooperatie');
    expect(canHoldRound(s).ok).to.equal(true);
    s.week = MATCH_WEEKS[0];
    expect(canHoldRound(s).ok).to.equal(false);
    s.week = 1;
    holdRound(s, createRng(s));
    expect(canHoldRound(s).ok, 'twee rondes in hetzelfde seizoen').to.equal(false);
    s.season = 2;
    expect(canHoldRound(s).ok, 'volgend seizoen mag het weer').to.equal(true);
  });

  it('is er alleen voor de coöperatie', () => {
    for (const inv of ['aannemer', 'fonds'] as InvestorId[]) {
      const check = canHoldRound(game(inv));
      expect(check.ok, inv).to.equal(false);
      expect(check.reason).to.contain('coöperatie');
    }
  });

  it('brengt meer op naarmate je club beter draait', () => {
    const goed = game('cooperatie');
    const slecht = game('cooperatie');
    goed.community.reputation = 80;
    goed.community.fanMood = 85;
    goed.community.fanBase = 1200;
    slecht.community.reputation = 20;
    slecht.community.fanMood = 30;
    slecht.community.fanBase = 300;
    expect(roundForecast(goed)).to.be.above(roundForecast(slecht) * 3);
  });

  it('zet het geld in de kas en vraagt er iets voor terug', () => {
    const s = game('cooperatie');
    const cash = s.cash;
    const mood = s.community.fanMood;
    const raised = holdRound(s, createRng(s));
    expect(raised).to.be.above(0);
    expect(s.cash).to.equal(cash + raised);
    expect(s.community.fanMood, 'je vraagt iets van dezelfde mensen').to.be.below(mood);
    expect(s.chronicle.some((c) => c.text.includes('Ledenronde'))).to.equal(true);
  });

  it('brengt elke volgende ronde wat minder op', () => {
    const s = game('cooperatie');
    const first = roundForecast(s);
    for (let i = 0; i < 4; i++) {
      s.season = i + 1;
      s.investorState!.coopSeason = null;
      holdRound(s, createRng(s));
    }
    s.community.fanMood = game('cooperatie').community.fanMood; // sfeer terugzetten om alleen de moeheid te meten
    expect(roundForecast(s)).to.be.below(first);
  });

  it('is via de actie te gebruiken en levert een logboekregel op', () => {
    const s = game('cooperatie');
    const result = actions.holdMemberRound(s);
    expect(result.ok, result.message).to.equal(true);
    expect(s.log.some((l) => /Ledenronde/.test(l.text))).to.equal(true);
    expect(actions.holdMemberRound(s).ok, 'twee keer hetzelfde seizoen').to.equal(false);
  });

  it('haalt over zes seizoenen meer op bij een club die groeit dan bij een die stilstaat', () => {
    const run = (grow: boolean) => {
      const s = game('cooperatie');
      let total = 0;
      for (let season = 1; season <= 6; season++) {
        s.season = season;
        s.investorState!.coopSeason = null;
        total += holdRound(s, createRng(s));
        if (grow) {
          s.community.fanBase = Math.round(s.community.fanBase * 1.18);
          s.community.reputation = Math.min(100, s.community.reputation + 7);
          s.community.fanMood = Math.min(100, s.community.fanMood + 8);
        } else {
          s.community.fanBase = Math.round(s.community.fanBase * 0.94);
          s.community.reputation = Math.max(5, s.community.reputation - 4);
        }
      }
      return total;
    };
    const groeiend = run(true);
    const stilstaand = run(false);
    expect(groeiend).to.be.above(stilstaand * 2);
    expect(groeiend, 'een goed draaiende cooperatie hoort het fonds te benaderen').to.be.above(250_000);
  });
});

describe('Elke investeerder speelt een ander spel', () => {
  it('geeft elk een eigen uitleg in de schermen', () => {
    const teksten = (['aannemer', 'fonds', 'cooperatie'] as InvestorId[]).map((i) => investorSummary(game(i)));
    expect(new Set(teksten).size).to.equal(3);
    expect(teksten[0]).to.contain('Bouwwerken');
    expect(teksten[1]).to.contain('fonds');
    expect(teksten[2]).to.contain('ledenronde');
  });

  it('zegt het ook wanneer je investeerder is afgehaakt', () => {
    const s = game('fonds');
    s.investorActive = false;
    expect(investorSummary(s)).to.contain('niet langer betrokken');
  });

  it('blijft bij alle drie speelbaar', () => {
    for (const inv of ['aannemer', 'fonds', 'cooperatie'] as InvestorId[]) {
      const after = playWeeks(game(inv, 'heidebeke', 8), 20);
      expect(after.week, inv).to.equal(21);
      expect(after.gameOver, inv).to.equal(false);
    }
  });
});

describe('Opslag met de nieuwe investeerders', () => {
  it('geeft een bestand van versie 26 een investeerdersstand', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 26;
    delete old.investorState;
    const fixed = migrate(old);
    expect(fixed.investorState).to.not.equal(null);
    expect(fixed.investorState!.coopRounds).to.equal(0);
    expect(fixed.version).to.be.at.least(27);
  });

  it('zet de stadionsponsor van een oud bestand op het niveau van zijn reeks', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame('zuidrand', 'aannemer'))) as Record<string, unknown> & {
      sponsors: GameState['sponsors'];
      league: GameState['league'];
    };
    old.version = 26;
    old.league.divisionLevel = 3;
    const stadion = old.sponsors.find((d) => d.kind === 'stadion')!;
    stadion.weekly = 600; // het oude vaste bedrag
    const fixed = migrate(old);
    expect(fixed.sponsors.find((d) => d.kind === 'stadion')!.weekly).to.equal(stadiumSponsorWeekly(fixed));
    expect(fixed.sponsors.find((d) => d.kind === 'stadion')!.weekly, 'in 1ste nationale hoort dat een pak meer te zijn').to.be.above(600);
  });

  it('geeft een club die al promoveerde een eerlijke klok', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame('zuidrand', 'fonds'))) as Record<string, unknown>;
    old.version = 26;
    old.season = 4;
    old.promotionsWithInvestor = 1;
    delete old.investorState;
    const fixed = migrate(old);
    expect(fixed.investorState!.lastPromotionSeason).to.equal(3);
    expect(seasonsLeft(fixed)).to.be.above(0);
  });
});
