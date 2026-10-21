# Architecture

FitFlow is a static website of three pages. Everything runs in the browser;
GitHub Pages (or any static server) only serves the files.

## The layers

| Layer | Files | What it may do |
| --- | --- | --- |
| Markup | `index.html`, `workout.html`, `done.html` | Structure, controls and the `<template>`s scripts copy |
| Look | `css/` | Tokens, components and page layouts; no behaviour |
| Pages | `js/pages/` | Find elements, react to clicks, call the rules, redraw |
| Components | `js/components/` | Fill and wire a piece of markup; never navigate |
| Rules | `js/lib/planner.js`, `choices.js`, `format.js` | Pure functions: no DOM, storage or network |
| Storage | `js/lib/storage.js` | The only place that touches localStorage / sessionStorage |
| Network | `js/lib/exercise-guides.js` | The only place that calls another server (wger) |
| Facts | `js/data/` | Body areas, exercises, guide and video ids, settings |

A page imports from any layer below it. Components import rules, storage and
facts. Rules import only facts. That keeps every file explainable on its own.

## One workout, end to end

1. `builder.js` normalizes the saved choices and calls `buildPlan(choices)`.
2. The planner lets each chosen area take turns picking its next exercise,
   never repeats one, and fills spare places with full-body movements.
   15 / 30 / 45 minutes mean 4 / 6 / 8 exercises.
3. *Start workout* writes `{ title, parts, plan, startedAt, exerciseIndex, setNumber }`
   to sessionStorage and the link opens `workout.html`.
4. `workout.js` reads it back, shows the current exercise, and after every
   *Done set* saves the new position plus `restEndsAt`, the time the rest ends.
   A refresh during a rest continues the countdown from that time.
5. *Finish workout* writes the result (with `finishedAt`) to localStorage and
   opens `done.html`, which shows the numbers and the routine.

When a saved plan is read back, each exercise is looked up in the catalogue by
id; if one no longer exists, the saved workout is dropped and the person
returns to the builder.

## Guides and videos

`js/data/exercise-sources.js` pairs every exercise with a reviewed wger record
id and YouTube video id, so the app never searches. Opening a *Movement guide*
fetches that one record (`/api/v2/exerciseinfo/?id__in=<id>`), keeps the
English text, author and licence, and remembers it for the rest of the page.
wger writes its descriptions in HTML, so `copySafeFormatting` copies only
paragraphs, lists, bold and italics into the page. *Watch video* sets the
`src` of a hidden `<iframe>` to the privacy-enhanced YouTube embed; *Show
illustration* clears it again, which also stops playback.

Neither service is needed for the workout itself: if a request fails, the
guide shows a message with a *Try again* button and everything else works.
