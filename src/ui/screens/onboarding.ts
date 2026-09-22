// Startlijst: de eerste stappen voor een nieuwe eigenaar. Vinkt zichzelf af.

import type { GameState } from '../../engine/types';
import { isTransferWindow } from '../../engine/calendar';
import { TASKS, canteenDef } from '../../engine/data/catalog';
import { delegate } from '../../engine/delegation';
import { esc } from '../format';

interface Step {
  done: boolean;
  text: string;
  where: string; // naar welk scherm
  screen: string;
}

export function onboardingSteps(s: GameState): Step[] {
  return [
    {
      done: s.tactics.manualXI.length > 0 || !!delegate(s, 'opstelling'),
      text: 'Bekijk je selectie en zet je basiself vast, of laat je trainer dat doen',
      where: 'Ploeg › Selectie',
      screen: 'ploeg',
    },
    {
      done: !!delegate(s, 'tactiek') || s.tactics.plan !== 'balbezit' || s.week > 8,
      text: 'Kies een spelplan tegen je eerste tegenstander (elk plan is sterk tegen sommige en zwak tegen andere)',
      where: 'Ploeg › Strategie',
      screen: 'strategie',
    },
    {
      done: !!s.tactics.roles.kapitein,
      text: 'Duid een kapitein aan; leiders tillen de ploeg op',
      where: 'Ploeg › Selectie',
      screen: 'ploeg',
    },
    {
      done: s.staff.length > 2,
      text: 'Werf minstens één extra staflid aan (een T2 of een scout is een goede eerste stap)',
      where: 'Staff',
      screen: 'staff',
    },
    {
      done: TASKS.some((t) => !!delegate(s, t.id)),
      text: 'Besteed een taak uit: kies per taak wie ze doet',
      where: 'Staff',
      screen: 'staff',
    },
    {
      done: s.prospects.some((p) => p.approached) || s.sponsorCampaignWeeks > 0 || s.sponsorOffers.length > 0 || !!delegate(s, 'sponsoring'),
      text: 'Ga op zoek naar een extra sponsor: klop aan bij een bedrijf',
      where: 'Club › Sponsors',
      screen: 'sponsors',
    },
    {
      done: s.merch.active,
      text: 'Open je fanshop: sjaals verkopen bijna zichzelf',
      where: 'Club › Fanshop',
      screen: 'fanshop',
    },
    {
      done: s.canteen.items.some((i) => Math.abs(i.price - canteenDef(i.id).ref) > 0.01) || !!delegate(s, 'horeca') || s.canteen.concessions.length > 0,
      text: 'Zet je kantineprijzen of haal een standhouder binnen',
      where: 'Club › Horeca',
      screen: 'horeca',
    },
    {
      done: s.eventLog.length > 0 || !!delegate(s, 'evenementen'),
      text: 'Organiseer een evenement voor extra inkomsten (let op je vrijwilligers)',
      where: 'Club › Evenementen',
      screen: 'evenementen',
    },
    {
      done: s.transferList.length === 0 || s.players.some((p) => p.purchasePrice > 0) || !isTransferWindow(s.week),
      text: 'Kijk rond op de transfermarkt zolang de periode open is',
      where: 'Ploeg › Transfers',
      screen: 'transfers',
    },
  ];
}

/** Toont de eerste stappen zolang er nog iets open staat en het eerste seizoen loopt. */
export function onboardingCard(s: GameState): string {
  if (s.season > 1 || s.week > 20) return '';
  const steps = onboardingSteps(s);
  const open = steps.filter((x) => !x.done);
  if (!open.length) return '';
  const done = steps.length - open.length;
  return `<section class="card full todo">
    <h2>Eerste stappen <span class="muted small">${done}/${steps.length} klaar</span></h2>
    <p class="muted small">Een lijstje om op gang te komen. Het vinkt zichzelf af en verdwijnt vanzelf.</p>
    <ul class="todo-list">
      ${steps
        .map(
          (x) => `<li class="${x.done ? 'done' : ''}">
            <span class="box">${x.done ? '✓' : ''}</span>
            <span>${esc(x.text)}<br/><button class="link-btn small" data-action="nav" data-id="${x.screen}">${esc(x.where)} →</button></span>
          </li>`,
        )
        .join('')}
    </ul>
  </section>`;
}
