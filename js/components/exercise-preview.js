import { createExerciseVideo } from './exercise-video.js';
import { createExerciseGuide } from './exercise-guide.js';

/** One inline preview per list; switching rows always stops the previous video. */
export function createExercisePreview() {
  let active;
  function close() {
    if (!active) return;
    active.video.stop();
    active.guide.dispose();
    active.panel.replaceChildren();
    active.panel.hidden = true;
    active.trigger.setAttribute('aria-expanded', 'false');
    active = undefined;
  }
  window.addEventListener('pagehide', close);
  return {
    close,
    toggle(exercise, card, trigger) {
      const wasOpen = active?.trigger === trigger;
      close();
      if (wasOpen) return;
      const panel = card.querySelector('.plan-item__preview');
      const video = createExerciseVideo();
      const guide = createExerciseGuide();
      video.setExercise(exercise);
      guide.setExercise(exercise);
      panel.append(video.element, guide.element);
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      active = { panel, trigger, video, guide };
    },
  };
}
