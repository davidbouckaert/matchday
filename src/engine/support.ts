// Wat een personeelslid nodig heeft om zijn werk goed te doen.
//
// Zijn eigen sterren zeggen hoe goed hij ís; dit zegt of hij zijn werk kán doen. Een trainer
// zonder kinesist moet voorzichtig plannen, een kantineverantwoordelijke zonder vrijwilligers
// krijgt de toog niet bemand, een scout zonder wifi werkt met wat hij op de tribune hoort.
// Dat hoort in het spel te zitten en niet als losse uitzondering per taak.
//
// De regel is overal dezelfde: elke taak heeft een lijstje van wat helpt — collega's en
// accommodatie — en wat daarvan ontbreekt, drukt zijn efficiëntie. Ontbreekt alles, dan valt
// hij terug op MIN_SUPPORT; is alles er, dan haalt hij het volle pond dat zijn sterren
// toelaten. Zo is "eerst een kinesist aanwerven" een echte beslissing met een zichtbaar
// gevolg, en niet iets wat je pas na twintig weken uit je cijfers zou kunnen afleiden.

import type { GameState, StaffRole, TaskId } from './types';
import { clamp } from './rng';
import { staffSkill } from './staff';

/** Waar een medewerker op kan terugvallen als er niets of niemand is om mee te werken. */
export const MIN_SUPPORT = 0.62;

export interface SupportNeed {
  /** Waar het over gaat, in woorden. */
  label: string;
  /** Hoe zwaar het meeweegt binnen deze taak. */
  weight: number;
  /** Hoeveel ervan aanwezig is, van 0 (niets) tot 1 (volledig). */
  have: (state: GameState) => number;
  /** Wat je eraan kunt doen, als het er niet is. */
  hint: string;
}

/** Een collega in dienst: half punt bij een zwakke kracht, vol bij een goede. */
function colleague(role: StaffRole, label: string, hint: string, weight = 1): SupportNeed {
  return {
    label,
    weight,
    have: (s) => clamp(staffSkill(s, role) / 60, 0, 1),
    hint,
  };
}

/** Een stuk accommodatie op een bepaald niveau. */
function infra(label: string, hint: string, level: (s: GameState) => number, max: number, weight = 1): SupportNeed {
  return { label, weight, have: (s) => clamp(level(s) / max, 0, 1), hint };
}

/**
 * Wat elke taak nodig heeft.
 *
 * Niet elke taak hangt even hard van de rest van de club af: een trainer die zijn groep fris
 * moet houden heeft een medische ploeg nodig, terwijl contracten opvolgen vooral tussen twee
 * oren gebeurt. Taken die hier niet in staan, draaien op de sterren van de medewerker alleen.
 */
export const TASK_SUPPORT: Partial<Record<TaskId, SupportNeed[]>> = {
  training: [
    colleague('kinesist', 'Kinesist', 'Een kinesist haalt elke week vermoeidheid weg, zodat er zwaarder getraind kan worden.', 1.2),
    colleague('verzorger', 'Verzorger of masseur', 'Een verzorger houdt de groep fris tussen twee wedstrijden.', 1),
    colleague('conditietrainer', 'Conditietrainer', 'Hij bouwt de belasting op zonder de groep op te branden.', 0.8),
    infra('Recuperatieruimte', 'Bouw een recuperatieruimte bij Club › Infrastructuur.', (s) => s.infrastructure.recoveryLevel, 2, 0.8),
  ],
  opstelling: [
    colleague('assistent', 'Assistent-trainer', 'Een assistent ziet op training wie in vorm is.', 0.9),
    colleague('analist', 'Data-analist', 'Een analist weet wat de tegenstander doet en wie daar het best tegen past.', 0.7),
  ],
  tactiek: [
    colleague('analist', 'Data-analist', 'Zonder analist moet je trainer het spelplan van de tegenstander gokken.', 1.2),
    infra('Wifi op het complex', 'Wifi maakt videobeelden en live data bruikbaar langs het veld.', (s) => s.infrastructure.wifiLevel, 2, 0.5),
  ],
  horeca: [
    infra('Kantine', 'Een betere kantine geeft hem meer om mee te werken.', (s) => s.infrastructure.kantineLevel, 3, 1),
    {
      label: 'Vrijwilligers achter de toog',
      weight: 1.1,
      have: (s) => clamp(s.community.volunteers / 14, 0, 1),
      hint: 'Zonder volk achter de toog staan de mensen in de rij en bestellen ze minder.',
    },
    infra('Sanitair', 'Nette toiletten houden gezinnen langer op het complex.', (s) => s.infrastructure.sanitairLevel, 2, 0.5),
  ],
  ticketing: [
    infra('Scorebord', 'Een scorebord maakt er een wedstrijd van; dat verdraagt een hogere prijs.', (s) => s.infrastructure.scoreboardLevel, 2, 0.6),
    infra('Parking', 'Zonder parkeerplaats blijven bezoekers van verder af weg, wat je prijszetting beperkt.', (s) => s.infrastructure.parkingLevel, 2, 0.6),
    colleague('commercieel', 'Commercieel medewerker', 'Hij weet wat de markt in je streek verdraagt.', 0.6),
  ],
  transfers: [
    colleague('scout', 'Scout', 'Zonder scout koopt je club wat toevallig voorbijkomt.', 1.3),
    infra('Opleidingscentrum', 'Spelers kiezen eerder voor een club waar ze beter worden.', (s) => s.infrastructure.academyLevel, 3, 0.5),
  ],
  sponsoring: [
    infra('Scorebord', 'Een bedrijf betaalt meer voor een plaats die iedereen ziet.', (s) => s.infrastructure.scoreboardLevel, 2, 0.8),
    infra('Kantine', 'Een deftige kantine is waar je met een sponsor aan tafel gaat.', (s) => s.infrastructure.kantineLevel, 3, 0.6),
  ],
  jeugd: [
    infra('Opleidingscentrum', 'Zonder opleidingscentrum kan je coördinator weinig aanbieden.', (s) => s.infrastructure.academyLevel, 3, 1.2),
    colleague('afgevaardigde', 'Afgevaardigde', 'Iemand die de ploegen praktisch draaiende houdt.', 0.6),
  ],
  evenementen: [
    {
      label: 'Vrijwilligers',
      weight: 1.4,
      have: (s) => clamp(s.community.volunteers / 16, 0, 1),
      hint: 'Een evenement valt of staat met genoeg handen.',
    },
    infra('Kantine', 'De kantine is de plek waar je evenementen doorgaan.', (s) => s.infrastructure.kantineLevel, 3, 0.7),
  ],
  merchandising: [
    infra('Wifi', 'Wifi maakt je webwinkel en bestellen ter plaatse bruikbaar.', (s) => s.infrastructure.wifiLevel, 2, 0.7),
    colleague('commercieel', 'Commercieel medewerker', 'Hij weet wat supporters willen kopen.', 0.6),
  ],
  medisch: [
    infra('Recuperatieruimte', 'Zonder ruimte om te behandelen blijft het bij tape en goede raad.', (s) => s.infrastructure.recoveryLevel, 2, 1.3),
  ],
  vrijwilligers: [
    infra('Kantine', 'Vrijwilligers komen voor de sfeer, en die zit in de kantine.', (s) => s.infrastructure.kantineLevel, 3, 0.8),
  ],
};

export interface SupportReport {
  /** De vermenigvuldiger op zijn efficiëntie, tussen MIN_SUPPORT en 1. */
  factor: number;
  /** Wat er is en wat niet, voor op het scherm en in het logboek. */
  parts: { label: string; have: number; weight: number; hint: string }[];
  /** Wat het meest ontbreekt, als er iets ontbreekt. */
  missing: { label: string; hint: string } | null;
}

/** Hoe goed deze taak ondersteund wordt door de rest van je club. */
export function supportReport(state: GameState, taskId: TaskId): SupportReport {
  const needs = TASK_SUPPORT[taskId];
  if (!needs?.length) return { factor: 1, parts: [], missing: null };
  let som = 0;
  let gewicht = 0;
  const parts = needs.map((n) => {
    const have = clamp(n.have(state), 0, 1);
    som += have * n.weight;
    gewicht += n.weight;
    return { label: n.label, have, weight: n.weight, hint: n.hint };
  });
  const dekking = gewicht > 0 ? som / gewicht : 1;
  const ontbreekt = [...parts].filter((p) => p.have < 0.75).sort((a, b) => a.have * a.weight - b.have * b.weight)[0];
  return {
    factor: MIN_SUPPORT + (1 - MIN_SUPPORT) * dekking,
    parts,
    missing: ontbreekt ? { label: ontbreekt.label, hint: ontbreekt.hint } : null,
  };
}

/** Alleen de vermenigvuldiger. */
export function supportFactor(state: GameState, taskId: TaskId): number {
  return supportReport(state, taskId).factor;
}
