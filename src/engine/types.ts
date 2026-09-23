// Alle datatypes van het spel. De volledige speltoestand (GameState) is één
// gewoon JSON-object: makkelijk op te slaan, te exporteren en te testen.

export type Position = 'DOEL' | 'VERD' | 'MIDD' | 'AANV';

export type PlayerTrait =
  | 'professioneel'
  | 'leider'
  | 'lastpak'
  | 'gevoelig'
  | 'harde werker'
  | 'feestbeest';

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  technique: number; // 1-100
  physical: number; // 1-100
  potential: number; // 1-100, plafond van de ontwikkeling
  trait: PlayerTrait;
  wage: number; // euro per week
  contractUntil: number; // laatste seizoen (nummer) van het contract
  morale: number; // 0-100
  form: number; // -10 .. +10
  injuryWeeks: number;
  fatigue: number; // 0-100: vermoeidheid door trainingen en wedstrijden
  yellowCards: number; // dit seizoen
  redCards: number; // dit seizoen
  suspended: number; // aantal competitiewedstrijden geschorst
  starts: number; // basisplaatsen dit seizoen
  goals: number; // doelpunten dit seizoen
  careerGoals: number; // doelpunten voor deze club, over alle seizoenen
  periodStarts: number; // basisplaatsen sinds de laatste evolutie (om de 4 weken)
  trend: number; // verandering van de kwaliteit bij de laatste evolutie
  negotiations: number; // mislukte loongesprekken dit seizoen
  listed: boolean; // op de transferlijst gezet
  askingPrice: number; // vraagprijs als hij te koop staat
  loan: PlayerLoan | null;
  friends: string[]; // ids van spelers met wie hij goed samenwerkt
  /** Gesprekken met de club die hem uitleent: wanneer en met welk gevolg. */
  loanTalks?: { season: number; weeksLeft: number; bought?: boolean };
  /** Zijn kwaliteit toen hij bij de club kwam, om zijn groei te kunnen tonen. */
  startQuality: number;
  purchasePrice: number; // wat de club betaalde (0 = eigen kern of transfervrij)
  bidFactor: number; // huidige marktstemming voor deze speler (0.7-1.3)
  isYouth: boolean; // uit eigen jeugd
}

export interface PlayerLoan {
  type: 'in' | 'uit'; // in = jij huurt hem, uit = jij leent hem uit
  club: string;
  untilSeason: number; // keert terug op het einde van dit seizoen
  wageShare: number; // uit: deel van het loon dat de andere club betaalt
}

export type StaffRole =
  | 'hoofdtrainer'
  | 'kinesist'
  | 'afgevaardigde'
  | 'scout'
  | 'kantine'
  | 'commercieel'
  | 'jeugdcoordinator'
  | 'assistent' // assistent-trainer
  | 'conditietrainer' // conditietrainer
  | 'keepertrainer'
  | 'analist'
  | 'voeding' // voedingsdeskundige
  | 'merchandising' // verantwoordelijke clubwinkel
  | 'verzorger' // verzorger / masseur
  | 'mentaal'; // mentale coach

export type StaffTrait = 'ambitieus' | 'loyaal' | 'gemakzuchtig' | 'perfectionist' | 'teamspeler';

export type Diploma = 'geen' | 'EUFA C' | 'EUFA B' | 'EUFA A' | 'EUFA Pro';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  skill: number; // 1-100
  trait: StaffTrait;
  wage: number; // euro per week
  diploma: Diploma; // enkel relevant voor trainers
  courseWeeksLeft: number; // > 0 = volgt een opleiding
  courseType: 'diploma' | 'bijscholing' | null;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-5-1';
export type Mentality = 'verdedigend' | 'gebalanceerd' | 'aanvallend';
export type GamePlan = 'balbezit' | 'lange bal' | 'vleugelspel' | 'counter' | 'pressing';
export type TrainingFocus = 'conditie' | 'techniek' | 'tactiek' | 'spelhervattingen' | 'herstel';

/** Alles op de tab Strategie. */
export interface Tactics {
  formation: Formation;
  mentality: Mentality;
  plan: GamePlan; // spelplan tijdens de wedstrijd (sterk/zwak tegen andere spelplannen)
  manualXI: string[]; // speler-ids die de eigenaar zelf in de basis zet (leeg = automatisch)
  benched: string[]; // speler-ids die de eigenaar deze week NIET wil opstellen
  gaps: Partial<Record<Position, number>>; // plaatsen die jij bewust openliet: die vult de trainer niet op
  trainings: number; // trainingen per week (2-5)
  focus: TrainingFocus;
  roles: PlayerRoles; // kapitein, strafschop- en hoekschopnemer
}

export interface PlayerRoles {
  kapitein: string | null;
  strafschop: string | null;
  hoekschop: string | null;
}

/** Taken die je zelf doet of aan een personeelslid overlaat. */
export type TaskId =
  | 'training' // trainingen per week en trainingsfocus
  | 'opstelling' // basiself en formatie
  | 'tactiek' // mentaliteit en spelplan
  | 'spelersrollen' // kapitein, strafschop- en hoekschopnemer
  | 'contracten'
  | 'transfers'
  | 'sponsoring'
  | 'ticketing'
  | 'evenementen'
  | 'vrijwilligers'
  | 'merchandising'
  | 'horeca' // kantineprijzen en concessies
  | 'jeugd' // lidgeld en jeugdwerking
  | 'medisch' // belasting, rust en blessurepreventie
  | 'infrastructuur'; // onderhoud en bouwprojecten

export interface OpponentTeam {
  id: string;
  name: string;
  strength: number; // vergelijkbaar met de teamsterkte van je eigen ploeg
  isRival: boolean;
  plan: GamePlan; // hun gebruikelijke spelplan
  roster: string[]; // namen van hun spelers (voor het tuchtoverzicht)
  clubId: string; // verwijzing naar de club in de wereld (zie WorldClub)
}

/** Wat een club vorig seizoen besliste. */
export type ClubMove = 'versterken' | 'bouwen' | 'jeugd' | 'besparen' | 'stilzitten' | 'problemen' | 'opgedoekt';

/**
 * Een club in de wereld rond jou. Geen beurt-per-beurt simulatie: elke club houdt een
 * handvol eigenschappen bij en neemt één keer per seizoen een beslissing op basis van
 * haar eindpositie, haar budget en haar ambitie. Die beslissing verandert haar sterkte,
 * haar accommodatie of haar jeugdwerking — en dat merk jij volgend seizoen op het veld.
 */
export interface WorldClub {
  id: string;
  name: string;
  divisionLevel: number;
  strength: number; // ploegsterkte, vergelijkbaar met OpponentTeam.strength
  budget: number; // wat ze kunnen uitgeven, in euro
  ambition: number; // 0-100: hoe graag ze hogerop willen
  momentum: number; // -50..50: hoe het de laatste tijd loopt
  stadium: number; // 0-3: accommodatie
  youth: number; // 0-3: jeugdwerking
  trouble: number; // 0-100: financiële zorgen
  defunct: boolean; // opgedoekt; speelt niet meer mee
  lastMove: ClubMove | null; // wat ze vorig seizoen deden
  seasons: { season: number; divisionLevel: number; position: number }[]; // laatste acht seizoenen
}

export interface World {
  clubs: WorldClub[];
}

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Fixture {
  round: number;
  week: number;
  homeId: string;
  awayId: string;
  homeGoals?: number;
  awayGoals?: number;
  homePlan?: GamePlan; // spelplan dat de tegenstander in deze wedstrijd echt speelt
  awayPlan?: GamePlan;
}

/** Kaarten van spelers van andere ploegen (die van jouw spelers staan bij de speler zelf). */
export interface DisciplineRecord {
  teamId: string;
  name: string;
  yellows: number;
  reds: number;
  suspended: number;
}

export interface League {
  divisionLevel: number; // index in DIVISIONS
  teams: OpponentTeam[]; // alle tegenstanders (zonder jouw club)
  fixtures: Fixture[];
  table: TableRow[];
  discipline: DisciplineRecord[];
}

export interface Loan {
  id: string;
  label: string;
  principal: number;
  remaining: number; // resterend kapitaal
  annualRate: number; // bv. 0.05
  weeklyPayment: number;
  weeksLeft: number;
}

export type SponsorKind =
  | 'bord' // reclamebord langs het veld
  | 'jeugd' // jeugdwerking
  | 'bal' // wedstrijdbal van de week
  | 'scherm' // schermen in de kantine
  | 'evenement' // naamsponsor van je evenementen
  | 'bus' // ploegbus en verplaatsingen
  | 'mouw' // mouwsponsor op het shirt
  | 'shirt' // shirtsponsor rug
  | 'hoofdsponsor' // borstsponsor
  | 'stadion'; // stadionnaam

export interface SponsorDeal {
  id: string;
  name: string;
  sector: string;
  kind: SponsorKind;
  weekly: number;
  weeksLeft: number;
  satisfaction: number; // 0-100: hoe tevreden de sponsor is
  extraAskedSeason: number; // seizoen waarin je al om een extra bijdrage vroeg (0 = nooit)
  lockedSeasons?: number; // voor hoeveel seizoenen je tekende (2 of 3 = vast, ook bij promotie)
}

export interface SponsorProspect {
  id: string;
  name: string;
  sector: string;
  maxKind: SponsorKind;
  interest: number; // 0-100: kans dat een gesprek slaagt
  cooldown: number; // weken voor je opnieuw kunt aankloppen
  approached: boolean; // gesprek loopt (antwoord volgende week)
}

export interface PendingIncome {
  weeksLeft: number;
  amount: number;
  category: LedgerCategory;
  label: string;
  volunteers?: number; // nieuwe vrijwilligers die dan aansluiten
}

export interface SponsorOffer extends SponsorDeal {
  expiresInWeeks: number;
  renewalOf?: string; // id van het contract dat verlengd wordt
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export type UpgradeId = 'tribune' | 'kantine' | 'kunstgras' | 'verlichting' | 'opleidingscentrum' | 'recuperatie' | 'wifi' | 'sanitair' | 'parking' | 'scorebord' | 'ploegbus' | 'zonnepanelen';

export interface Construction {
  upgrade: UpgradeId;
  weeksLeft: number;
  seats?: number; // enkel bij een tribune: hoeveel plaatsen erbij komen
  cost?: number; // wat je ervoor betaalde (voor de kalender en het overzicht)
}

export interface Infrastructure {
  capacity: number;
  kantineLevel: number; // 1-5
  pitch: 'natuurgras' | 'kunstgras';
  lightingLevel: number; // 1-3
  academyLevel: number; // 0-3: jeugdopleidingscentrum
  recoveryLevel: number; // 0-2: recuperatieruimte (ijsbad, sauna)
  wifiLevel: number; // 0-2: wifi en mobiel bereik op het complex
  sanitairLevel: number; // 0-2: toiletten en kleedkamers
  parkingLevel: number; // 0-2: parkeerplaatsen
  scoreboardLevel: number; // 0-2: scorebord met reclame
  teamBus: boolean; // eigen ploegbus
  maintenance: 'basis' | 'normaal' | 'premium'; // hoeveel je aan onderhoud en energie besteedt
  greenEnergy: boolean; // zonnepanelen en led: lagere energiefactuur
  constructions: Construction[]; // maximaal twee tegelijk
}

export type MerchItemId = 'sjaal' | 'shirt' | 'tshirt' | 'hoodie' | 'pet' | 'mok' | 'vlag';

export interface MerchItem {
  id: MerchItemId;
  price: number; // jouw verkoopprijs
  addedSeason: number;
  soldTotal: number;
}

export interface Merch {
  active: boolean; // clubwinkel opgestart?
  items: MerchItem[]; // wat je aanbiedt
  lastUnits: { id: MerchItemId; units: number; revenue: number }[]; // verkoop van de afgelopen week
  seasonUnits: number;
}

export type CanteenItemId = 'pils' | 'frisdrank' | 'water' | 'koffie' | 'chips' | 'soep';
export type ConcessionId = 'hotdog' | 'hamburger' | 'frituur' | 'pasta';

export interface CanteenItem {
  id: CanteenItemId;
  price: number; // wat de supporter betaalt
}

export interface Concession {
  id: ConcessionId;
  partner: string;
  marginPct: number; // jouw deel van de omzet (0-100)
  sinceSeason: number;
}

export interface Canteen {
  items: CanteenItem[];
  concessions: Concession[];
  lastCanteen: { id: CanteenItemId; units: number; revenue: number }[];
  lastConcessions: { id: ConcessionId; units: number; revenue: number }[];
}

/** Aantallen per seizoen, voor de tab Cijfers. */
export interface SeasonStats {
  season: number;
  tickets: number;
  attendanceHome: number;
  matchesHome: number;
  merch: Partial<Record<MerchItemId, number>>;
  canteen: Partial<Record<CanteenItemId, number>>;
  concessions: Partial<Record<ConcessionId, number>>;
  youthMembers: number;
  volunteers: number;
  ticketPrice: number;
}

/** Cijfers van één week, voor de weekweergave op de tab Cijfers. */
export interface WeekStats {
  season: number;
  week: number;
  tickets: number;
  canteen: number; // consumpties
  concessions: number; // porties
  merch: number; // artikelen
  revenue: Partial<Record<LedgerCategory, number>>;
}

/** Een vraag die je stelde en waarop je volgende week antwoord krijgt. */
export interface PendingRequest {
  id: string;
  kind: 'sponsor-extra' | 'sponsor-gesprek' | 'contract' | 'lening' | 'huur-verlengen' | 'huur-kopen';
  targetId: string;
  label: string;
  weeksLeft: number;
  /** Het bedrag dat je bood (bij een vraag over een huurspeler). */
  amount?: number;
  payload?: { key: string; principal: number; annualRate: number; weeklyPayment: number; weeks: number };
}

/** Clubrecords: waar je het best ooit stond. */
export interface ClubRecords {
  attendance: number;
  weekIncome: number;
  seasonIncome: number;
  unbeaten: number;
  winStreak: number;
  fanBase: number;
}

/** Wat jij deze week besliste, zodat je het achteraf kunt terugvinden. */
export interface LogEntry {
  season: number;
  week: number;
  text: string;
  kind: 'beslissing' | 'antwoord';
}

export interface Community {
  fanBase: number; // aantal mensen dat potentieel komt kijken
  fanMood: number; // 0-100
  volunteers: number;
  volunteerLoyaltyWeeks: number; // > 0 = na een vrijwilligersfeest haken minder mensen af
  reputation: number; // 0-100
  youthMembers: number;
  youthTeams: number; // ploegjes van U7 tot U17; elke ploeg bindt vrijwilligers en vraagt veldruimte
}

export type InvestorId = 'aannemer' | 'fonds' | 'cooperatie';
export type BackgroundId = 'exspeler' | 'ondernemer' | 'lokaal';

export interface Avatar {
  name: string;
  skin: number; // index in paletten
  hair: number;
  shirt: number;
  background: BackgroundId;
}

export type LedgerCategory =
  | 'tickets'
  | 'kantine'
  | 'clubartikelen'
  | 'inkoop winkel'
  | 'werking winkel'
  | 'sponsors'
  | 'tv-rechten'
  | 'lidgelden'
  | 'subsidies'
  | 'evenementen'
  | 'transfers'
  | 'investeerder'
  | 'leningen'
  | 'meevallers'
  | 'premies'
  | 'verhuur'
  | 'lonen spelers'
  | 'lonen personeel'
  | 'infrastructuur'
  | 'onderhoud & energie'
  | 'bond & verzekering'
  | 'wedstrijdkosten'
  | 'aflossingen'
  | 'opleidingen'
  | 'trainingen'
  | 'tegenslagen'
  | 'boetes'
  | 'tuchtboetes'
  | 'horeca concessies';

export interface LedgerEntry {
  category: LedgerCategory;
  amount: number; // positief = inkomst, negatief = kost
  label: string;
}

export interface NewsItem {
  week: number;
  season: number;
  tone: 'goed' | 'slecht' | 'neutraal';
  text: string;
  /**
   * Waar dit bericht over gaat, als het ergens anders ook al staat.
   *
   * Het weekrapport toont de wedstrijd en het weekmoment elk in een eigen blok, en zette
   * daarnaast het nieuws van die week eronder — met dezelfde uitslag en hetzelfde
   * weekmoment er nog eens in. Met dit merkje kan het rapport die twee overslaan, terwijl
   * ze in de nieuwsstroom op je bureau gewoon blijven staan.
   */
  kind?: 'wedstrijd' | 'moment';
}

export interface WeekRecord {
  season: number;
  week: number;
  totals: Partial<Record<LedgerCategory, number>>;
}

export interface MatchReport {
  week: number;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  attendance: number;
  weather: string;
  ourStrength: number;
  theirStrength: number;
  forfeit?: boolean;
  cards?: string; // samenvatting van de kaarten voor jouw ploeg
  ourPlan?: GamePlan;
  theirPlan?: GamePlan;
  matchup?: number;
  lineup?: { id: string; name: string; position: Position; zone: Position; rating: number }[]; // wie er begon
  scorers?: { name: string; minute: number }[]; // jouw doelpuntenmakers
}

export interface SeasonRecord {
  season: number;
  division: string;
  position: number;
  points: number;
  result: 'promotie' | 'degradatie' | 'behoud' | 'kampioen';
  profit: number; // resultaat van het seizoen
  prize?: number; // kampioenen- of promotiepremie, apart geboekt op het einde van het seizoen
}

export interface PlayerOffer {
  id: string;
  playerId: string;
  club: string;
  amount: number;
  expiresInWeeks: number;
}

export type AmbitionId = 'bescheiden' | 'ambitieus' | 'grootspraak';

export interface SeasonGoal {
  id: string;
  category: 'sportief' | 'financieel' | 'gemeenschap';
  kind: 'plaats' | 'zeges' | 'kas' | 'inkomsten' | 'sponsors' | 'jeugd' | 'publiek' | 'vrijwilligers';
  label: string;
  target: number;
  reward: number;
  unit: string;
}

/** Het weekmoment: één concrete beslissing voor de aftrap. */
export interface WeekChoice {
  id: string;
  season: number;
  week: number;
  title: string;
  text: string;
  options: { id: string; label: string; detail: string }[];
  answer: string | null; // wat je koos (null = nog niet beslist)
  outcome: string | null; // wat het opleverde, voor in het weekrapport
  vars: Record<string, string>; // de ingevulde plaatshouders, zodat het gevolg dezelfde namen gebruikt
  focusPlayerId: string | null; // de speler waar dit moment over gaat
  focusSponsorId: string | null; // de sponsor waar dit moment over gaat
}

/**
 * Een gebeurtenis die nog nawerkt: een verkochte speler, een ruzie, een investering die nog
 * nieuws kan opleveren. Content kan erop toetsen met `{ verhaal: '<naam>' }`.
 */
export interface Storyline {
  name: string;
  season: number;
  week: number;
  weeksLeft: number;
  vars: Record<string, string>; // namen en bedragen uit de oorspronkelijke gebeurtenis
}

/** Je langetermijndoel: de boog waar je hele carrière naartoe werkt. */
export interface CareerState {
  goalId: string | null; // het doel dat je koos (zie src/content/careers.ts)
  chosenSeason: number | null;
  achievedSeason: number | null; // null zolang het nog niet gelukt is
  seasonsByLevel: Record<number, number>; // hoeveel seizoenen je in elke reeks speelde
}

/** Je eigen groei als eigenaar: één laag, vijf niveaus, elk met één voordeel. */
export interface OwnerState {
  level: number; // 1-5
  points: number;
  lastUnlock: string | null; // wat je het laatst ontgrendelde, voor het weekrapport
}

/** Een regel in de clubkroniek: wat er in de geschiedenis van de club is blijven hangen. */
export interface ChronicleEntry {
  season: number;
  week: number;
  text: string;
}

/** De seizoensopening in week 1: voorbeschouwing, doorstromers en de persconferentie. */
export interface SeasonOpening {
  season: number;
  division: string;
  pressPlace: number;
  pressQuote: string;
  pressSource: string;
  newcomers: string[]; // namen van de doorstromers uit de jeugd
  summer: string[]; // wat er deze zomer gebeurde
  goals: SeasonGoal[];
  done: boolean;
}

import type { WeekOrigin } from './origins';

export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  idCounter: number;

  season: number; // 1 = eerste seizoen
  week: number; // 1-52, week 1 = eerste week van juli
  startYear: number;

  avatar: Avatar;
  investor: InvestorId;
  clubId: string;
  clubName: string;

  cash: number;
  weeksNegative: number;
  gameOver: boolean;
  gameOverReason: string;

  ticketPrice: number;
  players: Player[];
  staff: Staff[];
  league: League;
  loans: Loan[];
  sponsors: SponsorDeal[];
  sponsorOffers: SponsorOffer[];
  infrastructure: Infrastructure;
  crest: string; // vorm van het clublogo
  scheme: string; // gekozen kleurenschema (zie src/ui/theme.ts); bepaalt de accentkleur van de hele app
  merch: Merch;
  canteen: Canteen;
  stats: SeasonStats;
  statsHistory: SeasonStats[];
  statsWeeks: WeekStats[]; // laatste 52 weken
  requests: PendingRequest[];
  log: LogEntry[];
  records: ClubRecords;
  lastRecords: string[]; // records die deze week gebroken zijn
  milestones: string[]; // behaalde mijlpalen
  lastMilestones: string[]; // mijlpalen van deze week (voor het weekrapport)
  community: Community;

  derbyRecord: { won: number; drawn: number; lost: number }; // onderlinge balans tegen je aartsrivaal, over alle seizoenen
  weekChoice: WeekChoice | null; // de beslissing van deze week (zie weekmoment.ts)
  lastChoice: { title: string; outcome: string } | null; // wat die beslissing opleverde, voor het weekrapport
  storylines: Storyline[]; // gebeurtenissen die nog kunnen terugkomen
  chronicle: ChronicleEntry[]; // de clubkroniek: wat de moeite is om te onthouden
  career: CareerState; // je langetermijndoel en hoe ver je staat
  owner: OwnerState; // je eigen niveau als eigenaar
  world: World; // de andere clubs, met hun eigen budget, ambitie en geschiedenis
  lastWorldMoves: { club: string; move: ClubMove; text: string }[]; // wat de reeks deze zomer deed
  opening: SeasonOpening | null; // de seizoensopening van week 1, tot je je ambitie uitspreekt
  ambition: AmbitionId | null; // wat je op de persconferentie beloofde
  seasonGoals: SeasonGoal[]; // de drie doelen van het bestuur voor dit seizoen
  lastSeasonSettlement: { ambition: string; goals: string[]; kept: boolean } | null; // de afrekening, voor het seizoensrapport

  inflation: number; // kosten stijgen elk seizoen; sponsors en tickets volgen alleen als jij ze aanpast
  marketIndex: number; // algemene stemming op de transfermarkt (0.7-1.3)
  transferList: Player[]; // spelers die je kunt kopen (purchasePrice = vraagprijs)
  loanMarket: Player[]; // huurspelers van profclubs (purchasePrice = huurvergoeding)
  periodMatches: number; // eigen wedstrijden sinds de laatste evolutie
  eventLog: { season: number; week: number; id: string }[]; // georganiseerde evenementen
  playerOffers: PlayerOffer[]; // biedingen van andere clubs op jouw spelers
  staffMarket: Staff[]; // staff die je kunt aanwerven

  eventCooldowns: Record<string, number>; // evenementen en acties: weken tot het opnieuw kan
  eventCounts: Record<string, number>; // hoe vaak een evenement dit seizoen al plaatsvond
  pending: PendingIncome[]; // opbrengsten die later binnenkomen
  tactics: Tactics;
  delegation: Partial<Record<TaskId, string>>; // taak -> staff-id (ontbreekt = eigenaar)
  transferBudget: number; // wat de scout mag uitgeven als hij transfers regelt
  youthFee: number; // lidgeld per jeugdspeler per seizoen
  prospects: SponsorProspect[];
  sponsorCampaignWeeks: number; // > 0 = een bureau zoekt nieuwe sponsors
  /**
   * Wat jij per soort sponsorplaats vraagt, per week.
   *
   * Leeg betekent: wat de markt voor jouw club normaal vindt. Zet je er zelf een bedrag in,
   * dan is dát je vraagprijs — en bepaalt de markt of er iemand op ingaat.
   */
  sponsorAsk: Partial<Record<SponsorKind, number>>;
  emergencyLoanOffered: boolean;
  promotionsWithInvestor: number;
  investorActive: boolean;
  investorState: { coopRounds: number; coopSeason: number | null; lastPromotionSeason: number } | null; // wat je investeerder bijhoudt
  licenceWarnings: number;

  nextDivisionLevel: number; // wordt bepaald op het einde van het seizoen
  lastMatch: MatchReport | null;
  history: SeasonRecord[];

  seasonTickets: { season: number; price: number; sold: number; revenue: number } | null; // abonnementen van dit seizoen
  lastOrigins: WeekOrigin[]; // waar de grootste posten van de laatste week vandaan kwamen
  lastWeek: LedgerEntry[]; // boekingen van de laatst gespeelde week
  thisWeek: LedgerEntry[]; // boekingen van acties in de huidige week (voor je op volgende week klikt)
  seasonTotals: Partial<Record<LedgerCategory, number>>;
  lastSeasonTotals: Partial<Record<LedgerCategory, number>>;
  cashHistory: number[]; // saldo op het einde van elke week (laatste 104 weken)
  weekHistory: WeekRecord[]; // boekingen per categorie per week (laatste 52 weken)
  news: NewsItem[];
}
