/**
 * Storage — remembers data between pages and visits.
 *
 *   localStorage    kept between visits: last choices, last workout, saved plans
 *   sessionStorage  kept for this tab only: the workout in progress
 *
 * Browsers can block storage. Writes return a boolean so pages can explain
 * failures before navigating away from the data they need.
 */

import { ALL_PART_IDS, FULL_BODY } from '../data/body-parts.js';
import { EXERCISES } from '../data/exercises.js';
import { SETS_PER_EXERCISE } from '../data/settings.js';

const KEYS = {
  choices: 'forma:choices',
  currentWorkout: 'forma:current-workout',
  lastWorkout: 'forma:last-workout',
  savedPlans: 'forma:saved-plans',
};

function read(storageName, key) {
  try {
    const text = window[storageName].getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function write(storageName, key, value) {
  try {
    window[storageName].setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Validate snapshots before a page uses them; discard obsolete exercises. */
function readWorkout(storageName, key, completed = false) {
  const workout = read(storageName, key);
  if (!workout || typeof workout.title !== 'string'
    || !Array.isArray(workout.parts) || !workout.parts.every((id) => ALL_PART_IDS.includes(id))
    || !Number.isFinite(workout.startedAt) || workout.startedAt <= 0
    || !Array.isArray(workout.plan) || workout.plan.length === 0
    || workout.plan.length > EXERCISES.length) return null;

  const plan = [];
  for (const item of workout.plan) {
    const exercise = EXERCISES.find((entry) => entry.id === item?.exercise?.id);
    if (!exercise || ![...ALL_PART_IDS, FULL_BODY.id].includes(item.partId)) return null;
    plan.push({ partId: item.partId, exercise });
  }

  if (completed) {
    if (!Number.isFinite(workout.finishedAt) || workout.finishedAt < workout.startedAt) return null;
  } else if (!Number.isInteger(workout.exerciseIndex)
    || workout.exerciseIndex < 0 || workout.exerciseIndex >= plan.length
    || !Number.isInteger(workout.setNumber)
    || workout.setNumber < 1 || workout.setNumber > SETS_PER_EXERCISE) return null;

  return { ...workout, plan };
}

function remove(storageName, key) {
  try {
    window[storageName].removeItem(key);
  } catch {
    // Storage is blocked: nothing to remove
  }
}

// ---------- Builder choices (areas, time, equipment) ----------

export function loadChoices() {
  return read('localStorage', KEYS.choices);
}

export function saveChoices(choices) {
  return write('localStorage', KEYS.choices, choices);
}

// ---------- Workout in progress ----------

export function loadCurrentWorkout() {
  return readWorkout('sessionStorage', KEYS.currentWorkout);
}

export function saveCurrentWorkout(workout) {
  return write('sessionStorage', KEYS.currentWorkout, workout);
}

export function clearCurrentWorkout() {
  remove('sessionStorage', KEYS.currentWorkout);
}

// ---------- Last finished workout ----------

export function loadLastWorkout() {
  return readWorkout('sessionStorage', KEYS.lastWorkout, true)
    ?? readWorkout('localStorage', KEYS.lastWorkout, true);
}

export function saveLastWorkout(workout) {
  // The summary still works for this tab when persistent storage is unavailable.
  const persistent = write('localStorage', KEYS.lastWorkout, workout);
  const session = write('sessionStorage', KEYS.lastWorkout, workout);
  return persistent || session;
}

// ---------- Saved plans ----------

export function savePlan(plan) {
  const savedPlans = read('localStorage', KEYS.savedPlans);
  return write('localStorage', KEYS.savedPlans, [...(Array.isArray(savedPlans) ? savedPlans : []), plan]);
}
