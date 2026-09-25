// Klikken om te filteren: een functie op Personeel filtert de kandidaten, een tegel-kop
// op Sponsors filtert je sponsors en je contacten. Actief = accent met een bolletje, en
// bij de lijst staat een chip met een kruisje; nog eens klikken haalt de filter ook weg
// (dat togglen zit in main.ts, hier testen we wat de schermen met de filter doen).

import { expect } from 'chai';
import { readyGame } from './helpers';
import { staffScreen } from '../src/ui/screens/staff';
import { sponsorsScreen } from '../src/ui/screens/sponsors';
import { prospectChance } from '../src/engine/sponsors';
import { transfersScreen } from '../src/ui/screens/squad';
import { isPromising } from '../src/engine/players';
import type { Position } from '../src/engine/types';

describe('filteren door aan te klikken', () => {
  it('een functie aanklikken filtert de kandidatenlijst tot die rol', () => {
    const s = readyGame('heidebeke');
    const rol = s.staffMarket[0].role;
    const html = staffScreen(s, null, rol);
    const verwacht = s.staffMarket.filter((c) => c.role === rol).length;
    const rijen = (html.match(/data-action="hire/g) ?? []).length + (html.match(/🔒 op slot/g) ?? []).length;
    expect(rijen).to.be.at.least(verwacht);
    // alle andere rollen zijn uit de kandidatenlijst verdwenen
    for (const c of s.staffMarket) {
      if (c.role === rol) continue;
      expect(html.split('Kandidaten')[1]).to.not.contain(esc(c.name));
    }
    expect(html, 'de chip met het kruisje staat bij de gefilterde lijst').to.contain('✕');
    expect(html).to.contain(`${verwacht} van ${s.staffMarket.length}`);
  });

  it('zonder filter zie je de beste kandidaat per functie, zonder kruisje', () => {
    const s = readyGame('heidebeke');
    const html = staffScreen(s, null);
    const rollen = [...new Set(s.staffMarket.map((c) => c.role))];
    for (const rol of rollen) {
      const beste = s.staffMarket.filter((c) => c.role === rol).sort((a, b) => b.skill - a.skill)[0];
      expect(html, rol).to.contain(beste.name);
    }
    expect(html).to.not.contain('✕');
  });

  it('een sponsortegel aanklikken filtert sponsors én contacten op die plaats', () => {
    const s = readyGame('heidebeke');
    const html = sponsorsScreen(s, 'bord');
    const borden = s.sponsors.filter((d) => d.kind === 'bord').length;
    expect(html).to.contain(`${borden} van ${s.sponsors.length}`);
    // geen hoofdsponsor in de gefilterde sponsortabel
    const hoofdsponsor = s.sponsors.find((d) => d.kind === 'hoofdsponsor')!;
    expect(html.split('Huidige sponsors')[1]).to.not.contain(hoofdsponsor.name);
    // contacten: alleen wie echt op een bord zou tekenen
    const past = s.prospects.filter((p) => prospectChance(s, p).kind === 'bord').length;
    expect(html).to.contain(`${past} van ${s.prospects.length}`);
    expect(html).to.contain('✕');
  });

  it('een positie aanklikken op de transfermarkt filtert kopen, huren en je eigen kern samen', () => {
    const s = readyGame('heidebeke');
    // ids zijn uniek (namen komen uit een kleine pool en kunnen toevallig dubbel voorkomen)
    const positie: Position = s.transferList[0]?.position ?? s.loanMarket[0]?.position ?? s.players[0].position;
    const html = transfersScreen(s, positie);

    const kopenSectie = html.split('Transfermarkt: kopen')[1].split('Huren van profclubs')[0];
    const hurenSectie = html.split('Huren van profclubs')[1].split('Jouw spelers')[0];
    const eigenSectie = html.split('Jouw spelers')[1];
    for (const p of s.transferList) {
      if (p.position === positie) continue;
      expect(kopenSectie, p.id).to.not.contain(`data-id="${p.id}"`);
    }
    for (const p of s.loanMarket) {
      if (p.position === positie) continue;
      expect(hurenSectie, p.id).to.not.contain(`data-id="${p.id}"`);
    }
    for (const p of s.players) {
      if (p.position === positie) continue;
      expect(eigenSectie, p.id).to.not.contain(`data-id="${p.id}"`);
    }
    // wie wél die positie heeft, blijft gewoon zichtbaar
    const eersteEigen = s.players.find((p) => p.position === positie);
    if (eersteEigen) expect(eigenSectie).to.contain(`data-id="${eersteEigen.id}"`);
    expect(html).to.contain('✕');
  });

  it('zonder filter staan alle posities in de drie transfertabellen', () => {
    const s = readyGame('heidebeke');
    const html = transfersScreen(s);
    for (const p of [...s.transferList, ...s.loanMarket, ...s.players]) expect(html, p.id).to.contain(`data-id="${p.id}"`);
    expect(html).to.not.contain('✕');
  });

  it('het beloftevol-label staat bij een jonge speler met veel groeiruimte op de transfermarkt en op de kern-tabel', () => {
    const s = readyGame('heidebeke');
    // forceer een duidelijk geval van "beloftevol" (19j, techniek/fysiek 45, potentieel 65 —
    // exact het voorbeeld uit de aanvraag), los van wat de seed toevallig genereerde
    const opTransfermarkt = s.transferList[0];
    const inDeKern = s.players[0];
    for (const p of [opTransfermarkt, inDeKern]) {
      p.age = 19;
      p.technique = 45;
      p.physical = 45;
      p.potential = 65;
      expect(isPromising(p)).to.equal(true);
    }

    const html = transfersScreen(s);
    const kopenSectie = html.split('Transfermarkt: kopen')[1].split('Huren van profclubs')[0];
    const eigenSectie = html.split('Jouw spelers')[1];
    expect(kopenSectie, opTransfermarkt.id).to.contain('beloftevol');
    expect(eigenSectie, inDeKern.id).to.contain('beloftevol');
  });
});

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
