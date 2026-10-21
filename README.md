# FitFlow

A workout planner made with plain HTML, CSS and JavaScript. Pick the body areas
you want to train, how much time you have and whether you own dumbbells; the
browser builds the routine, walks you through it set by set with rest timers,
and remembers your progress on this device.

There is no framework, no build step and no backend. Written exercise guides
come from the public [wger](https://wger.de) API and video demonstrations are
embedded from YouTube; neither needs an API key.

## Run it

Any static web server works. With Node.js 22 or newer:

```sh
npm start
```

Open **http://127.0.0.1:3000**. Opening the HTML files directly (`file://`)
does not work, because browsers refuse to load JavaScript modules that way.

To publish on GitHub Pages, push the repository and choose **Deploy from a
branch → main → / (root)** in *Settings → Pages*. Every path in the app is
relative, so it works at `/` and at `/<repository>/`. To preview the latter:

```sh
BASE_PATH=/fitflow/ npm start
```

## How it works

```
index.html ──(Start workout)──▶ workout.html ──(Finish workout)──▶ done.html
builder.js                       workout.js                         done.js
```

1. **Choose** — `builder.js` reads the saved choices (or the defaults), and after
   every click rebuilds the plan with `buildPlan(choices)` and redraws the page.
   *Start workout* saves the plan in `sessionStorage`.
2. **Train** — `workout.js` reads that plan and walks through it: three sets per
   exercise, a 45-second rest between sets (+15 s or skip). Progress is saved
   after every set, so a refresh continues where it was, even mid-rest.
   *Finish workout* saves the result in `localStorage`.
3. **Done** — `done.js` shows the result: elapsed minutes, exercises, sets, the
   areas trained, and the routine. *Save plan* keeps a copy; the builder's
   *History* button reopens this page.

Every exercise row (and the workout page) has a **Movement guide** with written
instructions fetched from wger when it is opened, and a **Watch video** button
that embeds the YouTube demonstration.

## Find your way around

Every file has one job, stated in the comment at its top.

| Location | Job |
| --- | --- |
| `index.html`, `workout.html`, `done.html` | The three screens. All markup lives here, including the `<template>`s the scripts copy. |
| `css/tokens.css` | Every color, font, size and radius (the design system) |
| `css/base.css`, `css/layout.css` | Resets, text styles, the 1440px frame and the header |
| `css/components/` | One file per reusable piece: buttons, chips, body map, plan rows, rest timer… |
| `css/pages/` | Layout of each screen |
| `js/pages/` | One script per screen: finds its elements, reacts to clicks, redraws |
| `js/components/` | Pieces used by more than one screen: body map, plan row, exercise video and guide, rest timer |
| `js/lib/planner.js` | The rules that turn choices into a plan (pure function) |
| `js/lib/choices.js`, `js/lib/format.js` | Small helpers: validate choices, turn data into text |
| `js/lib/storage.js` | Saving and loading from the browser's storage |
| `js/lib/exercise-guides.js` | Fetching a guide from wger |
| `js/data/` | The facts: body areas, exercises, guide/video ids, settings |
| `assets/` | Illustrations, fonts and the favicon |
| `scripts/serve.js` | The optional local preview server |
| `test/` | Checks for the planner, storage, guides and the preview server |
| `design/` | The Figma file and the tools that build it (not used by the website) |

Page scripts all follow the same order: *page elements → state → actions →
drawing → events → start*. Components take an element that already holds
their markup and only fill it in and wire up its buttons.

## Storage

| Key | Where | Holds |
| --- | --- | --- |
| `fitflow:choices` | localStorage | The last areas, time and equipment picked |
| `fitflow:current-workout` | sessionStorage | The workout in progress (this tab only) |
| `fitflow:last-workout` | localStorage | The last finished workout |
| `fitflow:saved-plans` | localStorage | Plans kept with *Save plan* |

Everything stays in this browser; nothing is uploaded. If the browser blocks
storage, the page says that it could not save instead of pretending it did.
A saved workout whose exercise no longer exists in the catalogue is discarded.

## Check changes

```sh
npm test
```

The tests cover every body-area/time/equipment combination, the exercise
catalogue and its images, saving and loading, guide parsing and fetching, and
the preview server. `npm run check:apis` additionally asks wger and YouTube
whether every guide and video is still available (needs a network).

Also walk through Choose → Train → Rest → Done in a browser once.

## Add an exercise

1. Add it to `js/data/exercises.js`. Within one body area, the exercise listed
   first is picked first; tag the ones that may fill any plan with `full-body`.
2. Add its wger id, YouTube video id and creator to `js/data/exercise-sources.js`.
3. Add its illustration as `assets/images/exercises/<id>.svg`.

Refresh the browser; there is nothing to build.

## Design

The look follows the KINETIX athletic design system exported from Google Stitch:
dark surfaces, a lime accent, Space Grotesk headings and Inter text.
`design/FitFlow.fig` is the editable Figma file; see `design/OPEN-IN-FIGMA.txt`.
