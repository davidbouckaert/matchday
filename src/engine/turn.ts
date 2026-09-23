// Het hart van het spel: één beurt (week) verwerken.
// advanceWeek krijgt de huidige toestand en geeft een NIEUWE toestand terug.

import type { ClubMove, Fixture, GamePlan, GameState, Player, WeekRecord } from './types';
import type { Rng } from './rng';
import { clamp, createRng } from './rng';
import { DIVISIONS, diplomaRank } from './data/divisions';
import { COURSES, UPGRADES } from './data/catalog';
import {
  BOND_FEE_WEEK,
  LICENCE_AUDIT_WEEK,
  WINTER_BREAK,
  SEASON_END_WEEK,
  SUBSIDY_WEEK,
  WEEKS_PER_YEAR,
  isWinter,
} from './calendar';
import { OWN_TEAM_ID, applyResult, createLeague, nextDerby, opponentStrength, ownPosition, rivalTeam, simulateMatch, sortedTable, zoneAt } from './league';
import { developPlayers, fatigueAgeFactor, generatePlayer, linkFriends, overall, pickScorers, selectLineup, teamStrength } from './players';
import { hasStaff, staffSkill, staffWage } from './staff';
import { WIN_BONUS_SHARE, bookAwayMatch, bookHomeMatch, bookWeeklyFlows, type Weather } from './finance';
import { resolveRequests, sponsorsAfterSeason, weeklySponsors } from './sponsors';
import { weeklyMerch } from './merch';
import { bankruptcyCheck, rollInjuries, weeklyEvents } from './events';
import { refreshLoanMarket, refreshStaffMarket, refreshTransferList, weeklyMarket } from './market';
import { addNews, book } from './util';
import { recordWeek, rolloverStats, snapshot } from './stats';
import { clearOrigins } from './origins';
import { recentForm } from './popularity';
import { checkMilestones } from './milestones';
import { checkRecords } from './records';
import { createOpening, settleSeason } from './opening';
import { makeWeekChoice, resolveWeekChoice } from './weekmoment';
import { ageStorylines, news, openStoryline, remember } from './content';
import { applyUpgrade } from './infrastructure';
import { checkCareerGoal, creditMilestones, settleCareerSeason, subsidyFactor } from './career';
import { settleSeasonTickets } from './seasontickets';
import { checkFundPatience, notePromotion, takePrizeShare, updateStadiumSponsor } from './investors';
import { NIEUWS } from '../content/news';
import type { NieuwsSjabloon } from '../content/types';
import { clubByName, runWorldSeason } from './world';
import { boundVolunteers, maxYouthTeams, teamNames, updateYouthTeams, youthShortage } from './youth';
import { runDelegatedTasks, strategyTask } from './delegation';
import { opponentSide, trainingCost, weeklyMoraleEffect } from './strategy';
import { NATURAL_RECOVERY, matchLoad, recovery, trainingLoad } from './factors';
import { available, cardsForOpponent, cardsForOwnTeam, serveOpponentSuspensions, serveOwnSuspensions } from './discipline';
import { YOUTH_FEE_WEEK, youthFeeGrumble, youthFeeRef, youthForecast } from './actions';
import { BIJSCHOLING } from './data/catalog';

export function advanceWeek(previous: GameState): GameState {
  if (previous.gameOver) return previous;
  const state: GameState = structuredClone(previous);
  const rng = createRng(state);
  const statsBefore = snapshot(state);

  clearOrigins(state); // de herkomst van de bedragen geldt telkens voor één week
  resolveWeekChoice(state, rng); // wie niets besliste, laat het gaan
  runDelegatedTasks(state, rng);
  bookWeeklyFlows(state);
  book(state, 'trainingen', -trainingCost(state), `${state.tactics.trainings} trainingen (velden, licht, materiaal)`);
  payPending(state);
  playMatchWeek(state, rng);
  scheduledPayments(state, rng);
  weeklyMerch(state, rng);
  resolveRequests(state, rng);
  weeklyCommunity(state);
  weeklyStagnation(state, rng);
  weeklyVolunteers(state, rng);
  weeklySponsors(state, rng);
  weeklyEvents(state, rng);
  weeklyProgress(state);
  weeklyPlayers(state, rng);
  announceDerby(state);
  if (state.week === WINTER_BREAK.from) addNews(state, 'neutraal', `De winterstop begint: geen competitie tot week ${WINTER_BREAK.to + 1}. Geen tickets, geen wedstrijdkantine en geen kraampjes, maar de lonen en de vaste kosten lopen door.`);
  if (state.week === WINTER_BREAK.to + 1) addNews(state, 'goed', 'De competitie herbegint: de terugronde start dit weekend.');
  if (state.week === LICENCE_AUDIT_WEEK) licenceAudit(state);
  if (state.week === SEASON_END_WEEK) seasonEnd(state);
  weeklyMarket(state, rng);
  bankruptcyCheck(state);

  state.lastMilestones = checkMilestones(state).map((m) => m.label);
  creditMilestones(state, state.lastMilestones.length);
  checkCareerGoal(state); // je langetermijndoel kan elke week binnen zijn
  state.lastRecords = checkRecords(state);
  recordWeek(state, statsBefore);

  const totals: WeekRecord['totals'] = {};
  for (const e of state.thisWeek) totals[e.category] = (totals[e.category] ?? 0) + e.amount;
  state.weekHistory.push({ season: state.season, week: state.week, totals });
  if (state.weekHistory.length > 52) state.weekHistory.shift();
  state.lastWeek = state.thisWeek;
  state.thisWeek = [];
  state.cashHistory.push(state.cash);
  if (state.cashHistory.length > 104) state.cashHistory.shift();

  state.week++;
  if (state.week > WEEKS_PER_YEAR) newSeason(state, rng);
  if (!state.gameOver) {
    strategyTask(state, rng); // de trainer bereidt de volgende week voor
    state.weekChoice = makeWeekChoice(state, rng); // en er ligt iets op jouw bureau
  }
  return state;
}

/** Wat de andere clubs deze zomer deden, in het nieuws van jouw reeks. */
function announceWorldMoves(state: GameState, rng: Rng): void {
  const bySjabloon: Partial<Record<ClubMove, NieuwsSjabloon>> = {
    versterken: NIEUWS.rivaalInvesteert,
    bouwen: NIEUWS.rivaalBouwt,
    jeugd: NIEUWS.rivaalJeugd,
    besparen: NIEUWS.rivaalBespaart,
    problemen: NIEUWS.rivaalProblemen,
    opgedoekt: NIEUWS.rivaalOnderuit,
  };
  // niet alles halen we aan: alleen wat opvalt, en hoogstens drie berichten
  const notable = state.lastWorldMoves.filter((m) => m.move !== 'stilzitten');
  for (const move of notable.slice(0, 3)) {
    const template = bySjabloon[move.move];
    if (!template) continue;
    news(state, rng, template, { tegenstander: move.club });
    if (move.move === 'opgedoekt') remember(state, `${move.club} legde de boeken neer en verdween uit de reeks.`);
  }
}

/**
 * Een ambitieuze club met een sterke jeugdwerking pikt af en toe je mooiste belofte weg.
 * Dat is het gevolg van hun investering van vorig seizoen — en het komt later terug,
 * want je speelt hem nog tegen (zie het moment "weggekaapt-wraak").
 */
function poachYouth(state: GameState, rng: Rng, newcomers: Player[]): void {
  if (newcomers.length < 2) return; // je laatste belofte pikken ze niet af
  const thieves = state.world.clubs.filter(
    (c) => !c.defunct && c.divisionLevel >= state.nextDivisionLevel && c.youth >= 2 && c.ambition >= 60,
  );
  if (!thieves.length) return;
  const chance = 0.1 + Math.min(0.2, thieves.length * 0.02);
  if (!rng.chance(chance)) return;
  const thief = rng.pick(thieves);
  const target = [...newcomers].sort((a, b) => b.potential - a.potential)[0];
  state.players = state.players.filter((p) => p.id !== target.id);
  news(state, rng, NIEUWS.rivaalWeggekaapt, { speler: target.name, tegenstander: thief.name });
  remember(state, `${thief.name} pikte onze belofte ${target.name} weg uit de eigen jeugd.`);
  openStoryline(state, 'weggekaapt', 78, { speler: target.name, oudeclub: thief.name });
  state.community.fanMood = clamp(state.community.fanMood - 3, 0, 100);
}

// ---------- Wedstrijden ----------

function rollWeather(rng: Rng, week: number): Weather {
  const r = rng.next();
  if (isWinter(week)) return r < 0.1 ? 'zon' : r < 0.45 ? 'bewolkt' : r < 0.78 ? 'regen' : r < 0.86 ? 'storm' : 'vriesweer';
  return r < 0.4 ? 'zon' : r < 0.75 ? 'bewolkt' : r < 0.97 ? 'regen' : 'storm';
}

function positionFactor(state: GameState): number {
  const played = state.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  if (played < 3) return 1.05;
  const pos = ownPosition(state.league);
  return pos <= 3 ? 1.15 : pos <= 8 ? 1 : pos <= 13 ? 0.93 : 0.85;
}

function playMatchWeek(state: GameState, rng: Rng): void {
  const fixtures = state.league.fixtures.filter((f) => f.week === state.week && f.homeGoals === undefined);
  if (!fixtures.length) return;

  // kleine schommelingen in de vorm van tegenstanders
  for (const t of state.league.teams) t.strength = Math.round(clamp(t.strength + rng.normal(0, 0.4), 30, 95) * 10) / 10;

  for (const f of fixtures) {
    const involved = f.homeId === OWN_TEAM_ID || f.awayId === OWN_TEAM_ID;
    if (involved) {
      playOwnMatch(state, rng, f);
      continue;
    }
    const derby = rng.chance(0.1);
    const banned = (id: string) => new Set(state.league.discipline.filter((d) => d.teamId === id && d.suspended > 0).map((d) => d.name));
    const bannedHome = banned(f.homeId);
    const bannedAway = banned(f.awayId);
    const sideOf = (id: string, plan: GamePlan | undefined, missing: number) => {
      const team = state.league.teams.find((x) => x.id === id);
      return opponentSide(opponentStrength(state.league, id) - SUSPENSION_PENALTY * Math.min(3, missing) + rng.normal(0, 2), plan ?? team?.plan ?? 'balbezit');
    };
    const [h, a] = simulateMatch(rng, sideOf(f.homeId, f.homePlan, bannedHome.size), sideOf(f.awayId, f.awayPlan, bannedAway.size));
    f.homeGoals = h;
    f.awayGoals = a;
    applyResult(state.league, f);
    cardsForOpponent(state, rng, f.homeId, derby);
    cardsForOpponent(state, rng, f.awayId, derby);
    serveOpponentSuspensions(state, f.homeId, bannedHome);
    serveOpponentSuspensions(state, f.awayId, bannedAway);
  }
}

const SUSPENSION_PENALTY = 0.6; // sterkteverlies per geschorste speler bij een tegenstander
export const FORFEIT_FINE = 1_000;

function playOwnMatch(state: GameState, rng: Rng, f: Fixture): void {
  const home = f.homeId === OWN_TEAM_ID;
  const opponentId = home ? f.awayId : f.homeId;
  const opponent = state.league.teams.find((t) => t.id === opponentId)!;
  const weather = rollWeather(rng, state.week);

  // afgelasting bij vriesweer op natuurgras
  if (home && weather === 'vriesweer' && state.infrastructure.pitch === 'natuurgras' && state.week < 43 && rng.chance(0.6)) {
    f.week = 43;
    addNews(state, 'slecht', `Wedstrijd tegen ${opponent.name} afgelast: bevroren grasmat. Inhaaldatum in week 43.`);
    return;
  }

  const theirPlan = (home ? f.awayPlan : f.homePlan) ?? opponent.plan;
  const ownSuspended = new Set(state.players.filter((p) => p.suspended > 0).map((p) => p.id));
  const theirBanned = new Set(state.league.discipline.filter((d) => d.teamId === opponentId && d.suspended > 0).map((d) => d.name));
  const c = state.community;

  // ---------- forfait: minder dan 11 beschikbare spelers ----------
  if (available(state.players).length < 11) {
    state.periodMatches++;
    f.homeGoals = home ? 0 : 5;
    f.awayGoals = home ? 5 : 0;
    applyResult(state.league, f);
    book(state, 'boetes', -FORFEIT_FINE, `Forfaitboete tegen ${opponent.name}`);
    c.fanMood = clamp(c.fanMood - 8, 0, 100);
    c.reputation = clamp(c.reputation - 3, 0, 100);
    for (const d of state.sponsors) d.satisfaction = clamp(d.satisfaction - 5, 0, 100);
    state.lastMatch = {
      week: state.week, opponent: opponent.name, home, goalsFor: 0, goalsAgainst: 5, attendance: 0, weather,
      ourStrength: 0, theirStrength: Math.round(opponent.strength), forfeit: true, ourPlan: state.tactics.plan, theirPlan, matchup: 0,
    };
    addNews(state, 'slecht', `FORFAIT tegen ${opponent.name}: slechts ${available(state.players).length} spelers beschikbaar. 0-5 verlies, €${FORFEIT_FINE.toLocaleString('nl-BE')} boete en boze supporters en sponsors.`);
    serveOwnSuspensions(state.players, ownSuspended);
    serveOpponentSuspensions(state, opponentId, theirBanned);
    return;
  }

  const { lineup } = selectLineup(state.players, state.tactics.formation, state.tactics.manualXI, state.tactics.benched, state.tactics.gaps);
  const lineupIds = new Set(lineup.map((p) => p.id));
  state.periodMatches++;
  for (const p of lineup) {
    p.starts++;
    p.periodStarts++;
  }
  const strength = teamStrength(state, { strength: opponent.strength, plan: theirPlan });
  const dayForm = rng.normal(0, 2);
  const ourSide = { attack: strength.attack + dayForm, defense: strength.defense + dayForm };
  const theirs = opponent.strength - SUSPENSION_PENALTY * Math.min(3, theirBanned.size) + rng.normal(0, 2);
  const theirSide = opponentSide(theirs, theirPlan);
  const [hg, ag] = home ? simulateMatch(rng, ourSide, theirSide) : simulateMatch(rng, theirSide, ourSide);
  const ours = strength.total + dayForm;
  f.homeGoals = hg;
  f.awayGoals = ag;
  applyResult(state.league, f);

  const goalsFor = home ? hg : ag;
  const goalsAgainst = home ? ag : hg;
  let attendance = 0;
  if (home) attendance = bookHomeMatch(state, { weather, derby: opponent.isRival, positionFactor: positionFactor(state) }, opponent.name);
  else bookAwayMatch(state, opponent.name);

  // winstpremie voor de basiself: succes kost ook geld
  if (goalsFor > goalsAgainst) {
    const bonus = lineup.reduce((sum, p) => sum + p.wage, 0) * WIN_BONUS_SHARE;
    book(state, 'lonen spelers', -bonus, `Winstpremie basiself (${Math.round(WIN_BONUS_SHARE * 100)}% van hun vergoeding)`);
  }

  // kaarten en schorsingen
  const cards = cardsForOwnTeam(state, rng, lineup, opponent.isRival);
  cardsForOpponent(state, rng, opponentId, opponent.isRival);
  serveOwnSuspensions(state.players, ownSuspended);
  serveOpponentSuspensions(state, opponentId, theirBanned);

  const scorers = pickScorers(state, lineup, goalsFor, rng);
  state.lastMatch = {
    week: state.week,
    opponent: opponent.name,
    home,
    goalsFor,
    goalsAgainst,
    attendance,
    weather,
    ourStrength: Math.round(ours),
    theirStrength: Math.round(theirs),
    cards,
    ourPlan: state.tactics.plan,
    theirPlan,
    matchup: strength.matchup,
    lineup: lineup.map((p) => ({ id: p.id, name: p.name, position: p.position, zone: p.position, rating: overall(p) })),
    scorers,
  };

  // gevolgen voor moraal, vorm en supporters
  const result = goalsFor > goalsAgainst ? 1 : goalsFor < goalsAgainst ? -1 : 0;
  const derby = opponent.isRival ? 2 : 1;
  const calm = 1 - staffSkill(state, 'mentaal') / 300; // mentale coach: minder schommelingen
  for (const p of state.players) {
    const swing = (p.trait === 'gevoelig' ? 2 : 1) * calm;
    const played = lineupIds.has(p.id);
    p.morale = clamp(p.morale + result * 3 * swing + (played ? 1 : -1.2), 0, 100);
    const noise = (p.trait === 'feestbeest' ? 2 : 1) * (1 - staffSkill(state, 'conditietrainer') / 200) * calm;
    if (played) p.form = clamp(p.form * 0.7 + result * 1.5 + rng.normal(0, 1.5) * noise, -10, 10);
  }
  if (opponent.isRival) {
    state.derbyRecord ??= { won: 0, drawn: 0, lost: 0 };
    if (result > 0) state.derbyRecord.won++;
    else if (result < 0) state.derbyRecord.lost++;
    else state.derbyRecord.drawn++;
    const template = result > 0 ? NIEUWS.derbyGewonnen : result < 0 ? NIEUWS.derbyVerloren : NIEUWS.derbyGelijk;
    news(state, rng, template, { tegenstander: opponent.name, uitslag: `${goalsFor}-${goalsAgainst}` });
    if (result > 0) c.reputation = clamp(c.reputation + 2, 0, 100);
  }

  const moodLoss = state.investor === 'cooperatie' ? 1.5 : 3;
  c.fanMood = clamp(c.fanMood + (result > 0 ? 3 : result < 0 ? -moodLoss : 0) * derby, 0, 100);
  c.reputation = clamp(c.reputation + (result > 0 ? 0.3 : result < 0 ? -0.2 : 0), 0, 100);

  const label = result > 0 ? 'Zege' : result < 0 ? 'Nederlaag' : 'Gelijkspel';
  addNews(
    state,
    result > 0 ? 'goed' : result < 0 ? 'slecht' : 'neutraal',
    `${label}: ${home ? state.clubName : opponent.name} ${hg}-${ag} ${home ? opponent.name : state.clubName}${home ? ` (${attendance} toeschouwers, ${weather})` : ''}.${cards ? ` Kaarten: ${cards}.` : ''}`,
  );
  const load = matchLoad(state);
  for (const p of state.players) if (lineupIds.has(p.id)) p.fatigue = clamp(p.fatigue + load * fatigueAgeFactor(p.age), 0, 100);
  rollInjuries(state, rng, [...lineupIds]);
}

// ---------- Uitgestelde opbrengsten ----------

function payPending(state: GameState): void {
  for (const p of state.pending) {
    p.weeksLeft--;
    if (p.weeksLeft > 0) continue;
    if (p.amount) book(state, p.category, p.amount, p.label);
    if (p.volunteers !== undefined) {
      state.community.volunteers += p.volunteers;
      addNews(state, p.volunteers > 0 ? 'goed' : 'neutraal', p.volunteers > 0 ? `${p.label}: ${p.volunteers} ${p.volunteers === 1 ? 'nieuwe vrijwilliger' : 'nieuwe vrijwilligers'}.` : `${p.label}: helaas geen nieuwe vrijwilligers.`);
    } else if (p.amount) {
      addNews(state, 'goed', `${p.label}: €${p.amount.toLocaleString('nl-BE')} ontvangen.`);
    }
  }
  state.pending = state.pending.filter((p) => p.weeksLeft > 0);
}

// ---------- Vaste momenten in het jaar ----------

function scheduledPayments(state: GameState, rng: Rng): void {
  const c = state.community;
  if (state.week === BOND_FEE_WEEK) {
    const fee = (5000 + state.players.length * 150 + c.youthMembers * 22 + c.youthTeams * 400) * (1 + state.league.divisionLevel * 0.35) * state.inflation;
    book(state, 'bond & verzekering', -fee, `Aansluiting Voetbal Vlaanderland en verzekeringen (A-kern + ${c.youthTeams} jeugdploegen)`);
  }
  if (state.week === YOUTH_FEE_WEEK) {
    const before = c.youthMembers;
    // De inschrijvingen zijn een schatting, geen afspraak. Het scherm toont wat je mág
    // verwachten; wat er die week binnenkomt hangt ook af van hoeveel kinderen er dit jaar
    // toevallig in de juiste leeftijd zitten en wat de club in het dorp ernaast doet.
    c.youthMembers = Math.max(0, Math.round(youthForecast(state) * rng.range(0.88, 1.12)));
    book(state, 'lidgelden', c.youthMembers * state.youthFee, `Lidgelden jeugd (${c.youthMembers} × €${state.youthFee})`);
    const diff = c.youthMembers - before;
    addNews(state, diff >= 0 ? 'goed' : 'slecht', `Inschrijvingen jeugd: ${c.youthMembers} leden (${diff >= 0 ? '+' : ''}${diff} tegenover vorig seizoen) aan €${state.youthFee}.`);
    if (state.youthFee > youthFeeGrumble(state)) c.fanMood = clamp(c.fanMood - 3, 0, 100);
    if (state.youthFee < youthFeeRef(state) * 0.7) c.reputation = clamp(c.reputation + 1, 0, 100);
    // ploegen volgen de leden, maar één stap per seizoen: een nieuwe reeks moet je ook kunnen bemannen
    const change = updateYouthTeams(state);
    if (change > 0) {
      addNews(state, 'goed', `Er komt een jeugdploeg bij: ${teamNames(state).slice(-1)[0]}. Je hebt nu ${c.youthTeams} ploegen, samen goed voor ${boundVolunteers(state)} vaste vrijwilligers.`);
    } else if (change < 0) {
      addNews(state, 'slecht', `Te weinig kinderen (of te weinig plaats): een jeugdploeg wordt opgedoekt. Je houdt er ${c.youthTeams} over.`);
    }
    if (c.youthTeams >= maxYouthTeams(state)) {
      addNews(state, 'neutraal', `Je jeugdwerking zit aan haar plafond (${c.youthTeams} ploegen). Kunstgras, betere verlichting of een opleidingscentrum maken plaats voor meer.`);
    }
  }
  if (state.week === SUBSIDY_WEEK) {
    const subsidy = (8000 + c.youthMembers * 25) * (1 + state.league.divisionLevel * 0.12) * subsidyFactor(state);
    book(state, 'subsidies', subsidy, 'Subsidie gemeente (jeugdwerking en sportieve uitstraling)');
  }
}

/**
 * Vrijwilligers komen en gaan. Wie tevreden is (goede sfeer, een kantineverantwoordelijke,
 * niet te veel evenementen achter elkaar) blijft; anders haken er mensen af.
 */
export function volunteerSatisfaction(state: GameState): number {
  const c = state.community;
  const events = state.eventLog.filter((e) => e.season === state.season && e.week > state.week - 8).length;
  const load = clamp(c.volunteers / 12, 0.5, 1.5);
  // wie de jeugd moet draaien met te weinig volk, brandt op
  const shortage = youthShortage(state);
  return clamp(
    35 +
      c.fanMood * 0.3 +
      c.reputation * 0.15 +
      staffSkill(state, 'kantine') * 0.15 +
      staffSkill(state, 'jeugdcoordinator') * 0.08 +
      (c.volunteerLoyaltyWeeks > 0 ? 12 : 0) -
      (events * 6) / load -
      shortage * 4,
    0,
    100,
  );
}

function weeklyVolunteers(state: GameState, rng: Rng): void {
  const c = state.community;
  const sat = volunteerSatisfaction(state);
  // onder 50 haken er mensen af, boven 65 sluiten er spontaan mensen aan
  const leaveChance = clamp((55 - sat) / 120, 0, 0.5);
  if (rng.chance(leaveChance)) {
    const gone = rng.int(1, sat < 30 ? 2 : 1);
    c.volunteers = Math.max(2, c.volunteers - gone);
    addNews(state, 'slecht', `${gone} ${gone === 1 ? 'vrijwilliger haakt' : 'vrijwilligers haken'} af. Hun tevredenheid staat op ${Math.round(sat)} van de 100.`);
  } else if (sat > 65 && rng.chance((sat - 65) / 200)) {
    c.volunteers += 1;
    addNews(state, 'goed', 'Een nieuwe vrijwilliger sluit spontaan aan.');
  }
}

/**
 * Een club die stilstaat, gaat achteruit. Wie weken aan een stuk niets beslist
 * (geen sponsor aangesproken, niets georganiseerd, niets gebouwd, niets gedelegeerd)
 * verliest sfeer, reputatie en sponsortevredenheid. Actief spelen merkt hier niets van.
 */
export const STAGNATION_WEEKS = 10;

export function weeksIdle(state: GameState): number {
  const last = state.log.find((l) => l.kind === 'beslissing');
  if (!last) return (state.season - 1) * WEEKS_PER_YEAR + state.week;
  return (state.season - last.season) * WEEKS_PER_YEAR + (state.week - last.week);
}

function weeklyStagnation(state: GameState, rng: Rng): void {
  const idle = weeksIdle(state);
  if (idle < STAGNATION_WEEKS) return;
  const c = state.community;
  // de terugval is merkbaar maar niet bodemloos: wie stilzit zakt naar het niveau van een slapende club,
  // en wie al lager staat (om een andere reden) zakt daar niet verder door
  const bite = Math.min(1.8, 0.9 + (idle - STAGNATION_WEEKS) / 28);
  const decay = (value: number, floor: number, amount: number) => (value > floor ? Math.max(floor, value - amount) : value);
  c.fanMood = decay(c.fanMood, 41, bite * 0.32);
  c.reputation = decay(c.reputation, 20, bite * 0.1);
  for (const d of state.sponsors) d.satisfaction = decay(d.satisfaction, 30, bite * 0.2);
  if (idle === STAGNATION_WEEKS || (idle - STAGNATION_WEEKS) % 16 === 0) {
    news(state, rng, NIEUWS.stagnatie, { weken: String(idle) });
  }
}

function weeklyCommunity(state: GameState): void {
  const c = state.community;
  const division = DIVISIONS[state.league.divisionLevel];
  if (c.volunteerLoyaltyWeeks > 0) c.volunteerLoyaltyWeeks--;
  // supportersaantal groeit richting wat normaal is voor de reeks en je reputatie
  const target = division.fanBaseNorm * (0.6 + c.reputation / 100) * (state.investor === 'cooperatie' ? 1.15 : 1) + staffSkill(state, 'commercieel') * 2;
  // succes trekt volk: wie goed draait, groeit sneller naar zijn plafond dan wie aanmoddert
  const pull = 0.008 + recentForm(state) * 0.022 + (c.fanMood > 70 ? 0.004 : 0);
  c.fanBase = Math.round(c.fanBase + (target - c.fanBase) * pull);
  // de sfeer zakt of stijgt langzaam terug naar normaal
  c.fanMood = clamp(c.fanMood + (60 - c.fanMood) * 0.02, 0, 100);
  const ref = division.refTicketPrice;
  if (state.ticketPrice > ref * 1.2) c.fanMood = clamp(c.fanMood - (state.investor === 'cooperatie' ? 2 : 0.7), 0, 100);
  if (state.ticketPrice < ref * 0.8) c.fanMood = clamp(c.fanMood + 0.3, 0, 100);
}

function weeklyProgress(state: GameState): void {
  // bouwprojecten: er kunnen er twee tegelijk lopen
  const i = state.infrastructure;
  for (const c of [...i.constructions]) {
    c.weeksLeft--;
    if (c.weeksLeft > 0) continue;
    const id = c.upgrade;
    applyUpgrade(i, id, c.seats);
    i.constructions = i.constructions.filter((x) => x !== c);
    const label = UPGRADES.find((u) => u.id === id)!.label;
    // een geslaagde investering levert later nog nieuws op (zie NIEUWBOUW in de events)
    openStoryline(state, 'nieuwbouw', 26, { wat: label.toLowerCase() });
    remember(state, `Bouwproject afgerond: ${label}.`);
    addNews(
      state,
      'goed',
      id === 'tribune'
        ? `Bouwproject afgerond: ${label}. Er kunnen nu ${i.capacity} toeschouwers binnen.`
        : id === 'zonnepanelen'
          ? 'De zonnepanelen liggen op het dak: je energiefactuur daalt met 20%.'
          : `Bouwproject afgerond: ${label}.`,
    );
    state.community.fanMood = clamp(state.community.fanMood + 3, 0, 100);
  }
  // opleidingen
  for (const s of state.staff) {
    if (s.courseWeeksLeft <= 0) continue;
    s.courseWeeksLeft--;
    if (s.courseWeeksLeft > 0) continue;
    if (s.courseType === 'bijscholing') {
      const gain = BIJSCHOLING.gain[0] + ((state.week + s.skill) % (BIJSCHOLING.gain[1] - BIJSCHOLING.gain[0] + 1));
      s.skill = Math.min(BIJSCHOLING.cap, s.skill + gain);
      if (s.trait === 'ambitieus') s.wage = Math.max(s.wage, staffWage(s.role, s.skill, s.trait, s.diploma));
      addNews(state, 'goed', `${s.name} rondt de bijscholing af: vaardigheid +${gain} (nu ${s.skill}).`);
    } else {
      const course = COURSES.find((c) => c.from === s.diploma);
      if (course) {
        s.diploma = course.to;
        s.skill = Math.min(99, s.skill + 4);
        const newWage = staffWage(s.role, s.skill, s.trait, s.diploma);
        const raise = (s.trait === 'ambitieus' || s.trait === 'perfectionist') && newWage > s.wage;
        if (raise) s.wage = newWage;
        addNews(state, 'goed', `${s.name} behaalde het diploma ${course.to}.${raise ? ` Hij vraagt meteen opslag: €${s.wage}/week.` : ''}`);
      }
    }
    s.courseType = null;
  }
  // wachttijden van evenementen
  for (const k of Object.keys(state.eventCooldowns)) state.eventCooldowns[k] = Math.max(0, state.eventCooldowns[k] - 1);
  // verhaallijnen die nog kunnen terugkomen, verjaren ook
  ageStorylines(state);
}

function weeklyPlayers(state: GameState, rng: Rng): void {
  const leaders = state.players.filter((p) => p.trait === 'leider').length;
  const trainingMood = weeklyMoraleEffect(state);
  const build = trainingLoad(state);
  const extra = recovery(state);
  const kine = staffSkill(state, 'kinesist');
  const mental = staffSkill(state, 'mentaal');
  for (const p of state.players) {
    // vermoeidheid: natuurlijk herstel + opbouw door trainingen − extra herstel (staff, recuperatieruimte, focus)
    const training = (p.injuryWeeks > 0 ? 0 : build) * fatigueAgeFactor(p.age);
    p.fatigue = Math.round(clamp(p.fatigue * (1 - NATURAL_RECOVERY) + training - extra, 0, 100) * 10) / 10;
    // oververmoeide spelers kunnen op training geblesseerd raken
    if (p.injuryWeeks === 0 && p.fatigue > 50 && rng.chance(((p.fatigue - 50) / 1000) * (1 - kine / 200))) {
      p.injuryWeeks = rng.int(2, 4); // telt deze week meteen af
      addNews(state, 'slecht', `${p.name} raakt oververmoeid geblesseerd op training.`);
    }
    if (p.injuryWeeks > 0) p.injuryWeeks--;
    // herstellend: focus herstel en de kinesist verkorten blessures
    if (p.injuryWeeks > 0 && state.tactics.focus === 'herstel' && rng.chance(0.3)) p.injuryWeeks--;
    if (p.injuryWeeks > 0 && kine && rng.chance(kine / 150)) p.injuryWeeks--;
    // moraal zakt terug naar een basisniveau; leiders en een mentale coach houden de groep samen
    const base = 55 + Math.min(3, leaders) * 3 + (state.avatar.background === 'exspeler' ? 5 : 0) + mental / 20;
    p.morale = clamp(p.morale + (base - p.morale) * (p.trait === 'professioneel' ? 0.15 : 0.08) + trainingMood * (p.trait === 'feestbeest' ? 1.5 : 1), 0, 100);
    if (p.trait === 'lastpak' && rng.chance(0.03)) {
      p.morale = clamp(p.morale - 15, 0, 100);
      addNews(state, 'slecht', `${p.name} klaagt in de pers over zijn speelgelegenheid.`);
    }
  }
  if (state.week % 4 === 0) {
    const dev = developPlayers(state, rng);
    const top = [...dev.better].sort((a, b) => b.trend - a.trend)[0];
    const flop = [...dev.worse].sort((a, b) => a.trend - b.trend)[0];
    addNews(
      state,
      dev.better.length >= dev.worse.length ? 'goed' : 'slecht',
      `Spelersevolutie (4 weken): ${dev.better.length} beter, ${dev.worse.length} slechter.${top ? ` Grootste stijger: ${top.name} (+${top.trend}).` : ''}${flop ? ` Grootste daler: ${flop.name} (${flop.trend}).` : ''}`,
    );
  }
  if (state.week === 40) {
    const expiring = state.players.filter((p) => p.contractUntil <= state.season);
    if (expiring.length) addNews(state, 'neutraal', `Aflopende contracten op het einde van het seizoen: ${expiring.map((p) => p.name).join(', ')}. Verleng bij Ploeg wie je wilt houden.`);
  }
}

// ---------- Licentie ----------

function licenceAudit(state: GameState): void {
  const division = DIVISIONS[state.league.divisionLevel];
  const trainer = state.staff.find((s) => s.role === 'hoofdtrainer');
  const problems: string[] = [];
  if (!trainer || diplomaRank(trainer.diploma) < diplomaRank(division.requiredDiploma)) problems.push(`hoofdtrainer zonder diploma ${division.requiredDiploma}`);
  if (!hasStaff(state, 'afgevaardigde')) problems.push('geen ploegafgevaardigde');
  if (state.infrastructure.lightingLevel < division.requiredLighting) problems.push(`je verlichting haalt niveau ${division.requiredLighting} niet`);
  if (state.infrastructure.capacity < division.requiredCapacity) problems.push('te weinig plaatsen');
  if (!problems.length) {
    addNews(state, 'goed', 'Licentie-audit van Voetbal Vlaanderland: alles in orde.');
    return;
  }
  state.licenceWarnings++;
  const fine = problems.length * 2500 * state.licenceWarnings;
  book(state, 'boetes', -fine, 'Boete licentie-audit');
  state.community.reputation = clamp(state.community.reputation - 4, 0, 100);
  addNews(state, 'slecht', `Licentie-audit: ${problems.join(', ')}. Boete: €${fine.toLocaleString('nl-BE')}. Herhaalde tekortkomingen worden duurder.`);
}

/** De week voor de derby weet het hele dorp het al. */
function announceDerby(state: GameState): void {
  const next = nextDerby(state);
  if (!next || next.week !== state.week + 1) return;
  const rival = rivalTeam(state)!;
  addNews(
    state,
    'neutraal',
    `Volgende week de derby ${next.home ? 'thuis' : 'op verplaatsing'} tegen ${rival.name}. ${
      next.home ? 'Reken op een volle accommodatie en een drukke kantine.' : 'De supporters gaan massaal mee.'
    }`,
  );
}

// ---------- Seizoenseinde en nieuw seizoen ----------

/**
 * Wat een titel of een promotie opbrengt. In het Belgische amateurvoetbal betaalt de bond
 * geen prijzengeld: wat je krijgt zijn premies van je sponsors, een kampioenenreceptie en
 * een tombola. Vanaf 1ste Nationale komt er echt geld bij (tv, beker, bondspremies).
 */
export const PRIZE_TABLE: Array<{ kampioen: number; promotie: number }> = [
  { kampioen: 2_000, promotie: 1_000 }, // 1ste Provinciale
  { kampioen: 4_500, promotie: 2_500 }, // 3de Nationale
  { kampioen: 7_000, promotie: 4_000 }, // 2de Nationale
  { kampioen: 40_000, promotie: 25_000 }, // 1ste Nationale
  { kampioen: 160_000, promotie: 95_000 }, // Challenger Pro League
];

export function seasonPrize(level: number, result: 'kampioen' | 'promotie'): number {
  const row = PRIZE_TABLE[Math.min(Math.max(level, 0), PRIZE_TABLE.length - 1)];
  return row[result];
}

function seasonEnd(state: GameState): void {
  const table = sortedTable(state.league);
  const pos = table.findIndex((r) => r.teamId === OWN_TEAM_ID) + 1;
  const row = table[pos - 1];
  const level = state.league.divisionLevel;
  const c = state.community;
  let result: 'promotie' | 'degradatie' | 'behoud' | 'kampioen' = 'behoud';
  let prize = 0;

  // dezelfde functie waarmee de kopbalk je plaats kleurt, zodat die twee nooit uiteenlopen
  const zone = zoneAt(state.league, pos, level, DIVISIONS.length);

  if (zone === 'kampioen') {
    result = 'kampioen';
    state.nextDivisionLevel = level + 1;
    state.promotionsWithInvestor++;
    notePromotion(state);
    c.reputation = clamp(c.reputation + 12, 0, 100);
    c.fanMood = clamp(c.fanMood + 20, 0, 100);
    c.fanBase = Math.round(c.fanBase * 1.25);
    prize = seasonPrize(level, 'kampioen');
    book(state, 'premies', prize, level < 3 ? `Kampioenenpremies van sponsors en supporters (${DIVISIONS[level].name})` : `Prijzengeld en tv-premie voor de titel (${DIVISIONS[level].name})`);
    takePrizeShare(state, prize);
    addNews(state, 'goed', `KAMPIOEN! ${state.clubName} promoveert naar ${DIVISIONS[level + 1].name}. Kampioenenpremie: €${prize.toLocaleString('nl-BE')}.`);
  } else if (zone === 'promotie') {
    result = 'promotie';
    state.nextDivisionLevel = level + 1;
    state.promotionsWithInvestor++;
    notePromotion(state);
    c.reputation = clamp(c.reputation + 8, 0, 100);
    c.fanMood = clamp(c.fanMood + 12, 0, 100);
    c.fanBase = Math.round(c.fanBase * 1.15);
    prize = seasonPrize(level, 'promotie');
    book(state, 'premies', prize, level < 3 ? `Promotiepremies van sponsors (${DIVISIONS[level].name})` : `Promotiepremie en tv-geld (${DIVISIONS[level].name})`);
    takePrizeShare(state, prize);
    addNews(state, 'goed', `Tweede plaats en promotie naar ${DIVISIONS[level + 1].name}. Promotiepremie: €${prize.toLocaleString('nl-BE')}.`);
  } else if (zone === 'degradatie') {
    result = 'degradatie';
    state.nextDivisionLevel = level - 1;
    c.reputation = clamp(c.reputation - 10, 0, 100);
    c.fanMood = clamp(c.fanMood - 15, 0, 100);
    c.fanBase = Math.round(c.fanBase * 0.85);
    addNews(state, 'slecht', `Degradatie naar ${DIVISIONS[level - 1].name}. Een zware klap.`);
  } else {
    state.nextDivisionLevel = level;
    addNews(state, 'neutraal', `Seizoen afgesloten op plaats ${pos}. ${state.clubName} blijft in ${DIVISIONS[level].name}.`);
  }

  // de afrekening: je belofte van de persconferentie en de doelen van het bestuur
  settleSeasonTickets(state);
  state.lastSeasonSettlement = settleSeason(state, pos);

  if (state.nextDivisionLevel !== level) {
    adjustWagesForDivision(state, level, state.nextDivisionLevel);
    // de naamsponsor volgt in newSeason, zodra de nieuwe reeks en het nieuwe prijspeil vastliggen
  }
  sponsorsAfterSeason(state, createRng(state), result, state.nextDivisionLevel);

  const profit = Object.entries(state.seasonTotals)
    .filter(([k]) => k !== 'leningen' && k !== 'investeerder')
    .reduce((s, [, v]) => s + (v ?? 0), 0);
  state.history.push({ season: state.season, division: DIVISIONS[level].name, position: pos, points: row.points, result, profit, prize });
  // je eigen groei als eigenaar: punten voor het seizoen, de promotie en het resultaat
  settleCareerSeason(state, result, profit);

  // het fonds wil blijven promoveren; de klok begint opnieuw bij elke promotie
  checkFundPatience(state);
}

/**
 * Een andere reeks betekent andere lonen. Bij promotie vragen spelers en staff meer
 * (ze spelen hoger, en andere clubs bellen), bij degradatie wordt er neerwaarts onderhandeld.
 */
function adjustWagesForDivision(state: GameState, from: number, to: number): void {
  const up = to > from;
  const players = up ? 1.14 : 0.9;
  const staff = up ? 1.1 : 0.93;
  for (const p of state.players) p.wage = Math.round((p.wage * players) / 5) * 5;
  for (const m of state.staff) m.wage = Math.round((m.wage * staff) / 5) * 5;
  addNews(
    state,
    up ? 'neutraal' : 'neutraal',
    up
      ? `Hogere reeks, hogere lonen: spelers vragen ongeveer ${Math.round((players - 1) * 100)}% meer, staff ${Math.round((staff - 1) * 100)}%.`
      : `Na de degradatie wordt er neerwaarts onderhandeld: spelerslonen ${Math.round((1 - players) * 100)}% lager, staff ${Math.round((1 - staff) * 100)}%.`,
  );
}

function newSeason(state: GameState, rng: Rng): void {
  state.week = 1;
  state.season++;
  state.lastSeasonTotals = state.seasonTotals;
  state.seasonTotals = {};
  state.merch.seasonUnits = 0;
  // alles wordt elk seizoen wat duurder; wie niets aanpast, ziet zijn marge verdampen
  state.inflation = Math.round(state.inflation * 1.07 * 1000) / 1000;
  rolloverStats(state);

  // huurlingen keren terug naar hun club, uitgeleende spelers komen terug
  const hired = state.players.filter((p) => p.loan?.type === 'in');
  if (hired.length) addNews(state, 'neutraal', `Huurspelers keren terug naar hun club: ${hired.map((p) => `${p.name} (${p.loan!.club})`).join(', ')}.`);
  state.players = state.players.filter((p) => p.loan?.type !== 'in');
  const back = state.players.filter((p) => p.loan?.type === 'uit');
  for (const p of back) p.loan = null;
  if (back.length) addNews(state, 'neutraal', `Terug van uitleenbeurt: ${back.map((p) => p.name).join(', ')}.`);

  // spelers worden ouder, aflopende contracten vertrekken
  const leaving = state.players.filter((p) => p.contractUntil < state.season);
  state.players = state.players.filter((p) => p.contractUntil >= state.season);
  const leftIds = new Set(leaving.map((p) => p.id));
  state.eventCounts = {};
  for (const p of state.players) {
    p.negotiations = 0;
    p.yellowCards = 0;
    p.redCards = 0;
    p.starts = 0;
    p.goals = 0;
    p.age++;
    p.friends = p.friends.filter((f) => !leftIds.has(f));
    p.form = 0;
  }
  if (leaving.length) addNews(state, 'neutraal', `Transfervrij vertrokken: ${leaving.map((p) => p.name).join(', ')}.`);

  // jeugd die doorstroomt
  const coord = staffSkill(state, 'jeugdcoordinator');
  const level = DIVISIONS[state.nextDivisionLevel].opponentStrength;
  const academy = state.infrastructure.academyLevel;
  const count = 1 + Math.floor(coord / 35) + (state.community.youthMembers > 250 ? 1 : 0) + academy;
  const newcomers = [];
  for (let i = 0; i < count; i++) {
    const p = generatePlayer(state, rng, {
      quality: level - 12 + coord / 10 + academy * 2,
      age: rng.int(17, 18),
      season: state.season,
      isYouth: true,
      potentialBoost: coord / 8 + state.community.youthMembers / 60 + academy * 3,
    });
    p.contractUntil = state.season + 2;
    newcomers.push(p);
  }
  state.players.push(...newcomers);
  linkFriends(newcomers.length > 1 ? newcomers : state.players, rng, newcomers.length);
  addNews(state, 'goed', `Doorstromers uit de eigen jeugd naar de A-kern: ${newcomers.map((p) => p.name).join(', ')}.`);
  poachYouth(state, rng, newcomers);

  // wat er deze zomer gebeurde, voor op de openingsaffiche
  const summer: string[] = [];
  if (hired.length) summer.push(`${hired.length} ${hired.length === 1 ? 'huurspeler' : 'huurspelers'} terug naar hun club`);
  if (back.length) summer.push(`${back.map((p) => p.name).join(', ')} terug van uitleenbeurt`);
  if (leaving.length) summer.push(`Transfervrij vertrokken: ${leaving.map((p) => p.name).join(', ')}`);
  const shirt = state.sponsors.find((d) => d.kind === 'shirt');
  summer.push(shirt ? `Nieuwe truitjes, met ${shirt.name} op de borst` : 'Nieuwe truitjes, nog zonder shirtsponsor op de borst');

  // het aantal jeugdleden wijzigt bij de inschrijvingen in week 10 (zie scheduledPayments)

  // nieuwe competitie. Je aartsrivaal blijft in dezelfde reeks altijd meedoen;
  // ga je op of af, dan is er een kans dat hij dezelfde weg aflegde.
  const oldRival = state.league.teams.find((t) => t.isRival)?.name;
  const sameDivision = state.nextDivisionLevel === state.league.divisionLevel;
  // eerst beslist de rest van de wereld: wie investeert, wie bespaart, wie promoveert
  state.lastWorldMoves = runWorldSeason(state, rng);
  announceWorldMoves(state, rng);
  const rivalClub = oldRival ? clubByName(state.world, oldRival) : undefined;
  const rivalFollows = rivalClub ? rivalClub.divisionLevel === state.nextDivisionLevel : rng.chance(0.35);
  const carry = oldRival && (sameDivision || rivalFollows) ? [oldRival] : [];
  state.league = createLeague(rng, state.nextDivisionLevel, carry, state.world);
  // de naamsponsor van de aannemer wordt nooit heronderhandeld, dus herbekijken we hem zelf:
  // nu de nieuwe reeks, de reputatie van vorig seizoen en het nieuwe prijspeil vastliggen
  updateStadiumSponsor(state, sameDivision ? 'seizoen' : 'reeks');
  if (carry.length && !sameDivision) addNews(state, 'neutraal', `${oldRival} legde dezelfde weg af: de derby staat ook volgend seizoen op de kalender.`);
  state.ticketPrice = Math.max(state.ticketPrice, DIVISIONS[state.nextDivisionLevel].refTicketPrice - 2);
  state.lastMatch = null;
  refreshTransferList(state, rng, true);
  refreshStaffMarket(state, rng);
  refreshLoanMarket(state, rng);
  addNews(state, 'neutraal', `Nieuw seizoen: ${DIVISIONS[state.league.divisionLevel].name}. De transferperiode is open.`);

  // de opening: de pers blikt vooruit, het bestuur legt zijn doelen op tafel en jij moet iets zeggen
  state.ambition = null;
  state.opening = createOpening(
    state,
    rng,
    newcomers.map((p) => `${p.name} (${p.age}j, ${p.position})`),
    summer,
  );
}
