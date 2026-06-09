import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateStarRating,
  canMeow,
  canMoveTo,
  canRestoreTree,
  checkCompletion,
  collectTileItem,
  createInitialState,
  endPlayerTurn,
  getAdjacentInteractable,
  getAdjacentPositions,
  getTileAt,
  helpSpirit,
  isInsideBoard,
  isOccupied,
  moveCrow,
  movePlayer,
  resetGame,
  rest,
  restoreTree,
  runGardenTurn,
  updateFollowingSpirits,
  useMeow,
} from "../game.js";

const deepClone = (value) => structuredClone(value);

const stateWith = ({
  player = {},
  boardChanges = [],
  creatures,
  ...changes
} = {}) => {
  const state = createInitialState();
  const board = state.board.map((row) => [...row]);
  boardChanges.forEach(([row, col, tile]) => {
    board[row][col] = tile;
  });
  return {
    ...state,
    ...changes,
    board,
    player: { ...state.player, ...player },
    creatures: creatures
      ? creatures.map((creature) => ({ ...creature }))
      : state.creatures.map((creature) => ({ ...creature })),
  };
};

const creature = (overrides) => ({
  id: "creature",
  type: "sakuraSpirit",
  row: 0,
  col: 0,
  status: "shy",
  following: false,
  ...overrides,
});

test("initial state contains a fresh 7 x 7 playable garden", () => {
  const state = createInitialState();

  assert.equal(state.board.length, 7, "board should contain seven rows");
  assert.ok(state.board.every((row) => row.length === 7), "every board row should contain seven tiles");
  assert.equal(state.board[0][0], "damagedTree", "A1 should contain the first damaged tree");
  assert.equal(state.board[0][6], "restoredTree", "A7 should match the reference blossom tree");
  assert.equal(state.board[2][3], "damagedTree", "C4 should contain the second damaged tree");
  assert.equal(state.board[6][6], "damagedTree", "G7 should contain the third damaged tree");
  assert.equal(state.board[1][6], "hiddenPetals", "B7 should contain the optional hidden petal bonus");
  assert.equal(state.board[2][0], "petalPile", "C1 should supply petals beside the A1 route");
  assert.equal(state.board[3][0], "grass", "D1 should keep the left-side route connected");
  assert.equal(state.board[3][4], "grass", "D5 should keep the C3-to-B4 route visibly open");
  assert.equal(state.board[3][5], "petalPile", "D6 should hold the relocated optional petal pile");
  assert.equal(state.board[5][2], "stonePath", "F3 should connect the start to the central route");
  assert.equal(state.board[5][4], "petalPile", "F5 should visibly supply the G7 route");
  assert.deepEqual(
    {
      energy: state.player.energy,
      actionPoints: state.player.actionPoints,
      trees: state.totalTrees,
      spirits: state.totalSpirits,
      turn: state.turn,
      status: state.status,
    },
    {
      energy: 8,
      actionPoints: 2,
      trees: 3,
      spirits: 2,
      turn: "player",
      status: "playing",
    },
  );
});

test("resetGame returns independent board, player, and creature data", () => {
  const first = resetGame();
  const second = resetGame();

  first.board[0][0] = "grass";
  first.player.energy = 0;
  first.creatures[0].status = "helped";

  assert.equal(second.board[0][0], "damagedTree");
  assert.equal(second.player.energy, 8);
  assert.equal(second.creatures[0].status, "shy");
});

test("board queries report boundaries, tiles, adjacent positions, and occupancy", () => {
  const state = createInitialState();

  assert.equal(isInsideBoard(0, 0), true);
  assert.equal(isInsideBoard(7, 0), false);
  assert.equal(getTileAt(state, 6, 0), "grass");
  assert.equal(getTileAt(state, -1, 0), null);
  assert.deepEqual(getAdjacentPositions(state), [{ row: 5, col: 0 }, { row: 6, col: 1 }]);
  assert.equal(isOccupied(state, 4, 6), true, "a shy spirit should block its tile");
});

test("valid movement changes position and spends one action point without mutating input", () => {
  const state = createInitialState();
  const before = deepClone(state);
  const moved = movePlayer(state, "up");

  assert.deepEqual({ row: moved.player.row, col: moved.player.col }, { row: 5, col: 0 });
  assert.equal(moved.player.actionPoints, 1);
  assert.deepEqual(state, before, "movePlayer should not mutate its input state");
});

test("unsupported directions do not move Mochi or spend action points", () => {
  const state = createInitialState();
  const moved = movePlayer(state, "diagonal");

  assert.deepEqual({ row: moved.player.row, col: moved.player.col }, { row: 6, col: 0 });
  assert.equal(moved.player.actionPoints, 2);
  assert.match(moved.message, /not a walking direction/i);
});

test("movement cannot leave the board", () => {
  const state = createInitialState();
  const moved = movePlayer(state, "left");

  assert.equal(moved.player.col, 0);
  assert.equal(moved.player.actionPoints, 2);
  assert.match(moved.message, /garden ends/i);
});

test("pond and rock terrain block movement", () => {
  const pondState = stateWith({ player: { row: 1, col: 0 } });
  const rockState = stateWith({ player: { row: 0, col: 1 } });

  assert.equal(canMoveTo(pondState, 1, 1), false, "pond should not be walkable");
  assert.equal(canMoveTo(rockState, 0, 2), false, "rock should not be walkable");
  assert.equal(movePlayer(pondState, "right").player.actionPoints, 2);
  assert.equal(movePlayer(rockState, "right").player.actionPoints, 2);
});

test("the shrine stays locked until every garden wish is complete", () => {
  const locked = stateWith({
    player: { row: 4, col: 2 },
    restoredTrees: 2,
    helpedSpirits: 2,
    creatures: [],
  });
  const unlocked = stateWith({
    player: { row: 4, col: 2 },
    restoredTrees: 3,
    helpedSpirits: 2,
    creatures: [],
  });

  assert.equal(canMoveTo(locked, 4, 3), false, "incomplete objectives should lock the shrine");
  const refused = movePlayer(locked, "right");
  assert.deepEqual(
    { row: refused.player.row, col: refused.player.col },
    { row: 4, col: 2 },
  );
  assert.equal(refused.player.actionPoints, 2, "a locked shrine attempt should not spend AP");
  assert.match(refused.message, /shrine is waiting/i);

  assert.equal(canMoveTo(unlocked, 4, 3), true, "all objectives should unlock the shrine");
  assert.equal(movePlayer(unlocked, "right").status, "completed");
});

test("blocking creatures prevent Mochi entering their tile", () => {
  const state = stateWith({
    player: { row: 3, col: 3 },
    creatures: [creature({ row: 3, col: 4 })],
  });
  const moved = movePlayer(state, "right");

  assert.equal(isOccupied(state, 3, 4), true);
  assert.equal(moved.player.col, 3);
  assert.equal(moved.player.actionPoints, 2);
});

test("walking onto petals collects three petals and clears the tile", () => {
  const state = stateWith({
    player: { row: 3, col: 3, petals: 1 },
    boardChanges: [[3, 4, "petalPile"]],
    creatures: [creature({ status: "following", following: true })],
  });
  const moved = movePlayer(state, "right");

  assert.equal(moved.player.petals, 4);
  assert.equal(moved.board[3][4], "grass");
  assert.match(moved.message, /gathers 3/i);
});

test("walking onto tea restores energy without exceeding the maximum", () => {
  const state = stateWith({
    player: { row: 3, col: 3, energy: 6 },
    boardChanges: [[3, 4, "tea"]],
    creatures: [],
  });
  const moved = movePlayer(state, "right");

  assert.equal(moved.player.energy, 8);
  assert.equal(moved.board[3][4], "grass");
});

test("walking onto a fish snack restores two energy and clears the tile", () => {
  const state = stateWith({
    player: { row: 3, col: 3, energy: 4 },
    boardChanges: [[3, 4, "fishSnack"]],
    creatures: [],
  });
  const moved = movePlayer(state, "right");

  assert.equal(moved.player.energy, 6);
  assert.equal(moved.board[3][4], "grass");
});

test("collectTileItem leaves non-item gameplay values unchanged", () => {
  const state = stateWith({ player: { row: 3, col: 3 }, creatures: [] });
  const collected = collectTileItem(state);

  assert.deepEqual(collected.player, state.player);
  assert.deepEqual(collected.board, state.board);
  assert.notEqual(collected, state, "the pure API should return a new state object");
});

test("Meow calms an adjacent shy spirit and spends energy and AP", () => {
  const state = stateWith({
    player: { row: 3, col: 3, energy: 5 },
    boardChanges: [[3, 2, "lanternOn"]],
    creatures: [creature({ id: "shy", row: 3, col: 4 })],
  });
  const meowed = useMeow(state);
  const spirit = meowed.creatures.find(({ id }) => id === "shy");

  assert.equal(canMeow(state), true);
  assert.equal(spirit.status, "following");
  assert.equal(spirit.following, true);
  assert.equal(meowed.player.energy, 4);
  assert.equal(meowed.player.actionPoints, 1);
});

test("a shy spirit cannot be calmed before a lantern is lit", () => {
  const state = stateWith({
    player: { row: 3, col: 3, energy: 5 },
    creatures: [creature({ id: "shy", row: 3, col: 4 })],
  });
  const meowed = useMeow(state);

  assert.equal(canMeow(state), false);
  assert.equal(meowed.creatures[0].status, "shy");
  assert.equal(meowed.player.energy, 5, "a blocked sequence step should not spend energy");
  assert.equal(meowed.player.actionPoints, 2, "a blocked sequence step should not spend AP");
  assert.match(meowed.message, /nearby lantern first/i);
});

test("petal piles cannot be collected before a spirit is calmed", () => {
  const state = stateWith({
    player: { row: 3, col: 3 },
    boardChanges: [[3, 4, "petalPile"]],
    creatures: [],
  });
  const moved = movePlayer(state, "right");

  assert.equal(moved.player.petals, 0);
  assert.equal(moved.board[3][4], "petalPile");
  assert.equal(moved.player.actionPoints, 1, "walking onto the tile should still spend movement AP");
  assert.match(moved.message, /calm a sakura spirit first/i);
});

test("locked petal piles remain walkable rather than blocking the route", () => {
  const state = stateWith({
    player: { row: 3, col: 4 },
    boardChanges: [[3, 5, "petalPile"]],
    creatures: [],
  });

  assert.equal(canMoveTo(state, 3, 5), true);
  const moved = movePlayer(state, "right");
  assert.deepEqual({ row: moved.player.row, col: moved.player.col }, { row: 3, col: 5 });
  assert.equal(moved.board[3][5], "petalPile");
});

test("the open corridor lets Mochi travel from C3 to B4 around the spirit and tree", () => {
  let state = stateWith({
    player: { row: 2, col: 2 },
    creatures: [creature({ id: "spirit-one", row: 1, col: 2 })],
  });
  const route = ["down", "right", "right", "up", "up", "left"];

  route.forEach((direction) => {
    state = {
      ...state,
      player: { ...state.player, actionPoints: 1 },
    };
    state = movePlayer(state, direction);
  });

  assert.deepEqual(
    { row: state.player.row, col: state.player.col },
    { row: 1, col: 3 },
    "Mochi should reach B4 without entering B3 or C4",
  );
});

test("Meow reveals adjacent hidden petals", () => {
  const state = stateWith({
    player: { row: 1, col: 5 },
    creatures: [creature({ status: "helped" })],
  });
  const meowed = useMeow(state);

  assert.equal(meowed.board[1][6], "petalPile");
  assert.match(meowed.message, /rustles into view/i);
});

test("Meow lights an adjacent stone lantern", () => {
  const state = stateWith({
    player: { row: 5, col: 4 },
    creatures: [],
  });
  const targets = getAdjacentInteractable(state);
  const meowed = useMeow(state);

  assert.ok(targets.some((target) => target.type === "lanternOff"));
  assert.equal(meowed.board[5][5], "lanternOn");
});

test("Meow wakes the tanuki after at least one tree is restored", () => {
  const state = stateWith({
    player: { row: 0, col: 4 },
    restoredTrees: 1,
  });
  const meowed = useMeow(state);
  const tanuki = meowed.creatures.find(({ type }) => type === "sleepyTanuki");

  assert.equal(tanuki.status, "awake");
  assert.equal(isOccupied(meowed, tanuki.row, tanuki.col), false);
});

test("tanuki remains asleep when Meow is used before restoring a tree", () => {
  const state = stateWith({ player: { row: 0, col: 4 }, restoredTrees: 0 });
  const meowed = useMeow(state);
  const tanuki = meowed.creatures.find(({ type }) => type === "sleepyTanuki");

  assert.equal(tanuki.status, "asleep");
  assert.match(meowed.message, /one restored tree/i);
  assert.equal(meowed.player.actionPoints, 1);
});

test("Meow pushes an adjacent crow to a farther open tile", () => {
  const state = stateWith({
    player: { row: 3, col: 3 },
    creatures: [creature({
      id: "crow-test",
      type: "petalCrow",
      row: 3,
      col: 4,
      status: "playful",
    })],
  });
  const meowed = useMeow(state);
  const crow = meowed.creatures[0];

  assert.ok(
    Math.abs(crow.row - state.player.row) + Math.abs(crow.col - state.player.col) > 1,
    "crow should finish farther away from Mochi",
  );
});

test("Meow avoids pushing the crow onto petals when another open tile exists", () => {
  const state = stateWith({
    player: { row: 2, col: 4 },
    boardChanges: [[0, 4, "petalPile"]],
    creatures: [creature({
      id: "crow-test",
      type: "petalCrow",
      row: 1,
      col: 4,
      status: "satisfied",
    })],
  });
  const meowed = useMeow(state);

  assert.deepEqual(
    { row: meowed.creatures[0].row, col: meowed.creatures[0].col },
    { row: 1, col: 3 },
  );
  assert.equal(meowed.board[0][4], "petalPile");
});

test("Meow cannot be used with zero energy", () => {
  const state = stateWith({
    player: { row: 3, col: 3, energy: 0 },
    creatures: [creature({ row: 3, col: 4 })],
  });
  const meowed = useMeow(state);

  assert.equal(canMeow(state), false);
  assert.equal(meowed.creatures[0].status, "shy");
  assert.equal(meowed.player.actionPoints, 2);
  assert.match(meowed.message, /needs a little rest/i);
});

test("Restore requires both an adjacent damaged tree and three petals", () => {
  const noPetals = stateWith({
    player: { row: 1, col: 0, petals: 2 },
    creatures: [creature({ status: "following", following: true })],
  });
  const noTree = stateWith({
    player: { row: 3, col: 3, petals: 3 },
    boardChanges: [[2, 3, "grass"]],
    creatures: [creature({ status: "following", following: true })],
  });

  assert.equal(canRestoreTree(noPetals), false);
  assert.equal(restoreTree(noPetals).restoredTrees, 0);
  assert.equal(restoreTree(noPetals).player.actionPoints, 2);
  assert.equal(canRestoreTree(noTree), false);
  assert.match(restoreTree(noTree).message, /no damaged cherry tree/i);
});

test("Restore stays locked until a spirit has been calmed", () => {
  const state = stateWith({
    player: { row: 1, col: 0, petals: 3 },
    creatures: [],
  });
  const restored = restoreTree(state);

  assert.equal(canRestoreTree(state), false);
  assert.equal(restored.board[0][0], "damagedTree");
  assert.equal(restored.player.petals, 3);
  assert.equal(restored.player.actionPoints, 2);
  assert.match(restored.message, /sakura spirit must feel safe/i);
});

test("Restore changes a tree, spends petals and AP, and increments progress", () => {
  const state = stateWith({
    player: { row: 1, col: 0, petals: 5 },
    creatures: [creature({ status: "following", following: true })],
  });
  const before = deepClone(state);
  const restored = restoreTree(state);

  assert.equal(restored.board[0][0], "restoredTree");
  assert.equal(restored.player.petals, 2);
  assert.equal(restored.player.actionPoints, 1);
  assert.equal(restored.restoredTrees, 1);
  assert.deepEqual(state, before, "restoreTree should not mutate its input");
});

test("a following spirit moves one open step closer during its update", () => {
  const state = stateWith({
    player: { row: 3, col: 3 },
    creatures: [creature({
      id: "follower",
      row: 1,
      col: 3,
      status: "following",
      following: true,
    })],
    boardChanges: [[2, 3, "grass"]],
  });
  const updated = updateFollowingSpirits(state);
  const spirit = updated.creatures[0];

  assert.deepEqual({ row: spirit.row, col: spirit.col }, { row: 2, col: 3 });
});

test("a following spirit beside a restored tree becomes helped exactly once", () => {
  const state = stateWith({
    creatures: [creature({
      id: "homebound",
      row: 1,
      col: 0,
      status: "following",
      following: true,
    })],
    boardChanges: [[0, 0, "restoredTree"]],
  });
  const helped = updateFollowingSpirits(state);
  const helpedAgain = helpSpirit(helped, "homebound");

  assert.equal(helped.creatures[0].status, "helped");
  assert.equal(helped.creatures[0].following, false);
  assert.equal(helped.helpedSpirits, 1);
  assert.equal(helpedAgain.helpedSpirits, 1);
});

test("Mochi can deliver an adjacent follower while beside a restored tree", () => {
  const state = stateWith({
    player: { row: 6, col: 5 },
    creatures: [creature({
      id: "companion",
      row: 5,
      col: 5,
      status: "following",
      following: true,
    })],
    boardChanges: [[6, 6, "restoredTree"]],
  });
  const updated = updateFollowingSpirits(state);

  assert.equal(updated.creatures[0].status, "helped");
  assert.equal(updated.helpedSpirits, 1);
});

test("helpSpirit gives feedback for an unknown creature id", () => {
  const state = createInitialState();
  const result = helpSpirit(state, "missing");

  assert.equal(result.helpedSpirits, 0);
  assert.match(result.message, /could not be found/i);
});

test("crow movement takes one deterministic step toward the nearest petals", () => {
  const state = stateWith({
    player: { row: 6, col: 6 },
    boardChanges: [
      [0, 4, "grass"],
      [1, 6, "grass"],
      [2, 0, "grass"],
      [3, 4, "grass"],
      [5, 4, "grass"],
      [6, 2, "grass"],
      [2, 3, "grass"],
      [2, 4, "petalPile"],
    ],
    creatures: [creature({
      id: "crow-only",
      type: "petalCrow",
      row: 2,
      col: 2,
      status: "playful",
    }), creature({
      id: "petal-guide",
      status: "helped",
    })],
  });
  const moved = moveCrow(state);

  assert.deepEqual(
    { row: moved.creatures[0].row, col: moved.creatures[0].col },
    { row: 2, col: 3 },
  );
});

test("the crow waits until a spirit unlocks the petal piles", () => {
  const state = stateWith({
    player: { row: 6, col: 6 },
    creatures: [creature({
      id: "crow-only",
      type: "petalCrow",
      row: 2,
      col: 2,
      status: "playful",
    })],
  });
  const moved = moveCrow(state);

  assert.deepEqual(
    { row: moved.creatures[0].row, col: moved.creatures[0].col },
    { row: 2, col: 2 },
  );
  assert.deepEqual(moved.board, state.board);
});

test("crow removes a petal pile when it reaches the pile", () => {
  const state = stateWith({
    player: { row: 6, col: 6 },
    boardChanges: [
      [0, 4, "grass"],
      [1, 6, "grass"],
      [3, 4, "grass"],
      [6, 2, "grass"],
      [2, 3, "petalPile"],
    ],
    creatures: [creature({
      id: "crow-only",
      type: "petalCrow",
      row: 2,
      col: 2,
      status: "playful",
    }), creature({
      id: "petal-guide",
      status: "helped",
    })],
  });
  const moved = moveCrow(state);

  assert.deepEqual(
    { row: moved.creatures[0].row, col: moved.creatures[0].col },
    { row: 2, col: 3 },
  );
  assert.equal(moved.board[2][3], "grass");
  assert.equal(moved.creatures[0].status, "satisfied");
  assert.match(moved.message, /tucks away/i);
});

test("a satisfied crow stops collecting additional petal piles", () => {
  const state = stateWith({
    player: { row: 6, col: 6 },
    boardChanges: [[2, 3, "petalPile"]],
    creatures: [creature({
      id: "crow-only",
      type: "petalCrow",
      row: 2,
      col: 2,
      status: "satisfied",
    }), creature({
      id: "petal-guide",
      status: "helped",
    })],
  });
  const moved = moveCrow(state);

  assert.deepEqual(
    { row: moved.creatures[0].row, col: moved.creatures[0].col },
    { row: 2, col: 2 },
  );
  assert.equal(moved.board[2][3], "petalPile");
});

test("enough visible petals remain after the crow takes one pile", () => {
  let state = createInitialState();
  state = {
    ...state,
    creatures: state.creatures.map((currentCreature) => (
      currentCreature.id === "spirit-one"
        ? { ...currentCreature, status: "following", following: true }
        : currentCreature
    )),
  };

  for (let move = 0; move < 10; move += 1) {
    state = moveCrow(state);
    if (state.creatures.find(({ type }) => type === "petalCrow").status === "satisfied") {
      break;
    }
  }

  const visiblePiles = state.board.flat().filter((tile) => tile === "petalPile").length;
  assert.equal(
    state.creatures.find(({ type }) => type === "petalCrow").status,
    "satisfied",
    "the crow should take exactly one reachable pile",
  );
  assert.ok(
    visiblePiles * 3 >= state.totalTrees * 3,
    "at least nine visible petals should remain for all three trees",
  );
});

test("Rest restores up to two energy and spends one action point", () => {
  const state = stateWith({ player: { energy: 5 } });
  const rested = rest(state);

  assert.equal(rested.player.energy, 7);
  assert.equal(rested.player.actionPoints, 1);
  assert.match(rested.message, /curls up/i);
});

test("actions stop at zero action points until the player ends the turn", () => {
  const state = stateWith({
    player: { row: 3, col: 3, actionPoints: 1 },
    creatures: [],
  });
  const firstMove = movePlayer(state, "right");
  const blockedMove = movePlayer(firstMove, "left");

  assert.equal(firstMove.player.actionPoints, 0);
  assert.equal(blockedMove.player.col, firstMove.player.col);
  assert.equal(blockedMove.player.actionPoints, 0);
  assert.match(blockedMove.message, /no action points/i);
});

test("ending a turn resolves the garden, increments round, and resets AP", () => {
  const state = stateWith({
    player: { actionPoints: 0 },
    creatures: [],
  });
  const ended = endPlayerTurn(state);

  assert.equal(ended.turn, "player");
  assert.equal(ended.round, 2);
  assert.equal(ended.player.actionPoints, 2);
  assert.match(ended.message, /turn 2/i);
});

test("runGardenTurn refuses to run during the player phase", () => {
  const state = createInitialState();
  const result = runGardenTurn(state);

  assert.equal(result.round, 1);
  assert.match(result.message, /waits until/i);
});

test("completion requires every objective and Mochi standing at the shrine", () => {
  const incomplete = stateWith({
    player: { row: 4, col: 3 },
    restoredTrees: 3,
    helpedSpirits: 1,
  });
  const complete = stateWith({
    player: { row: 4, col: 3 },
    restoredTrees: 3,
    helpedSpirits: 2,
    round: 12,
  });

  assert.equal(checkCompletion(incomplete).status, "playing");
  assert.equal(checkCompletion(complete).status, "completed");
  assert.equal(checkCompletion(complete).starRating, 3);
});

test("moving onto the shrine completes a fully restored garden", () => {
  const state = stateWith({
    player: { row: 4, col: 2 },
    restoredTrees: 3,
    helpedSpirits: 2,
    creatures: [],
  });
  const moved = movePlayer(state, "right");

  assert.equal(moved.status, "completed");
  assert.equal(moved.starRating, 3);
  assert.match(moved.message, /garden is restored/i);
});

test("star ratings use the 16-turn and 24-turn thresholds", () => {
  assert.equal(calculateStarRating(stateWith({ round: 16 })), 3);
  assert.equal(calculateStarRating(stateWith({ round: 17 })), 2);
  assert.equal(calculateStarRating(stateWith({ round: 24 })), 2);
  assert.equal(calculateStarRating(stateWith({ round: 25 })), 1);
});

test("all player actions and End Turn are blocked after completion", () => {
  const completed = checkCompletion(stateWith({
    player: { row: 4, col: 3, energy: 4, petals: 3 },
    restoredTrees: 3,
    helpedSpirits: 2,
    creatures: [],
  }));
  const gameplaySnapshot = (state) => ({
    board: state.board,
    player: state.player,
    creatures: state.creatures,
    round: state.round,
    status: state.status,
    restoredTrees: state.restoredTrees,
    helpedSpirits: state.helpedSpirits,
  });

  [
    movePlayer(completed, "left"),
    useMeow(completed),
    restoreTree(completed),
    rest(completed),
    endPlayerTurn(completed),
  ].forEach((result) => {
    assert.deepEqual(gameplaySnapshot(result), gameplaySnapshot(completed));
    assert.equal(result.status, "completed");
  });
});

test("the fixed map has a strict successful ordered route from its real initial state", () => {
  let state = createInitialState();
  const directions = {
    U: "up",
    R: "right",
    D: "down",
    L: "left",
  };
  const actions = {
    U: (currentState) => movePlayer(currentState, directions.U),
    R: (currentState) => movePlayer(currentState, directions.R),
    D: (currentState) => movePlayer(currentState, directions.D),
    L: (currentState) => movePlayer(currentState, directions.L),
    M: useMeow,
    T: restoreTree,
    Z: rest,
  };
  const turns = [
    ["R", "R"],
    ["U", "R"],
    ["R", "M"],
    ["R", "R"],
    ["M", "L"],
    ["L", "R"],
    ["R", "T"],
    ["U", "L"],
    ["R", "U"],
    ["U", "U"],
    ["L", "L"],
    ["L", "M"],
    ["M", "U"],
    ["R", "L"],
    ["R", "D"],
    ["D", "T"],
    ["U", "L"],
    ["L", "D"],
    ["L", "L"],
    ["U", "T"],
    ["D", "D"],
    ["R", "R"],
    ["R", "D"],
  ];

  turns.forEach((turnActions, turnIndex) => {
    turnActions.forEach((actionName) => {
      const actionPointsBefore = state.player.actionPoints;
      state = actions[actionName](state);
      assert.equal(
        state.player.actionPoints,
        actionPointsBefore - 1,
        `turn ${turnIndex + 1} action ${actionName} should succeed and spend one AP`,
      );
    });

    if (state.status !== "completed") {
      const roundBefore = state.round;
      state = endPlayerTurn(state);
      assert.equal(state.round, roundBefore + 1, "ending the turn should advance the route");
      assert.equal(state.player.actionPoints, 2, "the next route turn should start with two AP");
    }
  });

  assert.equal(state.status, "completed");
  assert.equal(state.restoredTrees, 3);
  assert.equal(state.helpedSpirits, 2);
  assert.equal(state.board[0][3], "lanternOn", "the upper spirit lantern should be lit");
  assert.equal(state.board[5][5], "lanternOn", "the lower spirit lantern should be lit");
  assert.equal(state.round, 23);
  assert.equal(state.starRating, 2);
  assert.deepEqual({ row: state.player.row, col: state.player.col }, { row: 4, col: 3 });
});
