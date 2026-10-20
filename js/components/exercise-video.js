import { EXERCISE_SOURCES } from '../data/exercise-sources.js';
import { element, externalLink } from '../lib/dom.js';
import { mountVideo } from '../lib/youtube-player.js';

/** Replace an exercise illustration with its video in the same space. */
export function createExerciseVideo() {
  const root = element('div', 'exercise-video');
  const media = element('div', 'exercise-video__media');
  const poster = element('img', 'exercise-video__poster');
  poster.alt = '';
  const container = element('div', 'exercise-video__player');
  container.hidden = true;
  const watch = element('button', 'button button--primary exercise-video__watch', 'Watch video');
  watch.type = 'button';
  media.append(poster, container, watch);
  const footer = element('div', 'exercise-video__footer');
  const credit = element('p', 'exercise-video__credit');
  const restore = element('button', 'button button--secondary button--small', 'Show illustration');
  restore.type = 'button';
  restore.hidden = true;
  footer.append(credit, restore);
  const status = element('p', 'exercise-video__status');
  status.setAttribute('role', 'status');
  root.append(media, footer, status);
  let current;
  let dispose;

  function stop() {
    dispose?.();
    dispose = undefined;
    container.hidden = true;
    poster.hidden = false;
    watch.hidden = false;
    watch.textContent = 'Watch video';
    if (current) watch.setAttribute('aria-label', `Watch video: ${current.name}`);
    restore.hidden = true;
    status.textContent = '';
    media.setAttribute('aria-busy', 'false');
  }

  watch.addEventListener('click', () => {
    stop();
    poster.hidden = true;
    watch.hidden = true;
    container.hidden = false;
    restore.hidden = false;
    restore.focus();
    status.textContent = 'Loading video player…';
    media.setAttribute('aria-busy', 'true');
    dispose = mountVideo(container, {
      videoId: EXERCISE_SOURCES[current.id].video,
      title: current.name,
      onReady() {
        media.setAttribute('aria-busy', 'false');
        status.textContent = 'Video ready. Press play to watch the demonstration.';
        if (document.activeElement === restore) container.querySelector('iframe')?.focus();
      },
      onError(message) {
        const returnFocus = document.activeElement === restore || container.contains(document.activeElement);
        stop();
        watch.textContent = 'Retry video';
        watch.setAttribute('aria-label', `Retry video: ${current.name}`);
        status.textContent = message;
        if (returnFocus) watch.focus();
      },
    });
  });
  restore.addEventListener('click', () => {
    stop();
    watch.setAttribute('aria-label', `Watch video: ${current.name}`);
    watch.focus();
  });

  return {
    element: root,
    setExercise(exercise) {
      if (current?.id === exercise.id) return;
      stop();
      current = exercise;
      poster.src = exercise.image;
      watch.setAttribute('aria-label', `Watch video: ${exercise.name}`);
      const source = EXERCISE_SOURCES[exercise.id];
      credit.replaceChildren(externalLink(`Demo by ${source.creator} · Open on YouTube ↗`, `https://www.youtube.com/watch?v=${source.video}`));
    },
    stop,
  };
}
