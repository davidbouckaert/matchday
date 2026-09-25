import { licenceLinks } from './licence-context';
import { licenceProblems } from '../engine/turn';
import { DIVISIONS } from '../engine/data/divisions';
import { OWN_TEAM_ID, ownPosition, zoneAt } from '../engine/league';
import type { GameState } from '../engine/types';
import { available } from '../engine/discipline';
import { lineupGap, squadBlock } from '../engine/players';
import { WEEKS_PER_YEAR, LICENCE_AUDIT_WEEK, SEASON_END_WEEK, WINTER_BREAK, inWinterBreak, isTransferWindow } from '../engine/calendar';
import { weeks } from '../engine/util';
import { esc } from './format';

export interface Todo {
  relatedScreens?: string[];
  label?: string;
  remaining?: number;
  soort: 'actie' | 'deadline' | 'wachten' | 'informatie';
  text: string;
  detail?: string;
  screen: string;
  where: string;
  level: 'urgent' | 'warn' | 'info';
}

export function todos(s: GameState): Todo[] {
  const list: Todo[] = [];
  const add = (level: Todo['level'], text: string, screen: string, where: string, detail?: string, soort: Todo['soort'] = 'actie') =>
    list.push({ text, detail, screen, where, level, soort });

  const avail = available(s.players).length;
  const blocked = speelBlokkade(s);
  if (blocked) {
    add('urgent', 'Je kunt de week nog niet spelen', 'ploeg', 'Selectie', blocked);
    list.at(-1)!.label = 'Geblokkeerd';
  } else if (avail < 13) add('warn', `Nog ${avail} speelklare spelers`, 'ploeg', 'Selectie', 'Weinig reserve voor blessures of schorsingen. Met minder dan elf speelklare spelers kun je de week niet spelen.');
  if (s.cash < 0 && !s.gameOver) {
    const remaining = Math.max(0, 8 - s.weeksNegative);
    add(remaining <= 2 ? 'urgent' : 'warn', 'Je saldo staat onder nul', 'financien', 'Financiën', `${s.weeksNegative} van 8 controles onder nul. Bij aanhoudend tekort volgt faillissement na nog ${remaining} ${remaining === 1 ? 'weekcontrole' : 'weekcontroles'}. Bekijk je inkomsten, uitgaven en financiering.`);
    list.at(-1)!.label = remaining <= 2 ? 'Kritiek' : 'Let op';
    list.at(-1)!.remaining = remaining;
  }
  if (s.emergencyLoanOffered) add('info', 'De bank biedt een noodlening aan', 'financien', 'Financiën', 'Duur geld, maar het houdt de deuren open.');
  if (s.playerOffers.length) {
    add('info', s.playerOffers.length === 1 ? 'Er ligt een bod op een van je spelers' : `Er liggen ${s.playerOffers.length} biedingen op je spelers`, 'transfers', 'Transfers', `Nog ${weeks(Math.min(...s.playerOffers.map((o) => o.expiresInWeeks)))} om te beslissen; daarna vervalt het bod bij het spelen van de week.`, 'deadline');
    const remaining = Math.min(...s.playerOffers.map((o) => o.expiresInWeeks));
    Object.assign(list.at(-1)!, { remaining, ...deadlineState(remaining) });
  }
  if (s.sponsorOffers.length) {
    add('info', s.sponsorOffers.length === 1 ? 'Er is een nieuw sponsoraanbod' : `Er zijn ${s.sponsorOffers.length} sponsoraanbiedingen`, 'sponsors', 'Sponsors', `Nog ${weeks(Math.min(...s.sponsorOffers.map((o) => o.expiresInWeeks)))} om te beslissen; daarna vervalt het voorstel bij het spelen van de week.`, 'deadline');
    const remaining = Math.min(...s.sponsorOffers.map((o) => o.expiresInWeeks));
    Object.assign(list.at(-1)!, { remaining, ...deadlineState(remaining) });
  }
  const expiring = s.players.filter((p) => p.contractUntil <= s.season && p.loan?.type !== 'in' && !p.nietVerlengen).length;
  if (expiring && s.week > 30) {
    const remaining = WEEKS_PER_YEAR - s.week + 1;
    add(remaining <= 2 ? 'warn' : 'info', `${expiring} ${expiring === 1 ? 'contract loopt' : 'contracten lopen'} af`, 'contracten', 'Contracten', `Verleng vóór het nieuwe seizoen, na week ${WEEKS_PER_YEAR} (nog ${weeks(remaining)}). Wie je niet verlengt, vertrekt gratis.`, 'deadline');
    Object.assign(list.at(-1)!, { remaining, ...deadlineState(remaining) });
  }
  const currentLicence = licenceProblems(s, s.league.divisionLevel);
  const level = s.league.divisionLevel;
  const zone = zoneAt(s.league, ownPosition(s.league), level, DIVISIONS.length);
  const played = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)?.played ?? 0;
  const promotionLicence = level < DIVISIONS.length - 1 && played >= 10 && (zone === 'kampioen' || zone === 'promotie') && s.week <= SEASON_END_WEEK ? licenceProblems(s, level + 1) : [];
  if ((currentLicence.length && s.week <= LICENCE_AUDIT_WEEK) || promotionLicence.length) {
    const audit = currentLicence.length > 0 && s.week <= LICENCE_AUDIT_WEEK;
    const remaining = (audit ? LICENCE_AUDIT_WEEK : SEASON_END_WEEK) - s.week + 1;
    const problems = audit ? currentLicence : promotionLicence;
    add('warn', audit ? 'Je licentie is nog niet in orde' : 'Je promotielicentie is nog niet in orde', 'competitie', 'Stand en tucht',
      `Ontbreekt: ${problems.join(', ')}. ${audit ? `Controle in week ${LICENCE_AUDIT_WEEK}: tekortkomingen leveren een boete op.` : `Beoordeling in week ${SEASON_END_WEEK}: zonder licentie gaat sportieve promotie niet door.`} Regel personeel bij Personeel/Opleiding en accommodatie bij Infrastructuur.`, 'deadline');
    Object.assign(list.at(-1)!, { remaining, label: remaining <= 1 ? 'Deze week' : 'Let op', relatedScreens: licenceLinks(s, problems).map((link) => link.screen) });
  }
  for (const r of s.requests.filter((r) => r.kind !== 'subsidie')) add('info', r.label, 'doelen', 'Logboek', `Antwoord over ${weeks(r.weeksLeft)}.`, 'wachten');
  if (isTransferWindow(s.week)) add('info', 'De transferperiode is open', 'transfers', 'Transfers', 'Alleen nu kun je kopen, verkopen of uitlenen.', 'informatie');
  if (inWinterBreak(s.week)) add('info', `Winterstop tot week ${WINTER_BREAK.to + 1}`, 'kalender', 'Kalender', 'Geen wedstrijdinkomsten, wel vaste kosten.', 'informatie');
  return list;
}

/** Eén semantische bron voor Bureau en speelbalk; hulp en wachten zijn geen werk. */
export function bureauStatus(s: GameState) {
  const list = todos(s);
  const acties = list.filter((t) => t.soort === 'actie' || t.soort === 'deadline');
  const rang = { urgent: 0, warn: 1, info: 2 };
  acties.sort((a, b) => Number(b.label === 'Geblokkeerd') - Number(a.label === 'Geblokkeerd') || rang[a.level] - rang[b.level] || (a.remaining ?? Infinity) - (b.remaining ?? Infinity));
  return { acties, wachten: list.filter((t) => t.soort === 'wachten'),
    informatie: list.filter((t) => t.soort === 'informatie'),
    count: acties.length + (s.weekChoice && !s.weekChoice.answer ? 1 : 0),
    urgent: acties.some((t) => t.level === 'urgent') };
}

export function speelBlokkade(g: GameState): string {
  const gap = lineupGap(g);
  const ZONES: Record<string, string> = { DOEL: 'doel', VERD: 'verdediging', MIDD: 'middenveld', AANV: 'aanval' };
  const openLines = Object.entries(g.tactics.gaps ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([pos, n]) => `${n}× ${ZONES[pos] ?? pos}`);
  return (
    squadBlock(g) ??
    (gap.available < 11
      ? `Je kunt geen elf opstellen: nog maar ${gap.available} speelklare spelers. Ga naar Ploeg › Selectie en haal spelers bij Transfers.`
      : openLines.length
        ? `Je liet plaatsen open in je basiself (${openLines.join(', ')}). Ga naar Ploeg › Selectie. Staat Opstelling uitbesteed, kies daar eerst Jij. Open daarna de lege plaats op het veld en kies een speler.`
        : '')
  );
}

/** Dezelfde tekst en ernst op Bureau, navigatie en het betrokken domein. */
export function signalBadge(t: Todo): string {
  const label = t.label ?? (t.level === 'urgent' ? 'Kritiek' : t.level === 'warn' ? 'Let op' : t.soort === 'deadline' ? 'Deadline' : '');
  return label ? `<span class="signal-badge signal-${t.level}">${esc(label)}</span>` : '';
}

export function navigationSignal(list: Todo[]): string {
  const important = list.filter((t) => t.level !== 'info');
  if (!important.length) return '';
  const urgent = important.some((t) => t.level === 'urgent');
  const description = important.map((t) => `${t.label ?? 'Let op'}: ${t.text}. ${t.detail ?? ''} Ga naar ${t.where}.`).join(' ');
  return `<span class="signal-badge signal-${urgent ? 'urgent' : 'warn'}" title="${esc(description)}"><span aria-hidden="true">${urgent ? '!' : '△'} ${important.length}</span><span class="sr-only">${important.length} ${important.length === 1 ? 'aandachtspunt' : 'aandachtspunten'}${urgent ? ', kritiek probleem of blokkade' : ', let op'}</span></span>`;
}

export function domainSignals(list: Todo[], screen: string): string {
  const relevant = list.filter((t) => (t.screen === screen || t.relatedScreens?.includes(screen)) && t.level !== 'info');
  if (!relevant.length) return '';
  return `<section class="card domain-signals" aria-label="Aandacht op dit scherm"><ul class="worklist">${relevant.map((t) => `<li class="${t.level}"><span class="what">${signalBadge(t)} <strong>${esc(t.text)}</strong><span class="sub-line">${esc(t.detail ?? '')}</span><span class="sub-line">${t.screen === screen ? `Te regelen bij ${esc(t.where)} op dit scherm.` : `Bekijk de voorwaarden bij ${esc(t.where)}.`}</span></span>${t.screen !== screen ? `<button class="sm" data-action="nav" data-id="${t.screen}">${esc(t.where)} →</button>` : ''}</li>`).join('')}</ul></section>`;
}

export function deadlineBadge(remaining: number): string {
  return signalBadge({ soort: 'deadline', text: '', screen: '', where: '', ...deadlineState(remaining) });
}

function deadlineState(remaining: number): Pick<Todo, 'level' | 'label'> {
  return { level: remaining <= 2 ? 'warn' : 'info', label: remaining <= 1 ? 'Deze week' : remaining <= 2 ? 'Binnenkort' : 'Deadline' };
}
