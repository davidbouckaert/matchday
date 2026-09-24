// Waarom blijft de uitbestedende club winnen, en wat betaalt ze voor haar ploeg?
//
// Gebruik: npm exec tsx scripts/doorlichting-loonlat.ts   (SEEDS=n SEASONS=n om bij te stellen)
//
// Geschreven voor de doorlichting van september 2026. De open knoop is dat "de beste
// betaalbare staf aanwerven en doorklikken" 0 op 48 failliet gaat. HANDOVER.md wijst naar de
// tegenstand (52 → 70), maar dat is de helft van het verhaal. Dit script meet de andere
// helft: het gat tussen wat de ploeg van die club wérkelijk kost en wat dezelfde ploeg
// volgens de loonlat van de reeks (wageDemand) zou moeten kosten. Twee kanalen lopen om de
// loonlat van 0.42.0 heen:
//
//   1. bestaande contracten stijgen bij promotie maar 14% (adjustWagesForDivision), terwijl
//      de lat zelf per trede 45 à 62% stijgt (wageFactor 1 → 1,45 → 2,2 → 3,6 → 6,5);
//   2. eigen jeugd stroomt elk seizoen door op bijna reeksniveau voor €40/week
//      (newSeason in turn.ts: quality = reeksniveau − 12 + bonussen, wage = 40).
//
// Wat de meting aantoonde (5 seeds, 6 seizoenen, heidebeke/cooperatie):
//   - de club betaalt in seizoen 5-6 typisch 40 à 60% van de loonlat van haar reeks;
//   - een kwart tot een derde van de kern is eigen jeugd aan €40;
//   - haar sterkte ligt elk seizoen boven het reeksgemiddelde mét slijtage, dus ze
//     promoveert bijna elk seizoen en pakt telkens de inkomstensprong van de nieuwe reeks
//     tegen een loonlast die twee reeksen achterloopt.

import type { GameState, InvestorId, TaskId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, hireStaff } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock, teamStrength, wageDemand } from '../src/engine/players';
import { ownPosition, teamWear } from '../src/engine/league';
import { DIVISIONS } from '../src/engine/data/divisions';
import { attachFileLogFromEnv } from '../src/log/node';

attachFileLogFromEnv('logs/doorlichting-loonlat.log');

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

interface SeizoensRij {
  seizoen: number;
  reeks: string;
  positie: number;
  eigenSterkte: number; // gemiddeld over de matchweken
  reeksSterkte: number; // gemiddelde tegenstander mét seizoensslijtage
  loonWerkelijk: number; // spelerslonen per week, gemeten in week 44
  loonLat: number; // wat wageDemand voor exact dezelfde spelers zou vragen
  jeugd: number; // spelers uit eigen jeugd in de kern
  kern: number;
  winst: number; // seizoenswinst (zonder leningen/investeerder)
}

function speel(clubId: string, investor: InvestorId, seed: number, seizoenen: number): SeizoensRij[] {
  let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId, investor, seed });
  const rijen: SeizoensRij[] = [];
  let sterkteSom = 0;
  let reeksSom = 0;
  let weken = 0;
  let vorigSeizoen = s.season;

  for (let season = 0; season < seizoenen && !s.gameOver; season++) {
    for (let w = 0; w < 52 && !s.gameOver; w++) {
      if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
      if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
      if (w === 0) werfAan(s);
      while (squadBlock(s)) {
        const k = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
        if (!k || !buyPlayer(s, k.id).ok) break;
      }

      if (s.week >= 5 && s.week <= 44) {
        sterkteSom += teamStrength(s).total;
        reeksSom += s.league.teams.reduce((sum, t) => sum + t.strength - teamWear(t.id, s.season, s.week), 0) / s.league.teams.length;
        weken++;
      }
      if (s.week === 44) {
        const kern = s.players.filter((p) => p.loan?.type !== 'uit');
        rijen.push({
          seizoen: s.season,
          reeks: DIVISIONS[s.league.divisionLevel].name,
          positie: ownPosition(s.league),
          eigenSterkte: sterkteSom / Math.max(1, weken),
          reeksSterkte: reeksSom / Math.max(1, weken),
          loonWerkelijk: kern.reduce((sum, p) => sum + p.wage, 0),
          loonLat: kern.reduce((sum, p) => sum + wageDemand(s, p), 0),
          jeugd: kern.filter((p) => p.isYouth).length,
          kern: kern.length,
          winst: 0,
        });
        sterkteSom = reeksSom = weken = 0;
      }
      s = advanceWeek(s);
      if (s.season !== vorigSeizoen) {
        // seizoenswinst bijschrijven bij de rij van het seizoen dat net afsloot
        const st = s.lastSeasonTotals as Record<string, number>;
        const winst = Object.entries(st)
          .filter(([k]) => k !== 'leningen' && k !== 'investeerder')
          .reduce((a, [, v]) => a + (v ?? 0), 0);
        const rij = rijen.find((r) => r.seizoen === vorigSeizoen);
        if (rij) rij.winst = winst;
        vorigSeizoen = s.season;
      }
    }
  }
  return rijen;
}

const SEEDS = Number(process.env.SEEDS ?? 5);
const SEASONS = Number(process.env.SEASONS ?? 6);
const club = process.env.CLUB ?? 'heidebeke';
const investor = (process.env.INVESTOR ?? 'cooperatie') as InvestorId;

console.log(`Loonlat-meting: "beste betaalbare + alles uitbesteden", ${club}/${investor}, ${SEEDS} seeds × ${SEASONS} seizoenen`);
console.log(`\n${'seed'.padEnd(5)} ${'sz'.padEnd(3)} ${'reeks'.padEnd(20)} ${'pos'.padStart(3)} ${'eigen'.padStart(6)} ${'reeks'.padStart(6)} ${'loon/w'.padStart(8)} ${'lat/w'.padStart(8)} ${'%lat'.padStart(5)} ${'jeugd'.padStart(6)} ${'winst'.padStart(8)}`);

const perSeizoen: Record<number, { pct: number[]; delta: number[]; jeugd: number[] }> = {};
for (let seed = 1; seed <= SEEDS; seed++) {
  const rijen = speel(club, investor, seed, SEASONS);
  for (const r of rijen) {
    const pct = (r.loonWerkelijk / Math.max(1, r.loonLat)) * 100;
    (perSeizoen[r.seizoen] ??= { pct: [], delta: [], jeugd: [] }).pct.push(pct);
    perSeizoen[r.seizoen].delta.push(r.eigenSterkte - r.reeksSterkte);
    perSeizoen[r.seizoen].jeugd.push(r.jeugd / r.kern);
    console.log(
      `${String(seed).padEnd(5)} ${String(r.seizoen).padEnd(3)} ${r.reeks.padEnd(20)} ${String(r.positie).padStart(3)} ` +
        `${r.eigenSterkte.toFixed(1).padStart(6)} ${r.reeksSterkte.toFixed(1).padStart(6)} ` +
        `${Math.round(r.loonWerkelijk).toLocaleString('nl-BE').padStart(8)} ${Math.round(r.loonLat).toLocaleString('nl-BE').padStart(8)} ` +
        `${pct.toFixed(0).padStart(5)} ${`${r.jeugd}/${r.kern}`.padStart(6)} ${Math.round(r.winst / 1000).toLocaleString('nl-BE').padStart(7)}k`,
    );
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log('\nGemiddeld per seizoen over alle seeds:');
console.log(`${'sz'.padEnd(3)} ${'loon t.o.v. lat'.padStart(16)} ${'sterkte − reeks'.padStart(16)} ${'aandeel jeugd'.padStart(14)}`);
for (const [sz, d] of Object.entries(perSeizoen)) {
  console.log(`${sz.padEnd(3)} ${`${avg(d.pct).toFixed(0)}%`.padStart(16)} ${avg(d.delta).toFixed(1).padStart(16)} ${`${(avg(d.jeugd) * 100).toFixed(0)}%`.padStart(14)}`);
}
