/**
 * Workout screen (workout.html)
 * Walks through the plan set by set, with a rest timer between sets.
 */

import { SETS_PER_EXERCISE, REST_SECONDS, EXTRA_REST_SECONDS } from '../data/settings.js';
import { formatSetTarget } from '../lib/format.js';
import { loadCurrentWorkout, saveCurrentWorkout, clearCurrentWorkout, saveLastWorkout } from '../lib/storage.js';
import { createRestTimer } from '../components/rest-timer.js';

// ---------- Page elements ----------

const workoutTitle = document.getElementById('workout-title');
const progressBar = document.getElementById('progress-bar');
const endLink = document.getElementById('end-workout');
const exerciseImage = document.getElementById('exercise-image');

const setView = document.getElementById('set-view');
const setCounter = document.getElementById('set-counter');
const exerciseName = document.getElementById('exercise-name');
const setAmount = document.getElementById('set-amount');
const setUnit = document.getElementById('set-unit');
const upNextImage = document.getElementById('up-next-image');
const upNextName = document.getElementById('up-next-name');
const doneSetButton = document.getElementById('done-set');
const finishLink = document.getElementById('finish-workout');

const restView = document.getElementById('rest-view');
const restNext = document.getElementById('rest-next');
const addRestButton = document.getElementById('add-rest');
const skipRestButton = document.getElementById('skip-rest');

const restTimer = createRestTimer(document.getElementById('rest-timer'), endRest);

// ---------- State ----------

// Saved by the builder when "Start workout" was clicked
const workout = loadCurrentWorkout();
let isResting = false;

function getExercise(index) {
  return workout.plan[index].exercise;
}

function isLastExercise() {
  return workout.exerciseIndex === workout.plan.length - 1;
}

function isLastSet() {
  return isLastExercise() && workout.setNumber === SETS_PER_EXERCISE;
}

/** What comes after the current set: the next set, the next exercise, or the end. */
function getUpNext() {
  const exercise = getExercise(workout.exerciseIndex);

  if (workout.setNumber < SETS_PER_EXERCISE) {
    return { image: exercise.image, label: `${exercise.name} · set ${workout.setNumber + 1}` };
  }
  if (!isLastExercise()) {
    const nextExercise = getExercise(workout.exerciseIndex + 1);
    return { image: nextExercise.image, label: nextExercise.name };
  }
  return { image: exercise.image, label: 'You’re done!' };
}

// ---------- Actions ----------

function completeSet() {
  if (workout.setNumber < SETS_PER_EXERCISE) {
    workout.setNumber += 1;
  } else {
    workout.exerciseIndex += 1;
    workout.setNumber = 1;
  }
  saveCurrentWorkout(workout);

  isResting = true;
  draw();
  restTimer.start(REST_SECONDS);
  skipRestButton.focus();
}

function endRest() {
  restTimer.stop();
  isResting = false;
  draw();
  (isLastSet() ? finishLink : doneSetButton).focus();
}

// Stores the result for done.html, right before the link opens it
function finishWorkout() {
  saveLastWorkout({
    title: workout.title,
    parts: workout.parts,
    plan: workout.plan,
    startedAt: workout.startedAt,
    finishedAt: Date.now(),
    isSaved: false,
  });
  clearCurrentWorkout();
}

function endWorkout() {
  restTimer.stop();
  clearCurrentWorkout();
}

// ---------- Drawing ----------

function drawProgressBar() {
  const segments = workout.plan.map(() => {
    const segment = document.createElement('span');
    segment.className = 'progress-bar__segment';
    return segment;
  });
  progressBar.replaceChildren(...segments);
  progressBar.setAttribute('aria-valuemax', String(workout.plan.length));
}

function draw() {
  const index = workout.exerciseIndex;
  const exercise = getExercise(index);

  // Progress: blue = done, orange = now, grey = to do
  progressBar.querySelectorAll('.progress-bar__segment').forEach((segment, segmentIndex) => {
    segment.classList.toggle('is-done', segmentIndex < index);
    segment.classList.toggle('is-current', segmentIndex === index);
  });
  progressBar.setAttribute('aria-valuenow', String(index + 1));
  progressBar.setAttribute('aria-valuetext', `Exercise ${index + 1} of ${workout.plan.length}`);

  exerciseImage.src = exercise.image;
  exerciseImage.alt = exercise.name;

  setView.hidden = isResting;
  restView.hidden = !isResting;

  // Set view
  const target = formatSetTarget(exercise);
  setCounter.textContent = `Set ${workout.setNumber} of ${SETS_PER_EXERCISE}`;
  exerciseName.textContent = exercise.name;
  setAmount.textContent = target.value;
  setUnit.textContent = target.unit;

  const upNext = getUpNext();
  upNextImage.src = upNext.image;
  upNextName.textContent = upNext.label;

  doneSetButton.hidden = isLastSet();
  finishLink.hidden = !isLastSet();

  // Rest view: the set coming after the rest
  restNext.textContent = `${exercise.name} · set ${workout.setNumber}`;
}

// ---------- Start ----------

if (!workout?.plan?.length) {
  // Nothing to train (e.g. this page was opened directly): pick areas first
  window.location.replace('index.html');
} else {
  workoutTitle.textContent = workout.title;

  doneSetButton.addEventListener('click', completeSet);
  skipRestButton.addEventListener('click', endRest);
  addRestButton.addEventListener('click', () => restTimer.addTime(EXTRA_REST_SECONDS));
  finishLink.addEventListener('click', finishWorkout);
  endLink.addEventListener('click', endWorkout);

  drawProgressBar();
  draw();
}
