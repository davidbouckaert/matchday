import { expect } from 'chai';
import type { StaffRole } from '../src/engine/types';
import { staffImpact } from '../src/engine/impact';
import { readyGame } from './helpers';
import * as actions from '../src/engine/actions';

const game = () => readyGame('zuidrand', 'fonds', 11);

describe('Wat levert dit personeelslid op', () => {
  it('zegt van een betere hoofdtrainer dat de ploeg sterker wordt', () => {
    const s = game();
    const beter = staffImpact(s, 'hoofdtrainer', 90, 40);
    const sterkte = beter.find((i) => i.label === 'Teamsterkte');
    expect(sterkte, 'geen uitspraak over de teamsterkte').to.not.equal(undefined);
    expect(sterkte!.value.startsWith('+'), `stond er "${sterkte!.value}"`).to.equal(true);
    expect(sterkte!.tone).to.equal('good');
  });

  it('draait het om wanneer je een slechtere aanwerft', () => {
    const s = game();
    const slechter = staffImpact(s, 'hoofdtrainer', 30, 85);
    const sterkte = slechter.find((i) => i.label === 'Teamsterkte')!;
    expect(sterkte.value.startsWith('−')).to.equal(true);
    expect(sterkte.tone).to.equal('bad');
  });

  it('meet een kinesist af aan blessures en herstel, niet aan de teamsterkte', () => {
    const s = game();
    const labels = staffImpact(s, 'kinesist', 80, null).map((i) => i.label);
    expect(labels).to.include('Blessurekans');
    expect(labels).to.not.include('Teamsterkte');
  });

  it('laat een betere kinesist de blessurekans zakken', () => {
    const s = game();
    const blessures = staffImpact(s, 'kinesist', 90, 20).find((i) => i.label === 'Blessurekans')!;
    expect(blessures.value.startsWith('−'), `stond er "${blessures.value}"`).to.equal(true);
    expect(blessures.tone).to.equal('good');
  });

  it('laat een commercieel medewerker zien wat sponsors extra betalen', () => {
    const s = game();
    const gevolgen = staffImpact(s, 'commercieel', 85, null);
    const sponsors = gevolgen.find((i) => i.label === 'Sponsors betalen')!;
    expect(sponsors.value.startsWith('+')).to.equal(true);
    expect(gevolgen.find((i) => i.label === 'Kans op ja')).to.not.equal(undefined);
  });

  it('geeft elke rol iets concreets te zeggen', () => {
    const s = game();
    const rollen: StaffRole[] = [
      'hoofdtrainer', 'assistent', 'conditietrainer', 'keepertrainer', 'voeding', 'verzorger',
      'mentaal', 'analist', 'kinesist', 'afgevaardigde', 'scout', 'commercieel', 'kantine',
      'jeugdcoordinator', 'merchandising',
    ];
    for (const rol of rollen) {
      const gevolgen = staffImpact(s, rol, 80, null);
      expect(gevolgen.length, `${rol} heeft niets te melden`).to.be.above(0);
      for (const g of gevolgen) {
        expect(g.icon, `${rol}: icoon ontbreekt`).to.have.length.above(0);
        expect(g.label.split(' ').length, `${rol}: "${g.label}" is te lang voor een kaartje`).to.be.at.most(3);
        expect(g.tip.length, `${rol}: de uitleg is te kort om iets te zeggen`).to.be.above(30);
      }
    }
  });

  it('laat de club die je meegeeft ongemoeid', () => {
    const s = game();
    const voor = JSON.stringify(s.staff);
    staffImpact(s, 'kinesist', 90, 10);
    expect(JSON.stringify(s.staff), 'de proefopstelling lekte naar je echte kern').to.equal(voor);
  });
});

describe('Wisselen in de opstelling', () => {
  it('zet de invaller in de basis en de ander op de bank', () => {
    const s = game();
    actions.autoLineup(s);
    const basis = s.players.filter((p) => p.injuryWeeks === 0 && p.suspended === 0);
    const uit = basis[0];
    const inMan = basis.find((p) => p.id !== uit.id && p.position === uit.position)!;
    s.tactics.manualXI = [uit.id];

    const r = actions.swapInLineup(s, uit.id, inMan.id);
    expect(r.ok, r.message).to.equal(true);
    expect(s.tactics.manualXI).to.include(inMan.id);
    expect(s.tactics.manualXI).to.not.include(uit.id);
    expect(s.tactics.benched, 'wie eruit gaat hoort op de bank').to.include(uit.id);
  });

  it('weigert iemand die niet kan spelen', () => {
    const s = game();
    const uit = s.players[0];
    const geblesseerd = s.players[1];
    geblesseerd.injuryWeeks = 3;
    expect(actions.swapInLineup(s, uit.id, geblesseerd.id).ok).to.equal(false);

    const geschorst = s.players[2];
    geschorst.suspended = 1;
    expect(actions.swapInLineup(s, uit.id, geschorst.id).ok).to.equal(false);
  });

  it('weigert een speler met zichzelf te wisselen en onbekende spelers', () => {
    const s = game();
    const p = s.players[0];
    expect(actions.swapInLineup(s, p.id, p.id).ok).to.equal(false);
    expect(actions.swapInLineup(s, p.id, 'bestaat-niet').ok).to.equal(false);
  });

  it('haalt de invaller van de bank als hij daar stond', () => {
    const s = game();
    const uit = s.players[0];
    const inMan = s.players[1];
    s.tactics.manualXI = [uit.id];
    s.tactics.benched = [inMan.id];

    expect(actions.swapInLineup(s, uit.id, inMan.id).ok).to.equal(true);
    expect(s.tactics.benched, 'hij stond nog steeds op de bank').to.not.include(inMan.id);
  });

  it('laat het aan je trainer over wanneer je de opstelling hebt uitbesteed', () => {
    const s = game();
    const coach = s.staff.find((m) => m.role === 'hoofdtrainer')!;
    s.delegation.opstelling = coach.id;
    const r = actions.swapInLineup(s, s.players[0].id, s.players[1].id);
    expect(r.ok).to.equal(false);
  });
});
