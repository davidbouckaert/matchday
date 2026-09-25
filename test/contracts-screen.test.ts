import { expect } from 'chai';
import { readyGame } from './helpers';
import { contractsScreen } from '../src/ui/screens/contracts';

/** Het aantal tekens dat een loonveld met dat id opeist, via het size-attribuut. */
function chars(html: string, inputId: string): number {
  const re = new RegExp(`id="${inputId}"[^>]*size="(\\d+)"`);
  const m = html.match(re);
  expect(m, `veld ${inputId} moet in het scherm staan`).to.not.equal(null);
  return Number(m![1]);
}

describe('Contractenscherm: loonvoorstel-veld', () => {
  // dit was de bug: elke rij gokte haar eigen bovengrens (tien keer haar loonvoorstel), dus een
  // speler die €700 vroeg kreeg een smaller veld dan één die €1000 vroeg, en de knop ernaast
  // sprong per rij een stukje naar links of rechts
  it('geeft elke rij dezelfde breedte, ook als het voorstel veel lager is dan de duurste speler', () => {
    const s = readyGame();
    const spelers = s.players.filter((p) => p.loan?.type !== 'in');
    expect(spelers.length).to.be.at.least(2);
    // twee spelers ver uit elkaar zetten: één met een heel laag loon, één met een heel hoog loon
    spelers[0].wage = 40;
    spelers[0].contractUntil = s.season + 1;
    spelers[1].wage = 5000;
    spelers[1].contractUntil = s.season + 1;

    const html = contractsScreen(s);
    const breedteLaag = chars(html, `wage-${spelers[0].id}`);
    const breedteHoog = chars(html, `wage-${spelers[1].id}`);
    expect(breedteLaag).to.equal(breedteHoog);
  });
});
