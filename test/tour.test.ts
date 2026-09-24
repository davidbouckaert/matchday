import { expect } from 'chai';
import { TOUR_CHAPTERS, TOUR_PATIENCE, rememberDoneSteps, tourChapter, tourMarkSeen, tourStepDone, repairTour } from '../src/engine/tour';
import { migrate } from '../src/storage/save';
import { SAVE_VERSION } from '../src/engine/newGame';
import { readyGame, playWeeks } from './helpers';
import type { GameState } from '../src/engine/types';

/** Hoofdstuk 1 (je ploeg) helemaal afwerken, zonder een week te spelen. */
function werkHoofdstuk1Af(s: GameState): void {
  s.tactics.manualXI = [s.players[0].id];
  s.tactics.plan = 'counter';
  s.tactics.roles.kapitein = s.players[0].id;
}

describe('rondleiding (tour)', () => {
  it('begint bij een nieuw spel op hoofdstuk 1, zichtbaar', () => {
    const s = readyGame();
    const t = tourChapter(s);
    expect(t).to.not.equal(null);
    expect(t!.nr).to.equal(1);
    expect(t!.chapter.title).to.equal('Eerst je ploeg');
  });

  it('bladert de week na een afgewerkt hoofdstuk om naar het volgende', () => {
    let s = readyGame();
    werkHoofdstuk1Af(s);
    expect(tourChapter(s)!.nr).to.equal(1); // nog dezelfde week: geen sprong onder je handen
    s = playWeeks(s, 1);
    expect(tourChapter(s)!.nr).to.be.greaterThan(1);
  });

  it('schuift een blijven-liggen hoofdstuk na drie weken zachtjes door', () => {
    let s = readyGame();
    // niets doen: hoofdstuk 1 blijft onaf (spelplan-stap vinkt pas af na week 8)
    expect(tourChapter(s)!.nr).to.equal(1);
    s = playWeeks(s, TOUR_PATIENCE);
    expect(tourChapter(s)!.nr).to.equal(1); // drie weken geduld
    s = playWeeks(s, 1);
    expect(tourChapter(s)!.nr).to.equal(2); // en dan door
  });

  it('slaat hoofdstukken over die al volledig gekend blijken', () => {
    let s = readyGame();
    werkHoofdstuk1Af(s);
    // hoofdstuk 2 (transfers) vinkt af zodra je iets huurt/koopt of de periode dicht is;
    // hoofdstuk 3 begint met personeel. Werf alvast en besteed een taak uit:
    s.staff.push({ ...s.staffMarket[0] }); // in dienst via de staat: de conditie telt koppen
    s.delegation.opstelling = s.staff.find((m) => m.role === 'hoofdtrainer')!.id;
    s = playWeeks(s, 1);
    // hoofdstuk 1 klaar → 2 open of verder; nooit een hoofdstuk vol vinkjes als les
    const t = tourChapter(s);
    if (t) expect(t.chapter.steps.some((st) => !st.done(s))).to.equal(true);
  });

  it('registreert schermbezoeken alleen voor kijk-stappen en vinkt ze af', () => {
    const s = readyGame();
    expect(tourMarkSeen(s, 'prijzen')).to.equal(true);
    expect(tourMarkSeen(s, 'prijzen')).to.equal(false); // tweede keer is geen nieuws
    expect(tourMarkSeen(s, 'financien')).to.equal(false); // geen kijk-stap → niet bijhouden
    const prijzenStap = TOUR_CHAPTERS.flatMap((c) => c.steps).find((st) => st.screen === 'prijzen')!;
    expect(prijzenStap.done(s)).to.equal(true);
  });

  it('blijft weg wie "ik ken het spel al" koos, ook na weken spelen', () => {
    let s = readyGame();
    s.tour!.hidden = true;
    s = playWeeks(s, 5);
    expect(tourChapter(s)).to.equal(null);
    expect(s.tour!.chapter).to.equal(0); // en het tempo staat stil: niets tikt door
  });

  it('loopt op zijn laatst na hoofdstukken × geduld af, wat je ook doet', () => {
    let s = readyGame();
    s = playWeeks(s, TOUR_CHAPTERS.length * (TOUR_PATIENCE + 1));
    expect(tourChapter(s)).to.equal(null);
  });

  it('houdt een stap afgevinkt ook als de conditie terugvalt (sponsor weigert)', () => {
    // "benader een bedrijf" wist zijn vlag zodra het bedrijf antwoordt; weigert het, dan
    // sprong hoofdstuk 4 stap 2 weer open — alsof je niets gedaan had
    const s = readyGame();
    s.tour!.chapter = 3; // Waar het geld binnenkomt
    const stap = TOUR_CHAPTERS[3].steps.findIndex((st) => st.where.includes('Sponsors'));
    s.prospects[0].approached = true;
    rememberDoneSteps(s);
    expect(tourStepDone(s, 3, stap)).to.equal(true);
    s.prospects[0].approached = false; // het bedrijf weigerde: vlag gewist, geen aanbod
    expect(tourStepDone(s, 3, stap), 'eenmaal gedaan blijft gedaan').to.equal(true);
  });

  it('geeft een oud opslagbestand een verborgen rondleiding als het al diep in het spel zit', () => {
    const laat = readyGame();
    laat.week = 30;
    delete laat.tour;
    repairTour(laat);
    expect(laat.tour!.hidden).to.equal(true);

    const vroeg = readyGame();
    vroeg.week = 3;
    delete vroeg.tour;
    repairTour(vroeg);
    expect(vroeg.tour!.hidden).to.equal(false);
  });

  it('migreert een v33-bestand met rondleiding mee tot de huidige versie', () => {
    const s = readyGame();
    delete s.tour;
    (s as { version: number }).version = 33;
    const na = migrate(JSON.parse(JSON.stringify(s)));
    expect(na.tour).to.not.equal(undefined);
    expect(na.version).to.equal(SAVE_VERSION);
  });
});
