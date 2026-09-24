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
}

export interface TourStep {
  /** Wat je doet én waarom het loont — de verkoop, niet het bevel. */
  text: string;
  /** Knoplabel, bv. "Ploeg › Selectie". */
  where: string;
  /** Het scherm-id waar de knop heen navigeert. */
  screen: string;
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
        text: 'Zet je basiself vast — of laat je trainer dat elke week doen',
        where: 'Ploeg › Selectie',
        screen: 'ploeg',
        done: (s) => s.tactics.manualXI.length > 0 || !!delegate(s, 'opstelling'),
      },
      {
        text: 'Kies een spelplan: elk plan klopt tegen het ene en kraakt tegen het andere',
        where: 'Ploeg › Strategie',
        screen: 'strategie',
        done: (s) => !!delegate(s, 'tactiek') || s.tactics.plan !== 'balbezit' || s.week > 8,
      },
      {
        text: 'Duid een kapitein aan — leiders tillen de ploeg op',
        where: 'Ploeg › Selectie',
        screen: 'ploeg',
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
        done: (s) => s.players.some((p) => p.purchasePrice > 0 || p.loan?.type === 'in') || !!delegate(s, 'transfers') || !isTransferWindow(s.week),
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
        done: (s) => s.staff.length > 2,
      },
      {
        text: 'Besteed een taak uit: wat je uit handen geeft, gebeurt elke week vanzelf',
        where: 'Personeel',
        screen: 'staff',
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
        done: (s) => s.prospects.some((p) => p.approached) || s.sponsorCampaignWeeks > 0 || s.sponsorOffers.length > 0 || !!delegate(s, 'sponsoring'),
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
        done: (s) => s.merch.active,
      },
      {
        text: 'Zet je kantineprijzen of haal een standhouder binnen — de kantine is goud op wedstrijddagen',
        where: 'Club › Horeca',
        screen: 'horeca',
        done: (s) => s.canteen.items.some((i) => Math.abs(i.price - canteenDef(i.id).ref) > 0.01) || !!delegate(s, 'horeca') || s.canteen.concessions.length > 0,
      },
      {
        text: 'Organiseer een evenement: extra geld en sfeer, maar let op je vrijwilligers',
        where: 'Club › Evenementen',
        screen: 'evenementen',
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
        done: (s) => seen(s, 'doelen'),
      },
      {
        text: 'Verken de bouwplannen — de winterstop is hét moment om te bouwen',
        where: 'Club › Infrastructuur',
        screen: 'infrastructuur',
        done: (s) => seen(s, 'infrastructuur') || s.infrastructure.constructions.length > 0,
      },
      {
        text: '"Wat beïnvloedt wat" is de kaart van het spel: één blik en je snapt hoe de knoppen aan elkaar hangen',
        where: 'Menu › Wat beïnvloedt wat',
        screen: 'invloeden',
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
  while (t.chapter < TOUR_CHAPTERS.length) {
    const ch = TOUR_CHAPTERS[t.chapter];
    const klaar = ch.steps.every((st) => st.done(s));
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
  s.tour = { chapter: 0, weeksOpen: 0, seen: [], hidden: s.season > 1 || s.week > 20 };
}
