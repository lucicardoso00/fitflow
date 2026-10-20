import { EXERCISE_SOURCES, WGER_LICENSES } from '../data/exercise-sources.js';

const API_URL = 'https://wger.de/api/v2/exerciseinfo/';
const CACHE_KEY = 'forma:exercise-guides:v1';
const FRESH_FOR = 24 * 60 * 60 * 1000;
const KEEP_FOR = 7 * FRESH_FOR;
const knownIds = new Set(Object.values(EXERCISE_SOURCES).map(source => source.wger));
const limitedText = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

/** Reject missing translations and preserve the translation's own attribution. */
export function normalizeGuide(record) {
  if (!record || !knownIds.has(record.id)) return null;
  const translation = Array.isArray(record.translations) ? record.translations.find(item => item?.language === 2) : null;
  const license = Object.hasOwn(WGER_LICENSES, translation?.license) ? WGER_LICENSES[translation.license] : null;
  const description = limitedText(translation?.description, 16000);
  if (!translation?.name || !description || !license) return null;
  return {
    id: record.id,
    name: limitedText(translation.name),
    description,
    muscles: (Array.isArray(record.muscles) ? record.muscles : [])
      .slice(0, 12).map(muscle => limitedText(muscle?.name_en || muscle?.name)).filter(Boolean),
    author: limitedText(translation.license_author || (Array.isArray(translation.author_history) ? translation.author_history.join(', ') : '') || 'wger contributors', 1000),
    licenseId: translation.license,
  };
}

function validCachedGuide(guide, id) {
  return guide?.id === id && typeof guide.name === 'string' && guide.name.length <= 200
    && typeof guide.description === 'string' && guide.description.length > 0 && guide.description.length <= 16000
    && typeof guide.author === 'string' && guide.author.length <= 1000
    && Array.isArray(guide.muscles) && guide.muscles.length <= 12
    && guide.muscles.every(value => typeof value === 'string' && value.length <= 200)
    && Object.hasOwn(WGER_LICENSES, guide.licenseId);
}

/** Small cache and bounded fetches. A service outage never changes a workout. */
export function createExerciseApi({ fetcher = globalThis.fetch, storage, now = Date.now, timeout = 8000 } = {}) {
  if (storage === undefined) {
    try { storage = typeof window === 'undefined' ? null : window.localStorage; } catch { storage = null; }
  }
  const cache = new Map();
  try {
    const entries = JSON.parse(storage?.getItem(CACHE_KEY) || '[]');
    if (Array.isArray(entries)) {
      for (const [id, entry] of entries.filter(Array.isArray)) {
        const age = now() - entry?.fetchedAt;
        if (knownIds.has(id) && age >= 0 && age < KEEP_FOR && validCachedGuide(entry?.guide, id)) cache.set(id, entry);
      }
    }
  } catch { /* Site storage is optional; the in-memory cache still works. */ }

  function persist() {
    try { storage?.setItem(CACHE_KEY, JSON.stringify([...cache])); } catch { /* Quota/private mode. */ }
  }

  async function load(exerciseIds, { signal, force = false } = {}) {
    signal?.throwIfAborted();
    const ids = [...new Set(exerciseIds.map(id => EXERCISE_SOURCES[id]?.wger).filter(Boolean))];
    const missing = ids.filter(id => force || !cache.has(id) || now() - cache.get(id).fetchedAt >= FRESH_FOR);
    let unavailable = false;
    if (missing.length) {
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('Exercise service timed out')), timeout);
      try {
        const url = new URL(API_URL);
        url.search = new URLSearchParams({ id__in: missing.join(','), limit: String(missing.length) });
        const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Exercise service returned ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.results)) throw new Error('Invalid exercise response');
        for (const record of data.results) {
          if (!missing.includes(record.id)) continue;
          const guide = normalizeGuide(record);
          if (guide) cache.set(record.id, { guide, fetchedAt: now() });
        }
        persist();
      } catch (error) {
        if (signal?.aborted) throw error;
        unavailable = true;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }
    signal?.throwIfAborted();
    return exerciseIds.map(exerciseId => {
      const entry = cache.get(EXERCISE_SOURCES[exerciseId]?.wger);
      const age = entry ? now() - entry.fetchedAt : Infinity;
      const guide = age >= 0 && age < KEEP_FOR ? entry.guide : null;
      return { exerciseId, guide, stale: Boolean(guide && (age >= FRESH_FOR || unavailable)), unavailable: !guide };
    });
  }

  return { load };
}

export const exerciseApi = createExerciseApi();
