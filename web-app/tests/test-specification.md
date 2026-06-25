# Unit Test Specification — Mochi and the Shrine of Shadows

The tests describe observable game behaviour with Given / When / Then. They do
not depend on private helpers or reproduce the implementation.

## Lifecycle

### 1. Intro start

**Given** a new game
**When** the initial state is created
**Then** the phase is `intro`, the status is `playing`, and the turn is 0.

### 2. Starting the forest

**Given** the intro state
**When** the game is started
**Then** the phase becomes `forest`, Mochi stands at G1, three dormant trees
exist, fish-cookie refills exist, the shrine gate is sealed, and no spirits are
freed.

## Map 1 — Sakura Forest

### 3. Move up to two tiles

**Given** an open path ahead
**When** Mochi moves two steps in one turn
**Then** Mochi ends two tiles away and the turn advances by one, without
mutating the input state, and one stamina is spent.

### 4. Blocked movement

**Given** an obstacle (a bush) beside Mochi
**When** Mochi tries to move into it, or pass through it on a two-step move
**Then** Mochi stays in place and the turn does not advance.

### 5. Fish cookie refill

**Given** Mochi has low stamina and stands beside a fish cookie
**When** Mochi moves onto the fish cookie
**Then** stamina is restored to full and that fish cookie is marked collected.

### 6. Exhausted actions are blocked

**Given** Mochi has no stamina
**When** Mochi tries to Move or Meow
**Then** the action is blocked, the turn does not advance, and no progress is
made.

### 7. Awakening a tree and freeing a spirit

**Given** Mochi stands adjacent to a dormant tree
**When** Mochi meows
**Then** the tree becomes awakened, its spirit is freed, the rescued-spirit
count rises by one, and the turn advances.

### 8. Spirits are counted once

**Given** an awakened tree whose spirit is already free
**When** the spirit is freed again
**Then** the rescued-spirit count does not rise a second time.

### 9. Gate stays closed until all spirits are freed

**Given** fewer than three spirits freed
**When** forest completion is checked
**Then** the shrine gate remains sealed.

### 10. Gate opens on the third spirit

**Given** two spirits already freed and Mochi beside the last dormant tree
**When** Mochi meows
**Then** the third spirit is freed and the central shrine gate opens.

### 11. Entering the open gate transitions to the Sealed Land

**Given** the shrine gate is open and Mochi is beside it
**When** Mochi moves onto the gate
**Then** the phase becomes `sealedLand` with four obelisks and Mochi at the
bottom.

### 12. A closed gate cannot be entered

**Given** the shrine gate is still sealed
**When** Mochi tries to step onto it
**Then** Mochi stays in the forest.

## Map 2 — Sealed Land

### 13. Open arena movement

**Given** the Sealed Land
**When** Mochi moves across open ground
**Then** Mochi reaches the destination and the turn advances.

### 14. Expanded Sealed-Land layout

**Given** the Sealed Land has just been created
**When** the map data is inspected
**Then** it contains eight fish-cookie refills, ten tombstone hazards, and route
refills near both lower-left and upper-right obelisk paths.

### 15. Destroying an obelisk

**Given** Mochi stands adjacent to a standing obelisk
**When** Mochi meows
**Then** the obelisk becomes destroyed and the destroyed count rises.

### 16. Silencing the boss

**Given** an obelisk is destroyed
**When** the destruction resolves
**Then** the Dark Shrine is silenced for five turns.

### 17. Boss targeting

**Given** the boss is awake (not silenced)
**When** the boss selects a target
**Then** the tile Mochi stands on becomes the targeted tile; a silenced boss
marks no tile.

### 18. Death on the targeted tile

**Given** Mochi remains on the targeted tile
**When** the turn ends
**Then** the status becomes `lost`.

### 19. Escaping turns the tile to void

**Given** Mochi has left the targeted tile
**When** the boss turn resolves
**Then** the status stays `playing`, that tile becomes void, and the boss marks
Mochi's new tile.

### 20. Void tiles are impassable

**Given** a tile has been turned to void
**When** Mochi tries to step onto it
**Then** movement is blocked and Mochi stays in place.

### 21. Tombstone recovery

**Given** a tombstone in the Sealed Land
**When** Mochi steps onto it
**Then** Mochi becomes stunned for one recovery turn, cannot act while stunned,
and recovers after ending the turn.

### 22. Boss defeat and the ending

**Given** three obelisks are already destroyed and Mochi is beside the fourth
**When** Mochi meows
**Then** the fourth obelisk shatters, the boss dies, the status becomes `won`,
and the phase becomes `ending`.

### 23. Completion helpers

**Given** all four obelisks destroyed
**When** boss defeat is checked
**Then** the status is `won`, the boss is no longer alive, and transitioning to
the ending sets the phase to `ending`.

## Intentional fault checks

For each main behaviour group, one rule was temporarily changed to an incorrect
version (for example: a move spending no turn, a fish cookie not restoring
stamina, exhausted actions still being allowed, a freed spirit counted twice, a
tombstone not applying recovery, an obelisk not silencing the boss, the death
check disabled). The related test failed, showing it could detect the fault, and
the correct rule was restored.
