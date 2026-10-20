# Forma: the smallest useful C4 architecture

## The idea in one sentence

**The browser draws the screens, Node picks the exercises, and one JavaScript
module holds the catalogue.**

The three pages are plain HTML. JavaScript modules connect them to one Node.js
application through the browser's built-in `fetch`. Node serves both the pages
and the API from the same origin, so there is no CORS configuration, no package
to install and no build step.

## C4 level 1: system context

Open [the context diagram](diagrams/context.html).

This is the outside view: a person uses Forma in a browser to build and follow
a workout. Forma talks to no other system. Exercises and their illustrations
live in the repository.

## C4 level 2: containers

Open [the container diagram](diagrams/containers.html).

In C4, a **container means an application or a data store**. It does not mean
you need Docker. Here are the actual pieces:

| Piece | Technology | Job | Code |
| --- | --- | --- | --- |
| Web frontend | HTML, CSS, browser JavaScript | Choices, workout flow, display | HTML pages, `css/`, `js/` |
| Forma server | Node.js HTTP | Validate choices, build plans, serve files | `server/` |
| Exercise catalogue | JavaScript module | List every exercise and what it trains | `js/data/exercises.js` |
| Browser storage | localStorage and sessionStorage | Remember choices, the active workout and the last result | `js/lib/storage.js` |

The catalogue is an ordinary module, so the server imports it at startup and
the tests import it directly. Restart Node after editing it.

## Where the code belongs

C4 level 3 would zoom inside a single container. A responsibility table is
enough for this project; a separate component diagram would repeat these files.

| When you want to… | Edit… |
| --- | --- |
| Change a color or type size | `css/tokens.css` |
| Change the layout of a screen | Its HTML and `css/pages/` file |
| Change a button's page behavior | Its `js/pages/` file |
| Change how plans are requested | `js/lib/api.js` |
| Change how exercises are selected | `server/planner.js` |
| Add a route or input rule | `server/app.js` |
| Add or change an exercise | `js/data/exercises.js`, plus its SVG in `assets/images/exercises/` |

Page modules manage the DOM. The planner receives data and returns data.
Storage goes through `storage.js`. Browser requests go through `api.js`.
These are ordinary modules and functions; no controller/repository/service
class hierarchy is needed.

C4 level 4 is the code itself. Keep short functions and clear names rather than
maintaining a class diagram for a project without classes. The official
[C4 guidance](https://c4model.com/diagrams) recommends using only the levels
that add value and says context and container diagrams are enough for most teams.

## Follow one workout

1. The user picks body areas, time and equipment in `index.html`.
2. `builder.js` sends those choices through `api.js` to `GET /v1/plan`.
3. Node validates the values and hands them to the planner.
4. The chosen areas take turns: every area's first pick, then every area's
   second pick, and so on. No exercise appears twice. Choosing dumbbells also
   allows every bodyweight movement.
5. If the chosen areas run out of exercises, full-body movements fill the plan
   and are labelled **Full body**. This is an explicit rule for a small catalogue.
6. The response holds the complete exercise records. `builder.js` shows them and
   stores the workout snapshot in sessionStorage when Start is clicked.
7. `workout.js` reads that snapshot, advances the sets and runs the rest timer.
8. Finishing writes the result to localStorage; `done.js` renders the summary.

The minutes choice selects 4, 6 or 8 exercises. It is a plan-size preset, not a
guarantee of elapsed time. The summary shows the actual elapsed time.

A newer plan request cancels the older one, so fast clicks cannot replace a new
selection with an old response. The builder shows a loading state and a retry
button if a request fails. Workout progress lives in this browser only.

## Catalogue contract

Each exercise has a stable `id` (also the name of its SVG file), a display
`name`, its `equipment` (`none` or `dumbbells`), an `areas` list, and either a
repetition target (`reps`, `unit`) or a timed target (`seconds`, `cue`).
Within one area, the exercise listed first is picked first. The area
`full-body` is not selectable; it marks the movements used to fill a plan.

## Decisions: start small, grow for a reason

| Decision now | Reason | Revisit when… |
| --- | --- | --- |
| One responsive website | Reuses the existing student work | A native feature is required |
| One Node process | One command starts the whole project | Independent services solve a measured problem |
| Catalogue as a module | No file to read or parse; shared by server and tests | Content is edited by people who do not edit code |
| Local SVG illustrations | Predictable display without provider requests | Reviewed photos or videos are available |
| Browser progress | No login or user database to learn yet | Cross-device history becomes a requirement |

## A practical learning order

1. Run the app and change one design token.
2. Follow one click from the HTML into `builder.js`.
3. Open the plan endpoint in the browser and inspect the JSON.
4. Change one exercise in the catalogue and restart Node.
5. Read the planner, then run `npm test`.

Tests verify the selection rules and the real HTTP handler without opening a
socket. Before submitting, also walk through Builder → Workout → Rest → Done
in a browser, including keyboard use and a narrow screen.
