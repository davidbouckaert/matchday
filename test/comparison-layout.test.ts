import { expect } from 'chai';
import { readyGame } from './helpers';
import { hireStaff, replaceStaff, delegateTask } from '../src/engine/actions';
import { staffChangeCost, staffPayoff, staffSigningFee } from '../src/engine/staff';
import { tasksOf } from '../src/engine/delegation';
import { staffComparison } from '../src/ui/staff-comparison';
import { staffScreen } from '../src/ui/screens/staff';
import { leagueScreen } from '../src/ui/screens/club';
import { DIVISIONS } from '../src/engine/data/divisions';
import { OWN_TEAM_ID, sortedTable } from '../src/engine/league';

describe('personeel vergelijken zonder spelregels te veranderen', () => {
  // De offerte moet precies overeenkomen met de echte boekingen en taakoverdracht.
  it('toont dezelfde kosten en terugvallende taken als de vervangingsactie', () => {
    const s = readyGame();
    const current = s.staff.find((m) => m.role === 'hoofdtrainer')!;
    current.skill = 90;
    for (const task of ['training', 'opstelling', 'tactiek'] as const) expect(delegateTask(s, task, current.id).ok).to.equal(true);
    const candidate = s.staffMarket.find((m) => m.role === 'hoofdtrainer')!;
    candidate.skill = 20;
    const before = structuredClone(s);
    const preview = staffComparison(s, candidate);
    expect(s).to.deep.equal(before);
    expect(preview.cost).to.equal(current.wage * 8 + candidate.wage * 2);
    expect(preview.weeklyDelta).to.equal(candidate.wage - current.wage);
    expect(preview.returned).to.have.length.greaterThan(0);
    expect(replaceStaff(s, candidate.id).ok).to.equal(true);
    expect(before.cash - s.cash).to.equal(preview.cost);
    expect(tasksOf(s, candidate.id)).to.deep.equal(preview.taken);
    for (const task of preview.returned) expect(s.delegation[task]).to.equal(undefined);
  });
  // Een vacature mag volgens de bestaande motor ook zonder voldoende kas ingevuld worden.
  it('behoudt het verschil tussen aanwerven op krediet en onbetaalbaar vervangen', () => {
    const s = readyGame();
    s.cash = 0;
    const coach = s.staffMarket.find((m) => m.role === 'hoofdtrainer')!;
    expect(staffComparison(s, coach).reason).to.contain('tekort');
    const assistant = s.staffMarket.find((m) => m.role === 'assistent')!;
    expect(staffComparison(s, assistant).reason).to.equal(null);
    const fee = staffSigningFee(assistant);
    expect(hireStaff(s, assistant.id).ok).to.equal(true);
    expect(s.cash).to.equal(-fee);
  });
  // Alleen de formulebron is verplaatst; de bestaande factoren blijven 2 en 8.
  it('deelt tekengeld en opzeg tussen weergave en boeking', () => {
    const s = readyGame();
    const member = s.staff[0], candidate = s.staffMarket[0];
    expect(staffPayoff(member)).to.equal(member.wage * 8);
    expect(staffSigningFee(candidate)).to.equal(candidate.wage * 2);
    expect(staffChangeCost(candidate)).to.equal(candidate.wage * 2);
  });
  // Lege en vergrendelde rollen mogen niet als een stil ontbrekende knop verschijnen.
  it('houdt vacature, blokkadereden, opleiding en lege lichting bereikbaar', () => {
    const s = readyGame();
    const before = structuredClone(s);
    const html = staffScreen(s, null, 'kinesist');
    expect(html).to.contain('Vacature').and.contain('recuperatieruimte');
    expect(html).to.contain('disabled aria-describedby=').and.contain('aria-pressed="true"');
    expect(html).to.contain('data-tour-doel="taken"').and.contain('data-tour-doel="kandidaten"');
    expect(s).to.deep.equal(before);
    s.staffMarket = [];
    expect(staffScreen(s, null, 'hoofdtrainer')).to.contain('Geen kandidaten').and.contain('Taken en opleiding');
  });
});

describe('competitiestand als primair voetbalobject', () => {
  // Geen onmogelijke promotie/degradatie beloven op de uiterste treden.
  it('volgt de bestaande zones en benoemt de eigen club ook zonder kleur', () => {
    const s = readyGame();
    s.league.divisionLevel = DIVISIONS.length - 1;
    let html = leagueScreen(s);
    expect(html).to.contain('Hoogste reeks: geen promotie.').and.contain('Jouw club');
    expect(html).not.to.contain('sportieve promotieplaats');
    s.league.divisionLevel = 0;
    html = leagueScreen(s);
    expect(html).to.contain('Laagste reeks: geen degradatie.');
    expect(html).not.to.contain('class="zone-symbol" aria-label="degradatieplaats"');
  });
  // Nul wedstrijden is geen sportieve prestatie; een latere promotieplaats is geen licentie.
  it('maakt nog niet gespeeld, sportieve plaats en licentie verschillende feiten', () => {
    const s = readyGame();
    expect(leagueScreen(s)).to.contain('Nog niet gespeeld').and.not.contain('Sportief op promotieplaats');
    const own = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)!;
    own.played = 1; own.points = 3;
    expect(leagueScreen(s)).to.contain('Sportief op promotieplaats').and.contain('nog voorwaarden te vervullen');
    const before = structuredClone(s);
    const html = leagueScreen(s);
    expect(s).to.deep.equal(before);
    expect(html.indexOf('class="compact league"')).to.be.lessThan(html.indexOf('De clubs in je reeks'));
    expect(html).to.contain('scope="row"').and.contain('data-accessible-sort');
    expect(sortedTable(s.league)[0].teamId).to.equal(OWN_TEAM_ID);
  });
});

describe('competitiecontext na review', () => {
  // Bij degradatie is handhaving de relevante grens, ook in een reeks met promotie.
  for (const tied of [false, true]) {
    it(`toont de veilige plaats vanuit de degradatiezone${tied ? ' bij gelijke punten' : ''}`, () => {
      const s = readyGame();
      s.league.table.forEach((r, i) => { r.played = 10; r.points = 100 - i * 3; r.goalsFor = 10; r.goalsAgainst = 0; });
      const own = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)!;
      own.points = -10;
      const safe = sortedTable(s.league)[s.league.table.length - 4];
      if (tied) { own.points = safe.points; own.goalsFor = 0; own.goalsAgainst = 10; }
      const context = leagueScreen(s).match(/<p class="competition-context">(.*?)<\/p>/s)![1];
      expect(context).to.contain('laatste veilige plaats').and.not.contain('laatste promotieplaats');
      if (tied) expect(context).to.contain('Evenveel punten als').and.not.contain('0 punten voor');
    });
  }
  // Een slechter doelsaldo kan je met evenveel punten buiten de promotieplaatsen houden.
  it('noemt gelijke punten aan de promotiegrens geen voorsprong', () => {
    const s = readyGame();
    s.league.table.forEach((r, i) => { r.played = 10; r.points = 100 - i * 3; r.goalsFor = 10; r.goalsAgainst = 0; });
    const own = s.league.table.find((r) => r.teamId === OWN_TEAM_ID)!;
    own.points = -10;
    const boundary = sortedTable(s.league)[1];
    own.points = boundary.points; own.goalsFor = 0; own.goalsAgainst = 10;
    const html = leagueScreen(s);
    expect(html).to.contain('Evenveel punten als').and.contain('laatste promotieplaats').and.not.contain('0 punten voor');
  });
  // De vastgelegde reeks mag na week 44 niet door actuele licentievoorwaarden worden overschreven.
  it('vervangt toekomstige licentieacties na de beoordeling door het vastgelegde resultaat', () => {
    const s = readyGame(); s.week = 44;
    expect(leagueScreen(s)).to.contain('competition-licence');
    for (const week of [45, 52]) {
      s.week = week; s.nextDivisionLevel = s.league.divisionLevel;
      let html = leagueScreen(s);
      expect(html).not.to.contain('competition-licence');
      expect(html).to.contain('De seizoensbeoordeling in week 44 is afgerond').and.contain(`Volgend seizoen: ${DIVISIONS[s.nextDivisionLevel].name}`);
      s.nextDivisionLevel++;
      html = leagueScreen(s);
      expect(html).to.contain(`Volgend seizoen: ${DIVISIONS[s.nextDivisionLevel].name}`).and.not.contain('nog voorwaarden te vervullen');
    }
  });
});
