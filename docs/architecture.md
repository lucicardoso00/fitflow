# Architecture

Forma is a static, three-page website. GitHub Pages serves the checked-in HTML,
CSS, JavaScript, SVGs and fonts. All application logic runs in the browser.
There are no API endpoints, external runtime services or generated bundles.

## Module boundaries

| Layer | Files | Responsibility |
| --- | --- | --- |
| Content | Root HTML files | Semantic structure, controls and card templates |
| Appearance | `css/` | Tokens, components and responsive page styles |
| Pages | `js/pages/` | Connect controls to state and update the DOM |
| Components | `js/components/` | Body map, exercise card and wall-clock rest timer |
| Rules | `js/lib/planner.js`, `choices.js` | Validate choices and build deterministic plans |
| Persistence | `js/lib/storage.js` | Read, validate and save browser data |
| Catalogue | `js/data/` | Exercises, body areas and workout settings |

The planner has no DOM, storage or network access. Page modules call it directly.
Reusable UI components do not navigate between pages. Persistence is centralized
so failures and obsolete data are handled consistently. Small functions and
native ES modules keep these responsibilities separate without a framework.

## Follow a workout

1. `builder.js` normalizes saved choices or uses the defaults.
2. A choice immediately rebuilds the plan with `buildPlan(choices)`.
3. Each selected area's first exercise is considered before second choices.
   Exercises are unique. Dumbbells allow both weighted and bodyweight movements.
4. Full-body movements, then remaining compatible exercises, fill spare places.
   The 15/30/45-minute presets choose 4/6/8 exercises.
5. Start saves the plan and initial set in sessionStorage before navigation.
6. `workout.js` advances sets, persists the rest deadline, and runs the timer.
   Refreshing restores the current set and remaining rest time.
7. Finish saves the result, clears the active workout and opens `done.html`.
8. The summary shows elapsed time, totals and the completed exercises.

Stored exercise IDs are resolved against the current catalogue when a workout
is loaded. Invalid snapshots are discarded. Persistent results fall back to
session storage if localStorage is blocked; the UI reports failed writes rather
than claiming a save succeeded. Browser storage is local to this device and
origin, so localhost and GitHub Pages have separate histories.

## Static hosting

Each screen is a real HTML document. Navigation, asset URLs and module imports
are relative to the current file, so both `/` and `/fitflow/` work. Refreshes and
direct links need no server rewrite. `.nojekyll` opts out of Jekyll processing.
Fonts and illustrations are served from `assets/` with the site.

`scripts/serve.js` is an optional local static server with no application logic.
`BASE_PATH=/fitflow/` reproduces a project-site prefix for verification. There
is no production Node process, package installation or compilation step.

## Design assets

`design/` holds the editable Figma document and its source tools. These are
optional authoring artifacts; the website never imports them. The archived
architecture diagrams describe the previous Node implementation and are kept
in `design/archive/architecture/` only as historical references.
