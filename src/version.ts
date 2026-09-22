// Versie van het spel. Semantisch: MAJOR.MINOR.PATCH.
// Elke laag verhoogt MINOR, kleine correcties verhogen PATCH.

export const VERSION = '0.9.8';

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.9.8',
    date: '2026-09-22',
    title: 'Teller post per post, jong talent en promotie in het rapport',
    items: [
      'De bedragen in het weekrapport tellen post per post op, elk met een klein accent als ze landen',
      'Jonge spelers groeien sneller (tot 19 jaar +30%, tot 21 jaar +15%) en worden minder snel moe',
      'Oudere spelers raken sneller vermoeid',
      'Het seizoensrapport toont het echte resultaat: kampioen, promotie, degradatie of behoud, met de reeks waarin je volgend seizoen speelt',
    ],
  },
  {
    version: '0.9.7',
    date: '2026-09-22',
    title: 'Spanning per week: records, reeksen en onthulling',
    items: [
      'De animatie bouwt op met drie momenten en een voortgangsbalk',
      'De uitslag springt eruit zodra het rapport opent, daarna lopen de bedragen op',
      'Clubrecords: opkomst, beste week, langste reeks en meeste supporters, met een melding als er een sneuvelt',
      'Een lopende reeks (drie zeges of vier ongeslagen) staat bij de uitslag',
    ],
  },
  {
    version: '0.9.6',
    date: '2026-09-22',
    title: 'Eerlijke fanshopmarge en een echt seizoenseinde',
    items: [
      'Fanshop: inkoop van verkochte artikelen en vaste werkingskosten staan apart, zodat je je echte marge ziet',
      'De knop toont wanneer het de laatste speeldag is of wanneer je het seizoen afsluit',
      'Seizoensrapport met eindstand, resultaten, inkomsten tegenover vorig seizoen, supporters, jeugd en mijlpalen',
    ],
  },
  {
    version: '0.9.5',
    date: '2026-09-22',
    title: 'Mijlpalen, tellers en thuisvoordeel',
    items: [
      'Geschiktheid van een staflid voor een taak staat in sterren',
      'Mijlpalen: elf momenten om naar toe te werken, met een beloning en een plek bovenaan het weekrapport',
      'De bedragen in het weekrapport tellen op als een teller',
      'Thuis spelen geeft een klein voordeel; uit spelen een klein nadeel',
      'Supporters groeien sneller als je ploeg goed draait, dus succes bouwt op zichzelf verder',
    ],
  },
  {
    version: '0.9.4',
    date: '2026-09-22',
    title: 'Bank, terugverdientijd en scherpere wedstrijden',
    items: [
      'Een kredietaanvraag gaat naar de bank: antwoord volgt een week later (een noodlening staat er wel meteen op)',
      'Zonnepanelen kosten wat bij jouw complex hoort en zijn na ongeveer drie seizoenen terugverdiend; de ploegbus idem',
      'Wedstrijden zijn scherper: staff, sfeer en vorm wegen minder door dan de kwaliteit van je spelers, en tegenstanders hebben ook een trainer',
      'De meldingen bij Aandacht zijn links naar het juiste scherm',
    ],
  },
  {
    version: '0.9.3',
    date: '2026-09-22',
    title: 'Specialisatie, menu en eerste stappen',
    items: [
      'Een staflid werkt buiten zijn vakgebied op een lager niveau en kan 1 tot 4 taken aan',
      'Hamburgermenu rechtsboven met de handleiding en het opslaan',
      'Handleiding met veelgestelde vragen',
      'Startlijst "Eerste stappen" op het overzicht voor een nieuwe eigenaar',
      'Kantineverbruik realistischer: ongeveer 2 consumpties per bezoeker in plaats van 6',
      'De ploegbus is een investering geworden en ontgrendelt pas dan de bussponsor',
    ],
  },
  {
    version: '0.9.2',
    date: '2026-09-22',
    title: 'Winterstop, kopbalk en duidelijkere boekingen',
    items: [
      'Clubrating staat naast de clubnaam in plaats van eronder',
      'Winterstop is duidelijk zichtbaar: in de kopbalk, op het overzicht en in het weekrapport',
      'Tijdens de winterstop draait de kantine op halve kracht',
      '"Concessies" heet nu "horeca concessies" in alle overzichten',
      'Wedstrijdkosten benoemen of het om een thuis- of uitwedstrijd gaat',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-09-22',
    title: 'Delegeren, sponsorplaatsen en heldere ticketinkomsten',
    items: [
      'Elke taak krijgt een keuzelijst bij Staff: kies per taak wie ze doet',
      'Drie nieuwe taken: jeugdwerking (lidgeld), belasting en blessurepreventie, onderhoud en bouwprojecten',
      'Ticketinkomsten staan nu bruto in de boeken, met het aandeel van de bezoekers en de bond (8%) als aparte kost',
      'Kopbalk is klikbaar: klassement, hoofdsponsor, saldo, teamsterkte en datum brengen je naar het juiste scherm',
      'Meer soorten sponsoring: mouw, ploegbus, evenementen, schermen in de kantine en de wedstrijdbal; de sectoren zijn evenwichtiger verdeeld',
      'Een uitgeleende speler kun je gewoon een nieuw contract geven',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-22',
    title: 'Onderhandelen, weekcijfers en scherpere balans',
    items: [
      'Transferperiode staat duidelijk open of gesloten bovenaan de tab Transfers',
      'Loononderhandelingen lopen vast als je blijft laagbieden: hij vraagt meer, verliest moraal en haakt na drie pogingen af',
      'Cijfers ook per week, met de opbrengst per bron; horeca staat nu overal tussen de inkomsten',
      'Clubrating staat in de kopbalk naast de clubnaam',
      'Je kiest je eigen clubnaam bij de start',
      'Nieuw bouwproject: scorebord (meer sfeer, bordsponsors betalen meer)',
      'Meer staf vraagt eerst de juiste infrastructuur (analist wifi, kantineverantwoordelijke een degelijke kantine, ...)',
      'Vrijwilligers op een menselijke schaal: ongeveer 12 in plaats van 28, evenementen vragen er 3 tot 14',
      'Sponsornaam en sector kloppen nu ook in oude opslagbestanden',
      'Passief spelen is duidelijk moeilijker gemaakt',
    ],
  },
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
