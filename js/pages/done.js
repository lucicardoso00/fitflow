/**
 * Done screen (done.html)
 * Shows the last finished workout. The builder's "History" link opens it too.
 */

import { SETS_PER_EXERCISE } from '../data/settings.js';
import { getWeekday } from '../lib/format.js';
import { loadLastWorkout, saveLastWorkout, savePlan } from '../lib/storage.js';
import { createBodyMap } from '../components/body-map.js';
import { createExerciseCard } from '../components/exercise-card.js';
import { createExercisePreview } from '../components/exercise-preview.js';

const preview = createExercisePreview();

// ---------- Page elements ----------

const dateLabel = document.getElementById('done-date');
const minutesValue = document.getElementById('stat-minutes');
const minutesLabel = document.getElementById('stat-minutes-label');
const exercisesValue = document.getElementById('stat-exercises');
const setsValue = document.getElementById('stat-sets');
const savePlanButton = document.getElementById('save-plan');
const saveToast = document.getElementById('save-toast');
const mapContainer = document.getElementById('trained-map');
const planList = document.getElementById('done-list');
const planItemTemplate = document.getElementById('plan-item-template');

// ---------- State ----------

// Saved by workout.html when "Finish workout" was clicked
const workout = loadLastWorkout();

// ---------- Actions ----------

function saveThisPlan() {
  const saved = savePlan({
    title: workout.title,
    parts: workout.parts,
    plan: workout.plan,
    savedAt: Date.now(),
  });

  if (!saved) {
    saveToast.textContent = 'Your browser could not save this plan. Allow site storage or free some space, then try again.';
    return;
  }

  workout.isSaved = true;
  saveLastWorkout(workout);
  drawSaveButton();
  saveToast.textContent = 'Plan saved in this browser.';
}

// ---------- Drawing ----------

function drawSummary() {
  const minutes = Math.max(1, Math.round((workout.finishedAt - workout.startedAt) / 60000));

  dateLabel.textContent = `${getWeekday(workout.finishedAt)} · ${workout.title}`;
  minutesValue.textContent = String(minutes);
  minutesLabel.textContent = minutes === 1 ? 'minute' : 'minutes';
  exercisesValue.textContent = String(workout.plan.length);
  setsValue.textContent = String(workout.plan.length * SETS_PER_EXERCISE);

  createBodyMap(mapContainer).showSelected(workout.parts);
}

function drawPlan() {
  preview.close();
  planList.replaceChildren(...workout.plan.map((item) => createExerciseCard(planItemTemplate, item, preview.toggle)));
}

function drawSaveButton() {
  if (workout.isSaved) {
    savePlanButton.textContent = 'Plan saved';
    savePlanButton.disabled = true;
  }
}

// ---------- Start ----------

if (!workout?.plan?.length) {
  // No workout finished yet: go build one
  window.location.replace('index.html');
} else {
  savePlanButton.addEventListener('click', saveThisPlan);

  drawSummary();
  drawPlan();
  drawSaveButton();
}
