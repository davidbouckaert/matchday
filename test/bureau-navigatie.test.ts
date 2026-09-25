import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Voer de echte eventhandlers uit met alleen de benodigde browsergrens gestubd.
// Een test van uitsluitend validOrigin zou een vergeten reset in de B-handler missen.
const source = ts.createSourceFile('main.ts', readFileSync('src/ui/main.ts', 'utf8'), ts.ScriptTarget.Latest, true);
function eventHandler(event: string): string {
  let callback: ts.Node | undefined;
  source.forEachChild((node) => {
    if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return;
    const call = node.expression;
    if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'addEventListener'
      && ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text === event) callback = call.arguments[1];
  });
  if (!callback) throw new Error(`Eventhandler ontbreekt: ${event}`);
  return ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

async function navigate(event: 'click' | 'keydown', key = 'b', input = false, ctrlKey = false) {
  const origin = { screen: 'overzicht', label: 'Bureau' };
  const ui = { screen: 'financien', game: {}, moment: 'dicht', menuOpen: true };
  const renders: unknown[] = [];
  const context = {
    ui, taskOrigin: origin, workflow: null,
    root: { querySelectorAll: () => [] },
    handlers: { nav: (screen: string) => { ui.screen = screen; ui.menuOpen = false; } },
    tourFlags: () => null, rememberDoneSteps: () => {}, tourMelding: () => null,
    render: () => { renders.push({ screen: ui.screen, origin: context.taskOrigin }); },
  };
  const target = {
    dataset: { action: 'nav', id: 'overzicht' }, matches: () => false,
    closest: (selector: string): unknown => selector === '[data-action]' ? target : input && selector === 'input, textarea, select' ? target : null,
  };
  const handle = runInNewContext(eventHandler(event), context);
  await handle({ key, ctrlKey, target, preventDefault: () => {} });
  return { screen: ui.screen, origin: context.taskOrigin, renders };
}

describe('Bureau-navigatie sluit de oorspronkelijke taak af', () => {
  // Bureau → Financiën → B mag op Bureau geen terugweg naar Bureau achterlaten.
  it('wist de oorsprong vóór renderen bij zowel klikken als b en B', async () => {
    const click = await navigate('click');
    expect(click).to.deep.equal({ screen: 'overzicht', origin: null, renders: [{ screen: 'overzicht', origin: null }] });
    expect(await navigate('keydown', 'b')).to.deep.equal(click);
    expect(await navigate('keydown', 'B')).to.deep.equal(click);
  });
  // Tekstinvoer en toetscombinaties zijn geen expliciete Bureau-navigatie.
  it('behoudt de taak als b in een invoerveld of met Ctrl wordt gebruikt', async () => {
    for (const result of [await navigate('keydown', 'b', true), await navigate('keydown', 'b', false, true)]) {
      expect(result.screen).to.equal('financien');
      expect(result.origin).not.to.equal(null);
      expect(result.renders).to.deep.equal([]);
    }
  });
});
