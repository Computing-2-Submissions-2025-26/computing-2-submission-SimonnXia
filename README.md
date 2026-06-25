# Mochi and the Shrine of Shadows

**CID:** 02580218

A cute, turn-based, board-based browser game written in plain JavaScript. You
play **Mochi**, a small cat of the Cat Kingdom, sent to rescue the King from a
monster sealed inside a dark shrine.

The game runs in four phases: an **intro** story screen, the **Sakura Forest**,
the **Sealed Land**, and an **ending** screen.

## Story

The King has been captured by the Dark Shrine. Mochi must travel into the Sakura
Forest, awaken its three sleeping spirits to open the sealed gate, then enter the
Sealed Land and shatter the Dark Shrine to rescue the King.

## Turn system

There is exactly **one action per turn**. Each turn you choose either:

- **Move** — walk 1 or 2 tiles, orthogonally, without passing through obstacles
  or leaving the board; or
- **Meow** — the only interaction. Its effect depends on what is adjacent.

Moving and Meowing cost **1 stamina**. Mochi has 5 stamina, and fish-cookie
refills placed on the route restore stamina to full.

## Map 1 — Sakura Forest

- Three dormant sakura trees each seal a spirit.
- Stand next to a tree and **Meow** to awaken it and free its spirit.
- When all three spirits are free, the central shrine gate opens.
- Move onto the open gate to travel to the Sealed Land.
- Ponds, rocks, bushes, and fences block movement.
- Fish cookies are placed on the intended path. Mochi must collect enough of
  them to wake every tree and still reach the shrine gate.

## Map 2 — Sealed Land

- A 9×9 open arena with four obelisks in the corners and the **Dark Shrine** at the
  top.
- Stand next to an obelisk and **Meow** to destroy it.
- Destroy all four obelisks and the Dark Shrine falls — the King is rescued.
- The Sealed Land now has 8 fish cookies, giving several route and emergency
  stamina refills between obelisks.
- It also has 10 tombstones clustered around the inner arena. Stepping on one is
  allowed, but Mochi must spend the next turn recovering before acting again.

### The boss mechanic

When the Dark Shrine is **awake**, each turn it marks the tile Mochi is standing
on. At the end of your turn:

- if you are **still on the marked tile**, you are caught and the game is lost;
- otherwise the marked tile **crumbles into void** and can never be entered
  again.

Because standing still (Meowing) on a marked tile is fatal, obelisks can only be
safely destroyed while the boss is **silenced**. Destroying an obelisk silences
the Dark Shrine for **5 turns**, and the shrine begins dormant — so the game is a
race to chain the four obelisks before silence runs out and the floor starts
collapsing beneath you.

## Controls

- Arrow keys or `WASD`: move one tile (one turn).
- Click a highlighted tile (1–2 tiles away): move there (one turn).
- `M` or `Space`, or the **Meow** button: Meow.
- After moving or Meowing, press **Next Turn** before taking another action.
- **End Turn** button: skip the current action; if cursed by a tombstone, it
  becomes **Recover** and clears the lost-action turn.
- **Restart** / **Play Again** / **Try Again**: start over.

## Run the game

Node 18 or newer. The bundled server has no runtime dependencies.

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080). (Serving over `http://` is
required because the page uses ES module imports.)

## Run tests

```bash
npm test
```

Node's built-in test runner. The 23 tests cover both maps: moving up to two
tiles, blocked movement, awakening trees, freeing spirits, gate gating and
transition, stamina spending, fish-cookie refills, exhausted-action blocking,
open-arena movement, the expanded Sealed-Land fish/tombstone layout, tombstone
recovery, destroying obelisks, boss silencing and targeting, death on a targeted
tile, void tiles, boss defeat, the ending, and a complete route from intro to
victory.

The behaviour specification is in `web-app/tests/test-specification.md`.

## Lint

```bash
npm install
npm run lint
```

A small ESLint config for browser modules, the Node server, and Node tests. Do
not commit the generated `node_modules` folder.

## Generate API Docs

The public game API is documented with JSDoc comments in `web-app/game.js`.
Generate browsable documentation with:

```bash
npm run docs
```

This writes generated files to `docs/api`, which is ignored because the source
of truth is the documented module and `web-app/API.md`.

## Console simulation

The rules module runs without the browser:

```js
import {
  createInitialState, startGame, movePlayer, useMeow,
} from "./web-app/game.js";

let game = createInitialState();   // intro
game = startGame(game);            // enter the forest
game = movePlayer(game, ["up", "up"]);
game = useMeow(game);              // wake an adjacent tree
console.log(game.phase, game.player, game.message);
```

Every action returns a new state, so the same module drives the browser, the
tests, and a console script.

## Architecture

```text
web-app/
  index.html   Four phase screens (intro, play board, ending)
  style.css    Pastel forest + dark Sealed-Land pixel presentation
  main.js      DOM rendering, input, screen switching
  game.js      All game rules and state transitions
  API.md       Exported game-module contract
  server.js    Dependency-free local HTTP server
  tests/
    game.test.js
    test-specification.md
```

`main.js` imports and calls `game.js`; it never decides movement validity, tree
awakening, gate opening, boss targeting, or win/lose conditions itself. The
boards hold terrain only — Mochi, trees, the boss, and obelisks are stored
separately. The module uses pure functions and array methods (`map`, `filter`,
`some`, `every`, `flatMap`).

## Assessment Checklist

- **Game Module API:** `web-app/API.md` and JSDoc in `web-app/game.js` document
  exported functions, state types, invalid actions, and return values.
- **Game Module Implementation:** `web-app/game.js` contains the pure game
  rules and supports console simulation without the browser.
- **Unit Test Specification:** `web-app/tests/test-specification.md` describes
  behaviour in Given / When / Then form.
- **Unit Test Implementation:** `web-app/tests/game.test.js` uses Node's test
  runner and includes a complete route from intro to victory.
- **Web Application:** `index.html`, `style.css`, and `main.js` keep structure,
  styling, and behaviour separate, while the UI calls the game module for rules.

## Accessibility

- Semantic sections, headings, lists, and real `<button>` elements.
- Every board cell is a button with a descriptive `aria-label` (coordinate,
  contents, danger state, Mochi's position).
- Full keyboard play: arrows/`WASD` to move, `M`/`Space` to Meow, buttons for
  End Turn and Restart; visible focus outlines independent of colour.
- `aria-live` message region; the lost state uses an `alertdialog`.
- Status (phase, turn, spirits, obelisks, gate, boss silence) is shown as text,
  not colour alone.
- `prefers-reduced-motion` disables animations.

## Assets

Pixel-art files live in `web-app/assets/`. The project uses local images for
Mochi's action poses, the crowned king cat, sakura trees and spirits, fish
cookies, tombstones, the intro
story art, the ending art, shrine gates, forest tiles, Sealed-Land floor/void
tiles, obelisks, and the Dark Shrine. Larger supplied sheets are kept in the
assets folder, and board-sized transparent sprites are cropped from them for the
playable map.

## Known limitations

- The two maps are fixed, hand-validated layouts rather than generated.
- State is held in memory; refreshing the page restarts from the intro.
- The Sealed Land is a 9×9 board inspired by the supplied full-map reference,
  while the playable state still tracks each tile separately for testing.
