/**
 * Exercise guides — written instructions from the public wger API.
 *
 *   const guide = await fetchGuide('plank');
 *   // { id, name, description (HTML), muscles, author }
 *
 * A guide is fetched the first time it is needed and then kept in memory
 * for the rest of the page. Nothing else in the app depends on this file:
 * the plan, the sets and the rest timer work without a network.
 */

import { EXERCISE_SOURCES } from '../data/exercise-sources.js';

const API_URL = 'https://wger.de/api/v2/exerciseinfo/';
const TIMEOUT_MS = 8000;
const ENGLISH = 2; // wger's id for the English language
/** exerciseId → guide. Exported so tests can start from an empty cache. */    

export async function fetchGuide(exerciseId, fetcher = fetch) {

  const wgerId = EXERCISE_SOURCES[exerciseId].wger;
  const response = await fetcher(`${API_URL}?id__in=${wgerId}&limit=1`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`wger answered ${response.status}`);
  }

  const { results } = await response.json();
  const guide = parseGuide(results.find((record) => record.id === wgerId));
  return guide;
}

/**
 * Picks the English text out of a wger record.
 * Throws when there is no English text or the licence is unknown, because
 * a guide is only shown together with its author and licence.
 */
export function parseGuide(record) {
  const english = record?.translations?.find((translation) => translation.language === SPANNISH);

  if (!english?.name || !english.description ) {
    throw new Error('No English guide with a known licence');
  }

  return {
    id: record.id,
    name: english.name,
    description: english.description,
    muscles: (record.muscles ?? []).map((muscle) => muscle.name_en || muscle.name),
    author: english.license_author || 'wger contributors',
  };
}
