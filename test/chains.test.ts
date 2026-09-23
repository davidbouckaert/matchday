import { expect } from 'chai';
import type { GameState } from '../src/engine/types';
import type { MomentDef } from '../src/content/types';
import { CHAIN_MOMENTS, MOMENTS } from '../src/content/moments';
import { CHAIN_EVENTS, RANDOM_EVENTS } from '../src/content/events';
import { apply, openStoryline, remember, storyline, worldContext } from '../src/engine/content';
import { eventChance, fireEvent } from '../src/engine/events';
import { answerWeekChoice, makeWeekChoice } from '../src/engine/weekmoment';
import { createRng } from '../src/engine/rng';
import * as actions from '../src/engine/actions';
import { newTestGame, playWeeks } from './helpers';

/** Zet een moment klaar door net zo lang te loten tot het gevraagde moment valt. */
function forceMoment(s: GameState, id: string, tries = 400): GameState['weekChoice'] {
  s.week = 8;
  for (let i = 0; i < tries; i++) {
    s.eventCooldowns = {};
    const made = makeWeekChoice(s, createRng(s));
    if (made?.id === id) return made;
  }
  return null;
}

describe('Ketens: de sponsorruzie', () => {
  it('bestaat uit meer dan één gebeurtenis', () => {
    const chain = CHAIN_MOMENTS.filter((m) => m.id.startsWith('sponsor-'));
    expect(chain.length).to.be.at.least(3);
    expect(chain.filter((m) => m.verhaal).length).to.be.at.least(2);
  });

  it('opent een verhaallijn bij de eerste stap en sluit ze bij de laatste', () => {
    const s = newTestGame();
    const first = forceMoment(s, 'sponsor-onvrede');
    expect(first, 'de eerste stap van de keten kwam nooit voor').to.not.equal(null);
    s.weekChoice = first;
    answerWeekChoice(s, 'praten');
    expect(storyline(s, 'sponsorgesprek'), 'de verhaallijn ging niet open').to.not.equal(undefined);

    const second = forceMoment(s, 'sponsor-gesprek-vervolg');
    expect(second, 'de tweede stap volgde nooit op de eerste').to.not.equal(null);
    s.weekChoice = second;
    answerWeekChoice(s, 'avond');
    expect(storyline(s, 'sponsorgesprek'), 'de verhaallijn bleef openstaan').to.equal(undefined);
  });

  it('laat de tweede stap de naam uit de eerste overnemen', () => {
    const s = newTestGame();
    const sponsorName = [...s.sponsors].sort((a, b) => b.weekly - a.weekly)[0].name;
    openStoryline(s, 'sponsorgesprek', 14, { sponsor: sponsorName });
    const second = forceMoment(s, 'sponsor-gesprek-vervolg');
    expect(second, 'de vervolgstap kwam nooit voor').to.not.equal(null);
    expect(second!.title).to.contain(sponsorName);
    expect(second!.text).to.contain(sponsorName);
    expect(second!.text).to.not.contain('{');
  });

  it('splitst in twee takken naargelang wat je koos', () => {
    const praat = newTestGame('zuidrand', 'aannemer', 5);
    const first = forceMoment(praat, 'sponsor-onvrede');
    expect(first).to.not.equal(null);
    praat.weekChoice = first;
    answerWeekChoice(praat, 'praten');

    const negeer = newTestGame('zuidrand', 'aannemer', 5);
    const other = forceMoment(negeer, 'sponsor-onvrede');
    negeer.weekChoice = other;
    answerWeekChoice(negeer, 'negeren');

    expect(storyline(praat, 'sponsorgesprek')).to.not.equal(undefined);
    expect(storyline(praat, 'sponsorkoud')).to.equal(undefined);
    expect(storyline(negeer, 'sponsorkoud')).to.not.equal(undefined);
    expect(storyline(negeer, 'sponsorgesprek')).to.equal(undefined);
  });

  it('laat de eerste stap niet opnieuw opduiken zolang de keten loopt', () => {
    const s = newTestGame();
    openStoryline(s, 'sponsorgesprek', 14, {});
    const again = forceMoment(s, 'sponsor-onvrede', 150);
    expect(again, 'de keten begon opnieuw terwijl ze nog liep').to.equal(null);
  });
});

describe('Ketens: de verkochte speler', () => {
  it('opent een verhaallijn zodra je iemand verkoopt', () => {
    const s = newTestGame();
    s.week = 5; // transferperiode
    const target = s.players.find((p) => !p.loan)!;
    const result = actions.sellPlayer(s, target.id);
    expect(result.ok, result.message).to.equal(true);
    const line = storyline(s, 'oudspeler');
    expect(line, 'geen verhaallijn na de verkoop').to.not.equal(undefined);
    expect(line!.vars.speler).to.equal(target.name);
    expect(line!.vars.oudeclub).to.be.a('string').and.not.equal('');
  });

  it('legt de verkoop vast in de clubkroniek', () => {
    const s = newTestGame();
    s.week = 5;
    const target = s.players.find((p) => !p.loan)!;
    actions.sellPlayer(s, target.id);
    expect(s.chronicle.some((c) => c.text.includes(target.name))).to.equal(true);
  });

  it('brengt hem later terug als tegenstander, met zijn eigen naam', () => {
    const s = newTestGame();
    s.week = 5;
    const target = s.players.find((p) => !p.loan)!;
    actions.sellPlayer(s, target.id);
    const moment = forceMoment(s, 'oude-bekende');
    expect(moment, 'de oude bekende kwam nooit terug').to.not.equal(null);
    expect(moment!.title).to.contain(target.name);
    expect(moment!.text).to.contain(target.name);
    expect(moment!.text).to.contain(s.storylines.find((x) => x.name === 'oudspeler')!.vars.oudeclub);
    expect(moment!.text).to.not.contain('{');
  });
});

describe('Ketens: een investering die nazindert', () => {
  it('opent een verhaallijn wanneer een bouwproject klaar is', () => {
    const s = newTestGame();
    s.cash = 500_000;
    const started = actions.startUpgrade(s, 'wifi');
    expect(started.ok, started.message).to.equal(true);
    const after = playWeeks(s, 30);
    expect(after.infrastructure.constructions.length).to.equal(0);
    expect(after.chronicle.some((c) => c.text.startsWith('Bouwproject afgerond'))).to.equal(true);
  });

  it('levert later nieuws en extra supporters op', () => {
    const s = newTestGame();
    openStoryline(s, 'nieuwbouw', 26, { wat: 'nieuwe tribune' });
    const def = CHAIN_EVENTS.find((e) => e.id === 'nieuwbouw-pers')!;
    expect(eventChance(s, def)).to.be.above(0);
    const fans = s.community.fanBase;
    fireEvent(s, createRng(s), def);
    expect(s.community.fanBase).to.be.above(fans);
    expect(s.news[0].text).to.contain('nieuwe tribune');
    expect(s.news[0].text).to.not.contain('{');
    expect(storyline(s, 'nieuwbouw'), 'de verhaallijn bleef openstaan').to.equal(undefined);
  });

  it('kan niet gebeuren zonder die eerdere investering', () => {
    const s = newTestGame();
    const def = CHAIN_EVENTS.find((e) => e.id === 'nieuwbouw-pers')!;
    expect(eventChance(s, def)).to.equal(0);
  });
});

describe('Ketens: geldzorgen slepen aan', () => {
  it('opent een verhaallijn zodra het saldo een tijdje onder nul staat', () => {
    const s = newTestGame();
    s.cash = -50_000;
    const after = playWeeks(s, 3);
    expect(storyline(after, 'geldzorgen'), 'geen verhaallijn na weken in het rood').to.not.equal(undefined);
  });

  it('maakt gevolgen mogelijk die er anders niet zijn', () => {
    const gezond = newTestGame();
    const zorgen = newTestGame();
    openStoryline(zorgen, 'geldzorgen', 40);
    for (const id of ['geldzorgen-sponsor', 'geldzorgen-vrijwilligers']) {
      const def = CHAIN_EVENTS.find((e) => e.id === id)!;
      expect(eventChance(gezond, def), `${id} zou niet mogen kunnen`).to.equal(0);
      expect(eventChance(zorgen, def), `${id} zou wel moeten kunnen`).to.be.above(0);
    }
  });

  it('laat vrijwilligers afhaken met een reden die naar de kas verwijst', () => {
    const s = newTestGame();
    openStoryline(s, 'geldzorgen', 40);
    const def = CHAIN_EVENTS.find((e) => e.id === 'geldzorgen-vrijwilligers')!;
    const before = s.community.volunteers;
    fireEvent(s, createRng(s), def);
    expect(s.community.volunteers).to.be.below(before);
    expect(s.news[0].text).to.contain('niet gratis werken');
  });

  it('blijft nawerken nadat het saldo weer klopt', () => {
    const s = newTestGame();
    s.cash = -50_000;
    let after = playWeeks(s, 3);
    after.cash = 200_000;
    after = playWeeks(after, 4);
    expect(after.weeksNegative).to.equal(0);
    expect(storyline(after, 'geldzorgen'), 'de zorgen waren meteen vergeten').to.not.equal(undefined);
  });
});

describe('Ketens: de rivaal die je jeugd wegkaapt', () => {
  it('heeft een vervolgmoment dat aan de verhaallijn hangt', () => {
    const def = CHAIN_MOMENTS.find((m) => m.id === 'weggekaapt-wraak')!;
    expect(def.verhaal).to.equal('weggekaapt');
  });

  it('noemt de speler en de club bij naam in het vervolg', () => {
    const s = newTestGame();
    openStoryline(s, 'weggekaapt', 78, { speler: 'Jonas Verschuere', oudeclub: 'KFC Merelbeek' });
    const moment = forceMoment(s, 'weggekaapt-wraak');
    expect(moment, 'het vervolgmoment kwam nooit').to.not.equal(null);
    expect(moment!.text).to.contain('Jonas Verschuere');
    expect(moment!.text).to.contain('KFC Merelbeek');
  });

  it('sluit de verhaallijn zodra je erin investeert', () => {
    const s = newTestGame();
    s.cash = 100_000;
    openStoryline(s, 'weggekaapt', 78, { speler: 'Jonas', oudeclub: 'KFC Merelbeek' });
    const moment = forceMoment(s, 'weggekaapt-wraak');
    expect(moment).to.not.equal(null);
    s.weekChoice = moment;
    const outcome = answerWeekChoice(s, 'investeren');
    expect(outcome).to.be.a('string');
    expect(storyline(s, 'weggekaapt')).to.equal(undefined);
    expect(s.chronicle.some((c) => c.text.includes('Jonas'))).to.equal(true);
  });
});

describe('De clubkroniek', () => {
  it('bewaart wat de moeite is, nieuwste eerst', () => {
    const s = newTestGame();
    remember(s, 'Eerste gebeurtenis.');
    s.week = 10;
    remember(s, 'Tweede gebeurtenis.');
    expect(s.chronicle[0].text).to.equal('Tweede gebeurtenis.');
    expect(s.chronicle[1].text).to.equal('Eerste gebeurtenis.');
    expect(s.chronicle[0].week).to.equal(10);
  });

  it('loopt niet eindeloos vol', () => {
    const s = newTestGame();
    for (let i = 0; i < 200; i++) remember(s, `Gebeurtenis ${i}`);
    expect(s.chronicle.length).to.be.at.most(120);
  });

  it('vult zich vanzelf tijdens het spelen', () => {
    const after = playWeeks(newTestGame('heidebeke', 'fonds', 31), 120);
    expect(after.chronicle.length, 'er gebeurde in twee seizoenen niets onthoudbaars').to.be.above(0);
  });
});

describe('Alle ketens samen', () => {
  it('hangen de vervolgmomenten allemaal aan een verhaallijn die ergens geopend wordt', () => {
    const opened = new Set<string>();
    const scan = (effects: unknown): void => {
      if (Array.isArray(effects)) return effects.forEach(scan);
      if (!effects || typeof effects !== 'object') return;
      const e = effects as Record<string, { naam?: string } | undefined> & { dan?: unknown };
      if (e.verhaalOpenen?.naam) opened.add(e.verhaalOpenen.naam);
      if (e.dan) scan(e.dan);
    };
    for (const m of MOMENTS) for (const k of m.keuzes) for (const g of k.gevolgen) scan(g.effecten);
    for (const e of RANDOM_EVENTS) scan(e.effecten);
    // deze verhaallijnen worden door de engine zelf geopend, niet door contentdata
    for (const name of ['oudspeler', 'nieuwbouw', 'geldzorgen', 'weggekaapt']) opened.add(name);
    const referenced = [...MOMENTS, ...CHAIN_MOMENTS].map((m: MomentDef) => m.verhaal).filter(Boolean) as string[];
    for (const name of [...referenced, ...CHAIN_EVENTS.map((e) => e.verhaal).filter(Boolean)] as string[]) {
      expect(opened.has(name), `verhaallijn "${name}" wordt nergens geopend`).to.equal(true);
    }
  });

  it('houden de plaatshouders van een keten heel', () => {
    const s = newTestGame();
    openStoryline(s, 'oudspeler', 78, { speler: 'Karel Depuydt', oudeclub: 'SV Loppum', bedrag: '€12.000' });
    const line = storyline(s, 'oudspeler')!;
    expect(line.vars.speler).to.equal('Karel Depuydt');
    const after = playWeeks(s, 5);
    expect(storyline(after, 'oudspeler')!.vars.speler).to.equal('Karel Depuydt');
  });

  it('verjaren zodat een keten niet eeuwig blijft hangen', () => {
    const s = newTestGame();
    openStoryline(s, 'kortlopend', 3, {});
    const after = playWeeks(s, 5);
    expect(storyline(after, 'kortlopend')).to.equal(undefined);
  });

  it('voeren effecten van een keten netjes uit op de spelstand', () => {
    const s = newTestGame();
    const ctx = worldContext(s);
    const before = s.community.reputation;
    apply(s, createRng(s), [{ reputatie: 4 }, { geschiedenis: 'Iets uit een keten.' }], undefined, ctx);
    expect(s.community.reputation).to.equal(Math.min(100, before + 4));
    expect(s.chronicle[0].text).to.equal('Iets uit een keten.');
  });
});
