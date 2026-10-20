# Forma / FitFlow

A workout planner made with plain HTML, CSS and JavaScript. The browser builds
plans, tracks sets and rests, and remembers progress on this device. There is
no backend, framework, package installation or build step required to host it.

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
| `js/components/` | Body map, exercise cards and rest timer |
| `js/lib/planner.js` | Pure exercise-selection rules |
| `js/lib/choices.js` | Choice validation and labels |
| `js/lib/storage.js` | Browser persistence and snapshot validation |
| `js/lib/format.js` | Shared display formatting |
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
reported, and invalid saved snapshots return to the builder.

## Check changes

```sh
npm test
```

Tests cover all 762 nonempty body-area/time/equipment combinations, catalogue
assets, malformed storage, static serving under `/fitflow/`, and the Figma
prototype's choice and workout state transitions. Also walk
through Builder → Workout → Rest → Done with a keyboard and a narrow viewport.

To add an exercise, edit `js/data/exercises.js` and add its matching SVG to
`assets/images/exercises/`. Catalogue order determines priority within an area;
`full-body` marks fallback movements. Refresh the browser after editing.

## Figma design and prototype

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

See [`design/OPEN-IN-FIGMA.txt`](design/OPEN-IN-FIGMA.txt) for the file structure
and verification limits. The exported actions have been decoded and simulated
for all combinations on both viewports; native Figma Present verification is
still required. With the optional OpenPencil tooling installed, `npm run
design:build` rebuilds, checks, renders and packages the design. These tools are
independent of the static website.
