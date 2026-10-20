/** Exercise the actions decoded from Forma.fig, rather than trusting source metadata. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { buildPlan } from '../js/lib/planner.js';
import { BODY_PARTS } from '../js/data/body-parts.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const modules = process.env.OPENPENCIL_MODULES ?? '/home/jplr/.local/lib/node_modules/@open-pencil/cli/node_modules';
const { parseFigBuffer } = await import(pathToFileURL(path.join(modules, '@open-pencil/fig/dist/index.js')));
const bytes = await fs.readFile(path.join(here, 'Forma.fig'));
const file = parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const id = guid => `${guid.sessionID}:${guid.localID}`;
const nodes = new Map(file.nodeChanges.map(n => [id(n.guid), n]));
const variables = new Map(file.nodeChanges.filter(n => n.type === 'VARIABLE').map(n => [n.name, n]));
function evalValue(data, state) {
  assert.ok(data.resolvedDataType, 'Every expression and alias needs a resolved native type');
  const value = data.value;
  if (data.dataType === 'ALIAS') return state[id(value.alias.guid)];
  if (data.dataType === 'EXPRESSION') {
    const ex = value.expressionValue; const a = ex.expressionArguments.map(v => evalValue(v, state));
    switch (ex.expressionFunction) {
      case 'ADDITION': return a[0] + a[1];
      case 'SUBTRACTION': return a[0] - a[1];
      case 'EQUALS': return a[0] === a[1];
      case 'NOT': return !a[0];
      case 'LESS_THAN_OR_EQUAL': return a[0] <= a[1];
      case 'GREATER_THAN': return a[0] > a[1];
      default: throw new Error(`Unsupported expression ${ex.expressionFunction}`);
    }
  }
  return value.textValue ?? value.floatValue ?? value.boolValue ?? value.colorValue;
}
function run(actions, state) {
  for (const action of actions) {
    if (action.connectionType === 'SET_VARIABLE') state[id(action.targetVariable.id.guid)] = evalValue(action.targetVariableData, state);
    else if (action.connectionType === 'INTERNAL_NODE') state.screen = nodes.get(id(action.transitionNodeID));
    else if (action.connectionType === 'CONDITIONAL') {
      const block = action.conditionalActions.find(b => !b.condition || evalValue(b.condition, state));
      if (block) run(block.actions, state);
    } else throw new Error(`Unsupported action ${action.connectionType}`);
  }
}
const get = (state, name) => state[id(variables.get(name).guid)];
const put = (state, name, value) => { state[id(variables.get(name).guid)] = value; };
const initial = () => Object.fromEntries([...variables.values()].filter(n => !n.variableDataValues.entries[0].variableData.value.alias)
  .map(n => [id(n.guid), evalValue(n.variableDataValues.entries[0].variableData, {})]));
const child = (root, name) => [...nodes.values()].find(n => {
  if (n.name !== name) return false;
  let parent = n;
  while (parent.parentIndex) {
    parent = nodes.get(id(parent.parentIndex.guid));
    if (parent === root) return true;
    if (!parent) break;
  }
  return false;
});
const click = (node, state) => {
  assert.ok(node?.prototypeInteractions?.length, `Missing native interaction on ${node?.name}`);
  run(node.prototypeInteractions[0].actions, state);
};
let combinations = 0;
for (const pageName of ['03 / Desktop', '04 / Mobile']) {
  const page = [...nodes.values()].find(n => n.name === pageName && n.type === 'CANVAS');
  const dispatcher = child(page, 'Update plan / conditional logic');
  for (let mask = 1; mask < 128; mask++) for (const minutes of [15, 30, 45]) for (const equipment of ['none', 'dumbbells']) {
    const state = initial();
    put(state, 'choices/mask', mask); put(state, 'choices/minutes', minutes); put(state, 'choices/equipment', equipment);
    click(dispatcher, state);
    const expected = buildPlan({ parts: BODY_PARTS.filter((_, i) => mask & (1 << i)).map(p => p.id), minutes, equipment });
    assert.equal(get(state, 'plan/count'), expected.length);
    assert.deepEqual(expected.map((_, i) => get(state, `row/${i}/id`)), expected.map(x => x.exercise.id));
    combinations++;
  }
  const state = initial();
  click(dispatcher, state);
  const builder = state.screen;
  const area = child(builder, 'Area / Core / selected / on');
  click(area, state); click(state.screen, state);
  assert.equal(get(state, 'choices/mask'), 64);
  click(child(builder, 'Area / Core / selected / off'), state); click(state.screen, state);
  assert.equal(get(state, 'choices/mask'), 72);
  click(child(builder, 'Button / Start workout   →'), state);
  for (let index = 0; index < 18; index++) {
    assert.equal(get(state, 'session/set'), index % 3 + 1);
    assert.equal(get(state, 'session/name'), get(state, `row/${Math.floor(index / 3)}/name`));
    click(child(state.screen, 'Button / Complete set   ✓'), state);
    if (index === 17) break;
    click(child(state.screen, 'Button / + 15 sec'), state);
    click(child(state.screen, 'Button / + 15 sec'), state);
    assert.equal(get(state, 'session/rest'), 75);
    click(state.screen, state);
    assert.equal(get(state, 'session/rest-label'), '74');
    click(child(state.screen, 'Button / Skip rest   →'), state);
  }
  assert.equal(get(state, 'session/completed-label'), '18');
  click(child(state.screen, 'Button / Save this plan'), state);
  assert.equal(get(state, 'session/save-label'), 'Plan saved   ✓');
}
const bindings = file.nodeChanges.flatMap(n => [n, ...(n.symbolData?.symbolOverrides ?? [])])
  .flatMap(n => n.variableConsumptionMap?.entries ?? []);
for (const binding of bindings) {
  assert.ok(nodes.has(id(binding.variableData.value.alias.guid)), 'Binding points to an exported variable');
}
const fields = [...new Set(bindings.map(b => b.variableField))];
for (const field of ['TEXT_DATA', 'VISIBLE', 'CORNER_RADIUS', 'STACK_SPACING', 'STACK_PADDING_LEFT', 'FONT_SIZE']) assert.ok(fields.includes(field));
const report = { exportedCombinationChecks: combinations, completeWorkouts: 2,
  nativeVariableBindings: bindings.length, boundFields: fields,
  verification: 'Decoded native actions simulated in Node; not a Figma Present-mode verification.' };
await fs.writeFile(path.join(here, 'prototype-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
