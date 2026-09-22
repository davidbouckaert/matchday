// Handleiding: korte uitleg en veelgestelde vragen. Bedoeld om snel iets op te zoeken.

import type { GameState } from '../../engine/types';
import { MATCH_WEEKS, SEASON_END_WEEK } from '../../engine/calendar';
import { MIN_SQUAD } from '../../engine/players';
import { VERSION } from '../../version';
import { esc } from '../format';

interface QA {
  q: string;
  a: string;
}

function faq(): QA[] {
  return [
    {
      q: 'Hoe verdien ik geld?',
      a: `Sponsors en lidgelden lopen elke week door. Tickets, kantine en de kraampjes verdien je alleen op een <strong>thuiswedstrijd</strong>;
        de fanshop draait ook tussendoor. Evenementen brengen in één klap iets op, maar het geld komt pas een paar weken later.
        Van elke ticketeuro gaat 8% naar de bezoekende club en de bond.`,
    },
    {
      q: 'Waarom verlies ik geld in een week zonder wedstrijd?',
      a: 'Lonen, onderhoud, energie, trainingen en aflossingen lopen elke week door. Zonder thuiswedstrijd valt de helft van je inkomsten weg. Reken daarop, zeker tijdens de winterstop.',
    },
    {
      q: 'Wanneer kan ik spelers kopen of verkopen?',
      a: `Alleen tijdens de transferperiode: week 1 tot 9, week 28 tot 32 en vanaf week 45. Buiten die periodes kun je wel spelers te koop zetten.
        Je kunt nooit onder ${MIN_SQUAD} spelers zakken en elke linie houdt minstens één reserve.`,
    },
    {
      q: 'Hoe werkt een contractverlenging?',
      a: 'Bij Ploeg › Contracten zie je wat een speler vraagt. Bied je minder, dan kan hij weigeren: zijn moraal zakt, hij vraagt daarna méér en na drie mislukte pogingen wil hij dit seizoen niet meer praten. Een uitgeleende speler kun je gewoon verlengen.',
    },
    {
      q: 'Wat doet een taak uitbesteden?',
      a: 'Bij Staff kies je per taak wie ze doet. Een staflid beslist dan elke week zelf. Zijn eigen vakgebied doet hij op vol niveau, een taak die er naast ligt met minder kennis. Hoe beter hij is, hoe meer taken hij aankan (1 tot 4).',
    },
    {
      q: 'Hoe ontwikkelen mijn spelers zich?',
      a: 'Om de 4 weken. Jong = veel groei (17 jaar is maximaal, vanaf 31 groeit niemand nog), veel spelen helpt, minstens 3 trainingen per week ook. Wie op de bank zit, gaat er vanaf zijn 26ste op achteruit.',
    },
    {
      q: 'Waarom kan ik die staflid niet aanwerven?',
      a: 'Sommige functies hebben eerst infrastructuur of een werking nodig: een kinesist een recuperatieruimte, een data-analist wifi, een kantineverantwoordelijke een kantine van niveau 2. Je ziet de reden bij de kandidaat.',
    },
    {
      q: 'Waarom krijg ik geen sponsor van een bepaald type?',
      a: 'Elke plaats bestaat maar een beperkt aantal keer, en sommige moet je eerst verdienen: schermen vragen een goede kantine, de ploegbussponsor een eigen bus, de evenementensponsor een georganiseerd evenement. Bij Sponsors staat per plaats hoeveel er vrij zijn en waarom ze eventueel op slot staan.',
    },
    {
      q: 'Wat levert promotie op?',
      a: `Alles schaalt mee: het supportersplafond, de normale ticketprijs, de sponsorbedragen voor nieuwe contracten, de tv-rechten en de richtprijzen in de fanshop.
        Je bestaande sponsors blijven op hun oude bedrag, maar ze zijn na promotie een pak tevredener: de besten bieden spontaan een hoger contract aan en een extra bijdrage vragen lukt vaker.
        Er is ook een premie, die je op het einde van het seizoen apart geboekt ziet staan onder <strong>premies</strong> (in het weekrapport, bij Club › Cijfers en in je clubgeschiedenis).
        Voetbal Vlaanderland betaalt in de amateurreeksen géén prijzengeld: wat je krijgt zijn premies van je sponsors, een kampioenenreceptie en een tombola.
        1ste Provinciale €2.000 (plaats 2: €1.000), 3de Nationale €4.500 (€2.500), 2de Nationale €7.000 (€4.000), 1ste Nationale €40.000 (€25.000), Challenger Pro Liga €160.000 (€95.000).
        Daar staat tegenover dat spelers ongeveer 14% en staff 10% meer vragen, en dat de aansluiting bij de bond en de verzekeringen duurder worden.`,
    },
    {
      q: 'Wat gebeurt er als ik in het rood ga?',
      a: 'Je krijgt waarschuwingen en soms een noodlening. Blijf je 8 weken onder nul, dan is de club failliet en is het spel afgelopen.',
    },
    {
      q: 'Hoe verloopt een seizoen?',
      a: `Een seizoen is 52 weken. De competitie loopt van week ${MATCH_WEEKS[0]} tot ${MATCH_WEEKS[MATCH_WEEKS.length - 1]}, met een winterstop ertussen.
        In week ${SEASON_END_WEEK} vallen de beslissingen over promotie en degradatie. De volledige kalender staat bij Club › Kalender.`,
    },
    {
      q: 'Waar staat mijn spel opgeslagen?',
      a: 'In deze browser (IndexedDB), na elke actie en elke week. Maak af en toe een back-up als bestand bij Opslaan; daarmee kun je ook op een andere computer verder spelen.',
    },
    {
      q: 'Kan ik de animatie na elke week uitzetten?',
      a: 'Ja, bij Opslaan. Spatie = volgende week of rapport sluiten, Esc = rapport sluiten.',
    },
  ];
}

export function guideScreen(s: GameState): string {
  return `<div class="grid">
    <section class="card span2">
      <h2>Handleiding</h2>
      <p class="muted small">Je bent eigenaar van ${esc(s.clubName)}. Jij beslist over geld, mensen en gebouwen; de trainer wint (of verliest) de wedstrijden.
      Versie ${VERSION}.</p>
      <h3>In het kort</h3>
      <ol class="small">
        <li><strong>Overzicht</strong> — je dashboard: clubrating, volgende wedstrijd, nieuws en je logboek.</li>
        <li><strong>Ploeg</strong> — selectie en spelersrollen, strategie, transfers en contracten.</li>
        <li><strong>Staff</strong> — aanwerven, opleiden en per taak kiezen wie ze doet.</li>
        <li><strong>Club</strong> — kalender, financiën, cijfers, sponsors, fanshop, horeca, evenementen, infrastructuur en clubinfo.</li>
        <li><strong>Competitie</strong> — de stand, de kalender en de tuchtzaken.</li>
        <li><strong>Invloeden</strong> — elke vermenigvuldiger die op dit moment meespeelt, met zijn herkomst.</li>
      </ol>
      <p class="small">Klaar? Druk op <strong>Volgende week</strong> (of op de spatiebalk). Je ziet een korte animatie en daarna het weekrapport.</p>
    </section>
    <section class="card span2">
      <h3>Veelgestelde vragen</h3>
      ${faq()
        .map((x) => `<details><summary>${esc(x.q)}</summary><p class="small">${x.a}</p></details>`)
        .join('')}
    </section>
  </div>`;
}
