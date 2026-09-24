// Sterspelers: de man waar het dorp voor komt kijken.
//
// Een sterspeler is niet "de beste van de ploeg" — dat is er altijd eentje, ook in de
// slechtste kern. Het is iemand die er duidelijk bovenuit steekt op zijn eigen positie: je
// verdediging staat gemiddeld op 55 en hij op 67. Dan hebben de mensen het over hém.
//
// De grens ligt op 20% boven het gemiddelde van de anderen op zijn positie. Dat is geen
// gok: over veertig kernen gemeten levert die grens 1,02 sterspeler per ploeg op. De meeste
// clubs hebben er dus eentje, sommige geen, en een goed samengestelde kern twee. Op 15%
// zouden het er twee per ploeg zijn en betekent het niets meer; op 25% nog maar één op de
// vier clubs, en dan kom je het bijna nooit tegen.
//
// Wat hij doet, blijft op het niveau waar dit spel over gaat: volk op de tribune, geld in de
// kantine, en een naam die sponsors over de streep trekt. Geen aparte spelersmechaniek.

import type { GameState, Player, Position } from './types';
import { clamp } from './rng';
import { overall } from './players';

/** Hoeveel beter dan zijn positiegenoten je moet zijn om een sterspeler te zijn. */
export const STAR_RATIO = 1.2;

/** Onder dit aantal positiegenoten zegt een gemiddelde niets, en kijken we naar de hele kern. */
const MIN_PEERS = 2;

/** Spelers die vandaag voor jouw club spelen: niet wie je uitgeleend hebt. */
function squad(state: GameState): Player[] {
  return state.players.filter((p) => p.loan?.type !== 'uit');
}

/**
 * Het gemiddelde waar hij tegen afgemeten wordt: zijn positiegenoten, hijzelf niet meegeteld.
 *
 * Zichzelf meetellen zou de lat optrekken naarmate hij beter is, en dan wordt een uitschieter
 * in een kleine groep nooit een ster. Bij te weinig positiegenoten — drie keepers is al veel —
 * nemen we de hele kern, want anders bepaalt één toevallige tweede keeper alles.
 */
export function peerAverage(state: GameState, p: Player): number {
  const kern = squad(state);
  const genoten = kern.filter((x) => x.position === p.position && x.id !== p.id);
  const lijst = genoten.length >= MIN_PEERS ? genoten : kern.filter((x) => x.id !== p.id);
  if (!lijst.length) return overall(p);
  return lijst.reduce((sum, x) => sum + overall(x), 0) / lijst.length;
}

/** Hoeveel keer het gemiddelde van zijn positiegenoten hij waard is. */
export function starRatio(state: GameState, p: Player): number {
  const gemiddelde = peerAverage(state, p);
  return gemiddelde > 0 ? overall(p) / gemiddelde : 1;
}

export function isStar(state: GameState, p: Player): boolean {
  if (p.loan?.type === 'uit') return false;
  return starRatio(state, p) >= STAR_RATIO;
}

/** Al je sterspelers, de opvallendste eerst. */
export function starPlayers(state: GameState): Player[] {
  return squad(state)
    .filter((p) => isStar(state, p))
    .sort((a, b) => starRatio(state, b) - starRatio(state, a));
}

/**
 * De uitstraling van je sterspelers, als vermenigvuldiger.
 *
 * Eén ster die er flink bovenuit steekt telt zwaarder dan drie die er net over zitten, en een
 * tweede ster voegt minder toe dan de eerste. Zonder die afvlakking zou een kern vol
 * uitschieters je publiek verdubbelen, en daar is dit niet voor bedoeld.
 */
export function starShine(state: GameState): number {
  const sterren = starPlayers(state);
  if (!sterren.length) return 0;
  let shine = 0;
  let gewicht = 1;
  for (const p of sterren) {
    shine += (starRatio(state, p) - STAR_RATIO + 0.08) * gewicht;
    gewicht *= 0.5; // de tweede ster telt half mee, de derde een kwart
  }
  return clamp(shine, 0, 0.5);
}

/** Wat je sterspelers doen met je publiek, je kantine en je clubwinkel. */
export function starPopularityFactor(state: GameState): number {
  return 1 + starShine(state) * 0.32;
}

/** En wat ze doen met wat een sponsor voor een plaats wil betalen. */
export function starSponsorFactor(state: GameState): number {
  return 1 + starShine(state) * 0.24;
}

/** In woorden, voor op het scherm. */
export function starLabel(state: GameState, p: Player): string {
  const ratio = starRatio(state, p);
  const boven = Math.round((ratio - 1) * 100);
  const positie: Record<Position, string> = { DOEL: 'keepers', VERD: 'verdedigers', MIDD: 'middenvelders', AANV: 'aanvallers' };
  return `${boven}% boven je andere ${positie[p.position]} (${overall(p)} tegenover ${Math.round(peerAverage(state, p))})`;
}

/**
 * Wie er sterspeler wordt en wie het niet meer is.
 *
 * Met één vaste grens zou een speler die rond de 20% schommelt elke week in en uit het
 * nieuws vallen. Daarom ligt de grens om ster te wórden hoger dan de grens om het te
 * blijven: erin op 20%, eruit pas onder 16%.
 */
export const STAR_KEEP_RATIO = 1.16;

export function weeklyStars(state: GameState): { nieuw: Player[]; weg: { name: string; reden: string }[] } {
  const vorige = new Set(state.starIds ?? []);
  const kern = squad(state);
  const nu = kern.filter((p) => (vorige.has(p.id) ? starRatio(state, p) >= STAR_KEEP_RATIO : isStar(state, p)));

  const nieuw = nu.filter((p) => !vorige.has(p.id));
  const weg: { name: string; reden: string }[] = [];
  for (const id of vorige) {
    if (nu.some((p) => p.id === id)) continue;
    const speler = state.players.find((p) => p.id === id);
    if (!speler) continue; // verkocht of vertrokken: daar is al nieuws over
    weg.push({
      name: speler.name,
      reden: speler.loan?.type === 'uit' ? 'hij is uitgeleend' : 'de rest van je ploeg is naar hem toe gegroeid',
    });
  }
  state.starIds = nu.map((p) => p.id);
  return { nieuw, weg };
}
