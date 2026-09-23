// Het langetermijndoel van je carrière, en de vijf niveaus die je als eigenaar doorloopt.
//
// Zuivere data. De logica staat in src/engine/career.ts.

/** Waar het doel naar kijkt. */
export type DoelSoort =
  | 'klasse' // spelen in deze reeks (0 = 1ste provinciale, 5 = pro liga)
  | 'kas' // zoveel euro op de rekening hebben
  | 'capaciteit' // zoveel zitplaatsen op je complex
  | 'jeugd' // zoveel jeugdploegen laten draaien
  | 'seizoenen' // zoveel seizoenen in een bepaalde reeks
  | 'combinatie'; // sportief én financieel tegelijk

export interface CarriereDoel {
  id: string;
  titel: string;
  /** Eén zin: wat je jezelf oplegt. */
  beschrijving: string;
  soort: DoelSoort;
  doel: number;
  /** Tweede getal: bij 'seizoenen' de reeks, bij 'combinatie' het bedrag op de rekening. */
  extra?: number;
  /** Richttermijn in seizoenen. Geen deadline — alleen om te weten wat je jezelf aandoet. */
  looptijd: number;
  /** Wat je eraan overhoudt, in woorden. */
  belofte: string;
}

export const CARRIERE_DOELEN: CarriereDoel[] = [
  {
    id: 'naar-tweede',
    titel: 'Naar 2de nationale',
    beschrijving: 'Eén reeks hoger geraken en er staan waar de club nog nooit gestaan heeft.',
    soort: 'klasse',
    doel: 2,
    looptijd: 4,
    belofte: 'Een club die een niveau hoger speelt dan toen jij binnenkwam.',
  },
  {
    id: 'naar-eerste',
    titel: 'Naar 1ste nationale',
    beschrijving: 'Twee reeksen klimmen. Dat vraagt een kern, een complex en een bestuur dat meegroeit.',
    soort: 'klasse',
    doel: 3,
    looptijd: 8,
    belofte: 'Halfprof voetbal op je eigen veld, met tv-geld in de boeken.',
  },
  {
    id: 'naar-de-top',
    titel: 'Naar het profvoetbal',
    beschrijving: 'De Challenger Pro Liga halen met een club die ooit in 3de nationale zat.',
    soort: 'klasse',
    doel: 4,
    looptijd: 14,
    belofte: 'Een amateurclub die het tot bij de profs bracht. Daar wordt over geschreven.',
  },
  {
    id: 'gezonde-club',
    titel: 'Een financieel gezonde club',
    beschrijving: 'Een half miljoen op de rekening, zonder de club leeg te spelen.',
    soort: 'kas',
    doel: 500_000,
    looptijd: 6,
    belofte: 'Een club die tegen een stootje kan, ook als er een seizoen tegenzit.',
  },
  {
    id: 'eigen-stadion',
    titel: 'Een echt stadion',
    beschrijving: 'Tweeduizend plaatsen op je complex. Steen voor steen bij elkaar gebouwd.',
    soort: 'capaciteit',
    doel: 2000,
    looptijd: 8,
    belofte: 'Een tribune waar het dorp trots op is, en die zichzelf terugbetaalt.',
  },
  {
    id: 'jeugdclub',
    titel: 'De jeugdclub van de streek',
    beschrijving: 'Acht jeugdploegen laten draaien, met de vrijwilligers en de velden die daarbij horen.',
    soort: 'jeugd',
    doel: 8,
    looptijd: 8,
    belofte: 'Een A-kern die grotendeels uit je eigen jeugd komt.',
  },
  {
    id: 'gevestigde-waarde',
    titel: 'Een gevestigde waarde',
    beschrijving: 'Vijf seizoenen op rij in 2de nationale of hoger. Niet één keer piekeren, maar blijven staan.',
    soort: 'seizoenen',
    doel: 5,
    extra: 2,
    looptijd: 8,
    belofte: 'Een club waar niemand nog aan twijfelt.',
  },
  {
    id: 'hoog-en-gezond',
    titel: 'Hoog én gezond',
    beschrijving: '1ste nationale halen met een kwart miljoen op de rekening. Het moeilijkste van de twee werelden.',
    soort: 'combinatie',
    doel: 3,
    extra: 250_000,
    looptijd: 10,
    belofte: 'Sportief succes zonder de club te hypothekeren. Zeldzaam in dit voetbal.',
  },
];

/* ----------------------------------------------------------- eigenaarsniveaus */

export interface EigenaarsNiveau {
  level: number;
  naam: string;
  /** Punten die je nodig hebt om hier te geraken. */
  punten: number;
  /** Wat dit niveau opent. Leeg voor niveau 1. */
  voordeel: string;
  /** De korte uitleg van het voordeel in de praktijk. */
  uitleg: string;
}

/**
 * Vijf niveaus, meer niet. Elk niveau opent iets dat je als bestuurder mérkt, en geen
 * enkel niveau zet bestaande mogelijkheden achter slot: wat je op dag één kon, kan je altijd.
 */
export const EIGENAARSNIVEAUS: EigenaarsNiveau[] = [
  {
    level: 1,
    naam: 'Nieuwkomer',
    punten: 0,
    voordeel: '',
    uitleg: 'Je bent net binnen. De bank kijkt de kat uit de boom en de gemeente kent je nog niet.',
  },
  {
    level: 2,
    naam: 'Bestuurder',
    punten: 8,
    voordeel: 'Betere bankvoorwaarden',
    uitleg: 'De bank kent je intussen: een half procent minder rente op elke nieuwe lening.',
  },
  {
    level: 3,
    naam: 'Voorzitter',
    punten: 20,
    voordeel: 'Drie bouwprojecten tegelijk',
    uitleg: 'Aannemers werken graag voor je: je mag drie werven tegelijk open hebben in plaats van twee.',
  },
  {
    level: 4,
    naam: 'Sterke man',
    punten: 40,
    voordeel: 'Bredere sponsorwerving',
    uitleg: 'Je naam opent deuren: een sponsorcampagne levert een extra prospect op en de bedragen liggen hoger.',
  },
  {
    level: 5,
    naam: 'Clubicoon',
    punten: 70,
    voordeel: 'Het vertrouwen van de gemeente',
    uitleg: 'Het gemeentebestuur rekent op je: een kwart meer subsidie, elk jaar opnieuw.',
  },
];

/** Waar je punten mee verdient. Alleen dingen die je zelf in de hand hebt. */
export const PUNTEN = {
  seizoen: 1, // elk afgewerkt seizoen
  promotie: 3,
  titel: 5,
  mijlpaal: 2,
  winstgevendSeizoen: 2,
  doelBehaald: 10,
} as const;
