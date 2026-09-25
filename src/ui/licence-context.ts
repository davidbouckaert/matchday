import type { GameState } from '../engine/types';
import { DIVISIONS } from '../engine/data/divisions';
import { licenceProblems } from '../engine/turn';
import { SEASON_END_WEEK } from '../engine/calendar';
import { esc } from './format';

/** Alleen een herstelplek die de ontbrekende voorwaarde werkelijk kan oplossen. */
export function licenceLinks(s: GameState, problems: string[]) {
  const links: { screen: string; label: string }[] = [];
  if (problems.some((p) => /hoofdtrainer|afgevaardigde/.test(p))) links.push({ screen: 'staff', label: 'Personeel aanwerven' });
  if (problems.some((p) => /hoofdtrainer/.test(p)) && s.staff.some((m) => m.role === 'hoofdtrainer')) links.push({ screen: 'opleiding', label: 'Diploma’s en opleiding' });
  if (problems.some((p) => /verlichting|plaatsen/.test(p))) links.push({ screen: 'infrastructuur', label: 'Infrastructuur' });
  return links;
}

export function licenceTaskContext(s: GameState): string {
  const level = s.league.divisionLevel + 1;
  if (level >= DIVISIONS.length || s.week > SEASON_END_WEEK) return '';
  const problems = licenceProblems(s, level);
  return `<section class="card licence-task"><h2>Promotielicentie · ${esc(DIVISIONS[level].name)}</h2>
    <p>${problems.length ? `Nog nodig: ${esc(problems.join('; '))}.` : 'De voorwaarden zijn nu in orde.'} Beoordeling in week ${SEASON_END_WEEK}, als je sportief promoveert.</p>
    ${s.infrastructure.constructions.length ? '<p>Er loopt een bouwproject. Een gestarte bouw voldoet pas aan de voorwaarde zodra die voltooid is.</p>' : ''}</section>`;
}
