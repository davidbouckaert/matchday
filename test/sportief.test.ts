import { expect } from 'chai';
import { OWN_TEAM_ID, ownPosition, seasonWear, sortedTable, teamWear } from '../src/engine/league';
import { autoLineup, hireStaff, setPlayerRole, setTrainings } from '../src/engine/actions';
import { overall, teamStrength } from '../src/engine/players';
import { advanceWeek } from '../src/engine/turn';
import { readyGame } from './helpers';
import type { GameState } from '../src/engine/types';

/** Het reeksgemiddelde van je tegenstanders. */
function reeksgemiddelde(s: GameState): number {
  const zij = s.league.teams.filter((t) => t.id !== OWN_TEAM_ID).map((t) => t.strength);
  return zij.reduce((a, b) => a + b, 0) / zij.length;
}

/** Een eigenaar die zijn ploeg opvolgt: beste elf, trainingen, betere staf, rollen ingevuld. */
function actieveClub(seed: number): GameState {
  const s = readyGame('zuidrand', 'aannemer', seed);
  setTrainings(s, 4);
  for (const rol of ['hoofdtrainer', 'assistent'] as const) {
    const huidig = s.staff.find((x) => x.role === rol);
    const beter = [...s.staffMarket].filter((x) => x.role === rol && x.skill > (huidig?.skill ?? 0) + 5).sort((a, b) => b.skill - a.skill)[0];
    if (beter && s.cash > 60_000) hireStaff(s, beter.id);
  }
  const besten = [...s.players].sort((a, b) => overall(b) - overall(a));
  if (besten[0]) setPlayerRole(s, 'kapitein', besten[0].id);
  if (besten[1]) setPlayerRole(s, 'strafschop', besten[1].id);
  if (besten[2]) setPlayerRole(s, 'hoekschop', besten[2].id);
  return s;
}

/** Een seizoen uitspelen, met elke week de beste elf. */
function seizoen(s: GameState): GameState {
  let g = s;
  for (let w = 0; w < 44 && !g.gameOver; w++) {
    autoLineup(g);
    g = advanceWeek(g);
  }
  return g;
}

describe('Ook je tegenstanders hebben een seizoen in de benen', () => {
  it('begint bij nul en loopt op naar de winterstop', () => {
    expect(seasonWear(1)).to.equal(0);
    expect(seasonWear(10)).to.be.above(seasonWear(5));
    expect(seasonWear(22)).to.be.above(seasonWear(10));
  });

  it('laat de winterstop de benen terugkomen', () => {
    expect(seasonWear(28)).to.be.below(seasonWear(24));
    expect(seasonWear(40), 'in de terugronde loopt het weer op').to.be.above(seasonWear(29));
  });

  it('blijft binnen redelijke grenzen: het is een tik, geen ander elftal', () => {
    for (let w = 1; w <= 52; w++) {
      expect(seasonWear(w), `week ${w}`).to.be.within(0, 3);
    }
  });

  it('treft de ene club harder dan de andere, maar gemiddeld even hard', () => {
    const namen = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const waarden = namen.map((n) => teamWear(n, 1, 22));
    const gem = waarden.reduce((a, b) => a + b, 0) / waarden.length;
    expect(Math.min(...waarden)).to.be.below(gem);
    expect(Math.max(...waarden)).to.be.above(gem);
    expect(gem / seasonWear(22), 'gemiddeld hoort het op de curve te liggen').to.be.closeTo(1, 0.15);
  });

  it('geeft dezelfde ploeg in dezelfde week altijd hetzelfde', () => {
    expect(teamWear('kfc-test', 2, 18)).to.equal(teamWear('kfc-test', 2, 18));
    expect(teamWear('kfc-test', 2, 18)).to.not.equal(teamWear('kfc-test', 3, 18));
  });
});

describe('Je klassement hoort bij je ploeg te passen', () => {
  it('laat een ploeg rond het reeksgemiddelde niet vanzelf naar achteren zakken', () => {
    // Dit was de scheeftrekking: alleen jouw ploeg had vermoeidheid, blessures en schorsingen,
    // dus je zakte door het seizoen heen weg tegenover clubs die één vast getal waren. Met een
    // kern op het reeksgemiddelde kwam je zo standaard rond de tiende plaats van zestien uit.
    const s = readyGame('zuidrand', 'aannemer', 1);
    autoLineup(s);
    const verschil = teamStrength(s).total - reeksgemiddelde(s);
    expect(Math.abs(verschil), 'de testclub hoort rond het gemiddelde te starten').to.be.below(1.5);

    const plaatsen: number[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) plaatsen.push(ownPosition(seizoen(readyGame('zuidrand', 'aannemer', seed)).league));
    const gemiddeld = plaatsen.reduce((a, b) => a + b, 0) / plaatsen.length;
    expect(gemiddeld, `eindplaatsen: ${plaatsen.join(', ')}`).to.be.below(11);
  });

  it('beloont een eigenaar die zijn ploeg opvolgt met een plek in de eerste helft', () => {
    // Waar het om gaat: als je met trainingen, staf, rollen en je opstelling bezig bent, moet
    // dat in het klassement te zien zijn en niet wegvallen in de ruis. Over één partij lukt die
    // vergelijking niet — daar wint de luie club er geregeld ook eens een pak — dus we spelen
    // beide varianten over dezelfde zes seizoenen en leggen de gemiddelden naast elkaar.
    const seeds = [1, 2, 3, 4, 5, 6];
    const punten = (g: GameState) => sortedTable(g.league).find((r) => r.teamId === OWN_TEAM_ID)?.points ?? 0;
    const plaatsen: number[] = [];
    let actiefPunten = 0;
    let luiPunten = 0;
    for (const seed of seeds) {
      const ijverig = seizoen(actieveClub(seed));
      const lui = seizoen(readyGame('zuidrand', 'aannemer', seed));
      plaatsen.push(ownPosition(ijverig.league));
      actiefPunten += punten(ijverig);
      luiPunten += punten(lui);
    }
    const gemiddeld = plaatsen.reduce((a, b) => a + b, 0) / plaatsen.length;
    expect(gemiddeld, `eindplaatsen: ${plaatsen.join(', ')}`).to.be.below(7);
    expect(actiefPunten / seeds.length, 'gemeten rond 50 punten uit 30 wedstrijden').to.be.above(44);
    expect(actiefPunten, 'opvolgen hoort duidelijk meer op te leveren dan niets doen').to.be.above(luiPunten);
  });
});
