/** The workout rules. No HTTP, DOM or storage in here. */
import { FULL_BODY } from '../data/body-parts.js';
import { EXERCISES } from '../data/exercises.js';
import { EXERCISES_PER_WORKOUT } from '../data/settings.js';
import { normalizeChoices, sortParts } from './choices.js';

/** Returns [{ partId, exercise }, …]: the exercises to do, each labelled with the area it is for. */
export function buildPlan(choices) {
  const { parts, minutes, equipment } = normalizeChoices(choices);
  const chosenParts = sortParts(parts);
  if (chosenParts.length === 0) return [];

  // Dumbbells are optional: bodyweight exercises are always available.
  const available = EXERCISES.filter((exercise) =>
    exercise.equipment === 'none' || exercise.equipment === equipment);
  const forPart = (partId) => available.filter((exercise) => exercise.areas.includes(partId));

  // Every chosen area's first pick, then every area's second pick, and so on.
  const picks = chosenParts
    .flatMap((partId) => forPart(partId).map((exercise, rank) => ({ partId, exercise, rank })))
    .sort((a, b) => a.rank - b.rank);

  // When the chosen areas run out: full-body movements first, then whatever is left.
  const fillers = [...forPart(FULL_BODY.id), ...available]
    .map((exercise) => ({ partId: FULL_BODY.id, exercise }));

  const plan = [];
  for (const { partId, exercise } of [...picks, ...fillers]) {
    if (plan.length === EXERCISES_PER_WORKOUT[minutes]) break;
    if (!plan.some((item) => item.exercise === exercise)) plan.push({ partId, exercise });
  }
  return plan;
}
