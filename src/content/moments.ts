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
    // de drempel ligt op 30: een normale kern zit rond 20-33, dus dit is echt "op"
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'hoogsteVermoeidheid', min: 30 }] },
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
            tekst: '{speler} bleef aan de kant en kwam er een pak frisser uit (−18 vermoeidheid).',
            effecten: [{ speler: 'focus', vermoeidheid: -18, moraal: -2, uitBasis: true }],
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

/* ------------------------------------------------------- meer van hetzelfde soort */
//
// Nog twintig situaties, verspreid over de kantine, de kleedkamer, het bestuur, de jeugd,
// de sponsors en het complex. Puur data: er is geen regel logica voor nodig.
//
// Vuistregel bij het schrijven: de láátste keuze is wat er gebeurt als je niets beslist,
// dus die mag nooit de meest catastrofale zijn.

export const MORE_MOMENTS: MomentDef[] = [
  {
    id: 'frietketel',
    categorie: 'kantine',
    wanneer: { alle: [{ vlag: 'thuis' }, { meting: 'kantineniveau', min: 2 }] },
    titel: 'De frietketel is te klein',
    tekst: 'Bij elke thuismatch staat er een rij tot buiten aan de frietjes. De kantineploeg vraagt om een tweede ketel.',
    keuzes: [
      {
        id: 'kopen',
        label: 'Tweede ketel kopen ({kost})',
        uitleg: 'Dubbel zo snel bedienen. Meer omzet bij elke thuiswedstrijd, en minder gemor in de rij.',
        kost: { basis: 2200, inflatie: true, afronden: 50 },
        gevolgen: [
          {
            tekst: 'De tweede ketel draait. De rij is weg en er gaan merkbaar meer frieten over de toog.',
            effecten: [
              { boek: 'tegenslagen', bedrag: { basis: -2200, inflatie: true, afronden: 50 }, reden: 'Tweede frietketel' },
              { boek: 'kantine', bedrag: { basis: 900, inflatie: true, spreiding: [0.8, 1.4], afronden: 10 }, reden: 'Extra kantineomzet dankzij de tweede ketel' },
              { sfeer: 3 },
            ],
          },
        ],
      },
      {
        id: 'volk',
        label: 'Een extra vrijwilliger vragen',
        uitleg: 'Geen investering, maar je hangt wel af van wie er zin in heeft.',
        gevolgen: [
          { kans: 0.55, tekst: 'Twee ouders sprongen bij. De rij liep vlotter en het kostte je niets.', effecten: [{ sfeer: 1 }, { vrijwilligerstrouw: 3 }] },
          { tekst: 'Niemand had tijd. Dezelfde rij, dezelfde klachten.', effecten: [{ sfeer: -2 }] },
        ],
      },
      {
        id: 'laten',
        label: 'Laten zoals het is',
        uitleg: 'Een rij aan de frietjes hoort erbij.',
        gevolgen: [{ tekst: 'Je liet het zoals het was. Er werd gemopperd, zoals altijd.' }],
      },
    ],
  },
  {
    id: 'sleutel',
    categorie: 'bestuur',
    wanneer: { alle: [{ vlag: 'match', is: false }, { meting: 'vrijwilligers', min: 6 }] },
    titel: 'Wie heeft de sleutel van de kantine?',
    tekst: 'Er lopen negen sleutels van het complex rond en niemand weet precies bij wie. De secretaris wil een nieuw slot met genummerde sleutels.',
    keuzes: [
      {
        id: 'slot',
        label: 'Nieuw slot en een sleutellijst ({kost})',
        uitleg: 'Orde in de chaos. Kost geld, maar je weet weer wie binnen kan.',
        kost: { basis: 700, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Nieuw slot, negen genummerde sleutels en een lijst aan de muur. De secretaris slaapt weer.',
            effecten: [{ boek: 'onderhoud & energie', bedrag: { basis: -700, inflatie: true, afronden: 10 }, reden: 'Nieuw slot en genummerde sleutels' }],
          },
        ],
      },
      {
        id: 'vertrouwen',
        label: 'Erop vertrouwen',
        uitleg: 'Het zijn allemaal mensen van hier. Tot er iets verdwijnt.',
        gevolgen: [
          {
            kans: 0.25,
            tekst: 'Er verdween een krat bier en de kassa stond open. Niemand die iets gezien heeft.',
            effecten: [{ boek: 'tegenslagen', bedrag: { basis: -450, inflatie: true, afronden: 10 }, reden: 'Verdwenen voorraad kantine' }],
          },
          { tekst: 'Niets aan de hand. Iedereen die binnen kon, hoorde er ook te zijn.' },
        ],
      },
    ],
  },
  {
    id: 'oudgediende',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'spelers', min: 16 }] },
    focusSpeler: 'beste',
    titel: 'Een oudgediende wil afscheid nemen',
    tekst: 'Een speler die hier al jaren rondloopt, vraagt of hij zondag nog één keer mag starten. Sportief is er iets voor te zeggen, en er is ook iets anders.',
    keuzes: [
      {
        id: 'afscheid',
        label: 'Een afscheidswedstrijd geven',
        uitleg: 'De hele familie komt kijken, de kantine draait, en de kleedkamer ziet dat je mensen niet vergeet.',
        gevolgen: [
          {
            tekst: 'Vol huis, bloemen bij de aftrap en een kantine die niet stilviel. Zo neem je afscheid.',
            effecten: [
              { boek: 'kantine', bedrag: { basis: 700, inflatie: true, spreiding: [0.8, 1.5], afronden: 10 }, reden: 'Afscheidsviering oudgediende' },
              { sfeer: 4 },
              { moraalIedereen: 3 },
              { reputatie: 2 },
              { geschiedenis: 'Een oudgediende kreeg zijn afscheidswedstrijd, met volle kantine.' },
            ],
          },
        ],
      },
      {
        id: 'sportief',
        label: 'Sportief beslissen',
        uitleg: 'De beste elf speelt. Hij begrijpt dat wel, denk je.',
        gevolgen: [
          {
            tekst: 'Je koos sportief. Hij zei niets, maar hij zei het luid.',
            effecten: [{ moraalIedereen: -2 }],
          },
        ],
      },
    ],
  },
  {
    id: 'grasmaaier',
    categorie: 'infrastructuur',
    wanneer: { alle: [{ vlag: 'natuurgras' }, { vlag: 'winter', is: false }] },
    titel: 'De grasmaaier trekt niet meer',
    tekst: 'De terreinverzorger staat al een uur met de motorkap open. Er is een tweedehandse te koop bij een club twee dorpen verder.',
    keuzes: [
      {
        id: 'nieuwe',
        label: 'De tweedehandse kopen ({kost})',
        uitleg: 'Meteen opgelost, en een veld dat er de hele lente goed bij ligt.',
        kost: { basis: 3200, inflatie: true, afronden: 50 },
        gevolgen: [
          {
            tekst: 'De tweedehandse staat in de loods. Het veld ligt er weer strak bij.',
            effecten: [
              { boek: 'onderhoud & energie', bedrag: { basis: -3200, inflatie: true, afronden: 50 }, reden: 'Tweedehandse grasmaaier' },
              { reputatie: 1 },
            ],
          },
        ],
      },
      {
        id: 'lappen',
        label: 'Laten herstellen',
        uitleg: 'Goedkoper, maar je weet nooit hoelang het houdt.',
        gevolgen: [
          {
            kans: 0.55,
            tekst: 'Hersteld en weer aan het werk. Voor de prijs van een onderdeel.',
            effecten: [{ boek: 'onderhoud & energie', bedrag: { basis: -600, inflatie: true, afronden: 10 }, reden: 'Herstelling grasmaaier' }],
          },
          {
            tekst: 'Twee weken later stond hij er weer bij. Het veld ziet eruit als een weide.',
            effecten: [
              { boek: 'onderhoud & energie', bedrag: { basis: -600, inflatie: true, afronden: 10 }, reden: 'Herstelling grasmaaier' },
              { sfeer: -2 },
              { reputatie: -1 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'kleedkamerruzie',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'spelers', min: 14 }] },
    focusSpeler: 'willekeurig',
    titel: 'Slaande deuren in de kleedkamer',
    tekst: 'Na de training ging het er stevig aan toe tussen twee spelers. {speler} stond middenin en wil er niet over praten.',
    keuzes: [
      {
        id: 'uitpraten',
        label: 'Ze samen laten uitpraten',
        uitleg: 'Een half uur, jij erbij. Meestal is het daarna over.',
        gevolgen: [
          { kans: 0.7, tekst: 'Handen geschud en verder gegaan. De groep merkte dat het opgelost werd.', effecten: [{ moraalIedereen: 3 }] },
          { tekst: 'Ze zaten er zwijgend bij. Opgelost is het niet, maar het is wel besproken.', effecten: [{ speler: 'focus', moraal: -4 }] },
        ],
      },
      {
        id: 'boete',
        label: 'Allebei een boete geven',
        uitleg: 'Duidelijk signaal, en het geld gaat naar de kas. Maar het lost niets op.',
        gevolgen: [
          {
            tekst: 'Twee boetes in de clubkas. De rest van de groep hield zich opvallend gedeisd.',
            effecten: [
              { boek: 'meevallers', bedrag: { basis: 120, inflatie: true, afronden: 10 }, reden: 'Interne boetes na een ruzie' },
              { speler: 'focus', moraal: -8 },
              { moraalIedereen: -1 },
            ],
          },
        ],
      },
      {
        id: 'trainer',
        label: 'Aan de trainer overlaten',
        uitleg: 'Daar is hij voor. Jij hebt andere dingen te doen.',
        gevolgen: [
          { kans: 0.5, tekst: 'De trainer regelde het op zijn manier. Gedaan ermee.', effecten: [{ moraalIedereen: 1 }] },
          { tekst: 'De trainer liet het lopen. Het bleef sudderen in de kleedkamer.', effecten: [{ moraalIedereen: -2 }] },
        ],
      },
    ],
  },
  {
    id: 'lokalekrant',
    categorie: 'bestuur',
    wanneer: { alle: [{ meting: 'reputatie', min: 35 }, { vlag: 'match', is: false }] },
    titel: 'De streekkrant wil een reportage',
    tekst: 'Een journalist wil een dubbele pagina over de club maken. Hij vraagt een namiddag van je tijd en toegang tot het complex.',
    keuzes: [
      {
        id: 'meewerken',
        label: 'Volledig meewerken',
        uitleg: 'Een namiddag rondleiden en praten. Zulke stukken blijven lang hangen in de streek.',
        gevolgen: [
          {
            kans: 0.75,
            tekst: 'Een warm stuk over een club die draait op vrijwilligers. Er belden mensen die wilden helpen.',
            effecten: [
              { reputatie: 5 },
              { supporters: { heel: [20, 60] } },
              { vrijwilligers: { heel: [1, 2] } },
              { geschiedenis: 'De streekkrant wijdde een dubbele pagina aan de club.' },
            ],
          },
          {
            tekst: 'Het stuk ging vooral over de put in de parking en het gebrek aan geld. Bedankt, journalist.',
            effecten: [{ reputatie: -2 }],
          },
        ],
      },
      {
        id: 'kort',
        label: 'Alleen een kort gesprek',
        uitleg: 'Een half uur aan de telefoon. Minder risico, minder effect.',
        gevolgen: [{ tekst: 'Een halve kolom met de juiste feiten erin. Niemand blij, niemand boos.', effecten: [{ reputatie: 1 }] }],
      },
    ],
  },
  {
    id: 'jeugdtrainer-weg',
    categorie: 'jeugd',
    wanneer: { alle: [{ meting: 'jeugdploegen', min: 2 }, { vlag: 'match', is: false }] },
    titel: 'Een jeugdtrainer stopt ermee',
    tekst: 'De trainer van een van je jeugdploegen wil er na dit seizoen mee ophouden. Werk, gezin, en te weinig waardering, zegt hij.',
    keuzes: [
      {
        id: 'vergoeding',
        label: 'Een vrijwilligersvergoeding aanbieden ({kost})',
        uitleg: 'Geen loon, wel een blijk van waardering. Werkt vaker dan je denkt.',
        kost: { basis: 1200, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            kans: 0.7,
            tekst: 'Hij blijft. "Het gaat niet om het geld", zei hij, en dat meende hij ook half.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -1200, inflatie: true, afronden: 10 }, reden: 'Vrijwilligersvergoeding jeugdtrainer' },
              { vrijwilligerstrouw: 8 },
            ],
          },
          {
            tekst: 'Hij bedankte voor het aanbod en stopt toch. Je bent hem én het geld kwijt.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -1200, inflatie: true, afronden: 10 }, reden: 'Vrijwilligersvergoeding jeugdtrainer' },
              { vrijwilligers: -1 },
            ],
          },
        ],
      },
      {
        id: 'gesprek',
        label: 'Gewoon eens gaan praten',
        uitleg: 'Een avond bij hem thuis, koffie, luisteren. Kost alleen tijd.',
        gevolgen: [
          { kans: 0.5, tekst: 'Hij blijft toch nog een jaar. Soms is gehoord worden genoeg.', effecten: [{ vrijwilligerstrouw: 5 }] },
          { tekst: 'Hij blijft bij zijn beslissing. Je verliest een goede kracht.', effecten: [{ vrijwilligers: -1 }, { sfeer: -1 }] },
        ],
      },
    ],
  },
  {
    id: 'scout',
    categorie: 'reeks',
    wanneer: { alle: [{ vlag: 'thuis' }, { meting: 'stand', max: 5 }] },
    focusSpeler: 'beste',
    titel: 'Er staat een scout achter het doel',
    tekst: 'Een man met een blocnote kijkt al de hele match naar {speler}. Iemand herkende hem: hij scout voor een club twee reeksen hoger.',
    keuzes: [
      {
        id: 'aanspreken',
        label: 'Hem aanspreken en binnenhalen',
        uitleg: 'Koffie, een plaats in de bestuurskamer, en een gesprek. Contacten in het voetbal zijn geld waard.',
        gevolgen: [
          {
            kans: 0.6,
            tekst: 'Een goed gesprek. Hij komt terug, en dat soort mensen kent nog meer mensen.',
            effecten: [{ reputatie: 3 }, { geschiedenis: 'Een scout van hogerop kwam kijken naar onze spelers.' }],
          },
          {
            tekst: 'Hij was beleefd en hield de boot af. "Ik kijk gewoon een beetje rond."',
            effecten: [{ reputatie: 1 }],
          },
        ],
      },
      {
        id: 'negeren',
        label: 'Hem laten staan',
        uitleg: 'Als hij iets wil, belt hij maar. Jij gaat niet achter een blocnote aanlopen.',
        gevolgen: [{ tekst: 'Hij vertrok bij het laatste fluitsignaal zonder een woord te zeggen.' }],
      },
    ],
  },
  {
    id: 'verwarmingsfactuur',
    categorie: 'infrastructuur',
    wanneer: { alle: [{ vlag: 'winter' }, { meting: 'kas', min: 1 }] },
    titel: 'De energiefactuur is binnen',
    tekst: 'De afrekening van de winter ligt op tafel en ze is fors hoger dan vorig jaar. De installateur zegt dat de leidingen slecht geïsoleerd zijn.',
    keuzes: [
      {
        id: 'isoleren',
        label: 'Laten isoleren ({kost})',
        uitleg: 'Eenmalige kost, en daarna elke winter minder factuur.',
        kost: { basis: 2600, inflatie: true, afronden: 50 },
        gevolgen: [
          {
            tekst: 'De leidingen zitten in het isolatiemateriaal. Vanaf nu scheelt dat elke winter.',
            effecten: [
              { boek: 'infrastructuur', bedrag: { basis: -2600, inflatie: true, afronden: 50 }, reden: 'Isolatie van de leidingen' },
              { verhaalOpenen: { naam: 'nieuwbouw', weken: 20 } },
            ],
          },
        ],
      },
      {
        id: 'zuiniger',
        label: 'De thermostaat lager zetten',
        uitleg: 'Gratis, maar het wordt koud in de kleedkamers en dat merkt iedereen.',
        gevolgen: [
          {
            tekst: 'Twee graden lager. De factuur zakt, en er wordt geklaagd over koude douches.',
            effecten: [
              { boek: 'onderhoud & energie', bedrag: { basis: 400, inflatie: true, afronden: 10 }, reden: 'Besparing op verwarming' },
              { moraalIedereen: -2 },
              { sfeer: -2 },
            ],
          },
        ],
      },
      {
        id: 'betalen',
        label: 'Gewoon betalen',
        uitleg: 'Het is wat het is. Volgende winter zien we wel weer.',
        gevolgen: [{ tekst: 'Je betaalde de factuur zonder er verder iets aan te doen.' }],
      },
    ],
  },
  {
    id: 'bus-supporters',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'uit' }, { meting: 'sfeer', min: 55 }] },
    titel: 'De supporters willen een bus inleggen',
    tekst: 'De supportersclub wil met een bus mee naar {tegenstander}. Ze vragen of de club de helft van de huur betaalt.',
    keuzes: [
      {
        id: 'betalen',
        label: 'De helft betalen ({kost})',
        uitleg: 'Vijftig man van hier op een uitwedstrijd. Dat hoor je in de kleedkamer.',
        kost: { basis: 400, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'De bus zat vol. Vijftig kelen aan de overkant, en een ploeg die dat voelde.',
            effecten: [
              { boek: 'wedstrijdkosten', bedrag: { basis: -400, inflatie: true, afronden: 10 }, reden: 'Bijdrage in de supportersbus' },
              { sfeer: 5 },
              { moraalIedereen: 3 },
            ],
          },
        ],
      },
      {
        id: 'zelf',
        label: 'Ze het zelf laten regelen',
        uitleg: 'Ze hebben een eigen kas. Als ze het echt willen, lukt het wel.',
        gevolgen: [
          { kans: 0.5, tekst: 'Ze legden zelf bij. De bus reed, maar half vol.', effecten: [{ sfeer: 1 }] },
          { tekst: 'De bus ging niet door. "De club doet ook niks voor ons", klonk het aan de toog.', effecten: [{ sfeer: -3 }] },
        ],
      },
    ],
  },
  {
    id: 'trainingskamp',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match', is: false }, { meting: 'kas', min: 20000 }] },
    titel: 'De trainer wil een trainingsweekend',
    tekst: 'Twee dagen weg met de hele groep: trainen, samen eten, samen slapen. De trainer zegt dat het de kleedkamer aan elkaar lijmt.',
    keuzes: [
      {
        id: 'gaan',
        label: 'Op trainingsweekend ({kost})',
        uitleg: 'Duur, maar een groep die samen iets meemaakt, speelt anders.',
        kost: { basis: 3400, inflatie: true, klasse: true, afronden: 50 },
        gevolgen: [
          {
            kans: 0.75,
            tekst: 'Een geslaagd weekend. De groep kwam hechter terug en dat bleef weken hangen.',
            effecten: [
              { boek: 'trainingen', bedrag: { basis: -3400, inflatie: true, klasse: true, afronden: 50 }, reden: 'Trainingsweekend' },
              { moraalIedereen: 9 },
              { vermoeidheidIedereen: 5 },
              { geschiedenis: 'De A-kern ging op trainingsweekend.' },
            ],
          },
          {
            tekst: 'Het regende twee dagen en er werd te veel gedronken. Duur en vermoeiend.',
            effecten: [
              { boek: 'trainingen', bedrag: { basis: -3400, inflatie: true, klasse: true, afronden: 50 }, reden: 'Trainingsweekend' },
              { moraalIedereen: 2 },
              { vermoeidheidIedereen: 12 },
            ],
          },
        ],
      },
      {
        id: 'eten',
        label: 'Alleen samen eten ({kost})',
        uitleg: 'Een avond in de kantine met een traiteur. Een tiende van de prijs, een deel van het effect.',
        kost: { basis: 450, inflatie: true, afronden: 10 },
        gevolgen: [
          {
            tekst: 'Een gezellige avond in de eigen kantine. Geen wonderen, wel een betere sfeer.',
            effecten: [
              { boek: 'trainingen', bedrag: { basis: -450, inflatie: true, afronden: 10 }, reden: 'Teametentje' },
              { moraalIedereen: 4 },
            ],
          },
        ],
      },
      {
        id: 'niet',
        label: 'Niet doen',
        uitleg: 'Er wordt hier gevoetbald, niet op reis gegaan.',
        gevolgen: [{ tekst: 'Geen weekend, geen etentje. De trainer haalde zijn schouders op.' }],
      },
    ],
  },
  {
    id: 'sponsorbord',
    categorie: 'sponsor',
    wanneer: { alle: [{ meting: 'sponsors', min: 2 }, { vlag: 'match', is: false }] },
    titel: 'Een bedrijf wil een bord langs het veld',
    tekst: 'Een zelfstandige uit de gemeente belt: hij wil een reclamebord, maar vraagt of hij in natura mag betalen — in materiaal voor het complex.',
    keuzes: [
      {
        id: 'natura',
        label: 'In natura aanvaarden',
        uitleg: 'Geen geld in de kas, wel spullen die je anders had moeten kopen.',
        gevolgen: [
          {
            tekst: 'Er staan nu nieuwe doelnetten, ballen en een stel verplaatsbare dug-outs. Geen euro over de bank.',
            effecten: [
              { boek: 'onderhoud & energie', bedrag: { basis: 1400, inflatie: true, afronden: 10 }, reden: 'Materiaal van een sponsor in natura' },
              { reputatie: 1 },
            ],
          },
        ],
      },
      {
        id: 'geld',
        label: 'Alleen in geld',
        uitleg: 'Je hebt cash nodig, geen dozen. Misschien haakt hij af.',
        gevolgen: [
          {
            kans: 0.5,
            tekst: 'Hij ging akkoord en betaalde gewoon. Soms moet je het gewoon vragen.',
            effecten: [{ boek: 'sponsors', bedrag: { basis: 1600, inflatie: true, klasse: true, afronden: 50 }, reden: 'Nieuw reclamebord' }],
          },
          { tekst: 'Hij haakte af. "Dan doe ik het bij de tennisclub."', effecten: [{ reputatie: -1 }] },
        ],
      },
    ],
  },
  {
    id: 'wachtlijst-jeugd',
    categorie: 'jeugd',
    wanneer: { alle: [{ meting: 'leden', min: 120 }, { vlag: 'match', is: false }] },
    titel: 'Er staan kinderen op een wachtlijst',
    tekst: 'Er hebben zich meer kinderen aangemeld dan je ploegen aankunnen. De jeugdcoördinator vraagt wat hij tegen de ouders moet zeggen.',
    keuzes: [
      {
        id: 'extra',
        label: 'Een extra reeks openen ({kost})',
        uitleg: 'Meer leden, meer lidgeld — maar ook meer vrijwilligers en veldruimte nodig.',
        kost: { basis: 1800, inflatie: true, afronden: 50 },
        gevolgen: [
          {
            kans: 0.7,
            tekst: 'De extra reeks draait. Blije ouders, meer lidgeld, en een complex dat vol staat.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -1800, inflatie: true, afronden: 50 }, reden: 'Extra jeugdreeks opstarten' },
              { reputatie: 3 },
              { vrijwilligers: 1 },
              { geschiedenis: 'Er kwam een extra jeugdreeks om de wachtlijst weg te werken.' },
            ],
          },
          {
            tekst: 'Je kreeg de ploeg niet bemand. Het geld is uitgegeven en de wachtlijst staat er nog.',
            effecten: [
              { boek: 'opleidingen', bedrag: { basis: -1800, inflatie: true, afronden: 50 }, reden: 'Extra jeugdreeks opstarten' },
              { sfeer: -2 },
            ],
          },
        ],
      },
      {
        id: 'doorverwijzen',
        label: 'Doorverwijzen naar de buurclub',
        uitleg: 'Eerlijk tegen de ouders, maar je geeft wel talent weg aan de buren.',
        gevolgen: [
          {
            tekst: 'Je verwees ze netjes door. De ouders waardeerden de eerlijkheid; de buurclub nog meer.',
            effecten: [{ reputatie: 1 }],
          },
        ],
      },
      {
        id: 'wachten',
        label: 'Laten wachten',
        uitleg: 'Ze staan op de lijst. Volgend seizoen zien we wel.',
        gevolgen: [{ tekst: 'De lijst bleef staan. Een paar ouders schreven hun kind elders in.', effecten: [{ reputatie: -1 }] }],
      },
    ],
  },
  {
    id: 'boete-bond',
    categorie: 'bestuur',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'week', min: 10 }] },
    titel: 'Een brief van de bond',
    tekst: 'De bond stelt vast dat een wedstrijdblad niet correct was ingevuld. Er volgt een boete, tenzij je binnen de week in beroep gaat.',
    keuzes: [
      {
        id: 'beroep',
        label: 'In beroep gaan',
        uitleg: 'Papierwerk en een dossierkost, maar misschien verdwijnt de boete helemaal.',
        gevolgen: [
          {
            kans: 0.45,
            tekst: 'Het beroep werd aanvaard. De boete valt weg, alleen de dossierkost blijft.',
            effecten: [{ boek: 'boetes', bedrag: { basis: -50, inflatie: true, afronden: 10 }, reden: 'Dossierkost beroep' }],
          },
          {
            tekst: 'Het beroep werd afgewezen. Nu betaal je de boete én de dossierkost.',
            effecten: [{ boek: 'boetes', bedrag: { basis: -400, inflatie: true, afronden: 10 }, reden: 'Boete bond en dossierkost' }],
          },
        ],
      },
      {
        id: 'betalen',
        label: 'Gewoon betalen',
        uitleg: 'Geen gedoe. De afgevaardigde krijgt er wel van langs.',
        gevolgen: [
          {
            tekst: 'Betaald en afgehandeld. De afgevaardigde vult voortaan alles twee keer na.',
            effecten: [{ boek: 'boetes', bedrag: { basis: -350, inflatie: true, afronden: 10 }, reden: 'Boete bond (wedstrijdblad)' }],
          },
        ],
      },
    ],
  },
  {
    id: 'oefenmatch',
    categorie: 'wedstrijd',
    wanneer: { alle: [{ vlag: 'match', is: false }, { vlag: 'winterstop', is: false }, { meting: 'week', max: 6 }] },
    titel: 'Een oefenwedstrijd tegen een hogere ploeg',
    tekst: 'Een club uit een hogere reeks zoekt nog een oefenpartij. Het levert volk op en een goede test, maar ook een vermoeide groep.',
    keuzes: [
      {
        id: 'spelen',
        label: 'De oefenmatch aannemen',
        uitleg: 'Volle kantine, een goede test, en spelers die weten waar ze staan.',
        gevolgen: [
          {
            tekst: 'Een nuttige partij voor een goed gevulde kantine. Verloren, maar met eer.',
            effecten: [
              { boek: 'kantine', bedrag: { basis: 1100, inflatie: true, klasse: true, spreiding: [0.8, 1.3], afronden: 10 }, reden: 'Kantine bij de oefenwedstrijd' },
              { vermoeidheidIedereen: 6 },
              { sfeer: 2 },
            ],
          },
        ],
      },
      {
        id: 'bedanken',
        label: 'Bedanken',
        uitleg: 'De groep heeft rust nodig. Geen volk, geen risico.',
        gevolgen: [{ tekst: 'Je bedankte vriendelijk. De spelers kregen een weekend vrij.', effecten: [{ vermoeidheidIedereen: -4 }] }],
      },
    ],
  },
  {
    id: 'kassa-fout',
    categorie: 'kantine',
    wanneer: { alle: [{ vlag: 'match', is: false }, { meting: 'kantineniveau', min: 1 }] },
    titel: 'De kassa klopt niet',
    tekst: 'Al drie weken op rij zit er een verschil tussen de kassa en de voorraad. Niemand beschuldigt iemand, maar iedereen denkt hetzelfde.',
    keuzes: [
      {
        id: 'systeem',
        label: 'Een kassasysteem installeren ({kost})',
        uitleg: 'Alles digitaal geregistreerd. Geen verdenkingen meer, en je ziet eindelijk wat er verkocht wordt.',
        kost: { basis: 1900, inflatie: true, afronden: 50 },
        gevolgen: [
          {
            tekst: 'Het kassasysteem draait. Het verschil verdween meteen, en niemand hoefde iets te zeggen.',
            effecten: [
              { boek: 'infrastructuur', bedrag: { basis: -1900, inflatie: true, afronden: 50 }, reden: 'Kassasysteem kantine' },
              { boek: 'kantine', bedrag: { basis: 300, inflatie: true, afronden: 10 }, reden: 'Minder weglek aan de kassa' },
            ],
          },
        ],
      },
      {
        id: 'praten',
        label: 'Met de kantineploeg praten',
        uitleg: 'Eerlijk en rechtstreeks. Werkt, of het kost je een vrijwilliger.',
        gevolgen: [
          { kans: 0.6, tekst: 'Een ongemakkelijk gesprek, maar het verschil is weg. Niemand vertrokken.', effecten: [{ vrijwilligerstrouw: 2 }] },
          { tekst: 'Een vrijwilliger voelde zich beschuldigd en stopte ermee.', effecten: [{ vrijwilligers: -1 }, { sfeer: -2 }] },
        ],
      },
      {
        id: 'laten',
        label: 'Het laten rusten',
        uitleg: 'Een paar euro per week. Daar ga je geen vrijwilliger voor verliezen.',
        gevolgen: [
          {
            tekst: 'Je liet het rusten. Het verschil bleef, week na week.',
            effecten: [{ boek: 'kantine', bedrag: { basis: -180, inflatie: true, afronden: 10 }, reden: 'Onverklaard verschil in de kassa' }],
          },
        ],
      },
    ],
  },
  {
    id: 'ereburger',
    categorie: 'bestuur',
    wanneer: { alle: [{ meting: 'seizoen', min: 2 }, { meting: 'reputatie', min: 55 }, { vlag: 'match', is: false }] },
    titel: 'De gemeente nodigt je uit',
    tekst: 'Het gemeentebestuur organiseert een receptie voor het verenigingsleven. De schepen van sport wil je graag spreken.',
    keuzes: [
      {
        id: 'gaan',
        label: 'Gaan, en goed voorbereid',
        uitleg: 'Een avond handjes schudden met een dossier onder de arm. Zo werkt het in een gemeente.',
        gevolgen: [
          {
            kans: 0.6,
            tekst: 'De schepen beloofde te kijken naar een extra toelage. Beloftes zijn geen geld, maar het is een begin.',
            effecten: [
              { boek: 'subsidies', bedrag: { basis: 2500, inflatie: true, klasse: true, afronden: 50 }, reden: 'Extra toelage na het gesprek met de schepen' },
              { reputatie: 3 },
            ],
          },
          { tekst: "Veel handen geschud, weinig gezegd. Zo gaat dat op zo'n avond.", effecten: [{ reputatie: 1 }] },
        ],
      },
      {
        id: 'thuis',
        label: 'Niet gaan',
        uitleg: 'Je hebt een club te runnen, geen recepties af te lopen.',
        gevolgen: [{ tekst: 'Je bleef thuis. De stoel met jouw naam erop bleef leeg, en dat viel op.', effecten: [{ reputatie: -2 }] }],
      },
    ],
  },
  {
    id: 'tegenstander-vraagt',
    categorie: 'reeks',
    wanneer: { alle: [{ vlag: 'thuis' }, { meting: 'capaciteit', min: 300 }] },
    titel: '{tegenstander} vraagt een gunst',
    tekst: 'Bij {tegenstander} ligt het veld onder water. Ze vragen of ze hun volgende thuismatch op jouw complex mogen spelen.',
    keuzes: [
      {
        id: 'helpen',
        label: 'Ze helpen',
        uitleg: 'Jouw kantine draait op hun wedstrijd, en zulke gunsten komen terug.',
        gevolgen: [
          {
            tekst: 'Hun match werd bij jou gespeeld. Jouw kantine draaide, en {tegenstander} vergeet dat niet.',
            effecten: [
              { boek: 'kantine', bedrag: { basis: 850, inflatie: true, spreiding: [0.8, 1.3], afronden: 10 }, reden: 'Kantine bij een geleende thuiswedstrijd' },
              { boek: 'verhuur', bedrag: { basis: 400, inflatie: true, afronden: 10 }, reden: 'Verhuur van het complex' },
              { reputatie: 2 },
            ],
          },
        ],
      },
      {
        id: 'slijtage',
        label: 'Weigeren: je veld is geen verhuurbedrijf',
        uitleg: 'Twee wedstrijden op één weekend sloopt je grasmat, zeker in de winter.',
        gevolgen: [{ tekst: 'Je hield de poort dicht. Bij {tegenstander} zullen ze dat onthouden.', effecten: [{ reputatie: -1 }] }],
      },
    ],
  },
  {
    id: 'doelman-twijfel',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'spelers', min: 15 }] },
    focusSpeler: 'jongste',
    titel: 'De jonge doelman wil zijn kans',
    tekst: '{speler} traint al maanden mee zonder ooit te spelen. Hij vraagt of hij zondag mag staan, en de keeperstrainer vindt dat hij er klaar voor is.',
    keuzes: [
      {
        id: 'kans',
        label: 'Hem laten spelen',
        uitleg: 'Ervaring opdoen kan alleen op het veld. Het kan geweldig gaan of pijnlijk worden.',
        gevolgen: [
          {
            kans: 0.55,
            tekst: '{speler} speelde een sterke partij. De hele bank stond recht bij zijn eerste redding.',
            effecten: [{ speler: 'focus', moraal: 15 }, { moraalIedereen: 2 }, { sfeer: 2 }],
          },
          {
            tekst: 'Het werd een lastige middag voor {speler}. Hij groeide er niet van.',
            effecten: [{ speler: 'focus', moraal: -8 }, { sfeer: -2 }],
          },
        ],
      },
      {
        id: 'wachten',
        label: 'Nog even laten wachten',
        uitleg: 'Zijn tijd komt wel. Ondertussen blijft hij trainen.',
        gevolgen: [{ tekst: 'Je liet hem nog even wachten. Hij knikte, maar de teleurstelling stond op zijn gezicht.', effecten: [{ speler: 'focus', moraal: -3 }] }],
      },
    ],
  },
  {
    id: 'shirtsponsor-logo',
    categorie: 'sponsor',
    wanneer: { alle: [{ meting: 'sponsors', min: 3 }, { vlag: 'match', is: false }] },
    focusSponsor: 'grootste',
    titel: 'Het logo van {sponsor} moet groter',
    tekst: '{sponsor} vindt zijn logo op het shirt te klein. Hij wil het dubbel zo groot, of hij overweegt zijn bijdrage te herbekijken.',
    keuzes: [
      {
        id: 'nieuwe-shirts',
        label: 'Nieuwe shirts laten maken ({kost})',
        uitleg: 'Hij krijgt zijn zin en betaalt meer. De supporters vinden het lelijk.',
        kost: { basis: 1500, inflatie: true, klasse: true, afronden: 50 },
        gevolgen: [
          {
            tekst: 'Nieuwe shirts met een logo dat je van de overkant kunt lezen. {sponsor} betaalt meer, de supporters mopperen.',
            effecten: [
              { boek: 'clubartikelen', bedrag: { basis: -1500, inflatie: true, klasse: true, afronden: 50 }, reden: 'Nieuwe shirts met groter sponsorlogo' },
              { boek: 'sponsors', bedrag: { basis: 2400, inflatie: true, klasse: true, afronden: 50 }, reden: 'Hogere bijdrage voor meer zichtbaarheid' },
              { sponsor: 'grootste', tevredenheid: 14 },
              { sfeer: -2 },
            ],
          },
        ],
      },
      {
        id: 'volgend',
        label: 'Beloven dat het volgend seizoen gebeurt',
        uitleg: 'Je wint tijd zonder nu te betalen. Maar hij onthoudt het.',
        gevolgen: [
          {
            tekst: 'Hij ging akkoord, op voorwaarde dat het er volgend jaar écht staat.',
            effecten: [{ sponsor: 'grootste', tevredenheid: 3 }],
          },
        ],
      },
    ],
  },
  {
    id: 'verloren-reeks',
    categorie: 'kleedkamer',
    wanneer: { alle: [{ vlag: 'match' }, { meting: 'stand', min: 11 }, { meting: 'week', min: 14 }] },
    titel: 'De kop hangt naar beneden',
    tekst: 'Je staat onderaan en dat is in alles te voelen. De trainer vraagt wat het bestuur van plan is.',
    keuzes: [
      {
        id: 'steun',
        label: 'Publiek achter de trainer gaan staan',
        uitleg: 'Rust brengen. Dat werkt vaak, en het kost niets.',
        gevolgen: [
          { kans: 0.6, tekst: 'Je sprak je vertrouwen uit. De groep ademde zichtbaar uit.', effecten: [{ moraalIedereen: 6 }, { sfeer: 2 }] },
          { tekst: 'Je steunbetuiging werd gelezen als een doodvonnis. Zo gaat dat in het voetbal.', effecten: [{ moraalIedereen: -2 }] },
        ],
      },
      {
        id: 'premie',
        label: 'Een overwinningspremie uitloven ({kost})',
        uitleg: 'Geld voor punten. Werkt soms als een zweep, soms helemaal niet.',
        kost: { basis: 1100, inflatie: true, klasse: true, afronden: 50 },
        gevolgen: [
          {
            kans: 0.5,
            tekst: 'De premie deed iets. Er werd gelopen alsof het de laatste match was.',
            effecten: [
              { boek: 'lonen spelers', bedrag: { basis: -1100, inflatie: true, klasse: true, afronden: 50 }, reden: 'Overwinningspremie' },
              { moraalIedereen: 8 },
            ],
          },
          {
            tekst: 'Het geld werd aangenomen en er veranderde niets. Een dure les.',
            effecten: [
              { boek: 'lonen spelers', bedrag: { basis: -1100, inflatie: true, klasse: true, afronden: 50 }, reden: 'Overwinningspremie' },
              { moraalIedereen: 1 },
            ],
          },
        ],
      },
      {
        id: 'zwijgen',
        label: 'Er niets over zeggen',
        uitleg: 'Het bestuur hoort zich niet met de kleedkamer te bemoeien.',
        gevolgen: [{ tekst: 'Je zei niets. In de kleedkamer werd dat opgemerkt, en niet in je voordeel.', effecten: [{ moraalIedereen: -2 }] }],
      },
    ],
  },
];

MOMENTS.push(...MORE_MOMENTS);
