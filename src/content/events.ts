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

/* ------------------------------------------------------------------- ketens */
//
// Gebeurtenissen die voortbouwen op iets dat eerder gebeurde. Ze kijken naar een open
// verhaallijn en erven de namen en bedragen daarvan.

export const CHAIN_EVENTS: EventDef[] = [
  // een geslaagde investering blijft nazinderen
  {
    id: 'nieuwbouw-pers',
    categorie: 'infrastructuur',
    kans: 0.09,
    wanneer: { verhaal: 'nieuwbouw' },
    verhaal: 'nieuwbouw',
    cooldown: 26,
    effecten: [
      { supporters: { heel: [15, 45] } },
      { reputatie: 3 },
      {
        nieuws: {
          toon: 'goed',
          tekst: [
            'De streekkrant kwam langs voor een reportage over de nieuwe {wat}. +{aantal} supporters die het eens willen zien.',
            'Sinds de nieuwe {wat} klaar is, komt er volk kijken dat hier nooit eerder stond: +{aantal} supporters.',
          ],
        },
      },
      { verhaalSluiten: 'nieuwbouw' },
      { geschiedenis: 'De nieuwe {wat} bracht de club in de streekkrant.' },
    ],
  },
  {
    id: 'nieuwbouw-sponsor',
    categorie: 'sponsor',
    kans: 0.06,
    wanneer: { alle: [{ verhaal: 'nieuwbouw' }, { meting: 'sponsors', min: 1 }] },
    verhaal: 'nieuwbouw',
    focusSponsor: 'willekeurig',
    cooldown: 26,
    effecten: [
      { sponsor: 'willekeurig', tevredenheid: 12 },
      { nieuws: { toon: 'goed', tekst: '{sponsor} kwam de nieuwe {wat} bekijken en was zichtbaar tevreden met waar zijn geld naartoe gaat.' } },
    ],
  },

  // financiële zorgen slepen aan, ook nadat het saldo weer klopt
  {
    id: 'geldzorgen-sponsor',
    categorie: 'sponsor',
    kans: 0.03,
    wanneer: { alle: [{ verhaal: 'geldzorgen' }, { meting: 'sponsors', min: 2 }] },
    focusSponsor: 'willekeurig',
    cooldown: 8,
    effecten: [
      { sponsor: 'willekeurig', tevredenheid: -10 },
      {
        nieuws: {
          toon: 'slecht',
          tekst: [
            '{sponsor} heeft de verhalen over de kas gehoord en vraagt garanties voor hij nog iets stort.',
            'In de streek wordt gepraat over de financiën van de club. {sponsor} houdt zijn portefeuille voorlopig dicht.',
          ],
        },
      },
    ],
  },
  {
    id: 'geldzorgen-vrijwilligers',
    categorie: 'bestuur',
    kans: 0.03,
    wanneer: { verhaal: 'geldzorgen' },
    cooldown: 8,
    effecten: [
      { vrijwilligers: { heel: [-2, -1] } },
      {
        nieuws: {
          toon: 'slecht',
          tekst: '{aantal} vrijwilligers haken af: "Ik ga hier niet gratis werken voor een club die morgen niet meer bestaat."',
          enkelvoud: 'Een vrijwilliger haakt af: "Ik ga hier niet gratis werken voor een club die morgen niet meer bestaat."',
        },
      },
    ],
  },
  {
    id: 'geldzorgen-krant',
    categorie: 'bestuur',
    kans: 0.04,
    wanneer: { alle: [{ verhaal: 'geldzorgen' }, { meting: 'kas', max: 0 }] },
    cooldown: 12,
    effecten: [
      { reputatie: -4 },
      { sfeer: -3 },
      { nieuws: { toon: 'slecht', tekst: 'De streekkrant kopt over de financiële toestand van {club}. Dat leest niemand graag aan de toog.' } },
      { geschiedenis: 'De club haalde de krant met haar financiële toestand.' },
    ],
  },

  // een sponsor die door de jaren heen aan de club hangt
  {
    id: 'trouwe-sponsor',
    categorie: 'sponsor',
    kans: 0.04,
    wanneer: { alle: [{ verhaal: 'sponsorvriend' }, { meting: 'sponsors', min: 1 }] },
    verhaal: 'sponsorvriend',
    focusSponsor: 'grootste',
    cooldown: 20,
    effecten: [
      { boek: 'sponsors', bedrag: { basis: 1200, inflatie: true, klasse: true, afronden: 50 }, reden: 'Extra bijdrage van de hoofdsponsor' },
      { nieuws: { toon: 'goed', tekst: '{sponsor} stortte uit eigen beweging {bedrag} extra. "Omdat het hier goed zit", zei hij erbij.' } },
    ],
  },
];

RANDOM_EVENTS.push(...CHAIN_EVENTS);
