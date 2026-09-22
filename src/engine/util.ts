import type { GameState, LedgerCategory, LogEntry, NewsItem } from './types';

export function nextId(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}${state.idCounter}`;
}

/** Boekt een inkomst (positief) of kost (negatief) en past het saldo aan. */
export function book(state: GameState, category: LedgerCategory, amount: number, label: string): void {
  const rounded = Math.round(amount);
  if (rounded === 0) return;
  state.cash += rounded;
  state.thisWeek.push({ category, amount: rounded, label });
  state.seasonTotals[category] = (state.seasonTotals[category] ?? 0) + rounded;
}

export function addNews(state: GameState, tone: NewsItem['tone'], text: string): void {
  state.news.unshift({ week: state.week, season: state.season, tone, text });
  if (state.news.length > 60) state.news.length = 60;
}

export function weeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weken'}`;
}

export function euro(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}€${Math.abs(Math.round(amount)).toLocaleString('nl-BE')}`;
}

/** Zet een beslissing of een antwoord in het logboek op de tab Overzicht. */
export function addLog(state: GameState, kind: LogEntry['kind'], text: string): void {
  state.log.unshift({ season: state.season, week: state.week, kind, text });
  if (state.log.length > 120) state.log.length = 120;
}
