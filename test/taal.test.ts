import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// De taallat: Nederlands, te volgen vanaf een jaar of tien, zonder kinderachtig te worden.
//
// Deze test leest de broncode zelf. Dat is grof — hij kan een woord in een comment niet van
// een woord op het scherm onderscheiden — maar hij vangt wel het enige wat echt telt: dat
// afkortingen en formuliertaal terugsluipen zodra iemand snel iets toevoegt.
//
// Daarom kijkt hij alleen naar patronen die in geen enkele context wenselijk zijn, en laat
// hij `src/version.ts` met rust: het changelog beschrijft wat er ooit stond.

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (name.endsWith('.ts') && !full.endsWith('version.ts')) out.push(full);
  }
  return out;
}

const FILES = sourceFiles('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));

/**
 * Alleen de tekst die een speler te zien krijgt.
 *
 * De eerste versie las gewoon elke regel, en zag `teamStrength(s)` aan voor "speler(s)" en
 * `Math.max(...)` voor de afkorting "max.". Deze haalt eerst de inhoud van de string- en
 * sjabloonliteralen eruit en gooit de `${...}`-stukken weg: wat overblijft is wat er
 * letterlijk op het scherm komt.
 */
function texts(): { path: string; line: number; text: string }[] {
  const out: { path: string; line: number; text: string }[] = [];
  for (const { path, text } of FILES) {
    text.split('\n').forEach((raw, i) => {
      const code = raw.replace(/\/\/.*$/, '').replace(/^\s*[*].*$/, '');
      for (const m of code.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
        const body = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, '·');
        if (body.trim()) out.push({ path, line: i + 1, text: body });
      }
    });
  }
  return out;
}

const TEXTS = texts();

/** Alle tekstfragmenten die op een patroon passen, met bestand en regelnummer erbij. */
function hits(pattern: RegExp): string[] {
  return TEXTS.filter((t) => pattern.test(t.text)).map((t) => `${t.path}:${t.line}  ${t.text.slice(0, 100)}`);
}

describe('De taal blijft te volgen vanaf een jaar of tien', () => {
  it('gebruikt geen seizoens- en weekcodes zoals S2 of W17', () => {
    // `S${...}` of `W${...}` direct tegen een cijfer of variabele aan
    expect(hits(/(^|[>\s])[SW]·/).join('\n')).to.equal('');
  });

  it('schrijft meervouden uit in plaats van "speler(s)"', () => {
    expect(hits(/[a-z]\(s\)|\(en\)|\(i\)d\(en\)/).join('\n')).to.equal('');
  });

  it('gebruikt geen ± voor een schatting', () => {
    expect(hits(/±/).join('\n')).to.equal('');
  });

  it('gebruikt geen puntafkortingen zoals wedstr. of incl.', () => {
    expect(hits(/\b(wedstr|incl|excl|t\.o\.v|b\.v|o\.a)\./).join('\n')).to.equal('');
  });

  it('schrijft "tegen" in plaats van "vs"', () => {
    // met tekst eromheen, zodat een klassenaam als class="vs" niet meetelt
    expect(hits(/\S\s+vs\s+\S/).join('\n')).to.equal('');
  });

  it('zegt bij een te dure aankoop hoeveel het kost en wat je kunt doen', () => {
    // de kale melding mag niet terugkomen
    expect(hits(/'Niet genoeg geld\.'/).join('\n')).to.equal('');
  });

  it('gebruikt geen ambtelijke taal', () => {
    expect(hits(/\b(dient te|dienen te|gelieve|middels|alvorens|teneinde|derhalve|conform)\b/).join('\n')).to.equal('');
  });

  it('houdt tooltips kort genoeg om in één keer te lezen', () => {
    const telang: string[] = [];
    for (const { path, text } of FILES) {
      // de tekst binnen hint('...'), tipAttr('...') en data-tip="..."
      for (const m of text.matchAll(/(?:hint|tipAttr|tip)\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const woorden = m[1].split(/\s+/).length;
        if (woorden > 45) telang.push(`${path}: ${woorden} woorden — ${m[1].slice(0, 70)}…`);
      }
    }
    expect(telang.join('\n'), 'splits deze op: de uitleg mag ook op het scherm zelf staan').to.equal('');
  });
});
