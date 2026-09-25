// Bumpt VERSION en zet een nieuw CHANGELOG-item vooraan in src/version.ts.
// Dit is de "vaste gang" uit CLAUDE.md (Werkwijze), maar dan als script in
// plaats van met de hand: minder kans op een verkeerd nummer of een
// changelog-item dat niet aansluit bij wat er echt veranderd is.
//
// Hoort ná het mergen naar main te draaien, nooit op een feature-branch —
// "versie hoort bij de merge, niet bij de branch". Het script weigert daarom
// te draaien buiten main.
//
// Gebruik:
//   npm run release -- --type=patch --title="Titel" --item="Wat er gemeten/veranderd is"
//   npm run release -- --type=minor --title="Titel" --item="Eerste zin" --item="Tweede zin"
//
// Daarna, zoals in CLAUDE.md:
//   git add src/version.ts && git commit -m "..." && git tag vX.Y.Z && git push origin main --tags
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_FILE = fileURLToPath(new URL('../src/version.ts', import.meta.url));

export type BumpType = 'minor' | 'patch';

export function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.split('.').map(Number);
  return type === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function applyRelease(
  content: string,
  type: BumpType,
  entry: { title: string; items: string[] },
  date: string,
): { content: string; version: string } {
  const versionMatch = content.match(/export const VERSION = '([\d.]+)';/);
  if (!versionMatch) throw new Error('VERSION niet gevonden in src/version.ts');
  const nextVersion = bumpVersion(versionMatch[1], type);

  const withVersion = content.replace(
    /export const VERSION = '[\d.]+';/,
    `export const VERSION = '${nextVersion}';`,
  );

  const itemsBlock = entry.items.map((item) => `      ${quote(item)},`).join('\n');
  const newEntry =
    `  {\n` +
    `    version: ${quote(nextVersion)},\n` +
    `    date: ${quote(date)},\n` +
    `    title: ${quote(entry.title)},\n` +
    `    items: [\n${itemsBlock}\n    ],\n` +
    `  },\n`;

  const marker = 'export const CHANGELOG: ChangeEntry[] = [\n';
  const markerIndex = withVersion.indexOf(marker);
  if (markerIndex === -1) throw new Error('CHANGELOG-array niet gevonden in src/version.ts');
  const insertAt = markerIndex + marker.length;
  const withChangelog = withVersion.slice(0, insertAt) + newEntry + withVersion.slice(insertAt);

  return { content: withChangelog, version: nextVersion };
}

function parseArgs(argv: string[]): { type: BumpType; title: string; items: string[] } {
  let type: string | undefined;
  let title: string | undefined;
  const items: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type') type = argv[++i];
    else if (arg.startsWith('--type=')) type = arg.slice('--type='.length);
    else if (arg === '--title') title = argv[++i];
    else if (arg.startsWith('--title=')) title = arg.slice('--title='.length);
    else if (arg === '--item') items.push(argv[++i]);
    else if (arg.startsWith('--item=')) items.push(arg.slice('--item='.length));
  }
  if (type !== 'minor' && type !== 'patch') {
    throw new Error('Gebruik --type=minor of --type=patch');
  }
  if (!title) throw new Error('Geef een titel mee: --title="..."');
  if (items.length === 0) throw new Error('Geef minstens één item mee: --item="..."');
  return { type, title, items };
}

function main(): void {
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  if (branch !== 'main') {
    console.error(
      `Dit script hoort ná het mergen te draaien, op main — niet op '${branch}'.\n` +
        'Versie hoort bij de merge, niet bij de branch (zie CLAUDE.md, Werkwijze).',
    );
    process.exit(1);
  }

  let parsed: { type: BumpType; title: string; items: string[] };
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(
      '\nGebruik: npm run release -- --type=patch --title="Titel" --item="Wat gemeten/veranderd is"',
    );
    process.exit(1);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const current = readFileSync(VERSION_FILE, 'utf8');
  const { content, version } = applyRelease(
    current,
    parsed.type,
    { title: parsed.title, items: parsed.items },
    date,
  );
  writeFileSync(VERSION_FILE, content);

  console.log(`src/version.ts bijgewerkt naar ${version}.`);
  console.log('\nVolgende stappen (zoals in CLAUDE.md):');
  console.log(`  git add src/version.ts`);
  console.log(`  git commit -m "${parsed.title}"`);
  console.log(`  git tag v${version}`);
  console.log(`  git push origin main --tags`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
