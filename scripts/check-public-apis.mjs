/** Optional live check: no credentials; separate from deterministic npm test. */
import assert from 'node:assert/strict';
import { EXERCISE_SOURCES } from '../js/data/exercise-sources.js';
import { normalizeGuide } from '../js/lib/exercise-api.js';

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `${response.status} from ${url}`);
  return response.json();
}

const sources = Object.entries(EXERCISE_SOURCES);
const endpoint = new URL('https://wger.de/api/v2/exerciseinfo/');
endpoint.search = new URLSearchParams({ id__in: sources.map(([, s]) => s.wger).join(','), limit: String(sources.length) });
const data = await json(endpoint);
const guides = new Map(data.results.map(record => [record.id, normalizeGuide(record)]));
for (const [id, source] of sources) assert.ok(guides.get(source.wger), `Missing English/licensed guide: ${id}`);
console.log(`wger: ${sources.length} guides available.`);

// Serial requests keep this maintenance check gentle on the public service.
for (const [id, source] of sources) {
  const endpoint = new URL('https://www.youtube.com/oembed');
  endpoint.search = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${source.video}`, format: 'json' });
  const video = await json(endpoint);
  assert.equal(video.type, 'video', id);
  assert.equal(video.author_name, source.creator, `Review the video creator for ${id}`);
  console.log(`${id}: ${video.title} — ${video.author_name}`);
}
console.log('Metadata verified. Playback and embedding permissions still need a browser check.');
