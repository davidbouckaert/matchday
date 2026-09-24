// Zijn evenementen de nieuwe gratis-geld-machine van de hogere reeksen?
//
// Gebruik: npm exec tsx scripts/doorlichting-evenementen.ts
//
// Geschreven voor de doorlichting van september 2026. Aanleiding: in de economie-meting is
// "evenementen" bij een uitbestedende club de op één na grootste inkomstenpost over zes
// seizoenen (€1,96M), groter dan lidgelden, tickets en kantine. Dat riekt naar dezelfde
// asymmetrie als 0.42.0, want de opbrengst van een evenement hangt aan drie grootheden die
// met je reeks meeschalen — fanBase (norm 250 → 10.000), sponsorWeekly (factor 0,6 → 8) en
// capacity — terwijl de kost alleen inflatie × (1 + 12% per reeks) draagt (eventCost in
// actions.ts). De sponsorgebonden evenementen (sponsorontbijt, businessclub, galabal) erven
// de volledige sponsorschaal van de reeks in hun opbrengst.
//
// Wat de meting aantoonde (heidebeke/cooperatie, seed 3, zes seizoenen uitbesteden):
//   - de winst per georganiseerd evenement stijgt van ~€2.000 in 3de Nationale naar
//     tienduizenden euro's per stuk in de Challenger Pro Liga;
//   - de opbrengst/kost-verhouding van de businessclub-lunch loopt op tot boven de 10;
//   - het plafond (max per seizoen, wachttijden, vrijwilligers) remt het aantal, maar niet
//     de verhouding: elk evenement dat kán doorgaan, is in een hoge reeks bijna gratis geld.

import type { GameState, InvestorId, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, eventCost, eventForecast, hireStaff } from '../src/engine/actions';
import { CLUB_EVENTS, TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { DIVISIONS } from '../src/engine/data/divisions';
import { attachFileLogFromEnv } from '../src/log/node';

attachFileLogFromEnv('logs/doorlichting-evenementen.log');

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

const SEASONS = Number(process.env.SEASONS ?? 6);
const SEED = Number(process.env.SEED ?? 3);
const club = process.env.CLUB ?? 'heidebeke';
const investor = (process.env.INVESTOR ?? 'cooperatie') as InvestorId;

let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: club, investor, seed: SEED });
console.log(`Evenementen-meting: uitbesteden, ${club}/${investor}, seed ${SEED}, ${SEASONS} seizoenen`);
console.log(`\nPer seizoen: hoeveel evenementen, wat kwam erin, wat ging eruit (categorie "evenementen", incl. vrijwilligersacties):`);
console.log(`${'sz'.padEnd(3)} ${'reeks'.padEnd(20)} ${'aantal'.padStart(6)} ${'in'.padStart(9)} ${'uit'.padStart(9)} ${'netto'.padStart(9)}`);

for (let season = 0; season < SEASONS && !s.gameOver; season++) {
  const seizoenNr = s.season;
  let inSom = 0;
  let uitSom = 0;
  let reeks = DIVISIONS[s.league.divisionLevel].name;
  let roiRegel: string[] = [];
  for (let w = 0; w < 52 && !s.gameOver; w++) {
    if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
    if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
    if (w === 0) werfAan(s);
    while (squadBlock(s)) {
      const k = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
      if (!k || !buyPlayer(s, k.id).ok) break;
    }
    if (s.week === 30) {
      // de verhouding opbrengst/kost per evenement dat op dit niveau bestaat
      reeks = DIVISIONS[s.league.divisionLevel].name;
      roiRegel = CLUB_EVENTS.filter((e) => (e.minLevel ?? 0) <= s.league.divisionLevel)
        .map((e) => {
          const [min, max] = eventForecast(s, e);
          const mid = (min + max) / 2;
          const kost = eventCost(s, e);
          return `${e.id} ${(mid / Math.max(1, kost)).toFixed(1)}×`;
        });
    }
    s = advanceWeek(s);
    for (const e of s.lastWeek) {
      if (e.category !== 'evenementen') continue;
      if (e.amount > 0) inSom += e.amount;
      else uitSom += e.amount;
    }
  }
  const dit = s.eventLog.filter((e) => e.season === seizoenNr).length;
  console.log(
    `${String(season + 1).padEnd(3)} ${reeks.padEnd(20)} ${String(dit).padStart(6)} ${Math.round(inSom).toLocaleString('nl-BE').padStart(9)} ${Math.round(uitSom).toLocaleString('nl-BE').padStart(9)} ${Math.round(inSom + uitSom).toLocaleString('nl-BE').padStart(9)}`,
  );
  console.log(`    opbrengst/kost in week 30: ${roiRegel.join(' · ')}`);
}
