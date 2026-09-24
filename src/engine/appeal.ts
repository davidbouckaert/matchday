// Spelerswil: wil die speler wel voor jóuw club spelen?
//
// Geld was het enige criterium: wie het bedrag had, kreeg de handtekening. Een sterspeler
// tekende even vlot bij een hekkensluiter met een veldje van vijfhonderd plaatsen als bij
// een kampioen met een opleidingscentrum. Dat is de omgekeerde wereld — en het was ook een
// gat in de balans: de doorlichting van september 2026 mat dat een club met veel geld elke
// trede gratis kon overslaan, omdat niets haar dwong eerst een club te wórden waar zulke
// spelers willen spelen.
//
// Nu weegt de speler jouw club, zoals een bedrijf bij de sponsors jouw prijs weegt: in
// welke reeks speel je en waar sta je, wat is je accommodatie, wie is de trainer, en welk
// niveau haalt de kleedkamer waar hij in stapt. Zit jouw club op of boven zijn niveau, dan
// tekent hij gewoon. Ligt zijn niveau erboven, dan zakt de kans — en wie tóch tekent, laat
// zich de stap betalen met een hoger loon.

import type { GameState, Player } from './types';
import { clamp } from './rng';
import { DIVISIONS } from './data/divisions';
import { OWN_TEAM_ID, ownPosition } from './league';
import { overall } from './players';

/**
 * Wat jouw club aankan als bestemming, uitgedrukt op de schaal van spelerskwaliteit.
 *
 * De reeks is de basis; je stand, je kleedkamer, je trainer, je accommodatie en je naam
 * schuiven er samen hooguit een punt of tien aan. Een club die laatste staat met een te
 * kleine tribune zit dus duidelijk ónder haar reeks, een kampioen met een echt complex
 * erboven.
 */
export function clubAppeal(state: GameState): number {
  const division = DIVISIONS[state.league.divisionLevel];
  const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const pos = played >= 3 ? ownPosition(state.league) : 8;
  const stand = pos <= 2 ? 2 : pos <= 5 ? 1 : pos <= 10 ? 0 : pos <= 13 ? -1.5 : -3;

  const kern = [...state.players]
    .filter((p) => p.loan?.type !== 'uit')
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 11);
  const niveau = kern.length ? kern.reduce((sum, p) => sum + overall(p), 0) / kern.length : division.opponentStrength - 6;
  const kleedkamer = clamp((niveau - division.opponentStrength) / 3, -3, 3);

  const head = state.staff.find((m) => m.role === 'hoofdtrainer');
  const trainer = head ? clamp((head.skill - 50) / 12, -3, 3) : -2;

  const i = state.infrastructure;
  const accommodatie = clamp(
    (i.capacity >= division.requiredCapacity ? 0.5 : -2) +
      (i.lightingLevel >= division.requiredLighting ? 0 : -1) +
      i.academyLevel * 0.4 +
      i.recoveryLevel * 0.5 +
      (i.pitch === 'kunstgras' ? 0.3 : 0),
    -3,
    2,
  );
  const naam = clamp((state.community.reputation - 50) / 25, -2, 2);

  return division.opponentStrength + stand + kleedkamer + trainer + accommodatie + naam;
}

/**
 * Op welk niveau de speler zichzelf inschat. Een jonge speler kijkt ook naar wat hij kan
 * worden: een talent van achttien met potentieel zeventig ziet zichzelf geen dorpsclub
 * uitzoeken, ook al staat zijn kwaliteit vandaag nog op vijftig.
 */
export function playerLevel(p: Player): number {
  const ambitie = p.age <= 23 ? Math.max(0, p.potential - overall(p)) * 0.35 : 0;
  return overall(p) + ambitie;
}

export interface Willingness {
  /** Kans dat hij tekent als je hem vraagt (1 = hij komt zeker). */
  kans: number;
  /** Hoeveel niveaupunten hij boven jouw club staat (0 of minder = jouw niveau). */
  gap: number;
  /** In woorden, voor op het scherm. */
  woord: string;
  toon: 'good' | 'neutral' | 'bad';
}

/**
 * Wil hij komen? Tot twee punten boven het niveau van je club tekent iedereen gewoon —
 * een club haalt vaker wel dan niet spelers die nét beter zijn. Daarboven zakt de kans
 * per punt.
 *
 * Een huurling rekent anders: hij komt een seizoen spelen, niet carrière maken. Zijn
 * ambitie telt dus niet mee (alleen wat hij vandaag is) en hij aanvaardt een flinke stap
 * omlaag — dat is waar een uitleenbeurt voor dient. Alleen een club die er ook binnen haar
 * eigen reeks niets van bakt, of een wel heel groot talent, krijgt nee te horen.
 */
export function transferWillingness(state: GameState, p: Player, huur = false): Willingness {
  const niveau = huur ? overall(p) : playerLevel(p);
  const gap = niveau - clubAppeal(state) - (huur ? 4 : 0);
  const kans = gap <= 2 ? 1 : clamp(1 - (gap - 2) * 0.13, 0.05, 1);
  const woord =
    kans >= 1 ? 'komt graag' : kans >= 0.6 ? 'staat ervoor open' : kans >= 0.3 ? 'twijfelt' : kans > 0.05 ? 'ziet het amper zitten' : 'onhaalbaar';
  const toon = kans >= 0.6 ? 'good' : kans >= 0.3 ? 'neutral' : 'bad';
  return { kans, gap, woord, toon };
}

/** De loonopslag waarmee een speler boven jouw niveau zich de stap laat betalen. */
export function stepPremium(w: Willingness): number {
  return 1 + Math.max(0, w.gap - 2) * 0.06;
}
