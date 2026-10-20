/**
 * Body areas a person can train.
 * The order here is the order used to build the plan and its title.
 */

export const BODY_PARTS = [
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'chest', label: 'Chest' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
  { id: 'back', label: 'Back' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'legs', label: 'Legs' },
];

/** Not an area itself: selects every area at once, and tags filler exercises. */
export const FULL_BODY = { id: 'full-body', label: 'Full body' };

export const ALL_PART_IDS = BODY_PARTS.map((part) => part.id);

export function getPartLabel(partId) {
  if (partId === FULL_BODY.id) {
    return FULL_BODY.label;
  }
  return BODY_PARTS.find((part) => part.id === partId).label;
}

export function isFullBody(partIds) {
  return ALL_PART_IDS.every((partId) => partIds.includes(partId));
}

/** Adds or removes one area. "Full body" selects every area, or clears them all. */
export function togglePart(partIds, partId) {
  if (partId === FULL_BODY.id) {
    return isFullBody(partIds) ? [] : [...ALL_PART_IDS];
  }
  if (partIds.includes(partId)) {
    return partIds.filter((id) => id !== partId);
  }
  return [...partIds, partId];
}
