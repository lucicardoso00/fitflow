/**
 * Builder screen (index.html)
 * The person picks body areas, time and equipment. The plan on the right
 * is rebuilt after every change.
 */

import { FULL_BODY, getPartLabel, isFullBody, togglePart } from '../data/body-parts.js';
import { EQUIPMENT_SUMMARY, EXERCISES_PER_WORKOUT } from '../data/settings.js';
import { getPlanTitle, normalizeChoices, sortParts } from '../lib/choices.js';
import { buildPlan } from '../lib/planner.js';
import { loadChoices, saveChoices, loadLastWorkout, saveCurrentWorkout } from '../lib/storage.js';
import { createBodyMap } from '../components/body-map.js';
import { createExerciseCard } from '../components/exercise-card.js';

// ---------- Page elements ----------

const partButtons = document.querySelectorAll('[data-part-toggle]');
const timeButtons = document.querySelectorAll('[data-minutes]');
const equipmentButtons = document.querySelectorAll('[data-equipment]');

const planTitle = document.getElementById('plan-title');
const planSummary = document.getElementById('plan-summary');
const planEmpty = document.getElementById('plan-empty');
const planStatus = document.getElementById('plan-status');
const planList = document.getElementById('plan-list');
const planItemTemplate = document.getElementById('plan-item-template');
const startLink = document.getElementById('start-workout');
const historyLink = document.getElementById('history-link');

const clearButton = document.getElementById('clear-parts');
const targetedCount = document.getElementById('targeted-count');
const focusLabel = document.getElementById('focus-label');
const durationMinutes = document.getElementById('duration-minutes');
const exerciseEstimate = document.getElementById('exercise-estimate');

const dockMinutes = document.getElementById('dock-minutes');
const dockCount = document.getElementById('dock-count');
const dockParts = document.getElementById('dock-parts');

const bodyMap = createBodyMap(document.getElementById('body-map'), { onPartClick: pickPart });

// ---------- State ----------

// What the person picked last time, or the defaults on a first visit
const choices = normalizeChoices(loadChoices());
let plan = [];

// ---------- Actions ----------

function pickPart(partId) {
  choices.parts = togglePart(choices.parts, partId);
  update();
}

function pickMinutes(minutes) {
  choices.minutes = minutes;
  update();
}

function pickEquipment(equipment) {
  choices.equipment = equipment;
  update();
}

function clearParts() {
  choices.parts = [];
  update();
}

// Saves the plan for workout.html, right before the link opens it
function startWorkout(event) {
  const saved = saveCurrentWorkout({
    title: getPlanTitle(choices.parts),
    parts: sortParts(choices.parts),
    plan,
    startedAt: Date.now(),
    exerciseIndex: 0,
    setNumber: 1,
  });
  if (!saved) {
    event.preventDefault();
    planStatus.textContent = 'Your browser could not save this workout. Allow site storage or free some space, then try again.';
  }
}

// The catalogue and selection rules run locally, so changes are immediate.
function update() {
  saveChoices(choices);
  plan = buildPlan(choices);
  planStatus.textContent = '';
  drawPicker();
  drawPlan();
  drawDock();
}

// ---------- Drawing ----------

function drawPicker() {
  bodyMap.showSelected(choices.parts);

  for (const button of partButtons) {
    const partId = button.dataset.partToggle;
    const isPressed = partId === FULL_BODY.id ? isFullBody(choices.parts) : choices.parts.includes(partId);
    button.setAttribute('aria-pressed', String(isPressed));
  }
  for (const button of timeButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === choices.minutes));
  }
  for (const button of equipmentButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.equipment === choices.equipment));
  }

  const count = choices.parts.length;
  targetedCount.textContent = `${count} ${count === 1 ? 'area' : 'areas'} targeted`;
  focusLabel.textContent = count ? getPlanTitle(choices.parts) : 'none yet';
  durationMinutes.textContent = String(choices.minutes);
  exerciseEstimate.textContent = String(EXERCISES_PER_WORKOUT[choices.minutes]);
}

/** Shows the plan, or the empty selection prompt. */
function drawPlan() {
  const hasPlan = plan.length > 0;

  planTitle.textContent = getPlanTitle(choices.parts);
  planSummary.textContent = hasPlan
    ? `${choices.minutes} min · ${plan.length} exercises · ${EQUIPMENT_SUMMARY[choices.equipment]}`
    : '';
  planList.replaceChildren(...plan.map((item) => createExerciseCard(planItemTemplate, item)));

  planEmpty.hidden = hasPlan;
  startLink.hidden = !hasPlan;
}

/** The dock at the bottom: time, exercise count and the areas covered. */
function drawDock() {
  dockMinutes.textContent = String(choices.minutes);
  dockCount.textContent = String(plan.length);
  dockParts.replaceChildren(...sortParts(choices.parts).map(createPill));
}

function createPill(partId) {
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = getPartLabel(partId);
  return pill;
}

// ---------- Events ----------

for (const button of partButtons) {
  button.addEventListener('click', () => pickPart(button.dataset.partToggle));
}
for (const button of timeButtons) {
  button.addEventListener('click', () => pickMinutes(Number(button.dataset.minutes)));
}
for (const button of equipmentButtons) {
  button.addEventListener('click', () => pickEquipment(button.dataset.equipment));
}
clearButton.addEventListener('click', clearParts);
startLink.addEventListener('click', startWorkout);

// ---------- Start ----------

historyLink.hidden = loadLastWorkout() === null;
update();
