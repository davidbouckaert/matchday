import type { BackgroundId, InvestorId } from '../../engine/types';
import { BACKGROUNDS, INVESTORS, START_CLUBS } from '../../engine/data/setup';
import { avatarSvg, HAIRS, SHIRTS, SKINS } from '../avatar';
import { CREST_LABEL, CREST_SHAPES, type CrestShape, clubInitials, crestSvg } from '../crest';
import { esc, euro, stars } from '../format';
import { SCHEMES, schemeById } from '../theme';

export interface SetupDraft {
  step: 1 | 2 | 3;
  crest: CrestShape;
  clubName: string;
  name: string;
  skin: number;
  hair: number;
  shirt: number;
  background: BackgroundId;
  scheme: string;
  clubId: string;
  investor: InvestorId;
}

export const defaultDraft = (): SetupDraft => ({
  step: 1,
  crest: 'schild',
  clubName: '',
  name: '',
  skin: 0,
  hair: 0,
  shirt: 0,
  background: 'ondernemer',
  scheme: 'groenwit',
  clubId: 'zuidrand',
  investor: 'aannemer',
});

// Vooraf ingeschatte rating van de startclubs (sportief, financieel, gemeenschap)
const CLUB_STARS: Record<string, [number, number, number]> = { zuidrand: [4, 2, 3], heidebeke: [2, 4, 4] };

function swatches(kind: 'skin' | 'hair' | 'shirt', colors: string[], selected: number): string {
  return colors
    .map(
      (c, i) =>
        `<button class="swatch ${i === selected ? 'sel' : ''}" data-action="draft-${kind}" data-id="${i}" aria-label="${kind} ${i + 1}" style="background:${c === 'none' ? 'repeating-linear-gradient(45deg,#ccc 0 4px,#fff 4px 8px)' : c}"></button>`,
    )
    .join('');
}

export function setupScreen(d: SetupDraft): string {
  const steps = ['Jij', 'Club', 'Investeerder'];
  const header = `<ol class="steps">${steps.map((s, i) => `<li class="${i + 1 === d.step ? 'on' : i + 1 < d.step ? 'done' : ''}">${i + 1}. ${s}</li>`).join('')}</ol>`;

  if (d.step === 1) {
    return `<section class="setup card">
      <h1>Nieuwe eigenaar</h1>${header}
      <div class="avatar-edit">
        ${avatarSvg(d, 120)}
        <div class="grow">
          <label>Naam<input id="draft-name" type="text" maxlength="30" value="${esc(d.name)}" placeholder="Jouw naam" autocomplete="off"/></label>
          <div class="sw-row"><span>Huid</span>${swatches('skin', SKINS, d.skin)}</div>
          <div class="sw-row"><span>Haar</span>${swatches('hair', HAIRS, d.hair)}</div>
          <div class="sw-row"><span>Trui</span>${swatches('shirt', SHIRTS, d.shirt)}</div>
        </div>
      </div>
      <h3>Achtergrond</h3>
      <div class="choice-grid">
        ${BACKGROUNDS.map(
          (b) => `<button class="choice ${d.background === b.id ? 'sel' : ''}" data-action="draft-background" data-id="${b.id}">
            <strong>${esc(b.name)}</strong><span>${esc(b.perk)}</span></button>`,
        ).join('')}
      </div>
      <div class="actions"><button class="primary" data-action="draft-next">Volgende</button></div>
    </section>`;
  }

  if (d.step === 2) {
    const club = START_CLUBS.find((c) => c.id === d.clubId) ?? START_CLUBS[0];
    return `<section class="setup card">
      <h1>Kies je club</h1>${header}
      <div class="choice-grid two">
        ${START_CLUBS.map((c) => {
          const [s, f, g] = CLUB_STARS[c.id] ?? [3, 3, 3];
          return `<button class="choice club ${d.clubId === c.id ? 'sel' : ''}" data-action="draft-club" data-id="${c.id}">
            ${crestSvg(d.crest, c.colors as [string, string], clubInitials(d.clubId === c.id && d.clubName.trim() ? d.clubName : c.name), 54)}
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.story)}</span>
            <dl class="mini">
              <dt>Sportief</dt><dd>${stars(s)}</dd>
              <dt>Financieel</dt><dd>${stars(f)}</dd>
              <dt>Gemeenschap</dt><dd>${stars(g)}</dd>
              <dt>Kas</dt><dd>${euro(c.cash)}</dd>
              <dt>Tribune</dt><dd>${c.capacity} plaatsen</dd>
              <dt>Terrein</dt><dd>${c.pitch}</dd>
              <dt>Lening</dt><dd>${c.loan ? euro(c.loan.principal * 0.82) + ' open' : 'geen'}</dd>
            </dl>
          </button>`;
        }).join('')}
      </div>
      <h3>Naam van je club</h3>
      <p class="muted small">Laat leeg om de bestaande naam te houden. Je kunt de club ook meteen hernoemen — je bent tenslotte de nieuwe eigenaar.</p>
      <label>Clubnaam<input id="draft-clubname" type="text" maxlength="34" value="${esc(d.clubName)}" placeholder="${esc(club.name)}" autocomplete="off"/></label>
      <h3>Clubkleuren</h3>
      <p class="muted small">Je kleuren staan niet alleen op het logo: ze kleuren de hele app — de actieve tab, de knoppen, je balken en grafieken.
        Elk schema is doorgerekend op leesbaarheid, dus je kunt niet in een combinatie belanden waarin je de tekst niet meer ziet.</p>
      <div class="scheme-row">
        ${SCHEMES.map(
          (sch) => `<button class="scheme-pick ${d.scheme === sch.id ? 'sel' : ''}" data-action="draft-scheme" data-id="${sch.id}" data-tip="${esc(sch.naam)}: kleurt je logo, je knoppen en je accenten.">
            <span class="swatches"><span style="background:${sch.colors[0]}"></span><span style="background:${sch.colors[1]}"></span></span>
            <span class="small">${esc(sch.naam)}</span>
          </button>`,
        ).join('')}
      </div>

      <h3>Kies een logo</h3>
      <p class="muted small">Het logo van ${esc(d.clubName.trim() || club.name)} staat in de kopbalk en op je rapporten.</p>
      <div class="crest-row">
        ${CREST_SHAPES.map(
          (shape) => `<button class="crest-pick ${d.crest === shape ? 'sel' : ''}" data-action="draft-crest" data-id="${shape}" data-tip="${CREST_LABEL[shape]}">
            ${crestSvg(shape, schemeById(d.scheme).colors, clubInitials(d.clubName.trim() || club.name), 56)}
            <span class="muted small">${CREST_LABEL[shape]}</span>
          </button>`,
        ).join('')}
      </div>
      <div class="actions"><button data-action="draft-back">Terug</button><button class="primary" data-action="draft-next">Volgende</button></div>
    </section>`;
  }

  return `<section class="setup card">
    <h1>Kies je investeerder</h1>${header}
    <div class="choice-grid three">
      ${INVESTORS.map(
        (i) => `<button class="choice ${d.investor === i.id ? 'sel' : ''}" data-action="draft-investor" data-id="${i.id}">
          <strong>${esc(i.name)}</strong>
          <span class="big">${euro(i.capital)}</span>
          <span>${esc(i.summary)}</span>
          <span class="tag">Inmenging: ${i.interference}</span>
          <span class="sub">Voorwaarden</span><ul>${i.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          <span class="sub">Voordelen</span><ul>${i.perks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </button>`,
      ).join('')}
    </div>
    <div class="actions"><button data-action="draft-back">Terug</button><button class="primary" data-action="draft-start">Start het avontuur</button></div>
  </section>`;
}
