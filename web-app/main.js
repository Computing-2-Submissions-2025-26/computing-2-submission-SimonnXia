import {
  canMoveTo,
  createInitialState,
  endTurn,
  getAdjacentObjects,
  movePlayer,
  resetGame,
  startGame,
  useMeow,
} from "./game.js";

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const DIRECTIONS = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

const screens = {
  intro: document.querySelector("#intro-screen"),
  game: document.querySelector("#game-screen"),
  ending: document.querySelector("#ending-screen"),
};
const boardElement = document.querySelector("#board");
const phaseTitle = document.querySelector("#phase-title");
const objectiveEl = document.querySelector("#objective");
const phaseDisplay = document.querySelector("#phase-display");
const turnOwnerDisplay = document.querySelector("#turn-owner-display");
const turnDisplay = document.querySelector("#turn-display");
const staminaDisplay = document.querySelector("#stamina-display");
const staminaFill = document.querySelector("#stamina-fill");
const forestStat = document.querySelector("#forest-stat");
const spiritsDisplay = document.querySelector("#spirits-display");
const gateStat = document.querySelector("#gate-stat");
const gateDisplay = document.querySelector("#gate-display");
const obeliskStat = document.querySelector("#obelisk-stat");
const obelisksDisplay = document.querySelector("#obelisks-display");
const bossStat = document.querySelector("#boss-stat");
const bossDisplay = document.querySelector("#boss-display");
const phaseArt = document.querySelector("#phase-art");
const phaseTip = document.querySelector("#phase-tip");
const messageEl = document.querySelector("#message");
const logEl = document.querySelector("#log");
const moveButton = document.querySelector("#move-button");
const meowButton = document.querySelector("#meow-button");
const waitButton = document.querySelector("#wait-button");
const restartButton = document.querySelector("#restart-button");
const lostOverlay = document.querySelector("#lost-overlay");

let state = createInitialState();
let moveMode = true;
let actionEffect = "";
let actionTimer = 0;
let actionUsed = false;

const coord = (row, col) => `${ROW_LABELS[row]}${col + 1}`;
const keyOf = (row, col) => `${row},${col}`;

// Every tile Mochi can reach this turn with a clear orthogonal path of one or
// two steps, mapped to the direction list that walks there.
const reachableMoves = () => {
  const moves = new Map();
  if (!state.player) {
    return moves;
  }
  const start = state.player;
  Object.entries(DIRECTIONS).forEach(([dir1, [dr1, dc1]]) => {
    const r1 = start.row + dr1;
    const c1 = start.col + dc1;
    const onOpenGate = state.phase === "forest"
      && state.board[r1]?.[c1] === "gate"
      && state.shrineGate.open;
    if (!canMoveTo(state, r1, c1) && !onOpenGate) {
      return;
    }
    moves.set(keyOf(r1, c1), [dir1]);
    if (onOpenGate) {
      return;
    }
    Object.entries(DIRECTIONS).forEach(([dir2, [dr2, dc2]]) => {
      const r2 = r1 + dr2;
      const c2 = c1 + dc2;
      const key = keyOf(r2, c2);
      const gate2 = state.phase === "forest"
        && state.board[r2]?.[c2] === "gate"
        && state.shrineGate.open;
      if ((key === keyOf(start.row, start.col)) || moves.has(key)) {
        return;
      }
      if (canMoveTo(state, r2, c2) || gate2) {
        moves.set(key, [dir1, dir2]);
      }
    });
  });
  return moves;
};

const treeAt = (row, col) => (state.trees ?? []).find((tree) => (
  tree.row === row && tree.col === col
));
const obeliskAt = (row, col) => (state.obelisks ?? []).find((obelisk) => (
  obelisk.row === row && obelisk.col === col
));
const fishAt = (row, col) => (state.fishCookies ?? []).find((fish) => (
  fish.row === row && fish.col === col && !fish.collected
));
const tombstoneAt = (row, col) => (state.tombstones ?? []).find((tombstone) => (
  tombstone.row === row && tombstone.col === col
));
const isVoid = (row, col) => (state.destroyedTiles ?? []).some((tile) => (
  tile.row === row && tile.col === col
));
const isTargeted = (row, col) => state.boss?.targetedTile
  && state.boss.targetedTile.row === row
  && state.boss.targetedTile.col === col;

const cellLabel = (row, col) => {
  const parts = [coord(row, col)];
  if (state.phase === "forest") {
    const tree = treeAt(row, col);
    if (tree) {
      parts.push(tree.awakened ? "awakened sakura tree" : "dormant sakura tree, Meow to wake it");
    } else if (row === state.shrineGate.row && col === state.shrineGate.col) {
      parts.push(state.shrineGate.open ? "open shrine gate" : "sealed shrine gate");
    } else if (fishAt(row, col)) {
      parts.push("fish cookie, restores stamina");
    } else {
      parts.push(state.board[row][col]);
    }
  } else {
    const obelisk = obeliskAt(row, col);
    if (obelisk) {
      parts.push(obelisk.destroyed ? "shattered obelisk" : "glowing obelisk, Meow to destroy it");
    } else if (state.boss && row === state.boss.row && col === state.boss.col) {
      parts.push("the Dark Shrine");
    } else if (fishAt(row, col)) {
      parts.push("fish cookie, restores stamina");
    } else if (tombstoneAt(row, col)) {
      parts.push("tombstone curse, stepping here makes Mochi recover next turn");
    } else if (isVoid(row, col)) {
      parts.push("void, cannot enter");
    } else if (isTargeted(row, col)) {
      parts.push("targeted by the Dark Shrine, do not stay here");
    } else {
      parts.push("cursed ground");
    }
  }
  if (state.player && row === state.player.row && col === state.player.col) {
    parts.push("Mochi is here");
  }
  if (state.player?.stamina <= 0) {
    parts.push("Mochi has no stamina");
  }
  if (state.player?.stunnedTurns > 0) {
    parts.push("Mochi must recover this turn");
  }
  return parts.join(". ");
};

const buildCell = (row, col, moves) => {
  const cell = document.createElement("button");
  cell.type = "button";
  const classes = ["tile"];
  if (state.phase === "forest") {
    classes.push(`tile-${state.board[row][col]}`);
  } else {
    classes.push(isVoid(row, col) ? "tile-void" : "tile-ground");
  }
  const isReachable = moveMode
    && !actionUsed
    && state.player?.stamina > 0
    && state.player?.stunnedTurns === 0
    && moves.has(keyOf(row, col))
    && state.status === "playing";
  if (isReachable) {
    classes.push("reachable");
  }
  if (isTargeted(row, col)) {
    classes.push("targeted");
  }
  cell.className = classes.join(" ");
  cell.dataset.row = String(row);
  cell.dataset.col = String(col);
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", cellLabel(row, col));

  const addSprite = (name) => {
    const sprite = document.createElement("span");
    sprite.className = `sprite sprite-${name}`;
    sprite.setAttribute("aria-hidden", "true");
    cell.append(sprite);
  };

  if (state.phase === "forest") {
    const tree = treeAt(row, col);
    if (tree) {
      addSprite(tree.awakened ? "tree-awake" : "tree-dormant");
      if (tree.awakened) {
        addSprite("spirit");
      }
    }
    if (row === state.shrineGate.row && col === state.shrineGate.col) {
      addSprite(state.shrineGate.open ? "gate-open" : "gate-closed");
    }
  } else {
    if (tombstoneAt(row, col)) {
      addSprite("tombstone");
    }
    const obelisk = obeliskAt(row, col);
    if (obelisk) {
      addSprite(obelisk.destroyed ? "obelisk-broken" : "obelisk");
    }
    if (state.boss && row === state.boss.row && col === state.boss.col) {
      addSprite(state.boss.alive ? "boss" : "boss-dead");
    }
  }
  if (fishAt(row, col)) {
    addSprite("fish-cookie");
  }

  if (state.player && row === state.player.row && col === state.player.col) {
    addSprite("mochi");
  }
  return cell;
};

const renderBoard = () => {
  if (!state.board) {
    boardElement.replaceChildren();
    return;
  }
  boardElement.dataset.phase = state.phase;
  boardElement.dataset.action = actionEffect;
  boardElement.style.setProperty("--board-size", String(state.board.length));
  const moves = reachableMoves();
  const fragment = document.createDocumentFragment();
  state.board.forEach((row, rowIndex) => {
    row.forEach((_tile, colIndex) => {
      fragment.append(buildCell(rowIndex, colIndex, moves));
    });
  });
  boardElement.replaceChildren(fragment);
};

const renderHud = () => {
  const inForest = state.phase === "forest";
  phaseTitle.textContent = inForest ? "Sakura Forest" : "Sealed Land";
  phaseDisplay.textContent = inForest ? "Forest" : "Sealed Land";
  turnOwnerDisplay.textContent = state.status === "playing"
    ? state.player?.stunnedTurns > 0
      ? "Mochi recovering"
      : actionUsed ? "Mochi acted" : "Mochi"
    : "Game over";
  turnDisplay.textContent = String(state.turn);
  const stamina = state.player?.stamina ?? 0;
  const maxStamina = state.player?.maxStamina ?? 1;
  staminaDisplay.textContent = `${stamina} / ${maxStamina}`;
  staminaFill.style.width = `${Math.max(0, Math.min(100, (stamina / maxStamina) * 100))}%`;

  forestStat.hidden = !inForest;
  gateStat.hidden = !inForest;
  obeliskStat.hidden = inForest;
  bossStat.hidden = inForest;

  if (inForest) {
    objectiveEl.textContent = state.shrineGate.open
      ? "All spirits freed! Enter the glowing shrine gate."
      : "Stand beside a dormant tree and Meow to free its spirit.";
    phaseArt.dataset.phase = "forest";
    phaseTip.textContent = state.shrineGate.open
      ? "The gate is open. Click the highlighted gate tile to enter the dark shrine."
      : state.player.stamina <= 0
        ? "Mochi is out of stamina. Follow the route to the next fish cookie refill."
        : actionUsed
        ? "Action used. Press Next Turn before moving or Meowing again."
        : "Move beside each sakura tree, then press Meow. One action ends the turn.";
    spiritsDisplay.textContent = `${state.rescuedSpirits} / ${state.totalSpirits}`;
    gateDisplay.textContent = state.shrineGate.open ? "OPEN" : "Sealed";
    gateDisplay.dataset.state = state.shrineGate.open ? "open" : "closed";
  } else {
    objectiveEl.textContent = "Shatter all four obelisks. Never linger on a targeted tile!";
    phaseArt.dataset.phase = "sealedLand";
    if (state.player.stunnedTurns > 0) {
      phaseTip.textContent = "Mochi hit a tombstone curse. Press Recover to spend this turn clearing it.";
    } else if (state.player.stamina <= 0) {
      phaseTip.textContent = "Mochi is exhausted. Step onto a fish cookie refill before stamina runs out.";
    } else if (actionUsed) {
      phaseTip.textContent = "Action used. Press Next Turn to continue.";
    } else if (state.boss.silencedTurns > 0) {
      phaseTip.textContent = "Boss silenced: rush to an obelisk and Meow while it is safe.";
    } else {
      phaseTip.textContent = "Boss awake: move away from the red marked tile before it collapses.";
    }
    obelisksDisplay.textContent = `${state.destroyedObelisks} / 4`;
    const silenced = state.boss.silencedTurns > 0;
    bossDisplay.textContent = !state.boss.alive
      ? "Defeated"
      : silenced
        ? `Silenced (${state.boss.silencedTurns})`
        : "AWAKE — run!";
    bossDisplay.dataset.state = !state.boss.alive ? "dead" : silenced ? "silent" : "awake";
  }

  messageEl.textContent = state.message;
  logEl.replaceChildren(...state.log.slice(-6).map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));

  const playing = state.status === "playing";
  const cannotAct = !playing || actionUsed || state.player?.stamina <= 0 || state.player?.stunnedTurns > 0;
  moveButton.disabled = cannotAct;
  meowButton.disabled = cannotAct;
  waitButton.disabled = !playing;
  waitButton.textContent = actionUsed ? "Next Turn" : state.player?.stunnedTurns > 0 ? "Recover" : "End Turn";
  moveButton.classList.toggle("active", moveMode);
  moveButton.setAttribute("aria-pressed", String(moveMode));
  meowButton.classList.toggle("active", !moveMode);
  meowButton.setAttribute("aria-pressed", String(!moveMode));
  meowButton.dataset.ready = String(!cannotAct && getAdjacentObjects(state).length > 0);

  lostOverlay.hidden = state.status !== "lost";
};

const showScreen = () => {
  document.body.dataset.phase = state.phase;
  const active = state.phase === "intro"
    ? "intro"
    : state.phase === "ending"
      ? "ending"
      : "game";
  Object.entries(screens).forEach(([name, element]) => {
    element.hidden = name !== active;
  });
};

const render = () => {
  showScreen();
  if (state.phase === "forest" || state.phase === "sealedLand") {
    renderBoard();
    renderHud();
  }
};

const actionWasSpent = (previous, next) => (
  previous.turn !== next.turn
  || previous.phase !== next.phase
  || previous.status !== next.status
);

const apply = (next, effect = "", options = {}) => {
  const { action = false, unlock = false } = options;
  const spentAction = action && actionWasSpent(state, next);
  if (unlock) {
    actionUsed = false;
  } else if (spentAction && next.status === "playing" && next.phase !== "ending") {
    actionUsed = true;
  }
  state = next;
  actionEffect = effect;
  if (actionTimer) {
    window.clearTimeout(actionTimer);
  }
  render();
  if (effect) {
    actionTimer = window.setTimeout(() => {
      actionEffect = "";
      renderBoard();
    }, 620);
  }
};

const handleCellClick = (event) => {
  if (!moveMode || actionUsed || state.status !== "playing" || state.player?.stamina <= 0 || state.player?.stunnedTurns > 0) {
    return;
  }
  const cell = event.target.closest(".tile");
  if (!cell) {
    return;
  }
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const moves = reachableMoves();
  const path = moves.get(keyOf(row, col));
  if (path) {
    apply(movePlayer(state, path), "move", { action: true });
  }
};

const stepMove = (direction) => {
  if (!actionUsed && state.status === "playing" && state.player?.stamina > 0 && state.player?.stunnedTurns === 0) {
    apply(movePlayer(state, direction), "move", { action: true });
  }
};

const setMoveMode = (on) => {
  moveMode = on;
  renderHud();
  renderBoard();
};

const handleKeydown = (event) => {
  if (state.phase !== "forest" && state.phase !== "sealedLand") {
    return;
  }
  if (actionUsed || state.player?.stunnedTurns > 0) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (actionUsed) {
        actionUsed = false;
        render();
      } else {
        apply(endTurn(state), "wait");
      }
    }
    return;
  }
  const moves = {
    ArrowUp: () => stepMove("up"),
    w: () => stepMove("up"),
    ArrowDown: () => stepMove("down"),
    s: () => stepMove("down"),
    ArrowLeft: () => stepMove("left"),
    a: () => stepMove("left"),
    ArrowRight: () => stepMove("right"),
    d: () => stepMove("right"),
    m: () => state.player?.stamina > 0 && apply(useMeow(state), "meow", { action: true }),
    " ": () => state.player?.stamina > 0 && apply(useMeow(state), "meow", { action: true }),
  };
  const handler = moves[event.key];
  if (handler) {
    event.preventDefault();
    handler();
  }
};

document.querySelector("#start-button").addEventListener("click", () => apply(startGame(state), "", { unlock: true }));
document.querySelector("#replay-button").addEventListener("click", () => apply(resetGame(), "", { unlock: true }));
document.querySelector("#lost-restart").addEventListener("click", () => apply(resetGame(), "", { unlock: true }));
restartButton.addEventListener("click", () => apply(resetGame(), "", { unlock: true }));
moveButton.addEventListener("click", () => setMoveMode(true));
meowButton.addEventListener("click", () => apply(useMeow(state), "meow", { action: true }));
waitButton.addEventListener("click", () => {
  if (actionUsed) {
    actionUsed = false;
    render();
    return;
  }
  apply(endTurn(state), "wait");
});
boardElement.addEventListener("click", handleCellClick);
window.addEventListener("keydown", handleKeydown);

render();
