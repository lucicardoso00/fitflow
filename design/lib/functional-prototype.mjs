import { BODY_PARTS } from '../../js/data/body-parts.js';
import { EXERCISES } from '../../js/data/exercises.js';
import * as model from './prototype-model.mjs';

/** Bind the screens to native variables and native conditional prototype actions. */
export async function functionalPrototype(ctx) {
  const { graph, frame, text, button, illustration, exerciseRow, masters, pDesktop, pMobile,
    builder, workout, rest, done, mobileBuild, mobilePlan, mobileWorkout, mobileRest, mobileDone, plan } = ctx;
  const descendants = root => graph.getChildren(root.id).flatMap(child => [child, ...descendants(child)]);
  const named = (root, name) => descendants(root).find(n => n.name === name);
  const wording = (root, value) => descendants(root).find(n => n.type === 'TEXT' && n.text === value);
  const collection = graph.createCollection('Forma / Prototype state');
  const variables = {};
  const bindings = [];
  const reactions = [];
  const screens = {};
  for (const [name, value] of Object.entries(model.variables)) {
    const type = typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'number' ? 'FLOAT' : typeof value === 'object' ? 'COLOR' : 'STRING';
    variables[name] = graph.createVariable(name, type, collection.id, value);
    variables[name].hiddenFromPublishing = true;
    variables[name].description = 'Interactive prototype state. Separate from the design tokens.';
  }
  function bind(n, field, name) {
    if (!n) throw new Error(`Cannot bind ${name}: missing node`);
    bindings.push({ node: n, field, variable: variables[name] });
    if (field === 'text') {
      graph.updateNode(n.id, { text: String(model.variables[name]) });
      const parent = graph.getNode(n.parentId);
      if (parent.type === 'INSTANCE') parent.overrides[`${n.id}:text`] = n.text;
    } else {
      graph.bindVariable(n.id, field, variables[name].id);
      if (field === 'visible') graph.updateNode(n.id, { visible: model.variables[name] });
    }
  }
  function react(n, actions, viewport, trigger = 'ON_CLICK', delay) {
    if (!n) throw new Error('Missing prototype control');
    reactions.push({ node: n, actions, viewport, trigger, delay });
  }
  const action = (root, caption) => named(root, `Button / ${caption}`);
  const caption = root => graph.getChildren(root.id).find(n => n.type === 'TEXT');
  async function gallery(parent, variablePrefix, width, height) {
    const originals = graph.getChildren(parent.id).filter(n => n.name.startsWith('Illustration /'));
    originals.forEach(n => graph.deleteNode(n.id));
    for (const ex of EXERCISES) {
      const art = await illustration(parent, ex.id, 0, 0, width, height);
      if (variablePrefix === 'art') bind(art, 'visible', `art/${ex.id}`);
    }
  }
  function choiceControl(control, key, viewport) {
    const parent = graph.getNode(control.parentId);
    const on = graph.createInstance(masters.chipOn.id, parent.id,
      { name: `${control.name} / on`, x: control.x, y: control.y, width: control.width });
    const off = graph.createInstance(masters.chipOff.id, parent.id,
      { name: `${control.name} / off`, x: control.x, y: control.y, width: control.width });
    const value = graph.getChildren(control.id).find(n => n.name === 'Label').text;
    for (const [instance, name] of [[on, `choice/${key}`], [off, `choice/${key}/off`]]) {
      const label = graph.getChildren(instance.id).find(n => n.name === 'Label');
      graph.updateNode(label.id, { text: value, width: control.width - 40 });
      instance.overrides[`${label.id}:text`] = value;
      const definition = graph.getNode(masters.chipOn.parentId).componentPropertyDefinitions.find(p => p.name === 'Label');
      instance.componentPropertyAssignments[definition.id] = value;
      bind(instance, 'visible', name);
      react(instance, model.choose(key), viewport);
    }
    graph.deleteNode(control.id);
  }
  for (const mobile of [false, true]) {
    const viewport = mobile ? 'Mobile' : 'Desktop';
    const page = mobile ? pMobile : pDesktop;
    const b = mobile ? mobileBuild : builder;
    const active = mobile ? mobileWorkout : workout;
    const resting = mobile ? mobileRest : rest;
    const complete = mobile ? mobileDone : done;
    const width = b.width;
    screens[viewport] = { builder: b, active, rest: resting, done: complete };
    for (const part of BODY_PARTS) {
      for (const region of descendants(b).filter(n => n.name === `focus-${part.id}`)) {
        for (const shape of [region, ...descendants(region)]) {
          if (shape.fills.length) {
            bind(shape, 'fills/0/color', `choice/${part.id}/color`);
            react(shape, model.choose(part.id), viewport);
          }
        }
      }
    }
    for (const control of descendants(b).filter(n => n.type === 'INSTANCE' && n.name.startsWith('Area /'))) {
      const label = graph.getChildren(control.id).find(n => n.name === 'Label').text;
      const key = { 'Full body': 'full-body', '15 min': '15', '30 min': '30', '45 min': '45', None: 'none', Dumbbells: 'dumbbells' }[label]
        ?? BODY_PARTS.find(p => p.label === label)?.id;
      if (key) choiceControl(control, key, viewport);
    }
    bind(wording(b, 'Core & legs'), 'text', 'plan/title');
    if (!mobile) {
      bind(wording(b, '2 body areas selected'), 'text', 'plan/focus-count');
      bind(wording(b, '30 min'), 'text', 'plan/duration');
      bind(wording(b, 'No equipment'), 'text', 'plan/equipment');
      bind(wording(b, '6 exercises   ·   3 sets each   ·   45 sec rest'), 'text', 'plan/summary');
      graph.updateNode(wording(b, 'Your next 30 minutes').id, { text: 'Your workout, ready to go.' });
      graph.updateNode(wording(b, 'YOUR PLAN / 6 EXERCISES').id, { text: 'YOUR PLAN' });
    } else {
      bind(wording(b, '6 exercises · 3 sets · 45 sec rest'), 'text', 'plan/summary');
      graph.updateNode(wording(b, 'Your next 30 minutes, ready to go.').id, { text: 'Your workout, ready to go.' });
    }
    const rowWidth = mobile ? 342 : 642;
    const list = frame(b, 'Plan / Auto layout list', mobile ? 24 : 734, mobile ? 1248 : 406,
      rowWidth, 8 * 88, null, { layoutMode: 'VERTICAL', itemSpacing: 4,
        primaryAxisSizing: 'AUTO', counterAxisSizing: 'FIXED', clipsContent: false });
    for (const row of graph.getChildren(b.id).filter(n => n.name.startsWith('Exercise /'))) graph.deleteNode(row.id);
    for (let i = 0; i < 8; i++) {
      const row = await exerciseRow(list, plan[i % plan.length], i, 0, i * 88, rowWidth, mobile);
      bind(row, 'visible', `row/${i}/visible`);
      const instance = graph.getChildren(row.id).find(n => n.type === 'INSTANCE');
      const fields = graph.getChildren(instance.id).filter(n => n.type === 'TEXT');
      bind(fields[0], 'text', `row/${i}/name`);
      bind(fields[1], 'text', `row/${i}/detail`);
      graph.updateNode(fields[2].id, { text: '' });
      instance.overrides[`${fields[2].id}:text`] = '';
      text(row, String(i + 1).padStart(2, '0'), 12, 24, 80, 24, 'accent', 600, { textAlignHorizontal: 'CENTER' });
      // Decorative thumbnails are neutral; the current movement has the complete native artwork gallery.
      for (const art of graph.getChildren(row.id).filter(n => n.name.startsWith('Illustration /'))) graph.deleteNode(art.id);
    }
    const empty = text(b, 'Choose at least one body area to build a workout.', mobile ? 24 : 734, mobile ? 1250 : 420,
      rowWidth, 16, 'secondary');
    bind(empty, 'visible', 'plan/empty');
    // Space for the longest eight-exercise plan; the scroll viewport remains 844/1000 px.
    if (mobile) {
      graph.updateNode(b.id, { height: 2120 });
      graph.updateNode(action(b, 'Start workout   →').id, { y: 2040 });
      const helper = wording(b, 'Your workout, ready to go.');
      graph.updateNode(helper.id, { y: 1990 });
    } else {
      graph.updateNode(b.id, { height: 1260 });
      graph.updateNode(named(b, 'Workout summary dock').id, { y: 1140 });
    }
    const start = action(b, 'Start workout   →');
    bind(start, 'visible', 'plan/ready');
    const blocked = button(graph.getNode(start.parentId), 'Choose body areas', start.x, start.y, start.width, 'Disabled');
    bind(blocked, 'visible', 'plan/empty');
    if (mobile) {
      const stack = frame(b, 'Plan / Responsive content', 24, 1150, 342, 900, null,
        { layoutMode: 'VERTICAL', primaryAxisSizing: 'AUTO', counterAxisSizing: 'FIXED', itemSpacing: 24, clipsContent: false });
      const heading = named(b, 'Core & legs');
      const summary = named(b, '6 exercises · 3 sets · 45 sec rest');
      const helper = wording(b, 'Your workout, ready to go.');
      for (const child of [heading, summary, list, helper]) graph.reparentNode(child.id, stack.id);
      graph.reparentNode(empty.id, list.id);
      const actions = frame(stack, 'Start action', 0, 0, 342, 52, null);
      for (const control of [start, blocked]) {
        graph.reparentNode(control.id, actions.id);
        graph.updateNode(control.id, { x: 0, y: 0 });
      }
    }
    react(start, model.startActions(), viewport);
    const navigation = descendants(b).find(n => n.type === 'TEXT' && ['History', 'Build     /     History'].includes(n.text));
    react(navigation, model.historyActions(), viewport);

    bind(wording(active, 'Squat'), 'text', 'session/name');
    bind(wording(active, '12'), 'text', 'session/target');
    const unit = wording(active, 'reps');
    graph.updateNode(unit.id, { x: mobile ? 24 : 0, y: mobile ? 674 : 294, width: mobile ? 342 : 474, fontSize: 16 });
    bind(unit, 'text', 'session/unit');
    bind(wording(active, 'SET 1 OF 3'), 'text', 'session/set-label');
    bind(wording(active, 'Exercise 2 of 6'), 'text', 'session/position');
    bind(wording(active, mobile ? 'CORE & LEGS' : 'CORE & LEGS / 30 MIN'), 'text', 'plan/title');
    const upNext = wording(active, mobile ? 'Up next: Squat · set 2' : 'Squat · set 2');
    graph.updateNode(upNext.id, { text: '45-second rest after each set.' });
    if (!mobile) graph.updateNode(wording(active, 'Legs · Glutes').id, { text: 'Follow the movement at your own pace.' });
    const finish = action(active, 'Complete set   ✓');
    bind(caption(finish), 'text', 'session/complete-label');
    react(finish, model.completeActions(), viewport);
    react(named(active, 'End workout'), model.resetActions(), viewport);
    const visual = named(active, 'Movement demonstration');
    await gallery(visual, 'art', visual.width, visual.height);
    // A numeric progress label tracks every exercise; remove the fixed six-segment decoration.
    for (const n of descendants(active).filter(n => n.name.startsWith('Progress /'))) graph.deleteNode(n.id);

    bind(wording(resting, '00:45'), 'text', 'session/rest-label');
    text(resting, 'seconds remaining', mobile ? 24 : 64, mobile ? 440 : 614, mobile ? 342 : 800, 16, 'secondary');
    bind(wording(resting, 'Squat · set 2'), 'text', 'session/next');
    if (!mobile) {
      bind(wording(resting, 'Exercise 2 of 6'), 'text', 'session/position');
      bind(wording(resting, 'CORE & LEGS / 30 MIN'), 'text', 'plan/title');
      const preview = named(resting, 'Next movement');
      await gallery(preview, 'art', preview.width, preview.height);
    }
    for (const n of descendants(resting).filter(n => n.name.startsWith('Progress /'))) graph.deleteNode(n.id);
    const restTick = graph.cloneTree(resting.id, page.id, { name: 'Rest / timer tick', x: mobile ? 2820 : 7600, y: 0 });
    screens[viewport].restTick = restTick;
    // Bind clone descendants by their stable relative tree paths.
    function copyBindings(original, copy) {
      for (const binding of bindings.filter(b => b.node.id === original.id)) {
        bind(copy, binding.field, binding.variable.name);
      }
      const a = graph.getChildren(original.id), z = graph.getChildren(copy.id);
      a.forEach((n, i) => copyBindings(n, z[i]));
    }
    copyBindings(resting, restTick);
    for (const [screen, destination] of [[resting, 'restTick'], [restTick, 'rest']]) {
      react(screen, model.tickActions(destination), viewport, 'AFTER_TIMEOUT', 1);
      react(action(screen, '+ 15 sec'), model.extendActions(), viewport);
      react(action(screen, 'Skip rest   →'), model.skipActions(), viewport);
      react(named(screen, 'End workout'), model.resetActions(), viewport);
    }
    const stats = named(complete, mobile ? 'Results' : 'Session results');
    const numbers = descendants(stats).filter(n => n.type === 'TEXT' && /^\d+$/.test(n.text));
    ['session/minutes-label', 'session/count-label', 'session/completed-label'].forEach((name, i) => bind(numbers[i], 'text', name));
    const minutes = wording(stats, 'minutes') ?? wording(stats, 'min');
    if (minutes) graph.updateNode(minutes.id, { text: 'planned minutes' });
    const focus = descendants(complete).find(n => n.type === 'TEXT' && n.text.includes('Tuesday'));
    if (focus) bind(focus, 'text', 'session/title');
    // The summary describes the completed session, even if builder choices later change.
    const body = descendants(complete).find(n => n.name.startsWith('Body map /'));
    if (body) graph.deleteNode(body.id);
    for (const pill of descendants(complete).filter(n => n.type === 'FRAME' && ['Core', 'Legs'].includes(n.name))) graph.deleteNode(pill.id);
    if (!mobile) bind(text(complete, 'Core & Legs', 950, 682, 350, 28, 'accent', 600), 'text', 'session/title');
    else {
      bind(wording(complete, 'Core & legs trained'), 'text', 'session/title');
      text(complete, '✓', 24, 510, 342, 96, 'accent', 600, { textAlignHorizontal: 'CENTER' });
    }
    const save = action(complete, 'Save this plan');
    bind(caption(save), 'text', 'session/save-label');
    react(save, model.saveActions(), viewport);
    const message = wording(complete, 'Keep this plan for another day.')
      ?? (mobile ? text(complete, 'Keep this plan for another day.', 24, 666, 342, 13, 'secondary', 400, { textAlignHorizontal: 'CENTER' }) : wording(complete, 'Saved on this device.'));
    if (message) bind(message, 'text', 'session/save-message');
    for (const n of descendants(complete).filter(n => n.type === 'TEXT' && n.text === 'Saved on this device.')) {
      graph.updateNode(n.id, { text: 'Saved state lasts for this prototype session.' });
    }
    react(action(complete, 'Build another workout   →'), model.resetActions(), viewport);
    const back = descendants(complete).find(n => n.type === 'TEXT' && ['Build again', 'Build     /     History'].includes(n.text));
    if (back) react(back, model.resetActions(), viewport);
    const history = frame(page, 'History / no completed workout', mobile ? 3290 : 9120, 0, width, mobile ? 844 : 1000, 'base');
    text(history, 'Your history starts here.', mobile ? 24 : 64, 160, width - (mobile ? 48 : 128), mobile ? 32 : 44, 'text', 600);
    text(history, 'Finish a workout to see your session summary.', mobile ? 24 : 64, 280, width - (mobile ? 48 : 128), 16, 'secondary');
    react(button(history, 'Build a workout   →', mobile ? 24 : 64, 400, mobile ? 342 : 320), model.resetActions(), viewport);
    screens[viewport].history = history;
    // Single dispatcher keeps hundreds of combinations out of the visible flow.
    const refresh = frame(page, 'Update plan / conditional logic', mobile ? 3760 : 10640, 0, width, mobile ? 844 : 1000, 'base');
    text(refresh, 'Updating your workout…', mobile ? 24 : 64, 180, width - (mobile ? 48 : 128), 24, 'text', 600);
    screens[viewport].refresh = refresh;
    react(refresh, model.refreshActions(), viewport, 'AFTER_TIMEOUT', 0.01);
  }
  // Native viewport frames scroll their content; mobile controls stay legible in Present.
  for (const [viewport, nodes] of Object.entries(screens)) {
    const height = viewport === 'Mobile' ? 844 : 1000;
    for (const screen of [nodes.builder, nodes.done]) {
      if (screen.height <= height) continue;
      const children = graph.getChildren(screen.id);
      const mobileBuilder = viewport === 'Mobile' && screen === nodes.builder;
      const content = frame(screen, `${viewport} / ${screen === nodes.builder ? 'Builder' : 'Summary'} content`, 0, 0,
        screen.width, screen.height, 'base', mobileBuilder ? { layoutMode: 'VERTICAL', primaryAxisSizing: 'AUTO',
          counterAxisSizing: 'FIXED', paddingLeft: 24, paddingRight: 24, paddingBottom: 32, itemSpacing: 24, clipsContent: false } : { clipsContent: false });
      if (mobileBuilder) frame(content, 'Space for choices', 0, 0, 342, 1126, null);
      for (const child of children) {
        graph.reparentNode(child.id, content.id);
        if (mobileBuilder && child.name !== 'Plan / Responsive content') graph.updateNode(child.id, { layoutPositioning: 'ABSOLUTE' });
      }
      graph.updateNode(screen.id, { height, clipsContent: true });
    }
    if (viewport === 'Mobile') Object.values(nodes).forEach((n, index) => graph.updateNode(n.id, { x: index * 470 }));
  }
  const starts = Object.entries(screens).map(([viewport, nodes]) => ({ node: nodes.builder, name: `${viewport} workout`,
    description: 'Choose areas, time and equipment. Train, extend or skip rest, finish, save and build again.' }));
  return { variables, bindings, reactions, screens, starts,
    note: 'All 762 nonempty area/time/equipment combinations. 12–24 sets. Live rest countdown, repeatable +15 seconds, skip, end, finish, save and history. Save is session-only; planned minutes are shown in the prototype summary.' };
}
