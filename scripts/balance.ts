// Balanstest: speelt per club/investeerder een aantal seizoenen zonder in te grijpen
// en toont hoe het financieel en sportief afloopt. Gebruik: npm run balance
import type { InvestorId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';

const SEEDS = Number(process.env.SEEDS ?? 20);
const SEASONS = Number(process.env.SEASONS ?? 3);
const clubs = ['zuidrand', 'heidebeke'];
const investors: InvestorId[] = ['aannemer', 'fonds', 'cooperatie'];

console.log(`Passief spelen: ${SEEDS} spellen per combinatie, ${SEASONS} seizoenen\n`);
for (const clubId of clubs) {
  for (const investor of investors) {
    let bankrupt = 0;
    const cashPerSeason: number[][] = Array.from({ length: SEASONS }, () => []);
    const positions: number[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      let s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId, investor, seed });
      for (let season = 0; season < SEASONS && !s.gameOver; season++) {
        for (let w = 0; w < 52 && !s.gameOver; w++) s = advanceWeek(s);
        if (!s.gameOver) cashPerSeason[season].push(s.cash);
      }
      if (s.gameOver) bankrupt++;
      positions.push(...s.history.map((h) => h.position));
    }
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN);
    console.log(
      `${clubId.padEnd(10)} ${investor.padEnd(11)} failliet ${String(bankrupt).padStart(2)}/${SEEDS}` +
        `  gem. plaats ${avg(positions)}` +
        `  kas na seizoen: ${cashPerSeason.map((c) => `€${avg(c).toLocaleString('nl-BE')}`).join(' → ')}`,
    );
  }
}
