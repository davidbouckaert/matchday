// Taken die je aan staff overlaat. Elke week, vóór de wedstrijden, doet elk personeelslid
// het werk waarvoor hij is aangeduid. Hoe beter hij is, hoe beter zijn keuzes.

import type { GameState, Mentality, Position, Staff, TaskId, TrainingFocus, UpgradeId } from './types';
import { PLANS, nextOpponent } from './strategy';
import { NATURAL_RECOVERY, avgFatigue, matchLoad, recovery, trainingLoad } from './factors';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { CANTEEN_ITEMS, CLUB_EVENTS, CONCESSIONS, MERCH_ITEMS, TASKS, UPGRADES } from './data/catalog';
import { isTransferWindow } from './calendar';
import { FORMATIONS, POSITIONS, bestForRole, bestFormation, departureBlock, isCorePlayer, overall, squadBlock, teamStrength } from './players';
import { expectedAttendance, spendPerHead } from './finance';
import { acceptedMargin, expectedCanteenUnits } from './canteen';
import { staffSkill } from './staff';
import { supportFactor } from './support';
import { logDebug, logging } from '../log/logger';
import { skillStars } from './training-staff';
import { acceptSponsorOffer, approachProspect, renewSponsor } from './sponsors';
import {
  YOUTH_FEE_WEEK, addMerchItem, buyPlayer, canOrganise, canUpgrade, eventForecast, extendContract, openConcession, organiseEvent,
  sellPlayer, setMaintenance, setYouthFee, startUpgrade, upgradeCost, volunteerAction, youthFeeRef, youthTarget,
} from './actions';
import { bestPrice } from './merch';

import { MAX_PROJECTS, usedConcessionSpace } from './actions';
import { addNews } from './util';

/** Wie doet deze taak? undefined = de eigenaar. */
export function delegate(state: GameState, task: TaskId): Staff | undefined {
  const id = state.delegation[task];
  return id ? state.staff.find((x) => x.id === id) : undefined;
}

export function tasksOf(state: GameState, staffId: string): TaskId[] {
  return TASKS.filter((t) => state.delegation[t.id] === staffId).map((t) => t.id);
}

/**
 * Wat een personeelslid uit een taak haalt, als deel van wat er maximaal uit te halen valt.
 *
 * Dit is de kern van het spel geworden, dus het verdient een duidelijke regel in plaats van
 * een handvol losse vuistregels. Personeel hébben ontgrendelt het delegeren; hoe góed het
 * loopt, hangt af van wie je erop zet.
 *
 * Eén ster haalt de helft van wat er te halen valt, vijf sterren 85%. Die 85% is een plafond
 * met opzet: de laatste procenten zijn er alleen voor jou. Er bestaat een wiskundig perfecte
 * manier om elke week te spelen, en die kan een mens vinden — zelden, en met werk. Wie alles
 * uitbesteedt, koopt gemak en betaalt daarvoor met die vijftien procent.
 *
 * De trap ertussen is gelijkmatig: elke ster is ongeveer negen procentpunten waard. Dat maakt
 * opleiden de moeite in elke fase van het spel — van één naar twee sterren levert evenveel op
 * als van vier naar vijf, maar kost een stuk minder.
 */
export const STAR_EFFICIENCY = [0.5, 0.59, 0.68, 0.76, 0.85];

/** Van 1 tot 5 sterren: zijn vaardigheid, zijn vakgebied en zijn werklast samen. */
export function taskStars(state: GameState, taskId: TaskId, staff: Staff): number {
  return clamp(Math.round(taskSkill(state, taskId, staff) / 20), 1, 5);
}

/**
 * Het deel van de winst dat hij pakt.
 *
 * Zijn sterren zeggen hoe goed hij is, de rest van je club zegt of hij zijn werk kán doen.
 * Een trainer van vijf sterren zonder kinesist, zonder verzorger en zonder recuperatieruimte
 * haalt niet meer dan een trainer van drie sterren met dat alles achter zich — en dat hoort
 * ook zo. Wie zijn personeel wil laten renderen, moet er iets omheen bouwen.
 */
export function taskEfficiency(state: GameState, taskId: TaskId, staff: Staff): number {
  return STAR_EFFICIENCY[taskStars(state, taskId, staff) - 1] * supportFactor(state, taskId);
}

/**
 * Kiest uit een reeks mogelijkheden die welke bij deze efficiëntie hoort.
 *
 * De beste keuze is bekend — het spel kan ze uitrekenen — maar alleen jij mag eraan. Een
 * medewerker landt tussen niets doen en het beste, op de hoogte die bij zijn sterren past.
 * Zo betekent "80% efficiënt" ook echt tachtig procent van de winst, en niet een vaag gevoel.
 */
export function pickByEfficiency<T>(opties: { optie: T; waarde: number }[], basis: number, eff: number): T | null {
  if (!opties.length) return null;
  const beste = opties.reduce((a, b) => (b.waarde > a.waarde ? b : a));
  const doel = basis + (beste.waarde - basis) * eff;
  // de beste keuze die het doel niet voorbijschiet; is er geen, dan de zwakste
  const haalbaar = opties.filter((o) => o.waarde <= doel);
  if (!haalbaar.length) return opties.reduce((a, b) => (b.waarde < a.waarde ? b : a)).optie;
  return haalbaar.reduce((a, b) => (b.waarde > a.waarde ? b : a)).optie;
}

/** Een toevalsbron voor taken die er zelf geen meekrijgen. */
function rng2(state: GameState): Rng {
  return createRng(state);
}

/** Kans op een minder goede keuze: 0 bij een topper, ~0,35 bij een zwak personeelslid. */
function errorChance(skill: number): number {
  return clamp((100 - skill) / 200, 0, 0.4);
}

/**
 * Hoeveel taken iemand aankan.
 *
 * Dit stond op vier voor een topper, en daarmee hield je met drie goede mensen je hele club
 * draaiende: vijftien taken, vier mensen, klaar. Delegeren werd zo een eenmalige aankoop in
 * plaats van een afweging die blijft terugkomen. Nu doet een topper er drie, en de meesten
 * twee — je hebt dus meer mensen nodig, en elk van hen kost elke week loon.
 */
export function taskCapacity(staff: Staff): number {
  return staff.skill >= 80 ? 3 : staff.skill >= 45 ? 2 : 1;
}

/**
 * Hoe goed iemand deze taak doet. Zijn eigen vakgebied (de eerste rol bij de taak) ligt hem het best;
 * een taak die er maar naast ligt, doet hij met minder kennis van zaken. Elke extra taak kost ook iets.
 */
export function taskSkill(state: GameState, taskId: TaskId, staff: Staff): number {
  const task = TASKS.find((t) => t.id === taskId)!;
  const rank = task.roles.indexOf(staff.role);
  // Zijn vakgebied weegt zwaarder dan vroeger. Een kantineverantwoordelijke die je op de
  // ticketprijs zet, doet dat nu merkbaar minder goed dan de commercieel medewerker — zo is
  // "de juiste man op de juiste plaats" een echte keuze en niet alleen een detail.
  const fit = rank === 0 ? 1 : rank === 1 ? 0.75 : 0.58;
  // en elke extra taak drukt harder, zodat stapelen een prijs heeft
  const load = 1 - Math.max(0, tasksOf(state, staff.id).length - 1) * 0.1;
  const course = staff.courseWeeksLeft > 0 ? 0.6 : 1;
  return clamp(staff.skill * fit * load * course, 5, 100);
}



/**
 * De wekelijkse doorlichting: wat is er veranderd aan de club sinds vorige week?
 *
 * Dit is wat "hun keuzes zijn niet statisch" concreet maakt. Voor iemand aan het werk gaat,
 * wordt de club doorgelicht en vergeleken met de vorige week. Verandert er iets — een
 * kinesist erbij, een kantine verbouwd, iemand die een ster hoger komt — dan rekenen ze
 * daarna met die nieuwe werkelijkheid, en zie je in het logboek waaróm hun keuze verschoof.
 */
/**
 * Eén technische logregel uit de rekenkern.
 *
 * Dit is een ontwikkelaarslog, geen spelfeature. Er stond hier ooit een verhaaltje in gewone
 * taal dat ook op het scherm en in de browserconsole terechtkwam; dat was een breindump
 * vermomd als logging. Wat hier staat zijn de waarden waarmee gerekend is: de invoer, de
 * tussenstappen en wat eruit kwam, zodat je in het logbestand kunt nakijken of de motor doet
 * wat hij belooft.
 *
 * Alles loopt op debug: bij een normale run hangt er geen bestemming aan en kost dit niets.
 */
function taskLog(state: GameState, task: string, message: string, meta: Record<string, unknown>): void {
  if (!logging('debug')) return;
  logDebug(`delegatie.${task}`, message, { season: state.season, week: state.week, ...meta });
}

function scanClub(state: GameState, rng: Rng): void {
  const bezet = TASKS.filter((t) => delegate(state, t.id));
  if (!bezet.length) return;
  void rng;

  const nu = {
    staf: state.staff.map((m) => `${m.role}:${skillStars(m.skill)}`).sort().join(','),
    omkadering: bezet.map((t) => `${t.id}:${Math.round(supportFactor(state, t.id) * 100)}`).join(','),
  };
  const vorige = state.clubScan;
  const wijzigingen: string[] = [];

  if (vorige) {
    if (vorige.staf !== nu.staf) {
      const was = new Map(vorige.staf.split(',').filter(Boolean).map((x) => x.split(':') as [string, string]));
      const is = new Map(nu.staf.split(',').filter(Boolean).map((x) => x.split(':') as [string, string]));
      for (const [rol, sterren] of is) {
        if (!was.has(rol)) wijzigingen.push(`${rol} in dienst (${sterren} sterren)`);
        else if (was.get(rol) !== sterren) wijzigingen.push(`${rol} van ${was.get(rol)} naar ${sterren} sterren`);
      }
      for (const [rol] of was) if (!is.has(rol)) wijzigingen.push(`${rol} uit dienst`);
    }
    if (vorige.omkadering !== nu.omkadering) {
      for (const t of bezet) {
        const oud = vorige.omkadering.split(',').find((x) => x.startsWith(`${t.id}:`))?.split(':')[1];
        const nieuw = Math.round(supportFactor(state, t.id) * 100);
        if (oud !== undefined && Number(oud) !== nieuw) wijzigingen.push(`omkadering ${t.label.toLowerCase()} van ${oud}% naar ${nieuw}%`);
      }
    }
  }
  state.clubScan = nu;

  taskLog(state, 'scan', wijzigingen.length ? 'club changed' : 'no change', {
    staff: state.staff.length,
    delegated: `${bezet.length}/${TASKS.length}`,
    support: Object.fromEntries(bezet.map((t) => [t.id, Number(supportFactor(state, t.id).toFixed(3))])),
    fatigue: Number(avgFatigue(state.players.filter((p) => p.injuryWeeks === 0)).toFixed(1)),
    injured: state.players.filter((p) => p.injuryWeeks > 0).length,
    ...(wijzigingen.length ? { changes: wijzigingen } : {}),
  });
}

export function runDelegatedTasks(state: GameState, rng: Rng): void {
  scanClub(state, rng);
  contractTask(state, rng);
  transferTask(state);
  sponsorTask(state);
  ticketTask(state, rng);
  eventTask(state);
  volunteerTask(state);
  merchTask(state);
  horecaTask(state);
  youthTask(state);
  medicalTask(state);
  facilityTask(state);
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
  const lead = lineupStaff ?? tacticStaff ?? trainingStaff ?? roleStaff!;
  const skill = taskSkill(state, lineupStaff ? 'opstelling' : tacticStaff ? 'tactiek' : 'training', lead) + analyst / 4;
  const err = errorChance(skill);
  const t = state.tactics;
  if (lineupStaff) {
    // geeft je trainer de opstelling in handen: hij vult zelf aan en laat geen plaatsen open
    t.manualXI = [];
    t.benched = [];
    t.gaps = {};
  }

  // spelersrollen
  if (roleStaff) {
    for (const role of ['kapitein', 'strafschop', 'hoekschop'] as const) {
      const pick = bestForRole(state.players, role);
      if (pick) t.roles[role] = pick.id;
    }
  }

  // Training.
  //
  // Dit koos vroeger uit een handvol vuistregels: drie trainingen bij blessures, anders vier
  // of vijf. Een echte trainer kijkt naar wat de groep aankan, en dat hangt niet alleen af
  // van hoe moe ze zijn maar ook van wat je club eraan kan doen: een kinesist, een verzorger,
  // een voedingsdeskundige en een recuperatieruimte halen er elke week vermoeidheid af. Met
  // dat apparaat achter zich kan hij zwaarder trainen zonder de groep op te branden.
  //
  // Hij rekent het nu uit met dezelfde functies waarmee het spel de vermoeidheid boekt:
  // hoeveel elke training erbij legt, hoeveel de wedstrijd kost en hoeveel er vanzelf en
  // door je staf af gaat. Dan kiest hij het zwaarste schema dat de groep volgende week nog
  // fris genoeg houdt. Hoe beter hij is, hoe scherper hij die grens durft op te zoeken.
  const injured = state.players.filter((p) => p.injuryWeeks > 0).length;
  const tired = avgFatigue(state.players.filter((p) => p.injuryWeeks === 0));
  if (trainingStaff) {
    // Hoeveel een schema waard is: meer trainingen laten spelers sneller groeien, maar een
    // groep die volgende week over de streep gaat, speelt slechter en raakt geblesseerd.
    const eff = taskEfficiency(state, 'training', trainingStaff);
    const waardeVan = (n: number) => {
      const proef = { ...state, tactics: { ...t, trainings: n } };
      const volgende = tired * (1 - NATURAL_RECOVERY) + trainingLoad(proef) + matchLoad(proef) - recovery(proef);
      const teVeel = Math.max(0, volgende - 32);
      return n * 1.2 - teVeel * teVeel * 0.12; // winst van trainen, min wat oververmoeidheid kost
    };
    const opties = [2, 3, 4, 5].map((n) => ({ optie: n, waarde: waardeVan(n) }));
    // de basis is drie trainingen: wat een club zonder trainer sowieso doet
    const gekozen = pickByEfficiency(opties, waardeVan(3), eff) ?? 3;
    const vorige = t.trainings;
    // Gas terugnemen bij een uitgeputte groep is geen optimalisatie maar gezond verstand:
    // dat ziet ook een zwak omkaderde trainer. Daarom staat deze grens los van zijn
    // efficiëntie — anders bleef hij bij een doodvermoeide ploeg op de standaard hangen.
    const plafond = tired >= 52 ? 2 : tired >= 42 || injured >= 3 ? 3 : 5;
    t.trainings = Math.min(gekozen, plafond);

    taskLog(state, 'training', 'trainings set', {
      staff: trainingStaff.id,
      eff: Number(eff.toFixed(3)),
      support: Number(supportFactor(state, 'training').toFixed(3)),
      fatigue: Number(tired.toFixed(1)),
      injured,
      recovery: Number(recovery(state).toFixed(2)),
      baseline: Number(waardeVan(3).toFixed(3)),
      candidates: Object.fromEntries(opties.map((o) => [o.optie, Number(o.waarde.toFixed(3))])),
      optimum: opties.reduce((a, b) => (b.waarde > a.waarde ? b : a)).optie,
      picked: gekozen,
      ceiling: plafond,
      from: vorige,
      to: t.trainings,
    });

    if (injured >= 3 || tired > 45) t.focus = 'herstel';
    else if (analyst && skill >= 55) t.focus = 'tactiek';
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
    if (rng.chance(errorChance(taskSkill(state, 'contracten', s)) / 2)) continue; // vergeten of slecht onderhandeld
    if (extendContract(state, p.id).ok) extended.push(p.name);
  }
  if (extended.length) addNews(state, 'neutraal', `${s.name} verlengde de contracten van ${extended.join(', ')}.`);
}

// ---------- Transfers ----------

const MIN_DEPTH: Record<Position, number> = { DOEL: 2, VERD: 6, MIDD: 6, AANV: 4 };

function transferTask(state: GameState): void {
  const s = delegate(state, 'transfers');
  if (!s || !isTransferWindow(state.week)) return;

  // Een scout zonder budget kan alleen noodaankopen doen, en dat hoor je te weten. De
  // doorlichting van september 2026 vond dat het budget op nul start en niemand het zegt:
  // "transfers uitbesteed" deed dan stilletjes bijna niets.
  if (state.transferBudget <= 0 && (state.eventCooldowns['scout-budget'] ?? 0) === 0) {
    state.eventCooldowns['scout-budget'] = 20;
    addNews(
      state,
      'neutraal',
      `${s.name}: "Mijn transferbudget staat op nul. Zet er bij Ploeg › Transfers iets op, of ik kan alleen ingrijpen als de kern te klein wordt."`,
    );
  }

  /*
   * Eerst de kern rond krijgen.
   *
   * Hier zat een gat: besteedde je je transfers uit, dan kocht je scout wel versterking per
   * linie, maar keek niemand naar het totaal. Gemeten over zes seizoenen stonden die clubs
   * tientallen weken onder de zestien spelers — in het spel zelf zou je daar vastlopen en
   * zélf spelers moeten halen. Een medewerker die je transfers doet, hoort dat te zien.
   *
   * Hij pakt het aan zoals jij zou doen als het snel moet: eerst kijken of er iemand
   * transfervrij is, want dat kost geen overnamesom, en anders de goedkoopste die past.
   */
  if (squadBlock(state)) {
    const vrij = state.transferList
      .filter((p) => p.purchasePrice <= Math.max(0, state.cash - 5_000))
      .sort((a, b) => a.purchasePrice - b.purchasePrice || overall(b) - overall(a));
    const pick = vrij[0];
    if (pick && buyPlayer(state, pick.id).ok) {
      addNews(
        state,
        'neutraal',
        `Je kern was te klein. ${s.name} haalde ${pick.name} (${pick.position}, ${overall(pick)}) binnen${pick.purchasePrice ? ` voor €${pick.purchasePrice.toLocaleString('nl-BE')}` : ' zonder overnamesom'}.`,
      );
    }
    return; // dit gaat voor op alles
  }
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
  const opbrengst = (price: number) => {
    state.ticketPrice = price;
    const att = expectedAttendance(state, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    // dure tickets brengen vandaag meer op maar drukken de sfeer, en dat kost je op termijn volk
    const moodPenalty = price > ref * 1.2 ? (price - ref * 1.2) * att * 0.4 : 0;
    return att * (price + spendPerHead(state)) - moodPenalty;
  };
  const opties: { optie: number; waarde: number }[] = [];
  for (let price = Math.round(ref * 0.5); price <= cap; price++) opties.push({ optie: price, waarde: opbrengst(price) });
  const basis = opbrengst(ref); // de richtprijs van je reeks: wat het zonder ingrijpen opbrengt
  const eff = taskEfficiency(state, 'ticketing', s);
  const gekozen = pickByEfficiency(opties, basis, eff) ?? original;
  state.ticketPrice = Math.max(0, Math.round(gekozen * (1 + rng.normal(0, errorChance(taskSkill(state, 'ticketing', s)) / 4))));
  const beste = opties.reduce((a, b) => (b.waarde > a.waarde ? b : a));
  taskLog(state, 'ticketing', 'ticket price set', {
    staff: s.id,
    eff: Number(eff.toFixed(3)),
    support: Number(supportFactor(state, 'ticketing').toFixed(3)),
    division: DIVISIONS[state.league.divisionLevel].name,
    ref,
    cap,
    baseline: Number(basis.toFixed(1)),
    optimum: { price: beste.optie, value: Number(beste.waarde.toFixed(1)) },
    picked: gekozen,
    from: original,
    to: state.ticketPrice,
  });
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

// ---------- Jeugd, medisch en infrastructuur ----------

/** De jeugdcoördinator zoekt het lidgeld waar de opbrengst het hoogst ligt. */
function youthTask(state: GameState): void {
  const s = delegate(state, 'jeugd');
  if (!s || state.week > YOUTH_FEE_WEEK) return;
  // Hij zoekt binnen een band rond wat op dit niveau gangbaar is. Die band schuift dus mee
  // met je reeks: een coördinator in de Pro Liga vraagt niet wat een dorpsclub vraagt.
  const ref = youthFeeRef(state);
  const laag = Math.round(ref * 0.5);
  const hoog = Math.round(ref * 2.2);
  // Hij kijkt naar waar het ledenaantal op termijn uitkomt, niet naar wat volgend seizoen
  // het meeste opbrengt. Eén jaar flink verhogen levert meer op — de helft van je leden
  // blijft nog even zitten — maar daarna zak je door. Een jeugdcoördinator doet dat niet.
  let best = state.youthFee;
  let bestRevenue = -Infinity;
  for (let fee = laag; fee <= hoog; fee += 10) {
    const revenue = youthTarget(state, fee) * fee;
    if (revenue > bestRevenue) {
      bestRevenue = revenue;
      best = fee;
    }
  }
  // een zwakker personeelslid mikt ernaast
  const off = Math.round(errorChance(taskSkill(state, 'jeugd', s)) * ref * 0.5);
  setYouthFee(state, clamp(best - off, laag, hoog));
}

/** Kinesist of verzorger grijpt in als de groep te zwaar belast raakt. */
function medicalTask(state: GameState): void {
  const s = delegate(state, 'medisch');
  if (!s) return;
  const fit = state.players.filter((p) => p.injuryWeeks === 0);
  const tired = avgFatigue(fit);
  const injured = state.players.filter((p) => p.injuryWeeks > 0).length;
  const t = state.tactics;
  if (tired > 45 || injured >= 3) {
    if (t.trainings > 2) t.trainings = Math.max(2, t.trainings - 1);
    t.focus = 'herstel';
    if ((state.eventCooldowns['medisch-melding'] ?? 0) === 0) {
      state.eventCooldowns['medisch-melding'] = 4;
      addNews(state, 'neutraal', `${s.name} schroeft de belasting terug: ${Math.round(tired)}/100 vermoeidheid en ${injured} geblesseerde(n).`);
    }
  } else if (tired < 20 && injured === 0 && t.focus === 'herstel') {
    t.focus = 'conditie';
  }
}

/** Onderhoud en bouwprojecten, met een ruime buffer op de rekening. */
function facilityTask(state: GameState): void {
  const s = delegate(state, 'infrastructuur');
  if (!s) return;
  const weekly = state.players.reduce((sum, p) => sum + p.wage, 0) + state.staff.reduce((sum, x) => sum + x.wage, 0);
  const buffer = weekly * 12;
  const level = state.cash > buffer * 2 ? 'premium' : state.cash > buffer ? 'normaal' : 'basis';
  if (state.infrastructure.maintenance !== level) setMaintenance(state, level as 'basis' | 'normaal' | 'premium');
  if (state.infrastructure.constructions.length >= MAX_PROJECTS || (state.eventCooldowns['auto-bouw'] ?? 0) > 0) return;
  const division = DIVISIONS[state.league.divisionLevel];
  const next = DIVISIONS[Math.min(DIVISIONS.length - 1, state.league.divisionLevel + 1)];
  const i = state.infrastructure;
  // eerst wat de licentie of promotie vraagt, daarna wat het meest opbrengt
  const wish: UpgradeId[] = [];
  if (i.capacity < next.requiredCapacity) wish.push('tribune');
  if (i.lightingLevel < next.requiredLighting) wish.push('verlichting');
  if (i.capacity < division.requiredCapacity) wish.unshift('tribune');
  wish.push('kantine', 'wifi', 'scorebord', 'toiletten', 'kleedkamers', 'ledverlichting', 'recuperatie', 'parking');
  for (const id of wish) {
    if (canUpgrade(state, id)) continue;
    const cost = upgradeCost(state, id);
    if (state.cash - cost < buffer) continue;
    if (startUpgrade(state, id).ok) {
      state.eventCooldowns['auto-bouw'] = 8;
      addNews(state, 'neutraal', `${s.name} start een bouwproject: ${UPGRADES.find((u) => u.id === id)!.label}.`);
      return;
    }
  }
}

// ---------- Kantine en concessies ----------

function horecaTask(state: GameState): void {
  const s = delegate(state, 'horeca');
  if (!s) return;
  const vaardigheid = taskSkill(state, 'horeca', s);
  const err = errorChance(vaardigheid);

  // Hij zoekt nu echt de beste prijs in plaats van de richtprijs met een vaste opslag te
  // nemen. Per artikel loopt hij de prijzen af en rekent hij met het echte vraagmodel van
  // het spel uit wat er overblijft: duurder betekent minder pinten, goedkoper meer volk aan
  // de toog maar minder marge per glas. Ergens daartussen ligt de top, en waar die ligt
  // hangt af van je kantine, je vrijwilligers en je populariteit — dus ze verschuift.
  //
  // Hoe beter hij is, hoe dichter hij bij die top uitkomt. Een zwakke kracht kijkt maar een
  // paar stappen ver en mikt ernaast; een topper haalt er alles uit.
  const eff = taskEfficiency(state, 'horeca', s);
  const bezoekers = Math.max(50, Math.round(expectedAttendance(state, { weather: 'bewolkt', derby: false, positionFactor: 1 })));
  for (const item of state.canteen.items) {
    const def = CANTEEN_ITEMS.find((c) => c.id === item.id)!;
    const opbrengst = (prijs: number) => {
      const bewaard = item.price;
      item.price = prijs;
      const waarde = expectedCanteenUnits(state, item.id, bezoekers) * (prijs - def.cost);
      item.price = bewaard;
      return waarde;
    };
    const opties: { optie: number; waarde: number }[] = [];
    for (let prijs = Math.round(def.ref * 0.6 * 10) / 10; prijs <= def.ref * 1.8; prijs = Math.round((prijs + 0.1) * 10) / 10) {
      opties.push({ optie: prijs, waarde: opbrengst(prijs) });
    }
    // de basis is de richtprijs: wat de kantine opbrengt als niemand er iets aan doet
    const gekozen = pickByEfficiency(opties, opbrengst(def.ref), eff) ?? def.ref;
    const vorige = item.price;
    item.price = Math.max(0.5, Math.round(gekozen * (1 + rng2(state).normal(0, err / 4)) * 10) / 10);
    const beste = opties.reduce((a, b) => (b.waarde > a.waarde ? b : a));
    taskLog(state, 'horeca', 'canteen price set', {
      staff: s.id,
      item: item.id,
      eff: Number(eff.toFixed(3)),
      support: Number(supportFactor(state, 'horeca').toFixed(3)),
      visitors: bezoekers,
      ref: def.ref,
      cost: def.cost,
      baseline: Number(opbrengst(def.ref).toFixed(1)),
      optimum: { price: beste.optie, value: Number(beste.waarde.toFixed(1)) },
      picked: Number(gekozen.toFixed(2)),
      from: vorige,
      to: item.price,
    });
  }
  if ((state.eventCooldowns['auto-concessie'] ?? 0) > 0) return;
  const open = CONCESSIONS.filter((c) => !state.canteen.concessions.some((x) => x.id === c.id) && usedConcessionSpace(state) + c.space <= state.infrastructure.concessionSpace);
  const next = open.sort((a, b) => b.perVisitor * b.price - a.perVisitor * a.price)[0];
  if (next && openConcession(state, next.id, acceptedMargin(state, next.id)).ok) {
    state.eventCooldowns['auto-concessie'] = 8;
    addNews(state, 'goed', `${s.name} haalde een ${next.label.toLowerCase()} binnen voor de thuiswedstrijden.`);
  }
}

// ---------- Clubwinkel ----------

/** Het personeelslid zet elke prijs op de beste marge en breidt het assortiment uit als de kas het toelaat. */
function merchTask(state: GameState): void {
  const s = delegate(state, 'merchandising');
  if (!s || !state.merch.active) return;
  const sloppy = errorChance(taskSkill(state, 'merchandising', s));
  for (const item of state.merch.items) {
    const target = bestPrice(state, item.id);
    // een zwakker personeelslid mikt er wat naast
    item.price = Math.max(1, Math.round(target * (1 + (sloppy ? (state.week % 3) - 1 : 0) * sloppy * 0.5)));
  }
  const missing = MERCH_ITEMS.filter((d) => !state.merch.items.some((i) => i.id === d.id)).sort((a, b) => b.appeal - a.appeal);
  const next = missing[0];
  if (next && state.cash > next.setup + 25_000 && (state.eventCooldowns['auto-merch'] ?? 0) === 0) {
    if (addMerchItem(state, next.id).ok) {
      state.eventCooldowns['auto-merch'] = 6;
      addNews(state, 'neutraal', `${s.name} neemt ${next.label.toLowerCase()} op in het assortiment van de clubwinkel.`);
    }
  }
}

// ---------- Vrijwilligers ----------

function volunteerTask(state: GameState): void {
  const s = delegate(state, 'vrijwilligers');
  if (!s) return;
  const v = state.community.volunteers;
  const ready = (id: string) => (state.eventCooldowns[`vrijwilligers-${id}`] ?? 0) === 0;
  if (v < 9 && ready('infoavond') && state.cash > 10_000) volunteerAction(state, 'infoavond');
  else if (v < 13 && ready('oproep')) volunteerAction(state, 'oproep');
  if (state.week === 20 && ready('feest') && state.cash > 25_000) {
    volunteerAction(state, 'feest');
    addNews(state, 'goed', `${s.name} organiseerde een vrijwilligersfeest.`);
  }
}
