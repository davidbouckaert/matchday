// Wat levert dit personeelslid op?
//
// Een vaardigheid van 75 zegt niets. Wat je wil weten is: wat koopt die 75 me, en hoeveel
// beter is dat dan de 40 die ik nu heb? Dat stond nergens; je moest het afleiden uit een
// zin als "betere fysiek, stabielere vorm, minder blessures" en dan maar hopen.
//
// Dit bestand rekent het uit door te méten in plaats van de formule over te schrijven:
// het maakt twee kopieën van je club, zet in de ene die persoon op die plaats en in de
// andere de persoon die je nu hebt, en draait er dezelfde engine-functies op. Het verschil
// is wat je ziet. Zo kan het cijfer op het scherm nooit uit de pas lopen met het spel:
// verandert de formule, dan verandert dit mee.

import type { GameState, Player, Staff, StaffRole, UpgradeId } from './types';
import { roleDef } from './data/catalog';
import { staffSkill } from './staff';
import { expectedAttendance, facilityCost } from './finance';
import { spendPerHeadCanteen } from './canteen';
import { applyUpgrade } from './infrastructure';
import { buildUpFactor, injuryFactors, product, recovery, sponsorFactors } from './factors';
import { overall, teamStrength } from './players';
import { kindRange } from './sponsors';
import { youthForecast } from './actions';

/** Eén concreet gevolg, kort genoeg om als kaartje naast een naam te staan. */
export interface Impact {
  /** Eén teken dat het onderwerp draagt: geld, blessures, publiek. Geen zin. */
  icon: string;
  /** Twee of drie woorden. */
  label: string;
  /** Het getal, met teken en eenheid. */
  value: string;
  tone: 'good' | 'bad' | 'neutral';
  /** De volle uitleg, voor de tooltip. Alleen voor wie ze wil. */
  tip: string;
}

/* ------------------------------------------------------------------- meten */

/** Een kopie van de club waarin precies één plaats anders is ingevuld. */
function withStaff(state: GameState, role: StaffRole, skill: number | null): GameState {
  const copy = structuredClone(state);
  copy.staff = copy.staff.filter((m) => m.role !== role);
  if (skill !== null) {
    copy.staff.push({
      id: '__probe',
      name: 'proef',
      role,
      skill,
      trait: 'teamspeler',
      wage: 0,
      diploma: 'geen',
      courseWeeksLeft: 0,
      courseType: null,
    } as Staff);
  }
  return copy;
}

/** Wat een maat oplevert bij deze bezetting. Elke maat is een echte engine-functie. */
const MEASURES: Record<string, (s: GameState) => number> = {
  teamsterkte: (s) => teamStrength(s).total,
  blessurekans: (s) => product(injuryFactors(s)),
  herstel: (s) => recovery(s),
  publiek: (s) => expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 }),
  kantinePerHoofd: (s) => spendPerHeadCanteen(s, 400),
  sponsorwaarde: (s) => product(sponsorFactors(s)),
  jeugdleden: (s) => youthForecast(s),
  bord: (s) => kindRange(s, 'bord')[1],
  opbouw: (s) => buildUpFactor(s), // hoeveel vermoeidheid een trainingsweek oplevert
};

const pct = (from: number, to: number) => (from === 0 ? 0 : ((to - from) / from) * 100);
const sign = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;
const signPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)}%`;

/**
 * Wat er verandert als je deze rol met deze vaardigheid invult, vergeleken met hoe het nu
 * staat. Laat `vergelijkMet` weg en je vergelijkt met een lege plaats.
 */
export function staffImpact(state: GameState, role: StaffRole, skill: number, vergelijkMet?: number | null): Impact[] {
  const before = withStaff(state, role, vergelijkMet === undefined ? staffSkill(state, role) || null : vergelijkMet);
  const after = withStaff(state, role, skill);
  const delta = (key: keyof typeof MEASURES) => ({
    from: MEASURES[key](before),
    to: MEASURES[key](after),
  });

  const out: Impact[] = [];
  const add = (icon: string, label: string, value: string, tone: Impact['tone'], tip: string) => out.push({ icon, label, value, tone, tip });

  // sportieve rollen
  if (role === 'hoofdtrainer' || role === 'assistent' || role === 'analist' || role === 'keepertrainer') {
    const d = delta('teamsterkte');
    if (Math.abs(d.to - d.from) >= 0.05) {
      add('⚽', 'Teamsterkte', sign(d.to - d.from, 1), d.to >= d.from ? 'good' : 'bad',
        `Je ploeg gaat van ${d.from.toFixed(1)} naar ${d.to.toFixed(1)}. De gemiddelde tegenstander in je reeks haalt een vergelijkbaar cijfer, dus elk punt telt op de uitslag.`);
    }
  }
  if (role === 'hoofdtrainer') {
    add('📈', 'Spelers groeien', `${skill >= 70 ? 'duidelijk sneller' : skill >= 45 ? 'normaal' : 'trager'}`, skill >= 70 ? 'good' : skill >= 45 ? 'neutral' : 'bad',
      `De hoofdtrainer weegt mee in de evolutie van elke speler, elke vier weken. Bij vaardigheid ${skill} groeien je jongeren ${skill >= 70 ? 'merkbaar sneller dan normaal' : skill >= 45 ? 'ongeveer zoals verwacht' : 'trager dan bij een doorsnee trainer'}.`);
  }

  // medische rollen
  if (role === 'kinesist' || role === 'verzorger' || role === 'conditietrainer' || role === 'voeding') {
    const bl = delta('blessurekans');
    if (Math.abs(pct(bl.from, bl.to)) >= 0.5) {
      add('🩹', 'Blessurekans', signPct(pct(bl.from, bl.to)), bl.to <= bl.from ? 'good' : 'bad',
        `De kans dat iemand na een wedstrijd uitvalt gaat van ×${bl.from.toFixed(2)} naar ×${bl.to.toFixed(2)} op het normale risico.`);
    }
    // herstel meten we in punten, niet in procenten: wie nu niemand heeft staat op nul,
    // en "oneindig procent beter" zegt minder dan "zes punten per week"
    const h = delta('herstel');
    if (Math.abs(h.to - h.from) >= 0.1) {
      add('💤', 'Herstel', `${sign(h.to - h.from, 1)}/week`, h.to >= h.from ? 'good' : 'bad',
        `Bovenop het natuurlijke herstel verliezen je spelers nu ${h.from.toFixed(1)} vermoeidheidspunten per week; met hem ${h.to.toFixed(1)}. Minder vermoeidheid is minder blessures en betere vorm.`);
    }
    const o = delta('opbouw');
    if (Math.abs(pct(o.from, o.to)) >= 0.5) {
      add('🏃', 'Trainingslast', signPct(pct(o.from, o.to)), o.to <= o.from ? 'good' : 'bad',
        `Wat een trainingsweek aan vermoeidheid oplevert gaat van ×${o.from.toFixed(2)} naar ×${o.to.toFixed(2)}. Je kunt dus harder trainen voor dezelfde prijs.`);
    }
  }

  // commerciële rollen
  if (role === 'commercieel') {
    const sp = delta('sponsorwaarde');
    if (Math.abs(pct(sp.from, sp.to)) >= 0.5) {
      add('🤝', 'Sponsors betalen', signPct(pct(sp.from, sp.to)), sp.to >= sp.from ? 'good' : 'bad',
        `Wat een bedrijf wil neerleggen gaat met ${signPct(pct(sp.from, sp.to))}. Een reclamebord bijvoorbeeld van ${Math.round(delta('bord').from)} naar ${Math.round(delta('bord').to)} euro per week.`);
    }
    add('📞', 'Kans op ja', `${Math.round(55 + skill / 3)}%`, skill >= 60 ? 'good' : 'neutral',
      `Als je een bedrijf benadert, is de kans dat het een voorstel doet ongeveer ${Math.round(55 + skill / 3)}% van hun interesse. Zonder commercieel medewerker is dat 55%.`);
  }
  if (role === 'kantine') {
    const k = delta('kantinePerHoofd');
    if (Math.abs(pct(k.from, k.to)) >= 0.5) {
      add('🍺', 'Per bezoeker', `${sign(k.to - k.from, 2)}`, k.to >= k.from ? 'good' : 'bad',
        `Aan de toog gaat de winst per bezoeker van €${k.from.toFixed(2)} naar €${k.to.toFixed(2)}. Bij 400 toeschouwers is dat ${sign((k.to - k.from) * 400, 0)} euro per thuiswedstrijd.`);
    }
  }
  if (role === 'merchandising') {
    add('👕', 'Clubwinkel', skill >= 60 ? 'meer verkoop, lagere inkoop' : 'beperkt effect', skill >= 60 ? 'good' : 'neutral',
      'Hij verkoopt meer per bezoeker, koopt goedkoper in en drukt de werkingskosten van de winkel.');
  }

  // club en jeugd
  if (role === 'jeugdcoordinator') {
    const j = delta('jeugdleden');
    if (Math.abs(j.to - j.from) >= 1) {
      add('🧒', 'Jeugdleden', sign(j.to - j.from), j.to >= j.from ? 'good' : 'bad',
        `Bij het huidige lidgeld schrijven zich ${Math.round(j.from)} leden in; met hem ${Math.round(j.to)}. Elk lid betaalt lidgeld en brengt ouders mee naar de kantine.`);
    }
  }
  if (role === 'afgevaardigde') {
    add('📋', 'Licentie', 'verplicht', 'neutral', 'Zonder ploegafgevaardigde haal je de licentiecontrole in week 38 niet. Hij drukt ook je boetes en administratieve fouten.');
  }
  if (role === 'scout') {
    add('🔍', 'Betere vondsten', skill >= 60 ? 'duidelijk beter' : 'wat beter', skill >= 60 ? 'good' : 'neutral',
      'Hij vindt meer talent op de transferlijst en maakt minder miskopen. Met een data-analist erbij kijkt hij nog scherper.');
  }
  if (role === 'mentaal') {
    add('🧠', 'Moraal en kaarten', skill >= 60 ? 'stabieler' : 'iets stabieler', skill >= 60 ? 'good' : 'neutral',
      'Hij houdt de moraal en de vorm stabieler en voorkomt domme kaarten.');
  }

  // het publiek merkt bijna elke rol, via sfeer en accommodatie
  const pub = delta('publiek');
  if (Math.abs(pub.to - pub.from) >= 1) {
    add('👥', 'Toeschouwers', sign(pub.to - pub.from), pub.to >= pub.from ? 'good' : 'bad',
      `Bij een gewone thuiswedstrijd verwacht je ${Math.round(pub.from)} mensen; met hem ${Math.round(pub.to)}.`);
  }

  return out;
}

/** Wat deze rol kost per week, bij deze vaardigheid. Voor naast de opbrengst. */
export function roleLabel(role: StaffRole): string {
  return roleDef(role).label;
}

/* ---------------------------------------------------------- bouwprojecten */

/** Een kopie van de club waarin dit bouwproject al klaar is. */
function withUpgrade(state: GameState, id: UpgradeId, seats?: number): GameState {
  const copy = structuredClone(state);
  applyUpgrade(copy.infrastructure, id, seats);
  return copy;
}

/**
 * Wat een afgerond bouwproject je oplevert. Gemeten, niet beschreven: de proefkopie
 * gebruikt dezelfde `applyUpgrade` die de weeklus gebruikt wanneer de werken echt klaar
 * zijn, dus wat hier staat is wat er straks gebeurt.
 */
export function upgradeImpact(state: GameState, id: UpgradeId, seats?: number): Impact[] {
  const after = withUpgrade(state, id, seats);
  const out: Impact[] = [];
  const add = (icon: string, label: string, value: string, tone: Impact['tone'], tip: string) => out.push({ icon, label, value, tone, tip });
  const d = (fn: (s: GameState) => number) => ({ from: fn(state), to: fn(after) });

  const pub = d(MEASURES.publiek);
  if (Math.abs(pub.to - pub.from) >= 1) {
    add('👥', 'Toeschouwers', sign(pub.to - pub.from), pub.to >= pub.from ? 'good' : 'bad',
      `Bij een gewone thuiswedstrijd verwacht je nu ${Math.round(pub.from)} mensen; daarna ${Math.round(pub.to)}. Meer volk is meer tickets én meer kantine.`);
  }

  const kant = d(MEASURES.kantinePerHoofd);
  if (Math.abs(kant.to - kant.from) >= 0.01) {
    add('🍺', 'Per bezoeker', sign(kant.to - kant.from, 2), kant.to >= kant.from ? 'good' : 'bad',
      `De winst per bezoeker aan de toog gaat van €${kant.from.toFixed(2)} naar €${kant.to.toFixed(2)}.`);
  }

  const spons = d(MEASURES.sponsorwaarde);
  if (Math.abs(pct(spons.from, spons.to)) >= 0.5) {
    add('🤝', 'Sponsors betalen', signPct(pct(spons.from, spons.to)), spons.to >= spons.from ? 'good' : 'bad',
      `Wat bedrijven voor een plaats willen neerleggen gaat met ${signPct(pct(spons.from, spons.to))}.`);
  }

  const jeugd = d(MEASURES.jeugdleden);
  if (Math.abs(jeugd.to - jeugd.from) >= 1) {
    add('🧒', 'Jeugdleden', sign(jeugd.to - jeugd.from), jeugd.to >= jeugd.from ? 'good' : 'bad',
      `Bij het huidige lidgeld schrijven zich ${Math.round(jeugd.from)} leden in; daarna ${Math.round(jeugd.to)}.`);
  }

  const herstel = d(MEASURES.herstel);
  if (Math.abs(herstel.to - herstel.from) >= 0.1) {
    add('💤', 'Herstel', `${sign(herstel.to - herstel.from, 1)}/week`, herstel.to >= herstel.from ? 'good' : 'bad',
      `Je spelers verliezen ${herstel.from.toFixed(1)} vermoeidheidspunten per week extra; daarna ${herstel.to.toFixed(1)}.`);
  }

  // de vaste kosten: elke steen kost ook onderhoud en energie, en dat vergeet men graag
  const kost = d(facilityCost);
  if (Math.abs(kost.to - kost.from) >= 1) {
    add('🧾', 'Vaste kosten', `${sign(kost.to - kost.from)}/week`, kost.to <= kost.from ? 'good' : 'bad',
      `Onderhoud, energie en materiaal gaan van ${Math.round(kost.from)} naar ${Math.round(kost.to)} euro per week. Dat loopt door, ook in de winterstop.`);
  }

  const cap = after.infrastructure.capacity - state.infrastructure.capacity;
  if (cap) {
    add('🏟️', 'Plaatsen', sign(cap), 'good',
      `Je tribune gaat van ${state.infrastructure.capacity} naar ${after.infrastructure.capacity} plaatsen. Zolang je die niet vol krijgt, levert een grotere tribune niets extra op.`);
  }

  // Wat niet in de bovenstaande maten zit, maar wel telt. Deze drie werken niet via een
  // vermenigvuldiger op je publiek of je kantine, dus meten levert hier niets op.
  if (id === 'kunstgras') {
    add('🌧️', 'Afgelastingen', 'geen', 'good', 'Op kunstgras gaat elke wedstrijd door, ook na een week regen. Een afgelasting kost je de volledige kassa en kantine van die dag.');
    add('🔑', 'Verhuur', 'mogelijk', 'good', 'Andere clubs en scholen huren je veld af. Dat levert elke week iets op, ook als je zelf niet speelt.');
  }
  if (id === 'ploegbus') {
    add('🚌', 'Verplaatsingen', '−55%', 'good', 'Je betaalt alleen nog brandstof en een chauffeur in plaats van een bus te huren, voor elke uitwedstrijd van het seizoen.');
    add('🤝', 'Sponsorplaats', '+1', 'good', 'Een bedrijf kan zijn naam op de bus zetten: dat is een extra sponsorplaats die je anders niet hebt.');
  }
  if (id === 'zonnepanelen') {
    add('⚡', 'Energie', '−14%', 'good', 'Je vaste kosten zakken met 14%, elke week, en dat loopt door zolang de club bestaat.');
  }
  if (id === 'kraampjes') {
    add('🍟', 'Kraamplaats', '+1', 'good', 'Plaats voor een extra standhouder. De prijs volgt je opkomst en verdient zichzelf in ongeveer twee seizoenen terug.');
  }
  if (id === 'ledverlichting') {
    add('⚡', 'Energie', '−6%', 'good', 'Je vaste kosten zakken met 6%, elke week — de kleinste groene stap, zo terugverdiend.');
  }
  if (id === 'opleidingscentrum') {
    add('🧒', 'Jeugdopleiding', 'beter', 'good', 'Je eigen jongeren groeien sneller en er komen meer beloften uit je jeugdwerking naar de A-kern.');
  }
  if (id === 'verlichting') {
    add('📋', 'Licentie', 'hogere reeks', 'neutral', 'Zonder voldoende verlichting krijg je geen licentie voor een hogere reeks. Promoveren zonder dit is dus niet mogelijk.');
  }
  if (id === 'recuperatie') {
    add('🩺', 'Personeel', 'kinesist mogelijk', 'good', 'Pas met een recuperatieruimte kun je een kinesist of verzorger aanwerven. Zonder die ruimte zijn die functies vergrendeld.');
  }

  return out;
}

/* ---------------------------------------------------------------- spelers */

/** Een kopie van de club met deze speler erbij of eruit. */
function withPlayer(state: GameState, player: Player, erbij: boolean): GameState {
  const copy = structuredClone(state);
  copy.players = erbij ? [...copy.players, structuredClone(player)] : copy.players.filter((p) => p.id !== player.id);
  // de trainer stelt opnieuw op, anders blijft je oude elftal staan en verandert er niets
  copy.tactics.manualXI = [];
  copy.tactics.benched = [];
  copy.tactics.gaps = {};
  return copy;
}

/**
 * Wat deze speler met je ploeg doet. `erbij` is false wanneer je hem zou verkopen.
 *
 * Het antwoord is vaak "niets": een speler die je beste elf niet haalt, verandert je
 * teamsterkte niet. Dat is precies wat je wil weten vóór je betaalt.
 */
export function playerImpact(state: GameState, player: Player, erbij = true): Impact[] {
  const before = erbij ? state : withPlayer(state, player, false);
  const after = erbij ? withPlayer(state, player, true) : state;
  const out: Impact[] = [];

  const sterkte = { from: teamStrength(before).total, to: teamStrength(after).total };
  const verschil = erbij ? sterkte.to - sterkte.from : sterkte.from - sterkte.to;
  if (Math.abs(verschil) >= 0.05) {
    out.push({
      icon: '⚽',
      label: 'Teamsterkte',
      value: sign(verschil, 1),
      tone: verschil >= 0 ? 'good' : 'bad',
      tip: erbij
        ? `Met hem erbij gaat je ploeg van ${sterkte.from.toFixed(1)} naar ${sterkte.to.toFixed(1)}. Je trainer stelt dan opnieuw op, dus dit is wat hij écht toevoegt aan je beste elf.`
        : `Zonder hem zakt je ploeg van ${sterkte.from.toFixed(1)} naar ${sterkte.to.toFixed(1)}.`,
    });
  } else if (erbij) {
    out.push({
      icon: '🪑',
      label: 'Teamsterkte',
      value: 'geen',
      tone: 'neutral',
      tip: `Hij haalt je beste elf niet, dus je teamsterkte verandert niet. Als reserve of voor later kan hij nog altijd nuttig zijn — maar je betaalt nu voor de bank.`,
    });
  }

  out.push({
    icon: '💶',
    label: 'Loon',
    value: `${erbij ? '−' : '+'}€${player.wage}/w`,
    tone: erbij ? 'bad' : 'good',
    tip: `${erbij ? 'Erbij' : 'Eraf'}: €${player.wage} per week, elke week, ook in de winterstop. Over een heel seizoen is dat ${euroRound(player.wage * 52)}.`,
  });

  if (erbij && player.age <= 21) {
    out.push({
      icon: '📈',
      label: 'Potentieel',
      value: `${player.potential}`,
      tone: player.potential - overall(player) >= 10 ? 'good' : 'neutral',
      tip: `Hij staat nu op ${overall(player)} en kan naar ${player.potential} groeien. Jonge spelers groeien het snelst met veel speeltijd en een goede hoofdtrainer.`,
    });
  }

  return out;
}

const euroRound = (n: number) => `€${Math.round(n).toLocaleString('nl-BE')}`;
