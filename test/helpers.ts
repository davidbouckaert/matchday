import type { GameState, InvestorId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';

export function newTestGame(clubId = 'zuidrand', investor: InvestorId = 'aannemer', seed = 42): GameState {
  return createNewGame({
    avatar: { name: 'Test', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' },
    clubId,
    investor,
    seed,
  });
}

export function playWeeks(state: GameState, weeks: number): GameState {
  let s = state;
  for (let i = 0; i < weeks && !s.gameOver; i++) s = advanceWeek(s);
  return s;
}
