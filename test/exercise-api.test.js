import test from 'node:test';
import assert from 'node:assert/strict';
import { createExerciseApi, normalizeGuide } from '../js/lib/exercise-api.js';
import { EXERCISES } from '../js/data/exercises.js';
import { EXERCISE_SOURCES } from '../js/data/exercise-sources.js';

const DAY = 86400000;
const record = (id = 458) => ({
  id, muscles: [{ name: 'Rectus abdominis', name_en: 'Abs' }],
  license: { id: 2 },
  translations: [
    { language: 1, name: 'Unterarmstütz', description: '<p>Deutsch</p>', license: 2 },
    { language: 2, name: 'Plank', description: '<p>Keep your body straight.</p>', license: 1, license_author: 'Original author' },
  ],
});
const ok = records => ({ ok: true, json: async () => ({ results: records }) });
const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
};

test('every planned exercise has an explicit guide and video match', () => {
  for (const exercise of EXERCISES) {
    const source = EXERCISE_SOURCES[exercise.id];
    assert.ok(Number.isInteger(source.wger));
    assert.match(source.video, /^[\w-]{11}$/);
    assert.ok(source.creator);
  }
});

test('guide normalization selects English and the translation licence, rejects malformed records', () => {
  const guide = normalizeGuide(record());
  assert.equal(guide.name, 'Plank');
  assert.equal(guide.licenseId, 1);
  assert.equal(guide.author, 'Original author');
  assert.deepEqual(guide.muscles, ['Abs']);
  for (const invalid of [null, {}, { ...record(), id: 1234567 }, { ...record(), translations: {} },
    { ...record(), translations: [{ language: 2, name: 'Plank', description: 'Text', license: 'constructor' }] },
    { ...record(), translations: [{ language: 1, description: 'Text', license: 1 }] }]) {
    assert.equal(normalizeGuide(invalid), null);
  }
});

test('visible movements use a single bounded request; fresh cache survives a new client', async () => {
  const storage = memory();
  let calls = 0;
  const api = createExerciseApi({ storage, now: () => DAY, fetcher: async (url, options) => {
    calls++;
    assert.equal(url.origin, 'https://wger.de');
    assert.equal(url.searchParams.get('id__in'), '458,1551');
    assert.equal(url.searchParams.get('limit'), '2');
    assert.equal(options.credentials, 'omit');
    return ok([record(), record(1551)]);
  } });
  const results = await api.load(['plank', 'push-up', 'plank']);
  assert.equal(results.filter(result => result.guide).length, 3);
  const next = createExerciseApi({ storage, now: () => DAY + 100, fetcher: () => { throw Error('Should use cache'); } });
  assert.equal((await next.load(['plank']))[0].guide.name, 'Plank');
  assert.equal(calls, 1);
});

test('an outage offers recent cached data but expires it after seven days', async () => {
  let time = DAY;
  let fail = false;
  const api = createExerciseApi({ storage: memory(), now: () => time, fetcher: async () => {
    if (fail) throw new TypeError('Offline');
    return ok([record()]);
  } });
  await api.load(['plank']);
  fail = true;
  time += 2 * DAY;
  const stale = (await api.load(['plank']))[0];
  assert.equal(stale.stale, true);
  assert.equal(stale.guide.name, 'Plank');
  time += 6 * DAY;
  const expired = (await api.load(['plank']))[0];
  assert.equal(expired.guide, null);
  assert.equal(expired.unavailable, true);
});

test('429, invalid JSON and missing records stay unavailable rather than inventing guides', async () => {
  for (const fetcher of [
    async () => ({ ok: false, status: 429 }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Bad JSON'); } }),
    async () => ({ ok: true, json: async () => ({ unexpected: [] }) }),
    async () => ok([record(1551)]),
  ]) {
    const api = createExerciseApi({ storage: null, fetcher });
    const [result] = await api.load(['plank']);
    assert.equal(result.guide, null);
    assert.equal(result.unavailable, true);
  }
});

test('corrupt or blocked browser storage never prevents a live guide', async () => {
  for (const storage of [
    { getItem: () => 'bad json', setItem() { throw Error('Quota exceeded'); } },
    { getItem: () => JSON.stringify([[458, { guide: {}, fetchedAt: DAY }]]), setItem() {} },
    { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } },
  ]) {
    const api = createExerciseApi({ storage, now: () => DAY, fetcher: async () => ok([record()]) });
    assert.equal((await api.load(['plank']))[0].guide.name, 'Plank');
  }
});

test('requests time out; explicit cancellation rejects so an old plan cannot update the screen', async () => {
  const fetcher = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const api = createExerciseApi({ storage: null, fetcher, timeout: 10 });
  assert.equal((await api.load(['plank']))[0].unavailable, true);
  const controller = new AbortController();
  const pending = api.load(['plank'], { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
