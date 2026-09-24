// Hoe vaak zit de tribune gewoon vol — en staan alle publieksknoppen dus dood?
//
// Gebruik: npm exec tsx scripts/doorlichting-capaciteit.ts
//
// Geschreven voor de doorlichting van september 2026. `expectedAttendance` clampt op de
// tribunecapaciteit (finance.ts). Zit de tribune vol, dan doet álles wat de opkomst
// vermenigvuldigt niets meer: premium onderhoud (×1,04), wifi (×1,03-1,06), parking
// (×1,045-1,09), sanitair, scorebord, de sterspeler (tot ×1,16), het weer en je plaats in
// het klassement. De supportersnorm van de reeks groeit ×6,4 van 3de Nationale naar de
// Challenger Pro Liga, terwijl de tribune alleen groeit als iemand bouwt — de vraag is dus
// hoe groot het deel van de thuiswedstrijden is waarin die knoppen echt dood staan.
//
// Wat de meting aantoonde (5 seeds, 6 seizoenen, uitbestedende club): vanaf seizoen 2 is
// het merendeel van de thuiswedstrijden uitverkocht; over de hele carrière ligt het rond
// de twee derde. De publieksknoppen zijn voor deze club dus het grootste deel van de tijd
// letterlijk zonder gevolg.

import type { GameState, InvestorId, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, hireStaff } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { attachFileLogFromEnv } from '../src/log/node';

attachFileLogFromEnv('logs/doorlichting-capaciteit.log');

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

const SEEDS = Number(process.env.SEEDS ?? 5);
const SEASONS = Number(process.env.SEASONS ?? 6);

const perSeizoen: Record<number, { vol: number; totaal: number }> = {};
for (let seed = 1; seed <= SEEDS; seed++) {
  let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'heidebeke', investor: 'cooperatie' as InvestorId, seed });
  for (let season = 0; season < SEASONS && !s.gameOver; season++) {
    for (let w = 0; w < 52 && !s.gameOver; w++) {
      if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
      if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
      if (w === 0) werfAan(s);
      while (squadBlock(s)) {
        const k = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
        if (!k || !buyPlayer(s, k.id).ok) break;
      }
      const capaciteitVooraf = s.infrastructure.capacity;
      s = advanceWeek(s);
      const m = s.lastMatch;
      if (m && m.home && !m.forfeit && m.week === s.week - 1 && m.attendance > 0) {
        const t = (perSeizoen[season + 1] ??= { vol: 0, totaal: 0 });
        t.totaal++;
        if (m.attendance >= capaciteitVooraf) t.vol++;
      }
    }
  }
}

console.log(`Volle tribunes bij de uitbestedende club (heidebeke/cooperatie, ${SEEDS} seeds × ${SEASONS} seizoenen):\n`);
console.log(`${'seizoen'.padEnd(8)} ${'thuiswedstrijden'.padStart(16)} ${'uitverkocht'.padStart(12)} ${'aandeel'.padStart(8)}`);
let volSom = 0;
let totSom = 0;
for (const [sz, t] of Object.entries(perSeizoen)) {
  volSom += t.vol;
  totSom += t.totaal;
  console.log(`${sz.padEnd(8)} ${String(t.totaal).padStart(16)} ${String(t.vol).padStart(12)} ${`${Math.round((t.vol / Math.max(1, t.totaal)) * 100)}%`.padStart(8)}`);
}
console.log(`\nSamen: ${volSom}/${totSom} thuiswedstrijden uitverkocht (${Math.round((volSom / Math.max(1, totSom)) * 100)}%).`);
