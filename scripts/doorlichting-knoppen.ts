// Dode knoppen: instellingen waar je aan kunt draaien zonder dat het (per saldo) iets doet.
//
// Gebruik: npm exec tsx scripts/doorlichting-knoppen.ts
//
// Geschreven voor de doorlichting van september 2026. Twee knoppen doorgerekend met de
// functies van de motor zelf, op een echte spelstand (uitbestedende club, seizoen 2 en 5):
//
// 1. Onderhoud premium. Kost 30% extra op facilityCost; levert ×1,04 toeschouwers en een
//    lager defectrisico (content-event "defect": 1,5% per week bij normaal, 0,4% bij
//    premium, herstelkost gemiddeld −3.000 × inflatie). De meting toont dat premium in
//    3de Nationale per week meer kost dan het opbrengt en pas in de hoogste reeksen in de
//    buurt van break-even komt. "Basis" is dan weer fors goedkoper terwijl de boete
//    (−6% publiek + defecten) kleiner is dan de besparing — de knop wijst dus de verkeerde
//    kant op: zuinig is bijna altijd juist.
//
// 2. Sponsorlooptijd (1/2/3 seizoenen, +0/8/15%). Wie promoveert tekent beter kort — de
//    sprong van de reeks (+50 à +74% op de gangbare prijs) verplettert de 15% — en wie
//    blijft hangen tekent beter lang. De meting zet de drie looptijden naast elkaar voor
//    beide gevallen, zodat je ziet hoe groot het verschil werkelijk is.
//
// Daarnaast is bij het lezen van de code gebleken dat `breakdownChance` (finance.ts) door
// niets in de motor gebruikt wordt: het defectrisico loopt via het content-event. De
// functie wordt alleen nog door een test vastgehouden.

import type { GameState, InvestorId, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, hireStaff } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { expectedAttendance, facilityCost, spendPerHead, AWAY_SHARE } from '../src/engine/finance';
import { fairPrice } from '../src/engine/sponsors';
import { SPONSOR_TERMS } from '../src/engine/sponsors';
import { DIVISIONS } from '../src/engine/data/divisions';
import { attachFileLogFromEnv } from '../src/log/node';

attachFileLogFromEnv('logs/doorlichting-knoppen.log');

function werfAan(s: GameState): void {
  for (const rol of ['hoofdtrainer', 'assistent', 'commercieel', 'kantine'] as const) {
    const heeft = s.staff.find((m) => m.role === rol);
    const k = [...s.staffMarket].filter((m) => m.role === rol && (!heeft || m.skill > heeft.skill + 5)).sort((a, b) => b.skill - a.skill)[0];
    if (k) hireStaff(s, k.id);
  }
  for (const taak of TASKS) {
    const kand = s.staff.filter((m) => taak.roles.includes(m.role)).sort((a, b) => b.skill - a.skill);
    for (const m of kand) if (delegateTask(s, taak.id as TaskId, m.id).ok) break;
  }
}

/** Speelt tot seizoen n, week 20, met de uitbestedende stijl. */
function snapshot(seizoen: number): GameState {
  let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'heidebeke', investor: 'cooperatie' as InvestorId, seed: 3 });
  while (!s.gameOver && (s.season < seizoen || s.week < 20)) {
    if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
    if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
    if (s.week === 1) werfAan(s);
    while (squadBlock(s)) {
      const k = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
      if (!k || !buyPlayer(s, k.id).ok) break;
    }
    s = advanceWeek(s);
  }
  return s;
}

// ---------- 1. Onderhoud ----------

const DEFECT_KANS: Record<'basis' | 'normaal' | 'premium', number> = { basis: 0.004 * 15, normaal: 0.004 * 3.75, premium: 0.004 };
const DEFECT_KOST: Record<'basis' | 'normaal' | 'premium', number> = { basis: -1400 * 3, normaal: -1000 * 3, premium: -1000 * 3 };

function onderhoudTabel(s: GameState, label: string, ruimeTribune = false): void {
  const att0 = expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });
  console.log(
    `\n${label} — ${DIVISIONS[s.league.divisionLevel].name}, ${s.community.fanBase} supporters, ` +
      `capaciteit ${s.infrastructure.capacity}${ruimeTribune ? ' → ×10 (zonder vol-huis-plafond)' : ''}, verwachte opkomst ${att0}, inflatie ${s.inflation.toFixed(2)}`,
  );
  console.log(`${'stand'.padEnd(9)} ${'kost/w'.padStart(8)} ${'match-inkomen/w'.padStart(16)} ${'defect-EV/w'.padStart(12)} ${'netto t.o.v. normaal'.padStart(21)}`);
  const rows: Record<string, { kost: number; match: number; defect: number }> = {};
  for (const stand of ['basis', 'normaal', 'premium'] as const) {
    const proef = structuredClone(s);
    proef.infrastructure.maintenance = stand;
    if (ruimeTribune) proef.infrastructure.capacity *= 10;
    const att = expectedAttendance(proef, { weather: 'bewolkt', derby: false, positionFactor: 1 });
    // gemiddeld per week: 15 thuiswedstrijden per seizoen van 52 weken
    const match = (att * (proef.ticketPrice * (1 - AWAY_SHARE) + spendPerHead(proef)) * 15) / 52;
    // de facilityCost van de echte tribune, niet van de proeftribune
    const kostProef = structuredClone(s);
    kostProef.infrastructure.maintenance = stand;
    rows[stand] = { kost: facilityCost(kostProef), match, defect: DEFECT_KANS[stand] * DEFECT_KOST[stand] * s.inflation };
  }
  const basis = rows['normaal'];
  for (const stand of ['basis', 'normaal', 'premium'] as const) {
    const r = rows[stand];
    const netto = -r.kost + r.match + r.defect - (-basis.kost + basis.match + basis.defect);
    console.log(
      `${stand.padEnd(9)} ${Math.round(-r.kost).toLocaleString('nl-BE').padStart(8)} ${Math.round(r.match).toLocaleString('nl-BE').padStart(16)} ${Math.round(r.defect).toLocaleString('nl-BE').padStart(12)} ${(netto >= 0 ? '+' : '') + Math.round(netto).toLocaleString('nl-BE').padStart(20)}`,
    );
  }
}

// ---------- 2. Sponsorlooptijd ----------

function looptijdTabel(s: GameState): void {
  const kinds = ['bord', 'shirt', 'hoofdsponsor'] as const;
  console.log(`\nSponsorlooptijd — wat drie seizoenen in totaal opleveren (${DIVISIONS[s.league.divisionLevel].name}):`);
  console.log(`${'plaats'.padEnd(14)} ${'3 sz vast (+15%)'.padStart(17)} ${'3× kort, geen promotie'.padStart(23)} ${'kort + elk sz promotie'.padStart(23)}`);
  for (const kind of kinds) {
    const nu = fairPrice(s, kind);
    const vast = Math.round(nu * (SPONSOR_TERMS[2]?.factor ?? 1.15) * 156);
    const kortStil = Math.round(nu * 156);
    // bij promotie tekent hij het volgende seizoen tegen de gangbare prijs van de nieuwe reeks
    let kortKlim = 0;
    for (let i = 0; i < 3; i++) {
      const proef = structuredClone(s);
      proef.league.divisionLevel = Math.min(DIVISIONS.length - 1, s.league.divisionLevel + i);
      kortKlim += Math.round(fairPrice(proef, kind) * 52);
    }
    console.log(
      `${kind.padEnd(14)} ${vast.toLocaleString('nl-BE').padStart(17)} ${kortStil.toLocaleString('nl-BE').padStart(23)} ${kortKlim.toLocaleString('nl-BE').padStart(23)}`,
    );
  }
}

const s2 = snapshot(2);
const s5 = snapshot(5);
console.log('Dode-knoppen-meting (uitbestedende club, heidebeke/cooperatie, seed 3)');
onderhoudTabel(s2, 'Onderhoud, seizoen 2');
onderhoudTabel(s2, 'Onderhoud, seizoen 2', true);
onderhoudTabel(s5, 'Onderhoud, seizoen 5');
onderhoudTabel(s5, 'Onderhoud, seizoen 5', true);
looptijdTabel(s2);
looptijdTabel(s5);
