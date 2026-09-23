import { expect } from 'chai';
import type { StaffRole } from '../src/engine/types';
import { playerImpact, staffImpact, upgradeImpact } from '../src/engine/impact';
import { UPGRADES } from '../src/engine/data/catalog';
import { overall } from '../src/engine/players';
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

describe('Wat levert dit bouwproject op', () => {
  it('geeft een grotere tribune meer plaatsen maar ook meer vaste kosten', () => {
    const s = game();
    const gevolgen = upgradeImpact(s, 'tribune', 600);
    const plaatsen = gevolgen.find((i) => i.label === 'Plaatsen')!;
    expect(plaatsen.value).to.equal('+600');
    const kosten = gevolgen.find((i) => i.label === 'Vaste kosten')!;
    expect(kosten, 'een tribune kost ook onderhoud').to.not.equal(undefined);
    expect(kosten.value.startsWith('+')).to.equal(true);
    expect(kosten.tone).to.equal('bad');
  });

  it('laat een kantinerenovatie zien in de winst per bezoeker', () => {
    const s = game();
    const kantine = upgradeImpact(s, 'kantine').find((i) => i.label === 'Per bezoeker')!;
    expect(kantine.value.startsWith('+')).to.equal(true);
    expect(kantine.tone).to.equal('good');
  });

  it('meet toiletten en parking af aan het publiek', () => {
    const s = game();
    for (const id of ['sanitair', 'parking', 'wifi'] as const) {
      const publiek = upgradeImpact(s, id).find((i) => i.label === 'Toeschouwers');
      expect(publiek, `${id} trekt geen volk`).to.not.equal(undefined);
      expect(publiek!.value.startsWith('+'), id).to.equal(true);
    }
  });

  it('geeft elk bouwproject iets concreets te zeggen', () => {
    const s = game();
    for (const u of UPGRADES) {
      const gevolgen = upgradeImpact(s, u.id, u.id === 'tribune' ? 400 : undefined);
      expect(gevolgen.length, `${u.id} heeft niets te melden`).to.be.above(0);
      for (const g of gevolgen) expect(g.label.split(' ').length, `${u.id}: "${g.label}"`).to.be.at.most(3);
    }
  });

  it('laat de club die je meegeeft ongemoeid', () => {
    const s = game();
    const voor = s.infrastructure.capacity;
    upgradeImpact(s, 'tribune', 1000);
    expect(s.infrastructure.capacity).to.equal(voor);
  });
});

describe('Wat doet deze speler met je ploeg', () => {
  it('zegt dat een topspeler je ploeg sterker maakt', () => {
    const s = game();
    const beste = [...s.players].sort((a, b) => overall(b) - overall(a))[0];
    const ster = { ...structuredClone(beste), id: 'proef', name: 'Proef Speler' };
    ster.technique = 95;
    ster.physical = 95;
    const sterkte = playerImpact(s, ster).find((i) => i.label === 'Teamsterkte')!;
    expect(sterkte.value.startsWith('+'), `stond er "${sterkte.value}"`).to.equal(true);
  });

  it('zegt eerlijk dat een zwakke speler niets toevoegt', () => {
    const s = game();
    const zwak = { ...structuredClone(s.players[0]), id: 'proef2', name: 'Zwak' };
    zwak.technique = 5;
    zwak.physical = 5;
    const sterkte = playerImpact(s, zwak).find((i) => i.label === 'Teamsterkte')!;
    expect(sterkte.value).to.equal('geen');
    expect(sterkte.tone).to.equal('neutral');
  });

  it('noemt altijd het loon, want dat loopt elke week door', () => {
    const s = game();
    const loon = playerImpact(s, s.players[0]).find((i) => i.label === 'Loon')!;
    expect(loon.value).to.contain(String(s.players[0].wage));
    expect(loon.tone).to.equal('bad');
  });

  it('draait het loon om wanneer je hem zou verkopen', () => {
    const s = game();
    const loon = playerImpact(s, s.players[0], false).find((i) => i.label === 'Loon')!;
    expect(loon.value.startsWith('+')).to.equal(true);
    expect(loon.tone).to.equal('good');
  });

  it('laat je kern ongemoeid', () => {
    const s = game();
    const aantal = s.players.length;
    playerImpact(s, { ...structuredClone(s.players[0]), id: 'proef3' });
    expect(s.players.length).to.equal(aantal);
  });
});
