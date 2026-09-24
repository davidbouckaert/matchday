// Wat draagt elke investeerder bij over zes seizoenen, bij exact dezelfde club?
// De club is gescript (groeit en promoveert om de twee seizoenen, of staat stil) zodat
// alleen de investeerder verschilt.
//
// Twee totalen, want ze vertellen iets anders:
//   NOMINAAL  wat er in totaal de kas in of uit gaat, in de euro's van dat moment
//   CONTANT   hetzelfde, maar teruggerekend naar de euro's van seizoen 1
//
// Dat tweede totaal is het eerlijke vergelijkingspunt. Het fonds legt zijn hele bedrag in
// week 1 op tafel; de aannemer en de coöperatie leveren jaar na jaar, in geld dat door de
// inflatie elk seizoen wat minder waard is.
import type { InvestorId } from '../src/engine/types';
import { createNewGame } from '../src/engine/newGame';
import { INVESTORS } from '../src/engine/data/setup';
import * as inv from '../src/engine/investors';
import { createRng } from '../src/engine/rng';
import * as actions from '../src/engine/actions';
import { seasonPrize } from '../src/engine/turn';

const SEASONS = 6;
const BOUWPAKKET = ['kantine', 'verlichting', 'kunstgras', 'opleidingscentrum', 'toiletten', 'kleedkamers', 'parking'] as const;

interface Uitkomst {
  posten: Record<string, number>;
  nominaal: number;
  contant: number;
}

function value(investor: InvestorId, klimmen: boolean): Uitkomst {
  const s = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'zuidrand', investor, seed: 7 });
  const def = INVESTORS.find((i) => i.id === investor)!;
  const posten: Record<string, number> = { kapitaal: def.capital, stadionsponsor: 0, bouwkorting: 0, ledenrondes: 0, prijzengeld: 0, terugtrekking: 0 };
  let nominaal = def.capital;
  let contant = def.capital; // het startkapitaal komt in week 1 binnen: volle waarde

  const tel = (post: string, bedrag: number) => {
    posten[post] += bedrag;
    nominaal += bedrag;
    contant += bedrag / s.inflation;
  };

  for (let season = 1; season <= SEASONS; season++) {
    s.season = season;
    // alles wordt elk seizoen duurder, net als in het echte spel
    if (season > 1) s.inflation = Math.round(s.inflation * 1.07 * 1000) / 1000;

    if (klimmen) {
      s.community.fanBase = Math.round(s.community.fanBase * 1.18);
      s.community.reputation = Math.min(100, s.community.reputation + 7);
      s.community.fanMood = Math.min(100, s.community.fanMood + 5);
      if (season % 2 === 0 && s.league.divisionLevel < 4) {
        s.league.divisionLevel++;
        inv.notePromotion(s);
        inv.updateStadiumSponsor(s, 'reeks');
        // het fonds neemt zijn deel van de promotiepremie
        const prize = seasonPrize(s.league.divisionLevel - 1, 'promotie');
        const before = s.cash;
        inv.takePrizeShare(s, prize);
        tel('prijzengeld', s.cash - before);
      }
    } else {
      s.community.fanBase = Math.round(s.community.fanBase * 0.96);
      s.community.reputation = Math.max(5, s.community.reputation - 3);
    }

    // de naamsponsor wordt bij elk seizoenbegin herbekeken, net als in newSeason
    inv.updateStadiumSponsor(s, 'seizoen');
    const stadion = s.sponsors.find((d) => d.kind === 'stadion');
    if (stadion) tel('stadionsponsor', stadion.weekly * 52);

    // ledenronde
    if (s.investorState) s.investorState.coopSeason = null;
    if (inv.canHoldRound(s).ok) {
      const before = s.cash;
      inv.holdRound(s, createRng(s));
      tel('ledenrondes', s.cash - before);
    }

    // het geduld van het fonds
    const voor = s.cash;
    inv.checkFundPatience(s);
    if (s.cash !== voor) tel('terugtrekking', s.cash - voor);
  }

  // wat het bouwpakket scheelt, gebouwd op het niveau en het prijspeil van het laatste seizoen
  const vol = createNewGame({ avatar: { name: 'Bot', skin: 0, hair: 0, shirt: 0, background: 'ondernemer' }, clubId: 'zuidrand', investor: 'fonds', seed: 7 });
  vol.inflation = s.inflation; // dezelfde club op hetzelfde moment, anders meet je de inflatie
  vol.league.divisionLevel = s.league.divisionLevel;
  const kost = (g: typeof s) => BOUWPAKKET.reduce((t, id) => t + actions.upgradeCost(g, id), actions.tribuneCost(g, 600));
  tel('bouwkorting', kost(vol) - kost(s));

  return { posten, nominaal, contant };
}

const fmt = (n: number) => (n === 0 ? '—' : `${n > 0 ? '+' : '−'}€${Math.abs(Math.round(n)).toLocaleString('nl-BE')}`);
for (const klimmen of [true, false]) {
  console.log(`\n=== ${klimmen ? 'een club die groeit en om de twee seizoenen promoveert' : 'een club die stilstaat en niet promoveert'} (${SEASONS} seizoenen) ===`);
  console.log('investeerder  kapitaal   stadion    bouwkorting ledenrondes prijzengeld terugtrekking    NOMINAAL     CONTANT');
  for (const i of ['aannemer', 'fonds', 'cooperatie'] as InvestorId[]) {
    const v = value(i, klimmen);
    console.log(
      i.padEnd(13) +
        fmt(v.posten.kapitaal).padStart(9) +
        fmt(v.posten.stadionsponsor).padStart(11) +
        fmt(v.posten.bouwkorting).padStart(12) +
        fmt(v.posten.ledenrondes).padStart(12) +
        fmt(v.posten.prijzengeld).padStart(12) +
        fmt(v.posten.terugtrekking).padStart(14) +
        fmt(v.nominaal).padStart(12) +
        fmt(v.contant).padStart(12),
    );
  }
}
