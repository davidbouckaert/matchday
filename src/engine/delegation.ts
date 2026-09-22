// Taken die je aan staff overlaat. Elke week, vóór de wedstrijden, doet elk staflid
// het werk waarvoor hij is aangeduid. Hoe beter hij is, hoe beter zijn keuzes.

import type { GameState, Mentality, Position, Staff, TaskId, TrainingFocus } from './types';
import { PLANS, nextOpponent } from './strategy';
import { avgFatigue } from './factors';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { CANTEEN_ITEMS, CLUB_EVENTS, CONCESSIONS, CONCESSION_SPACE, MERCH_ITEMS, TASKS } from './data/catalog';
import { isTransferWindow } from './calendar';
import { FORMATIONS, POSITIONS, bestForRole, bestFormation, departureBlock, isCorePlayer, overall, teamStrength } from './players';
import { expectedAttendance, spendPerHead } from './finance';
import { staffSkill } from './staff';
import { acceptSponsorOffer, approachProspect, renewSponsor } from './sponsors';
import { addMerchItem, buyPlayer, canOrganise, eventForecast, extendContract, openConcession, organiseEvent, sellPlayer, volunteerAction } from './actions';
import { bestPrice } from './merch';
import { acceptedMargin } from './canteen';
import { usedConcessionSpace } from './actions';
import { addNews } from './util';

/** Wie doet deze taak? undefined = de eigenaar. */
export function delegate(state: GameState, task: TaskId): Staff | undefined {
  const id = state.delegation[task];
  return id ? state.staff.find((x) => x.id === id) : undefined;
}

export function tasksOf(state: GameState, staffId: string): TaskId[] {
  return TASKS.filter((t) => state.delegation[t.id] === staffId).map((t) => t.id);
}

/** Kans op een minder goede keuze: 0 bij een topper, ~0,35 bij een zwak staflid. */
function errorChance(skill: number): number {
  return clamp((100 - skill) / 200, 0, 0.4);
}

export function runDelegatedTasks(state: GameState, rng: Rng): void {
  contractTask(state, rng);
  transferTask(state);
  sponsorTask(state);
  ticketTask(state, rng);
  eventTask(state);
  volunteerTask(state);
  merchTask(state);
  horecaTask(state);
}

// ---------- Strategie: training, opstelling en tactiek ----------

/**
 * De trainer bereidt de volgende wedstrijd voor. Dit loopt op het einde van elke beurt
 * (en meteen bij het delegeren), zodat je zijn keuzes ziet vóór de wedstrijd gespeeld wordt.
 */
export function strategyTask(state: GameState, rng: Rng = createRng(state)): void {
  const trainingStaff = delegate(state, 'training');
  const lineupStaff = delegate(state, 'opstelling');
  const tacticStaff = delegate(state, 'tactiek');
  const roleStaff = delegate(state, 'spelersrollen');
  if (!trainingStaff && !lineupStaff && !tacticStaff && !roleStaff) return;
  const analyst = staffSkill(state, 'analist');
  const s = trainingStaff ?? lineupStaff ?? tacticStaff ?? roleStaff!;
  const skill = s.skill * (s.courseWeeksLeft > 0 ? 0.6 : 1) + analyst / 4;
  const err = errorChance(skill);
  const t = state.tactics;
  if (lineupStaff) t.manualXI = [];

  // spelersrollen
  if (roleStaff) {
    for (const role of ['kapitein', 'strafschop', 'hoekschop'] as const) {
      const pick = bestForRole(state.players, role);
      if (pick) t.roles[role] = pick.id;
    }
  }

  // training
  const injured = state.players.filter((p) => p.injuryWeeks > 0).length;
  const tired = avgFatigue(state.players.filter((p) => p.injuryWeeks === 0));
  const fitnessCoach = staffSkill(state, 'conditietrainer') > 0;
  if (trainingStaff) {
    t.trainings = injured >= 3 || tired > 30 ? 3 : skill >= 65 ? (fitnessCoach ? 5 : 4) : 3;
    if (injured >= 3) t.focus = 'herstel';
    else if (analyst) t.focus = 'tactiek';
    else {
      const tech = state.players.reduce((sum, p) => sum + p.technique, 0);
      const phys = state.players.reduce((sum, p) => sum + p.physical, 0);
      t.focus = phys < tech ? 'conditie' : 'techniek';
    }
    if (rng.chance(err)) t.focus = rng.pick(['conditie', 'techniek', 'tactiek', 'spelhervattingen', 'herstel'] as TrainingFocus[]);
  }

  // formatie
  const formations = Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[];
  if (lineupStaff) t.formation = rng.chance(err) ? rng.pick(formations) : bestFormation(state);
  if (!tacticStaff) return;

  // spelplan: tegen het verwachte plan van de tegenstander (met analist weet hij het zeker)
  const opp = nextOpponent(state);
  const expected = opp ? (analyst || rng.chance(0.5 + skill / 250) ? opp.knownPlan : rng.pick(PLANS)) : undefined;
  let bestPlan = t.plan;
  let bestScore = -Infinity;
  for (const plan of PLANS) {
    const trial = { ...state, tactics: { ...t, plan } };
    const score = teamStrength(trial, opp ? { strength: opp.strength, plan: expected } : undefined).total;
    if (score > bestScore) {
      bestScore = score;
      bestPlan = plan;
    }
  }
  t.plan = rng.chance(err) ? rng.pick(PLANS) : bestPlan;

  // mentaliteit
  let mentality: Mentality = 'gebalanceerd';
  if (opp) {
    const ours = teamStrength({ ...state, tactics: { ...t, mentality: 'gebalanceerd' } }).total;
    if (opp.strength > ours + 3) mentality = 'verdedigend';
    else if (ours > opp.strength + 3) mentality = 'aanvallend';
  }
  t.mentality = rng.chance(err) ? rng.pick(['verdedigend', 'gebalanceerd', 'aanvallend'] as Mentality[]) : mentality;
}

// ---------- Contracten ----------

function contractTask(state: GameState, rng: Rng): void {
  const s = delegate(state, 'contracten');
  if (!s || (state.week !== 36 && state.week !== 40)) return;
  const level = DIVISIONS[state.league.divisionLevel].opponentStrength;
  // de besten per positie houden (formatie + 1 reserve)
  const keep = new Set<string>();
  for (const pos of POSITIONS) {
    const n = FORMATIONS[state.tactics.formation][pos] + 1;
    state.players.filter((p) => p.position === pos).sort((a, b) => overall(b) - overall(a)).slice(0, n).forEach((p) => keep.add(p.id));
  }
  const extended: string[] = [];
  for (const p of state.players.filter((x) => x.contractUntil <= state.season)) {
    const talent = p.age <= 23 && p.potential >= level;
    if (!(keep.has(p.id) || talent) || p.age > 32) continue;
    if (rng.chance(errorChance(s.skill) / 2)) continue; // vergeten of slecht onderhandeld
    if (extendContract(state, p.id).ok) extended.push(p.name);
  }
  if (extended.length) addNews(state, 'neutraal', `${s.name} verlengde de contracten van ${extended.join(', ')}.`);
}

// ---------- Transfers ----------

const MIN_DEPTH: Record<Position, number> = { DOEL: 2, VERD: 6, MIDD: 6, AANV: 4 };

function transferTask(state: GameState): void {
  const s = delegate(state, 'transfers');
  if (!s || !isTransferWindow(state.week)) return;
  // opruimen: overtollige spelers die geen kernspeler zijn, mogen weg (nooit onder de veilige grens)
  if (state.players.length > 24) {
    const surplus = state.players
      .filter((p) => !isCorePlayer(state, p) && !p.loan && !departureBlock(state, p, 'verkopen'))
      .sort((a, b) => overall(a) - overall(b))[0];
    if (surplus && sellPlayer(state, surplus.id).ok) {
      addNews(state, 'neutraal', `${s.name} maakte plaats in de kern: ${surplus.name} vertrekt.`);
      return;
    }
  }
  for (const pos of POSITIONS) {
    const have = state.players.filter((p) => p.position === pos).length;
    if (have >= MIN_DEPTH[pos]) continue;
    const budget = Math.min(state.transferBudget, Math.max(0, state.cash - 20_000));
    const options = state.transferList
      .filter((p) => p.position === pos && p.purchasePrice <= budget)
      .sort((a, b) => overall(b) + (b.potential - overall(b)) * 0.3 - (overall(a) + (a.potential - overall(a)) * 0.3));
    const pick = options[0];
    if (!pick) continue;
    const price = pick.purchasePrice;
    if (buyPlayer(state, pick.id).ok) {
      state.transferBudget = Math.max(0, state.transferBudget - price);
      addNews(state, 'neutraal', `Scout ${s.name} haalde ${pick.name} (${pos}, ${overall(pick)}) binnen voor €${price.toLocaleString('nl-BE')}.`);
      return; // één transfer per week
    }
  }
}

// ---------- Sponsors ----------

function sponsorTask(state: GameState): void {
  const s = delegate(state, 'sponsoring');
  if (!s) return;
  for (const o of [...state.sponsorOffers]) {
    if (o.renewalOf) {
      const old = state.sponsors.find((d) => d.id === o.renewalOf);
      if (old && o.weekly >= old.weekly * 0.9) acceptSponsorOffer(state, o.id);
    } else acceptSponsorOffer(state, o.id);
  }
  for (const d of state.sponsors) if (d.weeksLeft <= 12 && d.satisfaction >= 45) renewSponsor(state, d.id);
  // om de twee weken een gesprek, alleen met bedrijven die enigszins geïnteresseerd zijn
  if (state.week % 2 === 0) {
    const target = state.prospects.filter((p) => !p.approached && p.cooldown === 0 && p.interest >= 30).sort((a, b) => b.interest - a.interest)[0];
    if (target) approachProspect(state, target.id);
  }
}

// ---------- Ticketprijs ----------

function ticketTask(state: GameState, rng: Rng): void {
  const s = delegate(state, 'ticketing');
  if (!s) return;
  const ref = DIVISIONS[state.league.divisionLevel].refTicketPrice;
  const cap = state.investor === 'cooperatie' ? ref * 1.2 : ref * 1.8;
  const original = state.ticketPrice;
  let best = original;
  let bestRevenue = -1;
  for (let price = Math.round(ref * 0.5); price <= cap; price++) {
    state.ticketPrice = price;
    const att = expectedAttendance(state, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    // een goede medewerker houdt rekening met de sfeer: dure tickets drukken die op termijn
    const moodPenalty = price > ref * 1.2 ? (price - ref * 1.2) * att * 0.4 * (s.skill / 100) : 0;
    const revenue = att * (price + spendPerHead(state)) - moodPenalty;
    if (revenue > bestRevenue) {
      bestRevenue = revenue;
      best = price;
    }
  }
  state.ticketPrice = Math.max(0, Math.round(best * (1 + rng.normal(0, errorChance(s.skill) / 3))));
}

// ---------- Evenementen ----------

function eventTask(state: GameState): void {
  const s = delegate(state, 'evenementen');
  if (!s || (state.eventCooldowns['auto-evenement'] ?? 0) > 0) return;
  const options = CLUB_EVENTS.filter((e) => !canOrganise(state, e))
    .map((e) => {
      const [min, max] = eventForecast(state, e);
      return { e, net: (min + max) / 2 - e.cost };
    })
    .filter((x) => x.net > 1_000 && state.cash - x.e.cost > 15_000)
    .sort((a, b) => b.net - a.net);
  if (!options.length) return;
  if (organiseEvent(state, options[0].e.id).ok) {
    state.eventCooldowns['auto-evenement'] = 5;
    addNews(state, 'neutraal', `${s.name} organiseert een ${options[0].e.label.toLowerCase()} (verwachte winst ~€${round(options[0].net, 50).toLocaleString('nl-BE')}).`);
  }
}

// ---------- Kantine en concessies ----------

function horecaTask(state: GameState): void {
  const s = delegate(state, 'horeca');
  if (!s) return;
  const err = errorChance(s.skill);
  for (const item of state.canteen.items) {
    const def = CANTEEN_ITEMS.find((c) => c.id === item.id)!;
    // de beste prijs ligt iets boven de richtprijs; een zwakker staflid mikt ernaast
    item.price = Math.round(def.ref * (1.12 - err) * 10) / 10;
  }
  if ((state.eventCooldowns['auto-concessie'] ?? 0) > 0) return;
  const open = CONCESSIONS.filter((c) => !state.canteen.concessions.some((x) => x.id === c.id) && usedConcessionSpace(state) + c.space <= CONCESSION_SPACE);
  const next = open.sort((a, b) => b.perVisitor * b.price - a.perVisitor * a.price)[0];
  if (next && openConcession(state, next.id, acceptedMargin(state, next.id)).ok) {
    state.eventCooldowns['auto-concessie'] = 8;
    addNews(state, 'goed', `${s.name} haalde een ${next.label.toLowerCase()} binnen voor de thuiswedstrijden.`);
  }
}

// ---------- Fanshop ----------

/** Het staflid zet elke prijs op de beste marge en breidt het assortiment uit als de kas het toelaat. */
function merchTask(state: GameState): void {
  const s = delegate(state, 'merchandising');
  if (!s || !state.merch.active) return;
  const sloppy = errorChance(s.skill);
  for (const item of state.merch.items) {
    const target = bestPrice(state, item.id);
    // een zwakker staflid mikt er wat naast
    item.price = Math.max(1, Math.round(target * (1 + (sloppy ? (state.week % 3) - 1 : 0) * sloppy * 0.5)));
  }
  const missing = MERCH_ITEMS.filter((d) => !state.merch.items.some((i) => i.id === d.id)).sort((a, b) => b.appeal - a.appeal);
  const next = missing[0];
  if (next && state.cash > next.setup + 25_000 && (state.eventCooldowns['auto-merch'] ?? 0) === 0) {
    if (addMerchItem(state, next.id).ok) {
      state.eventCooldowns['auto-merch'] = 6;
      addNews(state, 'neutraal', `${s.name} neemt ${next.label.toLowerCase()} op in het assortiment van de fanshop.`);
    }
  }
}

// ---------- Vrijwilligers ----------

function volunteerTask(state: GameState): void {
  const s = delegate(state, 'vrijwilligers');
  if (!s) return;
  const v = state.community.volunteers;
  const ready = (id: string) => (state.eventCooldowns[`vrijwilligers-${id}`] ?? 0) === 0;
  if (v < 22 && ready('infoavond') && state.cash > 10_000) volunteerAction(state, 'infoavond');
  else if (v < 32 && ready('oproep')) volunteerAction(state, 'oproep');
  if (state.week === 20 && ready('feest') && state.cash > 25_000) {
    volunteerAction(state, 'feest');
    addNews(state, 'goed', `${s.name} organiseerde een vrijwilligersfeest.`);
  }
}
