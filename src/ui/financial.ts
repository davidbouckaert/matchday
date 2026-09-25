import type { LedgerCategory } from '../engine/types';

/** Eén afbakening voor alle kasoverzichten; verandert nooit de boekingen zelf. */
export function cashGroup(category: LedgerCategory): 'werking' | 'investeringen' | 'transfers' | 'financiering' {
  if (category === 'infrastructuur') return 'investeringen';
  if (category === 'transfers') return 'transfers';
  if (category === 'leningen' || category === 'investeerder' || category === 'aflossingen') return 'financiering';
  return 'werking';
}

export function cashSummary(totals: Partial<Record<LedgerCategory, number>>) {
  const result = { werking: 0, investeringen: 0, transfers: 0, financiering: 0, totaal: 0 };
  for (const [category, amount] of Object.entries(totals)) {
    result[cashGroup(category as LedgerCategory)] += amount ?? 0;
    result.totaal += amount ?? 0;
  }
  return result;
}
