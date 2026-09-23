// Hoeveel verschillende weekmomenten zie je in een carrière van vijf seizoenen?
import { MOMENTS } from '../src/content/moments';
import { newTestGame } from '../test/helpers';
import { chooseAmbition } from '../src/engine/opening';
import { advanceWeek } from '../src/engine/turn';

const seen = new Map<string, number>();
const SEEDS = 8;
const SEASONS = 5;
for (let seed = 1; seed <= SEEDS; seed++) {
  let s = newTestGame('heidebeke', 'fonds', seed);
  for (let w = 0; w < 52 * SEASONS && !s.gameOver; w++) {
    s.cash = Math.max(s.cash, 2_000_000);
    if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
    if (s.weekChoice) seen.set(s.weekChoice.id, (seen.get(s.weekChoice.id) ?? 0) + 1);
    s = advanceWeek(s);
  }
}
const total = [...seen.values()].reduce((a, b) => a + b, 0);
console.log(`${MOMENTS.length} situaties in de data`);
console.log(`${seen.size} verschillende gezien over ${SEEDS} partijen van ${SEASONS} seizoenen (${total} momenten in totaal)`);
const nooit = MOMENTS.filter((m) => !seen.has(m.id)).map((m) => m.id);
console.log('nooit voorgekomen:', nooit.length ? nooit.join(', ') : 'geen');
const perCat: Record<string, number> = {};
for (const [id, n] of seen) {
  const cat = MOMENTS.find((m) => m.id === id)?.categorie ?? '?';
  perCat[cat] = (perCat[cat] ?? 0) + n;
}
console.log('per categorie:', perCat);
