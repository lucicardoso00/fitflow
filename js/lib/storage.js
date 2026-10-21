/**
 * Storage — remembers data between pages and visits.
 *
 *   localStorage    kept between visits: last choices, last workout, saved plans
 *   sessionStorage  kept for this tab only: the workout in progress
 *
 * Browsers can block storage (private mode, strict settings). Reads then
 * return null and writes return false, so a page can tell the person.
 */

import { EXERCISES } from '../data/exercises.js';

const KEYS = {
  choices: 'fitflow:choices',
  currentWorkout: 'fitflow:current-workout',
  lastWorkout: 'fitflow:last-workout',
  savedPlans: 'fitflow:saved-plans',
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

function remove(storageName, key) {
  try {
    window[storageName].removeItem(key);
  } catch {
    // Storage is blocked: there is nothing to remove
  }
}

/**
 * A saved workout contains a copy of its exercises. Each copy is swapped for
 * the current catalogue entry, so an exercise that was removed from the
 * catalogue cancels the saved workout instead of breaking the page.
 */
function restoreWorkout(workout) {
  if (!workout?.plan?.length) {
    return null;
  }
  const plan = workout.plan.map((item) => ({
    partId: item.partId,
    exercise: EXERCISES.find((exercise) => exercise.id === item.exercise?.id),
  }));
  if (plan.some((item) => !item.exercise)) {
    return null;
  }
  return { ...workout, plan };
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
  return restoreWorkout(read('sessionStorage', KEYS.currentWorkout));
}

export function saveCurrentWorkout(workout) {
  return write('sessionStorage', KEYS.currentWorkout, workout);
}

export function clearCurrentWorkout() {
  remove('sessionStorage', KEYS.currentWorkout);
}

// ---------- Last finished workout ----------

export function loadLastWorkout() {
  return restoreWorkout(read('localStorage', KEYS.lastWorkout));
}

export function saveLastWorkout(workout) {
  return write('localStorage', KEYS.lastWorkout, workout);
}

// ---------- Saved plans ----------

export function savePlan(plan) {
  const savedPlans = read('localStorage', KEYS.savedPlans);
  const list = Array.isArray(savedPlans) ? savedPlans : [];
  return write('localStorage', KEYS.savedPlans, [...list, plan]);
}
