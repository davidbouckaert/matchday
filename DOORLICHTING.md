# Opdracht: doorlichting van de motor

*Een briefing voor een frisse doorlichting van de rekenkern, los van wie hem gebouwd heeft.*

## Waarom dit gevraagd wordt

De motor is in zeventien lagen gegroeid, elke laag met zijn eigen meting. Dat werkt voor wat
binnen één laag zit, maar niet voor wat tussen lagen ontstaat. Het bewijs staat in 0.42.0: de
hele inkomstenkant bleek geïndexeerd op de reeks waarin je speelt — sponsorbedragen ×0,6 tot
×8, tv-geld van niets tot €30.000 per week, publiek van 250 tot 10.000 — terwijl er op de
kostenkant niets geïndexeerd stond. Elke promotie was daardoor gratis geld. Geen enkele laag
had dat fout gedaan; het ontstond doordat niemand de twee kanten ooit náást elkaar had gelegd.
En het werd bij toeval gevonden, tijdens het zoeken naar iets anders.

Wie de lagen gebouwd heeft, is slecht geplaatst om ze door te lichten: die leidt zijn eigen
aannames opnieuw af. Vandaar deze opdracht aan iemand zonder aandeel erin.

## Wat we willen weten

De hoofdvraag is niet "staan er fouten in" maar **"zijn er nog van zulke asymmetrieën, en waar
compoundeert er iets zonder rem?"**

Concreet, in volgorde van belang:

1. **Terugkoppellussen.** Welke grootheden voeden zichzelf? Populariteit → sponsorgeld → betere
   spelers → winnen → populariteit is de vermoede hoofdlus. Waar zit de rem, en is die sterk
   genoeg? Noem elke lus die je vindt, met de functies erin.
2. **Wat schaalt met wat.** Maak de tabel die nooit gemaakt is: welke grootheden hangen aan je
   reeks, welke aan je populariteit, welke aan inflatie, en welke aan niets. Een grootheid die
   aan niets hangt terwijl zijn tegenhanger wel meeschaalt, is precies de fout van 0.42.0.
3. **Dominante strategieën.** Is er een speelwijze die zo veel beter is dat de rest er niet toe
   doet? En omgekeerd: is er een keuze die het spel aanbiedt maar die nooit de moeite is?
4. **Dode knoppen.** Instellingen waar de speler aan kan draaien zonder meetbaar gevolg. Er is
   er al één zo gevonden: de sponsorvraagprijs was aanvankelijk een rechte lijn, en dan is
   kans × prijs voor élke club precies op de gangbare prijs het hoogst — over een heel seizoen
   scheelde draaien minder dan een procent. Dat soort knop.
5. **De open knoop.** "De beste betaalbare staf aanwerven en dan doorklikken" gaat 0 op 48
   failliet, waar de afspraak ~2 op 20 is. Zie `HANDOVER.md` voor wat al geprobeerd is. Zoek de
   oorzaak op systeemniveau, niet door een getal bij te stellen.

## Wat het moet opleveren

Bevindingen met **de functie erbij en, waar mogelijk, een meting die ze aantoont**. Een
bewering zonder meting is in dit project geen bevinding — er staan in de README meerdere van
mijn eigen conclusies die door een meting onderuitgehaald zijn, en dat is de standaard.

Geen herschrijfvoorstellen en geen patches. Een diagnose is nuttiger dan een oplossing: welke
verhoudingen kloppen niet, en waarom.

## Wat je moet weten voor je begint

- **`README.md`** is een ontwerplogboek per laag, met het waarom en de metingen. Begin daar, en
  vooral bij de lagen over economie, sponsors en delegeren.
- **`HANDOVER.md`** vat de open draden samen.
- **`src/engine/`** is DOM-vrij en deterministisch: een geseede RNG in `state.rngState`, en
  `advanceWeek(state)` geeft een nieuwe state terug. Alles is dus herhaalbaar te meten.
- **Twee ontwerpregels** die niet ter discussie staan: dit is een spel over een **eigenaar**,
  niet over een trainer (geen fijnmazig spelersbeheer), en de taal mikt op spelers vanaf tien
  jaar zonder kinderlijk te worden.
- **Er is bewust geen "realistisch" ijkpunt.** Het gaat om een spel dat klopt met zichzelf en
  interessante keuzes oplevert, niet om een simulatie van de Belgische voetbaleconomie.

## Gereedschap dat er al ligt

```
npm run autopilot    is uitbesteden risicoloos? SEEDS=20 voor de afgesproken lat
npm run economie     inkomsten en kosten per seizoen, naast de reeks waarin je speelt
npm run balance      niets doen: gaat elke partij failliet?
npm test             678 tests, ook als beschrijving van bedoeld gedrag
VCG_LOG=debug ...    het logboek van de rekenkern naar logs/*.log en de terminal
```

Eigen meetscripts bijschrijven mag en is aan te raden: ze horen in `scripts/`, met bovenaan in
gewone taal waaróm ze bestaan en wat de meting aantoonde. Dat is hier de vorm.

**Let op bij het meten.** Twee vallen waar dit project al in gelopen is. Een meetvenster van
drie seizoenen verborg dat niets-doen pas in seizoen vier of vijf omvalt — meet lang genoeg.
En een bot die geen spelers koopt terwijl hij onder de harde ondergrens van achttien zakt, meet
een club die in het echte spel niet eens verder kan klikken.
