/**
 * Every exercise Forma can put in a plan. Order matters: within one body
 * area, the exercise listed first is picked first.
 *
 *   equipment  'none' or 'dumbbells'. Bodyweight exercises are always available.
 *   areas      the body areas it trains. 'full-body' marks the movements used
 *              to fill a plan when the chosen areas run out of exercises.
 *
 * An exercise is counted in reps OR timed in seconds:
 *   { reps: 12, unit: 'reps' }    → "3 × 12 reps"  and "12 reps" during a set
 *   { seconds: 40, cue: 'hold' }  → "3 × 40 sec"   and "0:40 hold" during a set
 */

export const EXERCISES = [
  { id: 'shoulder-press', name: 'Shoulder press', equipment: 'dumbbells', areas: ['shoulders'], reps: 10, unit: 'reps' },
  { id: 'bent-over-row', name: 'Bent-over row', equipment: 'dumbbells', areas: ['back'], reps: 12, unit: 'reps' },
  { id: 'biceps-curl', name: 'Biceps curl', equipment: 'dumbbells', areas: ['arms'], reps: 12, unit: 'reps' },
  { id: 'triceps-dip', name: 'Triceps dip', equipment: 'none', areas: ['arms'], reps: 10, unit: 'reps' },
  { id: 'push-up', name: 'Push-up', equipment: 'none', areas: ['chest', 'shoulders', 'arms', 'full-body'], reps: 10, unit: 'reps' },
  { id: 'jumping-jack', name: 'Jumping jack', equipment: 'none', areas: ['shoulders', 'full-body'], seconds: 30, cue: 'fast' },
  { id: 'superman', name: 'Superman', equipment: 'none', areas: ['back'], reps: 12, unit: 'reps' },
  { id: 'plank', name: 'Plank', equipment: 'none', areas: ['core', 'full-body'], seconds: 40, cue: 'hold' },
  { id: 'crunch', name: 'Crunch', equipment: 'none', areas: ['core'], reps: 15, unit: 'reps' },
  { id: 'mountain-climber', name: 'Mountain climber', equipment: 'none', areas: ['core', 'full-body'], seconds: 30, cue: 'fast' },
  { id: 'glute-bridge', name: 'Glute bridge', equipment: 'none', areas: ['glutes'], reps: 15, unit: 'reps' },
  { id: 'squat', name: 'Squat', equipment: 'none', areas: ['legs', 'glutes', 'full-body'], reps: 12, unit: 'reps' },
  { id: 'lunge', name: 'Lunge', equipment: 'none', areas: ['legs', 'glutes'], reps: 10, unit: 'each leg' },
].map((exercise) => ({ ...exercise, image: `assets/images/exercises/${exercise.id}.svg` }));
