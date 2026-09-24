// Zet het logbestand aan tijdens een testronde, maar alleen als je erom vraagt.
//
// Standaard schrijft een testronde niets: duizenden regels naar de schijf maken de suite
// merkbaar trager, en meestal wil je ze niet. Wil je wel meekijken:
//
//   VCG_LOG=debug npx mocha                    → logs/voetbalclub.log plus de terminal
//   VCG_LOG=debug npx mocha test/delegeren.test.ts
//
// Zie src/log/node.ts voor de niveaus.

import { attachFileLogFromEnv } from '../src/log/node';

let detach: (() => void) | null = null;

export const mochaHooks = {
  beforeAll(): void {
    detach = attachFileLogFromEnv('logs/test.log');
  },
  afterAll(): void {
    detach?.();
    detach = null;
  },
};
