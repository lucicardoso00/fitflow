/** Small display helpers shared by the frontend and the server. */
import { BODY_PARTS, FULL_BODY, getPartLabel } from '../data/body-parts.js';

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
