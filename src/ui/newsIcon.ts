// Herkent waar een nieuwsbericht over gaat aan de hand van trefwoorden in de tekst, en geeft er
// een emoji bij: geld, mensen, sport, bouw, contracten, ... zodat je in de nieuwsstroom in één
// oogopslag ziet waar een bericht over gaat. Puur voor de weergave — de motor kent dit onderscheid
// niet. Berichten die al een emoji in de tekst dragen (mijlpalen, clubrecords) krijgen er geen
// tweede bij.
const CATEGORIES: [RegExp, string][] = [
  [/diploma|opleiding/i, '🎓'],
  [/bouwproject|zonnepanelen|tribune|toeschouwers binnen/i, '🏗️'],
  [/jeugdploeg|jeugdteam|jeugdwerking|doorstromers/i, '🌱'],
  [/definitief|tekent|verlengt|verlenging|contract/i, '🖊️'],
  [/sponsor|bijdrage|akkoord|partner/i, '🤝'],
  [/geschorst|gele kaart|rode kaart/i, '🟨'],
  [/geblesseerd|blessure/i, '🤕'],
  [/kampioen|promotie|promoveert|degrad/i, '🏆'],
  [/wedstrijd|gewonnen|verloren|gelijkspel|afgelast|forfait|derby/i, '⚽'],
  [/hoofdtrainer|trainer|coach|staflid|vrijwilliger|scout/i, '👔'],
  [/gehuurd|uitgeleend|transfervrij|vertrekt naar/i, '🔁'],
  [/\bpers\b|persconferentie|interview/i, '🎤'],
  [/€|krediet|lening|schuld|begroting|\bkas\b|saldo|ticketprijs|omzet|failliet/i, '💰'],
];

/** Geeft een onderwerp-emoji voor een nieuwsbericht, of `fallback` als niets herkend wordt. */
export function newsIcon(text: string, fallback = ''): string {
  if (text.startsWith('🎉') || text.startsWith('🏅')) return '';
  for (const [pattern, icon] of CATEGORIES) if (pattern.test(text)) return icon;
  return fallback;
}
