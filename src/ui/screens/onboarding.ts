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
      text: 'Werf minstens één extra personeelslid aan (een assistent-trainer of een scout is een goede eerste stap)',
      where: 'Personeel',
      screen: 'staff',
    },
    {
      done: TASKS.some((t) => !!delegate(s, t.id)),
      text: 'Besteed een taak uit: kies per taak wie ze doet',
      where: 'Personeel',
      screen: 'staff',
    },
    {
      done: s.prospects.some((p) => p.approached) || s.sponsorCampaignWeeks > 0 || s.sponsorOffers.length > 0 || !!delegate(s, 'sponsoring'),
      text: 'Ga op zoek naar een extra sponsor: klop aan bij een bedrijf',
      where: 'Geld › Sponsors',
      screen: 'sponsors',
    },
    {
      done: s.merch.active,
      text: 'Open je clubwinkel: sjaals verkopen bijna zichzelf',
      where: 'Club › Clubwinkel',
      screen: 'clubwinkel',
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

/**
 * De eerste stappen, zolang er nog iets open staat en het eerste seizoen loopt.
 *
 * Dit stond uitgeklapt bovenaan het dashboard en duwde daarmee precies de cijfers weg
 * waarvoor het dashboard bestaat. Het is nu een dichtgeklapte strook met de voortgang en
 * de eerstvolgende stap; wie de hele lijst wil, klapt ze open.
 */
export function onboardingCard(s: GameState, open = false): string {
  if (s.season > 1 || s.week > 20) return '';
  const steps = onboardingSteps(s);
  const todo = steps.filter((x) => !x.done);
  if (!todo.length) return '';
  const done = steps.length - todo.length;
  const next = todo[0];

  return `<section class="card onboard">
    <button class="onboard-head" data-action="toggle-onboard" aria-expanded="${open}">
      <span class="cap">Eerste stappen</span>
      <span class="onboard-bar"><span style="width:${Math.round((done / steps.length) * 100)}%"></span></span>
      <span class="small muted">${done}/${steps.length}</span>
      <span class="onboard-next small">${open ? '' : `Nu: ${esc(next.text)}`}</span>
      <span class="chev">${open ? '▴' : '▾'}</span>
    </button>
    ${
      open
        ? `<ul class="todo-list">
            ${steps
              .map(
                (x) => `<li class="${x.done ? 'done' : ''}">
                  <span class="box">${x.done ? '✓' : ''}</span>
                  <span>${esc(x.text)}<br/><button class="link-btn small" data-action="nav" data-id="${x.screen}">${esc(x.where)} →</button></span>
                </li>`,
              )
              .join('')}
          </ul>
          <p class="tiny muted">Het vinkt zichzelf af en verdwijnt vanzelf.</p>`
        : `<p class="actions left"><button class="ghost sm" data-action="nav" data-id="${next.screen}">${esc(next.where)} →</button></p>`
    }
  </section>`;
}
