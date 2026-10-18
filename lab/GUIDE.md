# Adding a game to Telekinesis

You are working in a git worktree of Telekinesis: at-home movement games that turn a
webcam into a clinical motor test. A study team has described a test in plain English.
Your job is to add it as a new, playable game, with tests, and leave the suite green.

Work only inside the current directory. Do not install packages, touch git, or start
servers. The only commands you may run are `npx vitest run`, `npx tsc -b` and
`npx oxlint`.

## How a game is built

Read these first; copy their shape, naming and comment style:

- `src/play/games/reach.ts` and `reach.test.ts`: a pure game. `createX()` returns
  `{ state, update(frame: PoseFrame) }`. It only measures, it never draws.
- `src/play/controllers.ts`: wraps each game for the screen. `GAMES` holds the
  game's info card; a `Controller` turns state into a `Hud` (instruction, big number,
  readouts, progress, meter, alert), draws an overlay on the canvas, and builds the
  `SessionRecord` with `record(demo)`.
- `src/play/simulated.ts`: a simulated participant for demo mode, built from
  `makeBody()` / `makeHand()` in `src/play/body.ts`.
- `src/play/pose.ts` (`J` body joints, `H` hand joints) and `src/play/geometry.ts`
  (`mid`, `dist`, `angleAt`, `abduction`).

## Every place a new game must be registered

Pick a short kebab-case id, e.g. `side-bend`. Then:

1. `src/play/games/<camelName>.ts`: the game logic.
2. `src/play/games/<camelName>.test.ts`: vitest tests driven by `makeBody(...)`
   frames, covering: nothing in frame, the movement being counted, a movement that
   falls short not being counted, and the game finishing.
3. `src/play/simulated.ts`: add the id to the `GameId` union, and a branch in
   `simulate()` that plays the game believably so demo mode reaches the end.
   If `makeBody` lacks a posture you need, extend `Posture` in `body.ts` without
   changing its existing behaviour.
4. `src/play/controllers.ts`: an entry in `GAMES` (`tracking: "pose"` or `"hand"`),
   a controller function, and a branch in `createController()`. Instructions are
   spoken aloud by a voice coach, so write them as short, kind, plain sentences.
   The game must set `done` on its own, within about 60 seconds.
5. `src/play/research.ts`: an entry in `RESEARCH`. Write `why` and `trial` plainly.
   Leave `papers: []` unless you are certain of a real paper and its PubMed id;
   never invent a citation.
6. `src/pages/Play.tsx`: append the id to `ORDER`.

## Done means

- `npx tsc -b` passes with no errors.
- `npx vitest run` passes, including your new tests.
- Demo mode would finish: the simulated participant drives the game to `done`.
  Add a test to `src/play/simulated.test.ts` in the same style as the others.

Keep the visual language: the overlay is "thermal", cold at rest and warm with
movement; use `heatRgb` from `thermal.ts` as the other controllers do.

When finished, reply with the game id, its display name, and two sentences on what it
measures and how.
