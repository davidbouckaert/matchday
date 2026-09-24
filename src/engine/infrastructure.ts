// Wat een bouwproject met je accommodatie doet.
//
// Dit stond als een rij if-regels midden in de weeklus. Zolang alleen de weeklus het
// nodig had, was dat prima. Maar om te kunnen tonen wát een tribune-uitbreiding je
// oplevert, moet een tweede stuk code hetzelfde kunnen doen op een proefkopie — en twee
// keer dezelfde regels schrijven is twee keer dezelfde regels vergeten aan te passen.
//
// Daarom staat het hier, als één functie die allebei gebruiken.

import type { Infrastructure, UpgradeId } from './types';

/** De standaardgrootte van een tribune-uitbreiding als er geen aantal is meegegeven. */
export const DEFAULT_SEATS = 300;

/**
 * Voert het effect van een afgerond bouwproject uit op de accommodatie.
 * Past het object aan dat je meegeeft — geef dus een kopie mee als je alleen wil meten.
 */
export function applyUpgrade(i: Infrastructure, id: UpgradeId, seats?: number): void {
  if (id === 'tribune') i.capacity += seats ?? DEFAULT_SEATS;
  if (id === 'kantine') i.kantineLevel = Math.min(5, i.kantineLevel + 1);
  if (id === 'kunstgras') i.pitch = 'kunstgras';
  if (id === 'verlichting') i.lightingLevel = Math.min(3, i.lightingLevel + 1);
  if (id === 'opleidingscentrum') i.academyLevel = Math.min(3, i.academyLevel + 1);
  if (id === 'recuperatie') i.recoveryLevel = Math.min(2, i.recoveryLevel + 1);
  if (id === 'wifi') i.wifiLevel = Math.min(2, i.wifiLevel + 1);
  if (id === 'toiletten') i.toiletLevel = Math.min(2, i.toiletLevel + 1);
  if (id === 'kleedkamers') i.kleedkamerLevel = Math.min(2, i.kleedkamerLevel + 1);
  if (id === 'parking') i.parkingLevel = Math.min(2, i.parkingLevel + 1);
  if (id === 'scorebord') i.scoreboardLevel = Math.min(2, i.scoreboardLevel + 1);
  if (id === 'ploegbus') i.teamBus = true;
  if (id === 'zonnepanelen') i.solarPanels = true;
  if (id === 'ledverlichting') i.ledLighting = true;
}
