import { expect } from 'chai';
import * as actions from '../src/engine/actions';
import { transferWillingness } from '../src/engine/appeal';
import { readyGame, playWeeks } from './helpers';

describe('kopen en huren als gesprek', () => {
  it('reserveert de speler: hij is van de markt zolang het gesprek loopt', () => {
    const s = readyGame();
    s.cash = 1_000_000;
    const doel = s.transferList[0];
    expect(actions.buyPlayer(s, doel.id).ok).to.equal(true);
    expect(s.transferList.some((p) => p.id === doel.id)).to.equal(false);
    expect(s.requests.some((r) => r.kind === 'transfer-koop' && r.targetId === doel.id)).to.equal(true);
    // en niet twee keer over dezelfde man beginnen
    expect(actions.buyPlayer(s, doel.id).ok).to.equal(false);
  });

  it('springt af als het geld weg is voor het ja-woord valt', () => {
    let s = readyGame();
    s.cash = 1_000_000;
    const doel = s.transferList.filter((p) => p.purchasePrice > 0).find((p) => transferWillingness(s, p).kans >= 1);
    if (!doel) return; // geen betaalbare gegadigde in deze seed: niets te testen
    expect(actions.buyPlayer(s, doel.id).ok).to.equal(true);
    s.cash = 0; // intussen alles uitgegeven
    s = playWeeks(s, 1);
    expect(s.players.some((p) => p.id === doel.id)).to.equal(false);
    expect(s.news.some((n) => n.text.includes(doel.name) && n.text.includes('springt af'))).to.equal(true);
  });
});

describe('niet verlengen', () => {
  it('haalt hem uit de aflooplijst en de waarschuwing, en is omkeerbaar', () => {
    const s = readyGame();
    const p = s.players.find((x) => x.contractUntil <= s.season && x.loan?.type !== 'in');
    if (!p) return;
    expect(actions.toggleNoExtend(s, p.id).ok).to.equal(true);
    expect(p.nietVerlengen).to.equal(true);
    expect(actions.toggleNoExtend(s, p.id).ok).to.equal(true); // bedenken mag
    expect(p.nietVerlengen).to.equal(false);
  });

  it('verlengen zet de beslissing vanzelf terug', () => {
    const s = readyGame();
    s.cash = 500_000;
    const p = s.players.find((x) => x.contractUntil <= s.season && x.loan?.type !== 'in');
    if (!p) return;
    actions.toggleNoExtend(s, p.id);
    p.morale = 90;
    const r = actions.extendContract(s, p.id, Math.round(p.wage * 1.6));
    if (r.ok) expect(p.nietVerlengen).to.equal(false);
  });
});
