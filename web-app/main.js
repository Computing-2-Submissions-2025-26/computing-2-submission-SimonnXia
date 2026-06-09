import {
  canMeow,
  canMoveTo,
  canRestoreTree,
  createInitialState,
  endPlayerTurn,
  getTileAt,
  movePlayer,
  resetGame,
  rest,
  restoreTree,
  useMeow,
} from "./game.js";

const TILE_NAMES = {
  grass: "grass",
  stonePath: "stone path",
  pond: "pond, cannot enter",
  rock: "rock, blocked",
  bridge: "small bridge",
  petalPile: "petal pile, collect three petals after calming a spirit",
  tea: "tea bowl, restores energy",
  fishSnack: "fish snack, restores energy",
  damagedTree: "damaged cherry tree, restore after calming a spirit and collecting three petals",
  restoredTree: "restored cherry tree",
  lanternOff: "unlit stone lantern, Meow to light it",
  lanternOn: "glowing stone lantern",
  shrine: "red shrine gate, final destination",
  hiddenPetals: "quiet grass with something hidden",
};

const CREATURE_NAMES = {
  sakuraSpirit: "sakura spirit",
  sleepyTanuki: "sleepy tanuki",
  petalCrow: "playful petal crow",
};

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const LEGEND_ITEMS = [
  ["grass", "Grass", ""],
  ["stonePath", "Stone Path", ""],
  ["pond", "Pond", "(Cannot enter)"],
  ["rock", "Rock", "(Blocked)"],
  ["bridge", "Bridge", "(Walkable)"],
  ["damagedTree", "Damaged Tree", "(Calm spirit + spend 3 petals)"],
  ["restoredTree", "Restored Tree", "(Already restored)"],
  ["petalPile", "Petal Pile", "(Unlocked by a calmed spirit)"],
  ["tea", "Tea", "(Restore Energy)"],
  ["fishSnack", "Fish Snack", "(Restore Energy)"],
  ["lanternOff", "Lantern Off", "(Use Meow to light)"],
  ["lanternOn", "Lantern On", "(Already lit)"],
  ["sakuraSpirit", "Sakura Spirit", "(Light its nearby lantern, then Meow)"],
  ["sleepyTanuki", "Sleepy Tanuki", "(Wake with Meow after restoring at least 1 tree)"],
  ["petalCrow", "Petal Crow", "(Moves toward petals)"],
  ["shrine", "Shrine Gate", "(Goal)"],
];

const boardElement = document.querySelector("#board");
const messageElement = document.querySelector("#message");
const turnBadge = document.querySelector("#turn-badge");
const turnLabel = document.querySelector("#turn-label");
const energyDisplay = document.querySelector("#energy-display");
const petalsDisplay = document.querySelector("#petals-display");
const treesDisplay = document.querySelector("#trees-display");
const spiritsDisplay = document.querySelector("#spirits-display");
const apDisplay = document.querySelector("#ap-display");
const roundDisplay = document.querySelector("#round-display");
const selectedActionDisplay = document.querySelector("#selected-action-display");
const gameLog = document.querySelector("#game-log");
const resultPanel = document.querySelector("#result-panel");
const starDisplay = document.querySelector("#star-display");
const resultCopy = document.querySelector("#result-copy");
const availabilityNote = document.querySelector("#availability-note");
const nextStepDisplay = document.querySelector("#next-step-display");
const meowNote = document.querySelector("#meow-note");
const restoreNote = document.querySelector("#restore-note");
const lanternsObjective = document.querySelector("#lanterns-objective");
const treesObjective = document.querySelector("#trees-objective");
const spiritsObjective = document.querySelector("#spirits-objective");
const shrineObjective = document.querySelector("#shrine-objective");
const walkButton = document.querySelector("#walk-button");
const meowButton = document.querySelector("#meow-button");
const restoreButton = document.querySelector("#restore-button");
const restButton = document.querySelector("#rest-button");
const endTurnButton = document.querySelector("#end-turn-button");
const resetButton = document.querySelector("#reset-button");

let state = createInitialState();
let gardenTurnVisible = false;
let effect = null;
let effectTimer = null;

const directionFromDelta = (rowChange, colChange) => {
  const directions = {
    "-1,0": "up",
    "0,1": "right",
    "1,0": "down",
    "0,-1": "left",
  };
  return directions[`${rowChange},${colChange}`] ?? null;
};

const creatureAt = (row, col) => state.creatures.find((creature) => (
  creature.row === row && creature.col === col
));

const statusName = (creature) => {
  if (creature.type === "sakuraSpirit") {
    return creature.status === "shy"
      ? "shy"
      : creature.status === "helped"
        ? "helped and settled"
        : "calmed and following Mochi";
  }
  if (creature.type === "sleepyTanuki") {
    return creature.status === "asleep" ? "sleeping and blocking the path" : "awake and non-blocking";
  }
  return creature.status === "satisfied" ? "satisfied with one petal pile" : "playful";
};

const createSprite = (type, status = "") => {
  const sprite = document.createElement("span");
  sprite.className = `sprite sprite-${type} ${status ? `status-${status}` : ""}`;
  sprite.setAttribute("aria-hidden", "true");
  sprite.innerHTML = "<span></span>";
  return sprite;
};

const floorTypeFor = (tile) => {
  if (["stonePath", "shrine"].includes(tile)) {
    return "stone";
  }
  if (["pond", "bridge"].includes(tile)) {
    return "water";
  }
  return "grass";
};

const createFloorDetail = (tile, row, col) => {
  const detail = document.createElement("span");
  const floorType = floorTypeFor(tile);
  const variant = ((row * 7) + col) % 4;
  detail.className = `floor-detail floor-${floorType} floor-variant-${variant}`;
  detail.setAttribute("aria-hidden", "true");
  detail.innerHTML = "<span></span><i></i><b></b>";
  return detail;
};

const createSakuraScatter = (row, col) => {
  const scatter = document.createElement("span");
  scatter.className = `sakura-scatter sakura-scatter-${((row * 3) + col) % 5}`;
  scatter.setAttribute("aria-hidden", "true");
  return scatter;
};

const gardenWishesComplete = () => (
  state.restoredTrees === state.totalTrees
  && state.helpedSpirits === state.totalSpirits
);

const litLanternCount = () => state.board.flat().filter((tile) => tile === "lanternOn").length;

const spiritStatus = (id) => state.creatures.find((creature) => creature.id === id)?.status;

const petalsUnlocked = () => state.creatures.some((creature) => (
  creature.type === "sakuraSpirit" && creature.status !== "shy"
));

const nextStepText = () => {
  if (gardenTurnVisible) {
    return "Garden turn: watch the spirits follow and the crow take one hop.";
  }
  if (state.status === "completed") {
    return `Garden complete! Mochi earned ${state.starRating} star${state.starRating === 1 ? "" : "s"}.`;
  }
  if (state.player.actionPoints === 0) {
    return "No AP left. Press END TURN to continue.";
  }
  if (
    getTileAt(state, 0, 3) === "lanternOn"
    && spiritStatus("spirit-one") === "shy"
  ) {
    return "A4 is lit. Stay at B4 and MEOW again to calm the B3 spirit.";
  }
  if (
    getTileAt(state, 5, 5) === "lanternOn"
    && spiritStatus("spirit-two") === "shy"
  ) {
    return "F6 is lit. Stand at F7 and MEOW to calm the E7 spirit.";
  }
  if (getTileAt(state, 5, 5) === "lanternOff") {
    return "STEP 1: Go to F5 and MEOW to light the F6 lantern.";
  }
  if (getTileAt(state, 6, 6) === "damagedTree") {
    return state.player.petals >= 3
      ? "STEP 4: Stand at F7 and RESTORE the G7 tree."
      : "STEP 3: The spirit unlocked petals. Collect the pile at F5.";
  }
  if (spiritStatus("spirit-two") === "following") {
    return "End the turn beside the restored G7 tree to give the spirit a home.";
  }
  if (getTileAt(state, 0, 3) === "lanternOff") {
    return "NEXT: From C3 go D3 → D4 → D5 → C5 → B5 → B4, then MEOW to light A4.";
  }
  if (getTileAt(state, 2, 3) === "damagedTree") {
    return state.player.petals >= 3
      ? "Stand at C5 and RESTORE the C4 tree."
      : "Collect the unlocked petals at A5.";
  }
  if (spiritStatus("spirit-one") === "following") {
    return "End the turn beside the restored C4 tree to give the spirit a home.";
  }
  if (getTileAt(state, 0, 0) === "damagedTree") {
    return state.player.petals >= 3
      ? "Stand at B1 and RESTORE the final A1 tree."
      : "Follow B3 and C3 to collect the petals at C1.";
  }
  return "The shrine is OPEN. Step onto E4 to finish!";
};

const tileLabel = (row, col, tile, creature) => {
  const parts = [`Tile ${ROW_LABELS[row]}${col + 1}`, TILE_NAMES[tile]];
  if (tile === "shrine") {
    parts.push(gardenWishesComplete() ? "shrine open" : "shrine locked until all objectives are complete");
  }
  if (tile === "petalPile" && !petalsUnlocked()) {
    parts.push("petals locked until a lantern is lit and a spirit is calmed");
  }
  if (tile === "damagedTree" && !petalsUnlocked()) {
    parts.push("restoration locked until a spirit is calmed");
  }
  if (state.player.row === row && state.player.col === col) {
    parts.push("Mochi is here");
  }
  if (creature) {
    parts.push(`${CREATURE_NAMES[creature.type]}, ${statusName(creature)}`);
  }
  const adjacent = Math.abs(state.player.row - row) + Math.abs(state.player.col - col) === 1;
  if (adjacent) {
    parts.push(canMoveTo(state, row, col) ? "valid move" : "movement blocked");
  }
  return parts.join(". ");
};

const renderBoard = () => {
  const fragment = document.createDocumentFragment();

  state.board.forEach((row, rowIndex) => {
    row.forEach((tile, colIndex) => {
      const cell = document.createElement("button");
      const creature = creatureAt(rowIndex, colIndex);
      const isPlayer = state.player.row === rowIndex && state.player.col === colIndex;
      const isEffectActor = effect?.actorRow === rowIndex && effect?.actorCol === colIndex;
      const isEffectTarget = effect?.targetRow === rowIndex && effect?.targetCol === colIndex;
      const isAdjacent = Math.abs(state.player.row - rowIndex)
        + Math.abs(state.player.col - colIndex) === 1;
      const isValidMove = isAdjacent
        && canMoveTo(state, rowIndex, colIndex)
        && state.player.actionPoints > 0
        && state.status === "playing"
        && !gardenTurnVisible;

      cell.type = "button";
      cell.className = [
        "tile",
        `tile-${tile}`,
        tile === "shrine" && !gardenWishesComplete() ? "shrine-locked" : "",
        tile === "shrine" && gardenWishesComplete() ? "shrine-open" : "",
        tile === "petalPile" && !petalsUnlocked() ? "quest-locked" : "",
        tile === "damagedTree" && !petalsUnlocked() ? "quest-locked" : "",
        isAdjacent ? "is-adjacent" : "",
        isValidMove ? "is-valid-move" : "",
        isEffectActor ? `actor-${effect.type}` : "",
        isEffectTarget && effect.targetType ? `effect-${effect.targetType}` : "",
      ].filter(Boolean).join(" ");
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.dataset.coordinate = `${ROW_LABELS[rowIndex]}${colIndex + 1}`;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", tileLabel(rowIndex, colIndex, tile, creature));
      cell.title = tileLabel(rowIndex, colIndex, tile, creature);
      cell.tabIndex = isPlayer ? 0 : -1;

      cell.append(createFloorDetail(tile, rowIndex, colIndex));
      cell.append(createSakuraScatter(rowIndex, colIndex));
      cell.append(createSprite(tile));
      if (tile === "shrine") {
        const shrineState = document.createElement("span");
        shrineState.className = "shrine-state";
        shrineState.textContent = gardenWishesComplete() ? "OPEN" : "LOCKED";
        shrineState.setAttribute("aria-hidden", "true");
        cell.append(shrineState);
      }
      if (
        (tile === "petalPile" || tile === "damagedTree")
        && !petalsUnlocked()
      ) {
        const questState = document.createElement("span");
        questState.className = "quest-state";
        questState.textContent = tile === "petalPile" ? "WAIT" : "SPIRIT";
        questState.setAttribute("aria-hidden", "true");
        cell.append(questState);
      }
      if (creature) {
        cell.append(createSprite(creature.type, creature.status));
      }
      if (isPlayer) {
        const playerActionStatus = isEffectActor ? {
          walk: "walking",
          collect: "collecting",
          meow: "meowing",
          restore: "restoring",
          rest: "resting",
        }[effect.type] : "";
        cell.append(createSprite("mochi", playerActionStatus));
        if (isEffectActor && effect.type === "meow") {
          const bubble = document.createElement("span");
          bubble.className = "meow-bubble";
          bubble.textContent = "MEOW!";
          bubble.setAttribute("aria-hidden", "true");
          cell.append(bubble);
        }
        if (isEffectActor) {
          const actionBurst = document.createElement("span");
          actionBurst.className = `action-burst action-burst-${effect.type}`;
          actionBurst.textContent = {
            walk: "tap tap!",
            collect: "+ item!",
            restore: "bloom!",
            rest: "Zz ♥",
          }[effect.type] ?? "";
          actionBurst.setAttribute("aria-hidden", "true");
          if (actionBurst.textContent) {
            cell.append(actionBurst);
          }
        }
      }
      if (rowIndex === 6 && colIndex === 0) {
        const startLabel = document.createElement("span");
        startLabel.className = "start-label";
        startLabel.textContent = "START";
        startLabel.setAttribute("aria-hidden", "true");
        cell.append(startLabel);
      }
      const coordinate = document.createElement("span");
      coordinate.className = "cell-coordinate";
      coordinate.textContent = `${ROW_LABELS[rowIndex]}${colIndex + 1}`;
      coordinate.setAttribute("aria-hidden", "true");
      cell.append(coordinate);

      fragment.append(cell);
    });
  });

  boardElement.replaceChildren(fragment);
};

const objectiveComplete = (element, complete) => {
  element.classList.toggle("complete", complete);
  element.querySelector("span").textContent = complete ? "✓" : "";
};

const renderStatus = () => {
  const shownTurn = gardenTurnVisible ? "garden" : state.turn;
  boardElement.setAttribute("aria-busy", String(gardenTurnVisible));
  boardElement.dataset.turn = shownTurn;
  turnBadge.dataset.turn = shownTurn;
  turnLabel.textContent = shownTurn === "garden" ? "Garden turn" : "Player turn";
  energyDisplay.textContent = `${state.player.energy} / ${state.player.maxEnergy}`;
  petalsDisplay.textContent = String(state.player.petals);
  treesDisplay.textContent = `${state.restoredTrees} / ${state.totalTrees}`;
  spiritsDisplay.textContent = `${state.helpedSpirits} / ${state.totalSpirits}`;
  apDisplay.textContent = `${state.player.actionPoints} / ${state.player.maxActionPoints}`;
  roundDisplay.textContent = String(state.round);
  selectedActionDisplay.textContent = state.selectedAction[0].toUpperCase()
    + state.selectedAction.slice(1);
  messageElement.textContent = gardenTurnVisible
    ? "Petals drift as the spirits and crow take their gentle garden turn..."
    : state.message;
  nextStepDisplay.textContent = nextStepText();

  const turnLocked = gardenTurnVisible || state.status === "completed";
  const playerActionsLocked = turnLocked || state.player.actionPoints === 0;
  [walkButton, meowButton, restoreButton, restButton].forEach((button) => {
    button.disabled = playerActionsLocked;
  });
  endTurnButton.disabled = turnLocked;
  const actionButtons = {
    walk: walkButton,
    meow: meowButton,
    restore: restoreButton,
    rest: restButton,
  };
  Object.entries(actionButtons).forEach(([actionName, button]) => {
    button.classList.toggle("active", state.selectedAction === actionName);
    button.setAttribute("aria-pressed", String(state.selectedAction === actionName));
  });
  boardElement.classList.toggle("no-action-points", state.player.actionPoints === 0);
  meowButton.dataset.available = String(canMeow(state));
  restoreButton.dataset.available = String(canRestoreTree(state));
  meowNote.textContent = state.player.energy === 0
    ? "Needs energy · Rest first"
    : canMeow(state)
      ? "Ready · 1 AP · 1 energy"
      : "Needs an adjacent target";
  restoreNote.textContent = state.player.petals < 3
    ? petalsUnlocked()
      ? `Need ${3 - state.player.petals} more petals`
      : "Calm a spirit first"
    : canRestoreTree(state)
      ? "Ready · 1 AP · 3 petals"
      : "Stand beside a damaged tree";

  availabilityNote.textContent = nextStepText();

  objectiveComplete(lanternsObjective, litLanternCount() === 2);
  objectiveComplete(spiritsObjective, state.helpedSpirits === state.totalSpirits);
  objectiveComplete(treesObjective, state.restoredTrees === state.totalTrees);
  objectiveComplete(shrineObjective, state.status === "completed");
  shrineObjective.lastChild.textContent = state.status === "completed"
    ? " 4. Shrine reached and garden complete"
    : gardenWishesComplete()
      ? " 4. Shrine Gate OPEN — step onto E4"
      : " 4. Enter the Shrine Gate";
};

const renderLog = () => {
  const entries = state.gameLog.slice(-6);
  gameLog.replaceChildren(...entries.map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
  gameLog.scrollTop = gameLog.scrollHeight;
};

const renderResult = () => {
  resultPanel.hidden = state.status !== "completed";
  if (state.status !== "completed") {
    return;
  }

  starDisplay.replaceChildren(...Array.from({ length: 3 }, (_, index) => {
    const star = document.createElement("span");
    star.className = index < state.starRating ? "earned" : "";
    star.textContent = "★";
    return star;
  }));
  starDisplay.setAttribute("aria-label", `${state.starRating} out of 3 stars`);
  resultCopy.textContent = `Completed on turn ${state.round}. The spirits have homes, the trees are blooming, and Mochi has found the ideal shrine-side nap.`;
};

const render = () => {
  renderBoard();
  renderStatus();
  renderLog();
  renderResult();
};

const findBoardEffect = (previousState, nextState, actionName) => {
  const actor = {
    actorRow: nextState.player.row,
    actorCol: nextState.player.col,
  };

  if (actionName === "restore") {
    for (let row = 0; row < previousState.board.length; row += 1) {
      const col = previousState.board[row].findIndex((tile, index) => (
        tile === "damagedTree" && nextState.board[row][index] === "restoredTree"
      ));
      if (col >= 0) {
        return {
          type: "restore",
          ...actor,
          targetType: "bloom",
          targetRow: row,
          targetCol: col,
        };
      }
    }
    return { type: "restore", ...actor };
  }
  if (actionName === "walk") {
    const oldTile = previousState.board[nextState.player.row][nextState.player.col];
    if (["petalPile", "tea", "fishSnack"].includes(oldTile)) {
      return { type: "collect", ...actor };
    }
    if (
      previousState.player.row !== nextState.player.row
      || previousState.player.col !== nextState.player.col
    ) {
      return { type: "walk", ...actor };
    }
  }
  if (actionName === "meow") {
    return { type: "meow", ...actor };
  }
  if (actionName === "rest") {
    return { type: "rest", ...actor };
  }
  return null;
};

const applyAction = (action, actionName) => {
  if (gardenTurnVisible) {
    return;
  }
  const previousState = state;
  state = action(state);
  if (state.status === "playing") {
    state = { ...state, selectedAction: actionName };
  }
  effect = findBoardEffect(previousState, state, actionName);
  window.clearTimeout(effectTimer);
  if (effect) {
    effectTimer = window.setTimeout(() => {
      effect = null;
      render();
    }, 900);
  }
  render();
};

const walk = (direction) => {
  if (direction) {
    applyAction((currentState) => movePlayer(currentState, direction), "walk");
  }
};

const handleCellClick = (event) => {
  const cell = event.target.closest(".tile");
  if (!cell) {
    return;
  }
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const direction = directionFromDelta(
    row - state.player.row,
    col - state.player.col,
  );
  walk(direction);
};

const handleKeydown = (event) => {
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
    return;
  }
  const keyActions = {
    ArrowUp: () => walk("up"),
    w: () => walk("up"),
    W: () => walk("up"),
    ArrowRight: () => walk("right"),
    d: () => walk("right"),
    D: () => walk("right"),
    ArrowDown: () => walk("down"),
    s: () => walk("down"),
    S: () => walk("down"),
    ArrowLeft: () => walk("left"),
    a: () => walk("left"),
    A: () => walk("left"),
    "1": () => walkButton.focus(),
    "2": () => applyAction(useMeow, "meow"),
    "3": () => applyAction(restoreTree, "restore"),
    "4": () => applyAction(rest, "rest"),
  };
  const keyAction = keyActions[event.key];
  if (keyAction) {
    event.preventDefault();
    keyAction();
  }
};

const showGardenTurn = () => {
  if (gardenTurnVisible || state.status === "completed") {
    return;
  }
  gardenTurnVisible = true;
  effect = null;
  render();
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 480;
  window.setTimeout(() => {
    state = endPlayerTurn(state);
    gardenTurnVisible = false;
    render();
  }, delay);
};

const buildLegend = () => {
  const legendList = document.querySelector("#legend-list");
  const entries = LEGEND_ITEMS.map(([type, name, detail]) => {
    const item = document.createElement("li");
    item.append(createSprite(type));
    const text = document.createElement("span");
    text.innerHTML = `<strong>${name}</strong><small>${detail}</small>`;
    item.append(text);
    return item;
  });
  legendList.replaceChildren(...entries);
};

boardElement.addEventListener("click", handleCellClick);
window.addEventListener("keydown", handleKeydown);
walkButton.addEventListener("click", () => {
  state = { ...state, selectedAction: "walk" };
  boardElement.querySelector(`[data-row="${state.player.row}"][data-col="${state.player.col}"]`)?.focus();
  renderStatus();
});
meowButton.addEventListener("click", () => applyAction(useMeow, "meow"));
restoreButton.addEventListener("click", () => applyAction(restoreTree, "restore"));
restButton.addEventListener("click", () => applyAction(rest, "rest"));
endTurnButton.addEventListener("click", showGardenTurn);
resetButton.addEventListener("click", () => {
  window.clearTimeout(effectTimer);
  state = resetGame();
  effect = null;
  gardenTurnVisible = false;
  render();
});

buildLegend();
render();
