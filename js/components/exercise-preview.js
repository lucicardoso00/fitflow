/**
 * Exercise preview — the video and guide that open under a row of the plan.
 * There is one preview panel per page; opening a row moves it there, so only
 * one row is ever open and the previous video always stops.
 *
 *   const preview = createExercisePreview(template);  // <template id="exercise-preview-template">
 *   preview.toggle(row, exercise);   preview.close();
 */

import { createExerciseVideo } from './exercise-video.js';
import { createExerciseGuide } from './exercise-guide.js';

export function createExercisePreview(template) {
  const panel = template.content.firstElementChild.cloneNode(true);
  const video = createExerciseVideo(panel.querySelector('.exercise-video'));
  const guide = createExerciseGuide(panel.querySelector('.exercise-guide'));

  let openRow = null;

  function toggle(row, exercise) {
    const wasOpen = row === openRow;
    close();
    if (!wasOpen) {
      open(row, exercise);
    }
  }

  function open(row, exercise) {
    openRow = row;
    row.querySelector('.plan-item__preview').append(panel);
    row.querySelector('.plan-item__name').setAttribute('aria-expanded', 'true');
    video.show(exercise);
    guide.show(exercise);
  }

  function close() {
    if (!openRow) {
      return;
    }
    video.stop();
    panel.remove();
    openRow.querySelector('.plan-item__name').setAttribute('aria-expanded', 'false');
    openRow = null;
  }

  return { toggle, close };
}
