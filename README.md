# Mochi's Sakura Garden

**CID:** 02580218

Mochi's Sakura Garden is a cozy, turn-based 7 x 7 browser puzzle written in
plain JavaScript. Mochi is a small white-and-brown cat restoring a peaceful
garden by collecting petals, befriending spirits, blooming three cherry trees,
and finally visiting the shrine.

There is no combat or lose condition. The crow and tanuki only create small
route puzzles, and the fixed map always has a route to the shrine.

## Objective

Complete the garden in a clear cozy sequence:

1. Meow beside each stone lantern to light it.
2. Use the nearby lantern light to calm its shy sakura spirit.
3. A calmed spirit unlocks petal collection. Gather three petals, restore a
   tree, and guide the spirit to its new blooming home.
4. Reach the shrine after the other wishes are complete. The shrine stays
   locked and cannot be entered until all trees and spirits are finished.

This creates a repeatable quest loop: **lantern → spirit → petals → tree**.
The first loop uses the F6 lantern, E7 spirit, F5 petals, and G7 tree. The
second begins at the A4 lantern and B3 spirit, then continues through the
remaining petals and trees.

Completion awards three stars by turn 16, two stars by turn 24, and one star
after that.

## Rules and actions

Each player turn starts with two action points.

- **Walk:** Move one tile up, right, down, or left for 1 AP. Ponds, rocks,
  static objects, and blocking creatures cannot be entered. Petals, tea, and
  fish snacks are collected automatically, but petal piles wait until a spirit
  has been calmed.
- **Meow:** Spend 1 AP and 1 energy for contextual interaction. Meow can calm a
  spirit, wake the tanuki after a tree is restored, reveal hidden petals, light
  a lantern, or move the crow away. Each spirit first needs its nearby lantern.
- **Restore:** While adjacent to a damaged tree, spend 1 AP and 3 petals to
  restore it. Restore remains locked until a spirit has been calmed.
- **Rest:** Spend 1 AP to restore up to 2 energy. Walking and restoring never
  consume energy.
- **End turn:** Resolve the deterministic garden turn. Following spirits move
  toward Mochi. The crow waits until spirits unlock petal collection, then
  moves toward the nearest visible pile. After taking one pile, the satisfied
  crow stops collecting so the garden remains completable.

Petal piles give three petals. Tea restores three energy and fish snacks
restore two, up to Mochi's maximum of eight.

The fixed garden includes five visible petal piles. The D6 pile is kept off the
main C3-to-B4 corridor so it never looks like a route blocker. The crow may
take one, so
the remaining route still provides more than the nine petals needed for all
three trees. The main route is a connected loop through C1, C4, G7, and the
central shrine; hidden petals at B7 are an optional bonus rather than a
requirement for completion.

## Controls

- Arrow keys or `WASD`: walk.
- Click a highlighted adjacent tile: walk there.
- `1`: focus the Walk control.
- `2`: Meow.
- `3`: Restore.
- `4`: Rest.
- Buttons: all actions, End turn, and New garden.

Each player action has visible pixel feedback on Mochi: walking uses a hopping
step, Meow opens Mochi's mouth with a speech bubble and sound ring, Restore
adds a blossom-casting motion and tree burst, and Rest swaps to a curled sprite
with a floating heart. Item collection also has its own celebratory hop.

## Run the game

Node 18 or newer is recommended. The included server has no runtime
dependencies.

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080).

The `web-app` folder can also be served with VS Code Live Server. Opening the
HTML directly as a `file://` page is not recommended because browsers commonly
restrict ES module imports there.

## Run tests

```bash
npm test
```

The project uses Node's built-in test runner. The 46 tests cover movement,
items, Meow interactions, tree restoration, spirit following, crow movement,
turns, completion and scoring. One test plays the fixed map from the starting
position to the shrine. Its route completes on turn 23 with two stars.

The behaviour specification is in
`web-app/tests/test-specification.md`.

### Test verification

To check that the tests detect real faults, one rule from each main group was
temporarily changed:

- movement did not spend AP;
- petal piles gave the wrong amount;
- Meow did not spend energy;
- the garden turn did not increment the round;
- shrine completion was disabled.

The relevant tests failed for each change. The correct rules were then restored
and the full suite passed.

## Lint

The coursework does not specify a linter, so the project uses a small ESLint
configuration for browser modules, the Node server, and Node tests.

Install the development tool locally, run lint, and do not submit the generated
`node_modules` folder:

```bash
npm install
npm run lint
```

## Console simulation

The rules module works without the browser:

```js
import {
  createInitialState,
  endPlayerTurn,
  movePlayer,
  restoreTree,
  useMeow,
} from "./web-app/game.js";

let game = createInitialState();
game = movePlayer(game, "up");
game = useMeow(game);       // Context decides whether anything is nearby.
game = restoreTree(game);   // Invalid attempts return useful feedback.
game = endPlayerTurn(game);

console.log(game.round, game.player, game.message);
```

Every action returns a new state, so the same module can be used by the browser,
tests and a console script.

## Architecture

```text
web-app/
  index.html                 Semantic page structure
  style.css                  Responsive pixel-art presentation
  main.js                    DOM rendering, input, and short UI effects
  game.js                    All game rules and state transitions
  API.md                     Exported game-module contract
  server.js                  Dependency-free local HTTP server
  tests/
    game.test.js             Node unit tests
    test-specification.md    Given / When / Then specification

eslint.config.js
package.json
README.md
```

`main.js` imports and calls `game.js`; it does not implement movement,
collection, interaction, creature, turn, scoring, or completion rules. The
board contains only terrain/static objects, while Mochi and creatures are
stored separately.

The module uses pure functions where practical. Board and creature changes use
array methods such as `map`, `filter`, `find`, `some`, `every`, and `flatMap`.

The full documented contract is in `web-app/API.md`, with matching JSDoc in
`web-app/game.js`.

## Accessibility review

- Semantic header, main, sections, aside, headings, lists, buttons, and
  definition lists structure the page.
- Every board cell is a real button with row, column, tile, creature status,
  Mochi position, and movement availability in its `aria-label`.
- Arrow keys, `WASD`, number shortcuts, board-cell clicks, and buttons support
  keyboard-only play.
- Strong visible focus outlines are independent of colour.
- The current message uses `aria-live="polite"`.
- Player/garden turn, AP, insufficient energy, insufficient petals, blocked
  movement, quest order, locked petals and trees, all creature statuses, tree
  and lantern states, shrine progress, completion, and star rating are
  communicated with text as well as colour.
- Dark outlines and text on light solid backgrounds provide strong contrast.
- `prefers-reduced-motion` removes decorative and sprite animation, and the
  garden-turn display delay is shortened.
- The board remains square. Controls stay beside the map on desktop and move
  below it on narrower screens.

## Known limitations

- The garden uses one fixed map rather than generated maps.
- State is held in memory; refreshing the page starts a new garden.
- Detailed local pixel sprites are stored in `web-app/assets`, while board
  textures, highlights, and interface panels are drawn with CSS.
