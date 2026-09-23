import { newTestGame, playWeeks } from '../test/helpers';
import { clubsAtLevel } from '../src/engine/world';
import { DIVISIONS } from '../src/engine/data/divisions';

let s = newTestGame('heidebeke', 'fonds', 11);
const seen: Record<string, number> = {};
for (let season = 1; season <= 20; season++) {
  s.cash = Math.max(s.cash, 3_000_000); // we willen de wereld zien, niet failliet gaan
  s = playWeeks(s, 52);
  for (const m of s.lastWorldMoves) seen[m.move] = (seen[m.move] ?? 0) + 1;
  if (s.gameOver) break;
}
console.log('seizoen', s.season, '| zetten in jouw reeks:', seen);
for (let l = 0; l < DIVISIONS.length; l++) {
  const cs = clubsAtLevel(s.world, l);
  const str = cs.map((c) => c.strength);
  console.log(
    DIVISIONS[l].name.padEnd(20), 'n', String(cs.length).padStart(2),
    'sterkte', (str.reduce((a, b) => a + b, 0) / str.length).toFixed(1),
    '[' + Math.min(...str).toFixed(1) + '-' + Math.max(...str).toFixed(1) + ']',
    'in nood', cs.filter((c) => c.trouble >= 70).length,
  );
}
console.log('opgedoekt:', s.world.clubs.filter((c) => c.defunct).map((c) => c.name).join(', ') || 'geen');
const top = [...s.world.clubs].sort((a, b) => b.strength - a.strength)[0];
console.log('sterkste club:', top.name, top.strength, 'stadion', top.stadium, 'jeugd', top.youth, 'ambitie', top.ambition);
