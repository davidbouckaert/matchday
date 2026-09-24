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
        de clubwinkel draait ook tussendoor. Evenementen brengen in één klap iets op, maar het geld komt pas een paar weken later.
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
      a: 'Bij Personeel kies je per taak wie ze doet. Een personeelslid beslist dan elke week zelf. Zijn eigen vakgebied doet hij op vol niveau, een taak die er naast ligt met minder kennis. Hoe beter hij is, hoe meer taken hij aankan (1 tot 4).',
    },
    {
      q: 'Hoe ontwikkelen mijn spelers zich?',
      a: 'Om de 4 weken. Jong = veel groei (17 jaar is maximaal, vanaf 31 groeit niemand nog), veel spelen helpt, minstens 3 trainingen per week ook. Wie op de bank zit, gaat er vanaf zijn 26ste op achteruit.',
    },
    {
      q: 'Hoe werkt mijn jeugdwerking?',
      a: `Je club start met een paar jeugdploegen (U7 tot U17). Elke ploeg telt ongeveer 55 leden en bindt <strong>2 vrijwilligers</strong>:
        een jeugdtrainer en een ploegafgevaardigde. Die kun je niet meer voor een evenement inzetten — bij Club › Evenementen zie je hoeveel er nog vrij zijn.
        Bij de inschrijvingen (week 10) komt er een ploeg bij of gaat er een weg, één per seizoen. Hoeveel ploegen je complex aankan hangt af van kunstgras,
        verlichting en je opleidingscentrum; zit je aan dat plafond, dan haken ouders af. Meer ploegen = meer lidgeld, meer subsidie en meer doorstroming,
        maar ook meer werkingskosten en meer volk dat je moet vinden.`,
    },
    {
      q: 'Waarom kan ik die personeelslid niet aanwerven?',
      a: 'Sommige functies hebben eerst infrastructuur of een werking nodig: een kinesist een recuperatieruimte, een data-analist wifi, een kantineverantwoordelijke een kantine van niveau 2, een jeugdcoördinator minstens 3 jeugdploegen. Je ziet de reden bij de kandidaat.',
    },
    {
      q: 'Wat gebeurt er met een speler die ik uitleen?',
      a: `Hij speelt een seizoen bij een echte club uit de wereld, en die club kiest het spel voor je: eentje waar hij in de ploeg past en waar de jeugdwerking iets voorstelt.
        Daar groeit hij mee met hún trainer en hún werking, en met hoeveel hij er speelt. Bij een club die een maat te groot is, zit hij daar ook op de bank en levert het seizoen
        vrijwel niets op; bij een club op zijn maat speelt hij bijna elke week en komt hij drie tot vijf punten sterker terug. Terwijl hij weg is, zie je bij Ploeg › Transfers
        hoeveel wedstrijden hij speelde en hoeveel hij vooruitging, en bij zijn terugkeer staat het in het nieuws.`,
    },
    {
      q: 'Kan ik een huurspeler houden?',
      a: `Ja, maar zij beslissen. Vanaf week 26 staat bij Ploeg › Transfers een blok "Je huurspelers" met twee mogelijkheden: nog een seizoen huren, of hem definitief kopen.
        Jij vult in wat je biedt en ziet meteen hoe groot de kans is dat ze ja zeggen; die kans beweegt mee terwijl je aan het bedrag draait. Waar ze naar kijken: hoeveel hij bij jou
        speelde, hoeveel hij erop vooruitging, en je bod. Dat werkt twee kanten op. Liet je hem elke week spelen en werd hij beter, dan verlengen ze graag — maar verkopen doen ze dan
        juist niet graag, en duur. Zat hij op de bank, dan willen ze hem terug voor een andere uitleenbeurt, maar kopen lukt dan veel makkelijker. Je hoort het antwoord een week later.
        Zeggen ze nee, dan kun je het vier weken later opnieuw proberen, met een ander bedrag.`,
    },
    {
      q: 'Hoeveel mag ik voor een sponsorplaats vragen?',
      a: `Dat beslis jij, op je prijskaart bij Geld › Sponsors. Bij elke plaats staat wat gangbaar is bij een club als de jouwe, en zet je er een ander bedrag in,
        dan zie je meteen wat bedrijven ervan vinden. Vraag je minder, dan tekenen er meer maar brengt elk contract minder op; vraag je meer, dan is het net omgekeerd.
        Ergens daartussen ligt je beste prijs, en hoe hoger die ligt hangt af van hoe graag bedrijven bij je club willen horen: je reputatie, de sfeer, je populariteit,
        je reeks en je commercieel medewerker. Een club zonder naam kan niets extra vragen; een club met een naam ongeveer driekwart meer. In de contactenlijst staat per
        bedrijf hoe groot de kans is dat het ja zegt op jouw prijs. Doe je niets, dan volgt elke plaats gewoon het gangbare bedrag.`,
    },
    {
      q: 'Waarom krijg ik geen sponsor van een bepaald type?',
      a: 'Elke plaats bestaat maar een beperkt aantal keer, en sommige moet je eerst verdienen: schermen vragen een goede kantine, de ploegbussponsor een eigen bus, de evenementensponsor een georganiseerd evenement. Bij Sponsors staat per plaats hoeveel er vrij zijn en waarom ze eventueel op slot staan.',
    },
    {
      q: 'Wat levert promotie op?',
      a: `Alles schaalt mee: het supportersplafond, de normale ticketprijs, de sponsorbedragen voor nieuwe contracten, de tv-rechten en de richtprijzen in de clubwinkel.
        Je bestaande sponsors blijven op hun oude bedrag, maar ze zijn na promotie een pak tevredener: de besten bieden spontaan een hoger contract aan en een extra bijdrage vragen lukt vaker.
        Er is ook een premie, die je op het einde van het seizoen apart geboekt ziet staan onder <strong>premies</strong> (in het weekrapport, bij Geld › Cijfers en in je clubgeschiedenis).
        Voetbal Vlaanderland betaalt in de amateurreeksen géén prijzengeld: wat je krijgt zijn premies van je sponsors, een kampioenenreceptie en een tombola.
        1ste Provinciale €2.000 (plaats 2: €1.000), 3de Nationale €4.500 (€2.500), 2de Nationale €7.000 (€4.000), 1ste Nationale €40.000 (€25.000), Challenger Pro Liga €160.000 (€95.000).
        Daar staat tegenover dat spelers ongeveer 14% en personeel 10% meer vragen, en dat de aansluiting bij de bond en de verzekeringen duurder worden.`,
    },
    {
      q: 'Wat is die persconferentie in week 1?',
      a: `Elk seizoen begint met een opening: de pers voorspelt waar je eindigt, je ziet wie er uit de jeugd doorstroomt, het bestuur legt drie doelen op tafel
        (één per categorie van je clubscore) en jij spreekt je ambitie uit. Die keuze is meteen voelbaar — supporters, spelers en sponsors reageren erop —
        en op het einde van het seizoen word je erop afgerekend: waarmaken levert een premie op, grootspraak die niet lukt kost geld én reputatie.
        De drie doelen van het bestuur staan het hele seizoen op je overzicht, met hoever je staat.`,
    },
    {
      q: 'Hoe sterk zijn mijn tegenstanders?',
      a: `Elke reeks ligt duidelijk boven de vorige: de zwakste ploeg van 2de nationale is nog altijd steviger dan de zwakste van 3de.
        Binnen een reeks zijn de net gepromoveerde clubs het zwakst en de net gedegradeerde het sterkst — en als jij promoveert, hoor je zelf bij de zwakste.
        Bij Ploeg › Selectie zie je je teamsterkte tegenover de gemiddelde tegenstander van je reeks.`,
    },
    {
      q: 'Wie scoort er in mijn ploeg?',
      a: `Elk doelpunt krijgt een maker en een minuut. Aanvallers scoren het vaakst, middenvelders geregeld, verdedigers af en toe;
        binnen een linie scoort de betere speler meer, en je strafschopnemer krijgt een duwtje. Je ziet het in het weekrapport
        (met de volledige opstelling eronder) en in de kolom Goals bij Ploeg › Selectie.`,
    },
    {
      q: 'Welke investeerder kies ik het best?',
      a: `Dat hangt af van hoe je wilt spelen, niet van wie het meeste geeft. Het fonds zet €600.000 op tafel in week één — veruit het meeste,
        en meteen bruikbaar voor spelers of een tribune. Maar er hangt een klok aan: promoveer je niet om de drie seizoenen, dan trekt het
        €300.000 terug en stapt het op. Bovendien gaat 30% van elke transferwinst en 20% van je prijzengeld naar hen, en bij een stevig bod
        op een jonge speler tekenen zij zonder het je te vragen. De aannemer geeft €150.000, maar zijn stadionnaam groeit mee met je reeks
        (€600/week in 3de nationale, €2.400 in de Challenger Pro Liga), bouwwerken kosten 15% minder en zijn een kwart sneller klaar, en je
        mag drie werven tegelijk open hebben. Wie bouwt en klimt, haalt daar over zes seizoenen meer uit dan het fonds geeft. De coöperatie
        geeft maar €60.000, maar je kunt elk seizoen een ledenronde houden die groeit met je supporters, je reputatie en de sfeer: bij een
        club die goed draait loopt dat op tot boven de €400.000 over zes seizoenen, bij een club die stilstaat blijft het onder de €110.000.
        Ruw samengevat: het fonds geeft je nú geld en een deadline, de aannemer beloont bouwen, de coöperatie beloont goed besturen.`,
    },
    {
      q: 'Wat zijn abonnementen en wanneer verkoop ik ze?',
      a: `Voor de competitie start (tot en met week 6) kun je op Geld › Financiën één keer een abonnementencampagne voeren. Je kiest de prijs,
        het geld komt meteen binnen, en die mensen betalen de rest van het seizoen niet meer aan de kassa — ook niet als je je ticketprijs verhoogt,
        en ook niet als ze door de regen thuisblijven. Het is de enige beslissing die je een heel jaar vastzet: geld nu tegenover inkomsten later.
        Verkoop je er veel en loopt het seizoen goed, dan had je aan de kassa meer verdiend. Loopt het slecht of regent het vaak, dan was het
        de juiste keuze. Volgend seizoen beslis je opnieuw.`,
    },
    {
      q: 'Waarom kan ik bij een sponsor kiezen hoelang ik teken?',
      a: `Omdat het een echte afweging is. Eén seizoen betaalt het basisbedrag en laat je volgend jaar opnieuw onderhandelen — handig als je
        promoveert, want dan kun je meteen meer vragen. Twee seizoenen levert 8% meer per week op, drie seizoenen 15%, maar dan zit je eraan vast:
        een contract van meerdere jaren schuift níét mee omhoog als je promoveert. Zekerheid tegenover opwaarts potentieel, en dat beslis je
        op het moment dat je tekent.`,
    },
    {
      q: 'Waarom zakte mijn kantine-omzet deze week?',
      a: `Kijk op Geld › Financiën bij "Waar kwam het vandaan". Voor de grootste posten van de laatste week staat daar per factor wat hij je
        opleverde of kostte. Een regel als "Sfeer ×0,81 −€1.562" betekent: zonder die lage sfeer had je €1.562 méér gehad. Zo zie je of het
        aan het weer lag, aan de opkomst, aan je prijzen of aan te weinig vrijwilligers. Het zijn exact dezelfde factoren waarmee de formule
        rekent, dus wat je hier leest is wat er echt gebeurd is.`,
    },
    {
      q: 'Kan ik zien wat er financieel op me afkomt?',
      a: `Ja. Bovenaan Geld › Financiën staat een vooruitblik van maximaal acht weken: de lonen, het onderhoud, de sponsorcontracten,
        de aflossingen, de vaste momenten van het jaar zoals de bondsbijdrage en de lidgelden, en per wedstrijd een raming van de kassa
        en de kantine. Bij een bedrag dat we schatten, staat dat erbij. Onderaan elke week zie je wat er daarna in kas zit; zou je ergens onder nul duiken,
        dan staat dat als waarschuwing bovenaan.`,
    },
    {
      q: 'Moet ik elke rustige week apart doorklikken?',
      a: `Nee. Naast "Volgende week" staat "Tot de volgende match". Die speelt de rustige weken achter elkaar — de voorbereiding,
        de winterstop, de weken na de laatste speeldag — en stopt vlak voor de volgende wedstrijd. Er wordt nooit iets voor je beslist:
        hij stopt ook zodra er een weekmoment op je bureau ligt, je basiself niet rond is, je saldo onder nul duikt of een nieuw seizoen begint.
        Daarna krijg je één venster met wat er ondertussen gebeurde. Hoeveel stappen je per keer zet, bepaal je dus helemaal zelf.`,
    },
    {
      q: 'Wat doen de andere clubs in mijn reeks?',
      a: `Hetzelfde als jij, maar in het kort. Elke club heeft een eigen budget, ambitie, momentum, accommodatie en jeugdwerking, en neemt
        één keer per zomer één beslissing: versterken, bouwen, de jeugd uitbreiden, besparen, of in het slechtste geval de boeken neerleggen.
        Die beslissing hangt af van waar ze eindigden, hoeveel geld ze hebben en hoe graag ze hogerop willen. Je leest het in het nieuws van de zomer
        en je ziet het op Competitie: sterkte, ambitie, werking en wat ze vorige zomer deden. Wie vorig jaar investeerde, is dit jaar lastiger.
        Promotie en degradatie gebeuren ook in de reeksen waar jij niet speelt, dus de wereld beweegt met of zonder jou.`,
    },
    {
      q: 'Waarom komt er soms iets terug dat ik eerder besliste?',
      a: `Omdat sommige gebeurtenissen blijven nawerken. Verkoop je een speler, dan kom je hem later tegen in het truitje van zijn nieuwe club.
        Laat je een boze hoofdsponsor aan zijn lot over, dan ligt er weken later een aangetekende brief. Rond je een bouwproject af,
        dan komt de streekkrant langs. En sta je een tijd in het rood, dan worden sponsors en vrijwilligers nerveus, ook nadat je saldo weer klopt.
        Wat de moeite is om te onthouden, komt in je clubkroniek te staan: Club › Museum.`,
    },
    {
      q: 'Wat is dat langetermijndoel op mijn overzicht?',
      a: `Eén doel voor je hele carrière, dat je in het begin één keer vastlegt: een bepaalde reeks halen, een half miljoen op de rekening,
        een stadion van tweeduizend plaatsen, acht jeugdploegen, of een combinatie. Het verandert niets aan de regels — het geeft je partij een richting,
        en je ziet elke week hoever je staat. Haal je het, dan krijg je een melding, een regel in je clubkroniek en een banner in je museum.`,
    },
    {
      q: 'Wat betekent mijn niveau als eigenaar?',
      a: `Vijf niveaus, van Nieuwkomer tot Clubicoon. Punten verdien je met elk afgewerkt seizoen, met promoties en titels, met mijlpalen,
        met een seizoen in de plus en met je langetermijndoel. Elk niveau opent één concreet voordeel: een half procent minder rente op nieuwe leningen,
        een derde bouwproject tegelijk, een extra prospect uit elke sponsorcampagne, en een kwart meer gemeentesubsidie.
        Geen enkel niveau zet iets achter slot — wat je op dag één kon, kan je altijd. Wat het volgende niveau oplevert, staat op je overzicht.`,
    },
    {
      q: 'Wat is het weekmoment op mijn bureau?',
      a: `Elke week ligt er iets op je bureau dat nu beslist moet worden: het regent al drie dagen, de bus is defect, je hoofdsponsor komt kijken.
        Het verschijnt als een venster zodra je het weekrapport sluit: twee of drie knoppen, en meteen daarna lees je in hetzelfde venster wat je keuze opleverde.
        Wil je eerst rondkijken, klik dan op "Later beslissen"; op je overzicht blijft een kader staan met een knop om alsnog te beslissen.
        Doe je niets voor je op "Volgende week" drukt, dan gaat de laatste optie door — niet beslissen is ook beslissen.
        Dezelfde situatie komt minstens 12 weken lang niet opnieuw.`,
    },
    {
      q: 'Schalen mijn evenementen mee als ik promoveer?',
      a: `Ja. De opbrengst hangt af van je supporters, je jeugdleden, je sponsorbedragen en je tribune — die groeien allemaal mee — en wordt bovendien
        met de inflatie vermenigvuldigd. De kosten volgen dezelfde weg: de inflatie plus 12% per reeks, want een tent, een band en een traiteur
        kosten in 1ste nationale meer dan in provinciale. Bovendien komen er in hogere reeksen nieuwe evenementen bij: een sponsorontbijt en een galabal
        vanaf 2de nationale, een gala-oefenwedstrijd tegen een profclub en een businessclub-lunch vanaf 1ste nationale, en een internationaal
        wintertornooi vanaf de Challenger Pro Liga. Die vragen wel een betere kantine of een grotere tribune.`,
    },
    {
      q: 'Wat is mijn aartsrivaal?',
      a: `Eén club in je reeks is je derby. Die twee wedstrijden per seizoen trekken 75% meer volk, leveren meer kaarten op en wegen dubbel
        op de sfeer in het dorp. De onderlinge balans blijft bij, ook over seizoenen heen, en staat in je clubmuseum. Blijf je in dezelfde reeks,
        dan blijft hij je rivaal; promoveer of degradeer je, dan is er een kans dat hij dezelfde weg aflegde.`,
    },
    {
      q: 'Wat gebeurt er als ik niets doe?',
      a: `Een club die stilstaat, gaat achteruit. Beslis je tien weken lang niets — geen sponsor aangesproken, niets georganiseerd, gebouwd of uitbesteed —
        dan zakken je sfeer, je reputatie en de tevredenheid van je sponsors langzaam weg, tot het niveau van een slapende club. Je krijgt er een bericht over.
        Eén beslissing zet die klok weer op nul.`,
    },
    {
      q: 'Hoe stel ik mijn basiself samen?',
      a: `Elke speler heeft twee knopjes. Met de <strong>ster</strong> zet je hem vast in de basis (★); klik nog eens en je trainer kiest weer zelf.
        Met het <strong>stoeltje</strong> hou je hem deze week op de bank (⛔) — dan wordt hij niet opgesteld, ook niet door je trainer.
        Een ✓ betekent: je trainer koos hem. Zet je iemand vast terwijl die linie al vol staat met vastgezette spelers, dan maakt de zwakste van hen plaats.
        Haal je iemand <strong>uit je basiself</strong>, dan blijft die plaats leeg — je trainer schuift er niemand in. Zolang er een plaats openstaat,
        kun je niet naar de volgende week: duid zelf iemand aan met de ster, maak de speler weer beschikbaar, of klik op "Alles loslaten".
        Boven de tabellen zie je per linie hoeveel plaatsen je formatie vraagt en hoeveel er ingevuld zijn (1/1 doel, 4/4 verdediging …).
        Spelers springen meteen naar de juiste tabel: basiself, bank of niet beschikbaar. Elke tabel kun je in- en uitklappen; de bank staat standaard dicht.`,
    },
    {
      q: 'Hoe werken bouwprojecten?',
      a: `Er mogen <strong>twee werven tegelijk</strong> lopen. Je betaalt meteen, de werken duren een aantal weken en het resultaat telt pas mee als ze klaar zijn.
        Bij de tribune kies je zelf hoeveel plaatsen erbij komen (100 tot 2.000): hoe groter je bestelt, hoe goedkoper per zitje, en die korting versnelt: van ongeveer €450 per plaats bij 100
        naar ongeveer €215 bij 2.000 (ruim de helft goedkoper) — maar hoe langer de werken duren (4 tot 22 weken). Ook de zonnepanelen zijn een bouwproject van 5 weken.`,
    },
    {
      q: 'Wat gebeurt er als ik in het rood ga?',
      a: 'Je krijgt waarschuwingen en soms een noodlening. Blijf je 8 weken onder nul, dan is de club failliet en is het spel afgelopen.',
    },
    {
      q: 'Hoe verloopt een seizoen?',
      a: `Een seizoen is 52 weken. De competitie loopt van week ${MATCH_WEEKS[0]} tot ${MATCH_WEEKS[MATCH_WEEKS.length - 1]}, met een winterstop ertussen.
        In week ${SEASON_END_WEEK} vallen de beslissingen over promotie en degradatie. De volledige agenda staat bij Bureau › Agenda.`,
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
      <h3>Waar vind ik wat?</h3>
      <ul class="where small">
        <li><strong>Bureau</strong><span>Wat deze week op je wacht, je saldo en prognose, waar het geld heen ging, je volgende wedstrijd, en hoe je ervoor staat bij publiek en sponsors. Daarnaast de Agenda: alle 52 weken met transferperiodes, uitbetalingen en vaste momenten.</span></li>
        <li><strong>Ploeg</strong><span>Selectie (het veld en je kern), Strategie (training, tactiek, spelplannen), Transfers en Contracten.</span></li>
        <li><strong>Personeel</strong><span>Aanwerven en opleiden, en in één tabel per taak kiezen wie ze doet. Datzelfde keuzevak staat ook bovenaan elk taakscherm.</span></li>
        <li><strong>Geld</strong><span>Financiën (prognose, posten, herkomst, leningen), <strong>Tickets en lidgeld</strong> (de drie prijzen die je zelf zet: je ticketprijs, je abonnementen en het lidgeld van de jeugd), Sponsors (je prijskaart per plaats, wie er tekent en welke bedrijven je kunt benaderen) en Cijfers.</span></li>
        <li><strong>Club</strong><span>Infrastructuur, Horeca (de prijzen aan de toog), Clubwinkel, Evenementen, Doelen (je langetermijndoel en het logboek), Museum en Clubinfo.</span></li>
        <li><strong>Competitie</strong><span>De stand, jouw wedstrijden met hun uitslag, de clubs in je reeks en de tuchtzaken.</span></li>
        <li><strong>Menu ☰</strong><span>Deze handleiding, "Wat beïnvloedt wat" met elke vermenigvuldiger die nu meespeelt, en opslaan en instellingen.</span></li>
      </ul>
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
