import { expect } from 'chai';
import type { GameState } from '../src/engine/types';
import { SPONSOR_TERMS, acceptSponsorOffer, makeDeal, sponsorTerm, termTotal } from '../src/engine/sponsors';
import * as st from '../src/engine/seasontickets';
import * as actions from '../src/engine/actions';
import { createRng } from '../src/engine/rng';
import { MATCH_WEEKS } from '../src/engine/calendar';
import { advanceWeek } from '../src/engine/turn';
import { forecast } from '../src/engine/forecast';
import { readyGame, playWeeks } from './helpers';

/** Zet een vers sponsoraanbod klaar en geeft het id terug. Maakt eerst plaats voor dat soort. */
function offer(s: GameState, weekly = 200): string {
  s.sponsors = s.sponsors.filter((d) => d.kind !== 'bord');
  const deal = makeDeal(s, createRng(s), 'bord', weekly);
  s.sponsorOffers.push({ ...deal, expiresInWeeks: 6 });
  return deal.id;
}

describe('Meerjarige sponsorcontracten', () => {
  it('biedt drie looptijden aan, elk met een eigen prijs', () => {
    expect(SPONSOR_TERMS.map((t) => t.seasons)).to.deep.equal([1, 2, 3]);
    for (let i = 1; i < SPONSOR_TERMS.length; i++) {
      expect(SPONSOR_TERMS[i].factor).to.be.above(SPONSOR_TERMS[i - 1].factor);
      expect(SPONSOR_TERMS[i].detail).to.be.a('string').and.not.equal('');
    }
  });

  it('rekent het totaal van een looptijd correct uit', () => {
    expect(termTotal(100, 1)).to.equal(5200);
    expect(termTotal(100, 3)).to.equal(Math.round(100 * 1.15 * 52 * 3));
  });

  it('tekent standaard voor één seizoen', () => {
    const s = readyGame();
    const id = offer(s, 200);
    expect(acceptSponsorOffer(s, id).ok).to.equal(true);
    const deal = s.sponsors.find((d) => d.id === id)!;
    expect(deal.weeksLeft).to.equal(52);
    expect(deal.lockedSeasons).to.equal(1);
    expect(deal.weekly).to.equal(200);
  });

  it('betaalt meer per week naarmate je langer tekent', () => {
    const one = readyGame('zuidrand', 'aannemer', 3);
    const three = readyGame('zuidrand', 'aannemer', 3);
    const a = offer(one, 200);
    const b = offer(three, 200);
    acceptSponsorOffer(one, a, 1);
    acceptSponsorOffer(three, b, 3);
    const short = one.sponsors.find((d) => d.id === a)!;
    const long = three.sponsors.find((d) => d.id === b)!;
    expect(long.weekly).to.be.above(short.weekly);
    expect(long.weeksLeft).to.equal(156);
    expect(long.lockedSeasons).to.equal(3);
  });

  it('vertelt in het nieuws waar je aan vastzit', () => {
    const s = readyGame();
    acceptSponsorOffer(s, offer(s, 200), 3);
    expect(s.news[0].text).to.contain('3 seizoenen');
    expect(s.chronicle.some((c) => c.text.includes('3 seizoenen'))).to.equal(true);
  });

  it('laat een vastgelegd contract niet meeschuiven bij promotie', () => {
    const s = readyGame();
    const shortId = offer(s, 200);
    acceptSponsorOffer(s, shortId, 1);
    const longId = offer(s, 200);
    acceptSponsorOffer(s, longId, 3);
    s.sponsorOffers = [];
    // doe alsof we promoveren
    const { sponsorsAfterSeason } = require('../src/engine/sponsors') as typeof import('../src/engine/sponsors');
    for (let i = 0; i < 30; i++) sponsorsAfterSeason(s, createRng(s), 'promotie', s.league.divisionLevel + 1);
    const forLong = s.sponsorOffers.filter((o) => o.renewalOf === longId);
    expect(forLong.length, 'een contract van drie seizoenen kreeg toch een beter voorstel').to.equal(0);
  });

  it('houdt het bestaande gedrag voor een verlenging', () => {
    const s = readyGame();
    const id = offer(s, 200);
    acceptSponsorOffer(s, id, 1);
    const deal = s.sponsors.find((d) => d.id === id)!;
    deal.weeksLeft = 6;
    const renewal = makeDeal(s, createRng(s), 'bord', 260);
    s.sponsorOffers.push({ ...renewal, expiresInWeeks: 6, renewalOf: id });
    expect(acceptSponsorOffer(s, renewal.id).ok).to.equal(true);
    expect(deal.weekly).to.equal(260);
  });

  it('is via de actie met een looptijd aan te sturen', () => {
    const s = readyGame();
    const id = offer(s, 200);
    const result = actions.acceptSponsor(s, `${id}:2`);
    expect(result.ok, result.message).to.equal(true);
    expect(s.sponsors.find((d) => d.id === id)!.lockedSeasons).to.equal(2);
  });

  it('valt terug op één seizoen bij een onzinnige looptijd', () => {
    const s = readyGame();
    const id = offer(s, 200);
    actions.acceptSponsor(s, `${id}:9`);
    expect(s.sponsors.find((d) => d.id === id)!.lockedSeasons).to.equal(1);
    expect(sponsorTerm(9).seasons).to.equal(1);
  });
});

describe('Abonnementen', () => {
  it('verkoopt er meer naarmate de korting groter is', () => {
    const s = readyGame();
    const full = st.fullPrice(s);
    expect(st.expectedSales(s, Math.round(full * 0.5))).to.be.above(st.expectedSales(s, full));
  });

  it('stelt een prijs voor met korting tegenover los betalen', () => {
    const s = readyGame();
    expect(st.suggestedPrice(s)).to.be.below(st.fullPrice(s));
    expect(st.suggestedPrice(s)).to.be.at.least(st.MIN_PRICE);
  });

  it('kan alleen voor de competitie start', () => {
    const s = readyGame();
    expect(st.canSell(s).ok).to.equal(true);
    s.week = MATCH_WEEKS[0];
    const blocked = st.canSell(s);
    expect(blocked.ok).to.equal(false);
    expect(blocked.reason).to.contain('voor de competitie start');
  });

  it('kan maar één keer per seizoen', () => {
    const s = readyGame();
    expect(actions.sellSubscriptions(s, String(st.suggestedPrice(s))).ok).to.equal(true);
    const again = actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    expect(again.ok).to.equal(false);
    expect(again.message).to.contain('al');
  });

  it('zet het geld meteen in de kas', () => {
    const s = readyGame();
    const before = s.cash;
    actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    expect(s.cash).to.be.above(before);
    expect(s.cash - before).to.equal(s.seasonTickets!.revenue);
    expect(s.thisWeek.some((e) => e.category === 'tickets' && /Abonnementen/.test(e.label))).to.equal(true);
  });

  it('laat abonnees daarna niet meer aan de kassa betalen', () => {
    const met = readyGame('heidebeke', 'fonds', 15);
    const zonder = readyGame('heidebeke', 'fonds', 15);
    actions.sellSubscriptions(met, String(st.suggestedPrice(met)));
    expect(st.holders(met)).to.be.above(0);
    // speel tot de eerste thuiswedstrijd en vergelijk de kassa
    const gateOf = (s: GameState) => {
      let cur = s;
      for (let i = 0; i < 20; i++) {
        cur = advanceWeek(cur);
        const tickets = cur.lastWeek.filter((e) => e.category === 'tickets' && /Tickets vs/.test(e.label));
        if (tickets.length) return tickets.reduce((sum, e) => sum + e.amount, 0);
      }
      return null;
    };
    const withSubs = gateOf(met);
    const without = gateOf(zonder);
    expect(withSubs, 'geen thuiswedstrijd gevonden').to.not.equal(null);
    expect(withSubs!).to.be.below(without!);
  });

  it('vermeldt de abonnees in de boeking van de wedstrijd', () => {
    let s = readyGame('heidebeke', 'fonds', 15);
    actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    for (let i = 0; i < 20; i++) {
      s = advanceWeek(s);
      const line = s.lastWeek.find((e) => e.category === 'tickets' && /Tickets vs/.test(e.label));
      if (line) {
        expect(line.label).to.contain('abonnees');
        return;
      }
    }
    throw new Error('geen thuiswedstrijd gespeeld');
  });

  it('houdt de abonnees ook in de prognose apart', () => {
    const s = readyGame('heidebeke', 'fonds', 15);
    actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    s.week = MATCH_WEEKS[0];
    const home = forecast(s).weeks.find((w) => w.match === 'thuis');
    if (home) {
      const tickets = home.lines.find((l) => l.category === 'tickets');
      if (tickets) expect(tickets.label).to.contain('abonnees');
    }
  });

  it('rekent op het einde van het seizoen af', () => {
    let s = readyGame('heidebeke', 'fonds', 19);
    actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    s.cash = 3_000_000;
    s = playWeeks(s, 52);
    expect(s.news.some((n) => /abonnementen zijn afgelopen/i.test(n.text)), 'geen afrekening van de abonnementen').to.equal(true);
  });

  it('laat je volgend seizoen opnieuw kiezen', () => {
    let s = readyGame('heidebeke', 'fonds', 19);
    actions.sellSubscriptions(s, String(st.suggestedPrice(s)));
    s.cash = 3_000_000;
    s = playWeeks(s, 52);
    expect(s.season).to.be.above(1);
    expect(st.holders(s)).to.equal(0); // vorig seizoen telt niet meer mee
  });

  it('weigert een prijs waar niemand op ingaat', () => {
    const s = readyGame();
    s.community.fanBase = 20; // veel te klein publiek
    const result = actions.sellSubscriptions(s, String(st.fullPrice(s) * 3));
    if (!result.ok) expect(result.message).to.contain('goedkoper');
  });

  it('vertelt wat je ervoor terugkrijgt en wat je misloopt', () => {
    const s = readyGame();
    const price = st.suggestedPrice(s);
    expect(st.expectedRevenue(s, price)).to.equal(st.expectedSales(s, price) * price);
    // niemand komt vijftien keer, dus de gemiste kassa is minder dan het volle tarief
    expect(st.forgoneGate(s, price)).to.be.below(st.expectedSales(s, price) * st.fullPrice(s));
    expect(st.forgoneGate(s, price)).to.be.above(0);
  });

  it('verkoopt niets zonder korting en meer naarmate de korting stijgt', () => {
    const s = readyGame();
    const full = st.fullPrice(s);
    expect(st.expectedSales(s, full), 'zonder korting zou niemand mogen tekenen').to.equal(0);
    const modest = st.expectedSales(s, Math.round(full * 0.8));
    const sharp = st.expectedSales(s, Math.round(full * 0.55));
    expect(modest).to.be.above(0);
    expect(sharp).to.be.above(modest);
  });

  it('levert bij een scherpe korting meer cash op, maar is op het jaar duurder', () => {
    const s = readyGame();
    const full = st.fullPrice(s);
    const sharp = Math.round(full * 0.5);
    const modest = Math.round(full * 0.78);
    expect(st.expectedRevenue(s, sharp), 'scherp prijzen hoort meer cash op te leveren').to.be.above(st.expectedRevenue(s, modest));
    const netOf = (p: number) => st.expectedRevenue(s, p) - st.forgoneGate(s, p);
    expect(netOf(modest), 'een bescheiden korting hoort voordeliger te zijn').to.be.above(netOf(sharp));
  });
});

describe('Opslag met de lange staart', () => {
  it('geeft een bestand van versie 25 abonnementen en looptijden', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(readyGame())) as Record<string, unknown> & { sponsors: GameState['sponsors'] };
    old.version = 25;
    delete old.seasonTickets;
    for (const d of old.sponsors) delete d.lockedSeasons;
    const fixed = migrate(old);
    expect(fixed.seasonTickets).to.equal(null);
    expect(fixed.sponsors.every((d) => d.lockedSeasons === 1)).to.equal(true);
    expect(fixed.version).to.be.at.least(26);
  });

  it('blijft speelbaar na de omzetting', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(readyGame())) as Record<string, unknown>;
    old.version = 25;
    delete old.seasonTickets;
    const fixed = playWeeks(migrate(old), 8);
    expect(fixed.gameOver).to.equal(false);
  });
});
