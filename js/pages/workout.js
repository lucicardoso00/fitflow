/**
 * Workout screen (workout.html)
 * Walks through the plan set by set, with a rest timer between sets.
 * Progress is saved after every set, so a refresh picks up where it was.
 */

import { SETS_PER_EXERCISE, REST_SECONDS, EXTRA_REST_SECONDS } from '../data/settings.js';
import { formatSetTarget } from '../lib/format.js';
import { loadCurrentWorkout, saveCurrentWorkout, clearCurrentWorkout, saveLastWorkout } from '../lib/storage.js';
import { createRestTimer } from '../components/rest-timer.js';
import { createExerciseVideo } from '../components/exercise-video.js';
import { createExerciseGuide } from '../components/exercise-guide.js';
import { createMusicPlayer } from '../components/music-player.js';

// ---------- Page elements ----------

const workoutTitle = document.getElementById('workout-title');
const workoutCount = document.getElementById('workout-count');
const workoutStatus = document.getElementById('workout-status');
const endLink = document.getElementById('end-workout');

const player = document.getElementById('workout-player');
const phase = document.getElementById('workout-phase');
const exerciseName = document.getElementById('exercise-name');
const setCounter = document.getElementById('set-counter');
const setAmount = document.getElementById('set-amount');
const setUnit = document.getElementById('set-unit');
const upNextImage = document.getElementById('up-next-image');
const upNextName = document.getElementById('up-next-name');
const progressBar = document.getElementById('progress-bar');

const setView = document.getElementById('set-view');
const doneSetButton = document.getElementById('done-set');
const finishLink = document.getElementById('finish-workout');

const restView = document.getElementById('rest-view');
const restNext = document.getElementById('rest-next');
const addRestButton = document.getElementById('add-rest');
const skipRestButton = document.getElementById('skip-rest');

const video = createExerciseVideo(document.getElementById('exercise-video'));
const guide = createExerciseGuide(document.getElementById('exercise-guide'));
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
  video.stop();
  startRest(REST_SECONDS);
  skipRestButton.focus();
}

// The end of the rest is saved as a time, so a refresh can continue the countdown
function startRest(seconds) {
  isResting = true;
  workout.restEndsAt = Date.now() + seconds * 1000;
  saveCurrentWorkout(workout);
  draw();
  restTimer.start(seconds);
}

function extendRest() {
  workout.restEndsAt += EXTRA_REST_SECONDS * 1000;
  saveCurrentWorkout(workout);
  restTimer.addTime(EXTRA_REST_SECONDS);
}

function endRest() {
  isResting = false;
  delete workout.restEndsAt;
  saveCurrentWorkout(workout);
  restTimer.stop();
  draw();
  (isLastSet() ? finishLink : doneSetButton).focus();
}

// Stores the result for done.html, right before the link opens it
function finishWorkout(event) {
  const saved = saveLastWorkout({
    title: workout.title,
    parts: workout.parts,
    plan: workout.plan,
    startedAt: workout.startedAt,
    finishedAt: Date.now(),
    isSaved: false,
  });
  if (!saved) {
    event.preventDefault();
    workoutStatus.textContent = 'Your browser could not save the result. Allow site storage, then try again.';
    return;
  }
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
  const target = formatSetTarget(exercise);
  const upNext = getUpNext();

  // Progress: done movements, the current one, the rest
  progressBar.querySelectorAll('.progress-bar__segment').forEach((segment, segmentIndex) => {
    segment.classList.toggle('is-done', segmentIndex < index);
    segment.classList.toggle('is-current', segmentIndex === index);
  });
  progressBar.setAttribute('aria-valuenow', String(index + 1));
  progressBar.setAttribute('aria-valuetext', `Exercise ${index + 1} of ${workout.plan.length}`);
  workoutCount.textContent = `${index + 1} / ${workout.plan.length} movements`;

  // The exercise
  video.show(exercise);
  guide.show(exercise);
  exerciseName.textContent = exercise.name;
  setCounter.textContent = `Set ${workout.setNumber} of ${SETS_PER_EXERCISE}`;
  setAmount.textContent = target.value;
  setUnit.textContent = target.unit;
  upNextImage.src = upNext.image;
  upNextName.textContent = upNext.label;

  // Set view or rest view
  player.classList.toggle('is-resting', isResting);
  phase.textContent = isResting ? 'Rest · next movement below' : 'Now performing';
  setView.hidden = isResting;
  restView.hidden = !isResting;
  doneSetButton.hidden = isLastSet();
  finishLink.hidden = !isLastSet();
  restNext.textContent = `${exercise.name} · set ${workout.setNumber}`;
}

// ---------- Start ----------

if (workout === null) {
  // Nothing to train (e.g. this page was opened directly): pick areas first
  window.location.replace('index.html');
} else {
  workoutTitle.textContent = workout.title;
  createMusicPlayer(document.getElementById('music-player'));

  doneSetButton.addEventListener('click', completeSet);
  skipRestButton.addEventListener('click', endRest);
  addRestButton.addEventListener('click', extendRest);
  finishLink.addEventListener('click', finishWorkout);
  endLink.addEventListener('click', endWorkout);

  drawProgressBar();
  const restLeft = Math.ceil((workout.restEndsAt - Date.now()) / 1000);
  if (restLeft > 0) {
    startRest(restLeft); // the page was refreshed during a rest
  } else {
    draw();
  }
}
