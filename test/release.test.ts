import { expect } from 'chai';
import { applyRelease, bumpVersion } from '../scripts/release';

// Deze tests bestaan omdat het releasescript src/version.ts met tekstmanipulatie
// bewerkt (geen TS-parser) — een regex die niet meer klopt met het bestandsformaat
// zou geruisloos een verkeerd nummer of een kapotte CHANGELOG-entry wegschrijven.
describe('scripts/release', () => {
  it('bumpVersion: minor gaat naar x.y+1.0, patch naar x.y.z+1', () => {
    expect(bumpVersion('0.79.5', 'minor')).to.equal('0.80.0');
    expect(bumpVersion('0.79.5', 'patch')).to.equal('0.79.6');
  });

  const sample = `// Versie van het spel. Semantisch: MAJOR.MINOR.PATCH.
export const VERSION = '0.79.5';

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.79.5',
    date: '2026-09-25',
    title: 'Vorig item',
    items: ['Iets dat al gemeten was'],
  },
];
`;

  it('zet VERSION en een nieuw CHANGELOG-item vooraan, zonder het vorige item te raken', () => {
    const { content, version } = applyRelease(
      sample,
      'patch',
      { title: 'Nieuw item', items: ['Eerste regel', "Met een 'aanhalingsteken' erin"] },
      '2026-09-26',
    );

    expect(version).to.equal('0.79.6');
    expect(content).to.include("export const VERSION = '0.79.6';");

    const newEntryIndex = content.indexOf("title: 'Nieuw item'");
    const oldEntryIndex = content.indexOf("title: 'Vorig item'");
    expect(newEntryIndex).to.be.greaterThan(-1);
    expect(oldEntryIndex).to.be.greaterThan(-1);
    expect(newEntryIndex).to.be.lessThan(oldEntryIndex);
    expect(content).to.include("'Met een \\'aanhalingsteken\\' erin'");
    expect(content).to.include("'Iets dat al gemeten was'");
  });

  it('weigert te draaien als VERSION niet te vinden is', () => {
    expect(() => applyRelease('geen versie hier', 'patch', { title: 't', items: ['i'] }, '2026-09-26')).to.throw(
      'VERSION niet gevonden',
    );
  });
});
