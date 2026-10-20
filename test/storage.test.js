import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChoices } from '../js/lib/choices.js';
import { buildPlan } from '../js/lib/planner.js';
import { loadCurrentWorkout, saveCurrentWorkout, loadLastWorkout, saveLastWorkout, savePlan } from '../js/lib/storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function setup(t) {
  const previous = globalThis.window;
  globalThis.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  return {
    title: 'Core', parts: ['core'], plan: buildPlan({ parts: ['core'], minutes: 15, equipment: 'none' }),
    startedAt: Date.now() - 1000, exerciseIndex: 0, setNumber: 1,
  };
}

test('malformed saved choices use defaults and known areas in catalogue order', () => {
  for (const value of [null, false, [], 5, 'bad', { parts: null, minutes: 'toString', equipment: '__proto__' }]) {
    assert.deepEqual(normalizeChoices(value), { parts: ['core', 'legs'], minutes: 30, equipment: 'none' });
  }
  assert.deepEqual(normalizeChoices({ parts: ['legs', 'invalid', 'core', 'core'], minutes: '15', equipment: 'dumbbells' }),
    { parts: ['core', 'legs'], minutes: 15, equipment: 'dumbbells' });
  assert.deepEqual(normalizeChoices({ parts: [] }).parts, []);
});

test('workout snapshots restore current catalogue records and progress', (t) => {
  const workout = setup(t);
  assert.equal(saveCurrentWorkout(workout), true);
  assert.deepEqual(loadCurrentWorkout(), workout);
  workout.plan[0] = { ...workout.plan[0], exercise: { id: workout.plan[0].exercise.id, image: '/wrong-path.svg' } };
  saveCurrentWorkout(workout);
  assert.ok(loadCurrentWorkout().plan[0].exercise.image.startsWith('assets/'));
});

test('invalid JSON, unknown exercises and out-of-range progress are rejected', (t) => {
  const workout = setup(t);
  window.sessionStorage.setItem('forma:current-workout', '{broken');
  assert.equal(loadCurrentWorkout(), null);
  for (const patch of [
    { plan: [null] }, { plan: [{ exercise: { id: 'missing' } }] }, { plan: [] },
    { exerciseIndex: -1 }, { exerciseIndex: workout.plan.length }, { setNumber: 4 },
    { parts: ['missing'] }, { startedAt: 'yesterday' },
  ]) {
    saveCurrentWorkout({ ...workout, ...patch });
    assert.equal(loadCurrentWorkout(), null, JSON.stringify(patch));
  }
});

test('blocked storage reports failure; summary can fall back to tab storage', (t) => {
  const workout = setup(t);
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } });
  assert.equal(savePlan({}), false);
  const result = { ...workout, finishedAt: Date.now() };
  assert.equal(saveLastWorkout(result), true);
  assert.deepEqual(loadLastWorkout(), result);
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Blocked'); } });
  assert.equal(saveCurrentWorkout(workout), false);
  assert.equal(saveLastWorkout(result), false);
  assert.equal(loadCurrentWorkout(), null);
});

test('saving a plan tolerates malformed saved-plan history', (t) => {
  setup(t);
  window.localStorage.setItem('forma:saved-plans', '{}');
  assert.equal(savePlan({ title: 'Core' }), true);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('forma:saved-plans')), [{ title: 'Core' }]);
});
