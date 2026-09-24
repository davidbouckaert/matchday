// Alles wat de speler (eigenaar) kan doen binnen een beurt.
// Elke actie past de speltoestand aan en geeft terug of het gelukt is.

import type {
  ActionResult, CanteenItemId, ConcessionId, Formation, GamePlan, GameState, Infrastructure, Mentality, MerchItemId,
  Player, PlayerLoan, PlayerRoles, StaffRole, TaskId, TrainingFocus, UpgradeId,
} from './types';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { DIVISIONS } from './data/divisions';
import {
  CLUB_EVENTS, CONCESSIONS, COURSES, KRAAMPJES_MAX, MERCH_START_COST, TASKS, UPGRADES, VOLUNTEER_ACTIONS,
  canteenDef, concessionDef, merchDef, roleDef, type ClubEventDef,
} from './data/catalog';
import { MATCH_WEEKS, isTransferWindow } from './calendar';
import { coursePlan } from './training-staff';
import { BANK_MAX, FORMATIONS, currentBid, departureBlock, isCorePlayer, marketValue, overall, wageDemand } from './players';
import { stepPremium, transferWillingness, wantsAway } from './appeal';
import { FOCUS_INFO, MENTALITY_INFO, PLAN_INFO, TRAININGS_MAX, TRAININGS_MIN } from './strategy';
import { emergencyOffer, loanOffers } from './loans';
import { acceptSponsorOffer } from './sponsors';
export { SPONSOR_TERMS, sponsorTerm, termTotal } from './sponsors';
import { hasDiploma, staffSkill } from './staff';
import { taskCapacity, taskSkill, tasksOf } from './delegation';
import { boundVolunteers, freeVolunteers, youthCapacityFactor } from './youth';
import { bestPrice, margin } from './merch';
import { acceptedMargin, concessionForecast, concessionPartner } from './canteen';
import { popularity } from './popularity';
import { expectedAttendance, facilityCost } from './finance';
import { addLog, addNews, book, euro, nextId, weeks } from './util';
import { openStoryline, remember } from './content';
import { MIN_PRICE as SEASON_TICKET_MIN, canSell as canSellTickets, sellSeasonTickets } from './seasontickets';
export * as seasonTickets from './seasontickets';
import { CARRIERE_DOELEN, maxProjects, setCareerGoal } from './career';
import { baseProjects, buildDiscount, buildSpeed, canHoldRound, holdRound, roundForecast } from './investors';

export type { ActionResult };

const fail = (message: string): ActionResult => ({ ok: false, message });

/**
 * "Niet genoeg geld." stond op zes plekken, en dat is precies de melding waar je niets mee
 * kunt: je weet niet hoeveel het kost, niet hoeveel je tekortkomt, en niet wat je eraan
 * kunt doen. Deze zegt alle drie.
 */
export function tooExpensive(state: GameState, cost: number, wat = 'Dit'): string {
  const money = (n: number) => `€${Math.round(n).toLocaleString('nl-BE')}`;
  const tekort = cost - state.cash;
  return `${wat} kost ${money(cost)} en je hebt ${money(state.cash)}. Je komt ${money(tekort)} tekort — bij Geld › Financiën kun je een lening aanvragen.`;
}
const ok = (message: string): ActionResult => ({ ok: true, message });

function guard(state: GameState): ActionResult | null {
  return state.gameOver ? fail('Het spel is afgelopen.') : null;
}

// ---------- Spelers ----------

export function buyPlayer(state: GameState, playerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const p = state.transferList.find((x) => x.id === playerId);
  if (!p) return fail('Die speler staat niet meer op de lijst — een andere club was je voor.');
  if (!isTransferWindow(state.week)) return fail('De transferperiode is gesloten.');
  if (state.players.length >= 30) return fail('Je kern zit vol: dertig spelers is het maximum. Verkoop of leen er eerst een uit.');
  if (p.purchasePrice > state.cash) return fail(tooExpensive(state, p.purchasePrice, `${p.name} kopen`));
  // de speler beslist mee: geld alleen haalt geen speler binnen die jouw club te klein vindt
  const wil = transferWillingness(state, p);
  if (wil.kans < 1 && !createRng(state).chance(wil.kans)) {
    state.transferList = state.transferList.filter((x) => x.id !== playerId);
    addNews(state, 'neutraal', `${p.name} kiest voor een andere club: ${state.clubName} is nog geen ploeg van zijn niveau.`);
    return fail(
      `${p.name} wil niet komen: hij zoekt een club van zijn niveau, en daar hoort ook je stand, je accommodatie en je kleedkamer bij. Zijn makelaar kapt het gesprek af.`,
    );
  }
  // wie boven jouw niveau tóch tekent, laat zich de stap betalen
  const premie = stepPremium(wil);
  if (premie > 1) p.wage = round(p.wage * premie, 5);
  if (state.avatar.background === 'exspeler') p.wage = round(p.wage * 0.95, 5);
  state.transferList = state.transferList.filter((x) => x.id !== playerId);
  if (p.purchasePrice > 0) book(state, 'transfers', -p.purchasePrice, `Aankoop ${p.name}`);
  state.players.push(p);
  addNews(
    state,
    'neutraal',
    `${p.name} tekent bij ${state.clubName}${p.purchasePrice ? ` voor €${p.purchasePrice.toLocaleString('nl-BE')}` : ' (transfervrij)'}${
      premie > 1 ? `. Hij liet zich de stap omlaag betalen: €${p.wage}/week` : ''
    }.`,
  );
  return {
    ok: true,
    message: `${p.name} is aangeworven.`,
    viering: { icon: '🖊️', kop: `${p.name} tekent`, sub: p.purchasePrice ? `voor ${euro(p.purchasePrice)}` : 'transfervrij' },
  };
}

/** Huurlingen en uitgeleende spelers kun je niet verkopen of verlengen. */
function loanBlock(p: { name: string; loan: PlayerLoan | null }): ActionResult | null {
  if (p.loan?.type === 'in') return fail(`${p.name} is gehuurd van ${p.loan.club}.`);
  if (p.loan?.type === 'uit') return fail(`${p.name} is uitgeleend aan ${p.loan.club} tot het einde van het seizoen.`);
  return null;
}

function removePlayerWithFee(state: GameState, playerId: string, amount: number, buyer: string): ActionResult {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  const lb = loanBlock(p);
  if (lb) return lb;
  state.players = state.players.filter((x) => x.id !== playerId);
  for (const other of state.players) other.friends = other.friends.filter((f) => f !== playerId);
  state.playerOffers = state.playerOffers.filter((o) => o.playerId !== playerId);
  book(state, 'transfers', amount, `Verkoop ${p.name} aan ${buyer}`);
  const profit = amount - p.purchasePrice;
  if (state.investor === 'fonds' && state.investorActive && profit > 0) {
    book(state, 'investeerder', -profit * 0.3, `30% transferwinst ${p.name} naar het fonds`);
  }
  // vrienden in de kleedkamer vinden het jammer
  for (const other of state.players) {
    if (p.friends.includes(other.id)) other.morale = clamp(other.morale - 6, 0, 100);
  }
  addNews(state, 'neutraal', `${p.name} vertrekt naar ${buyer} voor €${amount.toLocaleString('nl-BE')}.`);
  remember(state, `${p.name} vertrok naar ${buyer} voor ${euro(amount)}.`);
  // een verkochte speler verdwijnt niet uit je leven: je komt hem nog tegen
  openStoryline(state, 'oudspeler', 78, { speler: p.name, oudeclub: buyer, bedrag: euro(amount) });
  return {
    ok: true,
    message: `${p.name} is verkocht voor €${amount.toLocaleString('nl-BE')}.`,
    viering: { icon: '💰', kop: `${p.name} verkocht`, sub: `voor ${euro(amount)}${buyer === 'een andere club' ? '' : ` aan ${buyer}`}` },
  };
}

/** Verkoop op de open markt tegen het bod van deze week. */
export function sellPlayer(state: GameState, playerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!isTransferWindow(state.week)) return fail('Spelers verkopen kan alleen tijdens de transferperiode.');
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  const block = departureBlock(state, p, 'verkopen');
  if (block) return fail(block);
  return removePlayerWithFee(state, playerId, currentBid(p, state.marketIndex), 'een andere club');
}

export function acceptPlayerOffer(state: GameState, offerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const o = state.playerOffers.find((x) => x.id === offerId);
  if (!o) return fail('Bod niet meer geldig.');
  const target = state.players.find((x) => x.id === o.playerId);
  if (!target) return fail('Speler niet gevonden.');
  const block = departureBlock(state, target, 'verkopen');
  if (block) return fail(block);
  return removePlayerWithFee(state, o.playerId, o.amount, o.club);
}

export function declinePlayerOffer(state: GameState, offerId: string): ActionResult {
  const o = state.playerOffers.find((x) => x.id === offerId);
  if (!o) return fail('Bod niet gevonden.');
  state.playerOffers = state.playerOffers.filter((x) => x.id !== offerId);
  const p = state.players.find((x) => x.id === o.playerId);
  if (p && o.club && p.age <= 23) p.morale = clamp(p.morale - 5, 0, 100); // hij had graag vertrokken
  return ok('Bod geweigerd.');
}

/** Contract met één seizoen verlengen. De speler vraagt het loon dat hij nu waard is. */
/** Wat deze speler vraagt om te verlengen. Vorm, leeftijd en karakter spelen mee. */
export const MAX_NEGOTIATIONS = 3; // na zoveel mislukte gesprekken ligt het stil tot volgend seizoen

export function askingWage(state: GameState, p: Player): number {
  const base = Math.max(p.wage, p.isYouth && p.age < 19 ? 60 : wageDemand(state, p));
  const form = 1 + clamp(p.form, -5, 8) / 40;
  const core = isCorePlayer(state, p) ? 1.08 : 1;
  const mood = p.morale < 50 ? 1.12 : p.morale > 75 ? 0.96 : 1;
  const background = state.avatar.background === 'exspeler' ? 0.95 : 1;
  // elk mislukt gesprek maakt hem koppiger: hij vraagt meer en wil minder graag tekenen
  const stubborn = 1 + p.negotiations * 0.07;
  return round(base * form * core * mood * background * stubborn, 5);
}

/** Hoe een loonbod aanvoelt: onder de vraag doet pijn, ruim erboven geeft een boost. */
export function wageOfferEffect(state: GameState, p: Player, offer: number): { ratio: number; chance: number; morale: number } {
  const ask = askingWage(state, p);
  const ratio = offer / Math.max(1, ask);
  const patience = p.trait === 'professioneel' ? 0.08 : p.trait === 'harde werker' ? 0.05 : p.trait === 'lastpak' ? -0.08 : 0;
  const annoyed = p.negotiations * 0.12; // hij heeft er al genoeg van
  const chance = clamp(0.15 + (ratio - 0.85) * 4 + patience + (p.morale - 55) / 150 - annoyed, 0.02, 0.97);
  // een laag bod doet pijn, en elke volgende poging doet meer pijn: loven en bieden werkt niet
  const lowball = ratio < 0.95 ? (0.95 - ratio) * 40 * (1 + p.negotiations * 0.8) : 0;
  const morale = Math.round(clamp((ratio - 1) * 25 - lowball - p.negotiations * 2, -35, 12));
  return { ratio, chance, morale };
}

/**
 * Verlengen met een loonvoorstel. Bied je te weinig, dan weigert hij en zakt zijn moraal;
 * bied je royaal, dan tekent hij graag, maar je betaalt het elke week.
 */
export function extendContract(state: GameState, playerId: string, offer?: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  // een uitgeleende speler blijft van jou: met hem onderhandelen kan gewoon, ook al speelt hij elders
  if (p.loan?.type === 'in') return fail(`${p.name} is gehuurd van ${p.loan.club}. Zijn contract ligt daar.`);
  if (p.contractUntil >= state.season + 3) return fail('Het contract loopt al lang genoeg.');
  if (p.morale < 35) return fail(`${p.name} is ontevreden en wil niet verlengen.`);
  if (wantsAway(state, p)) {
    return fail(`${p.name} wil niet verlengen: hij is uitgegroeid tot een speler voor een hogere reeks en wil die stap zetten. Verkoop hem nu hij geld waard is, of word zelf de club die bij hem past.`);
  }
  if (p.negotiations >= MAX_NEGOTIATIONS) {
    return fail(`${p.name} wil dit seizoen niet meer onderhandelen: je bood al ${p.negotiations} keer te weinig. Zijn makelaar neemt pas volgend seizoen weer op.`);
  }
  const ask = askingWage(state, p);
  const wage = round(Number.isFinite(offer) && (offer as number) > 0 ? (offer as number) : ask, 5);
  if (wage < 40) return fail('Onder €40 per week tekent niemand.');
  const { chance, morale } = wageOfferEffect(state, p, wage);
  const rng = createRng(state);
  addLog(state, 'beslissing', `Verlenging voorgesteld aan ${p.name}: €${wage}/week (hij vraagt €${ask}).`);
  if (!rng.chance(chance)) {
    p.negotiations++;
    p.morale = clamp(p.morale + Math.min(-3, morale), 0, 100);
    const left = MAX_NEGOTIATIONS - p.negotiations;
    addLog(state, 'antwoord', `${p.name} wijst €${wage}/week af (poging ${p.negotiations}).`);
    if (left <= 0) addNews(state, 'slecht', `De gesprekken met ${p.name} zijn afgesprongen. Hij praat dit seizoen niet meer over een nieuw contract.`);
    return fail(
      `${p.name} wijst €${wage}/week af. Hij vraagt nu ongeveer €${askingWage(state, p)}/week en zijn moraal zakt naar ${Math.round(p.morale)}.` +
        (left > 0 ? ` Je kunt het nog ${left} ${left === 1 ? 'keer' : 'keer'} proberen voor hij afhaakt.` : ' Hij wil dit seizoen niet meer onderhandelen.'),
    );
  }
  p.wage = wage;
  p.contractUntil += 1;
  p.negotiations = 0;
  p.morale = clamp(p.morale + 5 + morale, 0, 100);
  addNews(state, 'goed', `${p.name} verlengt tot einde seizoen ${p.contractUntil} aan €${p.wage}/week.`);
  return {
    ok: true,
    message: `${p.name} verlengt tot einde seizoen ${p.contractUntil} aan €${p.wage}/week.`,
    viering: { icon: '🖊️', kop: `${p.name} verlengt`, sub: `tot einde seizoen ${p.contractUntil} · €${p.wage}/week` },
  };
}

export function releasePlayer(state: GameState, playerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  // Buiten de transferperiode verandert je kern niet: je kunt niet verkopen, niet uitlenen
  // en dus ook niet zomaar iemand de deur wijzen. Dat was het laatste gaatje waardoor je
  // midden in het seizoen onder je minimum kon zakken zonder er nog iets aan te kunnen doen.
  if (!isTransferWindow(state.week)) return fail('Een speler laten gaan kan alleen tijdens de transferperiode.');
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  if (p.loan?.type === 'in') {
    state.players = state.players.filter((x) => x.id !== playerId);
    return ok(`De huur van ${p.name} is beëindigd. Hij keert terug naar ${p.loan.club}.`);
  }
  if (p.loan?.type === 'uit') return fail(`${p.name} is uitgeleend aan ${p.loan.club}.`);
  const rblock = departureBlock(state, p, 'laten gaan');
  if (rblock) return fail(rblock);
  const seasonsLeft = Math.max(0, p.contractUntil - state.season) + 1;
  const weeksLeftInSeason = 52 - state.week;
  const payoff = round(p.wage * Math.min(26, weeksLeftInSeason + (seasonsLeft - 1) * 52) * 0.5, 10);
  state.players = state.players.filter((x) => x.id !== playerId);
  for (const other of state.players) other.friends = other.friends.filter((f) => f !== playerId);
  book(state, 'lonen spelers', -payoff, `Opzegvergoeding ${p.name}`);
  return ok(`Contract van ${p.name} ontbonden. Opzegvergoeding: €${payoff.toLocaleString('nl-BE')}.`);
}

// ---------- Staff ----------

/** Sommige personeelsleden hebben eerst de juiste infrastructuur nodig. */
export function staffLock(state: GameState, role: StaffRole): string | null {
  const i = state.infrastructure;
  if ((role === 'kinesist' || role === 'verzorger') && i.recoveryLevel < 1) {
    return 'Hiervoor heb je eerst een recuperatieruimte nodig (Infrastructuur): zonder behandeltafel, ijsbad en sauna kan hij niet werken.';
  }
  if (role === 'merchandising' && !state.merch.active) return 'Open eerst je clubwinkel (Club › Clubwinkel).';
  if (role === 'jeugdcoordinator' && state.community.youthTeams < 3) {
    return `Je jeugdwerking is te klein voor een vaste coördinator: je hebt minstens 3 jeugdploegen nodig (nu ${state.community.youthTeams}).`;
  }
  if (role === 'analist' && i.wifiLevel < 1) return 'Een data-analist heeft wifi en degelijk bereik nodig om beelden en data binnen te halen (Infrastructuur).';
  if (role === 'kantine' && i.kantineLevel < 2) return 'Je kantine is te basic voor een vaste verantwoordelijke: renoveer eerst naar niveau 2.';
  if (role === 'voeding' && i.kantineLevel < 3) return 'Een voedingsdeskundige heeft een degelijke keuken nodig: kantine niveau 3.';
  if (role === 'keepertrainer' && state.players.filter((p) => p.position === 'DOEL').length < 2) return 'Je hebt minstens twee doelmannen nodig voor een keeperstraining.';
  if (role === 'conditietrainer' && i.lightingLevel < 2 && i.pitch !== 'kunstgras') return 'Zonder degelijke verlichting of kunstgras kan hij in de winter niet werken (Infrastructuur).';
  return null;
}

export function hireStaff(state: GameState, staffId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const s = state.staffMarket.find((x) => x.id === staffId);
  if (!s) return fail('Kandidaat niet meer beschikbaar.');
  const current = state.staff.filter((x) => x.role === s.role).length;
  if (current >= roleDef(s.role).max) return fail(`Je hebt al een ${roleDef(s.role).label.toLowerCase()}. Ontsla eerst de huidige.`);
  const lock = staffLock(state, s.role);
  if (lock) return fail(lock);
  const signingFee = s.wage * 2;
  book(state, 'lonen personeel', -signingFee, `Tekengeld ${s.name}`);
  state.staffMarket = state.staffMarket.filter((x) => x.id !== staffId);
  state.staff.push(s);
  addLog(state, 'beslissing', `${s.name} aangeworven als ${roleDef(s.role).label.toLowerCase()} (€${s.wage}/week).`);
  addNews(state, 'neutraal', `${s.name} is de nieuwe ${roleDef(s.role).label.toLowerCase()}.`);
  return {
    ok: true,
    message: `${s.name} aangeworven.`,
    viering: { icon: '🤝', kop: `${s.name} is aan boord`, sub: roleDef(s.role).label },
  };
}

export function fireStaff(state: GameState, staffId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return fail('Staflid niet gevonden.');
  const payoff = s.wage * 8;
  book(state, 'lonen personeel', -payoff, `Opzegvergoeding ${s.name}`);
  state.staff = state.staff.filter((x) => x.id !== staffId);
  const dropped: string[] = [];
  for (const t of TASKS) {
    if (state.delegation[t.id] === staffId) {
      delete state.delegation[t.id];
      dropped.push(t.label.toLowerCase());
    }
  }
  if (dropped.length) addNews(state, 'neutraal', `Na het vertrek van ${s.name} doe je zelf weer: ${dropped.join(', ')}.`);
  if (s.role === 'hoofdtrainer') state.players.forEach((p) => (p.morale = clamp(p.morale - 3, 0, 100)));
  return ok(`${s.name} is ontslagen (vergoeding €${payoff.toLocaleString('nl-BE')}).`);
}

/**
 * Wissel je huidige man voor deze kandidaat, in één beslissing: opzegvergoeding voor wie
 * vertrekt plus tekengeld voor wie komt, en de taken van de vertrekker gaan mee naar zijn
 * opvolger voor zover die ze aankan. Dit bestond niet, en dan kon je in de kandidatenlijst
 * op "Aanwerven" klikken en pas dáárna horen dat de plaats bezet was.
 */
export function replaceStaff(state: GameState, staffId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const c = state.staffMarket.find((x) => x.id === staffId);
  if (!c) return fail('Kandidaat niet meer beschikbaar.');
  const zittend = state.staff.find((x) => x.role === c.role);
  if (!zittend) return hireStaff(state, staffId);
  const lock = staffLock(state, c.role);
  if (lock) return fail(lock);
  const cost = zittend.wage * 8 + c.wage * 2;
  if (state.cash < cost) return fail(tooExpensive(state, cost, `${zittend.name} vervangen door ${c.name}`));
  // zijn taken verhuizen stil mee: anders meldt het ontslag "doe je zelf weer" over taken
  // die vijf regels later gewoon bij zijn opvolger liggen
  const taken = tasksOf(state, zittend.id);
  for (const t of taken) delete state.delegation[t];
  const naam = zittend.name;
  fireStaff(state, zittend.id);
  const hired = hireStaff(state, staffId);
  if (!hired.ok) return hired;
  const mee: string[] = [];
  for (const t of taken) {
    if (delegateTask(state, t, c.id).ok) mee.push(TASKS.find((x) => x.id === t)!.label.toLowerCase());
  }
  return {
    ok: true,
    message: `${naam} vertrekt met een opzegvergoeding; ${c.name} neemt de functie over${mee.length ? ` en ook: ${mee.join(', ')}` : ''}.`,
    viering: hired.viering,
  };
}

/** Diploma-opleiding voor de hoofdtrainer en de assistent-trainer, of bijscholing voor iedereen. */
export function startCourse(state: GameState, staffId: string, type: 'diploma' | 'bijscholing' = 'diploma'): ActionResult {
  const g = guard(state);
  if (g) return g;
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return fail('Staflid niet gevonden.');
  if (s.courseWeeksLeft > 0) return fail('Volgt al een opleiding.');
  if (type === 'diploma') {
    if (!hasDiploma(s.role)) return fail('Alleen de hoofdtrainer en de assistent-trainer volgen een diplomaopleiding.');
    const course = COURSES.find((c) => c.from === s.diploma);
    if (!course) return fail(`${s.name} heeft al het hoogste diploma. Verder komt hij alleen nog met bijscholing.`);
    if (state.cash < course.cost) return fail(tooExpensive(state, course.cost, `De opleiding ${course.to}`));
    book(state, 'opleidingen', -course.cost, `Opleiding ${course.to} voor ${s.name}`);
    s.courseWeeksLeft = course.weeks;
    s.courseType = 'diploma';
    return ok(`${s.name} start de opleiding ${course.to} (${course.weeks} weken). Tijdens de opleiding werkt hij op 60%.`);
  }
  // Bijscholing werkt nu per ster: elke trap kost ruim het dubbele van de vorige en duurt
  // langer, en de laatste twee zitten achter je klassement. Zo blijft opleiden in elke fase
  // van het spel een echte afweging tegenover een dure kracht kopen.
  const plan = coursePlan(state, s);
  if (plan.blocked) return fail(plan.blocked);
  book(state, 'opleidingen', -plan.cost, `Opleiding ${s.name} naar ${plan.toStar} sterren`);
  s.courseWeeksLeft = plan.weeks;
  s.courseType = 'bijscholing';
  return ok(
    `${s.name} gaat ${plan.weeks} weken op opleiding naar ${plan.toStar} sterren (€${plan.cost.toLocaleString('nl-BE')}). Zolang hij bezig is, werkt hij op 60%.`,
  );
}

// ---------- Financiën ----------

/**
 * Een lening aanvragen. De bank bekijkt je dossier en laat volgende week iets weten.
 * Een noodlening die de bank zelf aanbiedt, staat er wel meteen op.
 */
export function takeLoan(state: GameState, key: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const emergency = key === 'nood' && state.emergencyLoanOffered;
  const offer = emergency ? emergencyOffer(state) : loanOffers(state).find((o) => o.key === key);
  if (!offer) return fail('Deze lening is niet (meer) beschikbaar.');
  if (emergency) {
    grantLoan(state, offer);
    state.emergencyLoanOffered = false;
    return ok(`Noodlening van €${offer.principal.toLocaleString('nl-BE')} ontvangen.`);
  }
  if (state.requests.some((r) => r.kind === 'lening')) return fail('Je hebt al een kredietaanvraag lopen. Wacht het antwoord van de bank af.');
  state.requests.push({
    id: nextId(state, 'rq'),
    kind: 'lening',
    targetId: key,
    label: `Kredietaanvraag ${offer.label} (${euro(offer.principal)})`,
    weeksLeft: 1,
    payload: { key, principal: offer.principal, annualRate: offer.annualRate, weeklyPayment: offer.weeklyPayment, weeks: offer.weeks },
  });
  addLog(state, 'beslissing', `Kredietaanvraag ingediend: ${offer.label}, ${euro(offer.principal)} aan ${(offer.annualRate * 100).toFixed(1)}%.`);
  return ok(`Je aanvraag is ingediend. De bank laat volgende week weten of ze €${offer.principal.toLocaleString('nl-BE')} toestaat.`);
}

/** Zet een toegekende lening effectief op de rekening. */
export function grantLoan(state: GameState, offer: { label: string; principal: number; annualRate: number; weeklyPayment: number; weeks: number }): void {
  state.loans.push({
    id: nextId(state, 'l'),
    label: offer.label,
    principal: offer.principal,
    remaining: offer.principal,
    annualRate: offer.annualRate,
    weeklyPayment: offer.weeklyPayment,
    weeksLeft: offer.weeks,
  });
  book(state, 'leningen', offer.principal, offer.label);
}

export function repayLoan(state: GameState, loanId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return fail('Lening niet gevonden.');
  const penalty = round(loan.remaining * 0.02, 10);
  const total = loan.remaining + penalty;
  if (state.cash < total) return fail(`Je hebt €${total.toLocaleString('nl-BE')} nodig (inclusief 2% boete).`);
  book(state, 'aflossingen', -total, `Vervroegde aflossing ${loan.label}`);
  state.loans = state.loans.filter((l) => l.id !== loanId);
  return ok('Lening volledig afgelost.');
}

export function setTicketPrice(state: GameState, price: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!Number.isFinite(price) || price < 0 || price > 100) return fail('Kies een prijs tussen €0 en €100.');
  state.ticketPrice = Math.round(price);
  addLog(state, 'beslissing', `Ticketprijs op €${state.ticketPrice} gezet.`);
  const ref = DIVISIONS[state.league.divisionLevel].refTicketPrice;
  if (state.investor === 'cooperatie' && price > ref * 1.2) {
    addNews(state, 'slecht', 'De leden van de coöperatie protesteren tegen de hoge ticketprijs.');
  }
  return ok(`Ticketprijs is nu €${state.ticketPrice}.`);
}

/**
 * Een sponsoraanbod tekenen. `id` is het aanbod, eventueel met de looptijd erachter:
 * "sp12:3" tekent voor drie seizoenen. Zonder looptijd is het één seizoen.
 */
export function acceptSponsor(state: GameState, id: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const [offerId, term] = id.split(':');
  const seasons = (Number(term) === 2 ? 2 : Number(term) === 3 ? 3 : 1) as 1 | 2 | 3;
  return acceptSponsorOffer(state, offerId, seasons);
}

export function declineSponsor(state: GameState, offerId: string): ActionResult {
  state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== offerId);
  return ok('Aanbod geweigerd.');
}

export { approachProspect, networkEvening, startCampaign, cancelSponsor, askExtra, renewSponsor, setSponsorAsk, resetSponsorAsk } from './sponsors';

// ---------- Infrastructuur ----------

export const MAX_PROJECTS = 2; // standaard aantal bouwwerven dat tegelijk mag lopen

/** Zoveel bouwwerven mogen er bij jou tegelijk lopen; vanaf voorzitter is dat er een meer. */
export function projectLimit(state: GameState): number {
  // je eigen niveau geeft er een bij bovenop wat je investeerder toelaat
  return baseProjects(state) + (maxProjects(state) - MAX_PROJECTS);
}

// ---------- Tribune: jij kiest hoeveel plaatsen ----------

export const TRIBUNE_MIN = 100;
export const TRIBUNE_MAX = 2000;
export const TRIBUNE_STEP = 50;

/**
 * Prijs per zitje. Een aannemer die 1.000 stoelen plaatst rekent minder per stuk dan een
 * aannemer die er 100 plaatst: dezelfde kraan, dezelfde ploeg, dezelfde opstart. De korting
 * loopt bovendien op naarmate de bestelling groeit (het kwadratische stuk), zodat één grote
 * tribune duidelijk voordeliger is dan drie kleine blokken.
 * Van ±€450 per zitje bij 100 plaatsen naar ±€215 bij 2.000.
 */
export function tribunePerSeat(state: GameState, seats: number): number {
  const n = clamp(seats, TRIBUNE_MIN, TRIBUNE_MAX);
  const base = 450 - 150 * Math.log10(n / TRIBUNE_MIN) - 40 * (n / TRIBUNE_MAX) ** 2;
  const discount = buildDiscount(state);
  return Math.round(base * discount * state.inflation);
}

export function tribuneCost(state: GameState, seats: number): number {
  return round(clamp(seats, TRIBUNE_MIN, TRIBUNE_MAX) * tribunePerSeat(state, seats), 1000);
}

/** Grotere werken duren langer: van 4 weken voor een klein blok tot een half seizoen voor een echte tribune. */
export function tribuneWeeks(seats: number): number {
  return clamp(Math.round(3 + clamp(seats, TRIBUNE_MIN, TRIBUNE_MAX) / 110), 4, 22);
}

// ---------- Bouwprojecten ----------

export function upgradeCost(state: GameState, id: UpgradeId, seats = 300): number {
  if (id === 'tribune') return tribuneCost(state, seats);
  if (id === 'zonnepanelen' || id === 'ledverlichting') return greenEnergyCost(state, id);
  if (id === 'kraampjes') return kraampjesCost(state);
  const def = UPGRADES.find((u) => u.id === id)!;
  return round(def.cost * buildDiscount(state), 1000);
}

/**
 * Hoelang een werf duurt. Met de aannemer aan boord krijgen zijn ploegen voorrang en
 * is alles een kwart sneller klaar.
 */
export function upgradeWeeks(state: GameState, id: UpgradeId, seats = 300): number {
  const base = id === 'tribune' ? tribuneWeeks(seats) : UPGRADES.find((u) => u.id === id)!.weeks;
  return Math.max(2, Math.round(base * buildSpeed(state)));
}

/** Loopt dit project al? */
export function isBuilding(state: GameState, id: UpgradeId): boolean {
  return state.infrastructure.constructions.some((c) => c.upgrade === id);
}

export function canUpgrade(state: GameState, id: UpgradeId): string | null {
  const i = state.infrastructure;
  if (isBuilding(state, id)) return 'Dit project is al bezig.';
  const limit = projectLimit(state);
  if (i.constructions.length >= limit) return `Er lopen al ${limit} bouwprojecten. Wacht tot er een klaar is.`;
  if (id === 'kantine' && i.kantineLevel >= 5) return 'De kantine is al op het hoogste niveau.';
  if (id === 'verlichting' && i.lightingLevel >= 3) return 'De verlichting is al op het hoogste niveau.';
  if (id === 'kunstgras' && i.pitch === 'kunstgras') return 'Er ligt al kunstgras.';
  if (id === 'opleidingscentrum' && i.academyLevel >= 3) return 'Het opleidingscentrum is al op het hoogste niveau.';
  if (id === 'recuperatie' && i.recoveryLevel >= 2) return 'De recuperatieruimte is al op het hoogste niveau.';
  if (id === 'wifi' && i.wifiLevel >= 2) return 'De wifi is al op het hoogste niveau.';
  if (id === 'toiletten' && i.toiletLevel >= 2) return 'De toiletten zijn al op het hoogste niveau.';
  if (id === 'kleedkamers' && i.kleedkamerLevel >= 2) return 'De kleedkamers zijn al op het hoogste niveau.';
  if (id === 'parking' && i.parkingLevel >= 2) return 'De parking is al op het hoogste niveau.';
  if (id === 'scorebord' && i.scoreboardLevel >= 2) return 'Het scorebord is al op het hoogste niveau.';
  if (id === 'ploegbus' && i.teamBus) return 'Je hebt al een eigen ploegbus.';
  if (id === 'zonnepanelen' && i.solarPanels) return 'De zonnepanelen liggen er al.';
  if (id === 'ledverlichting' && i.ledLighting) return 'De ledverlichting hangt er al.';
  if (id === 'kraampjes' && i.concessionSpace >= KRAAMPJES_MAX) return 'Meer plaats voor kramen is er niet op het complex.';
  return null;
}

export function startUpgrade(state: GameState, id: UpgradeId, seats = 300): ActionResult {
  const g = guard(state);
  if (g) return g;
  const reason = canUpgrade(state, id);
  if (reason) return fail(reason);
  const def = UPGRADES.find((u) => u.id === id)!;
  const rounded = id === 'tribune' ? clamp(Math.round(seats / TRIBUNE_STEP) * TRIBUNE_STEP, TRIBUNE_MIN, TRIBUNE_MAX) : 0;
  const cost = upgradeCost(state, id, rounded);
  const weeks = upgradeWeeks(state, id, rounded);
  if (state.cash < cost) return fail(tooExpensive(state, cost, def.label));
  const label = id === 'tribune' ? `${def.label} (+${rounded} plaatsen)` : def.label;
  book(state, 'infrastructuur', -cost, label);
  state.infrastructure.constructions.push({ upgrade: id, weeksLeft: weeks, seats: id === 'tribune' ? rounded : undefined, cost });
  addLog(state, 'beslissing', `Bouwproject gestart: ${label} (${weeks} weken, ${euro(cost)}).`);
  const others = state.infrastructure.constructions.length - 1;
  return ok(`Werken gestart: ${label} (${weeks} weken).${others ? ` Er loopt er nog ${others}.` : ''}`);
}

// ---------- Evenementen en vrijwilligers ----------

const WEEK_EVENT_KEY = 'evenement-deze-week';

/**
 * Wat een evenement vandaag kost. Alles wordt duurder: een tent, een band, een traiteur en
 * een zaal kosten in een hogere reeks meer dan in provinciale, en de inflatie telt mee.
 */
export function eventCost(state: GameState, def: ClubEventDef): number {
  return round(def.cost * state.inflation * (1 + state.league.divisionLevel * 0.12), 50);
}

/**
 * Wat men op jouw niveau per gast betaalt. Eén in 3de Nationale; een galadiner in de Pro
 * Liga mag per couvert een veelvoud opbrengen, maar de zaal wordt er niet groter van —
 * de gasten zelf zijn overal begrensd door iets fysieks (zie CLUB_EVENTS in de catalogus).
 */
export function eventPrestige(state: GameState): number {
  return Math.min(3.1, 0.7 + 0.3 * DIVISIONS[state.league.divisionLevel].sponsorFactor);
}

/** Prognose van een evenement: [minimum, maximum] opbrengst. */
export function eventForecast(state: GameState, def: ClubEventDef): [number, number] {
  const c = state.community;
  const ctx = {
    fanBase: c.fanBase,
    youthMembers: c.youthMembers,
    mood: c.fanMood,
    capacity: state.infrastructure.capacity,
    kantineLevel: state.infrastructure.kantineLevel,
    sponsorCount: state.sponsors.length,
    prestige: eventPrestige(state),
  };
  // net als je tickets en je kantine volgt ook de opbrengst van een evenement de prijzen van vandaag
  const mid = def.revenue(ctx) * (1 + staffSkill(state, 'kantine') / 400) * state.inflation;
  return [round(mid * (1 - def.spread), 50), round(mid * (1 + def.spread), 50)];
}

export function eventsThisSeason(state: GameState, id: string): number {
  return state.eventCounts[id] ?? 0;
}

export function canOrganise(state: GameState, def: ClubEventDef): string | null {
  if (def.minLevel !== undefined && state.league.divisionLevel < def.minLevel) {
    return `Pas mogelijk vanaf ${DIVISIONS[def.minLevel].name}: in jouw reeks komt daar te weinig volk op af.`;
  }
  if (def.minKantine !== undefined && state.infrastructure.kantineLevel < def.minKantine) {
    return `Je kantine moet minstens niveau ${def.minKantine} halen (nu ${state.infrastructure.kantineLevel}).`;
  }
  if (def.minCapacity !== undefined && state.infrastructure.capacity < def.minCapacity) {
    return `Je hebt minstens ${def.minCapacity.toLocaleString('nl-BE')} plaatsen nodig (nu ${state.infrastructure.capacity.toLocaleString('nl-BE')}).`;
  }
  if (eventsThisSeason(state, def.id) >= def.maxPerSeason) return `Maximaal ${def.maxPerSeason}× per seizoen: dit seizoen al georganiseerd.`;
  if ((state.eventCooldowns[WEEK_EVENT_KEY] ?? 0) > 0) return 'Er is deze week al een evenement. Maximaal één per week.';
  const wait = state.eventCooldowns[def.id] ?? 0;
  if (wait > 0) return `Nog ${weeks(wait)} wachten.`;
  const free = freeVolunteers(state);
  if (free < def.volunteers) {
    return `Je hebt ${def.volunteers} vrije vrijwilligers nodig (nu ${free}: ${state.community.volunteers} in totaal, ${boundVolunteers(state)} vast bij de jeugd).`;
  }
  if (state.cash < eventCost(state, def)) return tooExpensive(state, eventCost(state, def), def.label);
  return null;
}

export function organiseEvent(state: GameState, eventId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const def = CLUB_EVENTS.find((e) => e.id === eventId);
  if (!def) return fail('Onbekend evenement.');
  const reason = canOrganise(state, def);
  if (reason) return fail(reason);
  const [min, max] = eventForecast(state, def);
  const revenue = round(createRng(state).range(min, max), 10);
  const c = state.community;
  book(state, 'evenementen', -eventCost(state, def), `${def.label}: kosten`);
  state.pending.push({ weeksLeft: def.payoutWeeks, amount: revenue, category: 'evenementen', label: `${def.label}: opbrengst` });
  c.fanMood = clamp(c.fanMood + def.moodBoost, 0, 100);
  c.reputation = clamp(c.reputation + def.reputationBoost, 0, 100);
  if (def.fanBaseBoost) c.fanBase += round((c.fanBase * def.fanBaseBoost) / 100, 1);
  state.eventCooldowns[eventId] = def.cooldown;
  state.eventCooldowns[WEEK_EVENT_KEY] = 1;
  state.eventCounts[eventId] = eventsThisSeason(state, eventId) + 1;
  state.eventLog.push({ season: state.season, week: state.week, id: eventId });
  return ok(`${def.label} georganiseerd (${state.eventCounts[eventId]}/${def.maxPerSeason} dit seizoen). De opbrengst komt binnen over ${weeks(def.payoutWeeks)}.`);
}

export function volunteerAction(state: GameState, actionId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const def = VOLUNTEER_ACTIONS.find((a) => a.id === actionId);
  if (!def) return fail('Die actie bestaat niet meer. Ververs de pagina en probeer opnieuw.');
  const key = `vrijwilligers-${def.id}`;
  if ((state.eventCooldowns[key] ?? 0) > 0) return fail(`Nog ${weeks(state.eventCooldowns[key])} wachten.`);
  const cost = round(def.cost * state.inflation, 50);
  if (state.cash < cost) return fail(tooExpensive(state, cost, def.label));
  const [min, max] = def.gain(state.community.youthMembers);
  const gained = createRng(state).int(min, max);
  book(state, 'evenementen', -cost, def.label);
  state.pending.push({ weeksLeft: def.weeks, amount: 0, category: 'evenementen', label: def.label, volunteers: gained });
  if (def.loyaltyWeeks) state.community.volunteerLoyaltyWeeks = def.loyaltyWeeks;
  state.eventCooldowns[key] = def.cooldown;
  return ok(`${def.label}: resultaat over ${weeks(def.weeks)}.`);
}

// ---------- Opstelling en tactiek ----------

/** Geeft een foutmelding als een personeelslid deze taak overnam. */
export function taskLocked(state: GameState, task: TaskId): ActionResult | null {
  const id = state.delegation[task];
  if (!id) return null;
  const who = state.staff.find((x) => x.id === id);
  const label = TASKS.find((t) => t.id === task)?.label ?? task;
  return fail(`${who?.name ?? 'Je personeelslid'} regelt dit (taak "${label}"). Neem de taak terug bij Personeel om zelf te beslissen.`);
}

export function setFormation(state: GameState, formation: Formation): ActionResult {
  if (!FORMATIONS[formation]) return fail('Onbekende formatie.');
  const locked = taskLocked(state, 'opstelling');
  if (locked) return locked;
  state.tactics.formation = formation;
  state.tactics.manualXI = state.tactics.manualXI.filter((id) => {
    const p = state.players.find((x) => x.id === id);
    return p && state.tactics.manualXI.filter((o) => state.players.find((x) => x.id === o)?.position === p.position).length <= FORMATIONS[formation][p.position];
  });
  return ok(`Formatie: ${formation}.`);
}

export function setMentality(state: GameState, mentality: Mentality): ActionResult {
  if (!MENTALITY_INFO[mentality]) return fail('Onbekende mentaliteit.');
  const locked = taskLocked(state, 'tactiek');
  if (locked) return locked;
  state.tactics.mentality = mentality;
  return ok(`Mentaliteit: ${mentality}.`);
}

export function setPlan(state: GameState, plan: GamePlan): ActionResult {
  if (!PLAN_INFO[plan]) return fail('Onbekend spelplan.');
  const locked = taskLocked(state, 'tactiek');
  if (locked) return locked;
  state.tactics.plan = plan;
  return ok(`Spelplan: ${PLAN_INFO[plan].label}.`);
}

export function setTrainings(state: GameState, trainings: number): ActionResult {
  if (!Number.isInteger(trainings) || trainings < TRAININGS_MIN || trainings > TRAININGS_MAX) return fail(`Kies ${TRAININGS_MIN} tot ${TRAININGS_MAX} trainingen.`);
  const locked = taskLocked(state, 'training');
  if (locked) return locked;
  state.tactics.trainings = trainings;
  return ok(`${trainings} trainingen per week.`);
}

export function setFocus(state: GameState, focus: TrainingFocus): ActionResult {
  if (!FOCUS_INFO[focus]) return fail('Onbekende trainingsfocus.');
  const locked = taskLocked(state, 'training');
  if (locked) return locked;
  state.tactics.focus = focus;
  return ok(`Trainingsfocus: ${FOCUS_INFO[focus].label}.`);
}

/** Zet een speler in of uit de zelfgekozen basiself. */
/**
 * Zet een speler vast in de basis, of haal hem er weer uit. Zit die linie al vol met spelers
 * die jij vastzette, dan maakt de zwakste van hen plaats — je krijgt te horen wie.
 */
export function toggleStarter(state: GameState, playerId: string): ActionResult {
  const locked = taskLocked(state, 'opstelling');
  if (locked) return locked;
  const t = state.tactics;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  if (t.manualXI.includes(playerId)) {
    t.manualXI = t.manualXI.filter((id) => id !== playerId);
    return ok(`${p.name} staat niet meer vast: je trainer kiest weer zelf.`);
  }
  if (p.injuryWeeks > 0) return fail(`${p.name} is geblesseerd en kan niet spelen.`);
  if (p.suspended > 0) return fail(`${p.name} is geschorst.`);
  if (p.loan?.type === 'uit') return fail(`${p.name} is uitgeleend.`);

  t.benched = t.benched.filter((id) => id !== playerId); // vast in de basis en op de bank gaat niet samen
  t.gaps = { ...t.gaps, [p.position]: Math.max(0, (t.gaps?.[p.position] ?? 0) - 1) }; // jij vult de open plaats zelf in
  const room = FORMATIONS[t.formation][p.position];
  const sameLine = t.manualXI
    .map((id) => state.players.find((x) => x.id === id))
    .filter((x): x is Player => !!x && x.position === p.position);
  let replaced = '';
  if (sameLine.length >= room) {
    const weakest = [...sameLine].sort((a, b) => overall(a) - overall(b))[0];
    t.manualXI = t.manualXI.filter((id) => id !== weakest.id);
    replaced = ` ${weakest.name} maakt plaats.`;
  }
  t.manualXI.push(playerId);
  return ok(`${p.name} staat vast in je basiself.${replaced}`);
}

/**
 * Zet een speler op de bank (of haal hem er weer af). Haal je iemand uit je basiself,
 * dan blijft die plaats leeg: je trainer schuift er niet vanzelf een ander in. Zolang er een
 * plaats openstaat, kun je niet naar de volgende week — jij beslist wie er speelt.
 */
export function toggleBench(state: GameState, playerId: string): ActionResult {
  const locked = taskLocked(state, 'opstelling');
  if (locked) return locked;
  const t = state.tactics;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  if (t.benched.includes(playerId)) {
    t.benched = t.benched.filter((id) => id !== playerId);
    return ok(`${p.name} staat niet meer op de wisselbank. Je trainer mag hem weer opstellen.`);
  }
  if (t.benched.length >= BANK_MAX) return fail(`Je wisselbank is vol (${BANK_MAX} spelers). Haal er eerst iemand af.`);
  t.benched.push(playerId);
  t.manualXI = t.manualXI.filter((id) => id !== playerId);
  return ok(`${p.name} zit op de wisselbank: grote kans dat hij invalt en speelminuten pakt.`);
}

/**
 * Eén speler vervangen door een andere. Dit is wat je op het veld doet: je klikt de man
 * die eruit moet, en dan wie er in zijn plaats komt.
 *
 * Bewust géén gat: bij toggleBench blijft de plaats open omdat je dan alleen iemand
 * wegneemt. Hier vul je ze in dezelfde beweging weer op, dus er valt niets te beslissen
 * en je kunt gewoon verder naar de volgende week.
 */
export function swapInLineup(state: GameState, outId: string, inId: string): ActionResult {
  const locked = taskLocked(state, 'opstelling');
  if (locked) return locked;
  if (outId === inId) return fail('Dat is dezelfde speler.');
  const t = state.tactics;
  const out = state.players.find((x) => x.id === outId);
  const inc = state.players.find((x) => x.id === inId);
  if (!out || !inc) return fail('Speler niet gevonden.');
  if (inc.injuryWeeks > 0) return fail(`${inc.name} is geblesseerd en kan niet spelen.`);
  if (inc.suspended > 0) return fail(`${inc.name} is geschorst.`);
  if (inc.loan?.type === 'uit') return fail(`${inc.name} is uitgeleend.`);

  t.manualXI = t.manualXI.filter((id) => id !== outId && id !== inId);
  t.benched = t.benched.filter((id) => id !== inId);
  if (!t.benched.includes(outId)) t.benched.push(outId);
  t.manualXI.push(inId);

  const zone = out.position;
  const note = inc.position === zone ? '' : ` ${inc.name} speelt daar buiten zijn positie.`;
  return ok(`${inc.name} komt in de ploeg voor ${out.name}.${note}`);
}

export function autoLineup(state: GameState): ActionResult {
  const locked = taskLocked(state, 'opstelling');
  if (locked) return locked;
  state.tactics.manualXI = [];
  state.tactics.benched = [];
  state.tactics.gaps = {};
  return ok('Alles losgelaten: je trainer kiest weer de beste elf.');
}

// ---------- Delegeren ----------

export function delegateTask(state: GameState, taskId: TaskId, staffId: string | null): ActionResult {
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) return fail('Onbekende taak.');
  if (staffId === null) {
    delete state.delegation[taskId];
    return ok(`Je doet "${task.label}" weer zelf.`);
  }
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return fail('Staflid niet gevonden.');
  if (!task.roles.includes(s.role)) return fail(`${s.name} kan "${task.label}" niet overnemen.`);
  const already = tasksOf(state, staffId).filter((t) => t !== taskId).length;
  const capacity = taskCapacity(s);
  if (already >= capacity) {
    return fail(`${s.name} heeft er al ${already} taken bij en kan er ${capacity} aan (dat hangt af van zijn vaardigheid). Neem er eerst een weg.`);
  }
  const rank = task.roles.indexOf(s.role);
  state.delegation[taskId] = staffId;
  addLog(state, 'beslissing', `${task.label} → ${s.name}.`);
  return ok(
    rank === 0
      ? `${s.name} neemt "${task.label}" over. Dat is zijn vak, dus hij doet het op zijn volle niveau.`
      : `${s.name} neemt "${task.label}" over. Het is niet zijn vakgebied: hij werkt hier op ${Math.round(taskSkill(state, taskId, s))} van zijn ${s.skill}.`,
  );
}

export function setTransferBudget(state: GameState, amount: number): ActionResult {
  if (!Number.isFinite(amount) || amount < 0) return fail('Geef een bedrag van €0 of meer.');
  state.transferBudget = Math.round(amount);
  return ok(`Transferbudget voor de scout: €${state.transferBudget.toLocaleString('nl-BE')}.`);
}

// ---------- Clubbeleid ----------

export const YOUTH_FEE_REF = 230; // gangbaar lidgeld per seizoen bij een dorpsclub
export const YOUTH_FEE_WEEK = 10; // inschrijvingen

/**
 * Wat een lidgeld normaal is voor een club op dit niveau.
 *
 * Een dorpsclub in 1ste provinciale vraagt niet wat een club met een opleidingscentrum in
 * de Pro Liga vraagt: daar krijg je betere trainers, meer trainingen en een echt complex.
 * Het gangbare bedrag klimt dus mee met je reeks, en met de inflatie, net als al je andere
 * kosten en prijzen.
 */
export function youthFeeRef(state: GameState): number {
  return Math.round(YOUTH_FEE_REF * (1 + state.league.divisionLevel * 0.18) * state.inflation);
}

/** Het hoogste lidgeld dat je mag vragen. Vier keer het gangbare bedrag is al absurd. */
export function maxYouthFee(state: GameState): number {
  return Math.round((youthFeeRef(state) * 4) / 10) * 10;
}

/** Boven dit bedrag vinden de supporters je een graaier. */
export function youthFeeGrumble(state: GameState): number {
  return Math.round(youthFeeRef(state) * 1.5);
}

/**
 * Hoeveel ouders hun kind bij jou inschrijven, tegenover een club die het gangbare vraagt.
 *
 * Dit was `(gangbaar / jouw prijs)^1,5`, vastgezet tussen 0,3 en 1,8. Die ondergrens was de
 * fout: vanaf ongeveer €510 zakte het ledenaantal niet meer, en vanaf dat punt leverde élke
 * verhoging gewoon meer op. Je kon dus doorschuiven tot honderd leden aan het maximum —
 * de opbrengst daalde van €156 tot €513 en steeg daarna lineair door, met een dal ertussen.
 * Het beste wat je kon doen, was het uiterste van de schuifbalk. Dat is geen keuze.
 *
 * Nu vallen de inschrijvingen boven het gangbare bedrag exponentieel weg: ouders die het te
 * duur vinden, gaan naar de club in het dorp ernaast, en hoe verder je erboven zit hoe
 * sneller dat gaat. Daardoor heeft de opbrengst één top — iets boven het gangbare bedrag —
 * en zakt ze daarna echt weg. Onder het gangbare bedrag stijgt het ledenaantal nog, maar
 * niet eindeloos: er wonen maar zoveel kinderen in de gemeente.
 */
const YOUTH_DECAY = 0.8; // hoe snel ouders afhaken boven het gangbare bedrag
const YOUTH_CHEAP_GAIN = 0.8; // hoeveel meer leden je haalt door goedkoop te zijn

/**
 * Hoe hard ouders zich vasthouden aan jóuw club.
 *
 * De prijsgevoeligheid was voor elke club dezelfde, en dat klopt niet. Als je club goed
 * draait — een naam in de streek, een opleidingscentrum, een coördinator die ouders te
 * woord staat, een ploeg die bovenaan meedoet — dan kijken ouders niet meer alleen naar
 * het bedrag. Ze blijven omdat hun kind hier beter wordt. Een club die achteraan bengelt
 * met een modderveld heeft dat argument niet en verliest bij elke euro meteen leden.
 *
 * Dit cijfer maakt de curve platter of steiler. Rond 1 is gemiddeld; hoger betekent dat je
 * meer kunt vragen voor je de mensen kwijtraakt. Het is bewust begrensd: zonder plafond
 * zou een topclub opnieuw eindeloos kunnen verhogen, en dat was precies de fout die we
 * eruit haalden.
 */
export function youthPull(state: GameState): number {
  const c = state.community;
  const coordinator = staffSkill(state, 'jeugdcoordinator');
  const score =
    (c.reputation - 50) / 220 + // naam in de streek
    state.infrastructure.academyLevel * 0.09 + // een echt opleidingscentrum
    (coordinator - 40) / 320 + // iemand die de ouders kent
    (popularity(state).factor - 1) * 0.5 + // hoe de ploeg het doet
    state.league.divisionLevel * 0.035; // op een hoger niveau word je beter opgeleid
  return clamp(1 + score, 0.7, 1.55);
}

/**
 * Hoeveel ouders hun kind bij jou inschrijven, tegenover een club die het gangbare vraagt.
 *
 * `pull` maakt de helling: hoe sterker je club staat, hoe trager ze afhaken. Bij een zwakke
 * club ligt de beste prijs net ónder het gangbare bedrag, bij een topclub bijna het dubbele.
 */
export function youthPriceFactor(fee: number, ref: number = YOUTH_FEE_REF, pull = 1): number {
  const ratio = Math.max(0, fee) / Math.max(1, ref);
  if (ratio <= 1) return 1 + (1 - ratio) * YOUTH_CHEAP_GAIN; // maximaal 1,8 bij gratis
  return Math.exp(-(ratio - 1) * (YOUTH_DECAY / Math.max(0.3, pull)));
}

/** Hoeveel jeugdleden je bij dit lidgeld mag verwachten. */
export function youthTarget(state: GameState, fee = state.youthFee): number {
  const c = state.community;
  const base = 150 + c.reputation * 2 + staffSkill(state, 'jeugdcoordinator') * 1.5 + state.infrastructure.academyLevel * 40;
  // ouders schrijven hun kinderen liever in bij een club die goed draait,
  // maar niet bij een club zonder begeleiding of zonder plaats op het veld
  const success = popularity(state).factor;
  return Math.round(base * youthPriceFactor(fee, youthFeeRef(state), youthPull(state)) * success * youthCapacityFactor(state));
}

/**
 * Verwacht aantal inschrijvingen bij het volgende inschrijvingsmoment.
 *
 * Een ledenaantal beweegt traag: wie vorig jaar kwam, komt meestal terug, en nieuwe leden
 * komen binnen via broers, zussen en de speelplaats. Daarom schuift het maar half op naar
 * waar de prijs het uiteindelijk brengt.
 *
 * Maar dat mocht niet betekenen dat je bestaande leden élke prijs slikken. Zolang de helft
 * van je huidige ledenaantal bleef zitten wat je ook vroeg, bleef élke verhoging op die
 * helft meer opbrengen — precies dezelfde oneindige arm als in de prijsfactor, één laag
 * dieper. Daarom is er een bovengrens op wat je kunt vasthouden: je houdt nooit meer dan
 * een derde meer leden dan de prijs draagt. Wie het écht te duur vindt, schrijft gewoon
 * niet meer in, en dat gebeurt meteen.
 */
export function youthForecast(state: GameState, fee = state.youthFee): number {
  const c = state.community;
  const target = youthTarget(state, fee);
  if (target >= c.youthMembers) return Math.round(c.youthMembers + (target - c.youthMembers) * 0.5);
  return Math.round(Math.max(0, Math.min(c.youthMembers - (c.youthMembers - target) * 0.5, target * 1.35)));
}

export function setYouthFee(state: GameState, fee: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const max = maxYouthFee(state);
  if (!Number.isFinite(fee) || fee < 0 || fee > max) {
    return fail(`Kies een lidgeld tussen €0 en €${max.toLocaleString('nl-BE')}. Meer vragen dan vier keer het gangbare bedrag heeft geen zin: dan schrijft niemand zijn kind nog in.`);
  }
  state.youthFee = Math.round(fee);
  addLog(state, 'beslissing', `Lidgeld jeugd op €${state.youthFee} per seizoen gezet.`);
  return ok(`Lidgeld jeugd: €${state.youthFee} per seizoen. Het geldt vanaf de inschrijvingen in week ${YOUTH_FEE_WEEK}.`);
}

// ---------- Transferlijst en huur ----------

export function listPlayer(state: GameState, playerId: string, askingPrice: number): ActionResult {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  const lb = loanBlock(p);
  if (lb) return lb;
  if (!Number.isFinite(askingPrice) || askingPrice < 0) return fail('Geef een geldige vraagprijs.');
  p.listed = true;
  p.askingPrice = Math.round(askingPrice);
  p.morale = clamp(p.morale - 4, 0, 100); // hij voelt zich niet gewaardeerd
  return ok(`${p.name} staat te koop voor €${p.askingPrice.toLocaleString('nl-BE')}. Clubs kunnen tijdens de transferperiode een bod doen.`);
}

export function unlistPlayer(state: GameState, playerId: string): ActionResult {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  p.listed = false;
  p.askingPrice = 0;
  return ok(`${p.name} staat niet langer te koop.`);
}

/**
 * Waar je uitgeleende speler terechtkomt: een echte club uit de wereld.
 *
 * Dit was een willekeurige naam uit je eigen reeks, die verder nergens bestond. Een club uit
 * de wereld is wél een club die meedoet, promoveert en degradeert, en dat is precies genoeg.
 * Het scheelde niet veel of hier stond een heel rekenwerk over welke club hem hoeveel beter
 * maakt — maar dat is spelersmanagement tot op het bot, en daar gaat dit spel niet over.
 * Hij speelt, hij groeit, hij komt terug. Waar hij precies zat, is een naam bij het verhaal.
 */
export function loanHost(state: GameState, rng: Rng): { id: string; name: string; divisionLevel: number } {
  const nabij = (state.world?.clubs ?? []).filter((c) => !c.defunct && Math.abs(c.divisionLevel - state.league.divisionLevel) <= 1);
  const kandidaten = nabij.length ? nabij : (state.world?.clubs ?? []).filter((c) => !c.defunct);
  if (kandidaten.length) return rng.pick(kandidaten);
  // geen wereld (een heel oud opgeslagen spel): dan blijft het bij een naam uit je reeks
  return { id: '', name: rng.pick(state.league.teams).name, divisionLevel: state.league.divisionLevel };
}

/** Welk deel van het loon betaalt een andere club als je deze speler uitleent? */
export function loanWageShare(state: GameState, p: Player): number {
  const level = DIVISIONS[state.league.divisionLevel].opponentStrength;
  return Math.round(clamp(0.35 + (overall(p) - level + 10) / 40, 0.25, 1) * 100) / 100;
}

export function loanOut(state: GameState, playerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!isTransferWindow(state.week)) return fail('Uitlenen kan alleen tijdens de transferperiode.');
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  const lb = loanBlock(p);
  if (lb) return lb;
  const lblock = departureBlock(state, p, 'uitlenen');
  if (lblock) return fail(lblock);
  const rng = createRng(state);
  const gastclub = loanHost(state, rng);
  const share = loanWageShare(state, p);
  p.loan = {
    type: 'uit',
    club: gastclub.name,
    clubId: gastclub.id,
    untilSeason: state.season,
    wageShare: share,
    quality: overall(p),
    matches: 0,
  };
  p.listed = false;
  state.tactics.manualXI = state.tactics.manualXI.filter((id) => id !== playerId);
  addNews(
    state,
    'neutraal',
    `${p.name} wordt tot het einde van het seizoen uitgeleend aan ${gastclub.name} (${DIVISIONS[gastclub.divisionLevel].name}). Zij betalen ${Math.round(share * 100)}% van zijn loon.`,
  );
  return ok(
    `${p.name} uitgeleend aan ${gastclub.name} (${Math.round(share * 100)}% van zijn loon betaald). Hij speelt daar elke week en komt sterker terug — je ziet onderweg hoeveel.`,
  );
}

export function loanIn(state: GameState, playerId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!isTransferWindow(state.week)) return fail('Huren kan alleen tijdens de transferperiode.');
  const p = state.loanMarket.find((x) => x.id === playerId);
  if (!p) return fail('Die speler staat niet meer op de lijst — een andere club was je voor.');
  if (state.players.length >= 30) return fail('Je kern zit vol: dertig spelers is het maximum. Verkoop of leen er eerst een uit.');
  if (state.cash < p.purchasePrice) return fail(tooExpensive(state, p.purchasePrice, `${p.name} huren`));
  // ook een huurspeler beslist mee, al aanvaardt hij sneller een stap omlaag: hij komt om te spelen
  const wil = transferWillingness(state, p, true);
  if (wil.kans < 1 && !createRng(state).chance(wil.kans)) {
    state.loanMarket = state.loanMarket.filter((x) => x.id !== playerId);
    addNews(state, 'neutraal', `${p.name} wil niet op uitleenbasis naar ${state.clubName}: hij vindt je club een maat te klein.`);
    return fail(`${p.name} ziet de uitleenbeurt niet zitten: jouw club ligt te ver onder zijn niveau. Zijn club zoekt een andere bestemming.`);
  }
  state.loanMarket = state.loanMarket.filter((x) => x.id !== playerId);
  if (p.purchasePrice) book(state, 'transfers', -p.purchasePrice, `Huurvergoeding ${p.name}`);
  p.loan = { type: 'in', club: p.loan?.club ?? 'profclub', untilSeason: state.season, wageShare: 1 };
  p.contractUntil = state.season;
  state.players.push(p);
  addNews(state, 'goed', `${p.name} wordt tot het einde van het seizoen gehuurd van ${p.loan.club}.`);
  return {
    ok: true,
    message: `${p.name} gehuurd. Jij betaalt €${p.wage}/week, ${p.loan.club} de rest.`,
    viering: { icon: '🖊️', kop: `${p.name} komt op huurbasis`, sub: `van ${p.loan.club} · €${p.wage}/week` },
  };
}

/* ---------- Een huurspeler houden: verlengen of kopen ----------
 *
 * Een huurcontract loopt af op het einde van het seizoen en dan is hij weg. Wil je hem
 * houden, dan moet je het vragen aan de club die eigenaar is — en die beslist, niet jij.
 *
 * Waar zij naar kijken is precies wat een echte club zou bekijken: hoeveel hij bij jou
 * gespeeld heeft, of hij er beter van geworden is, en hoeveel je biedt. Dat levert een
 * spanning op die de moeite waard is om te doorzien. Zet je hem elke week in en groeit hij,
 * dan zijn ze blij en verlengen ze graag — maar kopen wordt juist duurder, want nu weten
 * zij ook wat hij waard is. Laat je hem op de bank zitten, dan willen ze hem terug voor een
 * andere uitleenbeurt, maar verkopen doen ze dan wél makkelijker.
 */

/** Hoe de eigenaar naar zijn speler bij jou kijkt. */
export interface LoanStanding {
  /** Deel van de gespeelde wedstrijden waarin hij in de basis stond (0-1). */
  speeltijd: number;
  /** Hoeveel hij erop vooruitging sinds hij bij jou kwam, in kwaliteitspunten. */
  groei: number;
  /** Hun tevredenheid over de uitleenbeurt, 0-100. */
  tevreden: number;
}

export function loanStanding(state: GameState, p: Player): LoanStanding {
  const gespeeld = Math.max(1, state.league.table.find((r) => r.teamId === 'club')?.played ?? 0);
  const speeltijd = clamp(p.starts / gespeeld, 0, 1);
  const groei = Math.round((p.trend + (overall(p) - p.startQuality)) * 10) / 10;
  const doelpunten = clamp(p.goals / 8, 0, 1);
  const tevreden = Math.round(clamp(30 + speeltijd * 45 + groei * 6 + doelpunten * 12, 0, 100));
  return { speeltijd: Math.round(speeltijd * 100) / 100, groei, tevreden };
}

/** Wat de eigenaar normaal vraagt om hem nog een seizoen te laten blijven. */
export function extensionRef(state: GameState, p: Player): number {
  const basis = marketValue(p, state.marketIndex) * 0.07;
  const { groei } = loanStanding(state, p);
  return round(basis * clamp(1 + groei / 12, 0.7, 1.8), 250);
}

/** Wat de eigenaar normaal vraagt om hem definitief te verkopen. */
export function purchaseRef(state: GameState, p: Player): number {
  const { speeltijd, groei } = loanStanding(state, p);
  // een profclub verkoopt niet graag aan een amateurclub: daar hangt een toeslag aan vast.
  // Hoe beter hij het bij jou deed, hoe minder graag ze hem kwijt willen.
  const toeslag = clamp(1.15 + groei / 14 + speeltijd * 0.15, 1.05, 1.9);
  return round(marketValue(p, state.marketIndex) * toeslag, 500);
}

/**
 * De kans dat ze ja zeggen. Dezelfde rekensom die het antwoord een week later maakt, zodat
 * het scherm niet iets anders kan beweren dan er gebeurt.
 */
export function loanRequestChance(state: GameState, p: Player, soort: 'verlengen' | 'kopen', bod: number): number {
  const { speeltijd, groei } = loanStanding(state, p);
  const ref = soort === 'verlengen' ? extensionRef(state, p) : purchaseRef(state, p);
  const bedrag = clamp(bod / Math.max(1, ref), 0, 3);
  // Een fooi nemen ze niet in behandeling. Zonder dit gaf een bod van één euro op een
  // speler die toch al op de bank zat nog altijd bijna een op drie kans.
  const ernst = clamp(bedrag / 0.3, 0, 1);
  if (soort === 'verlengen') {
    // Zij willen vooral dat hij speelt en beter wordt; geld is bijzaak — maar niet gratis.
    // Bied je het gevraagde bedrag en speelde hij veel, dan is het zo goed als rond. Zat hij
    // op de bank, dan moet je er flink bovenop doen om hen te overtuigen.
    const spelen = (speeltijd - 0.45) * 0.7;
    const groeit = clamp(groei / 14, -0.15, 0.2);
    return clamp((0.15 + bedrag * 0.35 + spelen + groeit) * ernst, 0.01, 0.95);
  }
  // Verkopen is een andere zaak: daar telt het geld. Wie bij jou openbloeide houden ze
  // liever zelf, wie er niet aan te pas kwam laten ze makkelijker gaan.
  const teGoed = clamp(groei / 20, 0, 0.18);
  const bank = clamp((0.5 - speeltijd) * 0.4, -0.1, 0.2);
  return clamp((0.15 + bedrag * 0.5 - teGoed + bank) * ernst, 0.01, 0.92);
}

/** Mag je het op dit moment vragen? */
export function loanRequestBlock(state: GameState, p: Player | undefined, soort: 'verlengen' | 'kopen'): string | null {
  if (!p) return 'Die speler staat niet in je kern.';
  if (p.loan?.type !== 'in') return `${p.name} is geen huurspeler.`;
  if (state.week < LOAN_TALK_WEEK) return `Over een huurspeler praat je pas in de terugronde, vanaf week ${LOAN_TALK_WEEK}.`;
  if (state.requests.some((r) => r.targetId === p.id)) return `Je wacht nog op het antwoord van ${p.loan.club}.`;
  if (p.loanTalks?.season === state.season && (p.loanTalks.weeksLeft ?? 0) > 0) {
    return `${p.loan.club} wil er nog ${weeks(p.loanTalks.weeksLeft)} niet op terugkomen.`;
  }
  if (soort === 'kopen' && p.loanTalks?.bought) return `${p.name} is al van jou.`;
  return null;
}

export const LOAN_TALK_WEEK = 26;

function loanRequest(state: GameState, playerId: string, soort: 'verlengen' | 'kopen', bod: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const p = state.players.find((x) => x.id === playerId);
  const blok = loanRequestBlock(state, p, soort);
  if (blok) return fail(blok);
  if (!Number.isFinite(bod) || bod < 0) return fail('Vul in wat je wil bieden.');
  const bedrag = Math.round(bod);
  if (state.cash < bedrag) return fail(tooExpensive(state, bedrag, soort === 'kopen' ? `${p!.name} kopen` : `De huur van ${p!.name} verlengen`));
  const club = p!.loan!.club;
  state.requests.push({
    id: nextId(state, 'rq'),
    kind: soort === 'verlengen' ? 'huur-verlengen' : 'huur-kopen',
    targetId: p!.id,
    label: soort === 'verlengen' ? `Verlenging gevraagd voor ${p!.name}` : `Bod uitgebracht op ${p!.name}`,
    weeksLeft: 1,
    amount: bedrag,
  });
  addLog(state, 'beslissing', soort === 'verlengen'
    ? `${club} gevraagd of ${p!.name} nog een seizoen mag blijven, voor €${bedrag.toLocaleString('nl-BE')}.`
    : `Bod van €${bedrag.toLocaleString('nl-BE')} uitgebracht op ${p!.name} bij ${club}.`);
  return ok(`${club} bekijkt je vraag. Je hoort het volgende week.`);
}

/** De huur met een seizoen verlengen. */
export function extendLoan(state: GameState, playerId: string, bod: number): ActionResult {
  return loanRequest(state, playerId, 'verlengen', bod);
}

/** Hem definitief kopen. */
export function buyLoanPlayer(state: GameState, playerId: string, bod: number): ActionResult {
  return loanRequest(state, playerId, 'kopen', bod);
}

// ---------- Clubwinkel (merchandising) ----------

/** Clubwinkel opstarten: rekken, kassa, webwinkel en een basisvoorraad sjaals. */
export function startMerch(state: GameState): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (state.merch.active) return fail('Je clubwinkel draait al.');
  if (state.cash < MERCH_START_COST) return fail(`Je hebt €${MERCH_START_COST.toLocaleString('nl-BE')} nodig om de winkel in te richten.`);
  book(state, 'infrastructuur', -MERCH_START_COST, 'Clubwinkel inrichten (rekken, kassa, webwinkel)');
  state.merch.active = true;
  addNews(state, 'goed', 'De clubwinkel is open. Supporters kunnen nu clubartikelen kopen.');
  const first = addMerchItem(state, 'sjaal');
  return ok(`Clubwinkel geopend.${first.ok ? ' De sjaals liggen al in de rekken.' : ''}`);
}

/** Een artikel in het assortiment nemen. Je betaalt eenmalig drukwerk en de eerste voorraad. */
export function addMerchItem(state: GameState, id: MerchItemId): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!state.merch.active) return fail('Start eerst de clubwinkel op.');
  if (state.merch.items.some((i) => i.id === id)) return fail('Dit artikel ligt al in de winkel.');
  const def = merchDef(id);
  if (state.cash < def.setup) return fail(`Eerste voorraad en drukwerk kosten €${def.setup.toLocaleString('nl-BE')}.`);
  book(state, 'werking winkel', -def.setup, `Eerste voorraad en drukwerk ${def.label.toLowerCase()}`);
  state.merch.items.push({ id, price: bestPrice(state, id), addedSeason: state.season, soldTotal: 0 });
  return ok(`${def.label} ligt vanaf nu in de winkel, aan €${state.merch.items.find((i) => i.id === id)!.price}.`);
}

/** Een artikel uit het assortiment halen. De restvoorraad verkoop je met verlies. */
export function removeMerchItem(state: GameState, id: MerchItemId): ActionResult {
  const g = guard(state);
  if (g) return g;
  const item = state.merch.items.find((i) => i.id === id);
  if (!item) return fail('Dit artikel ligt niet in de winkel.');
  const def = merchDef(id);
  state.merch.items = state.merch.items.filter((i) => i.id !== id);
  book(state, 'clubartikelen', round(def.setup * 0.25, 10), `Restvoorraad ${def.label.toLowerCase()} uitverkocht`);
  return ok(`${def.label} verdwijnt uit de winkel. De restvoorraad bracht nog €${round(def.setup * 0.25, 10).toLocaleString('nl-BE')} op.`);
}

export function setMerchPrice(state: GameState, id: MerchItemId, price: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (state.delegation.merchandising) return fail('De clubwinkel is gedelegeerd: je personeelslid bepaalt de prijzen.');
  const item = state.merch.items.find((i) => i.id === id);
  if (!item) return fail('Dit artikel ligt niet in de winkel.');
  const def = merchDef(id);
  if (!Number.isFinite(price) || price < 1 || price > def.ref * 4) return fail(`Kies een prijs tussen €1 en €${Math.round(def.ref * 4)}.`);
  item.price = Math.round(price);
  return ok(`${def.label}: €${item.price} (marge €${margin(state, item).toFixed(2)} per stuk).`);
}

// ---------- Spelersrollen ----------

export function setPlayerRole(state: GameState, role: keyof PlayerRoles, playerId: string | null): ActionResult {
  const g = guard(state);
  if (g) return g;
  const locked = taskLocked(state, 'spelersrollen');
  if (locked) return locked;
  const label = role === 'kapitein' ? 'Kapitein' : role === 'strafschop' ? 'Strafschopnemer' : 'Hoekschopnemer';
  if (!playerId) {
    state.tactics.roles[role] = null;
    return ok(`${label}: niemand aangeduid.`);
  }
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Speler niet gevonden.');
  if (p.loan?.type === 'uit') return fail(`${p.name} is uitgeleend.`);
  state.tactics.roles[role] = playerId;
  if (role === 'kapitein') p.morale = clamp(p.morale + 4, 0, 100);
  addLog(state, 'beslissing', `${label}: ${p.name}.`);
  return ok(`${label}: ${p.name}.`);
}

// ---------- Kantine en concessies ----------

export function setCanteenPrice(state: GameState, id: CanteenItemId, price: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const locked = taskLocked(state, 'horeca');
  if (locked) return locked;
  const item = state.canteen.items.find((i) => i.id === id);
  if (!item) return fail('Dit artikel staat niet op de kaart.');
  const def = canteenDef(id);
  if (!Number.isFinite(price) || price < def.cost || price > def.ref * 4) return fail(`Kies een prijs tussen €${def.cost.toFixed(2)} en €${(def.ref * 4).toFixed(2)}.`);
  item.price = Math.round(price * 10) / 10;
  if (state.investor === 'cooperatie' && item.price > def.ref * 1.4) addNews(state, 'slecht', `De leden vinden €${item.price.toFixed(2)} voor ${def.label.toLowerCase()} te veel.`);
  return ok(`${def.label}: €${item.price.toFixed(2)} (inkoop €${def.cost.toFixed(2)}).`);
}

/** Hoeveel plaats je concessies innemen (max CONCESSION_SPACE). */
export function usedConcessionSpace(state: GameState): number {
  return state.canteen.concessions.reduce((sum, c) => sum + concessionDef(c.id).space, 0);
}

export function openConcession(state: GameState, id: ConcessionId, marginPct: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const locked = taskLocked(state, 'horeca');
  if (locked) return locked;
  const def = concessionDef(id);
  if (state.canteen.concessions.some((c) => c.id === id)) return fail(`${def.label} staat er al.`);
  if (usedConcessionSpace(state) + def.space > state.infrastructure.concessionSpace) return fail(`Je hebt plaats voor ${state.infrastructure.concessionSpace} kraam-eenheden. ${def.label} neemt er ${def.space} in. Meer plaats bouw je bij Infrastructuur.`);
  if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct > 60) return fail('Kies een marge tussen 0% en 60%.');
  const max = acceptedMargin(state, id);
  const rng = createRng(state);
  if (marginPct > max) {
    addLog(state, 'beslissing', `${def.label} afgehaakt: je vroeg ${Math.round(marginPct)}% (hij wilde tot ${max}%).`);
    return fail(`De standhouder haakt af bij ${Math.round(marginPct)}%. Bij ongeveer ${max}% wil hij wel tekenen.`);
  }
  const partner = concessionPartner(rng, id);
  state.canteen.concessions.push({ id, partner, marginPct: Math.round(marginPct), sinceSeason: state.season });
  addLog(state, 'beslissing', `${def.label} (${partner}) komt erbij aan ${Math.round(marginPct)}% marge.`);
  addNews(state, 'goed', `${partner} zet vanaf nu een ${def.label.toLowerCase()} op het complex. Jij krijgt ${Math.round(marginPct)}% van zijn omzet.`);
  return ok(`${partner} tekent aan ${Math.round(marginPct)}% marge.`);
}

export function closeConcession(state: GameState, id: ConcessionId): ActionResult {
  const g = guard(state);
  if (g) return g;
  const locked = taskLocked(state, 'horeca');
  if (locked) return locked;
  const c = state.canteen.concessions.find((x) => x.id === id);
  if (!c) return fail('Deze concessie bestaat niet.');
  state.canteen.concessions = state.canteen.concessions.filter((x) => x.id !== id);
  addLog(state, 'beslissing', `Concessie ${concessionDef(id).label} stopgezet.`);
  return ok(`${c.partner} stopt ermee.`);
}

/** Opnieuw onderhandelen: lukt het niet, dan blijft de oude marge staan en is hij wat kribbig. */
export function renegotiateConcession(state: GameState, id: ConcessionId, marginPct: number): ActionResult {
  const g = guard(state);
  if (g) return g;
  const locked = taskLocked(state, 'horeca');
  if (locked) return locked;
  const c = state.canteen.concessions.find((x) => x.id === id);
  if (!c) return fail('Deze concessie bestaat niet.');
  if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct > 60) return fail('Kies een marge tussen 0% en 60%.');
  const max = acceptedMargin(state, id);
  if (marginPct > max) return fail(`${c.partner} weigert ${Math.round(marginPct)}%. Hij gaat tot ongeveer ${max}%.`);
  c.marginPct = Math.round(marginPct);
  return ok(`${c.partner} akkoord met ${c.marginPct}% marge.`);
}

// ---------- Onderhoud en energie ----------

export function setMaintenance(state: GameState, level: Infrastructure['maintenance']): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (!['basis', 'normaal', 'premium'].includes(level)) return fail('Onbekend onderhoudsniveau.');
  state.infrastructure.maintenance = level;
  addLog(state, 'beslissing', `Onderhoudsniveau: ${level}.`);
  return ok(
    level === 'basis'
      ? 'Basisonderhoud: 25% goedkoper, maar het complex verslonst en er gaat sneller iets stuk.'
      : level === 'premium'
        ? 'Premium onderhoud: 30% duurder, alles ligt er piekfijn bij en er gaat zelden iets stuk.'
        : 'Normaal onderhoud.',
  );
}

// De groene ingrepen elk apart: samen drukken ze de factuur ongeveer evenveel als de
// oude combi (0,86 × 0,94 ≈ 0,81), maar je kunt nu klein beginnen met led.
export const SOLAR_SAVING = 0.14; // zonnepanelen: aandeel van de vaste kosten dat wegvalt
export const LED_SAVING = 0.06; // ledverlichting: idem, kleiner
const GREEN_ENERGY_PAYBACK_WEEKS = 156; // drie seizoenen

/** De installatie wordt geprijsd naar de grootte van je complex: altijd ongeveer drie seizoenen terugverdientijd. */
/** Wat een extra kraamplaats kost: de verwachte weekopbrengst per plaats-eenheid, keer
 *  ruim twintig weken. De eerste versie rekende twee seizoenen terugverdientijd — netjes
 *  realistisch, en precies daarom fout: investeren moet in dit spel een 'rush' geven,
 *  je wil het geld zien terugstromen. Op 22 weken voelt bouwen als winst, en omdat de
 *  prijs je opkomst volgt, blijft die belofte in elke reeks overeind. Gemiddeld over de
 *  standtypes aan hun gangbare marge, zodat één uitschieter de prijs niet zet. */
const KRAAMPJES_PAYBACK_WEEKS = 22;
export function kraampjesCost(state: GameState): number {
  const att = Math.max(120, expectedAttendance(state, { weather: 'bewolkt', derby: false, positionFactor: 1 }));
  const perEenheidPerMatch =
    CONCESSIONS.reduce((sum, d) => sum + concessionForecast(state, d.id, acceptedMargin(state, d.id), att) / d.space, 0) / CONCESSIONS.length;
  const perWeek = (perEenheidPerMatch * (MATCH_WEEKS.length / 2)) / 52; // thuismatchen uitgesmeerd over het jaar
  return Math.max(500, round(perWeek * KRAAMPJES_PAYBACK_WEEKS, 100));
}

export function greenEnergyCost(state: GameState, id: 'zonnepanelen' | 'ledverlichting' = 'zonnepanelen'): number {
  const weeklySaving = facilityCost(state) * (id === 'zonnepanelen' ? SOLAR_SAVING : LED_SAVING);
  return round(weeklySaving * GREEN_ENERGY_PAYBACK_WEEKS, 500);
}

/** Zonnepanelen zijn een bouwproject als een ander: eerst werken, daarna besparen. */
export function investGreenEnergy(state: GameState): ActionResult {
  return startUpgrade(state, 'zonnepanelen');
}

/** Waarom deze speler deze week niet weg mag (of null). Voor de knoppen in de UI. */
export function departureBlockReason(state: GameState, p: Player): string | null {
  return departureBlock(state, p, 'verkopen');
}

/** Je langetermijndoel vastleggen. Kan maar één keer, en pas dan telt hij mee. */
export function chooseCareerGoal(state: GameState, goalId: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  if (state.career?.goalId) return fail('Je hebt je langetermijndoel al vastgelegd.');
  if (!setCareerGoal(state, goalId)) return fail('Dat doel bestaat niet.');
  const goal = CARRIERE_DOELEN.find((x) => x.id === goalId)!;
  addLog(state, 'beslissing', `Langetermijndoel gekozen: ${goal.titel}`);
  return ok(`${goal.titel}. ${goal.beschrijving}`);
}

/** Abonnementen verkopen voor dit seizoen. Kan één keer, en alleen voor de competitie start. */
export function sellSubscriptions(state: GameState, price: string): ActionResult {
  const g = guard(state);
  if (g) return g;
  const check = canSellTickets(state);
  if (!check.ok) return fail(check.reason);
  const asked = Math.max(SEASON_TICKET_MIN, Math.round(Number(price)));
  if (!Number.isFinite(asked)) return fail('Geef een geldige prijs op.');
  const result = sellSeasonTickets(state, asked, createRng(state));
  addLog(state, 'beslissing', `Abonnementen verkocht: ${result.sold} × €${asked}`);
  return result.sold > 0
    ? ok(`${result.sold} abonnementen verkocht: ${euro(result.revenue)} ineens in kas.`)
    : fail('Aan die prijs tekende niemand. Probeer het goedkoper.');
}

/** Een ledenronde houden bij de supporterscoöperatie. Eén keer per seizoen. */
export function holdMemberRound(state: GameState): ActionResult {
  const g = guard(state);
  if (g) return g;
  const check = canHoldRound(state);
  if (!check.ok) return fail(check.reason);
  const expected = roundForecast(state);
  if (expected <= 0) return fail('De leden hebben op dit moment niets te geven.');
  const raised = holdRound(state, createRng(state));
  addLog(state, 'beslissing', `Ledenronde gehouden: ${euro(raised)}`);
  return ok(`De leden brachten ${euro(raised)} bijeen.`);
}
