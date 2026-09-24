import type { Formation, GamePlan, GameState, Player, PlayerTrait, Position } from './types';
import { MATCHUP_ATT, MATCHUP_DEF, MENTALITY_INFO, developmentFactor, matchup, matchupWeight, sharpness } from './strategy';
import { staffSkill } from './staff';
import { avgFatigue, fatigueFactor } from './factors';
import type { Rng } from './rng';
import { clamp, round } from './rng';
import { FIRST_NAMES, LAST_NAMES } from './data/names';
import { DIVISIONS } from './data/divisions';
import { nextId } from './util';

export const POSITIONS: Position[] = ['DOEL', 'VERD', 'MIDD', 'AANV'];
const TRAITS: PlayerTrait[] = ['professioneel', 'leider', 'lastpak', 'gevoelig', 'harde werker', 'feestbeest'];

const TECH_WEIGHT: Record<Position, number> = { DOEL: 0.5, VERD: 0.4, MIDD: 0.65, AANV: 0.6 };

/** Algemene kwaliteit van een speler (1-100). */
export function overall(p: Player): number {
  const w = TECH_WEIGHT[p.position];
  return Math.round(p.technique * w + p.physical * (1 - w));
}

function ageFactor(age: number): number {
  if (age <= 20) return 1.35;
  if (age <= 23) return 1.2;
  if (age <= 27) return 1;
  if (age <= 30) return 0.75;
  if (age <= 32) return 0.5;
  return 0.3;
}

/** Marktwaarde: kwaliteit, leeftijd, potentieel, vorm en de algemene marktstemming. */
export function marketValue(p: Player, marketIndex: number): number {
  const base = 1_200 * Math.pow(1.13, overall(p) - 45);
  const potentialBonus = p.age <= 23 ? Math.pow(1.07, Math.max(0, p.potential - overall(p))) : 1;
  const formBonus = 1 + p.form / 50;
  const injury = p.injuryWeeks > 0 ? 0.8 : 1;
  return round(base * ageFactor(p.age) * potentialBonus * formBonus * injury * marketIndex, 100);
}

/** Het bod dat je vandaag krijgt als je de speler verkoopt (schommelt elke week). */
export function currentBid(p: Player, marketIndex: number): number {
  return round(marketValue(p, marketIndex) * p.bidFactor, 100);
}

/** Loon dat een speler van dit niveau vraagt (euro per week). */
/**
 * Wat een speler per week vraagt.
 *
 * Zijn kwaliteit bepaalt het meeste, maar niet alles: dezelfde speler vraagt in de Pro Liga
 * een veelvoud van wat hij in 3de Nationale vraagt. Dat is geen detail maar de motor onder de
 * moeilijkheid van dit spel. Zonder dat stuk liep je economie op één been: promoveren
 * vermenigvuldigde je sponsorgeld (factor 0,6 tot 8 over de zes reeksen), je tv-geld en je
 * publiek, terwijl je loonlast gewoon bleef staan. Over zes seizoenen gemeten steeg de
 * omzet van een uitbestedende club zes keer en haar kosten twee keer — elke promotie was
 * gratis geld. Nu stijgt de rekening mee: klimmen is nog altijd de weg vooruit, maar je moet
 * de ploeg die daarbij hoort ook kunnen betalen.
 *
 * Bestaande contracten blijven staan; de nieuwe lat geldt voor wie je haalt en voor wie
 * bijtekent. Je hebt na een promotie dus even lucht, en daarna komt de rekening.
 */
export function wageDemand(state: GameState, p: Player): number {
  const traitFactor = p.trait === 'lastpak' ? 1.2 : p.trait === 'professioneel' ? 1.05 : 1;
  const level = DIVISIONS[state.league.divisionLevel]?.wageFactor ?? 1;
  return round(170 * Math.pow(1.08, overall(p) - 52) * traitFactor * level, 5);
}

/**
 * Hoe zwaar een speler tilt aan een loon dat niet meer bij zijn niveau past.
 *
 * De loonlat van 0.42.0 gold alleen voor wie je haalt of wie bijtekent; wie al getekend
 * had, kreeg bij een promotie 14% terwijl de lat 45 à 62% per trede stijgt. Eén promotie
 * verteert een kleedkamer (14% extra tegenover een lat van +45% blijft boven de grens van
 * driekwart), maar wie twee tredes klimt zonder één contract open te breken, betaalt zijn
 * spelers nog geen zestig procent van wat het niveau vraagt — en dat pikken ze niet.
 *
 * Geeft het aantal punten waarmee zijn moraal-evenwicht zakt (0 tot 25). Eigen jeugd tot
 * en met 19 jaar valt erbuiten (een leercontract hoort goedkoop te zijn), huurlingen ook:
 * hun loon is een afspraak tussen clubs.
 */
export function wagePressure(state: GameState, p: Player): number {
  if (p.loan || (p.isYouth && p.age <= 19)) return 0;
  const lat = wageDemand(state, p);
  if (lat <= 0) return 0;
  const ratio = p.wage / lat;
  return clamp((0.75 - ratio) * 60, 0, 25);
}

export interface PlayerOptions {
  position?: Position;
  quality: number; // gemiddelde kwaliteit
  age?: number;
  ageBias?: number;
  season: number;
  isYouth?: boolean;
  potentialBoost?: number;
}

export function generatePlayer(state: GameState, rng: Rng, opts: PlayerOptions): Player {
  const position = opts.position ?? rng.pick(POSITIONS);
  const age = opts.age ?? clamp(Math.round(rng.normal(25 + (opts.ageBias ?? 0), 4)), 17, 35);
  const q = rng.normal(opts.quality, 5);
  const w = TECH_WEIGHT[position];
  const spread = rng.normal(0, 6);
  const technique = clamp(Math.round(q + spread * (1 - w)), 20, 95);
  const physical = clamp(Math.round(q - spread * w), 20, 95);
  const youthRoom = age <= 21 ? rng.range(6, 22) : age <= 25 ? rng.range(2, 10) : rng.range(0, 3);
  const potential = clamp(Math.round(q + youthRoom + (opts.potentialBoost ?? 0)), 20, 95);
  const player: Player = {
    id: nextId(state, 'p'),
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    age,
    position,
    technique,
    physical,
    potential: Math.max(potential, Math.round(q)),
    trait: rng.pick(TRAITS),
    wage: 0,
    contractUntil: opts.season + rng.int(0, 2),
    morale: rng.int(55, 75),
    form: 0,
    injuryWeeks: 0,
    fatigue: 0,
    yellowCards: 0,
    redCards: 0,
    suspended: 0,
    starts: 0,
    goals: 0,
    careerGoals: 0,
    periodStarts: 0,
    trend: 0,
    negotiations: 0,
    listed: false,
    askingPrice: 0,
    loan: null,
    friends: [],
    purchasePrice: 0,
    bidFactor: rng.range(0.85, 1.15),
    isYouth: opts.isYouth ?? false,
    startQuality: 0,
  };
  player.startQuality = overall(player); // waar hij stond toen hij binnenkwam
  player.wage = opts.isYouth ? 40 : wageDemand(state, player);
  return player;
}

/** Koppelt willekeurig spelers die goed samenwerken ("klik"). */
export function linkFriends(players: Player[], rng: Rng, pairs: number): void {
  for (let i = 0; i < pairs; i++) {
    const a = rng.pick(players);
    const b = rng.pick(players);
    if (a.id === b.id || a.friends.includes(b.id)) continue;
    a.friends.push(b.id);
    b.friends.push(a.id);
  }
}

// ---------- Formaties en tactiek ----------

export const FORMATIONS: Record<Formation, Record<Position, number>> = {
  '4-4-2': { DOEL: 1, VERD: 4, MIDD: 4, AANV: 2 },
  '4-3-3': { DOEL: 1, VERD: 4, MIDD: 3, AANV: 3 },
  '3-5-2': { DOEL: 1, VERD: 3, MIDD: 5, AANV: 2 },
  '5-3-2': { DOEL: 1, VERD: 5, MIDD: 3, AANV: 2 },
  '4-5-1': { DOEL: 1, VERD: 4, MIDD: 5, AANV: 1 },
};

/** Extra aanval / verdediging per formatie. */
export const FORMATION_MOD: Record<Formation, { att: number; def: number }> = {
  '4-4-2': { att: 0, def: 0 },
  '4-3-3': { att: 1.5, def: -1 },
  '3-5-2': { att: 0.8, def: -0.6 },
  '5-3-2': { att: -1.5, def: 1.5 },
  '4-5-1': { att: -1, def: 1 },
};

export const OUT_OF_POSITION_PENALTY = 8;

/** Hoe zwaar staff, sfeer en vorm doorwegen tegenover de pure kwaliteit van je spelers. */
export const BONUS_WEIGHT = 0.7;

export interface LineupSlot {
  player: Player;
  zone: Position;
  rating: number; // kwaliteit op die plek (lager als hij niet op zijn positie speelt)
}

/**
 * Stelt de elf samen volgens de formatie. Eerst de spelers die de eigenaar zelf koos,
 * daarna de beste beschikbare per positie; tekorten worden aangevuld met spelers van een andere positie.
 */
/**
 * Wie scoort er? Een doelpunt valt eerder aan spitsen toe dan aan verdedigers, en binnen een linie
 * eerder aan de betere spelers. De strafschopnemer krijgt een extra duwtje.
 */
export function pickScorers(state: GameState, lineup: Player[], goals: number, rng: Rng): { name: string; minute: number }[] {
  if (!goals || !lineup.length) return [];
  const ZONE_WEIGHT: Record<Position, number> = { DOEL: 0.02, VERD: 0.5, MIDD: 1.4, AANV: 3.2 };
  const weights = lineup.map((p) => {
    const base = ZONE_WEIGHT[p.position] * (0.5 + overall(p) / 100);
    const taker = state.tactics.roles.strafschop === p.id ? 1.35 : 1;
    return base * taker;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const minutes = new Set<number>();
  const out: { name: string; minute: number }[] = [];
  for (let g = 0; g < goals; g++) {
    let roll = rng.next() * total;
    let idx = 0;
    while (idx < weights.length - 1 && roll > weights[idx]) {
      roll -= weights[idx];
      idx++;
    }
    let minute = rng.int(1, 90);
    while (minutes.has(minute)) minute = rng.int(1, 90);
    minutes.add(minute);
    const scorer = lineup[idx];
    scorer.goals++;
    scorer.careerGoals++;
    out.push({ name: scorer.name, minute });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

export function selectLineup(
  players: Player[],
  formation: Formation = '4-4-2',
  manualXI: string[] = [],
  benched: string[] = [],
  gaps: Partial<Record<Position, number>> = {},
): { lineup: Player[]; slots: LineupSlot[]; outOfPosition: number } {
  const base = FORMATIONS[formation];
  // plaatsen die jij bewust openliet, vult je trainer niet op
  const counts = { ...base } as Record<Position, number>;
  for (const pos of POSITIONS) counts[pos] = Math.max(0, base[pos] - (gaps[pos] ?? 0));
  // wie jij op de bank zet, blijft op de bank: jij beslist wie er speelt
  const fit = players.filter(canPlay).filter((p) => !benched.includes(p.id));
  const slots: LineupSlot[] = [];
  const used = new Set<string>();
  const take = (p: Player, zone: Position) => {
    used.add(p.id);
    slots.push({ player: p, zone, rating: overall(p) - (p.position === zone ? 0 : OUT_OF_POSITION_PENALTY) });
  };
  // 1. handmatig gekozen spelers op hun eigen positie (zolang er plaats is)
  for (const id of manualXI) {
    const p = fit.find((x) => x.id === id);
    if (!p || used.has(p.id)) continue;
    if (slots.filter((s) => s.zone === p.position).length < counts[p.position]) take(p, p.position);
  }
  // 2. aanvullen met de beste per positie
  for (const pos of POSITIONS) {
    // de trainer kiest de beste speler, maar laat een uitgeputte speler liever rusten
    const score = (p: Player) => overall(p) + p.form - Math.max(0, p.fatigue - 30) / 5;
    const options = fit.filter((p) => p.position === pos && !used.has(p.id)).sort((a, b) => score(b) - score(a));
    while (slots.filter((s) => s.zone === pos).length < counts[pos] && options.length) take(options.shift()!, pos);
  }
  // 3. tekorten opvullen met spelers van een andere positie
  let outOfPosition = 0;
  for (const pos of POSITIONS) {
    while (slots.filter((s) => s.zone === pos).length < counts[pos]) {
      const sub = fit.filter((p) => !used.has(p.id)).sort((a, b) => overall(b) - overall(a))[0];
      if (!sub) break;
      take(sub, pos);
      outOfPosition++;
    }
  }
  return { lineup: slots.map((s) => s.player), slots, outOfPosition };
}

/**
 * Kapitein en vaste nemers. Een kapitein met leiderschap en ervaring tilt de ploeg op;
 * staat hij niet in de basis, dan valt die bonus weg. Goede nemers leveren extra doelpunten
 * uit stilstaande fases.
 */
export function roleBonus(state: GameState, lineup: Player[]): number {
  const r = state.tactics.roles;
  const inLineup = (id: string | null) => (id ? lineup.find((p) => p.id === id) : undefined);
  let bonus = 0;
  const cap = inLineup(r.kapitein);
  if (cap) {
    bonus += 0.6 + (cap.trait === 'leider' ? 1.2 : cap.trait === 'lastpak' ? -0.8 : 0) + Math.min(1, cap.age >= 28 ? 0.5 : 0) + (cap.morale - 60) / 100;
  }
  const pen = inLineup(r.strafschop);
  if (pen) bonus += 0.25 + (pen.technique - 50) / 60;
  const corner = inLineup(r.hoekschop);
  if (corner) bonus += 0.2 + (corner.technique - 50) / 70 + (state.tactics.focus === 'spelhervattingen' ? 0.4 : 0);
  return clamp(bonus, -1.5, 3);
}

/** Wie is de beste keuze voor een rol? (ook voor de trainer die het overneemt) */
export function bestForRole(players: Player[], role: keyof GameState['tactics']['roles']): Player | undefined {
  const fit = players.filter(canPlay);
  if (!fit.length) return undefined;
  const score = (p: Player) =>
    role === 'kapitein'
      ? (p.trait === 'leider' ? 12 : p.trait === 'lastpak' ? -8 : 0) + p.age + overall(p) / 2 + p.morale / 10
      : p.technique + (p.position === 'AANV' || p.position === 'MIDD' ? 6 : 0) + (role === 'strafschop' ? p.morale / 12 : 0);
  return [...fit].sort((a, b) => score(b) - score(a))[0];
}

/** Bonus voor spelers die goed samenwerken en samen in de basis staan. */
export function chemistry(lineup: Player[]): number {
  const ids = new Set(lineup.map((p) => p.id));
  let pairs = 0;
  for (const p of lineup) pairs += p.friends.filter((f) => ids.has(f)).length;
  const leaders = lineup.filter((p) => p.trait === 'leider').length;
  const troublemakers = lineup.filter((p) => p.trait === 'lastpak').length;
  return clamp((pairs / 2) * 0.6 + leaders * 0.5 - troublemakers * 0.7, -4, 5);
}

export interface StrengthBreakdown {
  total: number; // gemiddelde van aanval en verdediging, inclusief alle bonussen
  attack: number;
  defense: number;
  zones: Record<Position, number>; // gemiddelde kwaliteit per linie (met keepertrainer)
  quality: number;
  chemistry: number;
  trainer: number; // hoofdtrainer + assistent-trainer + data-analist
  morale: number;
  form: number;
  sharpness: number; // door het aantal trainingen
  roles: number; // kapitein en de aangeduide nemers
  fatigue: number; // gemiddelde vermoeidheid van de basiself
  fatigueFactor: number; // vermenigvuldiger op aanval en verdediging
  tactic: { att: number; def: number }; // formatie + mentaliteit + trainingsfocus
  planFit: number; // hoe goed het spelplan bij je spelers past
  matchup: number; // +1 voordeel, -1 nadeel, 0 neutraal (enkel met tegenstander)
  matchupBonus: { att: number; def: number };
  penalty: number;
  outOfPosition: number;
  missing: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface OpponentContext {
  strength: number;
  plan?: GamePlan;
}

/** Past het spelplan bij de basisspelers? Tussen -2,5 en +2,5. */
export function planFit(state: GameState, plan: GamePlan, slots: LineupSlot[]): number {
  const quality = avg(slots.map((s) => s.rating));
  const tech = (zones: Position[]) => avg(slots.filter((s) => zones.includes(s.zone)).map((s) => s.player.technique));
  const phys = (zones: Position[]) => avg(slots.filter((s) => zones.includes(s.zone)).map((s) => s.player.physical));
  const t = state.tactics;
  let fit = 0;
  switch (plan) {
    case 'balbezit':
      fit = (tech(['MIDD', 'VERD']) - quality) / 2 + (t.focus === 'techniek' ? 0.8 : 0);
      break;
    case 'lange bal':
      fit = (phys(['AANV']) - quality) / 2;
      break;
    case 'vleugelspel':
      fit = ((tech(['AANV', 'MIDD']) + phys(['AANV', 'MIDD'])) / 2 - quality) / 2 + (['4-3-3', '3-5-2'].includes(t.formation) ? 1 : t.formation === '5-3-2' ? -1 : 0) + (t.focus === 'techniek' ? 0.5 : 0);
      break;
    case 'counter':
      fit = ((phys(['AANV']) + avg(slots.filter((s) => s.zone === 'VERD').map((s) => s.rating))) / 2 - quality) / 2;
      break;
    case 'pressing':
      fit = (phys(['DOEL', 'VERD', 'MIDD', 'AANV']) - quality) / 2 + (t.trainings - 3) * 0.5 + (t.focus === 'conditie' ? 0.5 : 0);
      break;
  }
  return Math.max(-2.5, Math.min(2.5, fit));
}

/**
 * Teamsterkte. Aanval en verdediging worden apart berekend uit de linies, daarna komen
 * staff, moraal, vorm, training, formatie, mentaliteit en het spelplan erbij.
 * Geef je een tegenstander mee, dan telt ook het voordeel of nadeel van de spelplannen.
 */
export function teamStrength(state: GameState, opponent?: OpponentContext): StrengthBreakdown {
  const t = state.tactics;
  const { lineup, slots, outOfPosition } = selectLineup(state.players, t.formation, t.manualXI, t.benched, t.gaps);
  const missing = 11 - lineup.length;

  const zones = { DOEL: 0, VERD: 0, MIDD: 0, AANV: 0 } as Record<Position, number>;
  for (const pos of POSITIONS) {
    const inZone = slots.filter((s) => s.zone === pos);
    zones[pos] = inZone.length ? inZone.reduce((sum, s) => sum + s.rating, 0) / inZone.length : 30;
  }
  const keeperCoach = staffSkill(state, 'keepertrainer');
  if (keeperCoach) zones.DOEL += Math.max(0, (keeperCoach - 30) / 12);

  const quality = slots.length ? slots.reduce((sum, s) => sum + s.rating, 0) / slots.length : 0;
  const chem = chemistry(lineup);
  const head = state.staff.find((s) => s.role === 'hoofdtrainer');
  const assistant = staffSkill(state, 'assistent');
  const analyst = staffSkill(state, 'analist');
  const trainer = (head ? (head.skill - 50) / 8 : -6) + (assistant ? Math.max(0, (assistant - 30) / 25) : 0) + (analyst ? Math.max(0, (analyst - 30) / 30) : 0);
  const morale = lineup.length ? (lineup.reduce((sum, p) => sum + p.morale, 0) / lineup.length - 60) / 10 : 0;
  const form = lineup.length ? lineup.reduce((sum, p) => sum + p.form, 0) / lineup.length / 3 : 0;
  const sharp = sharpness(t.trainings);
  const roles = roleBonus(state, lineup);
  const penalty = missing * 6;

  const fm = FORMATION_MOD[t.formation];
  const mm = MENTALITY_INFO[t.mentality];
  const tactic = {
    att: fm.att + mm.att + (t.focus === 'spelhervattingen' ? 1 : 0),
    def: fm.def + mm.def + (t.focus === 'conditie' ? 0.5 : 0),
  };
  const fit = planFit(state, t.plan, slots);

  let mu = 0;
  let matchupBonus = { att: 0, def: 0 };
  if (opponent?.plan) {
    mu = matchup(t.plan, opponent.plan);
    const w = matchupWeight(state);
    matchupBonus = { att: mu * MATCHUP_ATT * w, def: mu * MATCHUP_DEF * w };
  }

  // Uitkomst = (spelerskwaliteit + bonussen) × vermoeidheid + tactiek + voordeel/nadeel spelplan
  // De bonussen tellen maar voor een deel mee: kwaliteit van de spelers blijft de basis.
  const tired = avgFatigue(lineup);
  const ff = fatigueFactor(tired);
  const common = (chem + trainer + morale + form + sharp + fit + roles) * BONUS_WEIGHT - penalty;
  const attack = (zones.MIDD * 0.3 + zones.AANV * 0.7 + common) * ff + tactic.att + matchupBonus.att;
  const defense = (zones.DOEL * 0.2 + zones.VERD * 0.55 + zones.MIDD * 0.25 + common) * ff + tactic.def + matchupBonus.def;
  return {
    total: r1((attack + defense) / 2),
    attack: r1(attack),
    defense: r1(defense),
    zones: { DOEL: r1(zones.DOEL), VERD: r1(zones.VERD), MIDD: r1(zones.MIDD), AANV: r1(zones.AANV) },
    quality: r1(quality),
    chemistry: r1(chem),
    trainer: r1(trainer),
    morale: r1(morale),
    form: r1(form),
    sharpness: r1(sharp),
    roles: r1(roles),
    fatigue: Math.round(tired),
    fatigueFactor: Math.round(ff * 1000) / 1000,
    tactic: { att: r1(tactic.att), def: r1(tactic.def) },
    planFit: r1(fit),
    matchup: mu,
    matchupBonus: { att: r1(matchupBonus.att), def: r1(matchupBonus.def) },
    penalty: r1(penalty),
    outOfPosition,
    missing,
  };
}

/** Beste formatie voor deze selectie (gebruikt door een trainer die de opstelling regelt). */
export function bestFormation(state: GameState): Formation {
  let best: Formation = '4-4-2';
  let bestScore = -Infinity;
  for (const f of Object.keys(FORMATIONS) as Formation[]) {
    const s = teamStrength({ ...state, tactics: { ...state.tactics, formation: f, mentality: 'gebalanceerd', manualXI: [] } });
    if (s.total > bestScore) {
      bestScore = s.total;
      best = f;
    }
  }
  return best;
}

/** Maandelijkse ontwikkeling: jonge spelers groeien naar hun potentieel, oudere gaan achteruit. */
export interface DevComponents {
  trainer: number; // vermenigvuldiger door de hoofdtrainer
  trainings: number; // vermenigvuldiger door het aantal trainingen
  assistant: number; // extra voor spelers t/m 23 jaar
  academy: number; // extra voor spelers t/m 21 jaar
  keeperCoach: number; // extra voor doelmannen
  fitness: number; // extra fysiek per maand
}

export function devComponents(state: GameState): DevComponents {
  const trainer = state.staff.find((s) => s.role === 'hoofdtrainer' && s.courseWeeksLeft === 0);
  return {
    trainer: trainer ? 0.6 + trainer.skill / 100 : 0.4,
    trainings: developmentFactor(state.tactics.trainings),
    assistant: staffSkill(state, 'assistent') / 250,
    academy: state.infrastructure.academyLevel * 0.15,
    keeperCoach: staffSkill(state, 'keepertrainer') / 200,
    fitness: staffSkill(state, 'conditietrainer') / 400,
  };
}

/** Kwaliteit zonder afronding (om kleine veranderingen te kunnen tonen). */
export function rawOverall(p: Player): number {
  const w = TECH_WEIGHT[p.position];
  return p.technique * w + p.physical * (1 - w);
}

/** Mag deze speler opgesteld worden? (niet geblesseerd, niet geschorst, niet uitgeleend) */
export function canPlay(p: Player): boolean {
  return p.injuryWeeks === 0 && p.suspended === 0 && p.loan?.type !== 'uit';
}

/**
 * Groeivermogen per leeftijd: 17 jaar = volle groei, daarna glijdt het weg en
 * vanaf 31 jaar groeit niemand nog. 1.0 op 17, 0.64 op 22, 0.36 op 26, 0.14 op 29, 0 vanaf 31.
 */
export const GROWTH_STOP_AGE = 31;
export function growthFactor(age: number): number {
  const base = clamp((GROWTH_STOP_AGE - age) / (GROWTH_STOP_AGE - 17), 0, 1) ** 1.15;
  // tieners en spelers tot 21 springen er echt uit
  const youth = age <= 19 ? 1.3 : age <= 21 ? 1.15 : 1;
  return clamp(base * youth, 0, 1.3);
}

/** Achteruitgang per leeftijd: begint traag rond 27, vanaf 31 gaat het sneller. */
export function declineFactor(age: number): number {
  return clamp((age - 27) / 9, 0, 1.2) ** 1.15;
}

/** Speeltijd-effect per maand: veel spelen = groeien, weinig spelen = stilstaan of achteruitgaan. */
export function playEffect(p: Player, playShare: number): number {
  const weight = 0.14 + growthFactor(p.age) * 0.26; // 17 jaar: 0.40, 24 jaar: 0.27, 31+: 0.14
  return (playShare - 0.4) * weight;
}

/** Een uitgeleende speler staat bij zijn gastclub geregeld in de ploeg. */
export const LOAN_PLAY_SHARE = 0.8;

/** Trainingseffect per maand: 2 trainingen = −0,08, 5 trainingen = +0,16. */
export function trainingEffect(trainings: number): number {
  return (trainings - 3) * 0.08;
}

export interface DevelopmentSummary {
  better: Player[];
  worse: Player[];
}

/**
 * Evolutie om de 4 weken. Verandering = leeftijd en potentieel × staff en trainingen
 * + speeltijd (basisplaatsen in de afgelopen periode) + trainingsritme.
 * Wie weinig speelt en weinig traint, gaat achteruit.
 */
export function developPlayers(state: GameState, rng: Rng): DevelopmentSummary {
  const dc = devComponents(state);
  const matches = state.periodMatches;
  const summary: DevelopmentSummary = { better: [], worse: [] };
  for (const p of state.players) {
    const before = rawOverall(p);
    const traitBonus = p.trait === 'harde werker' || p.trait === 'professioneel' ? 1.3 : p.trait === 'feestbeest' ? 0.7 : 1;
    // Een uitgeleende speler speelt elders en ontwikkelt zich gewoon verder.
    //
    // Even heeft hier een hele laag gestaan waarin de gastclub bepaalde hoeveel hij groeide:
    // hun trainer, hun jeugdwerking, of hij er wel in de ploeg paste. Dat werkte, maar het
    // hoort niet in dit spel thuis. Je bent eigenaar van een club, geen jeugdcoördinator die
    // per speler een leertraject uitstippelt. Wat telt is dat hij speelt en terugkomt met
    // iets extra — de rest is ruis waar je niets mee kunt.
    const weg = p.loan?.type === 'uit';
    let factor = dc.trainer * traitBonus * dc.trainings;
    const { assistant, academy, keeperCoach } = dc;
    if (p.age <= 23) factor += assistant;
    if (p.age <= 21) factor += academy;
    if (p.position === 'DOEL') factor += keeperCoach;
    // leeftijd: hoe jonger, hoe meer groei; vanaf 31 jaar groeit niemand nog en weegt alleen de achteruitgang
    const growth = growthFactor(p.age);
    const room = clamp((p.potential - overall(p)) / 10, 0, 1); // dicht bij het potentieel gaat het trager
    let delta = rng.range(0, 0.72) * factor * growth * (0.35 + 0.65 * room);
    delta -= rng.range(0.05, 0.7) * declineFactor(p.age);
    // speeltijd: wie uitgeleend is speelt daar zijn wedstrijden; zonder wedstrijden (winterstop) telt het niet
    const playShare = weg ? LOAN_PLAY_SHARE : matches > 0 ? p.periodStarts / matches : 0.5;
    delta += playEffect(p, playShare);
    // trainingsritme (bij de eigen club), niet voor wie geblesseerd was
    if (!weg && p.injuryWeeks === 0) delta += trainingEffect(state.tactics.trainings);
    if (delta > 0 && overall(p) >= p.potential) delta = Math.min(delta, 0.05);
    const focus = state.tactics.focus;
    const techShare = focus === 'techniek' ? rng.range(0.65, 0.9) : focus === 'conditie' ? rng.range(0.1, 0.35) : rng.range(0.3, 0.7);
    // een conditietrainer remt de fysieke achteruitgang en duwt de fysiek wat op
    const fitness = dc.fitness;
    p.technique = clamp(Math.round((p.technique + delta * techShare * 2) * 10) / 10, 15, 99);
    p.physical = clamp(Math.round((p.physical + delta * (1 - techShare) * 2 - (p.age > 30 ? 0.1 : 0) + fitness) * 10) / 10, 15, 99);
    p.trend = Math.round((rawOverall(p) - before) * 10) / 10;
    p.periodStarts = 0;
    if (p.trend >= 0.2) summary.better.push(p);
    if (p.trend <= -0.2) summary.worse.push(p);
  }
  state.periodMatches = 0;
  return summary;
}

// ---------- Kern van de ploeg en veilige selectie ----------

export const MIN_SQUAD = 18;

/**
 * De harde ondergrens van je kern. Geeft terug waarom de week niet verder kan, of null.
 *
 * Dit is de enige regel in het spel die je écht tegenhoudt, en dat is met opzet: zonder
 * ondergrens kon je je club gewoon leeg laten lopen. Contracten liepen af, spelers gingen
 * transfervrij weg en je loonlast zakte mee — hoe minder je deed, hoe goedkoper het werd.
 * Een club die zondag moet aantreden kan dat niet, dus jij moet spelers halen.
 *
 * Achttien en niet elf: je hebt reserves nodig voor blessures en schorsingen, en buiten de
 * transferperiode kun je niets bijhalen. Die marge ís de bank. Je kunt hier ook nooit
 * ongewild onder zakken: verkopen, uitlenen en iemand laten gaan kan alleen in de
 * transferperiode, en daarbuiten verandert er niets aan je kern.
 */
export function squadBlock(state: GameState): string | null {
  const kern = state.players.filter((p) => p.loan?.type !== 'uit').length;
  if (kern >= MIN_SQUAD) return null;
  const tekort = MIN_SQUAD - kern;
  return `Je kern telt nog maar ${kern} spelers en er moeten er minstens ${MIN_SQUAD} zijn. Haal er ${tekort} bij via Ploeg › Transfers — transfervrije spelers kosten je geen overnamesom — of verleng aflopende contracten bij Ploeg › Contracten.`;
}

/** Spelers die je liever niet kwijtspeelt: veel gespeeld, sterk of veel potentieel. */
export function isCorePlayer(state: GameState, p: Player): boolean {
  if (p.loan?.type === 'in') return false;
  const squad = state.players.filter((x) => x.loan?.type !== 'in');
  const ranked = [...squad].sort((a, b) => overall(b) + b.starts / 3 - (overall(a) + a.starts / 3));
  const top = ranked.slice(0, 11).map((x) => x.id);
  const talent = p.age <= 21 && p.potential - overall(p) >= 8;
  return top.includes(p.id) || talent;
}

/** Spelers die je mag opstellen per positie (uitgeleend, geblesseerd en geschorst tellen niet mee). */
export function availableByPosition(players: Player[], position: Position): number {
  return players.filter((p) => p.position === position && p.loan?.type !== 'uit').length;
}

/**
 * Mag deze speler vertrekken? Nee als je daardoor onder 16 spelers zakt,
 * of als er voor zijn positie geen reserve meer overblijft (elke plaats op het veld
 * moet een vervanger hebben).
 */
export function departureBlock(state: GameState, p: Player, verb = 'verkopen'): string | null {
  const squad = state.players.filter((x) => x.id !== p.id && x.loan?.type !== 'in');
  if (squad.length < MIN_SQUAD) return `Je hebt minstens ${MIN_SQUAD} spelers nodig. ${p.name} ${verb} kan niet.`;
  const needed = FORMATIONS[state.tactics.formation][p.position];
  const left = squad.filter((x) => x.position === p.position && x.loan?.type !== 'uit').length;
  if (left < needed + 1) {
    const label = p.position === 'DOEL' ? 'doelman' : p.position === 'VERD' ? 'verdediger' : p.position === 'MIDD' ? 'middenvelder' : 'aanvaller';
    return `Dan hou je te weinig ${label}s over: je hebt er ${needed} nodig in de basis en minstens één op de bank.`;
  }
  return null;
}

/** Hoeveel spelers je nog tekortkomt om een volledige elf te kunnen opstellen. */
export function lineupGap(state: GameState): {
  available: number;
  needed: number;
  missing: Record<Position, number>;
  open: Partial<Record<Position, number>>;
  openTotal: number;
} {
  const counts = FORMATIONS[state.tactics.formation];
  const fit = state.players.filter(canPlay).filter((p) => !state.tactics.benched.includes(p.id));
  const missing = {} as Record<Position, number>;
  for (const pos of POSITIONS) missing[pos] = Math.max(0, counts[pos] - fit.filter((p) => p.position === pos).length);
  const open = state.tactics.gaps ?? {};
  const openTotal = POSITIONS.reduce((sum, pos) => sum + Math.min(counts[pos], open[pos] ?? 0), 0);
  return { available: Math.min(11, fit.length), needed: 11, missing, open, openTotal };
}

/** Jonge benen verteren de belasting beter, oudere spelers voelen elke wedstrijd. */
export function fatigueAgeFactor(age: number): number {
  if (age <= 19) return 0.78;
  if (age <= 23) return 0.88;
  if (age <= 29) return 1;
  if (age <= 32) return 1.12;
  return 1.22;
}
