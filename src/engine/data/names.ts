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

// Tegenstanders in 3de nationale (knipoog naar echte clubs).
export const OPPONENT_NAMES = [
  'KSV Oudenaarden', 'SV Loppum', 'KFC Merelbeek', 'Sparta Petegum', 'KVC Wingenhove',
  'FC Gullegum', 'Olsa Brakkel', 'KSK Ronsel', 'SK Roeselaere', 'RC Harelbeek',
  'KM Torhoud', 'VK Zelzaete', 'KFC Lebbeek', 'Mandel Unity', 'SC Wielbeke',
  'KSC Lokerse', 'FC Knokkem', 'KVK Ieperen', 'SK Deinzee', 'Racing Waregum',
];

// Profclubs die jouw talenten kunnen kopen.
export const PRO_CLUBS = [
  'Club Brugsch', 'RSC Anderlecque', 'KRC Genck', 'Royal Antwerpse FC', 'KAA Gendt',
  'Standaard Luik', 'Union Sint-Gillis-Oost', 'Cercle Brugsch', 'KV Kortrijck', 'SV Zulte-Waregum',
];
