import { expect } from 'chai';
import { BANK_MAX, SUBS_MAX, SUB_WINDOW, overall, planSubstitutions, playEffect, selectBank, selectLineup } from '../src/engine/players';
import { createRng } from '../src/engine/rng';
import { migrate } from '../src/storage/save';
import { readyGame, playWeeks } from './helpers';
import type { GameState, Player } from '../src/engine/types';

function basiself(s: GameState): Player[] {
  return selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).lineup;
}

describe('de wisselbank', () => {
  it('respecteert jouw bank, zonder overlap met de basiself en met een plafond', () => {
    const s = readyGame();
    const xi = basiself(s);
    const buiten = s.players.filter((p) => !xi.some((x) => x.id === p.id) && p.injuryWeeks === 0 && p.suspended === 0);
    s.tactics.benched = [xi[0].id, ...buiten.slice(0, BANK_MAX + 2).map((p) => p.id)];
    const bank = selectBank(s.players, s.tactics.benched, xi, true);
    expect(bank.length).to.be.at.most(BANK_MAX);
    expect(bank.map((p) => p.id)).to.not.include(xi[0].id); // wie start, zit niet óók op de bank
  });

  it('laat de trainer de beste beschikbaren kiezen als jij niets aanduidt of uitbesteedt', () => {
    const s = readyGame();
    const xi = basiself(s);
    const auto = selectBank(s.players, [], xi, true);
    const buiten = s.players
      .filter((p) => !xi.some((x) => x.id === p.id) && p.injuryWeeks === 0 && p.suspended === 0 && p.loan?.type !== 'uit')
      .sort((a, b) => overall(b) - overall(a));
    expect(auto.map((p) => p.id)).to.deep.equal(buiten.slice(0, BANK_MAX).map((p) => p.id));
    // uitbesteed: jouw lijst wordt genegeerd
    s.tactics.benched = [buiten[buiten.length - 1].id];
    const gedelegeerd = selectBank(s.players, s.tactics.benched, xi, false);
    expect(gedelegeerd.map((p) => p.id)).to.deep.equal(auto.map((p) => p.id));
  });

  it('plant één tot drie wissels in het venster, en haalt nooit de doelman eraf', () => {
    const s = readyGame();
    const xi = basiself(s);
    const bank = selectBank(s.players, [], xi, true);
    for (let seed = 1; seed <= 25; seed++) {
      const plan = planSubstitutions(createRng({ rngState: seed }), xi, bank);
      expect(plan.length).to.be.within(1, SUBS_MAX);
      for (const w of plan) {
        expect(w.minute).to.be.within(SUB_WINDOW[0], SUB_WINDOW[1]);
        expect(w.out.position).to.not.equal('DOEL');
        expect(w.share).to.be.closeTo((90 - w.minute) / 90, 0.011);
      }
      // gesorteerd en zonder dubbele spelers
      const minuten = plan.map((w) => w.minute);
      expect([...minuten].sort((a, b) => a - b)).to.deep.equal(minuten);
      expect(new Set(plan.map((w) => w.in.id)).size).to.equal(plan.length);
    }
    expect(planSubstitutions(createRng({ rngState: 1 }), xi, [])).to.have.length(0);
  });

  it('geeft invallers echte speelminuten: invalbeurten en een deel-speelaandeel', () => {
    let s = readyGame();
    // tot de eerste wedstrijd spelen (competitie start in week 7)
    for (let i = 0; i < 10 && !s.lastMatch; i++) s = playWeeks(s, 1);
    expect(s.lastMatch, 'er moet een wedstrijd gespeeld zijn').to.not.equal(undefined);
    const invallers = s.players.filter((p) => p.subIn > 0);
    expect(invallers.length).to.be.within(1, SUBS_MAX);
    for (const p of invallers) {
      expect(p.periodStarts).to.be.greaterThan(0);
      expect(p.periodStarts % 1, 'een invalbeurt telt als deel van een wedstrijd').to.be.greaterThan(0);
    }
  });

  it('wisselt uit jóuw bank, en de tijdlijn toont die echte wissels', () => {
    let s = readyGame();
    const xi = basiself(s);
    const buiten = s.players.filter((p) => !xi.some((x) => x.id === p.id) && p.injuryWeeks === 0 && p.suspended === 0);
    const bankNamen = buiten.slice(0, 3).map((p) => p.name);
    s.tactics.benched = buiten.slice(0, 3).map((p) => p.id);
    for (let i = 0; i < 10 && !s.lastMatch; i++) s = playWeeks(s, 1);
    const eigenWissels = (s.lastMatch!.moments ?? []).filter((m) => m.type === 'wissel' && m.us);
    expect(eigenWissels.length).to.be.within(1, SUBS_MAX);
    for (const w of eigenWissels) {
      expect(bankNamen.some((naam) => w.text.startsWith(`${naam} erin`)), `${w.text} moet van jouw bank komen`).to.equal(true);
    }
  });

  it('beloont bankminuten in de groeiformule: meer speelaandeel = meer groei', () => {
    const p = { age: 19 } as Player;
    expect(playEffect(p, 0.3)).to.be.greaterThan(playEffect(p, 0)); // invalbeurten tillen het aandeel op
    expect(playEffect(p, 0)).to.be.lessThan(0); // wie nooit speelt, remt af — daarom stuur je met de bank
  });

  it('maakt bij het laden van een oud bestand de bank leeg (het veld betekende het omgekeerde)', () => {
    const s = readyGame();
    s.tactics.benched = [s.players[0].id];
    for (const p of s.players) delete (p as Partial<Player>).subIn;
    (s as { version: number }).version = 36;
    const na = migrate(JSON.parse(JSON.stringify(s)));
    expect(na.tactics.benched).to.deep.equal([]);
    expect(na.players.every((p) => p.subIn === 0)).to.equal(true);
  });
});
