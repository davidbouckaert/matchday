// Nieuwsberichten als sjablonen.
//
// Zuivere data: toon, plaatshouders en meestal meerdere formuleringen, zodat hetzelfde bericht
// niet elke keer identiek klinkt. De engine roept ze aan met `news(state, rng, NIEUWS.x, vars)`.
//
// Een sjabloon bijschrijven of een formulering toevoegen vraagt geen wijziging aan de simulatie.

import type { NieuwsSjabloon } from './types';

const t = <T extends Record<string, NieuwsSjabloon>>(x: T): T => x;

export const NIEUWS = t({
  derbyGewonnen: {
    id: 'derbyGewonnen',
    toon: 'goed',
    tekst: [
      'DERBY GEWONNEN van {tegenstander} ({uitslag})! Het dorp gaat plat, de kantine draait tot in de late uurtjes.',
      'De derby tegen {tegenstander} is binnen ({uitslag}). Een jaar lang de grote mond, en terecht.',
      '{tegenstander} verslagen op de dag die telt ({uitslag}). Aan de toog wordt er niets anders meer besproken.',
    ],
  },
  derbyVerloren: {
    id: 'derbyVerloren',
    toon: 'slecht',
    tekst: [
      'Derby verloren van {tegenstander} ({uitslag}). Daar horen we een jaar over.',
      'Onderuit in de derby tegen {tegenstander} ({uitslag}). Stille kantine, vroege sluiting.',
    ],
  },
  derbyGelijk: {
    id: 'derbyGelijk',
    toon: 'neutraal',
    tekst: [
      'Derby tegen {tegenstander} eindigt op {uitslag}. Geen held, geen schlemiel.',
      '{uitslag} in de derby tegen {tegenstander}. Beide kanten gaan naar huis met het gevoel dat er meer in zat.',
    ],
  },

  stagnatie: {
    id: 'stagnatie',
    toon: 'slecht',
    tekst: [
      'Er zit geen beweging in de club: al {weken} weken geen enkele beslissing van het bestuur. Supporters haken af en sponsors merken het.',
      'Al {weken} weken niets van het bestuur gehoord. De supporters vragen zich hardop af wie hier eigenlijk aan het roer staat.',
      '{weken} weken stilstand. In de kantine gaat het meer over het bestuur dan over het voetbal, en niet in de goede zin.',
    ],
  },

  kampioen: {
    id: 'kampioen',
    toon: 'goed',
    tekst: 'KAMPIOEN! {club} promoveert naar {klasse}. Kampioenenpremie: {bedrag}.',
  },
  promotie: {
    id: 'promotie',
    toon: 'goed',
    tekst: 'Tweede plaats en promotie naar {klasse}. Promotiepremie: {bedrag}.',
  },
  degradatie: {
    id: 'degradatie',
    toon: 'slecht',
    tekst: ['Degradatie naar {klasse}. Een zware klap.', 'Het is niet gelukt: {club} zakt naar {klasse}. Een lange zomer in het vooruitzicht.'],
  },
  behoud: {
    id: 'behoud',
    toon: 'neutraal',
    tekst: 'Seizoen afgesloten op plaats {plaats}. {club} blijft in {klasse}.',
  },

  // --- de andere clubs in de reeks (zie src/engine/rivals.ts) ---
  rivaalInvesteert: {
    id: 'rivaalInvesteert',
    toon: 'neutraal',
    tekst: [
      '{tegenstander} investeert deze zomer stevig in de kern. Ze willen duidelijk hogerop.',
      'Bij {tegenstander} hebben ze de beurs bovengehaald: verschillende nieuwe namen, en niet van de minste.',
      '{tegenstander} haalt versterking. De ambitie is er niet uit te praten.',
    ],
  },
  rivaalBouwt: {
    id: 'rivaalBouwt',
    toon: 'neutraal',
    tekst: [
      '{tegenstander} bouwt een nieuwe tribune. Het complex daar begint er stilaan uit te zien.',
      'Bij {tegenstander} staan de kranen op het veld: ze breiden hun accommodatie uit.',
    ],
  },
  rivaalJeugd: {
    id: 'rivaalJeugd',
    toon: 'neutraal',
    tekst: [
      '{tegenstander} breidt zijn jeugdwerking uit. Ook in onze straten wordt er geronseld.',
      '{tegenstander} opent twee extra jeugdploegen. Op termijn voel je dat.',
    ],
  },
  rivaalBespaart: {
    id: 'rivaalBespaart',
    toon: 'neutraal',
    tekst: [
      'Bij {tegenstander} moeten ze de riem aanhalen: enkele spelers mochten vertrekken.',
      '{tegenstander} schakelt een versnelling terug. De kern is een pak dunner geworden.',
    ],
  },
  rivaalProblemen: {
    id: 'rivaalProblemen',
    toon: 'goed',
    tekst: [
      '{tegenstander} zit in financiële moeilijkheden. Het bestuur zoekt dringend geld.',
      'Zware tijden bij {tegenstander}: schuldeisers kloppen aan en de sfeer is er om te snijden.',
    ],
  },
  rivaalOnderuit: {
    id: 'rivaalOnderuit',
    toon: 'neutraal',
    tekst: ['{tegenstander} legt de boeken neer en verdwijnt uit de reeks. Een club minder in de streek.'],
  },
  rivaalWeggekaapt: {
    id: 'rivaalWeggekaapt',
    toon: 'slecht',
    tekst: [
      '{tegenstander} pikt {speler} weg bij onze jeugd. Dat doet pijn.',
      'Onze belofte {speler} tekent bij {tegenstander}. Daar hadden we meer van verwacht.',
    ],
  },
  oudeBekende: {
    id: 'oudeBekende',
    toon: 'neutraal',
    tekst: [
      '{speler}, die we eerder lieten gaan, speelt nu bij {tegenstander}. Zondag staat hij tegenover ons.',
      'Bekend gezicht bij {tegenstander}: {speler}. Hij zal iets willen bewijzen.',
    ],
  },
});

export type NieuwsId = keyof typeof NIEUWS;
