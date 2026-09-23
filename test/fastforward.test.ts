import { expect } from 'chai';
import {
  MAX_FAST_WEEKS,
  STOP_TEXT,
  canFastForward,
  hasMatch,
  lineupReady,
  playAhead,
  quietWeeksAhead,
} from '../src/engine/fastforward';
import { MATCH_WEEKS } from '../src/engine/calendar';
import { openStoryline } from '../src/engine/content';
import { newTestGame, playWeeks, readyGame } from './helpers';

describe('Wanneer er versneld mag worden', () => {
  it('herkent de rustige weken voor de competitie begint', () => {
    const s = readyGame();
    expect(s.week).to.equal(1);
    expect(MATCH_WEEKS[0]).to.equal(7);
    expect(quietWeeksAhead(s)).to.equal(6);
    expect(canFastForward(s)).to.equal(6);
  });

  it('laat niet versnellen in een week waarin je speelt', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0];
    expect(hasMatch(s)).to.equal(true);
    expect(quietWeeksAhead(s)).to.equal(0);
    expect(canFastForward(s)).to.equal(0);
  });

  it('herkent de winterstop als rustige weken', () => {
    const s = readyGame();
    s.week = 22; // na de heenronde, voor de terugronde
    expect(hasMatch(s)).to.equal(false);
    expect(quietWeeksAhead(s)).to.be.at.least(2);
  });

  it('laat niet versnellen zolang er een beslissing openstaat', () => {
    const s = readyGame();
    s.weekChoice = {
      id: 'regen', season: 1, week: 1, title: 'x', text: 'x',
      options: [{ id: 'a', label: 'A', detail: '' }],
      answer: null, outcome: null, vars: {}, focusPlayerId: null, focusSponsorId: null,
    };
    expect(canFastForward(s)).to.equal(0);
  });

  it('laat niet versnellen met een gat in je basiself', () => {
    const s = readyGame();
    expect(lineupReady(s)).to.equal(true);
    s.tactics.gaps = { DOEL: 1 };
    expect(lineupReady(s)).to.equal(false);
    expect(canFastForward(s)).to.equal(0);
  });

  it('laat niet versnellen met minder dan elf speelklare spelers', () => {
    const s = readyGame();
    for (const p of s.players.slice(0, 12)) p.injuryWeeks = 4;
    expect(lineupReady(s)).to.equal(false);
    expect(canFastForward(s)).to.equal(0);
  });

  it('laat niet versnellen zolang de persconferentie wacht', () => {
    const fresh = newTestGame(); // bij een nieuw spel staat de opening nog open
    expect(fresh.opening?.done).to.equal(false);
    expect(canFastForward(fresh)).to.equal(0);
    expect(canFastForward(readyGame()), 'na de persconferentie mag het wel').to.be.above(0);
  });

  it('laat niet versnellen na game over', () => {
    const s = readyGame();
    s.gameOver = true;
    expect(canFastForward(s)).to.equal(0);
  });

  it('versnelt niet voor één enkele week', () => {
    const s = readyGame();
    s.week = MATCH_WEEKS[0] - 1; // volgende week wordt er gespeeld
    expect(quietWeeksAhead(s)).to.equal(1);
    expect(canFastForward(s)).to.equal(0);
  });
});

describe('Doorspelen', () => {
  it('speelt meerdere weken in één keer', () => {
    // hoever je geraakt hangt af van wat er onderweg gebeurt; over een reeks partijen
    // moet er zeker een zijn die meer dan één week aan één stuk doorspeelt
    let longest = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = readyGame('zuidrand', 'aannemer', seed);
      const result = playAhead(s);
      expect(result.state.week, `seed ${seed}`).to.equal(s.week + result.weeks);
      longest = Math.max(longest, result.weeks);
    }
    expect(longest, 'geen enkele partij speelde meer dan één week door').to.be.at.least(2);
  });

  it('laat de toestand die binnenkomt ongemoeid', () => {
    const s = readyGame();
    const before = JSON.stringify(s);
    playAhead(s);
    expect(JSON.stringify(s)).to.equal(before);
  });

  it('stopt vlak voor de volgende wedstrijd', () => {
    const s = readyGame();
    const result = playAhead(s);
    if (result.reason === 'wedstrijd') {
      expect(hasMatch(result.state)).to.equal(true);
      expect(result.state.week).to.equal(MATCH_WEEKS[0]);
    }
    expect(['wedstrijd', 'weekmoment', 'saldo', 'opstelling', 'limiet']).to.include(result.reason);
  });

  it('komt op dezelfde plek uit als week per week spelen', () => {
    const a = playAhead(readyGame('zuidrand', 'aannemer', 77));
    const b = playWeeks(readyGame('zuidrand', 'aannemer', 77), a.weeks);
    expect(b.week).to.equal(a.state.week);
    expect(b.cash).to.equal(a.state.cash);
    expect(b.community.fanMood).to.equal(a.state.community.fanMood);
    expect(b.news.length).to.equal(a.state.news.length);
  });

  it('geeft met dezelfde seed hetzelfde resultaat', () => {
    const a = playAhead(readyGame('heidebeke', 'fonds', 5));
    const b = playAhead(readyGame('heidebeke', 'fonds', 5));
    expect(a.weeks).to.equal(b.weeks);
    expect(a.reason).to.equal(b.reason);
    expect(a.state.cash).to.equal(b.state.cash);
  });

  it('stopt zodra er een beslissing op je bureau ligt', () => {
    // over veel partijen komt er ergens een weekmoment binnen de rustige weken
    let stopped = false;
    for (let seed = 1; seed <= 40 && !stopped; seed++) {
      const r = playAhead(readyGame('zuidrand', 'aannemer', seed));
      if (r.reason === 'weekmoment') {
        stopped = true;
        expect(r.state.weekChoice, 'gestopt voor een weekmoment dat er niet is').to.not.equal(null);
        expect(r.state.weekChoice!.answer).to.equal(null);
      }
    }
    expect(stopped, 'er werd nooit gestopt voor een weekmoment').to.equal(true);
  });

  it('stopt zodra het saldo onder nul duikt', () => {
    let stopped = false;
    for (let seed = 1; seed <= 20; seed++) {
      const s = readyGame('zuidrand', 'aannemer', seed);
      s.cash = 500; // dit houdt geen paar weken
      const result = playAhead(s);
      if (result.reason === 'saldo') {
        stopped = true;
        expect(result.state.cash, `seed ${seed}`).to.be.below(0);
      } else {
        // stopt het om een andere reden, dan mag de kas nog niet in het rood staan
        expect(result.state.cash, `seed ${seed} stopte op "${result.reason}"`).to.be.at.least(0);
      }
    }
    expect(stopped, 'er werd nooit gestopt voor een saldo onder nul').to.equal(true);
  });

  it('gaat nooit over de bovengrens heen', () => {
    const s = readyGame();
    s.week = 43; // de laatste weken van het seizoen, allemaal rustig
    const result = playAhead(s, 50);
    expect(result.weeks).to.be.at.most(MAX_FAST_WEEKS);
  });

  it('respecteert een lagere grens die je zelf meegeeft', () => {
    const result = playAhead(readyGame(), 3);
    expect(result.weeks).to.be.at.most(3);
  });

  it('stopt bij een nieuw seizoen, zodat de persconferentie niet overgeslagen wordt', () => {
    let s = readyGame('heidebeke', 'fonds', 3);
    s.cash = 3_000_000;
    s = playWeeks(s, 46); // ruim na de laatste speeldag
    const result = playAhead(s, MAX_FAST_WEEKS);
    if (result.state.season > s.season) {
      expect(result.reason).to.equal('seizoen');
      expect(result.state.opening?.done).to.equal(false);
    }
  });
});

describe('Wat je oversloeg', () => {
  it('vertelt hoeveel de kas veranderde', () => {
    const s = readyGame();
    const result = playAhead(s);
    expect(result.digest.net).to.equal(result.state.cash - s.cash);
  });

  it('verzamelt alleen nieuws uit de gespeelde weken', () => {
    const s = readyGame();
    const result = playAhead(s);
    for (const item of result.digest.news) {
      expect(item.season * 52 + item.week).to.be.at.least(result.from.season * 52 + result.from.week);
      expect(item.season * 52 + item.week).to.be.below(result.from.season * 52 + result.from.week + result.weeks);
    }
  });

  it('houdt de lijst met nieuws kort', () => {
    const s = readyGame();
    s.week = 43;
    expect(playAhead(s).digest.news.length).to.be.at.most(12);
  });

  it('vermeldt records en mijlpalen die onderweg vielen', () => {
    let found = false;
    for (let seed = 1; seed <= 25 && !found; seed++) {
      const r = playAhead(readyGame('heidebeke', 'fonds', seed));
      if (r.digest.milestones.length || r.digest.records.length) found = true;
    }
    expect(found, 'in geen enkele partij viel er onderweg iets te vieren').to.equal(true);
  });

  it('geeft voor elke reden een leesbare uitleg', () => {
    for (const [reason, text] of Object.entries(STOP_TEXT)) {
      expect(text, reason).to.be.a('string').and.not.equal('');
      expect(text.endsWith('.'), reason).to.equal(true);
    }
  });

  it('laat de rest van het spel gewoon doorlopen', () => {
    const s = readyGame();
    const result = playAhead(s);
    const after = playWeeks(result.state, 4);
    expect(after.week).to.be.above(result.state.week);
    expect(after.gameOver).to.equal(false);
  });

  it('raakt verhaallijnen en de wereld niet anders aan dan gewoon spelen', () => {
    const a = readyGame('zuidrand', 'aannemer', 12);
    openStoryline(a, 'proef', 20, { speler: 'Jan' });
    const fast = playAhead(a, 4);
    const b = readyGame('zuidrand', 'aannemer', 12);
    openStoryline(b, 'proef', 20, { speler: 'Jan' });
    const slow = playWeeks(b, fast.weeks);
    expect(fast.state.storylines).to.deep.equal(slow.storylines);
    expect(fast.state.world.clubs.map((c) => c.strength)).to.deep.equal(slow.world.clubs.map((c) => c.strength));
  });
});
