# Architecture

Forma is a static, three-page website. GitHub Pages serves the checked-in HTML,
CSS, JavaScript, SVGs and fonts. All application logic runs in the browser.
There are no app-owned API endpoints or generated bundles. The browser
consumes wger's public REST API and YouTube's public IFrame Player API.

## Module boundaries

| Layer | Files | Responsibility |
| --- | --- | --- |
| Content | Root HTML files | Semantic structure, controls and card templates |
| Appearance | `css/` | Tokens, components and responsive page styles |
| Pages | `js/pages/` | Connect controls to state and update the DOM |
| Components | `js/components/` | Body map, movement row, native guide dialog and wall-clock rest timer |
| Rules | `js/lib/planner.js`, `choices.js` | Validate choices and build deterministic plans |
| Persistence | `js/lib/storage.js` | Read, validate and save browser data |
| External data | `js/lib/exercise-api.js` | Batched public exercise requests, validation, timeout and cache |
| Video | `js/lib/youtube-player.js` | Lazy-load the player API, handle readiness/failure and destroy players |
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

## Exercise and video data

`exercise-sources.js` maps each local movement ID to an explicitly reviewed
wger record and YouTube video. Plans continue to use a curated local catalogue;
API content enriches each movement with a guide rather than changing a
prescription or swapping in an unrelated search result.

The builder debounces changes for 300 ms, cancels its previous request and
fetches missing guide records together using `id__in`. Only English records
with known licences are accepted. A normalized, size-bounded cache is fresh
for 24 hours; a failed refresh may use a cached record up to seven days old.
Failed or missing records remain unavailable. Opening the guide uses this
same client, with a manual forced retry when needed. Browser storage failures
leave the in-memory cache and live requests available.

The shared guide uses `<dialog>` for background inertness, focus containment,
Escape and focus return. API HTML is parsed in an inert template and rebuilt
using a short formatting allowlist; attributes and executable elements are
discarded. Source/creator links are constructed from reviewed IDs, and the
translation's licence and attribution accompany its description.

YouTube's SDK and privacy-enhanced player load only when requested. Playback
is user-controlled. Closing the dialog destroys the player, even if its SDK
request has not finished. SDK timeouts and player errors expose a retry and
direct video link. An outage of either service cannot interrupt set/rest state.

These services accept browser requests without application credentials. No
workout state is sent to them. GitHub Pages hosts only the static application;
it does not proxy API calls or run a backend.

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
