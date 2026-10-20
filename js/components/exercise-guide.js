import { EXERCISE_SOURCES, WGER_LICENSES } from '../data/exercise-sources.js';
import { exerciseApi } from '../lib/exercise-api.js';
import { formatAmount } from '../lib/format.js';
import { mountVideo } from '../lib/youtube-player.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

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

function sourceLink(label, href) {
  const link = element('a', '', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

/** One shared, native modal sheet for the builder, workout and summary. */
export function createExerciseGuide() {
  const dialog = element('dialog', 'exercise-guide');
  dialog.setAttribute('aria-labelledby', 'exercise-guide-title');
  const header = element('header', 'exercise-guide__header');
  const heading = element('div');
  const title = element('h2', 'heading');
  title.id = 'exercise-guide-title';
  heading.append(element('p', 'caption', 'Movement guide'), title);
  const close = element('button', 'button button--secondary', 'Close');
  close.type = 'button';
  close.autofocus = true;
  close.addEventListener('click', () => dialog.close());
  header.append(heading, close);
  const content = element('div', 'exercise-guide__content');
  const target = element('p', 'exercise-guide__target tabular');
  const setup = element('p', 'exercise-guide__setup');
  const media = element('div', 'exercise-guide__media');
  const poster = element('img');
  poster.alt = '';
  const videoContainer = element('div', 'exercise-guide__player');
  videoContainer.hidden = true;
  const videoButton = element('button', 'button button--primary', 'Load video demo');
  videoButton.type = 'button';
  media.append(poster, videoContainer, videoButton);
  const videoStatus = element('p', 'exercise-guide__status');
  videoStatus.setAttribute('role', 'status');
  const videoCredit = element('p', 'exercise-guide__credit');
  const instructionsHeader = element('div', 'exercise-guide__section-heading');
  const retry = element('button', 'button button--secondary button--small', 'Retry guide');
  retry.type = 'button';
  retry.hidden = true;
  instructionsHeader.append(element('h3', '', 'About the movement'), retry);
  const status = element('p', 'exercise-guide__status');
  status.setAttribute('role', 'status');
  const instructions = element('div', 'exercise-guide__instructions');
  const muscles = element('p', 'exercise-guide__muscles');
  const credit = element('p', 'exercise-guide__credit');
  content.append(target, setup, media, videoStatus, videoCredit, instructionsHeader, status, instructions, muscles, credit);
  dialog.append(header, content);
  document.body.append(dialog);
  let current;
  let request;
  let disposeVideo;

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    status.textContent = 'Loading exercise guide…';
    instructions.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    try {
      const [result] = await exerciseApi.load([current.id], { signal: controller.signal, force });
      if (controller.signal.aborted) return;
      instructions.replaceChildren();
      muscles.textContent = '';
      credit.replaceChildren();
      if (!result.guide) {
        status.textContent = 'The exercise guide is unavailable. Try again when you’re connected. You can still use the video or continue your workout.';
        retry.hidden = false;
        return;
      }
      const guide = result.guide;
      instructions.append(safeInstructions(guide.description));
      muscles.textContent = guide.muscles.length ? `Works: ${guide.muscles.join(', ')}.` : '';
      const license = WGER_LICENSES[guide.licenseId];
      credit.append(sourceLink(`${guide.name} on wger`, `https://wger.de/en/exercise/${guide.id}/view/`),
        document.createTextNode(` · ${guide.author} · `), sourceLink(license.name, license.url),
        document.createTextNode(' · Formatting simplified.'));
      status.textContent = result.stale ? 'Showing a previously downloaded guide. Reconnect to refresh it.' : '';
      retry.hidden = !result.stale;
    } catch (error) {
      if (!controller.signal.aborted) { status.textContent = 'The exercise guide could not load. Try again.'; retry.hidden = false; }
    } finally {
      if (!controller.signal.aborted) instructions.setAttribute('aria-busy', 'false');
    }
  }

  retry.addEventListener('click', () => load(true));
  videoButton.addEventListener('click', () => {
    disposeVideo?.();
    poster.hidden = true;
    videoContainer.hidden = false;
    videoButton.hidden = true;
    videoStatus.textContent = 'Loading video player…';
    disposeVideo = mountVideo(videoContainer, {
      videoId: EXERCISE_SOURCES[current.id].video,
      title: current.name,
      onReady: () => {
        videoStatus.textContent = 'Video ready. Press play to watch the demonstration.';
        if (document.activeElement === document.body) videoContainer.querySelector('iframe')?.focus();
      },
      onError: message => {
        disposeVideo?.();
        videoContainer.hidden = true;
        poster.hidden = false;
        videoButton.hidden = false;
        videoButton.textContent = 'Retry video';
        videoStatus.textContent = message;
        if (document.activeElement === document.body) videoButton.focus();
      },
    });
  });
  dialog.addEventListener('close', () => {
    request?.abort();
    disposeVideo?.();
    document.body.classList.remove('has-dialog');
  });

  return {
    open(exercise) {
      current = exercise;
      const source = EXERCISE_SOURCES[exercise.id];
      title.textContent = exercise.name;
      target.textContent = `${formatAmount(exercise)} · Your workout target`;
      setup.textContent = source.setup || (exercise.equipment === 'dumbbells' ? 'Equipment: dumbbells.' : 'Equipment: bodyweight. A mat is optional.');
      instructions.replaceChildren();
      muscles.textContent = '';
      credit.replaceChildren();
      poster.src = exercise.image;
      poster.hidden = false;
      videoContainer.hidden = true;
      videoButton.hidden = false;
      videoButton.textContent = 'Load video demo';
      videoStatus.textContent = 'Video loads from YouTube when you choose it.';
      videoCredit.replaceChildren(sourceLink(`Demo by ${source.creator} · Open on YouTube ↗`, `https://www.youtube.com/watch?v=${source.video}`));
      document.body.classList.add('has-dialog');
      dialog.showModal();
      load();
    },
  };
}
