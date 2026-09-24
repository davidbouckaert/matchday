// Hoe risicoloos is automatisch piloot spelen?
//
// Gebruik: npm run autopilot          (8 partijen, 6 seizoenen)
//          SEEDS=20 npm run autopilot (de afspraak: ~2 op 20 mag failliet gaan in de middelste kolom)
//
// Dit is het meetinstrument bij de afspraak dat uitbesteden niet gratis mag zijn. Drie
// speelstijlen, allemaal met alles gedelegeerd en verder geen enkele ingreep:
//
//   bestaande staf     je werft niemand aan en besteedt uit aan wie er toevallig al werkt
//   beste betaalbare   je koopt de beste hoofdtrainer, assistent, commercieel en kantine
//   alles kopen        je koopt voor elke rol de beste die er te koop is
//
// De middelste is de afgesproken lat: die mag niet nul zijn. De rechtse mag laag zijn, maar
// alleen als je er echt lang over doet om er te geraken — dat is de "18 op 20" uit de afspraak.
//
// Let op één ding bij het lezen: de bot koopt spelers zodra hij onder de harde ondergrens van
// achttien zakt, want in het echte spel staat de knop dan stil en moét je kopen. Zonder dat
// stuk meet je een club die maanden met veertien spelers doorspeelt, en dat kan niet.

import type { GameState, InvestorId, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, hireStaff } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { attachFileLogFromEnv } from '../src/log/node';

type Stijl = 'bestaande staf' | 'beste betaalbare' | 'alles kopen';

const STIJLEN: Stijl[] = ['bestaande staf', 'beste betaalbare', 'alles kopen'];

const ROLLEN: Record<Exclude<Stijl, 'bestaande staf'>, readonly string[]> = {
  'beste betaalbare': ['hoofdtrainer', 'assistent', 'commercieel', 'kantine'],
  'alles kopen': [
    'hoofdtrainer', 'assistent', 'conditietrainer', 'analist', 'keepertrainer', 'kinesist',
    'verzorger', 'commercieel', 'kantine', 'scout', 'jeugdcoordinator', 'afgevaardigde',
  ],
};

function werfAan(s: GameState, stijl: Stijl): void {
  if (stijl === 'bestaande staf') return;
  for (const rol of ROLLEN[stijl]) {
    const heeft = s.staff.find((m) => m.role === rol);
    const kandidaat = [...s.staffMarket]
      .filter((m) => m.role === rol && (!heeft || m.skill > heeft.skill + 5))
      .sort((a, b) => b.skill - a.skill)[0];
    if (kandidaat) hireStaff(s, kandidaat.id);
  }
}

function delegeer(s: GameState): void {
  for (const taak of TASKS) {
    const kandidaten = s.staff.filter((m) => taak.roles.includes(m.role)).sort((a, b) => b.skill - a.skill);
    for (const m of kandidaten) if (delegateTask(s, taak.id as TaskId, m.id).ok) break;
  }
}

function speel(clubId: string, investor: InvestorId, seed: number, stijl: Stijl, seizoenen: number): GameState {
  let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId, investor, seed });
  for (let season = 0; season < seizoenen && !s.gameOver; season++) {
    for (let w = 0; w < 52 && !s.gameOver; w++) {
      if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
      if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
      if (w === 0) {
        werfAan(s, stijl);
        delegeer(s);
      }
      // De knop staat stil onder de ondergrens, dus de speler moét kopen. De bot ook.
      while (squadBlock(s)) {
        const kandidaat = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
        if (!kandidaat || !buyPlayer(s, kandidaat.id).ok) break;
      }
      s = advanceWeek(s);
    }
  }
  return s;
}

attachFileLogFromEnv('logs/autopilot.log');

const SEEDS = Number(process.env.SEEDS ?? 8);
const SEASONS = Number(process.env.SEASONS ?? 6);
const clubs = (process.env.CLUBS ?? 'zuidrand,heidebeke').split(',');
const investors = (process.env.INVESTORS ?? 'aannemer,fonds,cooperatie').split(',') as InvestorId[];

console.log(`Automatisch piloot: failliet na ${SEASONS} seizoenen, ${SEEDS} partijen per combinatie\n`);
console.log(`${'club'.padEnd(10)} ${'investeerder'.padEnd(13)} ${STIJLEN.map((s) => s.padStart(18)).join(' ')}`);

const totalen: Record<string, number> = {};
for (const club of clubs) {
  for (const inv of investors) {
    const uit: string[] = [];
    for (const stijl of STIJLEN) {
      let failliet = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        if (speel(club, inv, seed, stijl, SEASONS).gameOver) failliet++;
      }
      totalen[stijl] = (totalen[stijl] ?? 0) + failliet;
      uit.push(`${failliet}/${SEEDS}`);
    }
    console.log(`${club.padEnd(10)} ${inv.padEnd(13)} ${uit.map((x) => x.padStart(18)).join(' ')}`);
  }
}

const totaalPartijen = clubs.length * investors.length * SEEDS;
console.log(`\nSamen over ${totaalPartijen} partijen per stijl:`);
for (const stijl of STIJLEN) console.log(`  ${stijl.padEnd(18)} ${totalen[stijl]}/${totaalPartijen} failliet`);
console.log('\nDe afspraak: de middelste kolom mag niet nul zijn — wie de beste betaalbare mensen');
console.log('aanwerft en dan doorklikt, hoort af en toe onderuit te gaan.');
