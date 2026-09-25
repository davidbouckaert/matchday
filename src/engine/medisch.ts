// De medische cel: het beleid achter je recuperatieruimte.
//
// De ruimte zelf (ijsbad, sauna) bestond al en versnelde het vermoeidheidsherstel; de
// kinesist voorkwam en genas; de verzorger masseerde. Wat ontbrak was het beléíd: wat
// eet de groep, en doe je aan preventie? Dat kies je hier — en zoals alles in dit spel
// heeft elk voordeel een prijs die je gewoon in je boekhouding ziet staan
// (categorie "medische cel"), plus bij preventie een stukje wedstrijdscherpte:
// de rekoefeningen gaan van de training af.

import type { GameState } from './types';
import { staffSkill } from './staff';

export type Voeding = 'geen' | 'basis' | 'volledig';

/** Kost per week (× inflatie) en de basiseffecten per voedingsstand. */
export const VOEDING: Record<Voeding, { kost: number; moe: number; blessure: number; label: string; uitleg: string }> = {
  geen: { kost: 0, moe: 0, blessure: 0, label: 'Geen', uitleg: 'Iedereen zorgt voor zijn eigen boterhammen.' },
  basis: {
    kost: 120,
    moe: 0.06,
    blessure: 0.08,
    label: 'Basis',
    uitleg: 'Fruit, sportdrank en een warme maaltijd na de training.',
  },
  volledig: {
    kost: 300,
    moe: 0.12,
    blessure: 0.15,
    label: 'Volledig',
    uitleg: 'Een voedingsplan per speler, hersteldrankjes en wedstrijdmaaltijden.',
  },
};

/** Preventie: kost per week (× inflatie), en wat het doet. */
export const PREVENTIE = { kost: 60, blessureFactor: 0.75, scherpte: 1.2 };

/** Een voedingsdeskundige haalt meer uit hetzelfde budget. */
export function voedingSterkte(state: GameState): number {
  return 1 + staffSkill(state, 'voeding') / 150;
}

/**
 * De stand die écht geldt. Het volledige plan ("een voedingsplan per speler") bestaat
 * alleen zolang er een voedingsdeskundige op de payroll staat — hij schrijft die plannen.
 * Valt hij weg, dan val je terug op basis, óók in de weekkost: je betaalt nooit voor een
 * plan dat niemand meer opstelt. Eén functie voor motor en scherm samen.
 */
export function effectieveVoeding(state: GameState): Voeding {
  if (state.medical.voeding === 'volledig' && staffSkill(state, 'voeding') <= 0) return 'basis';
  return state.medical.voeding;
}

/** Vermenigvuldiger op de vermoeidheidsopbouw van trainingen (1 = geen effect). */
export function moeFactor(state: GameState): number {
  const v = VOEDING[effectieveVoeding(state)];
  return Math.max(0.75, 1 - v.moe * voedingSterkte(state));
}

/** Vermenigvuldiger op de blessurekans uit voeding en preventie samen. */
export function blessureFactor(state: GameState): number {
  const v = VOEDING[effectieveVoeding(state)];
  const voeding = Math.max(0.7, 1 - v.blessure * voedingSterkte(state));
  return voeding * (state.medical.preventie ? PREVENTIE.blessureFactor : 1);
}

/** Wat de medische cel deze week kost (voor de weekboeking). */
export function medischeKost(state: GameState): number {
  const v = VOEDING[effectieveVoeding(state)];
  return Math.round((v.kost + (state.medical.preventie ? PREVENTIE.kost : 0)) * state.inflation);
}

/** De kans per week dat een blessure een week sneller geneest: kinesist + de ruimte. */
export function genezingKans(state: GameState): number {
  return Math.min(0.6, staffSkill(state, 'kinesist') / 150 + state.infrastructure.recoveryLevel * 0.08);
}
