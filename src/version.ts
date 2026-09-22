// Versie van het spel. Semantisch: MAJOR.MINOR.PATCH.
// Elke laag verhoogt MINOR, kleine correcties verhogen PATCH.

export const VERSION = '0.8.0';

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.8.0',
    date: '2026-09-22',
    title: 'Kern, contracten, horeca en cijfers',
    items: [
      'Transfers: je laatste doelman blijft, elke linie houdt een reserve en je zakt nooit onder 16 spelers',
      'Contracten verlengen met een loonvoorstel dat de moraal beïnvloedt (Ploeg › Contracten)',
      'Kantineprijzen per artikel en horecaconcessies met onderhandelde marge (Club › Horeca)',
      'Cijfers per seizoen: tickets, consumpties, merchandising en leden (Club › Cijfers)',
      'Populariteit weegt op alle inkomsten; wat men voor een shirt betaalt, stijgt mee',
      'Spelersrollen: kapitein, strafschop- en hoekschopnemer',
      'Delegeren per deeltaak: training, opstelling, tactiek, spelersrollen, transfers, horeca',
      'Vaste menubalk, automatisch opslaan van invoervelden, 11/11-teller en tooltips',
      'Nieuwe infrastructuur: wifi, sanitair, parking; onderhoudsniveau en zonnepanelen',
      'Vrijwilligers komen en gaan; evenementen vragen meer volk',
      'Logboek van je beslissingen en antwoorden op de tab Overzicht',
    ],
  },
  { version: '0.7.0', date: '2026-09-22', title: 'Fanshop en leeftijdscurve', items: ['Fanshop met assortiment en prijzen', 'Vloeiende leeftijdscurve voor de evolutie van spelers'] },
  { version: '0.6.0', date: '2026-09-22', title: 'Weekrapport en kalender', items: ['Animatie en weekrapport', 'Seizoenskalender', 'Verkopen, te koop zetten, uitlenen en huren'] },
  { version: '0.5.0', date: '2026-09-21', title: 'Blessures, kaarten en herstel', items: ['Kaarten en schorsingen', 'Forfait', 'Herstelmechanisme en extra staff'] },
  { version: '0.4.0', date: '2026-09-21', title: 'Opleiding, financiën en invloeden', items: ['Opleidingen voor staff', 'Weekfinanciën', 'Tab Invloeden', 'Vermoeidheid en scouting'] },
  { version: '0.3.0', date: '2026-09-20', title: 'Strategie en jeugd', items: ['Strategietab met spelplannen', 'Lidgeld jeugd'] },
  { version: '0.2.0', date: '2026-09-20', title: 'Staff, sponsors en evenementen', items: ['Meer staff en delegeren', 'Sponsorwerving', 'Evenementen met vrijwilligers'] },
  { version: '0.1.0', date: '2026-09-19', title: 'Eerste versie', items: ['Club, investeerder, competitie, transfers en financiën'] },
];
