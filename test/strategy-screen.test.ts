import { expect } from 'chai';
import { strategyScreen } from '../src/ui/screens/strategy';
import { readyGame } from './helpers';
import type { GameState } from '../src/engine/types';

/** Iemand in dienst die deze taak kan doen, zodat we hem kunnen uitbesteden. */
function hireCoach(s: GameState): string {
  const coach = s.staff.find((m) => m.role === 'hoofdtrainer' || m.role === 'assistent');
  expect(coach, 'de testclub hoort een trainer in dienst te hebben').to.not.equal(undefined);
  return coach!.id;
}

/** Hoeveel blokken op dit scherm staan er op slot? */
function locked(html: string): number {
  return (html.match(/fieldset class="locked"/g) ?? []).length;
}

describe('Ploeg › Strategie: elk blok hangt aan zijn eigen taak', () => {
  it('zet niets op slot zolang jij alles zelf doet', () => {
    const s = readyGame();
    s.delegation = {};
    const html = strategyScreen(s);
    expect(locked(html)).to.equal(0);
    expect(html).to.not.contain('beslist dit');
  });

  it('zet alleen de opstelling op slot als je alleen de opstelling uitbesteedt', () => {
    const s = readyGame();
    s.delegation = { opstelling: hireCoach(s) };
    const html = strategyScreen(s);
    // dit was de bug: training en wedstrijdtactiek gingen mee op slot, terwijl de kiezer
    // erboven "Jij" aanwees — twee dingen op één scherm die elkaar tegenspraken
    expect(locked(html), 'alleen het opstellingsblok hoort op slot te staan').to.equal(1);
  });

  it('zet alleen de training op slot als je alleen de training uitbesteedt', () => {
    const s = readyGame();
    s.delegation = { training: hireCoach(s) };
    expect(locked(strategyScreen(s))).to.equal(1);
  });

  it('zet alle drie op slot als je alle drie uitbesteedt', () => {
    const s = readyGame();
    const id = hireCoach(s);
    s.delegation = { training: id, opstelling: id, tactiek: id };
    expect(locked(strategyScreen(s))).to.equal(3);
  });

  it('noemt in het slotje de persoon die beslist, niet een taak die niet bestaat', () => {
    const s = readyGame();
    const id = hireCoach(s);
    const naam = s.staff.find((m) => m.id === id)!.name;
    s.delegation = { tactiek: id };
    const html = strategyScreen(s);
    expect(html).to.contain(`${naam} beslist dit`);
    // "Neem de taak Strategie terug bij Personeel" verwees naar een taak die niet bestaat
    expect(html).to.not.contain('de taak "Strategie"');
  });

  it('biedt alle drie de taken aan in de kiezer bovenaan', () => {
    const s = readyGame();
    s.delegation = {};
    const html = strategyScreen(s);
    for (const t of ['Trainingen', 'Opstelling', 'Wedstrijdtactiek']) {
      expect(html, t).to.contain(t);
    }
  });
});
