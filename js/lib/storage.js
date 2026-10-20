/**
 * Storage — remembers data between pages and visits.
 *
 *   localStorage    kept between visits: last choices, last workout, saved plans
 *   sessionStorage  kept for this tab only: the workout in progress
 *
 * Browsers can block storage (private mode, strict settings), so every
 * read and write is wrapped: the app keeps working, it just forgets.
 */

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
  } catch {
    // Storage is blocked or full: nothing else to do
  }
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
  write('localStorage', KEYS.choices, choices);
}

// ---------- Workout in progress ----------

export function loadCurrentWorkout() {
  return read('sessionStorage', KEYS.currentWorkout);
}

export function saveCurrentWorkout(workout) {
  write('sessionStorage', KEYS.currentWorkout, workout);
}

export function clearCurrentWorkout() {
  remove('sessionStorage', KEYS.currentWorkout);
}

// ---------- Last finished workout ----------

export function loadLastWorkout() {
  return read('localStorage', KEYS.lastWorkout);
}

export function saveLastWorkout(workout) {
  write('localStorage', KEYS.lastWorkout, workout);
}

// ---------- Saved plans ----------

export function savePlan(plan) {
  const savedPlans = read('localStorage', KEYS.savedPlans) ?? [];
  write('localStorage', KEYS.savedPlans, [...savedPlans, plan]);
}
