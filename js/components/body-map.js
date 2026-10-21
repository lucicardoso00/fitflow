/**
 * Body map — front and back silhouettes.
 *
 *   const bodyMap = createBodyMap(document.getElementById('body-map'), { onPartClick });
 *   bodyMap.showSelected(['legs', 'core']);
 *
 * Every selectable group of shapes has  class="body-map__area" data-part="<area id>".
 * Colors live in css/components/body-map.css; this file only toggles classes.
 */

import { getPartLabel } from '../data/body-parts.js';

const FRONT = `
  <g>
    <circle class="body-map__skin" cx="60" cy="20" r="13"/>
    <rect class="body-map__skin" x="54" y="31" width="12" height="10" rx="4"/>

    <g class="body-map__area" data-part="shoulders">
      <ellipse cx="35" cy="50" rx="11" ry="10"/>
      <ellipse cx="85" cy="50" rx="11" ry="10"/>
    </g>
    <g class="body-map__area" data-part="chest">
      <rect x="41" y="41" width="18.5" height="26" rx="7"/>
      <rect x="60.5" y="41" width="18.5" height="26" rx="7"/>
    </g>
    <g class="body-map__area" data-part="arms">
      <rect x="21" y="58" width="12" height="34" rx="6"/>
      <rect x="87" y="58" width="12" height="34" rx="6"/>
      <rect x="17" y="94" width="11" height="34" rx="5.5"/>
      <rect x="92" y="94" width="11" height="34" rx="5.5"/>
    </g>

    <circle class="body-map__skin" cx="22" cy="134" r="6"/>
    <circle class="body-map__skin" cx="98" cy="134" r="6"/>

    <g class="body-map__area" data-part="core">
      <rect x="38" y="70" width="5" height="38" rx="2.5"/>
      <rect x="77" y="70" width="5" height="38" rx="2.5"/>
      <rect x="45" y="69" width="30" height="44" rx="8"/>
    </g>
    <path class="body-map__lines" d="M60 72 V110 M47 84 H73 M47 97 H73"/>

    <rect class="body-map__skin" x="40" y="114" width="40" height="18" rx="8"/>

    <g class="body-map__area" data-part="legs">
      <rect x="40" y="132" width="19" height="56" rx="9"/>
      <rect x="61" y="132" width="19" height="56" rx="9"/>
      <rect x="42" y="192" width="15" height="50" rx="7"/>
      <rect x="63" y="192" width="15" height="50" rx="7"/>
    </g>

    <ellipse class="body-map__skin" cx="49" cy="249" rx="9" ry="5"/>
    <ellipse class="body-map__skin" cx="71" cy="249" rx="9" ry="5"/>
    <text class="body-map__label" x="60" y="268" text-anchor="middle">FRONT</text>
  </g>
`;

const BACK = `
  <g transform="translate(140 0)">
    <circle class="body-map__skin" cx="60" cy="20" r="13"/>
    <rect class="body-map__skin" x="54" y="31" width="12" height="10" rx="4"/>

    <g class="body-map__area" data-part="back">
      <rect x="46" y="36" width="28" height="14" rx="7"/>
    </g>
    <g class="body-map__area" data-part="shoulders">
      <ellipse cx="35" cy="50" rx="11" ry="10"/>
      <ellipse cx="85" cy="50" rx="11" ry="10"/>
    </g>
    <g class="body-map__area" data-part="back">
      <rect x="40" y="48" width="40" height="40" rx="11"/>
      <rect x="46" y="90" width="28" height="23" rx="8"/>
    </g>
    <path class="body-map__lines" d="M60 50 V112"/>

    <g class="body-map__area" data-part="arms">
      <rect x="21" y="58" width="12" height="34" rx="6"/>
      <rect x="87" y="58" width="12" height="34" rx="6"/>
      <rect x="17" y="94" width="11" height="34" rx="5.5"/>
      <rect x="92" y="94" width="11" height="34" rx="5.5"/>
    </g>

    <circle class="body-map__skin" cx="22" cy="134" r="6"/>
    <circle class="body-map__skin" cx="98" cy="134" r="6"/>

    <g class="body-map__area" data-part="glutes">
      <ellipse cx="50" cy="125" rx="11" ry="12"/>
      <ellipse cx="70" cy="125" rx="11" ry="12"/>
    </g>
    <g class="body-map__area" data-part="legs">
      <rect x="40" y="139" width="19" height="50" rx="9"/>
      <rect x="61" y="139" width="19" height="50" rx="9"/>
      <rect x="42" y="192" width="15" height="50" rx="7"/>
      <rect x="63" y="192" width="15" height="50" rx="7"/>
    </g>

    <ellipse class="body-map__skin" cx="49" cy="249" rx="9" ry="5"/>
    <ellipse class="body-map__skin" cx="71" cy="249" rx="9" ry="5"/>
    <text class="body-map__label" x="60" y="268" text-anchor="middle">BACK</text>
  </g>
`;

/**
 * Draws the map inside `container`.
 * Pass `onPartClick` to let people click areas; the map is mouse-only,
 * so the chip buttons next to it stay the keyboard path.
 */
export function createBodyMap(container, { onPartClick } = {}) {
  container.innerHTML = `<svg class="body-map" viewBox="0 0 260 270" role="img">${FRONT}${BACK}</svg>`;
  const svg = container.firstElementChild;
  const areas = [...svg.querySelectorAll('.body-map__area')];

  if (onPartClick) {
    makeClickable();
  }

  /** Paints the given areas orange and the rest grey. */
  function showSelected(partIds) {
    for (const area of areas) {
      area.classList.toggle('is-selected', partIds.includes(area.dataset.part));
    }
    const labels = partIds.map(getPartLabel).join(', ') || 'nothing selected';
    svg.setAttribute('aria-label', `Body map: ${labels}`);
  }

  // Hovering one shape highlights its whole area, e.g. both shoulders, front and back
  function makeClickable() {
    svg.classList.add('body-map--clickable');

    svg.addEventListener('click', (event) => {
      const area = event.target.closest('.body-map__area');
      if (area) {
        onPartClick(area.dataset.part);
      }
    });

    svg.addEventListener('pointerover', (event) => {
      const area = event.target.closest('.body-map__area');
      showHovered(area ? area.dataset.part : null);
    });

    svg.addEventListener('pointerleave', () => showHovered(null));
  }

  function showHovered(partId) {
    for (const area of areas) {
      area.classList.toggle('is-hovered', area.dataset.part === partId);
    }
  }

  return { showSelected };
}
