// Het logboek naar een echte server: de browserbestemming die regels bundelt en verstuurt, en
// de Cloudflare Worker die ze ontvangt. De aanleiding: 0.44.0 stelde dat "wie dit later echt
// wil, hoort het via een server te laten lopen" — dit is die server, en deze tests leggen vast
// dat de regels er ongeschonden aankomen en dat rommel de boel niet laat crashen.

import { expect } from 'chai';
import { attachBrowserLog } from '../src/log/browser';
import worker from '../worker/index';
import { parseLogBody } from '../src/log/parseRecords';
import { clearSinks, logInfo, logDebug, logWarn } from '../src/log/logger';

describe('De browserbestemming', () => {
  afterEach(() => clearSinks());

  it('stuurt niets door zolang er geen endpoint is, maar logt wel naar de console', () => {
    const oorspronkelijk = globalThis.fetch;
    let aangeroepen = false;
    globalThis.fetch = (() => {
      aangeroepen = true;
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as typeof fetch;
    const stop = attachBrowserLog({ endpoint: null, console: false });
    logInfo('brein', 'niemand aan de andere kant');
    stop();
    expect(aangeroepen, 'zonder endpoint mag er geen verzoek vertrekken').to.equal(false);
    globalThis.fetch = oorspronkelijk;
  });

  it('bundelt regels en verstuurt ze in één verzoek zodra de batch vol zit', async () => {
    const oorspronkelijk = globalThis.fetch;
    const verzoeken: { records: { message: string }[] }[] = [];
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      verzoeken.push(JSON.parse(init.body as string));
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as typeof fetch;

    const stop = attachBrowserLog({ endpoint: '/api/log', console: false, level: 'debug' });
    for (let i = 0; i < 50; i++) logDebug('brein', `regel ${i}`);
    // De batchgrens (50) triggert meteen versturen, zonder op de seconde-timer te wachten.
    await Promise.resolve();
    stop();

    expect(verzoeken, 'er moet minstens één verzoek vertrokken zijn').to.have.length.greaterThan(0);
    const alleRegels = verzoeken.flatMap((v) => v.records.map((r) => r.message));
    expect(alleRegels).to.have.length(50);
    expect(alleRegels[0]).to.equal('regel 0');
    globalThis.fetch = oorspronkelijk;
  });

  it('respecteert het ingestelde niveau, net als elke andere bestemming', () => {
    const oorspronkelijk = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(null, { status: 204 }))) as typeof fetch;
    const gezien: string[] = [];
    const oorspronkelijkeInfo = console.info;
    console.info = ((tekst: string) => gezien.push(tekst)) as typeof console.info;
    const stop = attachBrowserLog({ endpoint: null, level: 'warn' });
    logInfo('brein', 'te fijn voor warn-niveau');
    logWarn('brein', 'dit hoort erdoor');
    stop();
    console.info = oorspronkelijkeInfo;
    globalThis.fetch = oorspronkelijk;
    expect(gezien.some((t) => t.includes('te fijn voor warn-niveau'))).to.equal(false);
  });
});

describe('Het ontvangststuk (worker/index.ts)', () => {
  it('haalt geldige logregels uit een verzoeklichaam', () => {
    const lichaam = JSON.stringify({
      records: [{ time: '2026-09-24T08:00:00.000Z', level: 'info', scope: 'delegatie.horeca', message: 'prijs gezet' }],
    });
    const regels = parseLogBody(lichaam);
    expect(regels).to.have.length(1);
    expect(regels[0].scope).to.equal('delegatie.horeca');
  });

  it('negeert regels die niet op een LogRecord lijken, zonder te crashen', () => {
    const lichaam = JSON.stringify({ records: [{ oops: true }, 'niet eens een object', null, 42] });
    expect(parseLogBody(lichaam)).to.have.length(0);
  });

  it('geeft een lege lijst als er helemaal geen records-veld is', () => {
    expect(parseLogBody(JSON.stringify({}))).to.have.length(0);
  });

  it('schrijft geldige regels weg en antwoordt 204', async () => {
    const gezien: string[] = [];
    const oorspronkelijk = console.log;
    console.log = ((tekst: string) => gezien.push(tekst)) as typeof console.log;
    const request = new Request('https://voetbalclub.example/api/log', {
      method: 'POST',
      body: JSON.stringify({ records: [{ time: '2026-09-24T08:00:00.000Z', level: 'debug', scope: 'delegatie.training', message: 'schema gekozen' }] }),
    });
    const antwoord = await worker.fetch(request);
    console.log = oorspronkelijk;
    expect(antwoord.status).to.equal(204);
    expect(gezien.some((r) => r.includes('delegatie.training') && r.includes('schema gekozen'))).to.equal(true);
  });

  it('laat een onleesbaar verzoeklichaam de Worker niet laten struikelen', async () => {
    const request = new Request('https://voetbalclub.example/api/log', { method: 'POST', body: 'dit is geen JSON' });
    const antwoord = await worker.fetch(request);
    expect(antwoord.status).to.equal(204);
  });

  it('wijst een veel te groot verzoeklichaam af', async () => {
    const groot = JSON.stringify({ records: [{ time: 't', level: 'debug', scope: 's', message: 'x'.repeat(2_100_000) }] });
    const request = new Request('https://voetbalclub.example/api/log', { method: 'POST', body: groot });
    const antwoord = await worker.fetch(request);
    expect(antwoord.status).to.equal(413);
  });

  it('bedient geen ander pad dan /api/log, zodat de rest bij de statische site blijft', async () => {
    const request = new Request('https://voetbalclub.example/', { method: 'POST', body: '{}' });
    const antwoord = await worker.fetch(request);
    expect(antwoord.status).to.equal(404);
  });

  it('wijst een GET op /api/log af — hier komt alleen het logboek binnen', async () => {
    const request = new Request('https://voetbalclub.example/api/log', { method: 'GET' });
    const antwoord = await worker.fetch(request);
    expect(antwoord.status).to.equal(405);
  });
});
