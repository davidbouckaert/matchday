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

import type { GameState, Staff, StaffRole } from './types';
import { roleDef } from './data/catalog';
import { staffSkill } from './staff';
import { expectedAttendance } from './finance';
import { spendPerHeadCanteen } from './canteen';
import { buildUpFactor, injuryFactors, product, recovery, sponsorFactors } from './factors';
import { teamStrength } from './players';
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
