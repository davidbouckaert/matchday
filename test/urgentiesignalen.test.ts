import { expect } from 'chai';
import { readyGame } from './helpers';
import { bureauStatus, speelBlokkade, navigationSignal, domainSignals, deadlineBadge } from '../src/ui/signals';

describe('gedeelde urgentietaal', () => {
  // Dezelfde echte vervaltermijn mag per domein geen andere betekenis krijgen.
  it('geeft speler- en sponsorbiedingen dezelfde ernst op elke termijn', () => {
    const s = readyGame();
    for (const remaining of [3, 2, 1]) {
      s.playerOffers = [{ id: 'bod', playerId: s.players[0].id, club: 'Testclub', amount: 100, expiresInWeeks: remaining }];
      s.sponsorOffers = [{ ...s.sponsors[0], id: 'sponsor', expiresInWeeks: remaining }];
      const offers = bureauStatus(s).acties.filter((t) => t.screen === 'transfers' || t.screen === 'sponsors');
      expect(offers).to.have.length(2);
      expect(offers[0].level).to.equal(offers[1].level);
      expect(offers[0].label).to.equal(offers[1].label);
      expect(deadlineBadge(remaining)).to.contain(remaining <= 2 ? 'signal-warn' : 'signal-info');
      expect(navigationSignal(offers).length > 0).to.equal(remaining <= 2);
    }
    s.playerOffers = []; s.sponsorOffers = [];
    expect(bureauStatus(s).acties.filter((t) => ['transfers', 'sponsors'].includes(t.screen))).to.have.length(0);
  });
  // Een tussentijdse inkomstenactie kan het probleem al oplossen vóór de volgende beurt.
  it('baseert geldzorgen op het actuele saldo en escaleert bij de laatste twee controles', () => {
    const s = readyGame(); s.cash = -1;
    for (const [elapsed, level] of [[0, 'warn'], [5, 'warn'], [6, 'urgent'], [7, 'urgent']] as const) {
      s.weeksNegative = elapsed;
      expect(bureauStatus(s).acties.find((t) => t.text === 'Je saldo staat onder nul')?.level).to.equal(level);
    }
    s.cash = 0;
    expect(bureauStatus(s).acties.some((t) => t.text === 'Je saldo staat onder nul')).to.equal(false);
  });
  // Een rood signaal moet exact dezelfde blokkade verklaren als de speelknop.
  it('verklaart opstellingsgaten gelijk op Bureau, navigatie en domeinscherm', () => {
    const s = readyGame(); s.tactics.gaps = { AANV: 1 };
    const t = bureauStatus(s).acties.find((t) => t.label === 'Geblokkeerd')!;
    expect(t.detail).to.equal(speelBlokkade(s));
    expect(domainSignals([t], 'ploeg')).to.contain('Geblokkeerd');
    expect(navigationSignal([t])).to.contain('plaatsen open');
    s.tactics.gaps = {};
    expect(bureauStatus(s).acties.some((t) => t.label === 'Geblokkeerd')).to.equal(false);
  });
  // Contracten lopen af bij de jaarwissel, niet bij de sportieve eindstand in week 44.
  it('gebruikt de jaarwissel en respecteert bewust niet verlengen', () => {
    const s = readyGame(); s.week = 51;
    s.players.forEach((p) => { p.contractUntil = s.season + 1; });
    s.players[0].contractUntil = s.season;
    expect(bureauStatus(s).acties.find((t) => t.screen === 'contracten')?.remaining).to.equal(2);
    s.players[0].nietVerlengen = true;
    expect(bureauStatus(s).acties.some((t) => t.screen === 'contracten')).to.equal(false);
  });
  // Een gebrek aan accommodatie hoort niet als personeelsprobleem te worden gemarkeerd.
  it('koppelt licentiedeadlines alleen aan de betrokken herstelplekken', () => {
    const s = readyGame(); s.week = 38; s.infrastructure.lightingLevel = 0;
    const signals = bureauStatus(s).acties;
    const licence = signals.find((t) => t.text === 'Je licentie is nog niet in orde')!;
    expect(licence.remaining).to.equal(1);
    expect(licence.relatedScreens).to.include('infrastructuur');
    expect(licence.relatedScreens).not.to.include('staff');
    expect(domainSignals(signals, 'infrastructuur')).to.contain('Controle in week 38');
    expect(domainSignals(signals, 'competitie')).to.contain('Controle in week 38');
    s.week = 39;
    expect(bureauStatus(s).acties.some((t) => t.text === 'Je licentie is nog niet in orde')).to.equal(false);
  });
  // Een projectie mag geen speldata, RNG of opgeslagen gelezen-status veranderen.
  it('blijft zuiver en telt wachten niet als urgente actie', () => {
    const s = readyGame(); const before = structuredClone(s);
    bureauStatus(s); bureauStatus(s);
    expect(s).to.deep.equal(before);
    expect(navigationSignal([{ soort: 'wachten', level: 'info', text: 'Loopt', screen: 'doelen', where: 'Logboek' }])).to.equal('');
  });
});
