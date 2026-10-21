/** Validate saved choices and describe them for the interface. */
import { BODY_PARTS, FULL_BODY, getPartLabel } from '../data/body-parts.js';
import { DEFAULT_CHOICES, EQUIPMENT_SUMMARY, EXERCISES_PER_WORKOUT } from '../data/settings.js';

/** Storage can contain an older schema or malformed data. Keep valid fields. */
export function normalizeChoices(choices) {
  return {
    parts: sortParts(Array.isArray(choices?.parts) ? choices.parts : DEFAULT_CHOICES.parts),
    minutes: Object.hasOwn(EXERCISES_PER_WORKOUT, choices?.minutes)
      ? Number(choices.minutes) : DEFAULT_CHOICES.minutes,
    equipment: Object.hasOwn(EQUIPMENT_SUMMARY, choices?.equipment)
      ? choices.equipment : DEFAULT_CHOICES.equipment,
  };
}

/** Keeps known areas in the order used by the body map. */
export function sortParts(parts) {
  return BODY_PARTS.map((part) => part.id).filter((id) => parts.includes(id));
}

export function getPlanTitle(parts) {
  const sorted = sortParts(parts);
  if (sorted.length === 0) return 'Pick an area';
  if (sorted.length === BODY_PARTS.length) return FULL_BODY.label;
  if (sorted.length <= 2) return sorted.map(getPartLabel).join(' & ');
  return `${sorted.length} areas`;
}
