import { expect } from 'chai';
import { readyGame, playWeeks } from './helpers';
import { vraagSubsidieAan } from '../src/engine/actions';
import { subsidieBedrag, subsidieKans } from '../src/engine/finance';
import { resolveRequests } from '../src/engine/sponsors';
import { createRng } from '../src/engine/rng';
import { migrate } from '../src/storage/save';
import { SAVE_VERSION } from '../src/engine/newGame';
import { bureauStatus, dashboardScreen, weekSummary } from '../src/ui/screens/dashboard';
import { subsidieCard } from '../src/ui/subsidiezaak';
import { financeScreen } from '../src/ui/screens/finance';
import { reportOverlay } from '../src/ui/screens/report';
import { cashSummary } from '../src/ui/financial';

describe('een terugvindbaar subsidiedossier', () => {
  // Beide uitkomsten moeten expliciet getest zijn, niet toevallig één tak per run.
  for (const [seed, status, cash, rng] of [[1, 'afgewezen', 162099, 1163350029], [2, 'toegekend', 177212, 1546997212]] as const) {
    it(`bewaart ${status} zonder de v0.84-uitkomst te veranderen (seed ${seed})`, () => {
      let s = readyGame('zuidrand', 'aannemer', seed);
      const beforeRng = s.rngState;
      expect(vraagSubsidieAan(s).ok).to.equal(true);
      expect(s.rngState).to.equal(beforeRng);
      expect(s.subsidieZaken[0].raming).to.equal(subsidieBedrag(s));
      expect(s.subsidieZaken[0].kansBijAanvraag).to.equal(subsidieKans(s).kans);
      expect(vraagSubsidieAan(s).ok).to.equal(false);
      expect(s.requests.filter((r) => r.kind === 'subsidie')).to.have.length(1);
      s = playWeeks(s, 1);
      expect(s.requests.find((r) => r.kind === 'subsidie')?.weeksLeft).to.equal(1);
      s = playWeeks(s, 1);
      expect(s.subsidieZaken[0].status).to.equal(status);
      expect(s.requests.filter((r) => r.kind === 'subsidie')).to.have.length(0);
      const paid = s.seasonTotals.subsidies;
      s = playWeeks(s, 1);
      // Golden waarden onafhankelijk gemeten op bfffcb8, niet op de nieuwe implementatie.
      expect(s.cash).to.equal(cash);
      expect(s.rngState).to.equal(rng);
      expect(s.seasonTotals.subsidies).to.equal(paid);
      expect(vraagSubsidieAan(s).ok).to.equal(false);
      expect(migrate(JSON.parse(JSON.stringify(s))).subsidieZaken).to.deep.equal(s.subsidieZaken);
    });
  }

  // De aanvraag is geen prijsafspraak: de bestaande resolver blijft actuele omstandigheden gebruiken.
  it('bewaart een oude raming en gebruikt de ongewijzigde kans en som bij het antwoord', () => {
    const s = readyGame();
    vraagSubsidieAan(s);
    const estimate = s.subsidieZaken[0].raming;
    s.community.youthMembers += 100;
    s.community.reputation += 10;
    const expected = subsidieBedrag(s), probability = subsidieKans(s).kans;
    const rng = createRng(s);
    let calls = 0;
    const observed = { ...rng, chance: (p: number) => { calls++; expect(p).to.equal(probability); return true; } };
    resolveRequests(s, observed);
    expect(calls).to.equal(0);
    resolveRequests(s, observed);
    expect(calls).to.equal(1);
    expect(s.subsidieZaken[0].raming).to.equal(estimate);
    expect(s.subsidieZaken[0].antwoord?.bedrag).to.equal(expected);
    expect(s.seasonTotals.subsidies).to.equal(expected);
    resolveRequests(s, observed);
    expect(calls).to.equal(1);
  });

  // Een migratie mag niets raden uit een mooi nieuwsbericht of een volle kas.
  it('migreert lopende oude aanvragen zonder geld, tijd of aanvraagrecht te veranderen', () => {
    const s = readyGame(); vraagSubsidieAan(s); s.version = 40;
    const raw = JSON.parse(JSON.stringify(s)); delete raw.subsidieZaken;
    const { cash, rngState, requests, subsidieSeizoen } = structuredClone(raw);
    const restored = migrate(raw);
    expect(restored.version).to.equal(SAVE_VERSION);
    expect(restored.cash).to.equal(cash); expect(restored.rngState).to.equal(rngState);
    expect(restored.requests).to.deep.equal(requests); expect(restored.subsidieSeizoen).to.equal(subsidieSeizoen);
    expect(restored.subsidieZaken[0].ingediendWeek).to.equal(undefined);
    expect(restored.subsidieZaken[0].kansBijAanvraag).to.equal(undefined);
    expect(vraagSubsidieAan(restored).ok).to.equal(false);
    const done = playWeeks(restored, 2);
    expect(done.subsidieZaken[0].antwoord).not.to.equal(undefined);
  });

  it('laat ontbrekende oude uitkomsten onbekend en behoudt export/import', () => {
    const s = readyGame(); s.version = 40; s.subsidieSeizoen = s.season;
    s.news.unshift({ season: 1, week: 1, tone: 'goed', text: 'Subsidie toegekend: €999.999' });
    const raw = JSON.parse(JSON.stringify(s)); delete raw.subsidieZaken;
    const restored = migrate(raw);
    expect(restored.subsidieZaken[0].status).to.equal('onbekend');
    expect(restored.subsidieZaken[0].antwoord).to.equal(undefined);
    expect(subsidieCard(restored)).to.include('Uitkomst niet als dossier bewaard');
    expect(migrate(JSON.parse(JSON.stringify(restored))).subsidieZaken).to.deep.equal(restored.subsidieZaken);
  });

  // Oud dossier blijft raadpleegbaar, maar blokkeert het jaarlijkse aanvraagrecht niet.
  it('bewaart een oude uitkomst naast een nieuwe aanvraag in het volgende seizoen', () => {
    let s = readyGame('zuidrand', 'aannemer', 2);
    vraagSubsidieAan(s); s = playWeeks(s, 2);
    const old = structuredClone(s.subsidieZaken[0]);
    s.season++; s.week = 1;
    expect(vraagSubsidieAan(s).ok).to.equal(true);
    expect(s.subsidieZaken).to.have.length(2);
    expect(s.subsidieZaken[0]).to.deep.equal(old);
    expect(s.subsidieZaken[1].id).not.to.equal(old.id);
    expect(subsidieCard(s, old.id)).to.include('Naar dit seizoen');
    expect(vraagSubsidieAan(s).ok).to.equal(false);
  });

  // Eén antwoord heeft één herkenbare rapportkaart; het oude sfeerproza blijft alleen in historie.
  it('toont beide antwoorden eenmaal met de juiste dossierlink in het weekrapport', () => {
    for (const seed of [1, 2]) {
      let s = readyGame('zuidrand', 'aannemer', seed);
      vraagSubsidieAan(s); s = playWeeks(s, 2);
      const z = s.subsidieZaken[0];
      const html = reportOverlay(s, { season: 1, week: 2 });
      expect(html.match(/Antwoord van de gemeente/g)).to.have.length(1);
      expect(html).to.include(`data-id="${z.id}"`);
      expect(html).to.include(z.status === 'toegekend' ? 'Toegekend' : 'Niet toegekend');
      expect(html).not.to.include('Je jeugdwerking gaf de doorslag');
      expect(reportOverlay(s, { season: 1, week: 1 })).not.to.include('Antwoord van de gemeente');
    }
  });

  // Tellen op soort voorkomt dat echte sponsorbeslissingen samen met info verdwijnen.
  it('telt besluiten, maar geen tour, wachten of open transferperiode', () => {
    const s = readyGame(); s.weekChoice = null; s.playerOffers = []; s.sponsorOffers = [];
    const count = bureauStatus(s).count;
    vraagSubsidieAan(s);
    expect(bureauStatus(s).count).to.equal(count);
    expect(bureauStatus(s).informatie.some((t) => t.text.includes('transferperiode'))).to.equal(true);
    s.tour!.hidden = true;
    expect(bureauStatus(s).count).to.equal(count);
    s.sponsorOffers.push({ ...s.sponsors[0], id: 'aanbod', expiresInWeeks: 2 });
    expect(bureauStatus(s).count).to.equal(count + 1);
    expect(bureauStatus(s).acties.some((t) => t.screen === 'sponsors' && t.soort === 'deadline')).to.equal(true);
    expect(dashboardScreen(s)).to.include('Lopende zaken');
    expect(dashboardScreen(s)).to.include('Bekijk dossier');
  });

  // Het dashboard mag een lening niet uit de kasverandering weglaten of eind december acht weken beloven.
  it('toont de volledige kasverandering en de werkelijke prognosehorizon op Bureau', () => {
    const s = readyGame();
    const entries = [
      { week: 1, season: 1, category: 'leningen' as const, amount: 5000, label: 'Lening' },
      { week: 1, season: 1, category: 'aflossingen' as const, amount: -100, label: 'Aflossing' },
    ];
    expect(weekSummary(entries)).to.deep.equal({ income: 5000, costs: -100 });
    s.week = 52;
    const html = dashboardScreen(s);
    expect(html).not.to.include('Over 8 weken');
    expect(html).to.include('vooruitblik 1 week');
  });

  // Dezelfde categorie-indeling moet over weken en seizoenen dezelfde taal spreken.
  it('scheidt werking, investeringen, transfers en financiering zonder geld te verliezen', () => {
    const sum = cashSummary({ tickets: 1000, 'lonen spelers': -400, infrastructuur: -2000, transfers: 300,
      leningen: 5000, aflossingen: -100, subsidies: 700 });
    expect(sum).to.deep.equal({ werking: 1300, investeringen: -2000, transfers: 300, financiering: 4900, totaal: 4500 });
    const s = readyGame(); s.seasonTotals = { tickets: 1000, 'lonen spelers': -400, infrastructuur: -2000 };
    s.weekHistory = playWeeks(readyGame(), 1).weekHistory;
    const html = financeScreen(s);
    expect(html.indexOf('Financiële toestand')).to.be.lessThan(html.indexOf('Gemeentesubsidie'));
    expect(html).not.to.include('Operationeel resultaat');
    expect(html).to.include('Over uit de werking');
  });
});
