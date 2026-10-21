/**
 * Format — turns data into text for the screen.
 */

import { SETS_PER_EXERCISE } from '../data/settings.js';

/** 45 → "0:45", 75 → "1:15" */
export function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** The plan row text: "3 × 12 reps" or "3 × 40 sec" */
export function formatAmount(exercise) {
  if (exercise.seconds) {
    return `${SETS_PER_EXERCISE} × ${exercise.seconds} sec`;
  }
  return `${SETS_PER_EXERCISE} × ${exercise.reps} ${exercise.unit}`;
}

/** The big number during a set: { value: '12', unit: 'reps' } or { value: '0:40', unit: 'hold' } */
export function formatSetTarget(exercise) {
  if (exercise.seconds) {
    return { value: formatClock(exercise.seconds), unit: exercise.cue };
  }
  return { value: String(exercise.reps), unit: exercise.unit };
}

/** A timestamp → "Monday" */
export function getWeekday(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', { weekday: 'long' });
}

