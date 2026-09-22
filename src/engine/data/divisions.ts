import type { Diploma } from '../types';

// Competitieniveaus. Cijfers zijn spelwaarden: rudimentair en bedoeld om bij te stellen.
// Diplomavereisten zijn een vereenvoudiging voor het spel, niet het officiële reglement.
export interface Division {
  name: string;
  teams: number;
  opponentStrength: number; // gemiddelde sterkte van tegenstanders
  refTicketPrice: number; // "normale" ticketprijs op dit niveau
  fanBaseNorm: number; // typisch aantal supporters
  sponsorFactor: number; // vermenigvuldiger op sponsorbedragen
  tvRightsPerWeek: number; // tv- en radiorechten (euro per week)
  requiredDiploma: Diploma;
  requiredLighting: number;
  requiredCapacity: number;
}

export const DIVISIONS: Division[] = [
  { name: '1ste Provinciale', teams: 16, opponentStrength: 44, refTicketPrice: 7, fanBaseNorm: 250, sponsorFactor: 0.6, tvRightsPerWeek: 0, requiredDiploma: 'EUFA C', requiredLighting: 1, requiredCapacity: 200 },
  { name: '3de Nationale', teams: 16, opponentStrength: 52, refTicketPrice: 10, fanBaseNorm: 550, sponsorFactor: 1, tvRightsPerWeek: 0, requiredDiploma: 'EUFA B', requiredLighting: 1, requiredCapacity: 500 },
  { name: '2de Nationale', teams: 16, opponentStrength: 58, refTicketPrice: 12, fanBaseNorm: 900, sponsorFactor: 1.5, tvRightsPerWeek: 150, requiredDiploma: 'EUFA B', requiredLighting: 2, requiredCapacity: 800 },
  { name: '1ste Nationale', teams: 16, opponentStrength: 64, refTicketPrice: 14, fanBaseNorm: 1600, sponsorFactor: 2.3, tvRightsPerWeek: 600, requiredDiploma: 'EUFA A', requiredLighting: 2, requiredCapacity: 1500 },
  { name: 'Challenger Pro Liga', teams: 16, opponentStrength: 70, refTicketPrice: 17, fanBaseNorm: 3500, sponsorFactor: 4, tvRightsPerWeek: 4000, requiredDiploma: 'EUFA Pro', requiredLighting: 3, requiredCapacity: 3000 },
  { name: 'Pro Liga', teams: 16, opponentStrength: 77, refTicketPrice: 22, fanBaseNorm: 10000, sponsorFactor: 8, tvRightsPerWeek: 30000, requiredDiploma: 'EUFA Pro', requiredLighting: 3, requiredCapacity: 8000 },
];

export const START_DIVISION = 1; // 3de Nationale

export const DIPLOMA_ORDER: Diploma[] = ['geen', 'EUFA C', 'EUFA B', 'EUFA A', 'EUFA Pro'];

export function diplomaRank(d: Diploma): number {
  return DIPLOMA_ORDER.indexOf(d);
}
