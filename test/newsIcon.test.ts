import { expect } from 'chai';
import { newsIcon } from '../src/ui/newsIcon';

// Het nieuws stond er even grijs bij ongeacht het onderwerp: geld, een aanwerving, een
// bouwproject en een schorsing zagen er allemaal hetzelfde uit. newsIcon() herkent het
// onderwerp aan trefwoorden in de bestaande berichttekst (geen apart veld op NewsItem, dus
// geen ~90 aanroepen van addNews() om aan te passen) en levert er een emoji bij.
describe('newsIcon', () => {
  it('herkent geld, mensen, sport en bouw aan trefwoorden in de tekst', () => {
    expect(newsIcon('De bank keurt je kredietaanvraag goed: €5.000 staat op de rekening.')).to.equal('💰');
    expect(newsIcon('Jan Peeters is de nieuwe hoofdtrainer van FC Zuidrand.')).to.equal('👔');
    expect(newsIcon('Wedstrijd tegen FC Rivalen afgelast: bevroren grasmat.')).to.equal('⚽');
    expect(newsIcon('Bouwproject afgerond: nieuwe tribune. Er kunnen nu 4000 toeschouwers binnen.')).to.equal('🏗️');
    expect(newsIcon('Jan Peeters verlengt tot einde seizoen 2027 aan €900/week.')).to.equal('🖊️');
  });

  it('geeft geen tweede emoji aan berichten die er al een dragen (mijlpalen, clubrecords)', () => {
    expect(newsIcon('🎉 Mijlpaal bereikt: 1000 toeschouwers. De feestcommissie haalt €500 op.')).to.equal('');
    expect(newsIcon('🏅 Clubrecord: langste ongeslagen reeks.')).to.equal('');
  });

  it('valt terug op de opgegeven fallback, of op niets, als er geen onderwerp herkend wordt', () => {
    expect(newsIcon('Seizoen afgesloten op plaats 5. FC Zuidrand blijft in Tweede Provinciale.')).to.equal('');
    expect(newsIcon('Seizoen afgesloten op plaats 5. FC Zuidrand blijft in Tweede Provinciale.', '🎉')).to.equal('🎉');
  });
});
