import { expect } from 'chai';
import { dashboardScreen } from '../src/ui/screens/dashboard';
import { readyGame } from './helpers';

// Het nieuws stond los onder de hele pagina, over de volle breedte, met veel witruimte
// eronder — pas zichtbaar na scrollen. Het hoort nu in de zijkolom, naast de cijfers,
// zodat het meteen in beeld staat.
describe('dashboard: nieuws staat in de zijkolom', () => {
  it('plaatst de nieuwslijst binnen de zijkolom, niet los onder de pagina', () => {
    const s = readyGame();
    const html = dashboardScreen(s);
    const zijkolom = html.indexOf('class="dash-side"');
    const nieuws = html.indexOf('news-feed');
    const einde = html.lastIndexOf('</div>');
    expect(zijkolom).to.be.greaterThan(-1);
    expect(nieuws).to.be.greaterThan(zijkolom);
    expect(nieuws).to.be.lessThan(einde);
  });
});
