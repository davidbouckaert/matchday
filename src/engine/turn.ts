// Het hart van het spel: één beurt (week) verwerken.
// advanceWeek krijgt de huidige toestand en geeft een NIEUWE toestand terug.

import type { Fixture, GamePlan, GameState, WeekRecord } from './types';
import type { Rng } from './rng';
import { clamp, createRng } from './rng';
import { DIVISIONS, diplomaRank } from './data/divisions';
import { COURSES, UPGRADES } from './data/catalog';
import {
  BOND_FEE_WEEK,
  LICENCE_AUDIT_WEEK,
  SEASON_END_WEEK,
  SUBSIDY_WEEK,
  WEEKS_PER_YEAR,
  isWinter,
} from './calendar';
import { OWN_TEAM_ID, applyResult, createLeague, opponentStrength, ownPosition, simulateMatch, sortedTable } from './league';
import { developPlayers, generatePlayer, linkFriends, selectLineup, teamStrength } from './players';
import { hasStaff, staffSkill, staffWage } from './staff';
import { bookAwayMatch, bookHomeMatch, bookWeeklyFlows, type Weather } from './finance';
import { resolveRequests, weeklySponsors } from './sponsors';
import { weeklyMerch } from './merch';
import { bankruptcyCheck, rollInjuries, weeklyEvents } from './events';
import { refreshLoanMarket, refreshStaffMarket, refreshTransferList, weeklyMarket } from './market';
import { addNews, book } from './util';
import { rolloverStats } from './stats';
import { runDelegatedTasks, strategyTask } from './delegation';
import { opponentSide, trainingCost, weeklyMoraleEffect } from './strategy';
import { NATURAL_RECOVERY, matchLoad, recovery, trainingLoad } from './factors';
import { available, cardsForOpponent, cardsForOwnTeam, serveOpponentSuspensions, serveOwnSuspensions } from './discipline';
import { YOUTH_FEE_REF, YOUTH_FEE_WEEK, youthForecast } from './actions';
import { BIJSCHOLING } from './data/catalog';

export function advanceWeek(previous: GameState): GameState {
  if (previous.gameOver) return previous;
  const state: GameState = structuredClone(previous);
  const rng = createRng(state);

  runDelegatedTasks(state, rng);
  bookWeeklyFlows(state);
  book(state, 'trainingen', -trainingCost(state), `${state.tactics.trainings} trainingen (velden, licht, materiaal)`);
  payPending(state);
  playMatchWeek(state, rng);
  scheduledPayments(state);
  weeklyMerch(state, rng);
  resolveRequests(state, rng);
  weeklyCommunity(state);
  weeklyVolunteers(state, rng);
  weeklySponsors(state, rng);
  weeklyEvents(state, rng);
  weeklyProgress(state);
  weeklyPlayers(state, rng);
  if (state.week === LICENCE_AUDIT_WEEK) licenceAudit(state);
  if (state.week === SEASON_END_WEEK) seasonEnd(state);
  weeklyMarket(state, rng);
  bankruptcyCheck(state);

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
  if (!state.gameOver) strategyTask(state, rng); // de trainer bereidt de volgende week voor
  return state;
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

  const { lineup } = selectLineup(state.players, state.tactics.formation, state.tactics.manualXI);
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

  // kaarten en schorsingen
  const cards = cardsForOwnTeam(state, rng, lineup, opponent.isRival);
  cardsForOpponent(state, rng, opponentId, opponent.isRival);
  serveOwnSuspensions(state.players, ownSuspended);
  serveOpponentSuspensions(state, opponentId, theirBanned);

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
  for (const p of state.players) if (lineupIds.has(p.id)) p.fatigue = clamp(p.fatigue + load, 0, 100);
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
      addNews(state, p.volunteers > 0 ? 'goed' : 'neutraal', p.volunteers > 0 ? `${p.label}: ${p.volunteers} nieuwe vrijwilliger(s).` : `${p.label}: helaas geen nieuwe vrijwilligers.`);
    } else if (p.amount) {
      addNews(state, 'goed', `${p.label}: €${p.amount.toLocaleString('nl-BE')} ontvangen.`);
    }
  }
  state.pending = state.pending.filter((p) => p.weeksLeft > 0);
}

// ---------- Vaste momenten in het jaar ----------

function scheduledPayments(state: GameState): void {
  const c = state.community;
  if (state.week === BOND_FEE_WEEK) {
    const fee = 5000 + state.players.length * 150 + c.youthMembers * 22 + state.league.divisionLevel * 3000;
    book(state, 'bond & verzekering', -fee, 'Aansluiting Voetbal Vlaanderland en verzekeringen');
  }
  if (state.week === YOUTH_FEE_WEEK) {
    const before = c.youthMembers;
    c.youthMembers = youthForecast(state);
    book(state, 'lidgelden', c.youthMembers * state.youthFee, `Lidgelden jeugd (${c.youthMembers} × €${state.youthFee})`);
    const diff = c.youthMembers - before;
    addNews(state, diff >= 0 ? 'goed' : 'slecht', `Inschrijvingen jeugd: ${c.youthMembers} leden (${diff >= 0 ? '+' : ''}${diff} tegenover vorig seizoen) aan €${state.youthFee}.`);
    if (state.youthFee > YOUTH_FEE_REF * 1.5) c.fanMood = clamp(c.fanMood - 3, 0, 100);
    if (state.youthFee < YOUTH_FEE_REF * 0.7) c.reputation = clamp(c.reputation + 1, 0, 100);
  }
  if (state.week === SUBSIDY_WEEK) {
    book(state, 'subsidies', 8000 + c.youthMembers * 25, 'Subsidie gemeente (jeugdwerking)');
  }
}

/**
 * Vrijwilligers komen en gaan. Wie tevreden is (goede sfeer, een kantineverantwoordelijke,
 * niet te veel evenementen achter elkaar) blijft; anders haken er mensen af.
 */
export function volunteerSatisfaction(state: GameState): number {
  const c = state.community;
  const events = state.eventLog.filter((e) => e.season === state.season && e.week > state.week - 8).length;
  const load = clamp(c.volunteers / 30, 0.5, 1.5);
  return clamp(
    35 + c.fanMood * 0.3 + c.reputation * 0.15 + staffSkill(state, 'kantine') * 0.15 + (c.volunteerLoyaltyWeeks > 0 ? 12 : 0) - (events * 6) / load,
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
    const gone = rng.int(1, sat < 30 ? 3 : 2);
    c.volunteers = Math.max(4, c.volunteers - gone);
    addNews(state, 'slecht', `${gone} vrijwilliger(s) haken af (tevredenheid ${Math.round(sat)}/100).`);
  } else if (sat > 65 && rng.chance((sat - 65) / 200)) {
    c.volunteers += 1;
    addNews(state, 'goed', 'Een nieuwe vrijwilliger sluit spontaan aan.');
  }
}

function weeklyCommunity(state: GameState): void {
  const c = state.community;
  const division = DIVISIONS[state.league.divisionLevel];
  if (c.volunteerLoyaltyWeeks > 0) c.volunteerLoyaltyWeeks--;
  // supportersaantal groeit richting wat normaal is voor de reeks en je reputatie
  const target = division.fanBaseNorm * (0.6 + c.reputation / 100) * (state.investor === 'cooperatie' ? 1.15 : 1) + staffSkill(state, 'commercieel') * 2;
  c.fanBase = Math.round(c.fanBase + (target - c.fanBase) * 0.01);
  // de sfeer zakt of stijgt langzaam terug naar normaal
  c.fanMood = clamp(c.fanMood + (60 - c.fanMood) * 0.02, 0, 100);
  const ref = division.refTicketPrice;
  if (state.ticketPrice > ref * 1.2) c.fanMood = clamp(c.fanMood - (state.investor === 'cooperatie' ? 2 : 0.7), 0, 100);
  if (state.ticketPrice < ref * 0.8) c.fanMood = clamp(c.fanMood + 0.3, 0, 100);
}

function weeklyProgress(state: GameState): void {
  // bouwprojecten
  const i = state.infrastructure;
  if (i.construction) {
    i.construction.weeksLeft--;
    if (i.construction.weeksLeft <= 0) {
      const id = i.construction.upgrade;
      if (id === 'tribune') i.capacity += 300;
      if (id === 'kantine') i.kantineLevel = Math.min(5, i.kantineLevel + 1);
      if (id === 'kunstgras') i.pitch = 'kunstgras';
      if (id === 'verlichting') i.lightingLevel = Math.min(3, i.lightingLevel + 1);
      if (id === 'opleidingscentrum') i.academyLevel = Math.min(3, i.academyLevel + 1);
      if (id === 'recuperatie') i.recoveryLevel = Math.min(2, i.recoveryLevel + 1);
      if (id === 'wifi') i.wifiLevel = Math.min(2, i.wifiLevel + 1);
      if (id === 'sanitair') i.sanitairLevel = Math.min(2, i.sanitairLevel + 1);
      if (id === 'parking') i.parkingLevel = Math.min(2, i.parkingLevel + 1);
      i.construction = null;
      addNews(state, 'goed', `Bouwproject afgerond: ${UPGRADES.find((u) => u.id === id)!.label}.`);
      state.community.fanMood = clamp(state.community.fanMood + 3, 0, 100);
    }
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
    const training = p.injuryWeeks > 0 ? 0 : build;
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
  if (state.infrastructure.lightingLevel < division.requiredLighting) problems.push('verlichting onvoldoende');
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

// ---------- Seizoenseinde en nieuw seizoen ----------

function seasonEnd(state: GameState): void {
  const table = sortedTable(state.league);
  const pos = table.findIndex((r) => r.teamId === OWN_TEAM_ID) + 1;
  const row = table[pos - 1];
  const level = state.league.divisionLevel;
  const c = state.community;
  let result: 'promotie' | 'degradatie' | 'behoud' | 'kampioen' = 'behoud';

  if (pos === 1 && level < DIVISIONS.length - 1) {
    result = 'kampioen';
    state.nextDivisionLevel = level + 1;
    state.promotionsWithInvestor++;
    c.reputation = clamp(c.reputation + 12, 0, 100);
    c.fanMood = clamp(c.fanMood + 20, 0, 100);
    c.fanBase = Math.round(c.fanBase * 1.25);
    book(state, 'meevallers', 5000 + level * 10000, 'Kampioenenpremie en feest');
    addNews(state, 'goed', `KAMPIOEN! ${state.clubName} promoveert naar ${DIVISIONS[level + 1].name}!`);
  } else if (pos === 2 && level < DIVISIONS.length - 1) {
    result = 'promotie';
    state.nextDivisionLevel = level + 1;
    state.promotionsWithInvestor++;
    c.reputation = clamp(c.reputation + 8, 0, 100);
    c.fanMood = clamp(c.fanMood + 12, 0, 100);
    c.fanBase = Math.round(c.fanBase * 1.15);
    addNews(state, 'goed', `Tweede plaats en promotie naar ${DIVISIONS[level + 1].name}!`);
  } else if (pos >= table.length - 2 && level > 0) {
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

  const profit = Object.entries(state.seasonTotals)
    .filter(([k]) => k !== 'leningen' && k !== 'investeerder')
    .reduce((s, [, v]) => s + (v ?? 0), 0);
  state.history.push({ season: state.season, division: DIVISIONS[level].name, position: pos, points: row.points, result, profit });

  // het fonds wil promotie binnen 3 seizoenen
  if (state.investor === 'fonds' && state.investorActive && state.season >= 3 && state.promotionsWithInvestor === 0) {
    state.investorActive = false;
    book(state, 'investeerder', -300_000, 'Terugtrekking investeringsfonds');
    addNews(state, 'slecht', 'Het fonds is het geduld kwijt: geen promotie in 3 seizoenen. Het trekt €300.000 terug.');
  }
}

function newSeason(state: GameState, rng: Rng): void {
  state.week = 1;
  state.season++;
  state.lastSeasonTotals = state.seasonTotals;
  state.seasonTotals = {};
  state.merch.seasonUnits = 0;
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
    p.yellowCards = 0;
    p.redCards = 0;
    p.starts = 0;
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

  // het aantal jeugdleden wijzigt bij de inschrijvingen in week 10 (zie scheduledPayments)

  // nieuwe competitie
  state.league = createLeague(rng, state.nextDivisionLevel);
  state.ticketPrice = Math.max(state.ticketPrice, DIVISIONS[state.nextDivisionLevel].refTicketPrice - 2);
  state.lastMatch = null;
  refreshTransferList(state, rng, true);
  refreshStaffMarket(state, rng);
  refreshLoanMarket(state, rng);
  addNews(state, 'neutraal', `Nieuw seizoen: ${DIVISIONS[state.league.divisionLevel].name}. De transferperiode is open.`);
}
