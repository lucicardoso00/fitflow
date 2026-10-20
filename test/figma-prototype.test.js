import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../design/lib/prototype-model.mjs';
import { buildPlan } from '../js/lib/planner.js';
import { BODY_PARTS } from '../js/data/body-parts.js';

test('Figma choices rebuild every supported workout with the app planner', () => {
  const refresh = p.refreshActions();
  for (let mask = 1; mask < 128; mask++) for (const minutes of [15, 30, 45]) for (const equipment of ['none', 'dumbbells']) {
    const state = { ...p.variables, 'choices/mask': mask, 'choices/minutes': minutes, 'choices/equipment': equipment };
    p.run(refresh, state);
    const expected = buildPlan({ parts: BODY_PARTS.filter((_, i) => mask & (1 << i)).map(x => x.id), minutes, equipment });
    assert.deepEqual(expected.map(x => x.exercise.id), expected.map((_, i) => state[`row/${i}/id`]));
    assert.equal(state['plan/count'], expected.length);
    assert.equal(state['plan/sets'], expected.length * 3);
    assert.equal(state.screen, 'builder');
  }
});

test('Figma selection toggles, radio exclusivity and empty-plan gating', () => {
  const state = { ...p.variables };
  p.run(p.choose('core'), state);
  assert.equal(state['choices/mask'], 64);
  assert.equal(state['choice/core'], false);
  assert.equal(state['choice/core/off'], true);
  p.run(p.choose('core'), state);
  assert.equal(state['choices/mask'], 72);
  assert.equal(state['choice/core/off'], false);
  p.run(p.choose('15'), state);
  assert.equal(state['choice/15'], true);
  assert.equal(state['choice/30'], false);
  p.run(p.choose('full-body'), state);
  assert.equal(state['choices/mask'], 127);
  p.run(p.choose('full-body'), state);
  p.run(p.refreshActions(), state);
  p.run(p.startActions(), state);
  assert.equal(state.screen, 'builder');
  assert.equal(state['plan/ready'], false);
});

test('Figma completes the selected plan, supports ticking and repeated rest extensions, save and history', () => {
  for (const minutes of [15, 30, 45]) {
    const state = { ...p.variables, 'choices/minutes': minutes };
    p.run(p.historyActions(), state); assert.equal(state.screen, 'history');
    p.run(p.refreshActions(), state); p.run(p.startActions(), state);
    const count = state['plan/count'];
    for (let index = 0; index < count * 3; index++) {
      assert.equal(state.screen, 'active');
      assert.equal(state['session/name'], state[`row/${Math.floor(index / 3)}/name`]);
      assert.equal(state['session/set'], index % 3 + 1);
      p.run(p.completeActions(), state);
      if (index === count * 3 - 1) break;
      assert.equal(state.screen, 'rest');
      p.run(p.extendActions(), state); p.run(p.extendActions(), state);
      assert.equal(state['session/rest'], 75);
      for (let tick = 0; tick < 75; tick++) p.run(p.tickActions(tick % 2 ? 'rest' : 'restTick'), state);
      assert.equal(state.screen, 'active');
    }
    assert.equal(state.screen, 'done');
    assert.equal(state['session/completed-label'], String(count * 3));
    p.run(p.saveActions(), state); assert.equal(state['session/save-label'], 'Plan saved   ✓');
    p.run(p.resetActions(), state); assert.equal(state.screen, 'builder');
    p.run(p.historyActions(), state); assert.equal(state.screen, 'done');
  }
});
