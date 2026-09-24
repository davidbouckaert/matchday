// Taken die je aan staff overlaat. Elke week, vóór de wedstrijden, doet elk personeelslid
// het werk waarvoor hij is aangeduid. Hoe beter hij is, hoe beter zijn keuzes.

import type { GameState, Mentality, Position, Staff, TaskId, TrainingFocus, UpgradeId } from './types';
import { PLANS, nextOpponent } from './strategy';
import { NATURAL_RECOVERY, avgFatigue, matchLoad, recovery, trainingLoad } from './factors';
import type { Rng } from './rng';
import { clamp, createRng, round } from './rng';
import { DIVISIONS } from './data/divisions';
import { CANTEEN_ITEMS, CLUB_EVENTS, CONCESSIONS, CONCESSION_SPACE, MERCH_ITEMS, TASKS, UPGRADES } from './data/catalog';
import { isTransferWindow } from './calendar';
import { FORMATIONS, POSITIONS, bestForRole, bestFormation, departureBlock, isCorePlayer, overall, squadBlock, teamStrength } from './players';
import { expectedAttendance, spendPerHead } from './finance';
import { acceptedMargin, expectedCanteenUnits } from './canteen';
import { staffSkill } from './staff';
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

/** Een toevalsbron voor taken die er zelf geen meekrijgen. */
function rng2(state: GameState): Rng {
  return createRng(state);
}

/** Kans op een minder goede keuze: 0 bij een topper, ~0,35 bij een zwak personeelslid. */
function errorChance(skill: number): number {
  return clamp((100 - skill) / 200, 0, 0.4);
}

/**
 * Hoeveel taken iemand aankan. Een zwak personeelslid doet er één, een topper vier.
 * Wie te veel op zijn bord krijgt, zou toch beginnen te knoeien.
 */
export function taskCapacity(staff: Staff): number {
  return staff.skill >= 85 ? 4 : staff.skill >= 65 ? 3 : staff.skill >= 40 ? 2 : 1;
}

/**
 * Hoe goed iemand deze taak doet. Zijn eigen vakgebied (de eerste rol bij de taak) ligt hem het best;
 * een taak die er maar naast ligt, doet hij met minder kennis van zaken. Elke extra taak kost ook iets.
 */
export function taskSkill(state: GameState, taskId: TaskId, staff: Staff): number {
  const task = TASKS.find((t) => t.id === taskId)!;
  const rank = task.roles.indexOf(staff.role);
  const fit = rank === 0 ? 1 : rank === 1 ? 0.82 : 0.68;
  const load = 1 - Math.max(0, tasksOf(state, staff.id).length - 1) * 0.06;
  const course = staff.courseWeeksLeft > 0 ? 0.6 : 1;
  return clamp(staff.skill * fit * load * course, 5, 100);
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
    const grens = 26 + (skill / 100) * 12; // een zwakke trainer houdt meer marge aan
    let gekozen = 2;
    for (let n = 5; n >= 2; n--) {
      const proef = { ...state, tactics: { ...t, trainings: n } };
      // wat er volgende week overblijft: wat ze nu hebben, plus training en wedstrijd, min herstel
      const volgende = tired * (1 - NATURAL_RECOVERY) + trainingLoad(proef) + matchLoad(proef) - recovery(proef);
      if (volgende <= grens || n === 2) {
        gekozen = n;
        break;
      }
    }
    t.trainings = injured >= 3 ? Math.min(gekozen, 3) : gekozen;

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
  if (!s) return;
  // de kern rond krijgen mag ook buiten de transferperiode, met transfervrije spelers
  if (!isTransferWindow(state.week) && !squadBlock(state)) return;

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
    const buiten = !isTransferWindow(state.week);
    const vrij = state.transferList
      .filter((p) => (buiten ? p.purchasePrice === 0 : p.purchasePrice <= Math.max(0, state.cash - 5_000)))
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
  state.ticketPrice = Math.max(0, Math.round(best * (1 + rng.normal(0, errorChance(taskSkill(state, 'ticketing', s)) / 3))));
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
  wish.push('kantine', 'wifi', 'scorebord', 'sanitair', 'recuperatie', 'parking');
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
  const bezoekers = Math.max(50, Math.round(expectedAttendance(state, { weather: 'bewolkt', derby: false, positionFactor: 1 })));
  const blik = clamp(vaardigheid / 100, 0.25, 1); // hoe ver hij vooruit kijkt
  for (const item of state.canteen.items) {
    const def = CANTEEN_ITEMS.find((c) => c.id === item.id)!;
    const origineel = item.price;
    let beste = origineel;
    let besteOpbrengst = -Infinity;
    const onder = def.ref * (1 - 0.35 * blik);
    const boven = def.ref * (1 + 0.6 * blik);
    for (let prijs = Math.round(onder * 10) / 10; prijs <= boven; prijs = Math.round((prijs + 0.1) * 10) / 10) {
      item.price = prijs;
      const opbrengst = expectedCanteenUnits(state, item.id, bezoekers) * (prijs - def.cost);
      if (opbrengst > besteOpbrengst) {
        besteOpbrengst = opbrengst;
        beste = prijs;
      }
    }
    item.price = Math.max(0.5, Math.round(beste * (1 + rng2(state).normal(0, err / 2.5)) * 10) / 10);
  }
  if ((state.eventCooldowns['auto-concessie'] ?? 0) > 0) return;
  const open = CONCESSIONS.filter((c) => !state.canteen.concessions.some((x) => x.id === c.id) && usedConcessionSpace(state) + c.space <= CONCESSION_SPACE);
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
