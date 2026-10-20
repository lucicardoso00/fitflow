# FitFlow

A workout planner made with plain HTML, CSS and JavaScript. The browser builds
plans, tracks sets and rests, and remembers progress on this device. There is
no backend, framework, package installation or build step required to host it.
Exercise guides come from the public wger API. Demonstrations use the public
YouTube IFrame Player API, with reviewed video matches for all 13 movements.
Neither integration requires an API key.

## GitHub Pages

The repository root is ready to publish as it is:

1. Push the files to `main` in `lucicardoso00/fitflow`.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Select **main** and **/ (root)**, then save.
4. Open <https://lucicardoso00.github.io/fitflow/> after deployment finishes.

`.nojekyll` disables Jekyll processing. All page, module, stylesheet, image and
font paths are relative, including navigation and redirects. Each screen has
its own HTML file, so refreshing does not need a routing fallback.
See [GitHub's Pages guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Local preview

Use any static HTTP server. With Node.js 22 or newer:

```sh
npm start
```

Open **http://127.0.0.1:3000**. `npm run dev` uses port **9999**. Refresh after
edits. Node is only a local preview/test tool; GitHub Pages does not run it.
Opening HTML through `file://` is unsupported because browsers restrict ES
module loading. For a Pages-style preview:

```sh
BASE_PATH=/fitflow/ npm start
```

Open **http://127.0.0.1:3000/fitflow/**. `HOST` and `PORT` can override the
preview server's bind address and port.

## Project structure

| Location | Responsibility |
| --- | --- |
| `index.html`, `workout.html`, `done.html` | Page structure and native controls |
| `css/` | Tokens, local fonts, shared components and responsive page layouts |
| `js/pages/` | Page events, state and rendering |
| `js/components/` | Body map, movement rows, inline videos, guide disclosures and rest timer |
| `js/lib/planner.js` | Pure exercise-selection rules |
| `js/lib/choices.js` | Choice validation and labels |
| `js/lib/storage.js` | Browser persistence and snapshot validation |
| `js/lib/format.js` | Shared display formatting |
| `js/lib/exercise-api.js` | Public exercise requests, validation and bounded cache |
| `js/lib/youtube-player.js` | On-demand player loading, errors and cleanup |
| `js/data/` | Body areas, workout settings and exercise catalogue |
| `assets/` | Local SVG illustrations and licensed fonts |
| `scripts/serve.js` | Optional static local preview |
| `test/` | Planner, storage and static-hosting regression checks |
| `docs/architecture.md` | Module boundaries and workout data flow |
| `design/` | Editable Figma file, reference assets and optional design tooling |

## Behavior and storage

Choose body areas, 15/30/45 minutes and equipment. These presets produce 4/6/8
exercises; they are not a guarantee of elapsed duration. Complete three sets
per exercise, with 45-second rests that can be extended or skipped. Refreshing
the workout restores progress and an active rest. The summary shows elapsed
time and totals.

Choices and results use localStorage; the active workout uses sessionStorage.
Data stays in this browser and origin, with no account or cloud sync. Storage
must be available to carry an active workout between pages. Failed saves are
reported, and invalid saved snapshots return to the builder. The internal
`forma:` storage keys are retained so the FitFlow rename preserves existing data.

## Public APIs

| Service | Integration | When it is contacted |
| --- | --- | --- |
| [wger REST API](https://wger.readthedocs.io/en/latest/api/api.html) | English movement descriptions, muscle names, authors and licences from `/api/v2/exerciseinfo/?id__in=…` | One batch for the visible plan, debounced after changes; retry from a guide |
| [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) | Actual embedded demonstration players, readiness/error events and cleanup on movement/set changes | Only after **Watch video**; playback starts with the player's controls |

Select a movement on the planner or summary to expand its preview inline.
During a workout, **Watch video** replaces the main exercise illustration with
the player; **Show illustration** switches it back. Written instructions are
under **Movement guide**. No popup is needed. Completing a set, switching
movements or collapsing a preview stops its video. Videos also have a direct
YouTube link if embedding is unavailable. Exact movement-to-provider IDs live in
`js/data/exercise-sources.js`; the app does not guess from search results.
The bodyweight option can include chair/bench dips; the planner and guide
explain when a stable support is needed.

Guides cache for 24 hours. If a refresh fails, previously downloaded guides
remain available for up to seven days with an explicit stale label. Requests
time out after eight seconds and changing the plan cancels the old request.
Missing, invalid or untranslated records show an unavailable state and retry.
The local planner, set tracking and rest timer continue when a service fails.
This is outage tolerance, not an offline-installable app; first page loads
and videos still require a network connection.

Each description shows its author, original wger record and licence. The
renderer rebuilds permitted text formatting and discards external HTML
attributes, scripts and media. API services receive normal browser requests;
workout history and progress are not uploaded. No proxy, account, secret,
YouTube Data API subscription or paid exercise service is required.

## Design references

The Mobbin audit informed specific interactions: [Tempo's workout plan](https://mobbin.com/screens/33fed058-0e7e-4a95-91aa-fc9a1ce659d1)
for ordered movement rows, [Gymshark's plan editor](https://mobbin.com/screens/8a121f5a-20a3-4d27-96fc-31c77927a29a)
for visible prescriptions and a persistent action, and [Google Health's workout flow](https://mobbin.com/flows/69f9b525-c45b-40f5-adc4-51eb2f2922e9)
for distinct active/rest/completion states. FitFlow retains its own typography,
colours and local artwork; no reference screenshots are shipped in the app.

## Check changes

```sh
npm test
```

`npm run check:apis` optionally verifies all live wger records and YouTube
metadata without credentials. It requires network access; playback and embed
permissions must also be checked in a browser.

Tests cover all 762 nonempty body-area/time/equipment combinations, catalogue
assets, malformed storage, API batching/cache/timeout/cancellation/error cases,
static serving under `/fitflow/`, and the Figma
prototype's choice and workout state transitions. Also walk
through Builder → Workout → Rest → Done with a keyboard and a narrow viewport.

To add an exercise, edit `js/data/exercises.js`, add reviewed guide/video IDs in
`js/data/exercise-sources.js`, and add its matching SVG to
`assets/images/exercises/`. Catalogue order determines priority within an area;
`full-body` marks fallback movements. Refresh the browser after editing.

## Figma design and prototype

The Figma artifacts capture the preceding Forma design; the website now uses
FitFlow branding and inline playback.

Import [`design/Forma.fig`](design/Forma.fig), then select **Desktop workout**
or **Mobile workout** in Present. The ZIP contains that same file, fonts and
previews. Importing an earlier revision into Figma does not keep it synced with
this repository; import the new file to get these changes.

The library uses native component sets, text properties, instances, Auto layout,
14 shared type styles, primitive tokens and semantic aliases. Prototype state
lives in its own collection. Choices regenerate the plan; completing sets,
the rest countdown, repeated extensions, skip, finish, save and history are
connected using native variables and conditional actions. Prototype saves last
for the presentation session, and its summary shows planned minutes.
Movement rows and the workout's guide button open a variable-driven guide
with attributed snapshots and native links to the matching video and source.
The website performs live API requests and embeds playback; the Figma
prototype uses the checked-in snapshots in `design/source/exercise-guides.js`.

See [`design/OPEN-IN-FIGMA.txt`](design/OPEN-IN-FIGMA.txt) for the file structure
and verification limits. The exported actions have been decoded and simulated
for all combinations on both viewports; native Figma Present verification is
still required. With the optional OpenPencil tooling installed, `npm run
design:build` rebuilds, checks, renders and packages the design. These tools are
independent of the static website.
