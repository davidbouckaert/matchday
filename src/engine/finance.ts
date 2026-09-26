import type { GameState, Infrastructure } from './types';
import { clamp } from './rng';
import { subsidyFactor } from './career';
import { licenceProblems } from './turn';
import { DIVISIONS } from './data/divisions';
import { inWinterBreak, isWinter } from './calendar';
import type { Factor } from './factors';
import { attendanceFactors, priceFactor, product, spendFactors, volunteerFactor } from './factors';
import { recordOrigin } from './origins';
import { holders, loyaltyRate } from './seasontickets';
import { payLoanWeek, sponsorWeekly } from './loans';
import { book, addNews } from './util';
import { bookMatchdayCatering } from './canteen';
import { OWN_TEAM_ID } from './league';

export type Weather = 'zon' | 'bewolkt' | 'regen' | 'storm' | 'vriesweer';

export const WEATHER_FACTOR: Record<Weather, number> = { zon: 1.12, bewolkt: 1, regen: 0.78, storm: 0.55, vriesweer: 0.7 };

export { priceFactor, volunteerFactor };

export const SPEND_BASE = 5.5; // euro per toeschouwer bij een gemiddelde kantine

export interface AttendanceInput {
  weather: Weather;
  derby: boolean;
  positionFactor: number; // 0.85 (laag in klassement) .. 1.2 (bovenaan)
}

/**
 * Hoeveel volk je bereikbaarheid comfortabel aankan: wie te voet of met de fiets komt,
 * plus de parking. Onder die grens merk je niets; erboven komt van de rest maar een deel
 * opdagen — mensen parkeren in het dorp, één keer, en de volgende keer blijven ze thuis.
 * Een tribune van 2.000 met parking voor een dorpsclub raakt dus nooit vol: tribune en
 * parking zijn verbonden, zonder harde lijn.
 */
export function parkingSupport(state: GameState): number {
  return 600 + state.infrastructure.parkingLevel * 700;
}

/** De vraag: wie er zou willen komen, los van tribune en parking. */
export function attendanceDemand(state: GameState, input: AttendanceInput): number {
  const base = state.community.fanBase * product(attendanceFactors(state));
  const derby = input.derby ? 1.75 : 1; // de derby: iedereen komt kijken
  const awayFans = 25 + state.league.divisionLevel * 30;
  return Math.max(30, base * WEATHER_FACTOR[input.weather] * derby * input.positionFactor + awayFans);
}

export function expectedAttendance(state: GameState, input: AttendanceInput): number {
  const capped = clamp(attendanceDemand(state, input), 30, state.infrastructure.capacity);
  const support = parkingSupport(state);
  const feasible = capped <= support ? capped : support + (capped - support) * 0.6;
  return Math.round(feasible);
}

/**
 * Alles wat de opkomst van déze wedstrijd bepaalde: de vaste clubfactoren plus het weer,
 * de derby en je plaats in het klassement. Dezelfde lijst die `expectedAttendance` gebruikt.
 */
export function attendanceOrigin(state: GameState, input: AttendanceInput): Factor[] {
  const list = [...attendanceFactors(state)];
  list.push({ label: 'Weer', value: WEATHER_FACTOR[input.weather], kind: 'x', source: input.weather });
  if (input.derby) list.push({ label: 'Derby', value: 1.75, kind: 'x', source: 'tegen je aartsrivaal komt iedereen kijken' });
  if (Math.abs(input.positionFactor - 1) > 0.001) {
    list.push({ label: 'Klassement', value: input.positionFactor, kind: 'x', source: 'hoe je ervoor staat in de reeks' });
  }
  const capped = clamp(attendanceDemand(state, input), 30, state.infrastructure.capacity);
  const support = parkingSupport(state);
  if (capped > support) {
    const feasible = support + (capped - support) * 0.6;
    list.push({ label: 'Parking vol', value: feasible / capped, kind: 'x', source: 'wie nergens kwijt kan met zijn auto, blijft thuis — een grotere parking helpt' });
  }
  return list;
}

export function spendPerHead(state: GameState): number {
  return SPEND_BASE * product(spendFactors(state));
}

/** Inkomsten van een thuiswedstrijd. Geeft het aantal toeschouwers terug. */
export const YOUTH_TEAM_COST = 30; // per ploeg per week
export const MATCH_FEE_SHARE = 0.3; // deel van de spelersvergoeding dat aan een wedstrijd hangt
export const WIN_BONUS_SHARE = 0.12; // extra premie voor de basiself na een zege

export const AWAY_SHARE = 0.08; // aandeel van de bezoekende club en de bond in de ticketopbrengst

/**
 * Wie er zondag op de tribune zit, en wie daarvan betaalt.
 *
 * Dit stond er eerst als een ondergrens: de opkomst zakte nooit onder 85% van je abonnees,
 * "want die komen ook als het regent". Dat klonk goed maar deed niets — zelfs bij storm en
 * driehonderd abonnees lag de gewone opkomst nog hoger, dus die grens sloeg nooit aan. En
 * de rest klopte ook niet: alle abonnees werden geacht aanwezig te zijn, wat op een volle
 * tribune betekende dat zij de betalende supporters verdrongen.
 *
 * Nu staat er wat er echt gebeurt. Je abonnees komen trouwer dan de rest, maar niet
 * allemaal en niet elke week. Wie niet komt, laat zijn plaats vrij — en als er meer volk
 * wil dan er plaatsen zijn, gaat die plaats naar iemand die aan de kassa betaalt. Een
 * abonnee die thuisblijft kost je dus zijn consumpties, maar op een volle dag levert hij
 * je zijn zitje terug.
 */
function gateSplit(state: GameState, input: AttendanceInput): { attendance: number; subscribersPresent: number; paying: number } {
  const base = expectedAttendance(state, input); // wie er zou komen zonder abonnementen
  const subscribers = holders(state);
  if (!subscribers) return { attendance: base, subscribersPresent: 0, paying: base };

  const capacity = state.infrastructure.capacity;
  // welk deel van je supporters komt deze week? Daar zit het weer al in
  const rate = clamp(base / Math.max(1, state.community.fanBase), 0, 1);
  const present = Math.min(capacity, Math.round(subscribers * loyaltyRate(rate)));
  // die abonnees zouden zonder abonnement ook al deels gekomen zijn; alleen wat ze
  // daarbovenop komen is winst, dus hun gewone aandeel gaat van de rest af
  const others = Math.max(0, base - Math.round(subscribers * rate));
  const paying = Math.max(0, Math.min(others, capacity - present));
  return { attendance: present + paying, subscribersPresent: present, paying };
}

export function bookHomeMatch(state: GameState, input: AttendanceInput, opponentName: string): number {
  const subscribers = holders(state);
  const { attendance, subscribersPresent, paying } = gateSplit(state, input);
  // uitverkocht of vastgelopen op de parking: dat hoor je, want het is geld dat je laat liggen
  const demand = Math.round(attendanceDemand(state, input));
  const turnedAway = Math.max(0, demand - attendance);
  const parkingBindt = Math.min(demand, state.infrastructure.capacity) > parkingSupport(state);
  if (parkingBindt) state.community.fanMood = clamp(state.community.fanMood - 0.8, 0, 100);
  if (turnedAway > 40 && (state.eventCooldowns['uitverkocht'] ?? 0) === 0) {
    state.eventCooldowns['uitverkocht'] = 6;
    addNews(
      state,
      'neutraal',
      `Tegen ${opponentName} wilden ongeveer ${demand.toLocaleString('nl-BE')} mensen komen en geraakten er maar ${attendance.toLocaleString('nl-BE')} binnen. ${
        parkingBindt ? 'De parking liep het eerst vol: wie zijn auto niet kwijt kon, blijft de volgende keer thuis.' : 'Een grotere tribune zou zichzelf terugbetalen.'
      }`,
    );
  }
  const gross = paying * state.ticketPrice;
  book(
    state,
    'tickets',
    gross,
    subscribers
      ? `Tickets tegen ${opponentName} (${paying} × €${state.ticketPrice} aan de kassa; ${subscribersPresent} van je ${subscribers} abonnees kwamen kijken, zij betaalden vooraf)`
      : `Tickets tegen ${opponentName} (${attendance} × €${state.ticketPrice})`,
  );
  if (gross > 0) recordOrigin(state, 'tickets', `Tickets tegen ${opponentName}`, gross, attendanceOrigin(state, input), state.community.fanBase * state.ticketPrice);
  book(state, 'wedstrijdkosten', -gross * AWAY_SHARE, `Aandeel bezoekers en bond (${Math.round(AWAY_SHARE * 100)}% van de ticketverkoop)`);
  bookMatchdayCatering(state, attendance, opponentName);
  book(state, 'wedstrijdkosten', -(250 + 120 + state.league.divisionLevel * 150), `Scheidsrechter en organisatie thuiswedstrijd tegen ${opponentName}`);
  state.stats.tickets += attendance;
  state.stats.attendanceHome += attendance;
  state.stats.matchesHome += 1;
  return attendance;
}

export function bookAwayMatch(state: GameState, opponentName: string): void {
  const bus = state.infrastructure.teamBus ? 0.45 : 1; // met een eigen bus betaal je alleen brandstof en chauffeur
  book(state, 'wedstrijdkosten', -(300 + state.league.divisionLevel * 200) * bus, `Busvervoer naar de uitwedstrijd bij ${opponentName}`);
}

/** Wat je per week aan onderhoud en energie kiest te besteden. */
export const MAINTENANCE_FACTOR: Record<Infrastructure['maintenance'], number> = { basis: 0.75, normaal: 1, premium: 1.3 };

export function facilityCost(state: GameState): number {
  const i = state.infrastructure;
  let cost = 726 + i.capacity * 0.34 + (i.pitch === 'natuurgras' ? 430 : 160) + i.kantineLevel * 70 + i.academyLevel * 400;
  cost += i.wifiLevel * 60 + i.toiletLevel * 45 + i.kleedkamerLevel * 45 + i.parkingLevel * 45 + i.recoveryLevel * 90 + i.scoreboardLevel * 55 + (i.teamBus ? 95 : 0);
  if (isWinter(state.week)) cost += 180 * i.lightingLevel + 150;
  cost *= MAINTENANCE_FACTOR[i.maintenance];
  if (i.solarPanels) cost *= 0.86; // zonnepanelen op de daken
  if (i.ledLighting) cost *= 0.94; // led binnen en rond het veld
  return Math.round(cost * state.inflation);
}

// Het defectrisico van zuinig onderhoud loopt via het content-event "defect"
// (src/content/events.ts). Er stond hier ook nog een eigen kansfunctie die door niets in
// de motor gebruikt werd — twee waarheden over hetzelfde risico. Die is opgeruimd.

/** Vaste wekelijkse inkomsten en kosten. */
export function bookWeeklyFlows(state: GameState): void {
  // uitgeleende spelers: de andere club betaalt een deel van het loon
  // In het amateurvoetbal is een deel van de vergoeding een wedstrijdpremie: geen wedstrijd, geen premie.
  const playing = state.league.fixtures.some((f) => f.week === state.week && (f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID));
  const share = playing ? 1 : 1 - MATCH_FEE_SHARE;
  const playerWages = state.players.reduce((s, p) => s + p.wage * share * (p.loan?.type === 'uit' ? 1 - p.loan.wageShare : 1), 0);
  const staffWages = state.staff.reduce((s, x) => s + x.wage, 0);
  book(state, 'lonen spelers', -playerWages, playing ? 'Spelersvergoedingen (vast deel en wedstrijdpremie)' : 'Spelersvergoedingen (vast deel, geen wedstrijdpremie)');
  book(state, 'lonen personeel', -staffWages, 'Lonen personeel');
  book(state, 'onderhoud & energie', -facilityCost(state), 'Onderhoud terreinen, energie, materiaal');
  // elke jeugdploeg kost geld: ballen, uitrusting, scheidsrechters, verplaatsingen, tornooien
  const youthCost = state.community.youthMembers * 3 + state.community.youthTeams * YOUTH_TEAM_COST;
  book(state, 'onderhoud & energie', -Math.round(youthCost), `Werking jeugd (${state.community.youthTeams} ploegen: materiaal, scheidsrechters, verplaatsingen)`);
  book(state, 'sponsors', sponsorWeekly(state), 'Sponsorcontracten');

  // tijdens de winterstop ligt alles stil: geen jeugdwedstrijden, veel minder volk in de kantine
  const breakFactor = inWinterBreak(state.week) ? 0.45 : 1;
  const trainingBar = (380 * (0.8 + state.infrastructure.kantineLevel * 0.1) * volunteerFactor(state) + state.community.youthMembers * 1.2) * breakFactor;
  const barLabel = inWinterBreak(state.week) ? 'Kantine tijdens de winterstop' : 'Kantine tijdens trainingen en jeugdwedstrijden';
  book(state, 'kantine', trainingBar, barLabel);
  recordOrigin(
    state,
    'kantine',
    barLabel,
    trainingBar,
    [
      { label: 'Kantineniveau', value: 0.8 + state.infrastructure.kantineLevel * 0.1, kind: 'x', source: `niveau ${state.infrastructure.kantineLevel}/5` },
      { label: 'Vrijwilligers', value: volunteerFactor(state), kind: 'x', source: `${state.community.volunteers} vrijwilligers (14 = normaal)` },
      ...(breakFactor !== 1 ? [{ label: 'Winterstop', value: breakFactor, kind: 'x' as const, source: 'geen competitie, veel minder volk' }] : []),
    ],
    380 + state.community.youthMembers * 1.2,
  );

  if (state.infrastructure.pitch === 'kunstgras') book(state, 'verhuur', 650, 'Verhuur kunstgrasveld');

  const tv = DIVISIONS[state.league.divisionLevel].tvRightsPerWeek;
  if (tv > 0) book(state, 'tv-rechten', Math.round(tv * state.inflation), 'Tv- en radiorechten');

  // Meespelen op een hoger niveau kost geld, los van wat je zelf gebouwd hebt: duurdere
  // scheidsrechters, verplichte afgevaardigden en stewards, een licentiedossier, en
  // verplaatsingen die van de buurgemeente naar de andere kant van het land gaan. Dit is de
  // rekening die je meteen bij een promotie krijgt, nog voor je spelers meer beginnen vragen.
  const reeks = DIVISIONS[state.league.divisionLevel];
  book(
    state,
    'bond & verzekering',
    -Math.round(reeks.weeklyCost * state.inflation),
    `Bond, scheidsrechters en verplaatsingen (${reeks.name})`,
  );

  for (const loan of state.loans) {
    const paid = payLoanWeek(loan);
    book(state, 'aflossingen', -paid, `Afbetaling ${loan.label}`);
    if (loan.remaining <= 0) addNews(state, 'goed', `${loan.label} is volledig afbetaald.`);
  }
  state.loans = state.loans.filter((l) => l.remaining > 0);
}

/** Jaarlijkse aansluiting en verzekering, ook gebruikt in de kredietraming. */
export function annualInsuranceCost(state: GameState): number {
  const c = state.community;
  return (5000 + state.players.length * 150 + c.youthMembers * 22 + c.youthTeams * 400) * (1 + state.league.divisionLevel * 0.35) * state.inflation;
}

// ---------- Gemeentesubsidie ----------
//
// Vroeger kwam dit bedrag elk seizoen vanzelf binnen (week 24, zonder één klik). Nu is
// het een aanvraag: het bedrag bleef dezelfde formule (dus wie hem binnenhaalt, merkt
// geen balansverschil), maar de gemeente kijkt naar je dossier — vooral je jeugdwerking,
// daarnaast je reputatie en of je licentie op orde is — en kan nee zeggen.

/** Wat de gemeente toekent als ze ja zegt. */
export function subsidieBedrag(state: GameState): number {
  return Math.round((8000 + state.community.youthMembers * 25) * (1 + state.league.divisionLevel * 0.12) * subsidyFactor(state) * state.inflation);
}

/** De kans op een ja, en de zwakste plek in je dossier (voor de afwijzingsbrief). */
export function subsidieKans(state: GameState): { kans: number; zwakstePlek: string } {
  const jeugd = Math.min(0.4, state.community.youthTeams * 0.08);
  const reputatie = clamp((state.community.reputation - 40) / 150, -0.15, 0.25);
  const licentie = licenceProblems(state, state.league.divisionLevel).length === 0 ? 0.1 : -0.15;
  const kans = clamp(0.3 + jeugd + reputatie + licentie, 0.05, 0.95);
  const zwakstePlek =
    jeugd <= reputatie && jeugd <= licentie
      ? `te weinig jeugdploegen (${state.community.youthTeams})`
      : reputatie <= licentie
        ? 'een bescheiden reputatie in de streek'
        : 'een licentiedossier dat niet op orde is';
  return { kans, zwakstePlek };
}
