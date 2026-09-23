import type { GameState, InvestorId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { advanceWeek } from '../src/engine/turn';
import { chooseAmbition } from '../src/engine/opening';

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

/**
 * Een partij waarin de seizoensopening al achter de rug is. Versnellen en veel andere
 * dingen wachten terecht tot je je ambitie hebt uitgesproken, dus dat doen we hier meteen.
 */
export function readyGame(clubId = 'zuidrand', investor: InvestorId = 'aannemer', seed = 42): GameState {
  const s = newTestGame(clubId, investor, seed);
  if (s.opening && !s.opening.done) chooseAmbition(s, 'bescheiden');
  return s;
}
