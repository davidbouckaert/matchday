import type { BackgroundId, InvestorId } from '../types';

export interface InvestorDef {
  id: InvestorId;
  name: string;
  capital: number;
  interference: 'laag' | 'middel' | 'hoog';
  summary: string;
  conditions: string[];
  perks: string[];
}

export const INVESTORS: InvestorDef[] = [
  {
    id: 'aannemer',
    name: 'Bouwbedrijf Stevens (lokale aannemer)',
    capital: 150_000,
    interference: 'laag',
    summary: 'Geduldige lokale ondernemer die zijn naam graag op het stadion ziet.',
    conditions: ['Het stadion heet voortaan "Stevens Arena"', 'Zijn firma voert alle bouwwerken uit'],
    perks: [
      'De stadionnaam groeit mee met je club: €600/week in 3de nationale, €2.400 in de Challenger Pro Liga, en elk seizoen herbekeken',
      'Bouwwerken kosten 15% minder en zijn een kwart sneller klaar',
      'Je mag drie werven tegelijk open hebben in plaats van twee',
    ],
  },
  {
    id: 'fonds',
    name: 'Gulf Horizon Sports Capital (investeringsfonds)',
    capital: 600_000,
    interference: 'hoog',
    summary: 'Veel geld, weinig geduld. Ziet de club als een springplank voor spelers.',
    conditions: [
      'Promotie om de 3 seizoenen; blijft die uit, dan trekt het fonds €300.000 terug en stapt het op',
      '30% van elke transferwinst en 20% van je prijzengeld gaan naar het fonds',
      'Bij een stevig bod op een jonge speler tekenen zij, en hoor jij het achteraf',
    ],
    perks: ['Veruit het grootste startkapitaal', 'Schuift af en toe (dure) spelers door'],
  },
  {
    id: 'cooperatie',
    name: 'Supporterscoöperatie "Samen Rood-Wit"',
    capital: 60_000,
    interference: 'middel',
    summary: 'Honderden kleine aandeelhouders uit de buurt. Weinig geld, veel hart.',
    conditions: ['Leden protesteren bij ticketprijzen boven 120% van het normale niveau'],
    perks: [
      'Elk seizoen een ledenronde: hoe beter je club draait, hoe meer ze bijeenbrengen',
      '+40% vrijwilligers, en bij jou tellen vrijwilligers zwaarder door dan elders',
      '+15% supporters, betere sfeer, en supporters die slechte resultaten sneller vergeven',
    ],
  },
];

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  perk: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'exspeler', name: 'Ex-speler', perk: 'Spelers vertrouwen je: +10 moraal, lonen 5% lager bij aanwerving' },
  { id: 'ondernemer', name: 'Ondernemer', perk: 'Sterk netwerk: sponsordeals 15% hoger' },
  { id: 'lokaal', name: 'Lokale figuur', perk: 'Iedereen kent je: +30% vrijwilligers, betere sfeer' },
];

export interface StartClubDef {
  id: string;
  name: string;
  colors: [string, string];
  story: string;
  cash: number;
  capacity: number;
  kantineLevel: number;
  pitch: 'natuurgras' | 'kunstgras';
  squadStrength: number; // gemiddelde spelerskwaliteit
  squadAgeBias: number; // + = ouder, - = jonger
  wageLevel: number; // vermenigvuldiger op het normale loon (1 = marktconform)
  loan: { principal: number; weeks: number; rate: number; label: string } | null;
  fanBase: number;
  fanMood: number;
  volunteers: number;
  youthMembers: number;
  reputation: number;
  sponsorWeekly: number; // totaal van de bestaande sponsordeals
  trainer: { skill: number; wage: number };
}

export const START_CLUBS: StartClubDef[] = [
  {
    id: 'zuidrand',
    name: 'KFC Zuidrand',
    colors: ['#c0392b', '#ffffff'],
    story: 'Ervaren maar verouderde kern, net gepromoveerd. Kunstgras ligt er, maar de lening loopt nog. Dure lonen.',
    cash: 35_000,
    capacity: 800,
    kantineLevel: 2,
    pitch: 'kunstgras',
    squadStrength: 50.5,
    squadAgeBias: 4,
    wageLevel: 1.15,
    loan: { principal: 180_000, weeks: 364, rate: 0.045, label: 'Lening kunstgras' },
    fanBase: 520,
    fanMood: 62,
    volunteers: 12,
    youthMembers: 210,
    reputation: 42,
    sponsorWeekly: 2600,
    trainer: { skill: 58, wage: 450 },
  },
  {
    id: 'heidebeke',
    name: 'VV Heidebeke',
    colors: ['#1f6f43', '#f4d03f'],
    story: 'Jonge ploeg met sterke jeugdwerking. Geen schulden, trouwe sponsors, veel vrijwilligers, maar een kleine tribune.',
    cash: 95_000,
    capacity: 500,
    kantineLevel: 3,
    pitch: 'natuurgras',
    squadStrength: 46.5,
    squadAgeBias: -4,
    wageLevel: 1.2,
    loan: null,
    fanBase: 480,
    fanMood: 70,
    volunteers: 18,
    youthMembers: 290,
    reputation: 38,
    sponsorWeekly: 2500,
    trainer: { skill: 50, wage: 350 },
  },
];
