// De weekmomenten: één concrete beslissing voor de aftrap.
//
// Drie zinnen, twee of drie knoppen, meteen gevolg. Alles hieronder is data — wie een nieuw
// moment wil toevoegen, schrijft er een blok bij en raakt de simulatie niet aan.
//
// Plaatshouders die altijd werken: {club} {tegenstander} {klasse} {seizoen} {jeugdploegen} {kas}
// Bij een focusspeler: {speler} {vermoeidheid} {moraal}. Bij een focussponsor: {sponsor}.
// In een gevolgtekst: {bedrag} (wat er geboekt werd), {aantal}, {weken} (blessureduur).
// In een knoplabel: {kost}.

import type { MomentDef } from './types';

export const MOMENTS: MomentDef[] = [
  {
    id: 'regen',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'thuis' }, { vlag: 'natuurgras' }] },
    titel: 'Het regent al drie dagen',
    tekst: 'De grasmat tegen {tegenstander} staat er drassig bij. De terreinverzorger vraagt of hij een zeil mag leggen.',
    keuzes: [
      {
        id: 'zeil',
        label: 'Zeil leggen ({kost})',
        uitleg: 'Het veld ligt er zondag degelijk bij. Kost geld, geen risico.',
        kost: { basis: 450, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Het zeil lag er op tijd: een degelijk veld en een normale wedstrijd.',
            effecten: [{ boek: 'onderhoud & energie', bedrag: { basis: -450, inflatie: true, afronden: 10 }, reden: 'Zeil over het veld (regen)' }],
          },
        ],
      },
      {
        id: 'gokken',
        label: 'Erop gokken',
        uitleg: 'Misschien droogt het op. Misschien wordt het een modderpoel.',
        gevolgen: [
          {
            kans: 0.45,
            tekst: 'Modderpoel. De supporters mopperen en je spelers kruipen er kapot uit.',
            effecten: [{ sfeer: -4 }, { vermoeidheidIedereen: 4 }],
          },
          { tekst: 'Het klaarde op. Niets aan de hand, en je hield het geld in de kas.' },
        ],
      },
    ],
  },
  {
    id: 'bus',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'uit' }, { vlag: 'teambus', is: false }] },
    titel: 'De huurbus is defect',
    tekst: 'Twee uur voor vertrek naar {tegenstander} belt de busfirma: panne. Er is een duurdere bus vrij, of je gaat met eigen wagens.',
    keuzes: [
      {
        id: 'bus',
        label: 'Duurdere bus nemen ({kost})',
        uitleg: 'Iedereen samen, op tijd, uitgerust.',
        kost: { basis: 600, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'De vervangbus stond er. Iedereen op tijd aan de kleedkamer.',
            effecten: [{ boek: 'wedstrijdkosten', bedrag: { basis: -600, inflatie: true, afronden: 10 }, reden: 'Vervangbus op het laatste moment' }],
          },
        ],
      },
      {
        id: 'wagens',
        label: 'Met eigen wagens',
        uitleg: 'Gratis, maar het wordt haasten en zoeken.',
        gevolgen: [
          {
            kans: 0.3,
            tekst: 'Twee wagens reden verkeerd. Een kwartier te laat aan de kleedkamer en een trainer met rode kop.',
            effecten: [{ vermoeidheidIedereen: 3 }, { moraalIedereen: -3 }],
          },
          {
            tekst: 'Met vijf wagens vertrokken. Wat gedoe, maar iedereen geraakte er.',
            effecten: [{ vermoeidheidIedereen: 3 }],
          },
        ],
      },
    ],
  },
  {
    id: 'blessure',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'hoogsteVermoeidheid', min: 70 }] },
    focusSpeler: 'moeist',
    titel: 'Je beste man is op',
    tekst: '{speler} loopt al weken op zijn tandvlees (vermoeidheid {vermoeidheid}/100). De kinesist raadt rust aan, de trainer wil hem laten spelen.',
    keuzes: [
      {
        id: 'sparen',
        label: 'Sparen deze week',
        uitleg: 'Hij blijft thuis, komt fris terug. Je ploeg is deze week zwakker.',
        gevolgen: [
          {
            tekst: '{speler} bleef aan de kant en kwam er een pak frisser uit (−25 vermoeidheid).',
            effecten: [{ speler: 'focus', vermoeidheid: -25, moraal: -2, uitBasis: true }],
          },
        ],
      },
      {
        id: 'spelen',
        label: 'Laten spelen',
        uitleg: 'Je sterkste elf, maar een verhoogd risico op een blessure.',
        gevolgen: [
          {
            kans: 0.28,
            tekst: '{speler} ging er inderdaad door: {weken} weken buiten strijd. Dat zagen we aankomen.',
            effecten: [{ speler: 'focus', blessure: { heel: [2, 4] } }],
          },
          {
            tekst: '{speler} speelde en hield het. Moe, maar heel.',
            effecten: [{ speler: 'focus', vermoeidheid: 6 }],
          },
        ],
      },
    ],
  },
  {
    id: 'derbyavond',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'derby' }, { vlag: 'thuis' }] },
    gewicht: 2,
    titel: 'De derby komt eraan',
    tekst: 'Half het dorp komt zondag naar {tegenstander} kijken. De supportersclub vraagt of ze een tent mogen zetten met een extra tap.',
    keuzes: [
      {
        id: 'tent',
        label: 'Tent en extra tap ({kost})',
        uitleg: 'Meer volk, meer pinten, meer sfeer — maar ook meer vrijwilligers nodig.',
        kost: { basis: 350, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'De tent stond vol. Sfeer van jewelste en een kantine die niet stilviel.',
            effecten: [
              { boek: 'kantine', bedrag: { basis: -350, inflatie: true, afronden: 10 }, reden: 'Tent en extra tap voor de derby' },
              { sfeer: 5 },
              { reputatie: 1 },
            ],
          },
        ],
      },
      {
        id: 'sober',
        label: 'Gewoon houden',
        uitleg: 'Geen kosten, geen gedoe.',
        gevolgen: [{ tekst: 'Je hield het sober. Een derby is ook zonder tent een derby.' }],
      },
    ],
  },
  {
    id: 'sponsorbezoek',
    categorie: 'sponsor',
    wanneer: { alle: [{ vlag: 'thuis' }, { meting: 'sponsors', min: 1 }] },
    focusSponsor: 'grootste',
    titel: 'Je hoofdsponsor komt kijken',
    tekst: '{sponsor} komt zondag met tien klanten naar de match. Zijn contract loopt nog even, maar de indruk van vandaag telt.',
    keuzes: [
      {
        id: 'vip',
        label: 'Ontvangst met hapjes ({kost})',
        uitleg: 'Tafel apart, iemand die hen opvangt. Sponsors onthouden dat.',
        kost: { basis: 300, inflatie: true, klasse: true, afronden: 10 },
        gevolgen: [
          {
            tekst: '{sponsor} ging tevreden naar huis (+8 tevredenheid).',
            effecten: [
              { boek: 'kantine', bedrag: { basis: -300, inflatie: true, klasse: true, afronden: 10 }, reden: 'Sponsorontvangst' },
              { sponsor: 'grootste', tevredenheid: 8 },
            ],
          },
        ],
      },
      {
        id: 'gewoon',
        label: 'Gewoon een plaatsje op de tribune',
        uitleg: 'Gratis. Ze komen voor het voetbal, toch?',
        gevolgen: [
          {
            tekst: '{sponsor} stond in de regen tussen de rest. "Ook goed", zei hij. (−3 tevredenheid.)',
            effecten: [{ sponsor: 'grootste', tevredenheid: -3 }],
          },
        ],
      },
    ],
  },
  {
    id: 'scheidsrechter',
    categorie: 'wedstrijd',
    wanneer: { vlag: 'thuis' },
    titel: 'De scheidsrechter is er niet',
    tekst: 'Een kwartier voor de aftrap tegen {tegenstander} is er nog geen ref. De bond stelt een vervanger voor die pas over een uur kan.',
    keuzes: [
      {
        id: 'wachten',
        label: 'Wachten op de bondsref',
        uitleg: 'Een uur later aftrappen. Het publiek zit intussen in de kantine.',
        gevolgen: [
          {
            tekst: 'Een uur later afgetrapt. De supporters mopperden, maar de kantine draaide: {bedrag} extra.',
            effecten: [
              { boek: 'kantine', bedrag: { basis: 420, inflatie: true, spreiding: [0.8, 1.3], afronden: 10 }, reden: 'Extra kantineverbruik tijdens het wachten' },
              { sfeer: -2 },
            ],
          },
        ],
      },
      {
        id: 'clubref',
        label: 'Een clubscheidsrechter vragen',
        uitleg: 'Meteen spelen, maar de bezoekers zullen morren bij elke fluitstoot.',
        gevolgen: [
          {
            kans: 0.35,
            tekst: 'De bezoekers dienden klacht in: {bedrag} boete en een brief van de bond.',
            effecten: [{ boek: 'boetes', bedrag: { basis: -250, inflatie: true, afronden: 10 }, reden: 'Klacht bezoekende club over de clubscheidsrechter' }],
          },
          { tekst: 'De clubref floot een degelijke partij. Niemand die er nog over sprak.' },
        ],
      },
    ],
  },
  {
    id: 'ketel',
    categorie: 'infrastructuur',
    wanneer: { alle: [{ vlag: 'match', is: false }, { meting: 'kantineniveau', min: 2 }] },
    titel: 'De verwarmingsketel stottert',
    tekst: 'De installateur zegt: nu herstellen of wachten tot ze het echt begeeft. Het is een vrije week, dus het kan.',
    keuzes: [
      {
        id: 'nu',
        label: 'Nu herstellen ({kost})',
        uitleg: 'Klaar voor de winter, geen verrassingen.',
        kost: { basis: 900, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Ketel hersteld voor {bedrag}. Een zorg minder.',
            effecten: [{ boek: 'onderhoud & energie', bedrag: { basis: -900, inflatie: true, afronden: 10 }, reden: 'Herstelling verwarmingsketel' }],
          },
        ],
      },
      {
        id: 'wachten',
        label: 'Laten hangen',
        uitleg: 'Gratis, tot ze stukgaat. Dan is het duurder én koud.',
        gevolgen: [
          {
            kans: 0.4,
            tekst: 'De ketel begaf het een week later: {bedrag} en een koude kantine.',
            effecten: [
              { boek: 'tegenslagen', bedrag: { basis: -2400, inflatie: true, afronden: 10 }, reden: 'Verwarmingsketel begeven' },
              { sfeer: -3 },
            ],
          },
          { tekst: 'De ketel stottert nog altijd, maar doet het. Voorlopig.' },
        ],
      },
    ],
  },
  {
    id: 'jeugdtornooi',
    categorie: 'jeugd',
    wanneer: { alle: [{ vlag: 'match', is: false }, { meting: 'jeugdploegen', min: 3 }] },
    titel: 'Uitnodiging voor een jeugdtornooi',
    tekst: 'Een club uit de streek nodigt je {jeugdploegen} jeugdploegen uit voor een tornooi. Inschrijving en verplaatsing kosten geld, maar het is een dag uit.',
    keuzes: [
      {
        id: 'gaan',
        label: 'Inschrijven ({kost})',
        uitleg: 'Blije ouders, zichtbaarheid in de streek, en de vrijwilligers doen graag mee.',
        kost: { basis: 120, per: 'jeugdploegen', inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Een geslaagde tornooidag voor {bedrag}: +2 reputatie en vrijwilligers die er weer een maand tegen kunnen.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -120, per: 'jeugdploegen', inflatie: true, afronden: 10 }, reden: 'Jeugdtornooi (inschrijving en verplaatsing)' },
              { reputatie: 2 },
              { vrijwilligerstrouw: 4 },
            ],
          },
        ],
      },
      {
        id: 'thuis',
        label: 'Bedanken',
        uitleg: 'Geen kosten. Ook geen verhaal om over te vertellen.',
        gevolgen: [{ tekst: 'Je bedankte vriendelijk. De jeugd traint gewoon verder.' }],
      },
    ],
  },
  {
    id: 'kernspeler',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'laagsteMoraal', max: 39 }] },
    focusSpeler: 'laagsteMoraal',
    titel: 'Een speler is de sfeer aan het verzieken',
    tekst: '{speler} loopt al weken te morren in de kleedkamer (moraal {moraal}/100). De trainer vraagt wat jij ervan vindt.',
    keuzes: [
      {
        id: 'gesprek',
        label: 'Zelf een gesprek voeren',
        uitleg: 'Een half uur van je tijd. Werkt vaak, soms niet.',
        gevolgen: [
          {
            kans: 0.7,
            tekst: 'Het gesprek met {speler} deed deugd: hij is er weer bij (+18 moraal).',
            effecten: [{ speler: 'focus', moraal: 18 }],
          },
          {
            tekst: '{speler} knikte beleefd en bleef mokken. Een beetje beter, meer niet.',
            effecten: [{ speler: 'focus', moraal: 4 }],
          },
        ],
      },
      {
        id: 'bank',
        label: 'Naar de B-kern',
        uitleg: 'Duidelijk signaal. Hij is kwaad, de rest weet waar de grens ligt.',
        gevolgen: [
          {
            tekst: '{speler} naar de B-kern. Hij is niet blij, de rest van de groep wel (+2 moraal).',
            effecten: [{ speler: 'focus', moraal: -10, uitBasis: true }, { moraalIedereen: 2 }],
          },
        ],
      },
      {
        id: 'niets',
        label: 'Laten waaien',
        uitleg: 'Het gaat wel over. Of niet.',
        gevolgen: [
          {
            tekst: 'Je liet het waaien. Het gemor kroop langzaam door de hele kleedkamer (−1 moraal).',
            effecten: [{ moraalIedereen: -1 }],
          },
        ],
      },
    ],
  },
  {
    id: 'kaartverkoop',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'thuis' }, { meting: 'capaciteit', min: 400 }] },
    titel: 'Een bus supporters van de tegenstander',
    tekst: '{tegenstander} meldt dat er twee bussen supporters komen. Wil je een extra ingang en een aparte tap openen?',
    keuzes: [
      {
        id: 'open',
        label: 'Extra ingang en tap ({kost})',
        uitleg: 'Meer bezoekers binnen, meer verbruik, en geen rijen aan de poort.',
        kost: { basis: 200, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Twee bussen volk zonder aanschuiven: {bedrag} aan de kassa en de tap.',
            effecten: [
              { boek: 'wedstrijdkosten', bedrag: { basis: -200, inflatie: true, afronden: 10 }, reden: 'Extra ingang en tap voor bezoekende supporters' },
              { boek: 'tickets', bedrag: { basis: 60, per: 'ticketprijs', spreiding: [0.9, 1.6], afronden: 5 }, reden: 'Extra bezoekers dankzij de tweede ingang' },
            ],
          },
        ],
      },
      {
        id: 'niet',
        label: 'Eén ingang volstaat',
        uitleg: 'Gratis, maar een deel haakt af aan de rij.',
        gevolgen: [
          {
            tekst: 'Lange rij aan de poort. Een deel van de bezoekers zag het niet zitten en bleef in de bus.',
            effecten: [{ sfeer: -1 }],
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------- ketens */
//
// Hieronder staan momenten die voortbouwen op wat er eerder gebeurde. Ze verschijnen
// alleen wanneer de bijbehorende verhaallijn openstaat, en ze erven de namen en bedragen
// van die eerdere gebeurtenis. Zo wordt één keuze een verhaal in plaats van een melding.

export const CHAIN_MOMENTS: MomentDef[] = [
  // ---- keten "sponsorruzie": onvrede → gesprek of stilte → afloop -------------
  {
    id: 'sponsor-onvrede',
    categorie: 'sponsor',
    wanneer: {
      alle: [
        { meting: 'sponsors', min: 2 },
        { niet: { verhaal: 'sponsorgesprek' } },
        { niet: { verhaal: 'sponsorkoud' } },
        { niet: { verhaal: 'sponsorvriend' } },
      ],
    },
    focusSponsor: 'grootste',
    cooldown: 30,
    titel: 'Je hoofdsponsor is niet tevreden',
    tekst: '{sponsor} belt op. Hij ziet zijn naam nergens hangen, hoort niets van de club en vraagt zich hardop af waar zijn geld naartoe gaat.',
    keuzes: [
      {
        id: 'praten',
        label: 'Zelf langsgaan',
        uitleg: 'Een namiddag van je tijd. Je hoort wat er scheelt en hij voelt zich gehoord.',
        gevolgen: [
          {
            tekst: 'Je zat twee uur bij {sponsor} aan tafel. Hij is nog niet overtuigd, maar de deur staat open.',
            effecten: [
              { sponsor: 'grootste', tevredenheid: 5 },
              { verhaalOpenen: { naam: 'sponsorgesprek', weken: 14 } },
            ],
          },
        ],
      },
      {
        id: 'geld',
        label: 'Een bord en een vermelding beloven ({kost})',
        uitleg: 'Je lost het op met zichtbaarheid in plaats van met een gesprek. Werkt, maar kost.',
        kost: { basis: 900, inflatie: true, klasse: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Er hangt een nieuw bord met de naam van {sponsor} langs het veld, betaald met {bedrag}.',
            effecten: [
              { boek: 'sponsors', bedrag: { basis: -900, inflatie: true, klasse: true, afronden: 10 }, reden: 'Extra zichtbaarheid hoofdsponsor' },
              { sponsor: 'grootste', tevredenheid: 12 },
              { verhaalOpenen: { naam: 'sponsorgesprek', weken: 14 } },
            ],
          },
        ],
      },
      {
        id: 'negeren',
        label: 'Het laten bekoelen',
        uitleg: 'Je hebt wel andere dingen aan je hoofd. Hij komt er wel overheen. Misschien.',
        gevolgen: [
          {
            tekst: 'Je liet het liggen. {sponsor} heeft sindsdien niets meer van zich laten horen.',
            effecten: [
              { sponsor: 'grootste', tevredenheid: -8 },
              { verhaalOpenen: { naam: 'sponsorkoud', weken: 14 } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sponsor-gesprek-vervolg',
    categorie: 'sponsor',
    wanneer: { alle: [{ verhaal: 'sponsorgesprek' }, { meting: 'week', min: 4 }] },
    focusSponsor: 'grootste',
    verhaal: 'sponsorgesprek',
    gewicht: 3,
    cooldown: 20,
    titel: '{sponsor} heeft nagedacht',
    tekst: 'Na jullie gesprek is {sponsor} terug. Hij wil verder met de club — op voorwaarde dat hij er iets voor terugkrijgt dat hij aan zijn klanten kan tonen.',
    keuzes: [
      {
        id: 'avond',
        label: 'Een sponsoravond organiseren ({kost})',
        uitleg: 'Zijn klanten, jouw kantine, een spelersdelegatie. Duur, maar het bindt hem voor jaren.',
        kost: { basis: 1400, inflatie: true, klasse: true, afronden: 10 },
        gevolgen: [
          {
            kans: 0.8,
            tekst: 'De sponsoravond was een schot in de roos. {sponsor} tekende ter plekke bij en bracht twee kennissen mee.',
            effecten: [
              { boek: 'evenementen', bedrag: { basis: -1400, inflatie: true, klasse: true, afronden: 10 }, reden: 'Sponsoravond' },
              { boek: 'sponsors', bedrag: { basis: 2600, inflatie: true, klasse: true, afronden: 50 }, reden: 'Verlenging hoofdsponsor na de sponsoravond' },
              { sponsor: 'grootste', tevredenheid: 22 },
              { reputatie: 3 },
              { verhaalSluiten: 'sponsorgesprek' },
              { verhaalOpenen: { naam: 'sponsorvriend', weken: 60 } },
              { geschiedenis: '{sponsor} verlengde na een geslaagde sponsoravond.' },
            ],
          },
          {
            tekst: 'De avond liep, maar het vonkte niet. {sponsor} blijft, zonder er meer geld tegenaan te gooien.',
            effecten: [
              { boek: 'evenementen', bedrag: { basis: -1400, inflatie: true, klasse: true, afronden: 10 }, reden: 'Sponsoravond' },
              { sponsor: 'grootste', tevredenheid: 10 },
              { verhaalSluiten: 'sponsorgesprek' },
            ],
          },
        ],
      },
      {
        id: 'eerlijk',
        label: 'Eerlijk zeggen dat het er nu niet in zit',
        uitleg: 'Geen beloftes die je niet kunt houden. Sommige sponsors waarderen dat meer dan een feest.',
        gevolgen: [
          {
            kans: 0.45,
            tekst: '{sponsor} gaf je een schouderklop. "Dat je het zegt zoals het is, daar hou ik van." Hij blijft.',
            effecten: [
              { sponsor: 'grootste', tevredenheid: 14 },
              { verhaalSluiten: 'sponsorgesprek' },
              { verhaalOpenen: { naam: 'sponsorvriend', weken: 60 } },
            ],
          },
          {
            tekst: '{sponsor} knikte, bedankte, en liet zijn contract stilletjes uitlopen.',
            effecten: [
              { sponsor: 'grootste', tevredenheid: -18 },
              { verhaalSluiten: 'sponsorgesprek' },
              { geschiedenis: '{sponsor} haakte af na een moeilijk seizoen.' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sponsor-koud-vervolg',
    categorie: 'sponsor',
    wanneer: { alle: [{ verhaal: 'sponsorkoud' }, { meting: 'week', min: 4 }] },
    focusSponsor: 'grootste',
    verhaal: 'sponsorkoud',
    gewicht: 3,
    cooldown: 20,
    titel: 'De brief van {sponsor}',
    tekst: 'Er ligt een aangetekende brief van {sponsor} op tafel. Hij wil het contract herbekijken, en de toon is niet vriendelijk.',
    keuzes: [
      {
        id: 'voet',
        label: 'Voet bij stuk houden',
        uitleg: 'Een contract is een contract. Als hij weg wil, mag hij gaan — maar dan ben je hem kwijt.',
        gevolgen: [
          {
            kans: 0.5,
            tekst: '{sponsor} bond in. Het contract loopt gewoon door, al is er iets stuk.',
            effecten: [
              { sponsor: 'grootste', tevredenheid: -5 },
              { reputatie: 2 },
              { verhaalSluiten: 'sponsorkoud' },
            ],
          },
          {
            tekst: '{sponsor} stapte op. Het bord komt van het veld en zijn naam van het shirt.',
            effecten: [
              { sponsor: 'grootste', beeindig: true },
              { sfeer: -3 },
              { verhaalSluiten: 'sponsorkoud' },
              { geschiedenis: '{sponsor} verliet de club na een conflict.' },
            ],
          },
        ],
      },
      {
        id: 'toegeven',
        label: 'Een korting geven om hem te houden',
        uitleg: 'Je verliest een deel van het bedrag, maar de naam blijft op het shirt staan.',
        gevolgen: [
          {
            tekst: 'Je gaf toe. {sponsor} blijft, tegen een lagere prijs — en met een bittere nasmaak aan beide kanten.',
            effecten: [
              { boek: 'sponsors', bedrag: { basis: -1200, inflatie: true, klasse: true, afronden: 50 }, reden: 'Korting na het conflict met de hoofdsponsor' },
              { sponsor: 'grootste', tevredenheid: 8 },
              { verhaalSluiten: 'sponsorkoud' },
              { geschiedenis: 'Het conflict met {sponsor} werd afgekocht met een korting.' },
            ],
          },
        ],
      },
    ],
  },

  // ---- keten "oude bekende": een verkochte speler komt je tegen ---------------
  {
    id: 'oude-bekende',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ verhaal: 'oudspeler' }, { vlag: 'match' }] },
    verhaal: 'oudspeler',
    gewicht: 2,
    cooldown: 16,
    titel: '{speler} staat aan de overkant',
    tekst: '{speler}, die je eerder liet gaan, speelt nu bij {oudeclub}. Zondag staat hij tegenover zijn oude ploeg, en hij heeft iets recht te zetten.',
    keuzes: [
      {
        id: 'mandekking',
        label: 'Hem laten bewaken',
        uitleg: 'Eén man volgt hem de hele match. Dat kost je elders iets aan vrijheid.',
        gevolgen: [
          {
            kans: 0.6,
            tekst: '{speler} kwam er niet aan te pas. Hij verliet het veld zonder één kans, met een rood hoofd.',
            effecten: [{ moraalIedereen: 2 }],
          },
          {
            tekst: 'De mandekking hield niet. {speler} glipte er toch tussenuit en liet het merken ook.',
            effecten: [{ sfeer: -2 }, { moraalIedereen: -1 }],
          },
        ],
      },
      {
        id: 'applaus',
        label: 'Hem laten uitwuiven door het publiek',
        uitleg: 'Een bloemetje voor de aftrap. Elegant, en de supporters onthouden zo\'n gebaar.',
        gevolgen: [
          {
            tekst: 'Het hele stadion stond recht voor {speler}. Hij was zichtbaar aangedaan — en speelde daarna een halfslachtige match.',
            effecten: [
              { sfeer: 4 },
              { reputatie: 2 },
              { geschiedenis: '{speler} kreeg een staande ovatie bij zijn terugkeer met {oudeclub}.' },
            ],
          },
        ],
      },
      {
        id: 'niets',
        label: 'Er geen zaak van maken',
        uitleg: 'Het is gewoon een wedstrijd zoals alle andere.',
        gevolgen: [{ tekst: 'Je liet het voorbijgaan. {speler} speelde, en niemand had het er nadien nog over.' }],
      },
    ],
  },

  // ---- keten "weggekaapt": de jeugdspeler die de rivaal je afsnoepte ----------
  {
    id: 'weggekaapt-wraak',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ verhaal: 'weggekaapt' }, { vlag: 'match' }] },
    verhaal: 'weggekaapt',
    gewicht: 2,
    cooldown: 18,
    titel: 'Je eigen jeugd, in het truitje van de buren',
    tekst: '{speler} kwam uit je eigen jeugd en tekende vorig jaar bij {oudeclub}. De kleedkamer heeft het er nog altijd over.',
    keuzes: [
      {
        id: 'motiveren',
        label: 'De groep erop wijzen',
        uitleg: 'Een toespraak over wat hier gebouwd wordt en wie er wél gebleven is.',
        gevolgen: [
          {
            kans: 0.65,
            tekst: 'De boodschap kwam aan. De ploeg speelde alsof er iets te bewijzen viel.',
            effecten: [{ moraalIedereen: 5 }, { sfeer: 2 }],
          },
          {
            tekst: 'Je toespraak viel in een stille kleedkamer. Sommigen vroegen zich hardop af of zij ook beter elders zaten.',
            effecten: [{ moraalIedereen: -3 }],
          },
        ],
      },
      {
        id: 'investeren',
        label: 'Investeren in wie er wél is ({kost})',
        uitleg: 'Betere begeleiding voor je eigen jeugd. Duurder dan een toespraak, maar het blijft hangen.',
        kost: { basis: 1200, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Je stak {bedrag} in de jeugdwerking. Een duidelijk signaal aan iedereen die twijfelde.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -1200, inflatie: true, afronden: 10 }, reden: 'Extra begeleiding eigen jeugd' },
              { reputatie: 4 },
              { vrijwilligerstrouw: 6 },
              { verhaalSluiten: 'weggekaapt' },
              { geschiedenis: 'Na het vertrek van {speler} ging er extra geld naar de eigen jeugd.' },
            ],
          },
        ],
      },
      {
        id: 'schouders',
        label: 'Schouders ophalen',
        uitleg: 'Het hoort erbij. Er komen er nog.',
        gevolgen: [{ tekst: 'Je haalde je schouders op. Het gemor over {speler} zakte vanzelf weg.', effecten: [{ verhaalSluiten: 'weggekaapt' }] }],
      },
    ],
  },
];

MOMENTS.push(...CHAIN_MOMENTS);
