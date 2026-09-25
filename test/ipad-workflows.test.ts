import { expect } from 'chai';
import { readyGame } from './helpers';
import * as actions from '../src/engine/actions';
import { selectLineup, teamStrength } from '../src/engine/players';
import { workflowPanel, performWorkflow, workflowValid, squadPreview, type Workflow } from '../src/ui/workflow-panel';
import { taskDetour, validOrigin, type TaskOrigin } from '../src/ui/task-context';
import { licenceLinks, licenceTaskContext } from '../src/ui/licence-context';
import { licenceProblems } from '../src/engine/turn';

const task = (s: ReturnType<typeof readyGame>, kind: Workflow['kind'], id: string): Workflow => ({kind, id, scroll: 350, focus: '#bron', week: s.week, season: s.season});

describe('adaptieve workflows met ongewijzigde spelregels', () => {
  // Vergelijken en annuleren mogen noch de opstelling, noch RNG/savegegevens aanraken.
  it('bewaart bron en alternatief en vergelijkt met de echte wisselactie zonder mutatie', () => {
    const s = readyGame(); delete s.delegation.opstelling;
    const lineup = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).slots;
    const outgoing = lineup[0].player;
    const incoming = s.players.find((p) => !lineup.some((x) => x.player.id === p.id) && !p.injuryWeeks && !p.suspended)!;
    const w = {...task(s, 'squad', outgoing.id), candidate: incoming.id};
    const before = structuredClone(s);
    const preview = squadPreview(s, outgoing.id, incoming.id);
    const html = workflowPanel(s, w);
    expect(html).to.contain(outgoing.name).and.contain(incoming.name).and.contain('Annuleren');
    expect(s).to.deep.equal(before);
    const expected = structuredClone(s); const result = actions.swapInLineup(expected, outgoing.id, incoming.id);
    expect(performWorkflow(s, w)).to.deep.equal(result);
    expect(s).to.deep.equal(expected);
    expect(preview.after).to.equal(teamStrength(s).total);
  });
  // Dezelfde grenscontrole beschermt tegen een geblesseerde kandidaat of verdwenen bron.
  it('weigert een onbeschikbare vervanger en vervallen taakcontext', () => {
    const s = readyGame(); delete s.delegation.opstelling;
    s.players[1].injuryWeeks = 2;
    const w = {...task(s, 'squad', s.players[0].id), candidate: s.players[1].id};
    const before = structuredClone(s);
    expect(performWorkflow(s, w).ok).to.equal(false); expect(s).to.deep.equal(before);
    s.week++;
    expect(workflowValid(s, w)).to.equal(false);
    expect(performWorkflow(s, w).ok).to.equal(false);
  });
  // Een nog open plaats blijft aanklikbaar; na invullen mag dezelfde oude taak niet opnieuw wisselen.
  it('vult een lege plaats met de bestaande actie en verwerpt de verouderde lege plaats', () => {
    const s = readyGame(); delete s.delegation.opstelling;
    s.tactics.gaps = { AANV: 1 };
    const slots = selectLineup(s.players, s.tactics.formation, s.tactics.manualXI, s.tactics.benched, s.tactics.gaps).slots;
    const p = s.players.find((p) => p.position === 'AANV' && !slots.some((slot) => slot.player.id === p.id))!;
    const w = {...task(s, 'squad', 'leeg:AANV'), candidate: p.id};
    expect(workflowValid(s, w)).to.equal(true);
    const expected = structuredClone(s); const result = actions.toggleStarter(expected, p.id);
    expect(performWorkflow(s, w)).to.deep.equal(result); expect(s).to.deep.equal(expected);
    expect(workflowValid(s, w)).to.equal(false);
  });
  // Het tabletpad mag een vervanging geen andere kosten of taakgevolgen geven dan desktop.
  it('houdt personeelscontext en dezelfde vervangingsuitkomst', () => {
    const s = readyGame(); const c = s.staffMarket.find((m) => m.role === 'hoofdtrainer')!;
    const w = task(s, 'staff', c.id); const before = structuredClone(s);
    const html = workflowPanel(s, w);
    expect(html).to.contain(s.staff.find((m) => m.role === c.role)!.name).and.contain(c.name).and.contain('Taken terug naar jou');
    expect(s).to.deep.equal(before);
    const expected = structuredClone(s); const result = actions.replaceStaff(expected, c.id);
    expect(performWorkflow(s, w)).to.deep.equal(result); expect(s).to.deep.equal(expected);
  });
  // Invoer blijft UI-data; pas het bod uitvoeren mag onderhandelingen of RNG veranderen.
  it('behoudt het loonvoorstel bij hertekenen en gebruikt de bestaande verlenging', () => {
    const s = readyGame(); delete s.delegation.contracten;
    const p = s.players.find((p) => p.contractUntil <= s.season + 1)!;
    const w = {...task(s, 'contract', p.id), wage: '405'};
    const before = structuredClone(s);
    expect(workflowPanel(s, w)).to.contain('value="405"');
    expect(workflowPanel(s, w)).to.contain('value="405"');
    expect(s).to.deep.equal(before);
    const expected = structuredClone(s); const result = actions.extendContract(expected, p.id, 405);
    expect(performWorkflow(s, w)).to.deep.equal(result); expect(s).to.deep.equal(expected);
    w.wage = '';
    const after = structuredClone(s);
    expect(performWorkflow(s, w).ok).to.equal(false); expect(s).to.deep.equal(after);
  });
  // Ook een mislukte onderhandeling mag niet per platform andere gevolgen hebben.
  it('toont een afwijzing en bewaart dezelfde domeinuitkomst', () => {
    const s = readyGame(); const p = s.players[0]; p.morale = 20;
    const w = {...task(s, 'contract', p.id), wage: '400'};
    const expected = structuredClone(s); const result = actions.extendContract(expected, p.id, 400);
    w.result = performWorkflow(s, w);
    expect(w.result).to.deep.equal(result); expect(s).to.deep.equal(expected);
    expect(workflowPanel(s, w)).to.contain(result.message).and.contain('value="400"');
  });
  // Een transferinspectie mag geen gesprek starten; beide bevestigingen wel exact hetzelfde.
  for (const kind of ['buy', 'loan'] as const) {
    it(`inspecteert ${kind} zuiver en laat het bestaande antwoordproces beslissen`, () => {
      const s = readyGame(); const p = (kind === 'buy' ? s.transferList : s.loanMarket)[0];
      const w = task(s, kind, p.id); const before = structuredClone(s);
      expect(workflowPanel(s, w)).to.contain(p.name).and.contain('Loon bij tekenen');
      expect(s).to.deep.equal(before);
      const expected = structuredClone(s); const result = kind === 'buy' ? actions.buyPlayer(expected, p.id) : actions.loanIn(expected, p.id);
      expect(performWorkflow(s, w)).to.deep.equal(result); expect(s).to.deep.equal(expected);
      w.done = true; w.result = result;
      expect(workflowPanel(s, w)).to.contain(result.message).and.not.contain('data-action="workflow-confirm"');
      const after = structuredClone(s); expect(performWorkflow(s, w).ok).to.equal(false); expect(s).to.deep.equal(after);
    });
  }
});

describe('terug naar de oorspronkelijke taak', () => {
  // Een omweg via nog een herstelplek vervangt de oorspronkelijke taak niet.
  it('behoudt één semantische oorsprong, focus en scroll over omwegen en hertekenen', () => {
    const s = readyGame();
    const origin: TaskOrigin = { screen: 'competitie', label: 'Competitie', focus: '#licentie', scroll: 450, week: s.week, season: s.season, licenceOpen: true };
    expect(taskDetour(null, origin)).to.equal(origin);
    expect(taskDetour(origin, {...origin, screen: 'staff'})).to.equal(origin);
    expect(validOrigin(origin, structuredClone(s))).to.equal(true);
    s.week++;
    expect(validOrigin(origin, s)).to.equal(false);
  });
  // Verdwenen spelers en een ontbrekende game mogen geen dode terugweg achterlaten.
  it('verwijdert een oorsprong waarvan de speler of game niet meer bestaat', () => {
    const s = readyGame();
    const origin: TaskOrigin = { screen: 'ploeg', label: 'speler', entity: s.players[0].id, focus: null, scroll: 0, week: s.week, season: s.season };
    expect(validOrigin(origin, s)).to.equal(true);
    s.players.shift(); expect(validOrigin(origin, s)).to.equal(false);
    expect(validOrigin(origin, null)).to.equal(false); expect(validOrigin(null, s)).to.equal(false);
  });
  // Een gestart project is nog geen voltooide licentievoorwaarde.
  it('richt licentieherstel op de ontbrekende voorwaarde en blijft tijdens bouw eerlijk', () => {
    const s = readyGame(); s.infrastructure.lightingLevel = 0;
    const problems = licenceProblems(s, s.league.divisionLevel + 1);
    expect(licenceLinks(s, problems).map((l) => l.screen)).to.include('infrastructuur');
    const before = licenceTaskContext(s);
    expect(before).to.contain('verlichting');
    s.cash = 1000000;
    expect(actions.startUpgrade(s, 'verlichting').ok).to.equal(true);
    expect(licenceTaskContext(s)).to.contain('verlichting');
    expect(s.infrastructure.lightingLevel).to.equal(0);
  });
});
