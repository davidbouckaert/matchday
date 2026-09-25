import type { GameState } from '../engine/types';

/** Eén tijdelijke oorsprong van een taak, geen navigatiegeschiedenis of save-data. */
export interface TaskOrigin {
  screen: string;
  label: string;
  entity?: string;
  licenceOpen?: boolean;
  focus: string | null;
  scroll: number;
  week: number;
  season: number;
}

export function validOrigin(origin: TaskOrigin | null, game: GameState | null): origin is TaskOrigin {
  return !!origin && !!game && origin.week === game.week && origin.season === game.season
    && (!origin.entity || game.players.some((p) => p.id === origin.entity));
}

export function taskDetour(origin: TaskOrigin | null, source: TaskOrigin): TaskOrigin {
  return origin ?? source;
}
