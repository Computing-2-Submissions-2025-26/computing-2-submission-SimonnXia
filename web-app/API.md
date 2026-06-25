# Game Module API

`game.js` is a deterministic ES module containing all rules for *Mochi and the
Shrine of Shadows*. It has no DOM dependency, so it can be used by the browser
UI, Node tests, or a console simulation.

## Conventions

- Functions never mutate the supplied state; they return a new state object.
- Invalid actions return a new state with an explanatory `message` and log
  entry, leaving positions, progress, and the turn counter unchanged.
- Query functions (`isInsideBoard`, `getTileAt`, `canMoveTo`,
  `getAdjacentObjects`) return values without changing state.
- Rows and columns are zero-based.
- **One action per turn:** a turn is either one `movePlayer` (up to two tiles)
  or one `useMeow`. There is no action-point system.
- Move and Meow cost 1 stamina. Fish cookies restore stamina to full. A
  tombstone curse blocks actions until the player ends a recovery turn.

## Types

- `Phase`: `"intro"`, `"forest"`, `"sealedLand"`, or `"ending"`.
- `Status`: `"playing"`, `"won"`, or `"lost"`.
- `Direction`: `"up"`, `"right"`, `"down"`, or `"left"`.
- `TerrainType`: forest tiles (`grass`, `flowerGrass`, `rock`, `pond`, `bush`,
  `fence`, `gate`) and Sealed-Land tiles (`ground`, `void`).
- `Player`: `{ row, col, stamina, maxStamina, stunnedTurns }`.
- `Tree`: `{ id, row, col, awakened, spiritFreed }`.
- `FishCookie`: `{ id, row, col, collected }`.
- `Obelisk`: `{ id, row, col, destroyed }`.
- `Tombstone`: `{ id, row, col }`.
- `Boss`: `{ row, col, alive, silencedTurns, targetedTile }`.
- `GameState`: `phase`, `status`, `currentMap`, `turn`, `message`, `log`, plus
  the active map's data (`board`, `player`, and either the forest fields
  `trees`/`fishCookies`/`shrineGate`/`rescuedSpirits`/`totalSpirits` or the
  Sealed-Land fields
  `boss`/`obelisks`/`fishCookies`/`tombstones`/`destroyedTiles`/`destroyedObelisks`).

## Lifecycle and phases

### `createInitialState()`

`createInitialState(): GameState` — Creates the opening state on the intro
story screen (`phase: "intro"`, `turn: 0`). No board yet.

### `resetGame()`

`resetGame(): GameState` — Returns a fresh independent intro state.

### `startGame(state)`

`startGame(state: GameState): GameState` — Leaves the intro and builds the
Sakura Forest: 7×7 board, Mochi at G1, three dormant trees, a sealed central
shrine gate, route-critical fish cookies, and obstacles. Returns feedback if
the journey already began.

### `enterShrineGate(state)`

`enterShrineGate(state): GameState` — Carries Mochi through the open gate into
the Sealed Land. Returns feedback if the gate is still sealed.

### `createSealedLandState(state?)`

`createSealedLandState(state?): GameState` — Builds the Sealed-Land arena: a
9×9 board, four corner obelisks, ten tombstone curse tiles, eight fish-cookie
refills, the Dark Shrine at the top, and Mochi at the bottom. The boss begins
**dormant (silenced 5 turns)**. Carries the log forward.

### `transitionToEnding(state)`

`transitionToEnding(state): GameState` — Moves a won game to the ending story
screen. Returns feedback if the boss is not yet defeated.

## Board queries

### `isInsideBoard(row, col, size?)`

`isInsideBoard(row, col, size = 7): boolean` — True when the coordinates fit
inside a square board of the supplied size. The forest uses 7×7; the Sealed Land
uses 9×9.

### `getTileAt(state, row, col)`

`getTileAt(state, row, col): TerrainType | null` — The active-map tile, or null
when out of bounds or before a map exists.

### `canMoveTo(state, row, col)`

`canMoveTo(state, row, col): boolean` — Whether Mochi may stand on a tile. In
the forest, blocked terrain (rock/pond/bush/fence), trees, and a closed gate
return false. In the Sealed Land, void tiles, the boss tile, and standing
obelisks return false. Tombstone and fish-cookie tiles remain enterable.

### `getAdjacentObjects(state)`

`getAdjacentObjects(state): Array<{kind,id,row,col}>` — Interactable neighbours:
dormant trees in the forest, standing obelisks in the Sealed Land.

## Actions (one per turn)

### `movePlayer(state, pathOrDirections)`

`movePlayer(state, pathOrDirections: Direction | Direction[]): GameState` —
Moves Mochi one or two orthogonal tiles in a single turn. Every step must stay
on the board and land on a walkable tile (no passing through obstacles).
Moving costs 1 stamina. Stepping onto a fish cookie restores stamina to full and
marks that cookie collected. Stepping onto a tombstone in the Sealed Land sets
`stunnedTurns` to 1. Stepping onto the open gate transitions to the Sealed Land.
In the Sealed Land the boss turn resolves afterward. Invalid moves, exhausted
actions, and stunned actions return feedback without moving or advancing the
turn.

### `useMeow(state)`

`useMeow(state): GameState` — The only interaction. In the forest it wakes an
adjacent dormant tree and frees its spirit (opening the gate once all three are
free). In the Sealed Land it destroys an adjacent obelisk, silences the boss,
and resolves the boss turn — or wins the game on the fourth obelisk. With no
valid target the turn is not spent. Valid Meow actions cost 1 stamina; Meow is
blocked at 0 stamina or while stunned by a tombstone.

### `endTurn(state)`

`endTurn(state): GameState` — Mochi waits, taking no action. In the Sealed Land
this still resolves the boss turn (useful for dodging); in the forest it just
advances the turn counter. If `stunnedTurns` is greater than 0, ending the turn
clears the tombstone curse before the map resolves.

## Forest helpers

### `awakenTree(state, treeId)`

`awakenTree(state, treeId): GameState` — Marks a dormant tree awakened.

### `freeSpirit(state, treeId)`

`freeSpirit(state, treeId): GameState` — Frees the tree's spirit and increments
`rescuedSpirits` exactly once.

### `openShrineGate(state)`

`openShrineGate(state): GameState` — Opens the central gate.

### `checkForestCompletion(state)`

`checkForestCompletion(state): GameState` — Opens the gate once every spirit is
freed; otherwise returns an equivalent state.

## Sealed-Land helpers and the boss

### `selectBossTarget(state)`

`selectBossTarget(state): GameState` — When the boss is alive and not silenced,
marks Mochi's current tile as the targeted tile; otherwise clears the target.

### `resolveBossTurn(state)`

`resolveBossTurn(state): GameState` — Resolves the Dark Shrine's turn. If Mochi
is still on the targeted tile, the game is **lost**; otherwise that tile becomes
**void**. Silence then ticks down, an awake boss marks Mochi's tile for next
turn, and the turn counter advances.

### `destroyObelisk(state, obeliskId)`

`destroyObelisk(state, obeliskId): GameState` — Destroys an obelisk, increments
`destroyedObelisks`, and silences the Dark Shrine for five turns.

### `checkBossDefeat(state)`

`checkBossDefeat(state): GameState` — When all four obelisks are destroyed, the
boss dies and `status` becomes `"won"`.
