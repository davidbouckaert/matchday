// Meevallers en tegenslagen die vanzelf gebeuren, zonder dat de eigenaar iets kiest.
//
// Zuivere data. Een nieuwe gebeurtenis toevoegen = een blok bijschrijven; de simulatie
// (src/engine/events.ts) hoeft er niet voor te veranderen.

import type { EventDef } from './types';

export const RANDOM_EVENTS: EventDef[] = [
  {
    id: 'storm',
    categorie: 'infrastructuur',
    kans: 0.006,
    kansFactoren: [{ wanneer: { vlag: 'winter' }, factor: 4.2 }],
    effecten: [
      { boek: 'tegenslagen', bedrag: { heel: [-7, -2], maal: 1000, inflatie: true, afronden: 50 }, reden: 'Stormschade' },
      { nieuws: { toon: 'slecht', tekst: 'Storm! Het dak van de tribune is beschadigd. Herstelling: {bedrag}.' } },
    ],
  },
  {
    id: 'influencer',
    categorie: 'bestuur',
    kans: 0.008,
    effecten: [
      { supporters: { heel: [20, 60] } },
      { reputatie: 2 },
      {
        nieuws: {
          toon: 'goed',
          tekst: [
            'Een lokale influencer filmde een wedstrijd. De video ging viraal: +{aantal} supporters.',
            'Een filmpje van de laatste thuismatch doet de ronde op sociale media: +{aantal} supporters.',
          ],
        },
      },
    ],
  },
  {
    id: 'subsidie',
    categorie: 'bestuur',
    kans: 0.007,
    effecten: [
      { boek: 'subsidies', bedrag: { heel: [3, 8], maal: 1000, inflatie: true, afronden: 50 }, reden: 'Extra subsidie gemeente' },
      { nieuws: { toon: 'goed', tekst: 'De gemeente kent een extra sportsubsidie toe van {bedrag}.' } },
    ],
  },
  {
    id: 'inbraak',
    categorie: 'kantine',
    kans: 0.006,
    effecten: [
      { boek: 'tegenslagen', bedrag: { heel: [-2500, -800], afronden: 50 }, reden: 'Inbraak kantine' },
      { nieuws: { toon: 'slecht', tekst: 'Inbraak in de kantine. De kassa en de vriezer met frieten zijn weg ({bedrag}).' } },
    ],
  },
  {
    id: 'koeling',
    categorie: 'kantine',
    kans: 0.006,
    wanneer: { meting: 'kantineniveau', min: 1 },
    effecten: [
      { boek: 'tegenslagen', bedrag: { basis: -3200, inflatie: true, afronden: 50 }, reden: 'Koelinstallatie' },
      { nieuws: { toon: 'slecht', tekst: 'De koelinstallatie van de kantine begeeft het. Vervanging: {bedrag}.' } },
    ],
  },
  {
    id: 'defect',
    categorie: 'infrastructuur',
    kans: 0.004,
    kansFactoren: [
      { wanneer: { meting: 'onderhoudsniveau', max: 0 }, factor: 15 },
      { wanneer: { meting: 'onderhoudsniveau', min: 1, max: 1 }, factor: 3.75 },
    ],
    effecten: [
      {
        als: { meting: 'onderhoudsniveau', max: 0 },
        dan: [
          { boek: 'tegenslagen', bedrag: { heel: [-5, -1], maal: 1400, inflatie: true, afronden: 50 }, reden: 'Herstelling' },
          {
            nieuws: {
              toon: 'slecht',
              tekst: [
                'Defect: de verwarming van de kleedkamers is stuk. Herstelling: {bedrag}. Met meer onderhoud was dit niet gebeurd.',
                'Defect: een deel van de verlichting is stuk. Herstelling: {bedrag}. Met meer onderhoud was dit niet gebeurd.',
                'Defect: de boiler van de douches is stuk. Herstelling: {bedrag}. Met meer onderhoud was dit niet gebeurd.',
              ],
            },
          },
        ],
      },
      {
        als: { meting: 'onderhoudsniveau', min: 1 },
        dan: [
          { boek: 'tegenslagen', bedrag: { heel: [-5, -1], maal: 1000, inflatie: true, afronden: 50 }, reden: 'Herstelling' },
          {
            nieuws: {
              toon: 'slecht',
              tekst: [
                'Defect: de dakgoot van de tribune is stuk. Herstelling: {bedrag}.',
                'Defect: de grasmachine is stuk. Herstelling: {bedrag}.',
                'Defect: een deel van de verlichting is stuk. Herstelling: {bedrag}.',
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'erfenis',
    categorie: 'bestuur',
    kans: 0.0015,
    effecten: [
      { boek: 'meevallers', bedrag: { basis: 15000, inflatie: true, afronden: 100 }, reden: 'Schenking oud-voorzitter' },
      { nieuws: { toon: 'goed', tekst: 'Een overleden oud-voorzitter liet de club {bedrag} na. Er komt een minuut applaus.' } },
      { geschiedenis: 'Een oud-voorzitter liet de club {bedrag} na.' },
    ],
  },
  {
    id: 'vrijwilliger-weg',
    categorie: 'bestuur',
    kans: 0.03,
    kansFactoren: [{ wanneer: { meting: 'vrijwilligerstrouw', min: 1 }, factor: 0.4 }],
    effecten: [
      { vrijwilligers: { heel: [-2, -1] } },
      {
        nieuws: {
          toon: 'slecht',
          tekst: '{aantal} vrijwilligers stoppen ermee. "Het is te veel geworden."',
          enkelvoud: 'Een vrijwilliger stopt ermee. "Het is te veel geworden."',
        },
      },
    ],
  },
  {
    id: 'vrijwilliger-bij',
    categorie: 'bestuur',
    kans: 0.014,
    kansFactoren: [
      { wanneer: { meting: 'sfeer', min: 40 }, factor: 1.5 },
      { wanneer: { meting: 'sfeer', min: 70 }, factor: 1.5 },
      { wanneer: { meting: 'sfeer', min: 90 }, factor: 1.2 },
    ],
    effecten: [
      { vrijwilligers: { heel: [1, 4] } },
      {
        nieuws: {
          toon: 'goed',
          tekst: '{aantal} ouders van jeugdspelers melden zich als vrijwilliger.',
          enkelvoud: 'Een ouder van een jeugdspeler meldt zich als vrijwilliger.',
        },
      },
    ],
  },
  {
    id: 'griep',
    categorie: 'kleedkamer',
    kans: 0.015,
    wanneer: { vlag: 'winter' },
    effecten: [
      { griep: { kans: 0.2, weken: 1 } },
      {
        als: { variabele: 'aantal', min: 1 },
        dan: [
          {
            nieuws: {
              toon: 'slecht',
              tekst: 'Griepgolf in de kleedkamer: {aantal} spelers zijn een week out.',
              enkelvoud: 'Griep in de kleedkamer: één speler is een week out.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'supportersclub',
    categorie: 'bestuur',
    kans: 0.006,
    wanneer: { meting: 'sfeer', min: 71 },
    effecten: [
      { supporters: 40 },
      { sfeer: 4 },
      { nieuws: { toon: 'goed', tekst: 'Een nieuwe supportersclub is opgericht: "De Zuiderlingen". +40 supporters.' } },
      { geschiedenis: 'Supportersclub "De Zuiderlingen" boven de doopvont gehouden.' },
    ],
  },
  {
    id: 'sponsor-failliet',
    categorie: 'sponsor',
    kans: 0.004,
    wanneer: { meting: 'sponsors', min: 4 },
    effecten: [
      { sponsor: 'willekeurig', beeindig: true },
      { nieuws: { toon: 'slecht', tekst: 'Sponsor {sponsor} is failliet. Het contract valt weg.' } },
    ],
  },
  {
    id: 'krant-slecht',
    categorie: 'bestuur',
    kans: 0.03,
    wanneer: { meting: 'sfeer', max: 39 },
    effecten: [
      { reputatie: -3 },
      {
        nieuws: {
          toon: 'slecht',
          tekst: [
            'De lokale krant kopt: "Onrust bij de supporters, waar gaat het heen met de club?"',
            'De streekkrant wijdt een halve pagina aan het gemor rond de club.',
          ],
        },
      },
    ],
  },
];
