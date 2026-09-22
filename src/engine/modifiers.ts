// Overzicht van alle invloeden (vermenigvuldigers en bonussen) die op dit moment spelen.
// Wordt getoond op de tab "Invloeden". Waar mogelijk komen de cijfers uit dezelfde
// functies als de berekening zelf.

import type { GameState } from './types';
import { DIVISIONS } from './data/divisions';
import { expectedUnits, merchFactors } from './merch';
import { canteenFactors, spendPerHeadCanteen } from './canteen';
import { popularity } from './popularity';
import { OPPONENT_STAFF_BONUS } from './league';
import { INVESTORS } from './data/setup';
import {
  type Factor,
  attendanceFactors,
  avgFatigue,
  fatigueFactor,
  fatigueFactors,
  injuryFactors,
  overFatigueFactor,
  product,
  sponsorFactors,
  FATIGUE_FREE,
} from './factors';
import { devComponents, teamStrength } from './players';
import { boardSaturation } from './sponsors';
import { WEATHER_FACTOR } from './finance';
import { staffSkill } from './staff';
import { scoutingReport } from './strategy';
import { YOUTH_FEE_REF, upgradeCost, youthPriceFactor, youthTarget } from './actions';

export interface ModifierGroup {
  title: string;
  explain: string;
  factors: Factor[];
  result: string;
}

const x = (label: string, value: number, source: string): Factor => ({ label, value, kind: 'x', source });
const plus = (label: string, value: number, source: string): Factor => ({ label, value, kind: '+', source });
const r1 = (n: number) => Math.round(n * 10) / 10;

export function allModifiers(state: GameState): ModifierGroup[] {
  const groups: ModifierGroup[] = [];
  const st = teamStrength(state);
  const scout = scoutingReport(state);

  // ---------- Teamsterkte ----------
  groups.push({
    title: 'Teamsterkte',
    explain: 'Aanval = (30% middenveld + 70% aanval + bonussen) × vermoeidheid + tactiek. Verdediging idem met doel, verdediging en middenveld.',
    factors: [
      plus('Samenwerking', st.chemistry, 'spelers die elkaar liggen, leiders, lastpakken'),
      plus('Staff', st.trainer, 'T1, T2 en data-analist'),
      plus('Moraal', st.morale, 'gemiddelde moraal basiself'),
      plus('Vorm', st.form, 'recente prestaties'),
      plus('Scherpte', st.sharpness, `${state.tactics.trainings} trainingen per week`),
      plus('Spelplan past bij spelers', st.planFit, state.tactics.plan),
      ...(st.penalty ? [plus('Lege plaatsen', -st.penalty, 'te weinig spelers')] : []),
      x('Vermoeidheid', st.fatigueFactor, `gemiddeld ${st.fatigue}/100 (effect vanaf ${FATIGUE_FREE})`),
      plus('Tactiek aanval', st.tactic.att, `formatie ${state.tactics.formation}, ${state.tactics.mentality}, focus ${state.tactics.focus}`),
      plus('Tactiek verdediging', st.tactic.def, 'idem'),
    ],
    result: `Aanval ${st.attack} · verdediging ${st.defense} · totaal ${st.total}`,
  });

  if (scout) {
    const vs = teamStrength(state, { strength: scout.strength, plan: scout.knownPlan });
    groups.push({
      title: `Volgende wedstrijd: ${scout.name}`,
      explain: 'Voordeel of nadeel van je spelplan tegen het (verwachte) spelplan van de tegenstander.',
      factors: [
        plus('Spelplan aanval', vs.matchupBonus.att, `${state.tactics.plan} tegen ${scout.knownPlan}`),
        plus('Spelplan verdediging', vs.matchupBonus.def, scout.certain ? 'hun plan is zeker (analist)' : 'hun gebruikelijke plan'),
      ],
      result: `Jij A ${vs.attack} / V ${vs.defense} tegen hen A ${scout.attack} / V ${scout.defense}`,
    });
  }

  // ---------- Vermoeidheid ----------
  const fit = state.players.filter((p) => p.injuryWeeks === 0);
  groups.push({
    title: 'Vermoeidheid (per week)',
    explain: 'Nieuw = oud − natuurlijk herstel (40%) + opbouw − extra herstel. Het extra herstel komt van jouw keuzes: kinesist, verzorger, voedingsdeskundige, conditietrainer, recuperatieruimte en focus herstel.',
    factors: fatigueFactors(state),
    result: `Gemiddeld ${Math.round(avgFatigue(fit))}/100 · vermenigvuldiger op de basiself ×${fatigueFactor(st.fatigue).toFixed(3)}`,
  });

  // ---------- Toeschouwers en kantine ----------
  const c = state.community;
  const att = attendanceFactors(state);
  groups.push({
    title: 'Toeschouwers',
    explain: `Supporters (${c.fanBase}) × factoren, per wedstrijd nog × weer (zon ×${WEATHER_FACTOR.zon}, regen ×${WEATHER_FACTOR.regen}, storm ×${WEATHER_FACTOR.storm}), × derby ×1,45 en × klassement (×0,85 tot ×1,15). Plus uitsupporters, maximaal de tribune.`,
    factors: att,
    result: `Bij bewolkt weer: ~${Math.round(c.fanBase * product(att))} thuissupporters (tribune: ${state.infrastructure.capacity})`,
  });
  const spend = canteenFactors(state);
  groups.push({
    title: 'Kantine per toeschouwer',
    explain: 'Per artikel: aantal per bezoeker × onderstaande factoren × prijsgevoeligheid ((gangbare prijs / jouw prijs) tot de macht 1,2). Je verdient het verschil met de inkoopprijs.',
    factors: spend,
    result: `Winst ~€${spendPerHeadCanteen(state, 400).toFixed(2)} per toeschouwer bij je huidige prijzen`,
  });

  // ---------- Populariteit ----------
  const pop = popularity(state);
  groups.push({
    title: 'Populariteit',
    explain: 'Eén cijfer dat weegt op toeschouwers, kantine, concessies, fanshop, wat mensen voor een shirt betalen en hoeveel jeugdspelers zich inschrijven.',
    factors: pop.parts,
    result: `Score ${Math.round(pop.score)}/100 → ×${pop.factor.toFixed(3)} op je inkomsten`,
  });

  // ---------- Sponsoring ----------
  const sp = sponsorFactors(state);
  const sat = boardSaturation(state);
  groups.push({
    title: 'Sponsoring',
    explain: 'Elk sponsorbedrag (nieuw of verlengd) = basisbedrag van het type × factoren. Voor reclameborden geldt ook de verzadiging van de lokale markt.',
    factors: [...sp, x('Verzadiging borden', sat, `${state.sponsors.filter((s) => s.kind === 'bord').length} borden hangen al (enkel voor borden)`)],
    result: `×${product(sp).toFixed(2)} op alle sponsorbedragen (borden ×${(product(sp) * sat).toFixed(2)})`,
  });

  // ---------- Blessures ----------
  const inj = injuryFactors(state);
  groups.push({
    title: 'Blessurerisico',
    explain: 'Basisrisico per gespeelde wedstrijd 3,5% (+1,5% boven 30 jaar, +1,5% feestbeest) × factoren × vermoeidheid (×(1 + vermoeidheid/100), boven 60 nog eens extra). Boven 50 vermoeidheid kunnen spelers ook op training geblesseerd raken. De kinesist werkt preventief (hier) én herstellend (kans op een week sneller genezen).',
    factors: [...inj, x('Vermoeidheid', overFatigueFactor(avgFatigue(fit)), 'gemiddeld over de selectie')],
    result: `×${(product(inj) * overFatigueFactor(avgFatigue(fit))).toFixed(2)} op het blessurerisico`,
  });

  // ---------- Ontwikkeling ----------
  const dc = devComponents(state);
  groups.push({
    title: 'Ontwikkeling van spelers (per maand)',
    explain: 'Jonge spelers groeien naar hun potentieel, oudere gaan achteruit. Karakter telt mee: harde werker en professioneel ×1,3, feestbeest ×0,7.',
    factors: [
      x('Hoofdtrainer', dc.trainer, 'hoe beter de T1, hoe sneller (op opleiding: telt niet)'),
      x('Trainingen', dc.trainings, `${state.tactics.trainings} per week`),
      plus('Assistent (T2)', r1(dc.assistant * 100) / 100, 'extra voor spelers t/m 23 jaar'),
      plus('Opleidingscentrum', dc.academy, 'extra voor spelers t/m 21 jaar'),
      plus('Keepertrainer', r1(dc.keeperCoach * 100) / 100, 'extra voor doelmannen'),
      plus('Conditietrainer', r1(dc.fitness * 100) / 100, 'fysiek per maand'),
    ],
    result: `Groeifactor jonge veldspeler: ${(dc.trainer * dc.trainings + dc.assistant + dc.academy).toFixed(2)}`,
  });

  // ---------- Jeugd ----------
  const coord = staffSkill(state, 'jeugdcoordinator');
  const priceF = youthPriceFactor(state.youthFee);
  groups.push({
    title: 'Jeugdleden',
    explain: 'Het aantal leden schuift elk seizoen (inschrijvingen in week 10) half op naar dit niveau.',
    factors: [
      plus('Basis', 150, 'elke club'),
      plus('Reputatie', Math.round(c.reputation * 2), `reputatie ${Math.round(c.reputation)}`),
      plus('Jeugdcoördinator', Math.round(coord * 1.5), coord ? `vaardigheid ${Math.round(coord)}` : 'geen'),
      plus('Opleidingscentrum', state.infrastructure.academyLevel * 40, `niveau ${state.infrastructure.academyLevel}`),
      x('Lidgeld', priceF, `€${state.youthFee} (gangbaar €${YOUTH_FEE_REF})`),
    ],
    result: `Op termijn ~${youthTarget(state)} leden (nu ${c.youthMembers})`,
  });

  // ---------- Vrijwilligers ----------
  groups.push({
    title: 'Vrijwilligers',
    explain: 'Vrijwilligers bepalen welke evenementen kunnen doorgaan en hoe goed de kantine draait.',
    factors: [
      plus('Kans dat er iemand afhaakt (% per week)', c.volunteerLoyaltyWeeks > 0 ? 1.2 : 3, c.volunteerLoyaltyWeeks > 0 ? `verlaagd door het vrijwilligersfeest, nog ${c.volunteerLoyaltyWeeks} weken` : 'normaal (een vrijwilligersfeest verlaagt dit)'),
      ...(state.investor === 'cooperatie' ? [x('Startbonus coöperatie', 1.4, 'investeerder (bij de start)')] : []),
      ...(state.avatar.background === 'lokaal' ? [x('Startbonus lokale figuur', 1.3, 'achtergrond (bij de start)')] : []),
    ],
    result: `${c.volunteers} vrijwilligers`,
  });

  // ---------- Investeerder en achtergrond ----------
  const inv = INVESTORS.find((i) => i.id === state.investor)!;
  const fixed: Factor[] = [];
  if (state.investor === 'aannemer' && state.investorActive) {
    fixed.push(x('Bouwkosten', 0.85, inv.name));
    fixed.push(plus('Stadionnaam (€/week)', 600, inv.name));
  }
  if (state.investor === 'fonds' && state.investorActive) fixed.push(x('Transferwinst die je houdt', 0.7, '30% gaat naar het fonds'));
  if (state.investor === 'cooperatie') {
    fixed.push(x('Supporters (start)', 1.15, inv.name));
    fixed.push(x('Sfeerverlies na nederlaag', 0.5, 'leden vergeven sneller'));
  }
  if (state.avatar.background === 'exspeler') {
    fixed.push(plus('Moraal spelers (basisniveau)', 5, 'achtergrond: ex-speler'));
    fixed.push(x('Lonen bij aanwerving en verlenging', 0.95, 'achtergrond: ex-speler'));
  }
  if (state.avatar.background === 'ondernemer') fixed.push(x('Sponsorbedragen', 1.15, 'achtergrond: ondernemer'));
  groups.push({
    title: 'Investeerder en achtergrond',
    explain: 'Vaste effecten van je keuzes bij de start.',
    factors: fixed,
    result: `Voorbeeld: tribune uitbreiden kost €${upgradeCost(state, 'tribune').toLocaleString('nl-BE')}`,
  });

  // ---------- Fanshop ----------
  if (state.merch.active) {
    const units = state.merch.items.reduce((sum, i) => sum + expectedUnits(state, i), 0);
    groups.push({
      title: 'Fanshop',
      explain: 'Verkoop per artikel = supporters × aantrekkelijkheid van het artikel × onderstaande factoren × prijsgevoeligheid ((richtprijs / jouw prijs) tot de macht 1,5).',
      factors: merchFactors(state),
      result: `Verwacht deze week: ${Math.round(units)} artikelen`,
    });
  }

  // ---------- Reeks ----------
  const d = DIVISIONS[state.league.divisionLevel];
  groups.push({
    title: `Reeks: ${d.name}`,
    explain: 'Wat het niveau van je competitie met zich meebrengt.',
    factors: [
      plus('Gemiddelde tegenstander', d.opponentStrength + OPPONENT_STAFF_BONUS, `basis ${d.opponentStrength} + ${OPPONENT_STAFF_BONUS} voor hun eigen staff en sfeer`),
      plus('Normale ticketprijs (€)', d.refTicketPrice, ''),
      x('Sponsoring', d.sponsorFactor, ''),
      plus('Tv- en radiorechten (€/week)', d.tvRightsPerWeek, ''),
    ],
    result: `Licentie: ${d.requiredDiploma}, verlichting ${d.requiredLighting}, ${d.requiredCapacity} plaatsen`,
  });

  return groups;
}
