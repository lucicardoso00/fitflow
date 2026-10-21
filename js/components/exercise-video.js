/**
 * Exercise video — the illustration of an exercise with a "Watch video"
 * button that swaps in the YouTube player, and a "Show illustration" button
 * that swaps it back. The markup lives in the page; this only wires it up.
 *
 *   const video = createExerciseVideo(root);
 *   video.show(exercise);   video.stop();
 */

import { EXERCISE_SOURCES } from '../data/exercise-sources.js';

export function createExerciseVideo(root) {
  const poster = root.querySelector('.exercise-video__poster');
  const player = root.querySelector('.exercise-video__player');
  const watchButton = root.querySelector('.exercise-video__watch');
  const restoreButton = root.querySelector('.exercise-video__restore');
  const link = root.querySelector('.exercise-video__link');

  let exercise = null;

  function show(nextExercise) {
    if (exercise?.id === nextExercise.id) {
      return;
    }
    exercise = nextExercise;
    const source = EXERCISE_SOURCES[exercise.id];

    poster.src = exercise.image;
    poster.alt = exercise.name;
    player.title = `${exercise.name} — video demonstration`;
    watchButton.setAttribute('aria-label', `Watch video: ${exercise.name}`);
    link.href = `https://www.youtube.com/watch?v=${source.video}`;
    link.textContent = `Demo by ${source.creator} · Open on YouTube ↗`;
    stop();
  }

  function play() {
    player.src = `https://www.youtube-nocookie.com/embed/${EXERCISE_SOURCES[exercise.id].video}?rel=0`;
    player.hidden = false;
    poster.hidden = true;
    watchButton.hidden = true;
    restoreButton.hidden = false;
    restoreButton.focus();
  }

  /** Back to the illustration. Sending the player to an empty page also stops the sound. */
  function stop() {
    player.src = 'about:blank';
    player.hidden = true;
    poster.hidden = false;
    watchButton.hidden = false;
    restoreButton.hidden = true;
  }

  watchButton.addEventListener('click', play);
  restoreButton.addEventListener('click', () => {
    stop();
    watchButton.focus();
  });

  return { show, stop };
}
