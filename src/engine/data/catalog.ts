import type { CanteenItemId, ConcessionId, Diploma, MerchItemId, StaffRole, TaskId, UpgradeId } from '../types';

export interface RoleDef {
  role: StaffRole;
  label: string;
  effect: string;
  baseWage: number; // weekloon bij skill 50
  max: number; // hoeveel je er maximaal kunt hebben
}

export const STAFF_ROLES: RoleDef[] = [
  { role: 'hoofdtrainer', label: 'Hoofdtrainer (T1)', effect: 'Teamsterkte, ontwikkeling van spelers. Diploma nodig voor de licentie.', baseWage: 400, max: 1 },
  { role: 'assistent', label: 'Assistent-trainer (T2)', effect: 'Kleine bonus op alle linies, snellere ontwikkeling van jonge spelers. Kan de opstelling overnemen.', baseWage: 220, max: 1 },
  { role: 'conditietrainer', label: 'Conditietrainer (T3)', effect: 'Betere fysiek, stabielere vorm, minder blessures. Maakt pressing zonder extra blessures mogelijk.', baseWage: 170, max: 1 },
  { role: 'keepertrainer', label: 'Keepertrainer', effect: 'Bonus op de doelman, snellere ontwikkeling van keepers.', baseWage: 120, max: 1 },
  { role: 'voeding', label: 'Voedingsdeskundige', effect: 'Spelers bouwen minder vermoeidheid op en herstellen sneller.', baseWage: 120, max: 1 },
  { role: 'verzorger', label: 'Verzorger / masseur', effect: 'Snellere recuperatie na wedstrijden en trainingen. Goedkoop.', baseWage: 80, max: 1 },
  { role: 'mentaal', label: 'Mentale coach', effect: 'Stabielere moraal en vorm, minder domme kaarten.', baseWage: 150, max: 1 },
  { role: 'analist', label: 'Data-analist', effect: 'Analyseert tegenstanders: kleine bonus per wedstrijd, betere tactische keuzes, scout vindt beter talent.', baseWage: 200, max: 1 },
  { role: 'kinesist', label: 'Kinesist', effect: 'Preventief: minder blessures. Herstellend: geblesseerden genezen sneller, iets sneller recupereren.', baseWage: 180, max: 1 },
  { role: 'afgevaardigde', label: 'Ploegafgevaardigde', effect: 'Verplicht voor de licentie. Minder boetes en administratieve fouten.', baseWage: 60, max: 1 },
  { role: 'scout', label: 'Scout', effect: 'Meer en betere spelers op de transferlijst, betere prijzen.', baseWage: 200, max: 1 },
  { role: 'kantine', label: 'Kantineverantwoordelijke', effect: 'Hogere kantine-omzet, vrijwilligers raken minder snel op.', baseWage: 150, max: 1 },
  { role: 'merchandising', label: 'Merchandisingverantwoordelijke', effect: 'Meer verkoop in de fanshop, betere inkoopprijzen en minder winkelkosten.', baseWage: 140, max: 1 },
  { role: 'commercieel', label: 'Commercieel medewerker', effect: 'Meer en betere sponsoraanbiedingen, meer supporters.', baseWage: 250, max: 1 },
  { role: 'jeugdcoordinator', label: 'Jeugdcoördinator', effect: 'Meer jeugdleden, betere jeugdspelers die doorstromen.', baseWage: 220, max: 1 },
];

export function roleDef(role: StaffRole): RoleDef {
  return STAFF_ROLES.find((r) => r.role === role)!;
}

export interface CourseDef {
  from: Diploma;
  to: Diploma;
  cost: number;
  weeks: number;
}

export const COURSES: CourseDef[] = [
  { from: 'geen', to: 'EUFA C', cost: 600, weeks: 6 },
  { from: 'EUFA C', to: 'EUFA B', cost: 2_500, weeks: 12 },
  { from: 'EUFA B', to: 'EUFA A', cost: 6_000, weeks: 20 },
  { from: 'EUFA A', to: 'EUFA Pro', cost: 15_000, weeks: 30 },
];

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  description: string;
  cost: number;
  weeks: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'tribune', label: 'Tribune uitbreiden (+300 plaatsen)', description: 'Meer toeschouwers mogelijk, nodig voor hogere reeksen.', cost: 110_000, weeks: 10 },
  { id: 'kantine', label: 'Kantine renoveren (+1 niveau)', description: 'Supporters besteden meer per bezoek. Maximaal niveau 5.', cost: 45_000, weeks: 6 },
  { id: 'kunstgras', label: 'Kunstgras aanleggen', description: 'Minder onderhoud, geen afgelastingen, verhuur aan andere clubs.', cost: 420_000, weeks: 8 },
  { id: 'verlichting', label: 'Verlichting verbeteren (+1 niveau)', description: 'Nodig voor hogere reeksen. Maximaal niveau 3.', cost: 65_000, weeks: 4 },
  {
    id: 'opleidingscentrum',
    label: 'Jeugdopleidingscentrum (+1 niveau)',
    description: 'Meer en betere jeugdspelers die doorstromen, snellere ontwikkeling van spelers tot 21 jaar, meer jeugdleden. Kost €400/week onderhoud per niveau. Maximaal niveau 3.',
    cost: 160_000,
    weeks: 12,
  },
  { id: 'wifi', label: 'Wifi en mobiel bereik (+1 niveau)', description: 'Supporters delen alles live, bestellen sneller aan de toog en blijven langer hangen. Meer toeschouwers en meer consumpties. Maximaal niveau 2.', cost: 28_000, weeks: 3 },
  { id: 'sanitair', label: 'Toiletten en kleedkamers (+1 niveau)', description: 'Nette toiletten houden gezinnen langer op het complex: meer toeschouwers en meer kantineomzet. Maximaal niveau 2.', cost: 55_000, weeks: 6 },
  { id: 'scorebord', label: 'Scorebord (+1 niveau)', description: 'Een echt scorebord maakt er een wedstrijd van: meer sfeer, en sponsors betalen meer voor een bord dat iedereen ziet. Niveau 2 is een ledscherm met reclameblokken. Maximaal niveau 2.', cost: 42_000, weeks: 4 },
  { id: 'ploegbus', label: 'Eigen ploegbus', description: 'Een tweedehands bus met de clubkleuren. Je betaalt nog enkel brandstof en een chauffeur (55% goedkoper per verplaatsing) en een bedrijf kan zijn naam op de bus zetten (nieuwe sponsorplaats).', cost: 32_000, weeks: 2 },
  { id: 'parking', label: 'Parking uitbreiden (+1 niveau)', description: 'Bezoekers van verder af geraken vlot tot aan het veld. Meer toeschouwers, vooral bij een derby. Maximaal niveau 2.', cost: 70_000, weeks: 7 },
  {
    id: 'recuperatie',
    label: 'Recuperatieruimte (+1 niveau)',
    description: 'IJsbad, sauna en massagetafels: spelers herstellen sneller van vermoeidheid. Maximaal niveau 2.',
    cost: 35_000,
    weeks: 5,
  },
];

export const BIJSCHOLING = { weeks: 6, cost: (skill: number) => 800 + skill * 20, gain: [4, 8] as [number, number], cap: 92 };

export interface TaskDef {
  id: TaskId;
  label: string;
  roles: StaffRole[]; // wie deze taak kan overnemen
  owner: string; // wat je zelf moet doen als je de taak houdt
  delegated: string; // wat het staflid automatisch doet
}

export const TASKS: TaskDef[] = [
  {
    id: 'training',
    label: 'Trainingen (aantal en focus)',
    roles: ['hoofdtrainer', 'assistent', 'conditietrainer'],
    owner: 'Jij kiest hoeveel keer per week er getraind wordt en waarop (tab Strategie).',
    delegated: 'Kiest elke week het trainingsritme en de focus, en houdt daarbij rekening met de vermoeidheid van de groep.',
  },
  {
    id: 'opstelling',
    label: 'Opstelling (formatie en basiself)',
    roles: ['hoofdtrainer', 'assistent'],
    owner: 'Jij kiest de formatie en wie er in de basis staat (tab Selectie).',
    delegated: 'Kiest elke week de formatie die bij je spelers past en zet de beste elf op het veld, met aandacht voor vermoeidheid en schorsingen.',
  },
  {
    id: 'tactiek',
    label: 'Wedstrijdtactiek (mentaliteit en spelplan)',
    roles: ['hoofdtrainer', 'assistent', 'analist'],
    owner: 'Jij kiest de mentaliteit en het spelplan voor de volgende wedstrijd (tab Strategie).',
    delegated: 'Kiest een spelplan tegen de volgende tegenstander. Met een data-analist kent hij hun spelplan op voorhand.',
  },
  {
    id: 'spelersrollen',
    label: 'Spelersrollen (kapitein, strafschop, hoekschop)',
    roles: ['hoofdtrainer', 'assistent'],
    owner: 'Jij duidt de kapitein en de nemers aan (tab Selectie).',
    delegated: 'Duidt de kapitein aan op basis van leiderschap en ervaring, en kiest de beste nemers.',
  },
  {
    id: 'contracten',
    label: 'Contractverlengingen',
    roles: ['afgevaardigde', 'assistent'],
    owner: 'Jij verlengt contracten van spelers voor ze aflopen.',
    delegated: 'Verlengt vanaf week 36 de contracten van basisspelers en jonge talenten. Laat zwakke en oude spelers gaan.',
  },
  {
    id: 'transfers',
    label: 'Transfers en scouting',
    roles: ['scout', 'hoofdtrainer', 'afgevaardigde'],
    owner: 'Jij koopt spelers op de transfermarkt.',
    delegated: 'Vult tijdens de transferperiode tekorten per linie aan, binnen het transferbudget dat jij instelt. Hij raakt nooit aan je kernspelers en laat je selectie nooit onder de veilige grens zakken.',
  },
  {
    id: 'sponsoring',
    label: 'Sponsorwerving',
    roles: ['commercieel'],
    owner: 'Jij benadert bedrijven, tekent aanbiedingen en verlengt contracten (tab Sponsors).',
    delegated: 'Benadert om de twee weken het meest geïnteresseerde bedrijf, tekent aanbiedingen en verlengt tevreden sponsors.',
  },
  {
    id: 'ticketing',
    label: 'Ticketprijs',
    roles: ['commercieel'],
    owner: 'Jij stelt de ticketprijs in (tab Financiën).',
    delegated: 'Zoekt de prijs met de beste opbrengst zonder de supporters te ergeren.',
  },
  {
    id: 'evenementen',
    label: 'Evenementen',
    roles: ['kantine'],
    owner: 'Jij organiseert evenementen (tab Evenementen).',
    delegated: 'Organiseert om de 5 weken het evenement met de beste verwachte winst, als er genoeg vrijwilligers zijn.',
  },
  {
    id: 'vrijwilligers',
    label: 'Vrijwilligersbeleid',
    roles: ['kantine', 'jeugdcoordinator'],
    owner: 'Jij werft vrijwilligers en bedankt ze (tab Evenementen).',
    delegated: 'Start een wervingsactie als er te weinig vrijwilligers zijn en organiseert jaarlijks een vrijwilligersfeest.',
  },
  {
    id: 'horeca',
    label: 'Kantine en concessies',
    roles: ['kantine', 'commercieel'],
    owner: 'Jij zet de prijzen aan de toog en onderhandelt met de standhouders (Club › Horeca).',
    delegated: 'Houdt de prijzen aan de toog op het beste punt en haalt er een standhouder bij als dat opbrengt.',
  },
  {
    id: 'jeugd',
    label: 'Jeugdwerking (lidgeld)',
    roles: ['jeugdcoordinator', 'afgevaardigde'],
    owner: 'Jij bepaalt het lidgeld voor de jeugd (Clubinfo).',
    delegated: 'Zet het lidgeld op het punt waar de inkomsten het hoogst zijn zonder leden weg te jagen, en houdt rekening met hoe de club draait.',
  },
  {
    id: 'medisch',
    label: 'Belasting en blessurepreventie',
    roles: ['kinesist', 'verzorger', 'voeding'],
    owner: 'Jij beslist zelf of je de groep laat doortrainen of rust geeft.',
    delegated: 'Houdt de vermoeidheid in de gaten: hij schroeft het trainingsritme terug en zet de focus op herstel zodra de groep te zwaar belast raakt.',
  },
  {
    id: 'infrastructuur',
    label: 'Onderhoud en bouwprojecten',
    roles: ['afgevaardigde', 'commercieel'],
    owner: 'Jij kiest het onderhoudsniveau en start bouwprojecten (Infrastructuur).',
    delegated: 'Kiest een onderhoudsniveau dat bij je kaspositie past en start bouwprojecten die je licentie of je groei nodig heeft, met een ruime buffer op de rekening.',
  },
  {
    id: 'merchandising',
    label: 'Fanshop en merchandising',
    roles: ['merchandising', 'commercieel', 'kantine'],
    owner: 'Jij kiest welke artikelen in de shop liggen en wat ze kosten (Club › Fanshop).',
    delegated: 'Zet de prijzen elke week richting de beste marge en neemt er een artikel bij als de kas het toelaat.',
  },
];

export function taskDef(id: TaskId): TaskDef {
  return TASKS.find((t) => t.id === id)!;
}

export interface EventContext {
  fanBase: number;
  youthMembers: number;
  mood: number;
}

export interface ClubEventDef {
  id: string;
  label: string;
  description: string;
  cost: number;
  cooldown: number; // weken voor je het opnieuw kunt organiseren
  maxPerSeason: number; // hoe vaak per seizoen
  volunteers: number; // minimaal aantal vrijwilligers
  payoutWeeks: number; // na hoeveel weken het geld binnenkomt
  revenue: (c: EventContext) => number; // verwachte opbrengst (midden van de prognose)
  spread: number; // onzekerheid: 0.4 = opbrengst tussen 60% en 140% van verwacht
  moodBoost: number;
  reputationBoost: number;
  fanBaseBoost: number; // procent extra supporters
}

export const CLUB_EVENTS: ClubEventDef[] = [
  {
    id: 'quiz',
    label: 'Supportersquiz',
    description: 'Gezellige avond in de kantine. Laag risico, bescheiden opbrengst.',
    cost: 300,
    cooldown: 6,
    maxPerSeason: 4,
    volunteers: 3,
    payoutWeeks: 1,
    revenue: (c) => c.fanBase * 1.6,
    spread: 0.3,
    moodBoost: 2,
    reputationBoost: 0,
    fanBaseBoost: 0,
  },
  {
    id: 'koekjes',
    label: 'Koekjesverkoop jeugd',
    description: 'Jeugdspelers gaan deur aan deur. Het geld komt pas binnen als alle dozen verkocht zijn.',
    cost: 700,
    cooldown: 16,
    maxPerSeason: 2,
    volunteers: 5,
    payoutWeeks: 4,
    revenue: (c) => c.youthMembers * 12,
    spread: 0.35,
    moodBoost: 1,
    reputationBoost: 1,
    fanBaseBoost: 0,
  },
  {
    id: 'spaghetti',
    label: 'Spaghetti-avond',
    description: 'De klassieker. Veel werk, goede opbrengst als de zaal volloopt.',
    cost: 900,
    cooldown: 10,
    maxPerSeason: 3,
    volunteers: 9,
    payoutWeeks: 2,
    revenue: (c) => (c.fanBase * 3.5 + c.youthMembers * 3) * (0.7 + c.mood / 200),
    spread: 0.5,
    moodBoost: 2,
    reputationBoost: 0,
    fanBaseBoost: 0,
  },
  {
    id: 'mosselfeest',
    label: 'Mosselfeest',
    description: 'Groot eetfestijn in een tent. Hoge kost en veel vrijwilligers nodig, maar een topper als het lukt.',
    cost: 4_500,
    cooldown: 26,
    maxPerSeason: 1,
    volunteers: 14,
    payoutWeeks: 3,
    revenue: (c) => (c.fanBase * 10 + c.youthMembers * 4) * (0.7 + c.mood / 200),
    spread: 0.55,
    moodBoost: 3,
    reputationBoost: 1,
    fanBaseBoost: 1,
  },
  {
    id: 'fandag',
    label: 'Fandag',
    description: 'Spelers signeren, kinderen spelen mee. Brengt weinig op, maar trekt nieuwe supporters aan.',
    cost: 3_000,
    cooldown: 20,
    maxPerSeason: 2,
    volunteers: 7,
    payoutWeeks: 1,
    revenue: (c) => c.fanBase * 2.5,
    spread: 0.3,
    moodBoost: 8,
    reputationBoost: 3,
    fanBaseBoost: 4,
  },
  {
    id: 'jeugdtornooi',
    label: 'Jeugdtornooi',
    description: 'Een weekend vol jeugdploegen: inschrijvingen, inkom en kantine. Goed voor je reputatie.',
    cost: 2_500,
    cooldown: 26,
    maxPerSeason: 1,
    volunteers: 11,
    payoutWeeks: 2,
    revenue: (c) => 1_000 + c.youthMembers * 13,
    spread: 0.35,
    moodBoost: 2,
    reputationBoost: 4,
    fanBaseBoost: 1,
  },
];

export interface VolunteerActionDef {
  id: string;
  label: string;
  description: string;
  cost: number;
  cooldown: number;
  weeks: number; // na hoeveel weken de nieuwe vrijwilligers aansluiten
  gain: (youthMembers: number) => [number, number];
  loyaltyWeeks: number;
}

export const VOLUNTEER_ACTIONS: VolunteerActionDef[] = [
  {
    id: 'oproep',
    label: 'Oproep in clubblad en op sociale media',
    description: 'Goedkoop, maar weinig respons.',
    cost: 100,
    cooldown: 4,
    weeks: 1,
    gain: () => [0, 2],
    loyaltyWeeks: 0,
  },
  {
    id: 'infoavond',
    label: 'Infoavond voor ouders van jeugdspelers',
    description: 'Hoe meer jeugdleden, hoe meer kandidaten.',
    cost: 500,
    cooldown: 10,
    weeks: 2,
    gain: (y) => [1, 2 + Math.round(y / 120)],
    loyaltyWeeks: 0,
  },
  {
    id: 'feest',
    label: 'Vrijwilligersfeest',
    description: 'Bedank je vrijwilligers. Een half jaar lang haken er veel minder af, en er komen er via-via enkele bij.',
    cost: 1_500,
    cooldown: 26,
    weeks: 1,
    gain: () => [1, 4],
    loyaltyWeeks: 26,
  },
];

// ---------- Fanshop ----------

export interface MerchItemDef {
  id: MerchItemId;
  label: string;
  buy: number; // inkoopprijs per stuk
  ref: number; // gangbare verkoopprijs; daarboven verkoop je minder, daaronder meer
  appeal: number; // hoeveel supporters dit artikel willen
  setup: number; // eenmalige kost om het in het assortiment te nemen (eerste voorraad, drukwerk)
}

export const MERCH_START_COST = 3_500; // fanshop inrichten: rekken, kassasysteem, webshop
export const MERCH_WEEK_COST = 55; // vaste weekkost zolang de shop draait
export const MERCH_ITEM_WEEK_COST = 8; // per artikel in het assortiment

export const MERCH_ITEMS: MerchItemDef[] = [
  { id: 'sjaal', label: 'Sjaal', buy: 5, ref: 14, appeal: 1, setup: 400 },
  { id: 'shirt', label: 'Wedstrijdshirt (replica)', buy: 20, ref: 45, appeal: 0.55, setup: 1_800 },
  { id: 'tshirt', label: 'T-shirt met clublogo', buy: 9, ref: 22, appeal: 0.75, setup: 700 },
  { id: 'hoodie', label: 'Hoodie', buy: 26, ref: 55, appeal: 0.45, setup: 1_500 },
  { id: 'pet', label: 'Pet', buy: 6, ref: 15, appeal: 0.5, setup: 400 },
  { id: 'mok', label: 'Mok', buy: 3, ref: 9, appeal: 0.4, setup: 250 },
  { id: 'vlag', label: 'Vlag', buy: 7, ref: 16, appeal: 0.35, setup: 350 },
];

export function merchDef(id: MerchItemId): MerchItemDef {
  return MERCH_ITEMS.find((m) => m.id === id)!;
}

// ---------- Kantine en concessies ----------

export interface CanteenItemDef {
  id: CanteenItemId;
  label: string;
  cost: number; // inkoop per stuk
  ref: number; // gangbare prijs
  perVisitor: number; // hoeveel stuks per bezoeker aan de gangbare prijs
}

export const CANTEEN_ITEMS: CanteenItemDef[] = [
  { id: 'pils', label: 'Pils', cost: 0.75, ref: 2.5, perVisitor: 0.72 },
  { id: 'frisdrank', label: 'Frisdrank', cost: 0.6, ref: 2.2, perVisitor: 0.42 },
  { id: 'water', label: 'Water', cost: 0.35, ref: 1.8, perVisitor: 0.15 },
  { id: 'koffie', label: 'Koffie', cost: 0.3, ref: 2, perVisitor: 0.3 },
  { id: 'chips', label: 'Chips en snacks', cost: 0.5, ref: 1.8, perVisitor: 0.28 },
  { id: 'soep', label: 'Soep', cost: 0.4, ref: 2, perVisitor: 0.12 },
];

export function canteenDef(id: CanteenItemId): CanteenItemDef {
  return CANTEEN_ITEMS.find((c) => c.id === id)!;
}

export interface ConcessionDef {
  id: ConcessionId;
  label: string;
  price: number; // wat de supporter bij de stand betaalt
  perVisitor: number;
  baseMargin: number; // marge (%) die een standhouder normaal aanvaardt
  space: number; // hoeveel plaats hij inneemt (max 3 in totaal)
}

export const CONCESSIONS: ConcessionDef[] = [
  { id: 'hotdog', label: 'Hotdogkraam', price: 4, perVisitor: 0.16, baseMargin: 14, space: 1 },
  { id: 'hamburger', label: 'Hamburgerkraam', price: 6.5, perVisitor: 0.13, baseMargin: 16, space: 1 },
  { id: 'frituur', label: 'Frituur', price: 5, perVisitor: 0.24, baseMargin: 18, space: 2 },
  { id: 'pasta', label: 'Pastastand', price: 7, perVisitor: 0.1, baseMargin: 15, space: 1 },
];

export function concessionDef(id: ConcessionId): ConcessionDef {
  return CONCESSIONS.find((c) => c.id === id)!;
}

export const CONCESSION_SPACE = 3; // hoeveel kramen er op het complex passen
