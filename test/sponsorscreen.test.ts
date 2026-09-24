import { expect } from 'chai';
import { sponsorsScreen } from '../src/ui/screens/sponsors';
import { KIND_MAX, prospectChance, setSponsorAsk, fairPrice } from '../src/engine/sponsors';
import { readyGame } from './helpers';

/** Hoeveel cellen staan er in de kop en in de eerste rij van een tabel? */
function kolommen(html: string, id: string): { kop: number; rij: number } {
  const tabel = html.split(`data-sort-id="${id}"`)[1] ?? '';
  // let op: `<th` matcht ook `<thead`, dus het teken erna moet mee
  const kop = (tabel.split('</thead>')[0].match(/<th[ >]/g) ?? []).length;
  const eerste = tabel.split('<tbody>')[1]?.split('</tr>')[0] ?? '';
  return { kop, rij: (eerste.match(/<td/g) ?? []).length };
}

describe('Het sponsorscherm', () => {
  it('geeft elke plaats een invoerveld, behalve wat op slot staat', () => {
    const s = readyGame();
    const html = sponsorsScreen(s);
    const velden = (html.match(/data-change="sponsor-ask"/g) ?? []).length;
    const sloten = (html.match(/class="slot-lock"/g) ?? []).length;
    expect(velden + sloten, 'negen plaatsen, elk met een veld of een slot').to.equal(9);
    expect(sloten, 'bij de start staat er zeker iets op slot').to.be.above(0);
    expect(html).to.not.contain('num-sponsor-ask-stadion');
  });

  it('zet de kop en de rijen van de contactentabel even breed', () => {
    // hier ging het eerder mis: er kwam een kolom bij in de rijen en niet in de kop, en dan
    // sorteert elke kolom op de gegevens van haar buur
    const { kop, rij } = kolommen(sponsorsScreen(readyGame()), 'prospects');
    expect(kop).to.equal(rij);
  });

  it('zet de kop en de rijen van de sponsortabel even breed', () => {
    const { kop, rij } = kolommen(sponsorsScreen(readyGame()), 'sponsors');
    expect(kop).to.equal(rij);
  });

  it('toont per contact het percentage dat het spel zelf gebruikt', () => {
    const s = readyGame();
    const p = [...s.prospects].sort((a, b) => b.interest - a.interest)[0];
    const { kans } = prospectChance(s, p);
    expect(sponsorsScreen(s)).to.contain(`>${Math.round(kans * 100)}%<`);
  });

  it('laat het oordeel pas zien als je zelf een bedrag zet', () => {
    const s = readyGame();
    expect(sponsorsScreen(s)).to.contain('volgt de markt');
    expect(sponsorsScreen(s), 'anders staat er twee keer hetzelfde').to.not.contain('slot-verdict');
    setSponsorAsk(s, 'bord', Math.round(fairPrice(s, 'bord') * 3));
    const html = sponsorsScreen(s);
    expect(html).to.contain('slot-verdict');
    expect(html).to.contain('onbetaalbaar');
    expect(html).to.contain('sponsor-ask-reset');
  });

  it('telt de bezette plaatsen per soort, als badge in de kop van elke tegel', () => {
    // de teller stond als voetnootje onder het invoerveld en werd daar door niemand
    // gezien — gemeld als "zie ik niet meer staan", terwijl hij er stond
    const s = readyGame();
    const html = sponsorsScreen(s);
    const borden = s.sponsors.filter((d) => d.kind === 'bord').length;
    expect(html).to.contain(`>${borden}/${KIND_MAX.bord}</span>`);
    expect((html.match(/slot-badge/g) ?? []).length, 'elke plaats draagt een badge, ook wat op slot staat').to.equal(9);
    expect(html).to.contain(`${borden} van de ${KIND_MAX.bord} plaatsen voor reclamebord`);
  });
});
