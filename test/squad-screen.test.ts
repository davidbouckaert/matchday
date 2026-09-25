import { expect } from 'chai';
import { readyGame } from './helpers';
import { transfersScreen } from '../src/ui/screens/squad';

/** Het aantal tekens dat een vraagprijsveld met dat id opeist, via het size-attribuut. */
function chars(html: string, inputId: string): number {
  const re = new RegExp(`id="${inputId}"[^>]*size="(\\d+)"`);
  const m = html.match(re);
  expect(m, `veld ${inputId} moet in het scherm staan`).to.not.equal(null);
  return Number(m![1]);
}

describe('Transfermarkt: vraagprijsveld bij "Jouw spelers"', () => {
  // dezelfde bug als bij het loonvoorstel op Contracten: elke rij gokte haar eigen
  // bovengrens (tien keer haar eigen marktwaarde), dus een goedkope bankzitter kreeg een
  // smaller veld dan de sterspeler, en "Te koop zetten" sprong per rij een stukje op
  it('geeft elke rij dezelfde breedte, ook als de marktwaarde ver uit elkaar ligt', () => {
    const s = readyGame();
    const spelers = s.players.filter((p) => !p.loan && !p.listed);
    expect(spelers.length).to.be.at.least(2);
    spelers[0].technique = 20;
    spelers[0].physical = 20;
    spelers[0].potential = 20;
    spelers[1].technique = 90;
    spelers[1].physical = 90;
    spelers[1].potential = 90;

    const html = transfersScreen(s);
    const breedteLaag = chars(html, `ask-${spelers[0].id}`);
    const breedteHoog = chars(html, `ask-${spelers[1].id}`);
    expect(breedteLaag).to.equal(breedteHoog);
  });

  // de kolommen "Nu verkopen", vraagprijs en "Uitlenen" stonden vroeger samen in één cel,
  // dus schoof de tweede en derde knop mee op als de eerste een ander formaat had — nu is
  // het drie aparte kolommen, elk met hun eigen, over alle rijen gedeelde breedte
  it('zet verkopen, vraagprijs en uitlenen in drie aparte kolommen', () => {
    const s = readyGame();
    const html = transfersScreen(s);
    const eigenTabel = html.split('data-sort-id="eigen"')[1];
    expect(eigenTabel, 'de kop van de eigen-spelers-tabel krijgt drie lege, niet-sorteerbare kolommen').to.match(
      /<th data-nosort><\/th><th data-nosort><\/th><th data-nosort><\/th>/,
    );
  });
});
