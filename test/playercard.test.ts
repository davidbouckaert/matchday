import { expect } from 'chai';
import { contractLabel, playerCards } from '../src/ui/screens/playercard';
import { readyGame } from './helpers';
import type { GameState, Player } from '../src/engine/types';

const game = (): GameState => readyGame('heidebeke');

describe('De contractregel op een spelerskaart', () => {
  const s = { season: 3 } as GameState;

  it('telt in seizoenen die nog komen, niet in seizoensnummers', () => {
    expect(contractLabel(s, { contractUntil: 5 } as Player).kort).to.equal('nog 2 seizoenen');
    expect(contractLabel(s, { contractUntil: 4 } as Player).kort).to.equal('nog 1 seizoen');
  });

  it('noemt het laatste seizoen ook zo', () => {
    expect(contractLabel(s, { contractUntil: 3 } as Player).kort).to.equal('laatste seizoen');
    // een contract dat al verlopen zou zijn mag nooit "nog -1 seizoenen" worden
    expect(contractLabel(s, { contractUntil: 2 } as Player).kort).to.equal('laatste seizoen');
  });

  it('zegt in de uitleg wat er gebeurt als je niets doet', () => {
    expect(contractLabel(s, { contractUntil: 3 } as Player).lang).to.contain('gratis');
  });

  it('gebruikt nergens nog de code "S3"', () => {
    for (const tot of [2, 3, 4, 7]) {
      const label = contractLabel(s, { contractUntil: tot } as Player);
      expect(label.kort, `seizoen ${tot}`).to.not.match(/\bS\d/);
      expect(label.lang, `seizoen ${tot}`).to.not.match(/\bS\d/);
    }
  });
});

describe('De kaartweergave van de kern', () => {
  it('zet elke speler op een kaart, met zijn leeftijd als apart feit', () => {
    const s = game();
    const html = playerCards(s, new Set(s.players.slice(0, 11).map((p) => p.id)));
    for (const p of s.players) expect(html, p.name).to.contain(p.name);
    expect(html).to.contain('jaar');
    // de oude losse regel "30 jaar · leider · kernspeler" mag niet terugkomen
    expect(html).to.not.match(/jaar · /);
  });

  it('geeft elk karakter een uitleg in plaats van alleen een woord', () => {
    const s = game();
    const html = playerCards(s, new Set());
    const traits = new Set(s.players.map((p) => p.trait));
    expect(traits.size, 'de test is pas zinvol met meerdere karakters').to.be.greaterThan(1);
    // elk karakter dat op een kaart staat, staat er met een icoontje en een tooltip bij
    for (const t of traits) expect(html, t).to.contain(t);
    expect(html).to.contain('pc-tag');
  });

  it('maakt van elke actie een echte knop', () => {
    const s = game();
    const html = playerCards(s, new Set());
    expect(html).to.contain('class="pc-btn"');
    expect(html).to.contain('data-action="goto-contracts"');
    // geen kale "sm"-knopjes meer op de kaart
    expect(html).to.not.contain('<button class="sm"');
  });
});
