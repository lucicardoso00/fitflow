/**
 * Exercise guide — a <details> box with the written instructions from wger.
 * The text is fetched the first time the box is open for an exercise.
 * The markup lives in the page; this only wires it up.
 *
 *   const guide = createExerciseGuide(root);
 *   guide.show(exercise);
 */

import { EXERCISE_SOURCES } from '../data/exercise-sources.js';
import { fetchGuide } from '../lib/exercise-guides.js';

export function createExerciseGuide(root) {
  const setup = root.querySelector('.exercise-guide__setup');
  const status = root.querySelector('.exercise-guide__status');
  const instructions = root.querySelector('.exercise-guide__instructions');
  const muscles = root.querySelector('.exercise-guide__muscles');
  const credit = root.querySelector('.exercise-guide__credit');
  const sourceLink = root.querySelector('.exercise-guide__source');
  const author = root.querySelector('.exercise-guide__author');
  const licenseLink = root.querySelector('.exercise-guide__license');
  const retryButton = root.querySelector('.exercise-guide__retry');

  let exercise = null;
  let shownGuideFor = null; // id of the exercise whose guide is on screen

  function show(nextExercise) {
    if (exercise?.id === nextExercise.id) {
      return;
    }
    exercise = nextExercise;
    setup.textContent = EXERCISE_SOURCES[exercise.id].setup ?? '';
    clear();
    if (root.open) {
      load();
    }
  }

  function clear() {
    shownGuideFor = null;
    status.textContent = '';
    instructions.replaceChildren();
    muscles.textContent = '';
    credit.hidden = true;
    retryButton.hidden = true;
  }

  async function load() {
    if (shownGuideFor === exercise.id) {
      return;
    }
    const requested = exercise;
    status.textContent = 'Loading the guide…';
    retryButton.hidden = true;

    try {
      const guide = await fetchGuide(requested.id);
      if (requested === exercise) {
        fill(guide);
      }
    } catch {
      if (requested === exercise) {
        status.textContent = 'The guide could not be loaded. You can still watch the video or keep training.';
        retryButton.hidden = false;
      }
    }
  }

  function fill(guide) {
    shownGuideFor = exercise.id;
    status.textContent = '';
    instructions.replaceChildren(copySafeFormatting(guide.description));
    muscles.textContent = guide.muscles.length ? `Works: ${guide.muscles.join(', ')}.` : '';

    sourceLink.href = `https://wger.de/en/exercise/${guide.id}/view/`;
    sourceLink.textContent = `${guide.name} on wger`;
    author.textContent = guide.author;
    licenseLink.href = guide.license.url;
    licenseLink.textContent = guide.license.name;
    credit.hidden = false;
  }

  root.addEventListener('toggle', () => {
    if (root.open) {
      load();
    }
  });
  retryButton.addEventListener('click', load);

  return { show };
}

/**
 * wger writes its descriptions in HTML. Only paragraphs, lists, bold and
 * italics are copied over; every other tag is dropped (its text is kept),
 * and scripts and styles are dropped completely.
 */
export function copySafeFormatting(html) {
  const KEPT_TAGS = ['P', 'OL', 'UL', 'LI', 'STRONG', 'EM', 'BR'];
  const DROPPED_COMPLETELY = ['SCRIPT', 'STYLE'];

  const parsed = document.createElement('template');
  parsed.innerHTML = html;

  function copy(node, into) {
    if (node.nodeType === Node.TEXT_NODE) {
      into.append(node.textContent);
    } else if (KEPT_TAGS.includes(node.tagName)) {
      const copied = document.createElement(node.tagName);
      into.append(copied);
      for (const child of node.childNodes) copy(child, copied);
    } else if (!DROPPED_COMPLETELY.includes(node.tagName)) {
      for (const child of node.childNodes) copy(child, into);
    }
  }

  const result = document.createDocumentFragment();
  for (const child of parsed.content.childNodes) copy(child, result);
  return result;
}
