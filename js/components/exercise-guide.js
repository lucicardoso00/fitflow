import { EXERCISE_SOURCES, WGER_LICENSES } from '../data/exercise-sources.js';
import { exerciseApi } from '../lib/exercise-api.js';
import { element, externalLink } from '../lib/dom.js';

/** Rebuild a small formatting allowlist. Remote attributes, links and media never enter the DOM. */
export function safeInstructions(html) {
  const source = document.createElement('template');
  source.innerHTML = html;
  const allowed = new Set(['P', 'OL', 'UL', 'LI', 'STRONG', 'EM', 'BR']);
  const dropped = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'TEMPLATE']);
  const copy = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || dropped.has(node.tagName)) return;
    const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent;
    for (const child of node.childNodes) copy(child, target);
    if (target !== parent) parent.append(target);
  };
  const fragment = document.createDocumentFragment();
  for (const child of source.content.childNodes) copy(child, fragment);
  return fragment;
}

/** A native disclosure keeps the written guide beside the inline video. */
export function createExerciseGuide() {
  const root = element('details', 'exercise-guide');
  const summary = element('summary', 'exercise-guide__summary', 'Movement guide');
  const content = element('div', 'exercise-guide__content');
  const setup = element('p', 'exercise-guide__setup');
  const instructionsHeader = element('div', 'exercise-guide__section-heading');
  const retry = element('button', 'button button--secondary button--small', 'Retry guide');
  retry.type = 'button';
  retry.hidden = true;
  instructionsHeader.append(setup, retry);
  const status = element('p', 'exercise-guide__status');
  status.setAttribute('role', 'status');
  const instructions = element('div', 'exercise-guide__instructions');
  const muscles = element('p', 'exercise-guide__muscles');
  const credit = element('p', 'exercise-guide__credit');
  content.append(instructionsHeader, status, instructions, muscles, credit);
  root.append(summary, content);
  let current;
  let request;

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    status.textContent = 'Loading exercise guide…';
    instructions.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    instructions.replaceChildren();
    muscles.textContent = '';
    credit.replaceChildren();
    try {
      const [result] = await exerciseApi.load([current.id], { signal: controller.signal, force });
      if (controller.signal.aborted) return;
      if (!result.guide) {
        status.textContent = 'The exercise guide is unavailable. Try again when you’re connected. You can still use the video or continue your workout.';
        retry.hidden = false;
        return;
      }
      const guide = result.guide;
      instructions.append(safeInstructions(guide.description));
      muscles.textContent = guide.muscles.length ? `Works: ${guide.muscles.join(', ')}.` : '';
      const license = WGER_LICENSES[guide.licenseId];
      credit.append(externalLink(`${guide.name} on wger`, `https://wger.de/en/exercise/${guide.id}/view/`),
        document.createTextNode(` · ${guide.author} · `), externalLink(license.name, license.url),
        document.createTextNode(' · Formatting simplified.'));
      status.textContent = result.stale ? 'Showing a previously downloaded guide. Reconnect to refresh it.' : '';
      retry.hidden = !result.stale;
    } catch (error) {
      if (!controller.signal.aborted) { status.textContent = 'The exercise guide could not load. Try again.'; retry.hidden = false; }
    } finally {
      if (!controller.signal.aborted) instructions.setAttribute('aria-busy', 'false');
    }
  }

  retry.addEventListener('click', () => {
    summary.focus();
    load(true);
  });
  root.addEventListener('toggle', () => {
    if (root.open && root.isConnected && current) load();
    else request?.abort();
  });

  return {
    element: root,
    setExercise(exercise) {
      if (current?.id === exercise.id) return;
      request?.abort();
      current = exercise;
      const source = EXERCISE_SOURCES[exercise.id];
      setup.textContent = source.setup || (exercise.equipment === 'dumbbells' ? 'Equipment: dumbbells.' : 'Equipment: bodyweight. A mat is optional.');
      instructions.replaceChildren();
      muscles.textContent = '';
      credit.replaceChildren();
      status.textContent = '';
      retry.hidden = true;
      if (root.open) load();
    },
    dispose() { request?.abort(); },
  };
}
