import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { createStaticServer } from '../scripts/serve.js';
import { buildPlan } from '../js/lib/planner.js';
import { ALL_PART_IDS, FULL_BODY } from '../js/data/body-parts.js';
import { EXERCISES } from '../js/data/exercises.js';
import { EXERCISES_PER_WORKOUT } from '../js/data/settings.js';

// ---------- Planner ----------

test('every area combination gets the unique, equipment-compatible exercises its time allows', () => {
  for (let mask = 1; mask < 2 ** ALL_PART_IDS.length; mask++) {
    const parts = ALL_PART_IDS.filter((_, index) => mask & (1 << index));
    for (const [minutes, count] of Object.entries(EXERCISES_PER_WORKOUT)) {
      for (const equipment of ['none', 'dumbbells']) {
        const plan = buildPlan({ parts, minutes: Number(minutes), equipment });
        const label = JSON.stringify({ parts, minutes, equipment });
        assert.equal(plan.length, count, label);
        assert.equal(new Set(plan.map((item) => item.exercise.id)).size, count, label);
        for (const { partId, exercise } of plan) {
          assert.ok(exercise.equipment === 'none' || exercise.equipment === equipment, label);
          assert.ok(partId === FULL_BODY.id || parts.includes(partId), label);
          assert.ok(partId === FULL_BODY.id || exercise.areas.includes(partId), label);
        }
      }
    }
  }
});

test('the chosen areas take turns, and extras are labelled full body', () => {
  const plan = buildPlan({ parts: ['legs', 'chest'], minutes: 30, equipment: 'none' });
  assert.deepEqual(plan.map((item) => item.partId), ['chest', 'legs', 'legs', 'full-body', 'full-body', 'full-body']);
});

test('dumbbell exercises only appear when dumbbells are chosen', () => {
  const back = (equipment) => buildPlan({ parts: ['back'], minutes: 15, equipment }).map((item) => item.exercise.id);
  assert.ok(!back('none').includes('bent-over-row'));
  assert.equal(back('dumbbells')[0], 'bent-over-row');
});

test('an empty selection produces an empty plan', () => {
  assert.deepEqual(buildPlan({ parts: [], minutes: 30, equipment: 'none' }), []);
});

test('every exercise has a unique id, known areas, a target and an image on disk', async () => {
  const areaIds = [...ALL_PART_IDS, FULL_BODY.id];
  assert.equal(new Set(EXERCISES.map((exercise) => exercise.id)).size, EXERCISES.length);
  for (const exercise of EXERCISES) {
    assert.ok(exercise.areas.length > 0, exercise.id);
    assert.ok(exercise.areas.every((area) => areaIds.includes(area)), exercise.id);
    assert.ok((exercise.reps && exercise.unit) || (exercise.seconds && exercise.cue), exercise.id);
    await access(new URL(`../${exercise.image}`, import.meta.url));
  }
});

// ---------- Server ----------

// Calls the real request handler without opening a network socket.
const handler = createStaticServer({ basePath: '/fitflow/' }).listeners('request')[0];

async function request(url, method = 'GET') {
  const response = {
    status: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body?.toString() ?? ''; },
  };
  await handler({ url, method }, response);
  return response;
}

test('public pages and modules are served with browser content types', async () => {
  for (const [url, type] of [
    ['/', 'text/html'], ['/workout.html', 'text/html'], ['/done.html', 'text/html'],
    ['/js/lib/planner.js', 'text/javascript'], ['/css/main.css', 'text/css'],
    ['/assets/images/exercises/squat.svg', 'image/svg+xml'],
  ]) {
    const response = await request(`/fitflow${url}`);
    assert.equal(response.status, 200, url);
    assert.ok(response.headers['Content-Type'].startsWith(type), url);
  }
  assert.equal((await request('/fitflow/', 'HEAD')).body, '');
});

test('server files, hidden files, folders and traversal paths are not public', async () => {
  for (const url of [
    '/scripts/serve.js', '/package.json', '/.gitignore', '/test/forma.test.js',
    '/js/../scripts/serve.js', '/assets/%2e%2e%2fserver/app.js', '/assets/%2e%2e%2f%2e%2e%2fserver/app.js',
    '/css/', '/css/components/', '/css/%00main.css', '/assets/%GG', '/missing.html',
  ]) {
    assert.equal((await request(`/fitflow${url}`)).status, 404, url);
  }
});

// ---------- Browser modules ----------

test('browser page imports name real exports', async () => {
  const pages = new URL('../js/pages/', import.meta.url);
  for (const filename of await readdir(pages)) {
    const page = new URL(filename, pages);
    const source = await readFile(page, 'utf8');
    for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
      const module = await import(new URL(match[2], page));
      for (const binding of match[1].split(',')) {
        const exportedName = binding.trim().split(/\s+as\s+/)[0];
        assert.ok(exportedName in module, `${filename}: ${exportedName} from ${match[2]}`);
      }
    }
  }
});
