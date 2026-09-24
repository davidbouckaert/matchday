// Het logboek als module: komen de regels waar ze horen, en blijft het spel draaien als dat
// misloopt?
//
// De aanleiding: het "logboek van het brein" schreef alleen naar het scherm en naar
// console.debug. Dat is geen log — je kunt er geen bestand van maken, er niet in grepen en het
// later niet naar een server sturen. Deze tests leggen vast wat er nu wél moet kloppen.

import { expect } from 'chai';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addSink, clearSinks, formatRecord, log, logInfo, logging, type LogRecord } from '../src/log/logger';
import { attachFileLog } from '../src/log/node';
import { newTestGame } from './helpers';

describe('Het logboek', () => {
  afterEach(() => clearSinks());

  it('doet niets zolang er geen bestemming aangehaakt is', () => {
    clearSinks();
    expect(logging()).to.equal(false);
    expect(() => logInfo('brein', 'niemand luistert')).to.not.throw();
  });

  it('geeft elke regel door aan elke aangehaakte bestemming', () => {
    const een: LogRecord[] = [];
    const twee: LogRecord[] = [];
    addSink((r) => een.push(r));
    addSink((r) => twee.push(r));
    logInfo('brein', 'hallo', { getal: 3 });
    expect(een).to.have.length(1);
    expect(twee).to.have.length(1);
    expect(een[0].scope).to.equal('brein');
    expect(een[0].message).to.equal('hallo');
    expect(een[0].meta).to.deep.equal({ getal: 3 });
  });

  it('houdt regels tegen die onder het ingestelde niveau vallen', () => {
    const gezien: LogRecord[] = [];
    addSink((r) => gezien.push(r), 'warn');
    log('debug', 'brein', 'te fijn');
    log('info', 'brein', 'ook te fijn');
    log('warn', 'brein', 'dit wel');
    log('error', 'brein', 'dit ook');
    expect(gezien.map((r) => r.message)).to.deep.equal(['dit wel', 'dit ook']);
  });

  it('koppelt een bestemming weer los zonder de andere te raken', () => {
    const blijft: LogRecord[] = [];
    const gaat: LogRecord[] = [];
    addSink((r) => blijft.push(r));
    const los = addSink((r) => gaat.push(r));
    los();
    logInfo('brein', 'na het loskoppelen');
    expect(blijft).to.have.length(1);
    expect(gaat).to.have.length(0);
  });

  it('laat een kapotte bestemming het spel niet stilleggen', () => {
    const goed: LogRecord[] = [];
    addSink(() => {
      throw new Error('schijf vol');
    });
    addSink((r) => goed.push(r));
    expect(() => logInfo('brein', 'toch door')).to.not.throw();
    expect(goed, 'de tweede bestemming kreeg de regel niet').to.have.length(1);
  });

  it('zet een regel met stappen leesbaar onder elkaar', () => {
    const tekst = formatRecord({
      time: '2026-09-24T08:00:00.000Z',
      level: 'info',
      scope: 'brein',
      message: 'Trainingen per week: 3 → 4',
      meta: { efficientie: '92%', stappen: ['Groep is fris.', 'Vier kan.'] },
    });
    const regels = tekst.split('\n');
    expect(regels[0]).to.contain('[brein] Trainingen per week: 3 → 4');
    expect(regels[0]).to.contain('info');
    expect(regels).to.contain('    efficientie: 92%');
    expect(regels).to.contain('      - Groep is fris.');
    expect(regels).to.contain('      - Vier kan.');
  });

  it('schrijft naar een echt bestand', () => {
    const map = mkdtempSync(join(tmpdir(), 'vcg-log-'));
    const bestand = join(map, 'voetbalclub.log');
    const stop = attachFileLog({ file: bestand, terminal: false });
    logInfo('brein', 'eerste regel', { stappen: ['een', 'twee'] });
    logInfo('brein', 'tweede regel');
    stop(); // schrijft weg wat nog in de buffer zit
    const inhoud = readFileSync(bestand, 'utf8');
    expect(inhoud).to.contain('eerste regel');
    expect(inhoud).to.contain('      - twee');
    expect(inhoud).to.contain('tweede regel');
    rmSync(map, { recursive: true, force: true });
  });

  it('maakt de map aan als die nog niet bestaat', () => {
    const map = mkdtempSync(join(tmpdir(), 'vcg-log-'));
    const bestand = join(map, 'diep', 'er', 'in', 'voetbalclub.log');
    const stop = attachFileLog({ file: bestand, terminal: false });
    logInfo('brein', 'toch geschreven');
    stop();
    expect(existsSync(bestand)).to.equal(true);
    rmSync(map, { recursive: true, force: true });
  });

  it('logt niets zolang er niemand meeluistert, ook niet in de state', () => {
    // Dit is het verschil met wat er eerst stond: de rekenkern hield zijn uitleg bij in de
    // opgeslagen stand en zette hem op het scherm. Dat hoort niet in een log thuis.
    clearSinks();
    const g = newTestGame();
    expect((g as unknown as Record<string, unknown>).reasoning, 'een logboek hoort niet in de state').to.equal(undefined);
    expect(logging('debug')).to.equal(false);
  });
});
