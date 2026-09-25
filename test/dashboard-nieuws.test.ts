import { expect } from 'chai';
import { dashboardScreen } from '../src/ui/screens/dashboard';
import { readyGame } from './helpers';

// Het nieuws stond eerst los onder de hele pagina (veel witruimte, pas zichtbaar na
// scrollen), daarna gepropt in de smalle zijkolom (op een breed scherm bleef het
// meeste van de breedte onbenut). Het staat nu in zijn eigen kolom, ernaast, zodat
// het op een breed scherm meteen in beeld staat zonder de zijkolom te verdringen.
describe('dashboard: nieuws staat in een eigen kolom naast de rest', () => {
  it('plaatst de nieuwslijst binnen dash-news, niet in de zijkolom en niet los onder de pagina', () => {
    const s = readyGame();
    const html = dashboardScreen(s);
    const nieuwsKolom = html.indexOf('class="dash-news"');
    const zijkolom = html.indexOf('class="dash-side"');
    const nieuws = html.indexOf('news-feed');
    const einde = html.lastIndexOf('</div>');
    expect(nieuwsKolom).to.be.greaterThan(-1);
    expect(zijkolom).to.be.greaterThan(-1);
    expect(nieuws).to.be.greaterThan(nieuwsKolom);
    expect(nieuws).to.be.lessThan(einde);
  });
});
