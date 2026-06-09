/**
 * Mochi's Sakura Garden game rules.
 *
 * This module has no browser dependencies. Every game action is deterministic
 * and returns a new state rather than mutating the supplied state.
 *
 * @module game
 */

/** @typedef {"grass"|"stonePath"|"pond"|"rock"|"bridge"|"petalPile"|"tea"|"fishSnack"|"damagedTree"|"restoredTree"|"lanternOff"|"lanternOn"|"shrine"|"hiddenPetals"} TerrainType */
/** @typedef {"playing"|"completed"} GameStatus */
/** @typedef {"player"|"garden"} Turn */
/** @typedef {"up"|"down"|"left"|"right"} Direction */
/** @typedef {"sakuraSpirit"|"sleepyTanuki"|"petalCrow"} CreatureType */
/** @typedef {"walk"|"meow"|"restore"|"rest"} SelectedAction */

/**
 * @typedef {Object} Player
 * @property {number} row
 * @property {number} col
 * @property {number} energy
 * @property {number} maxEnergy
 * @property {number} petals
 * @property {number} actionPoints
 * @property {number} maxActionPoints
 */

/**
 * @typedef {Object} Creature
 * @property {string} id
 * @property {CreatureType} type
 * @property {number} row
 * @property {number} col
 * @property {string} status
 * @property {boolean} following
 */

/**
 * @typedef {Object} GameState
 * @property {TerrainType[][]} board
 * @property {Player} player
 * @property {Creature[]} creatures
 * @property {Turn} turn
 * @property {number} round
 * @property {GameStatus} status
 * @property {SelectedAction} selectedAction
 * @property {number} restoredTrees
 * @property {number} helpedSpirits
 * @property {number} totalTrees
 * @property {number} totalSpirits
 * @property {number} starRating
 * @property {string} message
 * @property {string[]} gameLog
 */

const BOARD_SIZE = 7;
const PETALS_PER_PILE = 3;

const DIRECTIONS = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

const BLOCKED_TERRAIN = new Set(["pond", "rock", "damagedTree", "restoredTree"]);

const INITIAL_BOARD = [
  ["damagedTree", "grass", "rock", "lanternOff", "petalPile", "grass", "restoredTree"],
  ["stonePath", "pond", "grass", "stonePath", "grass", "stonePath", "hiddenPetals"],
  ["petalPile", "bridge", "stonePath", "damagedTree", "stonePath", "pond", "grass"],
  ["grass", "grass", "tea", "grass", "grass", "petalPile", "stonePath"],
  ["grass", "stonePath", "grass", "shrine", "grass", "stonePath", "grass"],
  ["grass", "fishSnack", "stonePath", "grass", "petalPile", "lanternOff", "grass"],
  ["grass", "stonePath", "petalPile", "stonePath", "grass", "grass", "damagedTree"],
];

const INITIAL_CREATURES = [
  {
    id: "spirit-one",
    type: "sakuraSpirit",
    row: 1,
    col: 2,
    status: "shy",
    following: false,
  },
  {
    id: "spirit-two",
    type: "sakuraSpirit",
    row: 4,
    col: 6,
    status: "shy",
    following: false,
  },
  {
    id: "tanuki",
    type: "sleepyTanuki",
    row: 0,
    col: 5,
    status: "asleep",
    following: false,
  },
  {
    id: "crow",
    type: "petalCrow",
    row: 2,
    col: 6,
    status: "playful",
    following: false,
  },
];

const cloneBoard = (board) => board.map((row) => [...row]);
const cloneCreatures = (creatures) => creatures.map((creature) => ({ ...creature }));
const positionKey = (row, col) => `${row},${col}`;
const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

const replaceTile = (board, row, col, tile) => board.map(
  (boardRow, rowIndex) => boardRow.map(
    (currentTile, colIndex) => (
      rowIndex === row && colIndex === col ? tile : currentTile
    ),
  ),
);

const addMessage = (state, message, addToLog = true) => ({
  ...state,
  message,
  gameLog: addToLog ? [...state.gameLog, message] : [...state.gameLog],
});

const isActionAvailable = (state) => (
  state.status === "playing"
  && state.turn === "player"
  && state.player.actionPoints > 0
);

const areGardenWishesComplete = (state) => (
  state.restoredTrees >= state.totalTrees
  && state.helpedSpirits >= state.totalSpirits
);

const hasCalmedSpirit = (state) => state.creatures.some((creature) => (
  creature.type === "sakuraSpirit" && creature.status !== "shy"
));

const hasGuidingLantern = (state, spirit) => state.board.some((row, rowIndex) => (
  row.some((tile, colIndex) => (
    tile === "lanternOn"
    && distance(spirit, { row: rowIndex, col: colIndex }) <= 2
  ))
));

const spendActionPoint = (state) => ({
  ...state,
  player: {
    ...state.player,
    actionPoints: state.player.actionPoints - 1,
  },
});

const creatureBlocksMovement = (creature) => {
  if (creature.type === "sakuraSpirit") {
    return creature.status !== "helped";
  }
  if (creature.type === "sleepyTanuki") {
    return creature.status === "asleep";
  }
  return true;
};

const adjacentPositionsFor = (row, col) => Object.values(DIRECTIONS)
  .map(([rowChange, colChange]) => ({
    row: row + rowChange,
    col: col + colChange,
  }))
  .filter(({ row: nextRow, col: nextCol }) => isInsideBoard(nextRow, nextCol));

const isAdjacentToRestoredTree = (state, creature) => adjacentPositionsFor(
  creature.row,
  creature.col,
).some(({ row, col }) => getTileAt(state, row, col) === "restoredTree");

const canDeliverSpiritWithMochi = (state, creature) => (
  distance(creature, state.player) === 1
  && isAdjacentToRestoredTree(state, state.player)
);

const getActionBlockMessage = (state) => {
  if (state.status === "completed") {
    return "The garden is complete. Mochi is enjoying the blossoms!";
  }
  if (state.turn !== "player") {
    return "The garden is taking its turn.";
  }
  return "Mochi has no action points left. End the turn to continue.";
};

const isActionableMeowTarget = (state, target) => {
  if (target.kind === "tile") {
    return target.type === "lanternOff"
      || (target.type === "hiddenPetals" && hasCalmedSpirit(state));
  }
  const creature = state.creatures.find((candidate) => candidate.id === target.id);
  return creature?.type === "petalCrow"
    || (
      creature?.type === "sakuraSpirit"
      && creature.status === "shy"
      && hasGuidingLantern(state, creature)
    )
    || (creature?.type === "sleepyTanuki" && creature.status === "asleep");
};

/**
 * Creates the fixed 7 x 7 starting garden.
 * @returns {GameState} A fresh game state.
 */
export function createInitialState() {
  return {
    board: cloneBoard(INITIAL_BOARD),
    player: {
      row: 6,
      col: 0,
      energy: 8,
      maxEnergy: 8,
      petals: 0,
      actionPoints: 2,
      maxActionPoints: 2,
    },
    creatures: cloneCreatures(INITIAL_CREATURES),
    turn: "player",
    round: 1,
    status: "playing",
    selectedAction: "walk",
    restoredTrees: 0,
    helpedSpirits: 0,
    totalTrees: 3,
    totalSpirits: 2,
    starRating: 0,
    message: "A quiet morning begins. First, light a spirit lantern with Meow!",
    gameLog: ["A quiet morning begins. First, light a spirit lantern with Meow!"],
  };
}

/**
 * Starts over with a fully independent initial state.
 * @returns {GameState} A fresh game state.
 */
export function resetGame() {
  return createInitialState();
}

/**
 * Reports whether board coordinates are valid.
 * @param {number} row Board row.
 * @param {number} col Board column.
 * @returns {boolean} True for coordinates inside the 7 x 7 board.
 */
export function isInsideBoard(row, col) {
  return Number.isInteger(row)
    && Number.isInteger(col)
    && row >= 0
    && row < BOARD_SIZE
    && col >= 0
    && col < BOARD_SIZE;
}

/**
 * Reads a terrain tile without changing the state.
 * @param {GameState} state Current game state.
 * @param {number} row Board row.
 * @param {number} col Board column.
 * @returns {TerrainType|null} The tile, or null for invalid coordinates.
 */
export function getTileAt(state, row, col) {
  return isInsideBoard(row, col) ? state.board[row][col] : null;
}

/**
 * Checks for a creature that currently blocks movement.
 * @param {GameState} state Current game state.
 * @param {number} row Board row.
 * @param {number} col Board column.
 * @returns {boolean} True when a blocking creature occupies the position.
 */
export function isOccupied(state, row, col) {
  return state.creatures.some((creature) => (
    creature.row === row
    && creature.col === col
    && creatureBlocksMovement(creature)
  ));
}

/**
 * Checks whether Mochi may enter a board position.
 * @param {GameState} state Current game state.
 * @param {number} row Destination row.
 * @param {number} col Destination column.
 * @returns {boolean} True when the destination is inside, walkable, and unoccupied.
 */
export function canMoveTo(state, row, col) {
  const tile = getTileAt(state, row, col);
  const shrineLocked = tile === "shrine" && !areGardenWishesComplete(state);
  return tile !== null
    && !BLOCKED_TERRAIN.has(tile)
    && !shrineLocked
    && !isOccupied(state, row, col);
}

/**
 * Moves Mochi one orthogonal tile and collects any item there.
 * Invalid moves return a new state containing explanatory feedback.
 * @param {GameState} state Current game state.
 * @param {Direction} direction Direction to walk.
 * @returns {GameState} A new state.
 */
export function movePlayer(state, direction) {
  if (!isActionAvailable(state)) {
    return addMessage(state, getActionBlockMessage(state));
  }
  if (!Object.hasOwn(DIRECTIONS, direction)) {
    return addMessage(state, "Mochi tilts their head. That is not a walking direction.");
  }

  const [rowChange, colChange] = DIRECTIONS[direction];
  const nextRow = state.player.row + rowChange;
  const nextCol = state.player.col + colChange;

  if (!isInsideBoard(nextRow, nextCol)) {
    return addMessage(state, "The garden ends there. Mochi stays on the path.");
  }
  if (
    getTileAt(state, nextRow, nextCol) === "shrine"
    && !areGardenWishesComplete(state)
  ) {
    const treesLeft = state.totalTrees - state.restoredTrees;
    const spiritsLeft = state.totalSpirits - state.helpedSpirits;
    return addMessage(
      state,
      `The shrine is waiting. Restore ${treesLeft} more tree${treesLeft === 1 ? "" : "s"} and help ${spiritsLeft} more spirit${spiritsLeft === 1 ? "" : "s"} first.`,
    );
  }
  if (!canMoveTo(state, nextRow, nextCol)) {
    return addMessage(state, "That way is gently blocked.");
  }

  const movedState = spendActionPoint({
    ...state,
    selectedAction: "walk",
    player: {
      ...state.player,
      row: nextRow,
      col: nextCol,
    },
  });
  const collectedState = collectTileItem(movedState);
  const shrineMessage = getTileAt(collectedState, nextRow, nextCol) === "shrine"
    ? "Mochi steps through the open shrine gate."
    : `Mochi pads to row ${nextRow + 1}, column ${nextCol + 1}.`;
  const messagedState = collectedState.message === movedState.message
    ? addMessage(collectedState, shrineMessage)
    : collectedState;

  return checkCompletion(messagedState);
}

/**
 * Lists valid orthogonally adjacent board positions around Mochi.
 * @param {GameState} state Current game state.
 * @returns {{row:number,col:number}[]} Adjacent positions in up, right, down, left order.
 */
export function getAdjacentPositions(state) {
  return adjacentPositionsFor(state.player.row, state.player.col);
}

/**
 * Finds adjacent creatures and terrain that Meow or Restore can affect.
 * @param {GameState} state Current game state.
 * @returns {Array<{kind:"creature"|"tile",row:number,col:number,type:string,id?:string}>} Interactable neighbours.
 */
export function getAdjacentInteractable(state) {
  return getAdjacentPositions(state).flatMap(({ row, col }) => {
    const creature = state.creatures.find((candidate) => (
      candidate.row === row && candidate.col === col
    ));
    const tile = getTileAt(state, row, col);
    const entries = [];

    if (creature) {
      entries.push({
        kind: "creature",
        row,
        col,
        type: creature.type,
        id: creature.id,
      });
    }
    if (["hiddenPetals", "lanternOff", "damagedTree"].includes(tile)) {
      entries.push({ kind: "tile", row, col, type: tile });
    }
    return entries;
  });
}

/**
 * Checks whether Meow has an adjacent eligible target and enough energy.
 * A shy spirit is eligible only after its nearby lantern has been lit.
 * @param {GameState} state Current game state.
 * @returns {boolean} True when Meow can currently be attempted.
 */
export function canMeow(state) {
  return isActionAvailable(state)
    && state.player.energy > 0
    && getAdjacentInteractable(state).some((target) => isActionableMeowTarget(state, target));
}

const pushCrow = (state, crow) => {
  const occupied = new Set(
    state.creatures
      .filter((creature) => creature.id !== crow.id && creatureBlocksMovement(creature))
      .map((creature) => positionKey(creature.row, creature.col)),
  );
  const candidates = adjacentPositionsFor(crow.row, crow.col)
    .filter(({ row, col }) => (
      canCreatureEnter(state, row, col)
      && !occupied.has(positionKey(row, col))
      && !(row === state.player.row && col === state.player.col)
    ))
    .sort((first, second) => (
      Number(getTileAt(state, first.row, first.col) === "petalPile")
      - Number(getTileAt(state, second.row, second.col) === "petalPile")
      || distance(second, state.player) - distance(first, state.player)
      || first.row - second.row
      || first.col - second.col
    ));

  return candidates[0] ?? { row: crow.row, col: crow.col };
};

/**
 * Performs every eligible contextual interaction adjacent to Mochi.
 * Meow costs one action point and one energy. A nearby lantern must be lit
 * before a shy spirit can be calmed. Sequence-blocked spirit and hidden-petal
 * attempts return feedback without spending resources.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state with adjacent effects applied.
 */
export function useMeow(state) {
  if (!isActionAvailable(state)) {
    return addMessage(state, getActionBlockMessage(state));
  }
  if (state.player.energy <= 0) {
    return addMessage(state, "Mochi needs a little rest before meowing again.");
  }

  const adjacentTargets = getAdjacentInteractable(state);
  const shySpiritWaitingForLight = adjacentTargets.some((target) => {
    if (target.kind !== "creature") {
      return false;
    }
    const targetCreature = state.creatures.find((candidate) => candidate.id === target.id);
    return targetCreature?.type === "sakuraSpirit"
      && targetCreature.status === "shy"
      && !hasGuidingLantern(state, targetCreature);
  });
  const hiddenPetalsWaitingForSpirit = adjacentTargets.some((target) => (
    target.kind === "tile" && target.type === "hiddenPetals"
  ));
  const targets = adjacentTargets.filter((target) => (
    isActionableMeowTarget(state, target)
  ));
  if (targets.length === 0) {
    if (shySpiritWaitingForLight) {
      return addMessage(
        state,
        "The shy spirit needs its nearby lantern first. Find that unlit lantern and Meow beside it.",
      );
    }
    if (hiddenPetalsWaitingForSpirit && !hasCalmedSpirit(state)) {
      return addMessage(
        state,
        "The petals stay hidden. Calm a sakura spirit after lighting a lantern first.",
      );
    }
    return addMessage(state, "Mochi meows softly, but nothing nearby needs help.");
  }

  let board = state.board;
  const effects = [];
  const creatures = state.creatures.map((creature) => {
    const isAdjacent = targets.some((target) => (
      target.kind === "creature" && target.id === creature.id
    ));
    if (!isAdjacent) {
      return { ...creature };
    }
    if (creature.type === "sakuraSpirit" && creature.status === "shy") {
      effects.push("The lantern light helps a shy sakura spirit feel safe. Petal piles can now be collected!");
      return { ...creature, status: "following", following: true };
    }
    if (creature.type === "sleepyTanuki" && creature.status === "asleep") {
      if (state.restoredTrees > 0) {
        effects.push("The sleepy tanuki wakes, stretches, and clears the path.");
        return { ...creature, status: "awake", following: false };
      }
      effects.push("The tanuki snores on. One restored tree may inspire it to wake.");
      return { ...creature };
    }
    if (creature.type === "petalCrow") {
      const pushedPosition = pushCrow(state, creature);
      effects.push(
        pushedPosition.row === creature.row && pushedPosition.col === creature.col
          ? "The playful crow chirps but has nowhere to hop."
          : "The playful crow hops politely away from Mochi.",
      );
      return { ...creature, ...pushedPosition };
    }
    return { ...creature };
  });

  targets.filter((target) => target.kind === "tile").forEach((target) => {
    if (target.type === "hiddenPetals") {
      board = replaceTile(board, target.row, target.col, "petalPile");
      effects.push("A hidden petal pile rustles into view!");
    }
    if (target.type === "lanternOff") {
      board = replaceTile(board, target.row, target.col, "lanternOn");
      effects.push("A stone lantern glows with a warm little light.");
    }
  });

  const usedState = spendActionPoint({
    ...state,
    board,
    creatures,
    selectedAction: "meow",
    player: {
      ...state.player,
      energy: state.player.energy - 1,
    },
  });
  return addMessage(usedState, effects.join(" "));
}

/**
 * Checks for an adjacent damaged tree, a previously calmed spirit, and the
 * petals needed to restore it.
 * @param {GameState} state Current game state.
 * @returns {boolean} True when Restore Tree is currently valid.
 */
export function canRestoreTree(state) {
  return isActionAvailable(state)
    && hasCalmedSpirit(state)
    && state.player.petals >= 3
    && getAdjacentPositions(state).some(({ row, col }) => (
      getTileAt(state, row, col) === "damagedTree"
    ));
}

/**
 * Restores the first adjacent damaged tree in deterministic board order.
 * Restore costs one action point and three petals, and remains locked until a
 * sakura spirit has been calmed.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state, or feedback explaining an invalid action.
 */
export function restoreTree(state) {
  if (!isActionAvailable(state)) {
    return addMessage(state, getActionBlockMessage(state));
  }

  const tree = getAdjacentPositions(state)
    .filter(({ row, col }) => getTileAt(state, row, col) === "damagedTree")
    .sort((first, second) => first.row - second.row || first.col - second.col)[0];

  if (!tree) {
    return addMessage(state, "There is no damaged cherry tree beside Mochi.");
  }
  if (!hasCalmedSpirit(state)) {
    return addMessage(
      state,
      "A sakura spirit must feel safe before Mochi can restore a tree. Light a lantern, then Meow beside a spirit.",
    );
  }
  if (state.player.petals < 3) {
    return addMessage(state, `Mochi needs ${3 - state.player.petals} more petals to restore this tree.`);
  }

  const restoredState = spendActionPoint({
    ...state,
    board: replaceTile(state.board, tree.row, tree.col, "restoredTree"),
    selectedAction: "restore",
    restoredTrees: state.restoredTrees + 1,
    player: {
      ...state.player,
      petals: state.player.petals - 3,
    },
  });
  return checkCompletion(addMessage(
    restoredState,
    `Cherry tree ${restoredState.restoredTrees} of ${restoredState.totalTrees} bursts into bloom!`,
  ));
}

/**
 * Lets Mochi curl up, restoring two energy up to the maximum.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function rest(state) {
  if (!isActionAvailable(state)) {
    return addMessage(state, getActionBlockMessage(state));
  }

  const energyGained = Math.min(2, state.player.maxEnergy - state.player.energy);
  const restedState = spendActionPoint({
    ...state,
    selectedAction: "rest",
    player: {
      ...state.player,
      energy: state.player.energy + energyGained,
    },
  });
  return addMessage(
    restedState,
    energyGained > 0
      ? `Mochi curls up beneath the petals and restores ${energyGained} energy.`
      : "Mochi curls up for a perfectly cozy pause.",
  );
}

/**
 * Collects the consumable tile under Mochi, if present. Petal piles remain on
 * the board until at least one sakura spirit has been calmed.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state; non-item tiles leave gameplay values unchanged.
 */
export function collectTileItem(state) {
  const { row, col } = state.player;
  const tile = getTileAt(state, row, col);
  const itemEffects = {
    petalPile: {
      message: `Mochi gathers ${PETALS_PER_PILE} soft sakura petals.`,
      player: { petals: state.player.petals + PETALS_PER_PILE },
    },
    tea: {
      message: "A warm bowl of tea restores 3 energy.",
      player: { energy: Math.min(state.player.maxEnergy, state.player.energy + 3) },
    },
    fishSnack: {
      message: "A tiny fish snack restores 2 energy. Delicious!",
      player: { energy: Math.min(state.player.maxEnergy, state.player.energy + 2) },
    },
  };
  const effect = itemEffects[tile];

  if (!effect) {
    return { ...state, board: cloneBoard(state.board), player: { ...state.player } };
  }
  if (tile === "petalPile" && !hasCalmedSpirit(state)) {
    return addMessage({
      ...state,
      board: cloneBoard(state.board),
      player: { ...state.player },
    }, "The petals flutter away from Mochi. Light a lantern and calm a sakura spirit first.");
  }

  return addMessage({
    ...state,
    board: replaceTile(state.board, row, col, "grass"),
    player: { ...state.player, ...effect.player },
  }, effect.message);
}

/**
 * Marks a sakura spirit as helped exactly once.
 * @param {GameState} state Current game state.
 * @param {string} spiritId Spirit identifier.
 * @returns {GameState} A new state, or explanatory feedback for an invalid id.
 */
export function helpSpirit(state, spiritId) {
  const spirit = state.creatures.find((creature) => creature.id === spiritId);
  if (!spirit || spirit.type !== "sakuraSpirit") {
    return addMessage(state, "That spirit could not be found.");
  }
  if (spirit.status === "helped") {
    return { ...state, creatures: cloneCreatures(state.creatures) };
  }

  const helpedState = {
    ...state,
    creatures: state.creatures.map((creature) => (
      creature.id === spiritId
        ? { ...creature, status: "helped", following: false }
        : { ...creature }
    )),
    helpedSpirits: state.helpedSpirits + 1,
  };
  return checkCompletion(addMessage(
    helpedState,
    `A sakura spirit finds a blooming home! ${helpedState.helpedSpirits} of ${helpedState.totalSpirits} helped.`,
  ));
}

const canCreatureEnter = (state, row, col) => {
  const tile = getTileAt(state, row, col);
  return tile !== null && !BLOCKED_TERRAIN.has(tile);
};

/**
 * Moves each following spirit one deterministic step toward Mochi, then
 * delivers spirits that are adjacent to a restored tree.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function updateFollowingSpirits(state) {
  let nextState = {
    ...state,
    creatures: cloneCreatures(state.creatures),
    board: cloneBoard(state.board),
  };
  const followers = nextState.creatures.filter((creature) => (
    creature.type === "sakuraSpirit" && creature.following
  ));

  followers.forEach((follower) => {
    const current = nextState.creatures.find((creature) => creature.id === follower.id);
    if (
      isAdjacentToRestoredTree(nextState, current)
      || canDeliverSpiritWithMochi(nextState, current)
    ) {
      nextState = helpSpirit(nextState, current.id);
      return;
    }

    const occupied = new Set(
      nextState.creatures
        .filter((creature) => creature.id !== current.id && creatureBlocksMovement(creature))
        .map((creature) => positionKey(creature.row, creature.col)),
    );
    const candidates = adjacentPositionsFor(current.row, current.col)
      .filter(({ row, col }) => (
        canCreatureEnter(nextState, row, col)
        && !occupied.has(positionKey(row, col))
        && !(row === nextState.player.row && col === nextState.player.col)
      ))
      .sort((first, second) => (
        distance(first, nextState.player) - distance(second, nextState.player)
        || first.row - second.row
        || first.col - second.col
      ));
    const currentDistance = distance(current, nextState.player);
    const destination = candidates.find((candidate) => (
      distance(candidate, nextState.player) < currentDistance
    ));

    if (destination) {
      nextState = {
        ...nextState,
        creatures: nextState.creatures.map((creature) => (
          creature.id === current.id
            ? { ...creature, ...destination }
            : { ...creature }
        )),
      };
    }

    const movedSpirit = nextState.creatures.find((creature) => creature.id === current.id);
    if (
      isAdjacentToRestoredTree(nextState, movedSpirit)
      || canDeliverSpiritWithMochi(nextState, movedSpirit)
    ) {
      nextState = helpSpirit(nextState, movedSpirit.id);
    }
  });

  return nextState;
}

const findPetalPiles = (board) => board.flatMap((row, rowIndex) => row
  .map((tile, colIndex) => ({ tile, row: rowIndex, col: colIndex }))
  .filter(({ tile }) => tile === "petalPile"));

/**
 * Moves the crow one step toward the nearest visible petal pile. Ties are
 * resolved by target row, target column, then movement row and column. After
 * collecting one pile, the crow becomes satisfied and no longer moves. The
 * crow waits until a calmed spirit has unlocked petal collection.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function moveCrow(state) {
  const crow = state.creatures.find((creature) => creature.type === "petalCrow");
  const petalPiles = findPetalPiles(state.board);
  if (
    !crow
    || crow.status === "satisfied"
    || petalPiles.length === 0
    || !hasCalmedSpirit(state)
  ) {
    return {
      ...state,
      board: cloneBoard(state.board),
      creatures: cloneCreatures(state.creatures),
    };
  }

  const target = [...petalPiles].sort((first, second) => (
    distance(crow, first) - distance(crow, second)
    || first.row - second.row
    || first.col - second.col
  ))[0];

  if (crow.row === target.row && crow.col === target.col) {
    return addMessage({
      ...state,
      board: replaceTile(state.board, target.row, target.col, "grass"),
      creatures: state.creatures.map((creature) => (
        creature.id === crow.id
          ? { ...creature, status: "satisfied" }
          : { ...creature }
      )),
    }, "The playful crow tucks away a petal pile.");
  }

  const occupied = new Set(
    state.creatures
      .filter((creature) => creature.id !== crow.id && creatureBlocksMovement(creature))
      .map((creature) => positionKey(creature.row, creature.col)),
  );
  const candidates = adjacentPositionsFor(crow.row, crow.col)
    .filter(({ row, col }) => (
      canCreatureEnter(state, row, col)
      && !occupied.has(positionKey(row, col))
      && !(row === state.player.row && col === state.player.col)
      && distance({ row, col }, target) < distance(crow, target)
    ))
    .sort((first, second) => (
      distance(first, target) - distance(second, target)
      || first.row - second.row
      || first.col - second.col
    ));
  const destination = candidates[0];

  if (!destination) {
    return {
      ...state,
      board: cloneBoard(state.board),
      creatures: cloneCreatures(state.creatures),
    };
  }

  const reachedPetals = destination.row === target.row && destination.col === target.col;
  const movedState = {
    ...state,
    board: reachedPetals
      ? replaceTile(state.board, target.row, target.col, "grass")
      : cloneBoard(state.board),
    creatures: state.creatures.map((creature) => (
      creature.id === crow.id
        ? {
          ...creature,
          ...destination,
          status: reachedPetals ? "satisfied" : creature.status,
        }
        : { ...creature }
    )),
  };
  return reachedPetals
    ? addMessage(movedState, "The playful crow tucks away a petal pile.")
    : movedState;
}

/**
 * Ends the player phase early or after all action points are spent, runs the
 * deterministic garden phase, increments the round, and refreshes action points.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state.
 */
export function endPlayerTurn(state) {
  if (state.status === "completed") {
    return addMessage(state, getActionBlockMessage(state));
  }
  if (state.turn !== "player") {
    return addMessage(state, "The garden turn is already in progress.");
  }
  return runGardenTurn({
    ...state,
    turn: "garden",
    message: "Petals drift as the garden takes its turn...",
    gameLog: [...state.gameLog, "Petals drift as the garden takes its turn..."],
  });
}

/**
 * Resolves spirit following and crow movement, then returns control to Mochi.
 * @param {GameState} state Current game state with turn set to "garden".
 * @returns {GameState} A new player-turn state.
 */
export function runGardenTurn(state) {
  if (state.status === "completed") {
    return addMessage(state, getActionBlockMessage(state));
  }
  if (state.turn !== "garden") {
    return addMessage(state, "The garden waits until Mochi ends the player turn.");
  }

  const spiritsUpdated = updateFollowingSpirits(state);
  const crowUpdated = moveCrow(spiritsUpdated);
  const nextRound = {
    ...crowUpdated,
    turn: "player",
    round: state.round + 1,
    selectedAction: "walk",
    player: {
      ...crowUpdated.player,
      actionPoints: crowUpdated.player.maxActionPoints,
    },
  };
  return checkCompletion(addMessage(nextRound, `Turn ${nextRound.round}: Mochi is ready to explore.`));
}

/**
 * Completes the game only when all trees and spirits are finished and Mochi is
 * standing on the shrine.
 * @param {GameState} state Current game state.
 * @returns {GameState} A new state, completed when every objective is satisfied.
 */
export function checkCompletion(state) {
  const atShrine = getTileAt(state, state.player.row, state.player.col) === "shrine";
  const complete = state.restoredTrees >= state.totalTrees
    && state.helpedSpirits >= state.totalSpirits
    && atShrine;

  if (!complete || state.status === "completed") {
    return {
      ...state,
      board: cloneBoard(state.board),
      player: { ...state.player },
      creatures: cloneCreatures(state.creatures),
      gameLog: [...state.gameLog],
    };
  }

  const completedState = {
    ...state,
    status: "completed",
    starRating: calculateStarRating(state),
  };
  return addMessage(
    completedState,
    `The sakura garden is restored! Mochi earns ${completedState.starRating} star${completedState.starRating === 1 ? "" : "s"}.`,
  );
}

/**
 * Calculates the cozy completion rating from the current round.
 * @param {GameState} state Completed or in-progress game state.
 * @returns {1|2|3} Three stars by turn 16, two by turn 24, otherwise one.
 */
export function calculateStarRating(state) {
  if (state.round <= 16) {
    return 3;
  }
  if (state.round <= 24) {
    return 2;
  }
  return 1;
}
