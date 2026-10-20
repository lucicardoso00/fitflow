/**
 * Exercise card — one item of a plan, copied from the <template> in the page.
 *
 *   const card = createExerciseCard(template, { partId, exercise });
 *
 * The template holds the markup and the CSS holds the look;
 * this only fills in the exercise.
 */

import { getPartLabel } from '../data/body-parts.js';
import { formatAmount } from '../lib/format.js';
import { element } from '../lib/dom.js';

export function createExerciseCard(template, { partId, exercise }, onOpen) {
  const card = template.content.firstElementChild.cloneNode(true);

  const image = card.querySelector('.plan-item__image');
  image.src = exercise.image;
  image.alt = '';

  card.querySelector('.plan-item__name').textContent = exercise.name;
  const trigger = card.querySelector('.plan-item__name');
  const preview = element('div', 'plan-item__preview');
  preview.id = `preview-${exercise.id}`;
  preview.hidden = true;
  card.append(preview);
  trigger.setAttribute('aria-controls', preview.id);
  if (onOpen) trigger.addEventListener('click', () => onOpen(exercise, card, trigger));
  card.querySelector('.plan-item__amount').textContent = formatAmount(exercise);
  card.querySelector('.plan-item__area').textContent = getPartLabel(partId);

  return card;
}
