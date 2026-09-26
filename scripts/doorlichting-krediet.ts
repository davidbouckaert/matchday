// Zes seizoenen legaal spelen, met iedere week opnieuw een kredietdossier.
// Standaard kort; KREDIET=lang vergelijkt infrastructuurleningen.
// Vergelijk dezelfde seeds met en zonder aanvragen; geen geforceerde goedkeuringen.
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';
import { buyPlayer, delegateTask, takeLoan } from '../src/engine/actions';
import { TASKS } from '../src/engine/data/catalog';
import { answerWeekChoice } from '../src/engine/weekmoment';
import { squadBlock } from '../src/engine/players';
import { totalDebt } from '../src/engine/loans';

const krediet = process.env.KREDIET ?? 'kort';
const seeds = Number(process.env.SEEDS ?? 3);
for (const clubId of ['zuidrand', 'heidebeke']) {
  for (const lenen of [false, true]) {
    let failliet = 0, dossiers = 0, geweigerd = 0, goedgekeurd = 0, gestopt = 0, schuld = 0, kas = 0;
    const eindpunten: string[] = [];
    for (let seed = 1; seed <= seeds; seed++) {
      let s = createNewGame({ avatar: { name: 'Kredietmeting', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId, investor: 'aannemer', seed });
      for (let week = 0; week < 6 * 52 && !s.gameOver; week++) {
        if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
        if (s.weekChoice && !s.weekChoice.answer) answerWeekChoice(s, s.weekChoice.options[0].id);
        for (const task of TASKS) {
          const staff = s.staff.filter((m) => task.roles.includes(m.role)).sort((a, b) => b.skill - a.skill);
          for (const m of staff) if (delegateTask(s, task.id, m.id).ok) break;
        }
        while (squadBlock(s)) {
          const candidate = [...s.transferList].sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
          if (!candidate || !buyPlayer(s, candidate.id).ok) break;
        }
        if (squadBlock(s)) { gestopt++; break; } // ook een echte speler kan nu niet verder
        if (lenen) {
          if (takeLoan(s, krediet).ok) dossiers++;
          else geweigerd++;
        }
        const ids = new Set(s.loans.map((l) => l.id));
        s = advanceWeek(s);
        goedgekeurd += s.loans.filter((l) => !ids.has(l.id)).length;
      }
      if (s.gameOver) failliet++;
      schuld += totalDebt(s); kas += s.cash;
      eindpunten.push(`${s.season}:${s.week}${s.gameOver ? " failliet" : ""}`);
    }
    console.log(JSON.stringify({ clubId, krediet, lenen, seeds, seizoenen: 6, eindpunten, failliet, gestopt, dossiers, geweigerd, goedgekeurd, gemiddeldeSchuld: Math.round(schuld / seeds), gemiddeldeKas: Math.round(kas / seeds) }));
  }
}
