/**
 * Mochi and the Shrine of Shadows — game rules.
 *
 * A small cat from the Cat Kingdom must rescue the captured king. The game runs
 * through four phases: an intro, the Sakura Forest, the Sealed Land, and an
 * ending. Every action returns a new state rather than mutating the input, and
 * the module has no browser dependency.
 *
 * @module game
 */

/** @typedef {"intro"|"forest"|"sealedLand"|"ending"} Phase */
/** @typedef {"playing"|"won"|"lost"} Status */
/** @typedef {"up"|"down"|"left"|"right"} Direction */
/** @typedef {"grass"|"flowerGrass"|"stone"|"rock"|"pond"|"bush"|"fence"|"gate"|"ground"|"void"} TerrainType */

/**
 * @typedef {Object} Position
 * @property {number} row
 * @property {number} col
 */

/**
 * @typedef {Object} Player
 * @property {number} row
 * @property {number} col
 * @property {number} stamina
 * @property {number} maxStamina
 * @property {number} stunnedTurns
 */

/**
 * @typedef {Object} Tree
 * @property {string} id
 * @property {number} row
 * @property {number} col
 * @property {boolean} awakened
 * @property {boolean} spiritFreed
 */

/**
 * @typedef {Object} Obelisk
 * @property {string} id
 * @property {number} row
 * @property {number} col
 * @property {boolean} destroyed
 */

/**
 * @typedef {Object} FishCookie
 * @property {string} id
 * @property {number} row
 * @property {number} col
 * @property {boolean} collected
 */

/**
 * @typedef {Object} Tombstone
 * @property {string} id
 * @property {number} row
 * @property {number} col
 */

/**
 * @typedef {Object} Boss
 * @property {number} row
 * @property {number} col
 * @property {boolean} alive
 * @property {number} silencedTurns
 * @property {Position|null} targetedTile
 */

/**
 * @typedef {Object} GameState
 * @property {Phase} phase
 * @property {Status} status
 * @property {Phase} currentMap
 * @property {number} turn
 * @property {string} message
 * @property {string[]} log
 * @property {TerrainType[][]} [board]
 * @property {Player} [player]
 * @property {Tree[]} [trees]
 * @property {FishCookie[]} [fishCookies]
 * @property {{row:number,col:number,open:boolean}} [shrineGate]
 * @property {number} [rescuedSpirits]
 * @property {number} [totalSpirits]
 * @property {Boss} [boss]
 * @property {Obelisk[]} [obelisks]
 * @property {Tombstone[]} [tombstones]
 * @property {Position[]} [destroyedTiles]
 * @property {number} [destroyedObelisks]
 */

const FOREST_SIZE = 7;
const SEALED_SIZE = 9;
const MOVE_RANGE = 2;
const TOTAL_SPIRITS = 3;
const TOTAL_OBELISKS = 4;
const SILENCE_TURNS = 5;
const MAX_STAMINA = 5;

const DIRECTIONS = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

const FOREST_BLOCKED = new Set(["rock", "pond", "bush", "fence"]);

// Fixed, hand-validated forest layout. Trees and the gate are stored as
// entities; their tiles stay grass underneath so the board holds terrain only.
const FOREST_TERRAIN = [
  ["grass", "stone", "flowerGrass", "grass", "stone", "grass", "flowerGrass"],
  ["grass", "grass", "stone", "pond", "stone", "grass", "grass"],
  ["flowerGrass", "grass", "stone", "stone", "stone", "grass", "grass"],
  ["grass", "rock", "stone", "gate", "stone", "rock", "grass"],
  ["grass", "stone", "stone", "stone", "stone", "flowerGrass", "grass"],
  ["grass", "bush", "grass", "grass", "stone", "bush", "fence"],
  ["grass", "stone", "flowerGrass", "grass", "stone", "grass", "grass"],
];

const FOREST_TREES = [
  { id: "tree-1", row: 1, col: 1, awakened: false, spiritFreed: false },
  { id: "tree-2", row: 1, col: 5, awakened: false, spiritFreed: false },
  { id: "tree-3", row: 5, col: 3, awakened: false, spiritFreed: false },
];

const FOREST_GATE = { row: 3, col: 3, open: false };
const FOREST_START = { row: 6, col: 0, stamina: MAX_STAMINA, maxStamina: MAX_STAMINA, stunnedTurns: 0 };

// Fish cookies sit on the intended route. Mochi needs these refills to wake all
// trees and reach the gate without making stamina frustrating.
const FOREST_FISH_COOKIES = [
  { id: "fish-forest-1", row: 6, col: 2, collected: false },
  { id: "fish-forest-2", row: 0, col: 1, collected: false },
  { id: "fish-forest-3", row: 0, col: 5, collected: false },
  { id: "fish-forest-4", row: 2, col: 6, collected: false },
];

const SEALED_BOSS = { row: 0, col: 4 };
const SEALED_START = { row: 8, col: 4, stamina: MAX_STAMINA, maxStamina: MAX_STAMINA, stunnedTurns: 0 };
const SEALED_OBELISKS = [
  { id: "obelisk-1", row: 0, col: 0, destroyed: false },
  { id: "obelisk-2", row: 0, col: 8, destroyed: false },
  { id: "obelisk-3", row: 8, col: 0, destroyed: false },
  { id: "obelisk-4", row: 8, col: 8, destroyed: false },
];
const SEALED_FISH_COOKIES = [
  { id: "fish-sealed-1", row: 8, col: 2, collected: false },
  { id: "fish-sealed-2", row: 7, col: 6, collected: false },
  { id: "fish-sealed-3", row: 8, col: 7, collected: false },
  { id: "fish-sealed-4", row: 5, col: 7, collected: false },
  { id: "fish-sealed-5", row: 2, col: 7, collected: false },
  { id: "fish-sealed-6", row: 1, col: 5, collected: false },
  { id: "fish-sealed-7", row: 1, col: 3, collected: false },
  { id: "fish-sealed-8", row: 5, col: 1, collected: false },
];
const SEALED_TOMBSTONES = [
  { id: "tomb-1", row: 2, col: 2 },
  { id: "tomb-2", row: 2, col: 4 },
  { id: "tomb-3", row: 2, col: 6 },
  { id: "tomb-4", row: 3, col: 3 },
  { id: "tomb-5", row: 3, col: 5 },
  { id: "tomb-6", row: 4, col: 2 },
  { id: "tomb-7", row: 4, col: 6 },
  { id: "tomb-8", row: 5, col: 3 },
  { id: "tomb-9", row: 5, col: 5 },
  { id: "tomb-10", row: 6, col: 4 },
];

const cloneBoard = (board) => board.map((row) => [...row]);
const cloneTrees = (trees) => trees.map((tree) => ({ ...tree }));
const cloneObelisks = (obelisks) => obelisks.map((obelisk) => ({ ...obelisk }));
const cloneFishCookies = (fishCookies) => fishCookies.map((fish) => ({ ...fish }));
const cloneTombstones = (tombstones) => tombstones.map((tombstone) => ({ ...tombstone }));
const samePosition = (a, b) => a.row === b.row && a.col === b.col;

const addMessage = (state, message) => ({
  ...state,
  message,
  log: [...state.log, message],
});

/**
 * Reports whether board coordinates are inside a square board.
 * @param {number} row Board row.
 * @param {number} col Board column.
 * @param {number} [size=7] Board width and height.
 * @returns {boolean} True when the coordinates fit inside the board size.
 */
export function isInsideBoard(row, col, size = FOREST_SIZE) {
  return Number.isInteger(row)
    && Number.isInteger(col)
    && row >= 0
    && row < size
    && col >= 0
    && col < size;
}

const boardSize = (state) => state.board?.length ?? FOREST_SIZE;

/**
 * Reads the terrain tile of the active map without changing state.
 * @param {GameState} state Current game state.
 * @param {number} row Board row.
 * @param {number} col Board column.
 * @returns {TerrainType|null} The tile, or null when out of bounds or map-less.
 */
export function getTileAt(state, row, col) {
  if (!state.board || !isInsideBoard(row, col, boardSize(state))) {
    return null;
  }
  return state.board[row][col];
}

const adjacentPositions = (row, col, size = FOREST_SIZE) => Object.values(DIRECTIONS)
  .map(([rowChange, colChange]) => ({ row: row + rowChange, col: col + colChange }))
  .filter(({ row: nextRow, col: nextCol }) => isInsideBoard(nextRow, nextCol, size));

const treeAt = (state, row, col) => (state.trees ?? []).find((tree) => (
  tree.row === row && tree.col === col
));

const liveObeliskAt = (state, row, col) => (state.obelisks ?? []).find((obelisk) => (
  obelisk.row === row && obelisk.col === col && !obelisk.destroyed
));

const fishCookieAt = (state, row, col) => (state.fishCookies ?? []).find((fish) => (
  fish.row === row && fish.col === col && !fish.collected
));

const tombstoneAt = (state, row, col) => (state.tombstones ?? []).find((tombstone) => (
  tombstone.row === row && tombstone.col === col
));

const isVoidTile = (state, row, col) => (state.destroyedTiles ?? []).some((tile) => (
  tile.row === row && tile.col === col
));

const canTakeAction = (state) => {
  if (!state.player) {
    return { ok: false, message: "Mochi is not on the board." };
  }
  if (state.player.stunnedTurns > 0) {
    return { ok: false, message: "Mochi is dizzy from the tombstone. End the turn to recover." };
  }
  if (state.player.stamina <= 0) {
    return { ok: false, message: "Mochi is too tired. Find a fish cookie refill." };
  }
  return { ok: true, message: "" };
};

const spendStamina = (state) => ({
  ...state,
  player: { ...state.player, stamina: Math.max(0, state.player.stamina - 1) },
});

const collectFishCookie = (state) => {
  const fish = fishCookieAt(state, state.player.row, state.player.col);
  if (!fish) {
    return state;
  }
  return addMessage({
    ...state,
    fishCookies: state.fishCookies.map((candidate) => (
      candidate.id === fish.id ? { ...candidate, collected: true } : { ...candidate }
    )),
    player: { ...state.player, stamina: state.player.maxStamina },
  }, "Mochi munches a fish cookie. Stamina is full!");
};

const applyTombstoneEffect = (state) => {
  if (state.phase !== "sealedLand" || !tombstoneAt(state, state.player.row, state.player.col)) {
    return state;
  }
  return addMessage({
    ...state,
    player: { ...state.player, stunnedTurns: 1 },
  }, "A tombstone curse rattles Mochi. Next turn must be spent recovering.");
};

/**
 * Checks whether Mochi may stand on a tile of the current map.
 * @param {GameState} state Current game state.
 * @param {number} row Destination row.
 * @param {number} col Destination column.
 * @returns {boolean} True when the tile is inside, walkable, and unoccupied.
 */
export function canMoveTo(state, row, col) {
  if (!isInsideBoard(row, col, boardSize(state))) {
    return false;
  }
  if (state.phase === "forest") {
    const tile = getTileAt(state, row, col);
    if (FOREST_BLOCKED.has(tile) || treeAt(state, row, col)) {
      return false;
    }
    if (tile === "gate") {
      return state.shrineGate.open;
    }
    return true;
  }
  if (state.phase === "sealedLand") {
    return !isVoidTile(state, row, col)
      && !samePosition(state.boss, { row, col })
      && !liveObeliskAt(state, row, col);
  }
  return false;
}

/**
 * Creates the opening game state, sitting on the intro story screen.
 * @returns {GameState} A fresh intro-phase state.
 */
export function createInitialState() {
  const message = "The king of the Cat Kingdom has been captured. Mochi's quest begins.";
  return {
    phase: "intro",
    status: "playing",
    currentMap: "intro",
    turn: 0,
    message,
    log: [message],
  };
}

/**
 * Starts over from the intro screen with a fully independent state.
 * @returns {GameState} A fresh intro-phase state.
 */
export function resetGame() {
  return createInitialState();
}

/**
 * Leaves the intro and enters the Sakura Forest with a fresh forest map.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new forest-phase state, or feedback when not in intro.
 */
export function startGame(state) {
  if (state.phase !== "intro") {
    return addMessage(state, "The journey has already begun.");
  }
  const message = "Mochi enters the Sakura Forest. Meow beside each tree to wake its spirit.";
  return {
    phase: "forest",
    status: "playing",
    currentMap: "forest",
    turn: 1,
    board: cloneBoard(FOREST_TERRAIN),
    player: { ...FOREST_START },
    trees: cloneTrees(FOREST_TREES),
    fishCookies: cloneFishCookies(FOREST_FISH_COOKIES),
    shrineGate: { ...FOREST_GATE },
    rescuedSpirits: 0,
    totalSpirits: TOTAL_SPIRITS,
    message,
    log: [...state.log, message],
  };
}

/**
 * Lists interactable objects orthogonally adjacent to Mochi on the active map:
 * dormant trees in the forest, or standing obelisks in the Sealed Land.
 * @param {GameState} state Current game state.
 * @returns {Array<{kind:string,id:string,row:number,col:number}>} Adjacent objects.
 */
export function getAdjacentObjects(state) {
  if (!state.player) {
    return [];
  }
  return adjacentPositions(state.player.row, state.player.col, boardSize(state)).flatMap(({ row, col }) => {
    if (state.phase === "forest") {
      const tree = treeAt(state, row, col);
      return tree && !tree.awakened
        ? [{ kind: "tree", id: tree.id, row, col }]
        : [];
    }
    if (state.phase === "sealedLand") {
      const obelisk = liveObeliskAt(state, row, col);
      return obelisk
        ? [{ kind: "obelisk", id: obelisk.id, row, col }]
        : [];
    }
    return [];
  });
}

// Resolves one Move action of up to two orthogonal steps. Each step must stay on
// the board and land on a walkable tile. Stepping onto an open gate ends the
// move there and transitions to the Sealed Land.
const walkPath = (state, directions) => {
  const steps = Array.isArray(directions) ? directions : [directions];
  if (steps.length === 0 || steps.length > MOVE_RANGE) {
    return { ok: false, message: "Mochi can move one or two tiles in a turn." };
  }
  if (!steps.every((step) => Object.hasOwn(DIRECTIONS, step))) {
    return { ok: false, message: "That is not a direction Mochi can walk." };
  }

  let { row, col } = state.player;
  for (const step of steps) {
    const [rowChange, colChange] = DIRECTIONS[step];
    const nextRow = row + rowChange;
    const nextCol = col + colChange;
    if (!isInsideBoard(nextRow, nextCol, boardSize(state))) {
      return { ok: false, message: "The path ends there. Mochi stays on the trail." };
    }
    if (
      state.phase === "forest"
      && getTileAt(state, nextRow, nextCol) === "gate"
      && state.shrineGate.open
    ) {
      return { ok: true, position: { row: nextRow, col: nextCol }, enteredGate: true };
    }
    if (!canMoveTo(state, nextRow, nextCol)) {
      return { ok: false, message: "Something blocks the way." };
    }
    row = nextRow;
    col = nextCol;
  }
  return { ok: true, position: { row, col }, enteredGate: false };
};

/**
 * Performs a Move action: Mochi walks one or two orthogonal tiles. In the
 * Sealed Land the boss turn resolves afterward. Invalid moves return feedback
 * without changing position or advancing the turn.
 * @param {GameState} state Current game state.
 * @param {Direction|Direction[]} pathOrDirections One or two step directions.
 * @returns {GameState} A new state.
 */
export function movePlayer(state, pathOrDirections) {
  if (state.status !== "playing" || (state.phase !== "forest" && state.phase !== "sealedLand")) {
    return addMessage(state, "Mochi cannot move right now.");
  }
  const action = canTakeAction(state);
  if (!action.ok) {
    return addMessage(state, action.message);
  }

  const result = walkPath(state, pathOrDirections);
  if (!result.ok) {
    return addMessage(state, result.message);
  }

  let movedState = spendStamina({
    ...state,
    player: { ...state.player, ...result.position },
    message: state.message,
    log: state.log,
  });
  movedState = collectFishCookie(movedState);

  if (state.phase === "forest") {
    if (result.enteredGate) {
      return enterShrineGate({ ...movedState, player: { ...movedState.player, ...result.position } });
    }
    return {
      ...addMessage(movedState, `Mochi moves to row ${result.position.row + 1}, column ${result.position.col + 1}.`),
      turn: state.turn + 1,
    };
  }

  const stepped = addMessage(
    applyTombstoneEffect(movedState),
    `Mochi darts to row ${result.position.row + 1}, column ${result.position.col + 1}.`,
  );
  return resolveBossTurn(stepped);
}

/**
 * Awakens a dormant forest tree by id.
 * @param {GameState} state Current game state.
 * @param {string} treeId Tree identifier.
 * @returns {GameState} A new state, or feedback for an invalid or awake tree.
 */
export function awakenTree(state, treeId) {
  const tree = (state.trees ?? []).find((candidate) => candidate.id === treeId);
  if (!tree) {
    return addMessage(state, "There is no such tree here.");
  }
  if (tree.awakened) {
    return { ...state, trees: cloneTrees(state.trees) };
  }
  return {
    ...state,
    trees: state.trees.map((candidate) => (
      candidate.id === treeId ? { ...candidate, awakened: true } : { ...candidate }
    )),
  };
}

/**
 * Frees the spirit sealed inside an awakened tree, counting it once.
 * @param {GameState} state Current game state.
 * @param {string} treeId Tree identifier.
 * @returns {GameState} A new state, or feedback for an invalid tree.
 */
export function freeSpirit(state, treeId) {
  const tree = (state.trees ?? []).find((candidate) => candidate.id === treeId);
  if (!tree || tree.spiritFreed) {
    return { ...state, trees: cloneTrees(state.trees ?? []) };
  }
  return {
    ...state,
    trees: state.trees.map((candidate) => (
      candidate.id === treeId ? { ...candidate, spiritFreed: true } : { ...candidate }
    )),
    rescuedSpirits: state.rescuedSpirits + 1,
  };
}

/**
 * Opens the central shrine gate.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state with the gate open.
 */
export function openShrineGate(state) {
  return { ...state, shrineGate: { ...state.shrineGate, open: true } };
}

/**
 * Opens the shrine gate once every spirit has been freed.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state; the gate opens when all spirits are freed.
 */
export function checkForestCompletion(state) {
  if (state.rescuedSpirits >= state.totalSpirits && !state.shrineGate.open) {
    return addMessage(
      openShrineGate(state),
      "All spirits are free! The shrine gate glows open in the heart of the forest.",
    );
  }
  return { ...state, shrineGate: { ...state.shrineGate } };
}

/**
 * Performs a Meow action. In the forest it wakes an adjacent dormant tree and
 * frees its spirit; in the Sealed Land it destroys an adjacent obelisk. With no
 * valid target the turn is not spent.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function useMeow(state) {
  if (state.status !== "playing") {
    return addMessage(state, "The quest is already over.");
  }
  const action = canTakeAction(state);
  if (!action.ok && (state.phase === "forest" || state.phase === "sealedLand")) {
    return addMessage(state, action.message);
  }

  if (state.phase === "forest") {
    const target = getAdjacentObjects(state)[0];
    if (!target) {
      return addMessage(state, "Mochi meows, but no sleeping tree is near.");
    }
    const actionState = spendStamina(state);
    const awakened = awakenTree(actionState, target.id);
    const freed = freeSpirit(awakened, target.id);
    const announced = addMessage(
      freed,
      `Mochi meows! The tree awakens and a spirit drifts free (${freed.rescuedSpirits}/${freed.totalSpirits}).`,
    );
    return { ...checkForestCompletion(announced), turn: state.turn + 1 };
  }

  if (state.phase === "sealedLand") {
    const target = getAdjacentObjects(state)[0];
    if (!target) {
      return addMessage(state, "Mochi meows into the dark, but no obelisk is near.");
    }
    const broken = destroyObelisk(spendStamina(state), target.id);
    const defeated = checkBossDefeat(broken);
    if (defeated.status === "won") {
      return transitionToEnding(defeated);
    }
    return resolveBossTurn(defeated);
  }

  return addMessage(state, "Mochi meows softly.");
}

/**
 * Moves Mochi through the open shrine gate into the Sealed Land.
 * @param {GameState} state Current game state standing on the open gate.
 * @returns {GameState} A new Sealed-Land state, or feedback if the gate is shut.
 */
export function enterShrineGate(state) {
  if (!state.shrineGate || !state.shrineGate.open) {
    return addMessage(state, "The shrine gate is still sealed.");
  }
  return createSealedLandState(state);
}

/**
 * Builds the Sealed Land arena: an open board with four corner obelisks, the
 * Dark Shrine at the top, and Mochi at the bottom. The boss begins dormant.
 * @param {GameState} [state] Optional state to carry the log forward.
 * @returns {GameState} A new Sealed-Land state.
 */
export function createSealedLandState(state) {
  const previousLog = state?.log ?? [];
  const message = "Mochi falls into the Sealed Land. Shatter the four obelisks to free the king!";
  return {
    phase: "sealedLand",
    status: "playing",
    currentMap: "sealedLand",
    turn: 1,
    board: Array.from({ length: SEALED_SIZE }, () => (
      Array.from({ length: SEALED_SIZE }, () => "ground")
    )),
    player: { ...SEALED_START },
    boss: {
      ...SEALED_BOSS,
      alive: true,
      silencedTurns: SILENCE_TURNS,
      targetedTile: null,
    },
    obelisks: cloneObelisks(SEALED_OBELISKS),
    fishCookies: cloneFishCookies(SEALED_FISH_COOKIES),
    tombstones: cloneTombstones(SEALED_TOMBSTONES),
    destroyedTiles: [],
    destroyedObelisks: 0,
    message,
    log: [...previousLog, message],
  };
}

/**
 * Sets the boss's targeted tile to Mochi's current tile, when the boss is alive
 * and not silenced. Otherwise the target is cleared.
 * @param {GameState} state Current Sealed-Land state.
 * @returns {GameState} A new state with the boss target updated.
 */
export function selectBossTarget(state) {
  const active = state.boss.alive && state.boss.silencedTurns === 0;
  return {
    ...state,
    boss: {
      ...state.boss,
      targetedTile: active ? { ...state.player } : null,
    },
  };
}

/**
 * Resolves the Dark Shrine's turn: a player still on the targeted tile dies; an
 * escaped target crumbles into void. Silence then ticks down and, if the boss is
 * awake, it marks Mochi's tile for next turn. Finally the turn counter advances.
 * @param {GameState} state Current Sealed-Land state.
 * @returns {GameState} A new state.
 */
export function resolveBossTurn(state) {
  if (state.phase !== "sealedLand" || state.status !== "playing") {
    return state;
  }

  const target = state.boss.targetedTile;
  if (target && samePosition(target, state.player)) {
    return {
      ...addMessage(state, "The Dark Shrine's gaze falls — Mochi is caught on the cursed tile!"),
      status: "lost",
      boss: { ...state.boss, targetedTile: null },
    };
  }

  let next = { ...state, boss: { ...state.boss } };
  if (target) {
    next = addMessage({
      ...next,
      destroyedTiles: [...state.destroyedTiles, target],
      boss: { ...next.boss, targetedTile: null },
    }, "A cursed tile crumbles into the void.");
  }

  const silencedTurns = Math.max(0, next.boss.silencedTurns - 1);
  next = { ...next, boss: { ...next.boss, silencedTurns } };
  next = selectBossTarget(next);
  return { ...next, turn: next.turn + 1 };
}

/**
 * Destroys an obelisk by id and silences the Dark Shrine for five turns.
 * @param {GameState} state Current Sealed-Land state.
 * @param {string} obeliskId Obelisk identifier.
 * @returns {GameState} A new state, or feedback for an invalid or broken obelisk.
 */
export function destroyObelisk(state, obeliskId) {
  const obelisk = (state.obelisks ?? []).find((candidate) => candidate.id === obeliskId);
  if (!obelisk) {
    return addMessage(state, "There is no obelisk to break here.");
  }
  if (obelisk.destroyed) {
    return { ...state, obelisks: cloneObelisks(state.obelisks) };
  }
  const destroyedObelisks = state.destroyedObelisks + 1;
  const shattered = {
    ...state,
    obelisks: state.obelisks.map((candidate) => (
      candidate.id === obeliskId ? { ...candidate, destroyed: true } : { ...candidate }
    )),
    destroyedObelisks,
    boss: { ...state.boss, silencedTurns: SILENCE_TURNS, targetedTile: null },
  };
  return addMessage(
    shattered,
    `An obelisk shatters (${destroyedObelisks}/${TOTAL_OBELISKS})! The Dark Shrine is silenced for ${SILENCE_TURNS} turns.`,
  );
}

/**
 * Defeats the Dark Shrine once all four obelisks are destroyed.
 * @param {GameState} state Current Sealed-Land state.
 * @returns {GameState} A new state; the boss dies and the game is won when ready.
 */
export function checkBossDefeat(state) {
  if (state.destroyedObelisks >= TOTAL_OBELISKS && state.boss.alive) {
    return addMessage({
      ...state,
      status: "won",
      boss: { ...state.boss, alive: false, targetedTile: null },
    }, "The final obelisk falls and the Dark Shrine crumbles to dust!");
  }
  return { ...state, boss: { ...state.boss } };
}

/**
 * Moves a won game to the ending story screen.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new ending-phase state, or feedback if not yet won.
 */
export function transitionToEnding(state) {
  if (state.status !== "won") {
    return addMessage(state, "The king is not free yet.");
  }
  return {
    ...state,
    phase: "ending",
    currentMap: "ending",
    message: "The king of the Cat Kingdom is rescued! Mochi is a hero.",
    log: [...state.log, "The king of the Cat Kingdom is rescued! Mochi is a hero."],
  };
}

/**
 * Skips Mochi's action and lets the current map's turn resolve (a Sealed-Land
 * wait runs the boss turn; the forest simply advances the turn counter).
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function endTurn(state) {
  if (state.status !== "playing") {
    return state;
  }
  const recovering = state.player?.stunnedTurns > 0;
  const recoveredState = recovering
    ? addMessage({
      ...state,
      player: { ...state.player, stunnedTurns: 0 },
    }, "Mochi shakes off the tombstone curse and can act again.")
    : state;

  if (state.phase === "sealedLand") {
    return resolveBossTurn(addMessage(
      recoveredState,
      recovering ? "The Dark Shrine keeps watching while Mochi recovers." : "Mochi waits, watching the shadows.",
    ));
  }
  if (state.phase === "forest") {
    return { ...addMessage(recoveredState, "Mochi pauses beneath the sakura."), turn: state.turn + 1 };
  }
  return state;
}
