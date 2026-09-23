import type { SponsorKind } from '../types';

// Namen met een knipoog. Alles is verzonnen, maar mag herkenbaar zijn.

export const FIRST_NAMES = [
  'Jens', 'Ruben', 'Wout', 'Arne', 'Pieter', 'Thibo', 'Lander', 'Kobe', 'Seppe', 'Robbe',
  'Tuur', 'Stijn', 'Jonas', 'Brecht', 'Jarne', 'Milan', 'Senne', 'Lukas', 'Mathias', 'Bram',
  'Yannick', 'Ilias', 'Mohamed', 'Anas', 'Kwame', 'Moussa', 'Ibrahim', 'Karim', 'Jordy', 'Kevin',
  'Glenn', 'Dries', 'Sander', 'Nick', 'Wannes', 'Jef', 'Lowie', 'Mauro', 'Enzo', 'Noah',
];

export const LAST_NAMES = [
  'Vandewalle', 'Desmet', 'Verhaeghe', 'Declercq', 'Vermeulen', 'Maes', 'Claeys', 'Deprez',
  'Vanhoutte', 'Goethals', 'Baert', 'Dewulf', 'Verbeke', 'Lambrecht', 'Vanneste', 'Debruyne',
  'Hazaert', 'Vertonghe', 'Kompanie', 'Courtoy', 'Tielemanns', 'Mertenz', 'Lukakoe', 'Vermaelen',
  'Deketelaere', 'Castagnie', 'Onanna', 'Doekoe', 'Trossaert', 'Openda-Vos', 'Bakayokoo',
  'Carrasko', 'Witsel-Maes', 'Denayer', 'Vanaken', 'Theate', 'Faes', 'Debast', 'Lavia', 'Mangalo',
];

export const STAFF_FIRST = ['Marc', 'Patrick', 'Luc', 'Dirk', 'Geert', 'Sofie', 'Els', 'Hilde', 'Frank', 'Johan', 'Tom', 'Katrien', 'Bart', 'Nathalie', 'Rudi'];

export const SECTORS: [string, SponsorKind][] = [
  // grote bedrijven kunnen de grote plaatsen aan, kleine handelaars de kleine
  ['Bank', 'hoofdsponsor'], ['Industrie', 'hoofdsponsor'], ['Energie', 'hoofdsponsor'], ['Telecom', 'hoofdsponsor'], ['Brouwerij', 'hoofdsponsor'],
  ['Bouw', 'shirt'], ['Supermarkt', 'shirt'], ['Vastgoed', 'shirt'], ['Transport', 'shirt'], ['Brandstoffen', 'shirt'],
  ['Garage', 'mouw'], ['Verzekeringen', 'mouw'], ['Elektro', 'mouw'], ['Boekhouding', 'mouw'],
  ['Kledij', 'bus'], ['Sport', 'bus'],
  ['Horeca', 'evenement'], ['Slagerij', 'evenement'], ['Bakkerij', 'scherm'], ['Druk', 'scherm'],
  ['Kapsalon', 'bal'], ['Tuin', 'bal'], ['Apotheek', 'bord'], ['Sanitair', 'bord'],
];

/** De grootste soort contract die een bedrijf uit deze sector aankan. */
export function sectorKind(sector: string): SponsorKind {
  return SECTORS.find(([s]) => s === sector)?.[1] ?? 'bord';
}

/** Bedrijven met de sector waarin ze echt actief zijn (naam en sector horen bij elkaar). */
export const SPONSOR_COMPANIES: { name: string; sector: string }[] = [
  { name: 'Frituur De Kornet', sector: 'Horeca' },
  { name: 'Taverne De Zwaan', sector: 'Horeca' },
  { name: 'Café De Sportwereld', sector: 'Horeca' },
  { name: 'Bakkerij Brood & Co', sector: 'Bakkerij' },
  { name: 'Bakkerij Van Maele', sector: 'Bakkerij' },
  { name: 'Kapsalon Knip', sector: 'Kapsalon' },
  { name: 'Haarmode Chantal', sector: 'Kapsalon' },
  { name: 'Garage Vandamme', sector: 'Garage' },
  { name: 'Garage De Ster', sector: 'Garage' },
  { name: 'Autobanden Snel', sector: 'Garage' },
  { name: 'Bouwbedrijf Stevens', sector: 'Bouw' },
  { name: 'Aannemer Callens', sector: 'Bouw' },
  { name: 'Schrijnwerkerij Dewulf', sector: 'Bouw' },
  { name: 'Staalbouw Vandenberghe', sector: 'Bouw' },
  { name: 'Transport Vermeersch', sector: 'Transport' },
  { name: 'Koeltransport Deleu', sector: 'Transport' },
  { name: 'Verzekeringen Maes', sector: 'Verzekeringen' },
  { name: 'Makelaarskantoor Depuydt', sector: 'Verzekeringen' },
  { name: 'Supermarkt Delhaeze', sector: 'Supermarkt' },
  { name: 'Buurtwinkel Okee', sector: 'Supermarkt' },
  { name: 'Bank Belfiuz', sector: 'Bank' },
  { name: 'Spaarbank Argentia', sector: 'Bank' },
  { name: 'Industrie Picanolle', sector: 'Industrie' },
  { name: 'Machinebouw Verbeke', sector: 'Industrie' },
  { name: 'Energie Luminaa', sector: 'Energie' },
  { name: 'Zonnepanelen Helios', sector: 'Energie' },
  { name: 'Immo Rand', sector: 'Vastgoed' },
  { name: 'Vastgoed De Toren', sector: 'Vastgoed' },
  { name: 'Apotheek Declercq', sector: 'Apotheek' },
  { name: 'Apotheek Het Kruis', sector: 'Apotheek' },
  { name: 'Elektro Baert', sector: 'Elektro' },
  { name: 'Elektro Vanhoutte', sector: 'Elektro' },
  { name: 'Slagerij Het Varkentje', sector: 'Slagerij' },
  { name: 'Beenhouwerij Bart', sector: 'Slagerij' },
  { name: 'Tuincentrum Groen', sector: 'Tuin' },
  { name: 'Bloemen Floor', sector: 'Tuin' },
  { name: 'Kledij Ronny', sector: 'Kledij' },
  { name: 'Optiek Scherp', sector: 'Kledij' },
  { name: 'Fietsen Vermeire', sector: 'Sport' },
  { name: 'Sportshop Pitstop', sector: 'Sport' },
  { name: 'Drukkerij Letterzet', sector: 'Druk' },
  { name: 'Boekhouding Cijfer', sector: 'Boekhouding' },
  { name: 'Telecom Proximoes', sector: 'Telecom' },
  { name: 'Brouwerij Verhaeghe-Zoon', sector: 'Brouwerij' },
  { name: 'Brouwerij Het Anker-Ei', sector: 'Brouwerij' },
  { name: 'Brandstoffen Tanghe', sector: 'Brandstoffen' },
  { name: 'Loodgieter Lekvrij', sector: 'Sanitair' },
  { name: 'Tegels & Co', sector: 'Bouw' },
];

export const SPONSOR_NAMES = SPONSOR_COMPANIES.map((c) => c.name);

// Tegenstanders per niveau (knipoog naar echte clubs). Elke reeks heeft zijn eigen wereld:
// dorpsploegen onderaan, stadsclubs met een echte tribune bovenaan.
export const DIVISION_CLUBS: string[][] = [
  // 0 — 1ste Provinciale: dorpsploegen met één terrein en een kantine van eternit
  [
    'SK Beernehem', 'VV Ruiseleede', 'KFC Aartrijcke', 'Eendracht Zweveseele', 'SV Kanegum',
    'FC Doomkerke', 'KSV Tieltsche', 'Jong Lotenhulle', 'VK Oostrozebeecke', 'SV Egemse',
    'KFC Wontergem', 'Sparta Markeghem', 'VV Dentergem-Sport', 'SK Poekse', 'Olympia Zulte-Dorp',
    'FC Meulebeekse', 'KVC Ardoye', 'Eendracht Pitthem',
  ],
  // 1 — 3de Nationale: de reeks waarin je begint
  [
    'KSV Oudenaarden', 'SV Loppum', 'KFC Merelbeek', 'Sparta Petegum', 'KVC Wingenhove',
    'FC Gullegum', 'Olsa Brakkel', 'KSK Ronsel', 'SK Roeselaere', 'RC Harelbeek',
    'KM Torhoud', 'VK Zelzaete', 'KFC Lebbeek', 'Mandel Unity', 'SC Wielbeke',
    'KSC Lokerse', 'FC Knokkem', 'KVK Ieperen', 'SK Deinzee', 'Racing Waregum',
  ],
  // 2 — 2de Nationale: streekclubs met een verleden en een bestuur dat vergadert
  [
    'KFC Heiste', 'Sparta Lommelse', 'FC Dessel Sportieve', 'KVC Hoogstraeten', 'RC Mechelse',
    'KSK Halense', 'Verbroedering Denderhoutum', 'KSV Bornemse', 'FC Turnhoutse', 'Eendracht Aalsterse',
    'KVV Thes Sportief', 'Racing Peer-Noord', 'KSC Grimberghen', 'Berchem Sportief', 'SV Ternesse',
    'KFC Nijlense', 'Hoogstraten VVA-B', 'KVC Sint-Elooi',
  ],
  // 3 — 1ste Nationale: halfprof, met tv-camera's op het parkeerterrein
  [
    'RWD Molenbeke', 'Francs Borains-Zuid', 'La Louvière Centrum', 'Tienense Sportkring', 'KSV Rumbeke United',
    'Olympic Charleroy', 'KFC Diest-Stad', 'Royal Knokkse', 'Sportkring Sint-Niklase', 'KVC Ninove-Stad',
    'Hasseltse VV', 'Union Namuroise', 'KSK Tongerse', 'Excelsior Virtonse', 'Racing Mandel-United',
    'KFC Vosselaarse', 'AS Verviétoise', 'Eendracht Wervikse',
  ],
  // 4 — Challenger Pro Liga: echte profclubs in tweede klasse
  [
    'KVC Westerloo', 'Beveren-Waes', 'Lierse Kempenzoonen', 'RFC Seraingse', 'KMSK Deinse',
    'Patro Maasmechels', 'RSCA Toekomst', 'Club NXT Brugsch', 'SK Lommelse United', 'KAS Eupense',
    'Jong Genck', 'KV Oostduinse', 'RAAL La Louvièroise', 'Zulte-Waregum B', 'Francs Borains',
    'KFCO Beerschotse', 'Lokerse Temse', 'KSV Roeselaarse',
  ],
  // 5 — Pro Liga: de grote jongens
  [
    'Club Brugsch', 'RSC Anderlecque', 'KRC Genck', 'Royal Antwerpse FC', 'KAA Gendt',
    'Standaard Luik', 'Union Sint-Gillis-Oost', 'Cercle Brugsch', 'KV Kortrijck', 'SV Zulte-Waregum',
    'KVC Westerloo', 'KV Mechelse', 'OH Leuvense', 'STVV Truidense', 'Royal Charleroy SC',
    'KAS Eupense', 'Dender EH-Stad', 'Beerschot Wilrijcke',
  ],
];

/** Alle amateurtegenstanders, voor plaatsen waar het niveau niet uitmaakt. */
export const OPPONENT_NAMES = DIVISION_CLUBS[1];

// Profclubs die jouw talenten kunnen kopen.
export const PRO_CLUBS = [
  'Club Brugsch', 'RSC Anderlecque', 'KRC Genck', 'Royal Antwerpse FC', 'KAA Gendt',
  'Standaard Luik', 'Union Sint-Gillis-Oost', 'Cercle Brugsch', 'KV Kortrijck', 'SV Zulte-Waregum',
];
