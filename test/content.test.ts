import { expect } from 'chai';
import type { EventDef, MomentDef } from '../src/content/types';
import { MOMENTS } from '../src/content/moments';
import { RANDOM_EVENTS } from '../src/content/events';
import { apply, baseVars, fill, metric, test as check, value, worldContext } from '../src/engine/content';
import { eventChance, fireEvent } from '../src/engine/events';
import { answerWeekChoice, makeWeekChoice, MOMENT_COOLDOWN, resolveWeekChoice } from '../src/engine/weekmoment';
import { createRng } from '../src/engine/rng';
import { newTestGame, playWeeks } from './helpers';

const ctxOf = worldContext;

describe('Contentdata: getallen', () => {
  it('rekent een vast getal gewoon door', () => {
    const s = newTestGame();
    expect(value(s, createRng(s), 450)).to.equal(450);
  });

  it('schaalt mee met de inflatie en de klasse', () => {
    const s = newTestGame();
    s.inflation = 2;
    s.league.divisionLevel = 3;
    const plain = value(s, createRng(s), { basis: 100 });
    const scaled = value(s, createRng(s), { basis: 100, inflatie: true, klasse: true });
    expect(plain).to.equal(100);
    expect(scaled).to.equal(Math.round(100 * 2 * (1 + 3 * 0.12)));
  });

  it('vermenigvuldigt met een grootheid uit de spelstand', () => {
    const s = newTestGame();
    s.community.youthTeams = 4;
    expect(value(s, createRng(s), { basis: 120, per: 'jeugdploegen' })).to.equal(480);
  });

  it('rondt af op het gevraagde veelvoud', () => {
    const s = newTestGame();
    expect(value(s, createRng(s), { basis: 1234, afronden: 50 }) % 50).to.equal(0);
  });

  it('gebruikt maal voor duizendtallen', () => {
    const s = newTestGame();
    const v = value(s, createRng(s), { heel: [-7, -2], maal: 1000 });
    expect(v).to.be.at.most(-2000).and.at.least(-7000);
    expect(v % 1000).to.equal(0);
  });
});

describe('Contentdata: voorwaarden', () => {
  it('toetst een meting op minimum en maximum', () => {
    const s = newTestGame();
    s.community.youthTeams = 3;
    const ctx = ctxOf(s);
    expect(check(s, ctx, { meting: 'jeugdploegen', min: 3 })).to.equal(true);
    expect(check(s, ctx, { meting: 'jeugdploegen', min: 4 })).to.equal(false);
    expect(check(s, ctx, { meting: 'jeugdploegen', max: 2 })).to.equal(false);
  });

  it('combineert met alle, een en niet', () => {
    const s = newTestGame();
    const ctx = ctxOf(s);
    expect(check(s, ctx, { alle: [{ meting: 'seizoen', min: 1 }, { meting: 'week', min: 1 }] })).to.equal(true);
    expect(check(s, ctx, { alle: [{ meting: 'seizoen', min: 1 }, { meting: 'week', min: 99 }] })).to.equal(false);
    expect(check(s, ctx, { een: [{ meting: 'week', min: 99 }, { meting: 'seizoen', min: 1 }] })).to.equal(true);
    expect(check(s, ctx, { niet: { meting: 'week', min: 99 } })).to.equal(true);
  });

  it('toetst een vlag, ook omgekeerd', () => {
    const s = newTestGame();
    s.infrastructure.teamBus = false;
    const ctx = ctxOf(s);
    expect(check(s, ctx, { vlag: 'teambus' })).to.equal(false);
    expect(check(s, ctx, { vlag: 'teambus', is: false })).to.equal(true);
  });

  it('toetst een verhaallijn die openstaat', () => {
    const s = newTestGame();
    const ctx = ctxOf(s);
    expect(check(s, ctx, { verhaal: 'ruzie' })).to.equal(false);
    s.storylines.push({ name: 'ruzie', season: 1, week: 1, weeksLeft: 5, vars: {} });
    expect(check(s, ctx, { verhaal: 'ruzie' })).to.equal(true);
  });

  it('toetst een plaatshouder die een eerder effect opleverde', () => {
    const s = newTestGame();
    const ctx = ctxOf(s);
    expect(check(s, ctx, { variabele: 'aantal', min: 1 }, { aantal: '3' })).to.equal(true);
    expect(check(s, ctx, { variabele: 'aantal', min: 1 }, { aantal: '0' })).to.equal(false);
    expect(check(s, ctx, { variabele: 'aantal', min: 1 }, {})).to.equal(false);
  });

  it('leest het onderhoudsniveau als een getal', () => {
    const s = newTestGame();
    s.infrastructure.maintenance = 'basis';
    expect(metric(s, 'onderhoudsniveau')).to.equal(0);
    s.infrastructure.maintenance = 'premium';
    expect(metric(s, 'onderhoudsniveau')).to.equal(2);
  });
});

describe('Contentdata: effecten', () => {
  it('boekt een bedrag en levert {bedrag} op', () => {
    const s = newTestGame();
    const before = s.cash;
    const vars = apply(s, createRng(s), [{ boek: 'tegenslagen', bedrag: -500, reden: 'Test' }]);
    expect(s.cash).to.equal(before - 500);
    expect(vars.bedrag).to.contain('500');
    expect(s.thisWeek.some((e) => e.label === 'Test')).to.equal(true);
  });

  it('past sfeer en reputatie aan binnen 0 en 100', () => {
    const s = newTestGame();
    s.community.fanMood = 99;
    apply(s, createRng(s), [{ sfeer: 10 }]);
    expect(s.community.fanMood).to.equal(100);
  });

  it('raakt de speler in de focus, niet zomaar iemand anders', () => {
    const s = newTestGame();
    const target = s.players[3];
    const before = target.morale;
    apply(s, createRng(s), [{ speler: 'focus', moraal: -12 }], { playerId: target.id });
    expect(target.morale).to.equal(Math.max(0, before - 12));
  });

  it('haalt een speler uit de basiself en zet hem op de bank', () => {
    const s = newTestGame();
    const target = s.players[0];
    s.tactics.manualXI = [target.id];
    apply(s, createRng(s), [{ speler: 'focus', uitBasis: true }], { playerId: target.id });
    expect(s.tactics.manualXI).to.not.include(target.id);
    expect(s.tactics.benched).to.include(target.id);
  });

  it('voert een als/dan-blok alleen uit als de voorwaarde klopt', () => {
    const s = newTestGame();
    s.community.fanMood = 50;
    apply(s, createRng(s), [{ als: { meting: 'sfeer', min: 90 }, dan: [{ sfeer: 5 }] }]);
    expect(s.community.fanMood).to.equal(50);
    apply(s, createRng(s), [{ als: { meting: 'sfeer', min: 40 }, dan: [{ sfeer: 5 }] }]);
    expect(s.community.fanMood).to.equal(55);
  });

  it('kiest de enkelvoudsvorm wanneer het er precies één is', () => {
    const s = newTestGame();
    apply(s, createRng(s), [
      { vrijwilligers: -1 },
      { nieuws: { toon: 'slecht', tekst: '{aantal} vrijwilligers stoppen.', enkelvoud: 'Een vrijwilliger stopt.' } },
    ]);
    expect(s.news[0].text).to.equal('Een vrijwilliger stopt.');
  });

  it('opent en sluit een verhaallijn', () => {
    const s = newTestGame();
    apply(s, createRng(s), [{ verhaalOpenen: { naam: 'proef', weken: 6 } }]);
    expect(s.storylines.find((x) => x.name === 'proef')?.weeksLeft).to.equal(6);
    apply(s, createRng(s), [{ verhaalSluiten: 'proef' }]);
    expect(s.storylines.find((x) => x.name === 'proef')).to.equal(undefined);
  });

  it('schrijft een regel in de clubkroniek', () => {
    const s = newTestGame();
    apply(s, createRng(s), [{ geschiedenis: 'Iets onvergetelijks.' }]);
    expect(s.chronicle[0].text).to.equal('Iets onvergetelijks.');
    expect(s.chronicle[0].season).to.equal(s.season);
  });
});

describe('Contentdata: sjabloonteksten', () => {
  it('vult bekende plaatshouders in en laat onbekende staan', () => {
    expect(fill('{club} speelt tegen {tegenstander}', { club: 'FC Test', tegenstander: 'KV Buur' })).to.equal('FC Test speelt tegen KV Buur');
    expect(fill('Hallo {onbekend}', { club: 'x' })).to.equal('Hallo {onbekend}');
  });

  it('geeft altijd de vaste plaatshouders mee', () => {
    const s = newTestGame();
    const vars = baseVars(s, ctxOf(s));
    expect(vars.club).to.equal(s.clubName);
    expect(vars.jeugdploegen).to.equal(String(s.community.youthTeams));
  });
});

describe('Weekmomenten als data', () => {
  it('heeft geen dubbele id\'s', () => {
    const ids = MOMENTS.map((m) => m.id);
    expect(new Set(ids).size).to.equal(ids.length);
  });

  it('heeft per moment minstens twee keuzes met elk een gevolg', () => {
    for (const m of MOMENTS) {
      expect(m.keuzes.length, m.id).to.be.at.least(2);
      for (const k of m.keuzes) expect(k.gevolgen.length, `${m.id}/${k.id}`).to.be.at.least(1);
    }
  });

  it('laat het laatste gevolg altijd open, zodat er nooit niets gebeurt', () => {
    for (const m of MOMENTS) {
      for (const k of m.keuzes) {
        expect(k.gevolgen[k.gevolgen.length - 1].kans, `${m.id}/${k.id}`).to.equal(undefined);
      }
    }
  });

  it('gebruikt {kost} alleen wanneer de keuze een kost heeft', () => {
    for (const m of MOMENTS) {
      for (const k of m.keuzes) {
        if (k.label.includes('{kost}')) expect(k.kost, `${m.id}/${k.id}`).to.not.equal(undefined);
      }
    }
  });

  it('vult de plaatshouders in zodra het moment verschijnt', () => {
    const s = newTestGame();
    s.week = 7;
    s.infrastructure.pitch = 'natuurgras';
    const def = MOMENTS.find((m) => m.id === 'jeugdtornooi')!;
    s.community.youthTeams = 5;
    const rng = createRng(s);
    const vars = baseVars(s, ctxOf(s));
    expect(fill(def.tekst, vars)).to.contain('5 jeugdploegen');
    expect(fill(def.tekst, vars)).to.not.contain('{');
    void rng;
  });

  it('kiest hetzelfde moment bij dezelfde seed', () => {
    const a = playWeeks(newTestGame('zuidrand', 'aannemer', 7), 9);
    const b = playWeeks(newTestGame('zuidrand', 'aannemer', 7), 9);
    expect(a.weekChoice?.id).to.equal(b.weekChoice?.id);
    expect(a.weekChoice?.text).to.equal(b.weekChoice?.text);
  });

  it('zet een wachttijd zodat hetzelfde moment niet elke week terugkomt', () => {
    const s = newTestGame();
    s.week = 8;
    let made = null;
    for (let i = 0; i < 60 && !made; i++) made = makeWeekChoice(s, createRng(s));
    expect(made, 'er kwam geen enkel moment').to.not.equal(null);
    expect(s.eventCooldowns[`moment-${made!.id}`]).to.be.at.least(1).and.at.most(MOMENT_COOLDOWN);
  });

  it('voert de gekozen optie uit en zet het gevolg in hetzelfde moment', () => {
    const s = newTestGame();
    s.week = 8;
    s.infrastructure.pitch = 'natuurgras';
    s.weekChoice = {
      id: 'regen',
      season: 1,
      week: 8,
      title: 'x',
      text: 'x',
      options: [
        { id: 'zeil', label: 'Zeil', detail: '' },
        { id: 'gokken', label: 'Gokken', detail: '' },
      ],
      answer: null,
      outcome: null,
      vars: {},
      focusPlayerId: null,
      focusSponsorId: null,
    };
    const before = s.cash;
    const outcome = answerWeekChoice(s, 'zeil');
    expect(outcome).to.be.a('string').and.not.equal('');
    expect(s.cash).to.be.below(before);
    expect(s.weekChoice!.answer).to.equal('zeil');
  });

  it('laat de laatste optie doorgaan wanneer je niets beslist', () => {
    const s = newTestGame();
    s.weekChoice = {
      id: 'derbyavond',
      season: 1,
      week: 8,
      title: 'De derby komt eraan',
      text: 'x',
      options: [
        { id: 'tent', label: 'Tent', detail: '' },
        { id: 'sober', label: 'Gewoon houden', detail: '' },
      ],
      answer: null,
      outcome: null,
      vars: {},
      focusPlayerId: null,
      focusSponsorId: null,
    };
    resolveWeekChoice(s, createRng(s));
    expect(s.weekChoice).to.equal(null);
    expect(s.lastChoice?.outcome).to.contain('Gewoon houden');
  });

  it('draait een gloednieuw moment dat alleen als data bestaat', () => {
    // dit is de kern van de contentlaag: een nieuwe situatie vraagt geen enkele wijziging
    // aan de simulatie, alleen een blok data.
    const extra: MomentDef = {
      id: 'proefmoment',
      categorie: 'bestuur',
      wanneer: { meting: 'seizoen', min: 1 },
      titel: 'Een proef',
      tekst: '{club} krijgt een aanbod.',
      keuzes: [
        {
          id: 'ja',
          label: 'Aannemen ({kost})',
          uitleg: '',
          kost: 250,
          gevolgen: [{ tekst: 'Aangenomen voor {bedrag}.', effecten: [{ boek: 'meevallers', bedrag: 250, reden: 'Proef' }, { reputatie: 3 }] }],
        },
        { id: 'nee', label: 'Bedanken', uitleg: '', gevolgen: [{ tekst: 'Bedankt.' }] },
      ],
    };
    MOMENTS.push(extra);
    try {
      const s = newTestGame();
      s.week = 8;
      let made = null;
      for (let i = 0; i < 200 && made?.id !== 'proefmoment'; i++) {
        s.eventCooldowns = {};
        made = makeWeekChoice(s, createRng(s));
      }
      expect(made?.id, 'het nieuwe moment kwam nooit voor').to.equal('proefmoment');
      expect(made!.text).to.equal(`${s.clubName} krijgt een aanbod.`);
      expect(made!.options[0].label).to.contain('250');
      s.weekChoice = made;
      const cash = s.cash;
      const rep = s.community.reputation;
      const outcome = answerWeekChoice(s, 'ja');
      expect(outcome).to.contain('250');
      expect(s.cash).to.equal(cash + 250);
      expect(s.community.reputation).to.equal(Math.min(100, rep + 3));
    } finally {
      MOMENTS.pop();
    }
  });
});

describe('Willekeurige gebeurtenissen als data', () => {
  it('heeft geen dubbele id\'s en altijd minstens één effect', () => {
    const ids = RANDOM_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).to.equal(ids.length);
    for (const e of RANDOM_EVENTS) expect(e.effecten.length, e.id).to.be.at.least(1);
  });

  it('geeft kans nul zolang de voorwaarde niet klopt', () => {
    const s = newTestGame();
    const def = RANDOM_EVENTS.find((e) => e.id === 'krant-slecht')!;
    s.community.fanMood = 80;
    expect(eventChance(s, def)).to.equal(0);
    s.community.fanMood = 20;
    expect(eventChance(s, def)).to.be.above(0);
  });

  it('vermenigvuldigt de kans met de factoren uit de data', () => {
    const s = newTestGame();
    const def = RANDOM_EVENTS.find((e) => e.id === 'defect')!;
    s.infrastructure.maintenance = 'premium';
    const clean = eventChance(s, def);
    s.infrastructure.maintenance = 'basis';
    const sloppy = eventChance(s, def);
    expect(sloppy).to.be.above(clean * 10);
  });

  it('voert de effecten van een gebeurtenis uit', () => {
    const s = newTestGame();
    const def = RANDOM_EVENTS.find((e) => e.id === 'erfenis')!;
    const before = s.cash;
    fireEvent(s, createRng(s), def);
    expect(s.cash).to.be.above(before);
    expect(s.news[0].text).to.contain('oud-voorzitter');
    expect(s.chronicle.length).to.equal(1);
  });

  it('draait een gloednieuwe gebeurtenis die alleen als data bestaat', () => {
    const extra: EventDef = {
      id: 'proefevent',
      categorie: 'bestuur',
      kans: 1,
      wanneer: { meting: 'sfeer', min: 0 },
      effecten: [{ supporters: 25 }, { nieuws: { toon: 'goed', tekst: 'Er kwamen {aantal} supporters bij.' } }],
    };
    const s = newTestGame();
    expect(eventChance(s, extra)).to.equal(1);
    const fans = s.community.fanBase;
    fireEvent(s, createRng(s), extra);
    expect(s.community.fanBase).to.equal(fans + 25);
    expect(s.news[0].text).to.equal('Er kwamen 25 supporters bij.');
  });

  it('respecteert een wachttijd', () => {
    const extra: EventDef = { id: 'proefwacht', categorie: 'bestuur', kans: 1, cooldown: 5, effecten: [{ sfeer: 1 }] };
    const s = newTestGame();
    fireEvent(s, createRng(s), extra);
    expect(eventChance(s, extra)).to.equal(0);
  });
});

describe('Verhaallijnen verjaren', () => {
  it('telt elke week af en verdwijnt daarna', () => {
    const s = newTestGame();
    s.storylines.push({ name: 'kort', season: 1, week: 1, weeksLeft: 2, vars: {} });
    const after = playWeeks(s, 3);
    expect(after.storylines.find((x) => x.name === 'kort')).to.equal(undefined);
  });
});

describe('Nieuwssjablonen', () => {
  it('vult de plaatshouders in en zet het bericht in de tijdlijn', async () => {
    const { NIEUWS } = await import('../src/content/news');
    const { news } = await import('../src/engine/content');
    const s = newTestGame();
    const text = news(s, createRng(s), NIEUWS.derbyGewonnen, { tegenstander: 'KV Buur', uitslag: '3-1' });
    expect(text).to.contain('KV Buur').and.contain('3-1');
    expect(text).to.not.contain('{');
    expect(s.news[0].text).to.equal(text);
    expect(s.news[0].tone).to.equal('goed');
  });

  it('heeft in elk sjabloon minstens één formulering', async () => {
    const { NIEUWS } = await import('../src/content/news');
    for (const [id, tpl] of Object.entries(NIEUWS)) {
      const list = Array.isArray(tpl.tekst) ? tpl.tekst : [tpl.tekst];
      expect(list.length, id).to.be.at.least(1);
      for (const line of list) expect(line.trim(), id).to.not.equal('');
    }
  });
});

describe('Opslag met de contentlaag', () => {
  it('geeft een bestand van versie 21 verhaallijnen en een kroniek', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 21;
    delete old.storylines;
    delete old.chronicle;
    const fixed = migrate(old);
    expect(fixed.storylines).to.deep.equal([]);
    expect(fixed.chronicle).to.deep.equal([]);
    expect(fixed.version).to.be.at.least(22);
  });

  it('herstelt een weekmoment zonder plaatshouders', async () => {
    const { migrate } = await import('../src/storage/save');
    const old = JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;
    old.version = 21;
    old.weekChoice = { id: 'regen', season: 1, week: 8, title: 'x', text: 'x', options: [], answer: null, outcome: null };
    const fixed = migrate(old);
    expect(fixed.weekChoice!.vars).to.deep.equal({});
    expect(fixed.weekChoice!.focusPlayerId).to.equal(null);
  });
});
