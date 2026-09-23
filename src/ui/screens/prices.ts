// Wat mensen aan je club betalen.
//
// Deze drie beslissingen stonden verspreid over het spel: de ticketprijs halverwege een
// scherm met tien andere kaarten, de abonnementen bovenaan datzelfde scherm, en het
// jeugdlidgeld ergens onder Clubinfo tussen je clubgeschiedenis en je kerncijfers. Wie
// zijn ticketprijs wilde aanpassen, moest onthouden waar hij stond.
//
// Het zijn nochtans dezelfde soort beslissing: jij zet een prijs, iemand anders beslist of
// hij die betaalt, en dat bepaalt drie van je vier grootste inkomsten. Daarom staan ze hier
// bij elkaar, met bij elk hetzelfde: wat het nu opbrengt, en wat er gebeurt als je schuift.

import type { GameState } from '../../engine/types';
import { DIVISIONS } from '../../engine/data/divisions';
import { AWAY_SHARE, expectedAttendance } from '../../engine/finance';
import { spendPerHeadCanteen } from '../../engine/canteen';
import { YOUTH_FEE_WEEK, maxYouthFee, youthFeeGrumble, youthFeeRef, youthForecast, youthTarget } from '../../engine/actions';
import * as seasonTickets from '../../engine/seasontickets';
import { delegate } from '../../engine/delegation';
import { esc, euro, signedEuro } from '../format';
import { numField } from '../numfield';
import { taskPicker } from '../taskpicker';
import { hint } from '../tooltip';

/** De regel die live meerekent terwijl je aan de schuifregelaar sleept. */
export function subscriptionInfo(s: GameState, price: number): string {
  const st = seasonTickets;
  const full = st.fullPrice(s);
  const sold = st.expectedSales(s, price);
  const revenue = st.expectedRevenue(s, price);
  const gate = st.forgoneGate(s, price);
  const net = revenue - gate;
  const discount = Math.round((1 - price / Math.max(1, full)) * 100);
  if (!sold) return `<strong>${euro(price)} per abonnement</strong> · ${discount > 0 ? `${discount}% korting` : 'geen korting'} — aan die prijs tekent niemand.`;
  return `<strong>${euro(price)} per abonnement</strong> · ${discount}% korting · naar schatting <strong>${sold}</strong> verkocht
    · <strong class="pos">${euro(revenue)}</strong> ineens in kas
    <span class="muted">(die mensen waren aan de kassa ongeveer ${euro(gate)} waard geweest: ${net >= 0 ? 'dat is' : 'dat kost je'} <strong class="${net < 0 ? 'neg' : 'pos'}">${signedEuro(net)}</strong>)</span>`;
}

/** Wat een supporter aan de kassa betaalt. Je grootste knop op de opkomst. */
function ticketCard(s: GameState): string {
  const division = DIVISIONS[s.league.divisionLevel];
  const ticketer = delegate(s, 'ticketing');
  const attendance = expectedAttendance(s, { weather: 'bewolkt', derby: false, positionFactor: 1 });

  return `<section class="card">
    <h2>Ticketprijs ${hint('Wat een supporter aan de kassa betaalt voor één wedstrijd. Hoger levert per ticket meer op, maar er komt minder volk — en minder volk betekent ook minder kantine en minder sfeer.')}</h2>
    ${
      ticketer
        ? `<p class="lock-note small">🔒 ${esc(ticketer.name)} bepaalt de ticketprijs: nu €${s.ticketPrice}.</p>`
        : `<div class="inline-form">
      <label>Prijs per ticket
        ${numField({ value: s.ticketPrice, min: 0, max: 100, step: 1, prefix: '€', change: 'ticket-price', inputId: 'ticket-price', label: 'Ticketprijs', slider: true, extra: 'narrow' })}
      </label>
      <span class="muted small">wordt meteen toegepast</span>
    </div>`
    }
    <div class="price-facts">
      <span class="pc-fact"><span class="cap">Gewoon in ${esc(division.name)}</span><strong>€${division.refTicketPrice}</strong></span>
      <span class="pc-fact"><span class="cap">Verwachte opkomst</span><strong>~${attendance}</strong><span class="unit"> van ${s.infrastructure.capacity} plaatsen</span></span>
      <span class="pc-fact"><span class="cap">Kantine per bezoeker</span><strong>~€${spendPerHeadCanteen(s, 400).toFixed(2)}</strong></span>
      <span class="pc-fact"><span class="cap">Naar de bezoekers en de bond</span><strong>${Math.round(AWAY_SHARE * 100)}%</strong></span>
    </div>
    <p class="muted small">Van elke euro aan de kassa gaat ${Math.round(AWAY_SHARE * 100)}% naar de bezoekende club en de bond; dat staat apart bij wedstrijdkosten.
    Wat mensen in de kantine uitgeven, zet je bij Club › Horeca. Een hoge prijs levert per ticket meer op, maar schrikt supporters af en drukt de sfeer.</p>
  </section>`;
}

/**
 * Abonnementen: de enige beslissing die je een heel seizoen vastzet. Geld nu, en die mensen
 * betalen daarna niet meer aan de kassa — ook niet als je je ticketprijs verhoogt.
 */
function subscriptionsCard(s: GameState): string {
  const st = seasonTickets;
  const current = s.seasonTickets && s.seasonTickets.season === s.season ? s.seasonTickets : null;
  const check = st.canSell(s);
  const full = st.fullPrice(s);

  if (current) {
    const out = st.outcome(s)!;
    return `<section class="card">
      <h2>Abonnementen ${hint('Eén keer per seizoen, voor de competitie start. Abonnees betalen vooraf en daarna niet meer aan de kassa — ook niet als je je ticketprijs verhoogt.')}</h2>
      <p>Dit seizoen: <strong>${current.sold} abonnementen</strong> aan ${euro(current.price)}, samen <strong class="pos">${euro(current.revenue)}</strong>, meteen ontvangen.</p>
      <p class="muted small">Aan de kassa zouden diezelfde mensen ongeveer ${euro(out.gate)} waard geweest zijn
        (${out.diff >= 0 ? 'je staat er dus' : 'je geeft dus'} <strong class="${out.diff < 0 ? 'neg' : 'pos'}">${signedEuro(out.diff)}</strong> ${out.diff >= 0 ? 'beter voor' : 'op'} — maar je had het geld wel meteen,
        en zij komen ook als het regent).</p>
      <p class="muted small">Volgend seizoen kun je opnieuw een campagne voeren.</p>
    </section>`;
  }

  if (!check.ok) {
    return `<section class="card">
      <h2>Abonnementen ${hint('Abonnementen verkoop je voor de competitie start. Abonnees betalen vooraf en daarna niet meer aan de kassa.')}</h2>
      <p class="muted">${esc(check.reason)}</p>
    </section>`;
  }

  const price = Math.round(st.suggestedPrice(s));
  return `<section class="card subs">
    <h2>Abonnementen ${hint('Eén keer per seizoen, voor de competitie start. Het geld komt meteen binnen, maar die mensen betalen daarna niet meer aan de kassa — ook niet als je je ticketprijs verhoogt.')}</h2>
    <p class="muted small">Los betalen kost een supporter ${euro(full)} over ${st.HOME_MATCHES} thuiswedstrijden (${euro(s.ticketPrice)} per match),
      maar niemand komt vijftien keer — reken op ongeveer ${Math.round(st.TYPICAL_ATTENDANCE_RATE * 100)}%. Zonder korting tekent er dus niemand.</p>
    <p class="muted small">Een abonnement doet drie dingen. <strong>Je krijgt het geld nu</strong>, in plaats van match na match.
      <strong>Die mensen betalen daarna niet meer aan de kassa</strong> — ook niet als je in week 20 je ticketprijs verhoogt.
      En <strong>ze komen trouwer</strong>: ze hebben al betaald, dus regen houdt ze minder tegen. Dat laatste is meer waard dan het lijkt,
      want elke supporter op de tribune drinkt en eet ook iets.</p>
    <p class="muted small">De prijs bepaalt welke van die drie je het zwaarst laat wegen. Scherp geprijsd tekenen er veel meer mensen en
      haal je het meeste cash op, maar per abonnee hou je minder over dan wat hij aan de kassa waard was. Een bescheiden korting brengt
      minder binnen maar is over het jaar voordeliger. Wat je hier beslist, ligt vast tot het einde van het seizoen.</p>
    <div class="slider-row">
      <input type="range" id="subs-price" min="${st.floorPrice(s)}" max="${Math.max(st.floorPrice(s) + 10, Math.round(full * 1.05))}" step="5" value="${price}" data-live="subs" aria-label="Prijs per abonnement"/>
      <button class="primary" data-action="sell-subs">Campagne voeren</button>
    </div>
    <p id="subs-info" class="tribune-info">${subscriptionInfo(s, price)}</p>
  </section>`;
}

/** Wat ouders per seizoen betalen om hun kind bij jou te laten voetballen. */
function youthFeeCard(s: GameState): string {
  const jeugd = delegate(s, 'jeugd');
  const ref = youthFeeRef(s);
  const max = maxYouthFee(s);

  // Een handvol prijzen rond het gangbare bedrag, plus die van jezelf. De stappen volgen de
  // reeks waar je in speelt: in de Pro Liga hebben stappen van €40 geen zin meer.
  const stap = Math.round((ref * 0.35) / 10) * 10;
  const keuzes = [...new Set([ref - stap * 2, ref - stap, ref, ref + stap, ref + stap * 2, ref + stap * 3, s.youthFee])]
    .filter((f) => f >= 0 && f <= max)
    .sort((a, b) => a - b);
  // Twee toppen, en dat is precies de les: de prijs die volgend seizoen het meeste opbrengt
  // ligt hoger dan de prijs die op termijn het meeste opbrengt. Wie de eerste kiest, cashet
  // één jaar en zakt daarna door. Allebei aanduiden, maar alleen als ze verschillen.
  const besteLang = keuzes.reduce((a, f) => (youthTarget(s, f) * f > youthTarget(s, a) * a ? f : a), keuzes[0]);
  const besteKort = keuzes.reduce((a, f) => (youthForecast(s, f) * f > youthForecast(s, a) * a ? f : a), keuzes[0]);

  return `<section class="card">
    <h2>Lidgeld jeugd ${hint('Wat ouders per seizoen betalen om hun kind bij jou te laten voetballen. Meer leden betekent meer lidgeld, meer subsidie, meer volk in de kantine en meer talent — maar ook meer werkingskosten en meer vrijwilligers.')}</h2>
    ${
      jeugd
        ? `<p class="lock-note small">🔒 ${esc(jeugd.name)} bepaalt het lidgeld: nu €${s.youthFee} per seizoen.</p>`
        : `<div class="inline-form">
      <label>Lidgeld per seizoen
        ${numField({ value: s.youthFee, min: 0, max, step: 10, prefix: '€', change: 'youth-fee', inputId: 'youth-fee', label: 'Lidgeld jeugd', slider: true, extra: 'narrow' })}
      </label>
      <span class="muted small">wordt meteen toegepast</span>
    </div>`
    }
    <div class="price-facts">
      <span class="pc-fact"><span class="cap">Gewoon op dit niveau</span><strong>€${ref}</strong></span>
      <span class="pc-fact"><span class="cap">Verwacht aantal leden</span><strong>~${youthForecast(s)}</strong></span>
      <span class="pc-fact"><span class="cap">Brengt op</span><strong>${euro(youthForecast(s) * s.youthFee)}</strong></span>
      <span class="pc-fact"><span class="cap">Inschrijvingen in</span><strong>week ${YOUTH_FEE_WEEK}</strong></span>
    </div>
    <div class="table-wrap"><table class="compact">
      <thead><tr>
        <th>Lidgeld</th>
        <th class="num" data-tip="Wat je volgend jaar aan inschrijvingen mag verwachten. Het echte aantal wijkt daar altijd wat van af.">Leden volgend seizoen</th>
        <th class="num">Brengt op</th>
        <th class="num" data-tip="Waar het ledenaantal na een paar seizoenen uitkomt als je deze prijs aanhoudt">Leden op termijn</th>
        <th class="num">Brengt dan op</th>
      </tr></thead>
      <tbody>${keuzes
        .map(
          (fee) => `<tr class="${fee === s.youthFee ? 'own' : ''}"><td>€${fee}${
            fee === besteLang ? ' <span class="tag" data-tip="Bij deze prijs brengt je jeugdwerking op lange termijn het meeste op.">beste op termijn</span>' : ''
          }${
            fee === besteKort && besteKort !== besteLang
              ? ' <span class="tag" data-tip="Volgend seizoen levert dit het meeste op, omdat de helft van je huidige leden nog blijft. Het jaar daarna zak je door.">meeste volgend seizoen</span>'
              : ''
          }</td>
            <td class="num">${youthForecast(s, fee)}</td><td class="num">${euro(youthForecast(s, fee) * fee)}</td>
            <td class="num">${youthTarget(s, fee)}</td><td class="num">${euro(youthTarget(s, fee) * fee)}</td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <p class="muted small">Het aantal leden schuift elk seizoen maar half op naar waar het uiteindelijk uitkomt: een prijsverhoging lijkt het eerste jaar voordeliger dan ze is, want de ouders haken pas geleidelijk af.</p>
    <p class="muted small">Er zit een top in die tabel, en die ligt iets boven het gangbare bedrag. Vraag je minder, dan komen er meer kinderen maar houd je per kind te weinig over.
    Vraag je veel meer, dan gaan ze naar de club in het dorp ernaast — en hoe verder je erboven zit, hoe sneller dat gaat. Boven €${youthFeeGrumble(s)} morren je supporters er ook over.</p>
    <p class="muted small">Meer leden is niet alleen opbrengst: het geeft ook meer subsidie, meer volk in de kantine en meer talent voor je eigen ploeg — maar het kost je €3 per lid per week aan werking, en elke jeugdploeg houdt twee vrijwilligers bezig. Hoeveel ploegen je kwijt kunt, staat bij Club › Clubinfo.</p>
  </section>`;
}

/**
 * De drie prijzen die je zelf zet, op één scherm.
 *
 * Bovenaan de twee die over de wedstrijddag gaan — los ticket of abonnement, en dat is
 * dezelfde supporter die je twee keer kunt laten betalen of één keer. Daaronder het
 * lidgeld, dat een heel ander publiek betreft en een heel ander tempo heeft: je zet het
 * nu, en je ziet het pas in week ${YOUTH_FEE_WEEK}.
 */
export function pricesScreen(s: GameState): string {
  return `${taskPicker(s, ['ticketing', 'jeugd'])}
  <div class="cols-2">
    <div class="col">${ticketCard(s)}</div>
    <div class="col">${subscriptionsCard(s)}</div>
  </div>
  ${youthFeeCard(s)}`;
}
