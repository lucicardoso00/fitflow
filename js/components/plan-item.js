/**
 * Plan item — one row of the routine, copied from <template id="plan-item-template">.
 *
 *   const row = createPlanItem(template, { partId, exercise }, onToggle);
 *
 * The template holds the markup and the CSS holds the look; this only fills
 * in the exercise. Clicking the name calls onToggle(row, exercise), so the
 * page can open a preview under the row.
 */

import { getPartLabel } from '../data/body-parts.js';
import { formatAmount } from '../lib/format.js';

export function createPlanItem(template, { partId, exercise }, onToggle) {
  const row = template.content.firstElementChild.cloneNode(true);

  row.querySelector('.plan-item__image').src = exercise.image;
  row.querySelector('.plan-item__name').textContent = exercise.name;
  row.querySelector('.plan-item__area').textContent = getPartLabel(partId);
  row.querySelector('.plan-item__amount').textContent = formatAmount(exercise);

  row.querySelector('.plan-item__name').addEventListener('click', () => onToggle(row, exercise));

  return row;
}
