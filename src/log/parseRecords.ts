// Herbruikbare validatie voor logregels die van buiten de motor binnenkomen (via HTTP): zowel de
// Worker in worker/index.ts als de tests gebruiken dezelfde regel voor wat een geldige LogRecord
// is. Onleesbare of gemankeerde regels vallen weg in plaats van de bestemming te laten crashen.

import type { LogRecord } from './logger';

function isLogRecord(waarde: unknown): waarde is LogRecord {
  if (typeof waarde !== 'object' || waarde === null) return false;
  const r = waarde as Record<string, unknown>;
  return typeof r.time === 'string' && typeof r.level === 'string' && typeof r.scope === 'string' && typeof r.message === 'string';
}

export function parseLogBody(body: string): LogRecord[] {
  const data: unknown = JSON.parse(body);
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).records)) return [];
  return ((data as Record<string, unknown>).records as unknown[]).filter(isLogRecord);
}
