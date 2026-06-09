# Game Module API

`game.js` is a deterministic ES module containing all rules for Mochi's Sakura
Garden. It has no DOM dependency, so it can be used by the browser UI, Node
tests, or a console simulation.

## Conventions

- A `GameState` action never mutates the supplied state.
- State-producing functions return a new state object.
- Invalid player actions return a new state with an explanatory `message` and
  log entry, while positions, resources, objectives, and turn progress remain
  unchanged.
- Query functions return values without changing state.
- Rows and columns are zero-based in JavaScript.

## Types

The complete JSDoc typedefs are in `game.js`.

- `TerrainType`: one of the supported board tile strings.
- `GameStatus`: `"playing"` or `"completed"`.
- `Turn`: `"player"` or `"garden"`.
- `Direction`: `"up"`, `"right"`, `"down"`, or `"left"`.
- `CreatureType`: `"sakuraSpirit"`, `"sleepyTanuki"`, or `"petalCrow"`.
- `Player`: Mochi's position and resource values.
- `Creature`: a creature's identity, position, status, and following flag.
- `GameState`: board, player, creatures, turn information, objective progress,
  selected action, message, and log.

## State creation

### `createInitialState()`

**Signature:** `createInitialState(): GameState`

**Parameters:** None.

**Returns:** `GameState`.

Creates the fixed 7 x 7 starting garden, Mochi, two spirits, one tanuki, and one
crow. Invalid-action behaviour does not apply. Every call returns independent
board, player, creature, and log data.

### `resetGame()`

**Signature:** `resetGame(): GameState`

**Parameters:** None.

**Returns:** `GameState`.

Creates the same fresh state as `createInitialState`. It does not retain any
part of the previous game and returns a new state.

## Board queries

### `isInsideBoard(row, col)`

**Signature:** `isInsideBoard(row: number, col: number): boolean`

**Parameters:** `row` and `col` are integer board coordinates.

**Returns:** `boolean`.

Returns `true` only for coordinates from 0 through 6. Non-integers and
out-of-range values return `false`. It is a query and does not return state.

### `getTileAt(state, row, col)`

**Signature:** `getTileAt(state: GameState, row: number, col: number): TerrainType | null`

**Parameters:** `state` is the current game; `row` and `col` are coordinates.

**Returns:** A `TerrainType`, or `null`.

Reads static terrain from the board. Invalid coordinates return `null`. It does
not change or replace state.

### `isOccupied(state, row, col)`

**Signature:** `isOccupied(state: GameState, row: number, col: number): boolean`

**Parameters:** Current `state` and board coordinates.

**Returns:** `boolean`.

Reports whether a creature currently blocks Mochi. Shy/following spirits,
sleeping tanuki, and the crow block; helped spirits and the awake tanuki do not.
Invalid or empty positions return `false`. It is a query.

### `canMoveTo(state, row, col)`

**Signature:** `canMoveTo(state: GameState, row: number, col: number): boolean`

**Parameters:** Current `state` and proposed destination coordinates.

**Returns:** `boolean`.

Checks board bounds, blocked terrain, and blocking creatures. The shrine also
returns `false` until all three trees and both spirits are complete. It does
not check whether the tile is adjacent or whether action points remain;
`movePlayer` enforces those action rules. Petal piles, including locked piles,
remain walkable; collection eligibility is handled after movement. Invalid
coordinates return `false`. It is a query.

### `getAdjacentPositions(state)`

**Signature:** `getAdjacentPositions(state: GameState): Array<{row: number, col: number}>`

**Parameters:** Current `state`.

**Returns:** An array of valid positions in up, right, down, left order.

Positions outside the board are omitted. It is a query and returns no state.

### `getAdjacentInteractable(state)`

**Signature:** `getAdjacentInteractable(state: GameState): Interactable[]`

**Parameters:** Current `state`.

**Returns:** Objects describing adjacent creatures and relevant static objects.

Each result has `kind`, `row`, `col`, and `type`; creature results also have an
`id`. An empty array means nothing relevant is adjacent. It is a query.

## Player actions

### `movePlayer(state, direction)`

**Signature:** `movePlayer(state: GameState, direction: Direction): GameState`

**Parameters:** Current `state` and an orthogonal `direction`.

**Returns:** A new `GameState`.

Moves Mochi one tile, spends one action point, automatically collects a petal
pile, tea, or fish snack, and checks completion. Entering the shrine is refused
without spending AP until every tree and spirit objective is complete.
Unsupported directions, out-of-bounds destinations, blocked tiles, non-player
turns, zero action points, and completed games produce feedback without moving
or spending AP.

### `canMeow(state)`

**Signature:** `canMeow(state: GameState): boolean`

**Parameters:** Current `state`.

**Returns:** `boolean`.

Returns `true` during an active player turn when Mochi has AP, at least one
energy, and an adjacent eligible target. An unlit lantern is always eligible,
but a shy spirit is eligible only when its paired nearby lantern is on.
Hidden petals are eligible only after a spirit has been calmed. It is a query.

### `useMeow(state)`

**Signature:** `useMeow(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Spends one AP and one energy and applies all eligible adjacent contextual
effects: lighting a lantern, calming a spirit whose nearby lantern is lit,
attempting to wake the tanuki, pushing the crow, or revealing unlocked petals.
Trying to calm a spirit before its lantern, or reveal petals before calming a
spirit, returns clear feedback without spending AP or energy. A tanuki attempt
before restoring a tree still spends the action and explains the requirement.
No energy, no target, no AP, the wrong turn, or completion returns feedback
without applying effects.

### `canRestoreTree(state)`

**Signature:** `canRestoreTree(state: GameState): boolean`

**Parameters:** Current `state`.

**Returns:** `boolean`.

Checks for an active player turn, at least one previously calmed spirit, three
petals, one AP, and an adjacent damaged tree. It is a query.

### `restoreTree(state)`

**Signature:** `restoreTree(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Restores the first adjacent damaged tree in row/column order, spends three
petals and one AP, increments progress, logs the bloom, and checks completion.
Restoration is locked until a spirit has been calmed. A locked sequence,
missing petals, no adjacent tree, no AP, the wrong turn, or completion gives
feedback and leaves gameplay values unchanged.

### `rest(state)`

**Signature:** `rest(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Spends one AP and restores up to two energy. Resting at full energy is allowed
as a cozy pause. No AP, the wrong turn, or completion gives feedback without
spending AP.

### `collectTileItem(state)`

**Signature:** `collectTileItem(state: GameState): GameState`

**Parameters:** Current `state`, with Mochi already on a tile.

**Returns:** A new `GameState`.

Collects the item under Mochi: unlocked petal piles give three petals, tea
restores three energy, and fish snacks restore two energy, all capped
appropriately. Petal piles stay in place until at least one spirit has been
calmed. A collected item tile becomes grass. A non-item tile returns a new
equivalent state.

## Creatures and garden turn

### `helpSpirit(state, spiritId)`

**Signature:** `helpSpirit(state: GameState, spiritId: string): GameState`

**Parameters:** Current `state` and a sakura spirit identifier.

**Returns:** A new `GameState`.

Marks the spirit helped, stops it following, increments `helpedSpirits`, logs
the result, and checks completion. A spirit already helped is not counted
again. An unknown or non-spirit id gives feedback.

### `updateFollowingSpirits(state)`

**Signature:** `updateFollowingSpirits(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Moves every following spirit at most one open orthogonal step closer to Mochi
using deterministic row/column tie-breaking. A follower adjacent to a restored
tree becomes helped before or after moving. An adjacent follower is also
delivered when Mochi stands beside a restored tree. If no closer open step
exists, it stays in place.

### `moveCrow(state)`

**Signature:** `moveCrow(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

After a spirit has unlocked petals, moves the crow one open orthogonal tile
toward the nearest visible petal pile. Before that quest step, the crow waits.
Target and movement ties use distance, row, then column. Reaching a pile changes
it to grass and makes the crow satisfied, so it stops collecting further piles.
With no crow, no visible pile, a satisfied crow, or no valid closer step, the
crow stays put in a new equivalent state.

### `endPlayerTurn(state)`

**Signature:** `endPlayerTurn(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Changes to the garden phase, resolves it through `runGardenTurn`, then returns
the next player phase. It may be used before all AP is spent. A completed game
or a non-player phase returns feedback without advancing.

### `runGardenTurn(state)`

**Signature:** `runGardenTurn(state: GameState): GameState`

**Parameters:** Current `state`, whose `turn` must be `"garden"`.

**Returns:** A new `GameState`.

Updates followers, moves the crow, increments the round, returns control to the
player, selects Walk, resets AP, and checks completion. Calling it during the
player phase or after completion returns feedback without resolving the phase.

## Completion

### `checkCompletion(state)`

**Signature:** `checkCompletion(state: GameState): GameState`

**Parameters:** Current `state`.

**Returns:** A new `GameState`.

Completes the game only when all three trees are restored, both spirits are
helped, and Mochi stands on the shrine. It stores the star rating and completion
message. Incomplete and already completed games return a new equivalent state.

### `calculateStarRating(state)`

**Signature:** `calculateStarRating(state: GameState): 1 | 2 | 3`

**Parameters:** Current `state`; only `round` is used.

**Returns:** `3` through turn 16, `2` through turn 24, otherwise `1`.

This query can be called before or after completion and never changes state.
