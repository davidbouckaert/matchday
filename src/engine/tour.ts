// De rondleiding: leer een nieuwe eigenaar het spel kennen, hoofdstuk per hoofdstuk.
//
// Er stonden twee begeleidingssystemen op het Bureau: "Eerste stappen" (een checklist van
// tien punten die je op dag één voor je kiezen kreeg) en "Deze week" (de echte werklijst).
// Dat overdondert precies de speler die het wil helpen, en wie iets oversloeg — het
// lidgeld, bijvoorbeeld — werd daar stilletjes voor gestraft zonder ooit te horen dat
// het bestond.
//
// Nu is er één rondleiding, in hoofdstukken. Elk hoofdstuk bundelt de stappen van één
// thema (eerst je ploeg, dan de markt, dan je mensen, dan het geld, dan de clubzaken,
// dan vooruitkijken), zodat je nooit van je opstelling naar je ticketprijs en weer terug
// springt. Eén hoofdstuk tegelijk, rustig onderin de weekkaart:
//
//  - een stap vinkt zichzelf af op wat er echt in het spel gebeurde, niet op wat je
//    aanklikte — wie iets al deed vóór de rondleiding erover begon, is het gewoon kwijt;
//  - sommige stappen vragen alleen dat je ergens gaat kíjken (het prijzenscherm, de
//    bouwplannen): die vinken af zodra je het scherm bezoekt;
//  - een hoofdstuk waarvan alles af is maakt de week erna plaats voor het volgende;
//  - een hoofdstuk dat blijft liggen schuift na drie weken vanzelf zachtjes door.
//    Niets doen kost je niets — de rondleiding is hulp, geen huiswerk.

import type { GameState } from './types';
import { TASKS, canteenDef } from './data/catalog';
import { delegate } from './delegation';
import { isTransferWindow } from './calendar';

export interface TourState {
  /** Index in TOUR_CHAPTERS; voorbij het einde = rondleiding klaar. */
  chapter: number;
  /** Hoeveel weken het huidige hoofdstuk al openstaat (voor de zachte doorschuif). */
  weeksOpen: number;
  /** Schermen die je al bezocht — voor de stappen die alleen vragen dat je gaat kijken. */
  seen: string[];
  /** "Ik ken het spel al": de hele rondleiding weg, definitief voor dit spel. */
  hidden: boolean;
  /** Eenmaal afgevinkte stappen ("hoofdstuk:stap"). Sommige condities kunnen terugvallen
   *  — een benaderde sponsor die de week erna weigert, wist zijn "benaderd"-vlag — en
   *  een stap die weer open springt voelt als een straf voor iets dat je wél deed. */
  voltooid: string[];
}

export interface TourStep {
  /** Wat je doet én waarom het loont — de verkoop, niet het bevel. */
  text: string;
  /** Knoplabel, bv. "Ploeg › Selectie". */
  where: string;
  /** Het scherm-id waar de knop heen navigeert. */
  screen: string;
  /** Waar op dat scherm je moet zijn: het data-tour-doel-anker dat de wijzer krijgt.
   *  Een kijk-stap kan er zonder — dan is aankomen genoeg — maar een scherm met meerdere
   *  kaarten (zoals de bouwplannen, ver onder de accommodatie) heeft er wél een nodig,
   *  anders sta je op de juiste plek zonder te weten waar te kijken. */
  wijs?: string;
  done: (s: GameState) => boolean;
}

export interface TourChapter {
  title: string;
  steps: TourStep[];
}

/** Hoe lang een hoofdstuk blijft liggen voordat het vanzelf doorschuift. */
export const TOUR_PATIENCE = 3;

const seen = (s: GameState, screen: string) => s.tour?.seen.includes(screen) ?? false;

export const TOUR_CHAPTERS: TourChapter[] = [
  {
    title: 'Eerst je ploeg',
    steps: [
      {
        text: 'Bekijk je selectie: je trainer zet elke week de beste elf klaar — met de ster zet je zelf iemand vast',
        where: 'Ploeg › Selectie',
        screen: 'ploeg',
        wijs: 'selectie',
        done: (s) => seen(s, 'ploeg') || s.tactics.manualXI.length > 0 || !!delegate(s, 'opstelling'),
      },
      {
        text: 'Bekijk je spelplan: elk plan is sterk tegen twee tactieken en zwak tegen twee andere — het scoutingrapport hiernaast laat zien wat de tegenstander speelt',
        where: 'Ploeg › Strategie',
        screen: 'strategie',
        wijs: 'spelplan',
        // kijken is genoeg (net als bij de andere kijk-stappen) — anders vinkt wie tevreden
        // is met het beginplan (balbezit) deze stap nooit af, terwijl bekijken zelf al de les is
        done: (s) => seen(s, 'strategie') || !!delegate(s, 'tactiek') || s.tactics.plan !== 'balbezit',
      },
      {
        text: 'Duid een kapitein aan — leiders tillen de ploeg op',
        where: 'Ploeg › Selectie',
        screen: 'ploeg',
        wijs: 'kapitein',
        done: (s) => !!s.tactics.roles.kapitein,
      },
    ],
  },
  {
    title: 'De markt is open',
    steps: [
      {
        text: 'Kijk rond op de transfermarkt zolang de periode loopt: transfervrije spelers kosten geen overnamesom en huren is de goedkoopste versterking',
        where: 'Ploeg › Transfers',
        screen: 'transfers',
        wijs: 'transfers',
        // "kijk rond" = kijken is genoeg. En sinds kopen een gesprek van een week is
        // (0.77.0), telt ook een lopend gesprek — niet pas de handtekening.
        done: (s) =>
          seen(s, 'transfers') ||
          s.requests.some((r) => r.kind === 'transfer-koop' || r.kind === 'transfer-huur') ||
          s.players.some((p) => p.purchasePrice > 0 || p.loan?.type === 'in') ||
          !!delegate(s, 'transfers') ||
          !isTransferWindow(s.week),
      },
    ],
  },
  {
    title: 'Je mensen',
    steps: [
      {
        text: 'Werf minstens één personeelslid aan — een assistent of een scout is een goede eerste',
        where: 'Personeel',
        screen: 'staff',
        wijs: 'kandidaten',
        // elke club start al met 3 (trainer, afgevaardigde, jeugdcoördinator) — pas tellen
        // vanaf een échte aanwerving daarbovenop, anders staat de stap dag één al aangevinkt
        done: (s) => s.staff.length > 3,
      },
      {
        text: 'Besteed een taak uit: wat je uit handen geeft, gebeurt elke week vanzelf',
        where: 'Personeel',
        screen: 'staff',
        wijs: 'taken',
        done: (s) => TASKS.some((t) => !!delegate(s, t.id)),
      },
      {
        text: 'Loop binnen bij Opleiding: een goedkope kracht die je opleidt, haalt een dure in',
        where: 'Personeel › Opleiding',
        screen: 'opleiding',
        done: (s) => seen(s, 'opleiding') || s.staff.some((m) => m.courseWeeksLeft > 0),
      },
    ],
  },
  {
    title: 'Waar het geld binnenkomt',
    steps: [
      {
        text: 'Bekijk je ticketprijs, abonnementen en lidgeld — het lidgeld int zichzelf elk seizoen, maar alleen aan de prijs die jíj zet',
        where: 'Geld › Tickets en lidgeld',
        screen: 'prijzen',
        done: (s) => seen(s, 'prijzen') || !!delegate(s, 'ticketing'),
      },
      {
        text: 'Klop aan bij een bedrijf voor een extra sponsor — sponsoring is de grootste geldstroom van een club als de jouwe',
        where: 'Geld › Sponsors',
        screen: 'sponsors',
        wijs: 'contacten',
        done: (s) => s.prospects.some((p) => p.approached) || s.sponsorCampaignWeeks > 0 || s.sponsorOffers.length > 0 || !!delegate(s, 'sponsoring'),
      },
      {
        text: 'Dien je subsidiedossier in bij de gemeente — de jaarlijkse werkingssubsidie krijg je alleen als je erom vraagt, en je jeugdwerking bepaalt de kans',
        where: 'Geld › Financiën',
        screen: 'financien',
        wijs: 'subsidie',
        done: (s) => s.subsidieSeizoen !== undefined || s.requests.some((r) => r.kind === 'subsidie'),
      },
      {
        text: 'Bekijk wat de bank je kan lenen: soms is bouwen mét lening slimmer dan sparen zonder tribune',
        where: 'Geld › Financiën',
        screen: 'financien',
        done: (s) => seen(s, 'financien') || s.loans.length > 0 || s.requests.some((r) => r.kind === 'lening'),
      },
    ],
  },
  {
    title: 'Meer dan voetbal',
    steps: [
      {
        text: 'Open je clubwinkel: sjaals verkopen bijna zichzelf',
        where: 'Club › Clubwinkel',
        screen: 'clubwinkel',
        wijs: 'winkel',
        done: (s) => s.merch.active,
      },
      {
        text: 'Zet je kantineprijzen of haal een standhouder binnen — de kantine is goud op wedstrijddagen',
        where: 'Club › Horeca',
        screen: 'horeca',
        wijs: 'horeca',
        done: (s) => s.canteen.items.some((i) => Math.abs(i.price - canteenDef(i.id).ref) > 0.01) || !!delegate(s, 'horeca') || s.canteen.concessions.length > 0,
      },
      {
        text: 'Organiseer een evenement: extra geld en sfeer, maar let op je vrijwilligers',
        where: 'Club › Evenementen',
        screen: 'evenementen',
        wijs: 'evenementen',
        done: (s) => s.eventLog.length > 0 || !!delegate(s, 'evenementen'),
      },
    ],
  },
  {
    title: 'Vooruitkijken',
    steps: [
      {
        text: 'Kijk waarop je wordt afgerekend: je doelen, je belofte aan de pers en je logboek',
        where: 'Bureau › Doelen',
        screen: 'doelen',
        wijs: 'doelen-overzicht',
        done: (s) => seen(s, 'doelen'),
      },
      {
        text: 'Verken de bouwplannen — de winterstop is hét moment om te bouwen',
        where: 'Club › Infrastructuur',
        screen: 'infrastructuur',
        wijs: 'bouwplannen',
        done: (s) => seen(s, 'infrastructuur') || s.infrastructure.constructions.length > 0,
      },
      {
        text: '"Wat beïnvloedt wat" is de kaart van het spel: één blik en je snapt hoe de knoppen aan elkaar hangen',
        where: 'Menu › Wat beïnvloedt wat',
        screen: 'invloeden',
        wijs: 'invloeden-kaart',
        done: (s) => seen(s, 'invloeden'),
      },
    ],
  },
];

/** Het hoofdstuk dat nu openstaat, of null als de rondleiding klaar of verborgen is. */
export function tourChapter(s: GameState): { nr: number; total: number; chapter: TourChapter } | null {
  const t = s.tour;
  if (!t || t.hidden || t.chapter >= TOUR_CHAPTERS.length) return null;
  return { nr: t.chapter + 1, total: TOUR_CHAPTERS.length, chapter: TOUR_CHAPTERS[t.chapter] };
}

/** Een bezoek aan een scherm registreren, voor de kijk-stappen. Geeft terug of er iets veranderde. */
export function tourMarkSeen(s: GameState, screen: string): boolean {
  const t = s.tour;
  if (!t || t.hidden || t.chapter >= TOUR_CHAPTERS.length) return false;
  if (t.seen.includes(screen)) return false;
  // alleen schermen waar een kijk-stap ooit naar vraagt, anders groeit de lijst eindeloos
  if (!TOUR_CHAPTERS.some((c) => c.steps.some((st) => st.screen === screen))) return false;
  t.seen.push(screen);
  return true;
}

/** Is deze stap af? Plakkend: eenmaal waar blijft waar, ook als de conditie terugvalt. */
export function tourStepDone(s: GameState, hoofdstuk: number, stap: number): boolean {
  const st = TOUR_CHAPTERS[hoofdstuk]?.steps[stap];
  if (!st) return true;
  return st.done(s) || (s.tour?.voltooid?.includes(`${hoofdstuk}:${stap}`) ?? false);
}

/** Vink alles wat nú waar is blijvend af. Aanroepen na elke actie en bij de weekwissel:
 *  zo overleeft "sponsor benaderd" ook een weigering die de vlag weer wist. */
export function rememberDoneSteps(s: GameState): void {
  const t = s.tour;
  if (!t || t.hidden || t.chapter >= TOUR_CHAPTERS.length) return;
  t.voltooid ??= [];
  TOUR_CHAPTERS[t.chapter].steps.forEach((st, i) => {
    const sleutel = `${t.chapter}:${i}`;
    if (!t.voltooid.includes(sleutel) && st.done(s)) t.voltooid.push(sleutel);
  });
}

/** De afvinkstand van het actieve hoofdstuk — om na een klik te zien of er iets bij kwam. */
export function tourFlags(s: GameState): { nr: number; flags: boolean[] } | null {
  const t = tourChapter(s);
  if (!t) return null;
  return { nr: t.nr, flags: t.chapter.steps.map((_, i) => tourStepDone(s, t.nr - 1, i)) };
}

/**
 * Het weekritme van de rondleiding, aangeroepen op het einde van elke gespeelde week.
 *
 * Een afgewerkt hoofdstuk maakt de week erna plaats voor het volgende; een hoofdstuk dat
 * blijft liggen schuift na TOUR_PATIENCE weken vanzelf door. Hoofdstukken die bij het
 * openslaan al volledig af blijken (een ervaren speler, of een oud spel dat instapt),
 * worden meteen overgeslagen — je krijgt nooit een lijstje vinkjes te zien als les.
 */
export function advanceTour(s: GameState): void {
  const t = s.tour;
  if (!t || t.hidden) return;
  rememberDoneSteps(s);
  while (t.chapter < TOUR_CHAPTERS.length) {
    const ch = TOUR_CHAPTERS[t.chapter];
    const klaar = ch.steps.every((_, i) => tourStepDone(s, t.chapter, i));
    if (klaar || t.weeksOpen >= TOUR_PATIENCE) {
      t.chapter++;
      t.weeksOpen = 0;
      if (!klaar) break; // zachte doorschuif: het volgende hoofdstuk begint gewoon deze week
      continue; // afgewerkte (of al gekende) hoofdstukken meteen overslaan
    }
    t.weeksOpen++;
    break;
  }
}

/** Oudere opslagbestanden kennen de rondleiding niet: geef ze er stilletjes een. */
export function repairTour(s: GameState): void {
  if (s.tour) return;
  // wie al diep in het spel zit, heeft geen rondleiding meer nodig — zelfde grens als de
  // oude "Eerste stappen" (die verdween na week 20 van seizoen 1)
  s.tour = { chapter: 0, weeksOpen: 0, seen: [], hidden: s.season > 1 || s.week > 20, voltooid: [] };
  s.tour.voltooid ??= [];
}
