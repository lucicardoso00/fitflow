/** Figma-native actions. Also interpreted by our tests, independently of the codec. */
import { BODY_PARTS } from '../../js/data/body-parts.js';
import { EXERCISES } from '../../js/data/exercises.js';
import { buildPlan } from '../../js/lib/planner.js';
import { getPlanTitle } from '../../js/lib/choices.js';
import { EXERCISE_SOURCES, WGER_LICENSES } from '../../js/data/exercise-sources.js';
import { GUIDE_SNAPSHOTS } from '../source/exercise-guides.js';

export const literal = value => ({ type: typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'number' ? 'FLOAT' : typeof value === 'object' ? 'COLOR' : 'STRING', value });
export const ref = name => ({ type: 'VARIABLE_ALIAS', name });
export const expression = (operator, ...args) => ({ type: 'EXPRESSION', operator, args: args.map(x => x?.type ? x : literal(x)) });
export const set = (name, value) => ({ type: 'SET_VARIABLE', name, value: value?.type ? value : literal(value) });
export const condition = (test, yes, no = []) => ({ type: 'CONDITIONAL', blocks: [{ condition: test, actions: yes }, { actions: no }] });
export const navigate = destination => ({ type: 'NODE', destination });
export const eq = (a, b) => expression('EQUALS', a, b);
const add = (a, b) => expression('ADDITION', a, b);
const str = value => add('', value);
export const variables = {};
const variable = (name, value) => { variables[name] = value; return name; };
variable('choices/mask', 72);
variable('choices/minutes', 30);
variable('choices/equipment', 'none');
variable('plan/title', 'Core & Legs');
variable('plan/count', 6);
variable('plan/sets', 18);
variable('plan/summary', '6 exercises · 3 sets each · 45 sec rest');
variable('plan/duration', '30 min');
variable('plan/equipment', 'Bodyweight');
variable('plan/focus-count', '2 body areas selected');
variable('plan/ready', true);
variable('plan/empty', false);
variable('session/completed', 0);
variable('session/exercise', 0);
variable('session/set', 1);
variable('session/set-label', 'SET 1 OF 3');
variable('session/position', 'Exercise 1 of 6');
variable('session/name', 'Plank');
variable('session/id', 'plank');
variable('session/target', '40');
variable('session/unit', 'seconds');
variable('session/next', 'Plank · set 2');
variable('session/rest', 45);
variable('session/rest-label', '45');
variable('session/has-result', false);
variable('session/title', 'Core & Legs');
variable('session/save-label', 'Save this plan');
variable('session/save-message', 'Keep this plan for another day.');
variable('session/complete-label', 'Complete set   ✓');
variable('session/completed-label', '18');
variable('session/count-label', '6');
variable('session/minutes-label', '30');
for (const [i, part] of BODY_PARTS.entries()) {
  variable(`choice/${part.id}`, !!(72 & (1 << i)));
  variable(`choice/${part.id}/off`, !(72 & (1 << i)));
  variable(`choice/${part.id}/color`, (72 & (1 << i)) ? { r:197/255, g:244/255, b:103/255, a:1 } : { r:68/255, g:74/255, b:69/255, a:1 });
}
for (const [name, selected] of [['full-body', false], ['15', false], ['30', true], ['45', false], ['none', true], ['dumbbells', false]]) {
  variable(`choice/${name}`, selected); variable(`choice/${name}/off`, !selected);
}
for (let i = 0; i < 8; i++) {
  variable(`row/${i}/visible`, i < 6);
  for (const field of ['name', 'detail', 'target', 'unit', 'id']) variable(`row/${i}/${field}`, '');
}
for (const ex of EXERCISES) variable(`art/${ex.id}`, ex.id === 'plank');
for (const name of ['id', 'name', 'target', 'setup', 'description', 'credit']) variable(`guide/${name}`, '');
for (const ex of EXERCISES) variable(`guide/art/${ex.id}`, ex.id === 'plank');

export function guideValues(id) {
  const exercise = EXERCISES.find(ex => ex.id === id);
  const source = EXERCISE_SOURCES[id];
  const snapshot = GUIDE_SNAPSHOTS[id];
  return {
    'guide/id': id, 'guide/name': exercise.name,
    'guide/target': `3 × ${exercise.seconds || exercise.reps} ${exercise.seconds ? 'sec' : exercise.unit} · Workout target`,
    'guide/setup': source.setup || (exercise.equipment === 'dumbbells' ? 'Equipment: dumbbells.' : 'Bodyweight. A mat is optional.'),
    'guide/description': snapshot.description,
    'guide/credit': `${snapshot.name} · ${snapshot.author}\n${WGER_LICENSES[snapshot.licenseId].name} · wger · 20 Oct 2026 snapshot`,
    ...Object.fromEntries(EXERCISES.map(ex => [`guide/art/${ex.id}`, ex.id === id])),
  };
}
Object.assign(variables, guideValues('plank'));
export const openGuideActions = idRef => [{ type: 'CONDITIONAL', blocks: EXERCISES.map(ex => ({
  condition: eq(idRef, ex.id), actions: [...Object.entries(guideValues(ex.id)).map(([name, value]) => set(name, value)), navigate('guide')],
})) }];
export const guideLinkActions = provider => [{ type: 'CONDITIONAL', blocks: EXERCISES.map(ex => ({
  condition: eq(ref('guide/id'), ex.id), actions: [{ type: 'URL', url: provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${EXERCISE_SOURCES[ex.id].video}`
    : `https://wger.de/en/exercise/${EXERCISE_SOURCES[ex.id].wger}/view/` }],
})) }];

function choiceState(name, selected) {
  return [set(`choice/${name}`, selected), set(`choice/${name}/off`, expression('NOT', selected))];
}
export function choose(name) {
  let actions;
  const partIndex = BODY_PARTS.findIndex(p => p.id === name);
  if (partIndex >= 0) {
    actions = [condition(ref(`choice/${name}`),
      [set('choices/mask', expression('SUBTRACTION', ref('choices/mask'), 1 << partIndex))],
      [set('choices/mask', add(ref('choices/mask'), 1 << partIndex))]),
    ...choiceState(name, expression('NOT', ref(`choice/${name}`)))];
    // The second assignment must read the new value, not negate it twice.
    actions.at(-1).value = expression('NOT', ref(`choice/${name}`));
  } else if (name === 'full-body') {
    actions = [condition(eq(ref('choices/mask'), 127), [set('choices/mask', 0), ...BODY_PARTS.flatMap(p => choiceState(p.id, false))],
      [set('choices/mask', 127), ...BODY_PARTS.flatMap(p => choiceState(p.id, true))])];
  } else if (['15', '30', '45'].includes(name)) {
    actions = [set('choices/minutes', Number(name)), ...['15', '30', '45'].flatMap(n => choiceState(n, n === name))];
  } else {
    actions = [set('choices/equipment', name), ...['none', 'dumbbells'].flatMap(n => choiceState(n, n === name))];
  }
  return [...actions, ...choiceState('full-body', eq(ref('choices/mask'), 127)), navigate('refresh')];
}

export function planActions(mask, minutes, equipment) {
  const parts = BODY_PARTS.filter((p, i) => mask & (1 << i)).map(p => p.id);
  const plan = parts.length ? buildPlan({ parts, minutes, equipment }) : [];
  const values = {
    'plan/title': getPlanTitle(parts), 'plan/count': plan.length, 'plan/sets': plan.length * 3,
    'plan/ready': !!plan.length, 'plan/empty': !plan.length,
    'plan/summary': `${plan.length} exercises · 3 sets each · 45 sec rest`,
    'plan/duration': `${minutes} min`, 'plan/equipment': equipment === 'none' ? 'Bodyweight' : 'Dumbbells',
    'plan/focus-count': `${parts.length} body areas selected`,
  };
  for (const part of BODY_PARTS) values[`choice/${part.id}/color`] = parts.includes(part.id)
    ? { r:197/255, g:244/255, b:103/255, a:1 } : { r:68/255, g:74/255, b:69/255, a:1 };
  for (let i = 0; i < 8; i++) {
    const item = plan[i]; const ex = item?.exercise;
    Object.assign(values, { [`row/${i}/visible`]: !!ex, [`row/${i}/name`]: ex?.name ?? '',
      [`row/${i}/detail`]: ex ? `${item.partId} · 3 × ${ex.seconds || ex.reps} ${ex.seconds ? 'sec' : ex.unit}` : '',
      [`row/${i}/id`]: ex?.id ?? '', [`row/${i}/target`]: String(ex?.seconds || ex?.reps || ''),
      [`row/${i}/unit`]: ex?.seconds ? 'seconds' : ex?.unit ?? '' });
  }
  return Object.entries(values).map(([name, value]) => set(name, value));
}

// One decision tree per viewport, not one duplicate workout per selection.
export function refreshActions() {
  const masks = (minutes, equipment, start = 0, end = 127) => start === end ? planActions(start, minutes, equipment)
    : [condition(expression('LESS_THAN_OR_EQUAL', ref('choices/mask'), Math.floor((start + end) / 2)),
      masks(minutes, equipment, start, Math.floor((start + end) / 2)), masks(minutes, equipment, Math.floor((start + end) / 2) + 1, end))];
  const duration = equipment => [condition(eq(ref('choices/minutes'), 15), masks(15, equipment),
    [condition(eq(ref('choices/minutes'), 30), masks(30, equipment), masks(45, equipment))])];
  return [condition(eq(ref('choices/equipment'), 'none'), duration('none'), duration('dumbbells')), navigate('builder')];
}

function loadCurrent() {
  const rows = Array.from({ length: 8 }, (_, i) => ({ condition: eq(ref('session/exercise'), i), actions: [
    ...['id', 'name', 'target', 'unit'].map(field => set(`session/${field}`, ref(`row/${i}/${field}`))),
    ...EXERCISES.map(ex => set(`art/${ex.id}`, eq(ref(`row/${i}/id`), ex.id))),
    set('session/next', add(add(ref(`row/${i}/name`), ' · set '), ref('session/set'))),
  ] }));
  return [{ type: 'CONDITIONAL', blocks: rows },
    set('session/set-label', add(add('SET ', ref('session/set')), ' OF 3')),
    set('session/position', add(add(add('Exercise ', add(ref('session/exercise'), 1)), ' of '), ref('plan/count'))),
    condition(eq(ref('session/completed'), expression('SUBTRACTION', ref('plan/sets'), 1)),
      [set('session/complete-label', 'Finish workout   ✓')], [set('session/complete-label', 'Complete set   ✓')])];
}
export const startActions = () => [condition(ref('plan/ready'), [set('session/completed', 0), set('session/exercise', 0), set('session/set', 1),
  set('session/save-label', 'Save this plan'), set('session/save-message', 'Keep this plan for another day.'),
  ...loadCurrent(), navigate('active')])];
export const completeActions = () => [set('session/completed', add(ref('session/completed'), 1)),
  condition(eq(ref('session/completed'), ref('plan/sets')), [set('session/has-result', true), set('session/title', ref('plan/title')),
    set('session/completed-label', str(ref('session/completed'))), set('session/count-label', str(ref('plan/count'))),
    set('session/minutes-label', str(ref('choices/minutes'))), navigate('done')],
  [condition(eq(ref('session/set'), 3), [set('session/exercise', add(ref('session/exercise'), 1)), set('session/set', 1)],
    [set('session/set', add(ref('session/set'), 1))]), ...loadCurrent(),
    set('session/rest', 45), set('session/rest-label', '45'), navigate('rest')])];
export const skipActions = () => [navigate('active')];
export const extendActions = () => [set('session/rest', add(ref('session/rest'), 15)), set('session/rest-label', str(ref('session/rest')))];
export const tickActions = destination => [condition(expression('GREATER_THAN', ref('session/rest'), 1),
  [set('session/rest', expression('SUBTRACTION', ref('session/rest'), 1)), set('session/rest-label', str(ref('session/rest'))), navigate(destination)], skipActions())];
export const saveActions = () => [set('session/save-label', 'Plan saved   ✓'), set('session/save-message', 'Saved for this prototype session.')];
export const historyActions = () => [condition(ref('session/has-result'), [navigate('done')], [navigate('history')])];
export const resetActions = () => [navigate('builder')];

// Seed exactly the same plan that the first presented screen shows.
for (const action of planActions(72, 30, 'none')) variables[action.name] = action.value.value;

export function evaluate(value, state) {
  if (value.type === 'VARIABLE_ALIAS') return state[value.name];
  if (value.type !== 'EXPRESSION') return value.value;
  const a = value.args.map(arg => evaluate(arg, state));
  switch (value.operator) {
    case 'ADDITION': return a[0] + a[1];
    case 'SUBTRACTION': return a[0] - a[1];
    case 'EQUALS': return a[0] === a[1];
    case 'LESS_THAN_OR_EQUAL': return a[0] <= a[1];
    case 'GREATER_THAN': return a[0] > a[1];
    case 'NOT': return !a[0];
    default: throw new Error(`Unknown expression ${value.operator}`);
  }
}
export function run(actions, state) {
  for (const action of actions) {
    if (action.type === 'SET_VARIABLE') state[action.name] = evaluate(action.value, state);
    else if (action.type === 'NODE') { (state.screenHistory ??= []).push(state.screen); state.screen = action.destination; }
    else if (action.type === 'BACK') state.screen = state.screenHistory?.pop();
    else if (action.type === 'URL') state.openedUrl = action.url;
    else if (action.type === 'CONDITIONAL') {
      const block = action.blocks.find(b => !b.condition || evaluate(b.condition, state));
      if (block) run(block.actions, state);
    }
  }
  return state;
}
