import { expect } from 'chai';
import { dashboardScreen } from '../src/ui/screens/dashboard';
import { readyGame } from './helpers';
import { addNews } from '../src/engine/util';

// Het nieuws op het dashboard stond er even grijs bij als weken oud nieuws: onder de radar.
// De lichting van deze week krijgt nu een kleurtje (klasse "vers"), ouder nieuws niet — zo
// valt op wat net gebeurd is, zonder dat het de gouden vieringkaarten uit de weekmelding evenaart.
describe('dashboard: nieuws van deze week valt op', () => {
  it('geeft de laatste nieuwslichting de klasse "vers", ouder nieuws niet', () => {
    const s = readyGame();
    s.news = [];
    addNews(s, 'neutraal', 'Ouder bericht.');
    s.week += 1;
    addNews(s, 'neutraal', 'Vers bericht.');
    const html = dashboardScreen(s);
    const items = [...html.matchAll(/<li class="([^"]+)"><span class="when">[^<]*<\/span><span class="what">([^<]*)<\/span><\/li>/g)];
    const vers = items.find((m) => m[2].startsWith('Vers bericht'));
    const ouder = items.find((m) => m[2].startsWith('Ouder bericht'));
    expect(vers?.[1]).to.equal('neutraal vers');
    expect(ouder?.[1]).to.equal('neutraal');
  });
});
