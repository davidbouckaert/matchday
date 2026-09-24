// Waar komt het geld vandaan, en waar gaat het heen?
//
// Gebruik: npm run economie
//
// Dit script vond de scheeftrekking van 0.42.0: over zes seizoenen ging de omzet van een
// uitbestedende club zes keer omhoog en haar kosten twee keer, omdat op de inkomstenkant alles
// geïndexeerd was op je reeks en op de kostenkant niets. Het staat hier omdat dat soort fout
// zich niet laat zien in een eindsaldo — je ziet hem pas als je inkomsten en kosten per
// seizoen naast elkaar zet, met de reeks erbij.
//
// Het zet twee clubs naast elkaar: eentje die niets doet, en eentje die vier mensen aanwerft
// en alles uitbesteedt. Dat verschil is de hele vraag waar we mee bezig zijn.

import type { GameState, InvestorId, LedgerCategory, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, hireStaff } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { DIVISIONS } from '../src/engine/data/divisions';
import { attachFileLogFromEnv } from '../src/log/node';

type Stijl = 'niets doen' | 'uitbesteden';

function werfAan(s: GameState, stijl: Stijl): void {
  if (stijl === 'niets doen') return;
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

const euro = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${Math.round(n / 1000)}k`);

function speel(stijl: Stijl, club: string, investor: InvestorId, seed: number, seizoenen: number): void {
  let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: club, investor, seed });
  const opgeteld: Partial<Record<LedgerCategory, number>> = {};
  console.log(`\n### ${stijl} — ${club}/${investor}, seed ${seed}`);
  console.log(`  ${'seizoen'.padEnd(9)} ${'reeks'.padEnd(20)} ${'in'.padStart(8)} ${'uit'.padStart(9)} ${'sponsors'.padStart(9)} ${'lonen'.padStart(9)} ${'kas'.padStart(9)}`);
  for (let season = 0; season < seizoenen && !s.gameOver; season++) {
    for (let w = 0; w < 52 && !s.gameOver; w++) {
      if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
      if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
      if (w === 0) werfAan(s, stijl);
      while (squadBlock(s)) {
        const k = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
        if (!k || !buyPlayer(s, k.id).ok) break;
      }
      s = advanceWeek(s);
    }
    const st = (s.lastSeasonTotals ?? {}) as Record<string, number>;
    for (const [c, v] of Object.entries(st)) opgeteld[c as LedgerCategory] = (opgeteld[c as LedgerCategory] ?? 0) + v;
    const inkomsten = Object.values(st).filter((v) => v > 0).reduce((a, b) => a + b, 0);
    const kosten = Object.values(st).filter((v) => v < 0).reduce((a, b) => a + b, 0);
    const lonen = (st['lonen spelers'] ?? 0) + (st['lonen personeel'] ?? 0);
    const reeks = DIVISIONS[s.league.divisionLevel]?.name ?? '?';
    console.log(
      `  ${String(season + 1).padEnd(9)} ${reeks.padEnd(20)} ${euro(inkomsten).padStart(8)} ${euro(kosten).padStart(9)} ` +
        `${euro(st.sponsors ?? 0).padStart(9)} ${euro(lonen).padStart(9)} ${euro(s.cash).padStart(9)}`,
    );
  }
  console.log(`  → ${s.gameOver ? 'FAILLIET' : 'overleeft'}, eindsaldo ${euro(s.cash)}`);
  const rijen = Object.entries(opgeteld).sort((a, b) => Math.abs(b[1]!) - Math.abs(a[1]!)).slice(0, 10);
  console.log('  grootste posten over alle seizoenen:');
  for (const [cat, bedrag] of rijen) console.log(`     ${cat.padEnd(22)} ${euro(bedrag!).padStart(9)}`);
}

attachFileLogFromEnv('logs/economie.log');

const SEASONS = Number(process.env.SEASONS ?? 6);
const SEED = Number(process.env.SEED ?? 3);
const club = process.env.CLUB ?? 'heidebeke';
const investor = (process.env.INVESTOR ?? 'cooperatie') as InvestorId;

console.log(`Economie: ${SEASONS} seizoenen, inkomsten en kosten per seizoen naast de reeks waarin je speelt.`);
speel('niets doen', club, investor, SEED, SEASONS);
speel('uitbesteden', club, investor, SEED, SEASONS);
