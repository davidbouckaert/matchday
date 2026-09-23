// Wat draagt elke investeerder bij over zes seizoenen, bij exact dezelfde club?
// De club is gescript (groeit, promoveert om de twee seizoenen) zodat alleen de
// investeerder verschilt. Bedragen zijn wat er netto de kas in of uit gaat.
import type { InvestorId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { INVESTORS } from '../src/engine/data/setup';
import * as inv from '../src/engine/investors';
import { createRng } from '../src/engine/rng';
import * as actions from '../src/engine/actions';
import { seasonPrize } from '../src/engine/turn';

const SEASONS = 6;
const BOUWPAKKET = ['kantine', 'verlichting', 'kunstgras', 'opleidingscentrum', 'sanitair', 'parking'] as const;

function value(investor: InvestorId, klimmen: boolean): Record<string, number> {
  const s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'zuidrand', investor, seed: 7 });
  const def = INVESTORS.find((i) => i.id === investor)!;
  const out: Record<string, number> = { kapitaal: def.capital, stadionsponsor: 0, bouwkorting: 0, ledenrondes: 0, prijzengeld: 0, terugtrekking: 0 };

  for (let season = 1; season <= SEASONS; season++) {
    s.season = season;
    // de club groeit als ze goed draait
    if (klimmen) {
      s.community.fanBase = Math.round(s.community.fanBase * 1.18);
      s.community.reputation = Math.min(100, s.community.reputation + 7);
      s.community.fanMood = Math.min(100, s.community.fanMood + 5);
      if (season % 2 === 0 && s.league.divisionLevel < 4) {
        s.league.divisionLevel++;
        inv.notePromotion(s);
        inv.updateStadiumSponsor(s, s.league.divisionLevel);
        // het fonds neemt zijn deel van de promotiepremie
        const prize = seasonPrize(s.league.divisionLevel - 1, 'promotie');
        const before = s.cash;
        inv.takePrizeShare(s, prize);
        out.prijzengeld += s.cash - before;
      }
    } else {
      s.community.fanBase = Math.round(s.community.fanBase * 0.96);
      s.community.reputation = Math.max(5, s.community.reputation - 3);
    }
    // stadionsponsor over dit seizoen
    const stadion = s.sponsors.find((d) => d.kind === 'stadion');
    if (stadion) out.stadionsponsor += stadion.weekly * 52;
    // ledenronde
    if (s.investorState) s.investorState.coopSeason = null;
    if (inv.canHoldRound(s).ok) out.ledenrondes += inv.holdRound(s, createRng(s));
    // het geduld van het fonds
    const voor = s.cash;
    inv.checkFundPatience(s);
    out.terugtrekking += s.cash - voor;
  }
  // wat het bouwpakket scheelt
  const vol = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'zuidrand', investor: 'fonds', seed: 7 });
  const kost = (g: typeof s) => BOUWPAKKET.reduce((t, id) => t + actions.upgradeCost(g, id), actions.tribuneCost(g, 600));
  out.bouwkorting = kost(vol) - kost(s);
  return out;
}

const fmt = (n: number) => (n === 0 ? '—' : `${n > 0 ? '+' : '−'}€${Math.abs(Math.round(n)).toLocaleString('nl-BE')}`);
for (const klimmen of [true, false]) {
  console.log(`\n=== ${klimmen ? 'een club die groeit en om de twee seizoenen promoveert' : 'een club die stilstaat en niet promoveert'} (${SEASONS} seizoenen) ===`);
  console.log('investeerder  kapitaal   stadion    bouwkorting ledenrondes prijzengeld terugtrekking  TOTAAL');
  for (const i of ['aannemer', 'fonds', 'cooperatie'] as InvestorId[]) {
    const v = value(i, klimmen);
    const totaal = Object.values(v).reduce((a, b) => a + b, 0);
    console.log(
      i.padEnd(13) +
        fmt(v.kapitaal).padStart(9) +
        fmt(v.stadionsponsor).padStart(11) +
        fmt(v.bouwkorting).padStart(12) +
        fmt(v.ledenrondes).padStart(12) +
        fmt(v.prijzengeld).padStart(12) +
        fmt(v.terugtrekking).padStart(14) +
        '  ' + fmt(totaal),
    );
  }
}
