// De taal waarin spelinhoud beschreven wordt.
//
// Alles in deze map is data: geen berekeningen, geen toegang tot de spelstand, geen imports
// uit de engine behalve types. De engine (src/engine/content.ts) leest deze definities en voert
// ze uit. Een nieuw weekmoment of een nieuwe gebeurtenis toevoegen is daarom een kwestie van
// een blok data bijschrijven — de simulatie zelf blijft ongemoeid.

import type { LedgerCategory, NewsItem } from '../engine/types';

export type Toon = NewsItem['tone'];

/* ------------------------------------------------------------------ getallen */

/** Waar een getal vandaan komt als het niet gewoon vast is. */
export type PerEenheid = 'jeugdploegen' | 'ticketprijs' | 'supporters' | 'vrijwilligers' | 'sponsors' | 'spelers';

/**
 * Een getal dat van de spelstand mag afhangen. Gebruikt voor bedragen én voor aantallen.
 *
 * Volgorde van berekenen: `heel` of `basis` → × `per` → × inflatie → × klasse → × `spreiding`
 * → afronden op `afronden`.
 */
export type Getal =
  | number
  | {
      /** Vast startgetal. */
      basis?: number;
      /** Willekeurig geheel getal tussen deze twee (inclusief); vervangt `basis`. */
      heel?: [number, number];
      /** Vaste vermenigvuldiger, bijvoorbeeld 1000 om in duizendtallen te werken. */
      maal?: number;
      /** Vermenigvuldig met een grootheid uit de spelstand. */
      per?: PerEenheid;
      /** Laat het meestijgen met de inflatie. */
      inflatie?: boolean;
      /** Laat het meestijgen met de klasse waarin je speelt (× 1 + klasse × 0,12). */
      klasse?: boolean;
      /** Vermenigvuldig met een willekeurige factor tussen deze twee. */
      spreiding?: [number, number];
      /** Afronden op veelvouden hiervan (50 = op halve honderdtallen). */
      afronden?: number;
    };

/* --------------------------------------------------------------- voorwaarden */

/** Ja-of-nee-eigenschappen van de week of de club. */
export type Vlag =
  | 'match' // je ploeg speelt deze week
  | 'thuis' // en dan: op eigen veld
  | 'uit'
  | 'derby' // tegen je aartsrivaal
  | 'winter' // de koude maanden (week 19–36)
  | 'winterstop'
  | 'transferperiode'
  | 'natuurgras'
  | 'teambus' // de club heeft een eigen bus
  | 'basisonderhoud' // je onderhoudsniveau staat op 'basis'
  | 'investeerderActief'
  | 'gepromoveerd' // vorig seizoen ging omhoog
  | 'gedegradeerd';

/** Meetbare grootheden uit de spelstand. */
export type Meting =
  | 'week'
  | 'seizoen'
  | 'klasse' // 1 = 3de nationale, hoger = hoger
  | 'kas'
  | 'schuld'
  | 'sfeer'
  | 'reputatie'
  | 'supporters'
  | 'vrijwilligers'
  | 'vrijwilligerstrouw' // weken dat de vrijwilligers nog nazinderen van een feest
  | 'jeugdploegen'
  | 'leden'
  | 'capaciteit'
  | 'kantineniveau'
  | 'onderhoudsniveau' // 0 = basis, 1 = normaal, 2 = premium
  | 'sponsors'
  | 'spelers'
  | 'fitteSpelers'
  | 'hoogsteVermoeidheid'
  | 'laagsteMoraal'
  | 'ploegsterkte'
  | 'stand'; // je plaats in de rangschikking (1 = leider)

/** Wanneer iets mag gebeuren. Combineerbaar met alle / een / niet. */
export type Voorwaarde =
  | { vlag: Vlag; is?: boolean }
  | { meting: Meting; min?: number; max?: number }
  | { verhaal: string } // deze verhaallijn staat open (zie Storyline)
  | { variabele: string; min?: number; max?: number } // een plaatshouder die een eerder effect opleverde
  | { alle: Voorwaarde[] }
  | { een: Voorwaarde[] }
  | { niet: Voorwaarde };

/* -------------------------------------------------------------------- effect */

/** Op wie een spelerseffect slaat. */
export type SpelerKeuze = 'focus' | 'moeist' | 'laagsteMoraal' | 'beste' | 'jongste' | 'willekeurig';

/** Wat er met de wereld gebeurt. Elk effect kan iets terugkoppelen voor de placeholders. */
export type Effect =
  | { boek: LedgerCategory; bedrag: Getal; reden: string }
  | { sfeer: Getal }
  | { reputatie: Getal }
  | { supporters: Getal }
  | { vrijwilligers: Getal }
  | { vrijwilligerstrouw: number }
  | { moraalIedereen: Getal }
  | { vermoeidheidIedereen: Getal }
  | {
      speler: SpelerKeuze;
      moraal?: Getal;
      vermoeidheid?: Getal;
      blessure?: Getal; // aantal weken buiten strijd
      uitBasis?: boolean; // haal hem uit de basiself
    }
  | { sponsor: 'grootste' | 'willekeurig'; tevredenheid?: Getal; beeindig?: boolean }
  | { griep: { kans: number; weken: number } }
  | {
      nieuws: {
        toon: Toon;
        /** Eén of meer formuleringen; er wordt er één geloot. */
        tekst: string | string[];
        /** Gebruikt in plaats van `tekst` wanneer {aantal} precies 1 is. */
        enkelvoud?: string;
      };
    }
  | { verhaalOpenen: { naam: string; weken: number } } // een gebeurtenis die later mag terugkomen
  | { verhaalSluiten: string }
  | { geschiedenis: string } // leg dit vast in de clubkroniek
  | { als: Voorwaarde; dan: Effect[] }; // alleen uitvoeren als de voorwaarde klopt

/* ---------------------------------------------------------------- weekmoment */

/** Eén mogelijke afloop van een keuze. */
export interface Gevolg {
  /** Kans dat dit gevolg optreedt (0–1). Laat weg voor "anders". Wordt van boven naar onder getoetst. */
  kans?: number;
  /** Wat er in het weekrapport komt. Mag placeholders bevatten. */
  tekst: string;
  effecten?: Effect[];
}

export interface Keuze {
  id: string;
  /** Knoptekst. `{kost}` wordt vervangen door het bedrag hieronder. */
  label: string;
  /** De uitleg onder de knop: wat je ervoor terugkrijgt en wat het risico is. */
  uitleg: string;
  /** Alleen voor het label: het bedrag dat deze keuze kost. */
  kost?: Getal;
  gevolgen: Gevolg[];
}

export type Categorie = 'wedstrijd' | 'kleedkamer' | 'kantine' | 'bestuur' | 'jeugd' | 'sponsor' | 'infrastructuur' | 'reeks';

export interface MomentDef {
  id: string;
  categorie: Categorie;
  /** Wanneer dit moment kan opduiken. */
  wanneer: Voorwaarde;
  titel: string;
  /** De drie zinnen die de situatie schetsen. Mag placeholders bevatten. */
  tekst: string;
  /** Welke speler of sponsor dit moment aangaat; wordt vastgezet zodra het moment verschijnt. */
  focusSpeler?: SpelerKeuze;
  focusSponsor?: 'grootste' | 'willekeurig';
  /** Weken voor dit moment opnieuw mag. Standaard MOMENT_COOLDOWN. */
  cooldown?: number;
  /** Relatief gewicht bij het loten. Standaard 1. */
  gewicht?: number;
  keuzes: Keuze[];
}

/* ------------------------------------------------------- willekeurige events */

/** Een gebeurtenis die vanzelf kan gebeuren, zonder dat de eigenaar iets kiest. */
export interface EventDef {
  id: string;
  categorie: Categorie;
  /** Basiskans per week (0–1). */
  kans: number;
  /** Onder welke omstandigheden dit überhaupt kan. */
  wanneer?: Voorwaarde;
  /** Vermenigvuldigers op de kans, elk met hun eigen voorwaarde. */
  kansFactoren?: { wanneer: Voorwaarde; factor: number }[];
  /** Weken voor dit event opnieuw mag. 0 = geen wachttijd. */
  cooldown?: number;
  focusSpeler?: SpelerKeuze;
  focusSponsor?: 'grootste' | 'willekeurig';
  effecten: Effect[];
}

/* ------------------------------------------------------------ nieuwssjablonen */

/** Een nieuwsbericht met plaatshouders, los van de plek waar het ontstaat. */
export interface NieuwsSjabloon {
  id: string;
  toon: Toon;
  /** Eén of meer formuleringen; er wordt er één geloot zodat hetzelfde bericht niet altijd hetzelfde klinkt. */
  tekst: string | string[];
}
