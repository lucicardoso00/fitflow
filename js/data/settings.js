/**
 * Workout rules and defaults.
 */

/** Minutes available → how many exercises the plan gets. */
export const EXERCISES_PER_WORKOUT = {
  15: 4,
  30: 6,
  45: 8,
};

export const SETS_PER_EXERCISE = 3;

export const REST_SECONDS = 45;

/** Seconds added by the "+15 s" button. */
export const EXTRA_REST_SECONDS = 15;

/** How each equipment choice is written in the plan summary. */
export const EQUIPMENT_SUMMARY = {
  none: 'bodyweight',
  dumbbells: 'dumbbells',
};

/** What the builder shows on a first visit. */
export const DEFAULT_CHOICES = {
  parts: ['legs', 'core'],
  minutes: 30,
  equipment: 'none',
};
