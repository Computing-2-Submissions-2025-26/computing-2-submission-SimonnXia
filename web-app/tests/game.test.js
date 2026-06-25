import test from "node:test";
import assert from "node:assert/strict";

import {
  awakenTree,
  canMoveTo,
  checkBossDefeat,
  checkForestCompletion,
  createInitialState,
  createSealedLandState,
  destroyObelisk,
  endTurn,
  enterShrineGate,
  freeSpirit,
  getAdjacentObjects,
  isInsideBoard,
  movePlayer,
  resetGame,
  resolveBossTurn,
  selectBossTarget,
  startGame,
  transitionToEnding,
  useMeow,
} from "../game.js";

const deepClone = (value) => structuredClone(value);
const assertPosition = (actual, expected, message = "position should match") => {
  assert.equal(actual.row, expected.row, `${message}: row`);
  assert.equal(actual.col, expected.col, `${message}: column`);
};

const forest = (overrides = {}) => {
  const base = startGame(createInitialState());
  return {
    ...base,
    ...overrides,
    player: { ...base.player, ...(overrides.player ?? {}) },
    shrineGate: { ...base.shrineGate, ...(overrides.shrineGate ?? {}) },
    trees: overrides.trees ?? base.trees.map((tree) => ({ ...tree })),
  };
};

const sealed = (overrides = {}) => {
  const base = createSealedLandState();
  return {
    ...base,
    ...overrides,
    player: { ...base.player, ...(overrides.player ?? {}) },
    boss: { ...base.boss, ...(overrides.boss ?? {}) },
  };
};

test("the game opens on the intro screen", () => {
  const state = createInitialState();

  assert.equal(state.phase, "intro");
  assert.equal(state.status, "playing");
  assert.equal(state.turn, 0);
  assert.equal(resetGame().phase, "intro");
  assert.equal(isInsideBoard(0, 0), true);
  assert.equal(isInsideBoard(7, 0), false);
});

test("starting the game enters the forest with three dormant trees", () => {
  const state = startGame(createInitialState());

  assert.equal(state.phase, "forest");
  assert.equal(state.turn, 1);
  assertPosition(state.player, { row: 6, col: 0 }, "Mochi starts at G1");
  assert.equal(state.player.stamina, state.player.maxStamina, "Mochi starts with full stamina");
  assert.equal(state.trees.length, 3);
  assert.equal(state.fishCookies.length, 4, "forest contains planned fish cookie refills");
  assert.ok(state.trees.every((tree) => !tree.awakened && !tree.spiritFreed));
  assert.equal(state.shrineGate.open, false);
  assert.equal(state.rescuedSpirits, 0);
});

test("Move walks up to two tiles in one turn without mutating input", () => {
  const state = forest();
  const before = deepClone(state);
  const moved = movePlayer(state, ["up", "up"]);

  assertPosition(moved.player, { row: 4, col: 0 });
  assert.equal(moved.turn, 2, "a move spends exactly one turn");
  assert.equal(moved.player.stamina, state.player.stamina - 1, "moving spends one stamina");
  assert.deepEqual(state, before, "movePlayer must not mutate its input");
});

test("Move cannot pass through or stop on a blocked obstacle", () => {
  const intoBush = movePlayer(forest({ player: { row: 5, col: 0 } }), "right");
  assertPosition(intoBush.player, { row: 5, col: 0 }, "the bush at F2 blocks entry");
  assert.equal(intoBush.turn, 1, "a blocked move spends no turn");

  const through = movePlayer(forest({ player: { row: 4, col: 0 } }), ["down", "right"]);
  assertPosition(through.player, { row: 4, col: 0 }, "Mochi cannot pass through the bush");
});

test("fish cookies restore stamina and are collected once", () => {
  const tired = forest({ player: { row: 6, col: 1, stamina: 1 } });
  const refilled = movePlayer(tired, "right");

  assertPosition(refilled.player, { row: 6, col: 2 }, "Mochi reaches the fish cookie");
  assert.equal(refilled.player.stamina, refilled.player.maxStamina, "fish cookie refills stamina");
  assert.equal(
    refilled.fishCookies.find((fish) => fish.id === "fish-forest-1").collected,
    true,
    "collected fish cookie is marked used",
  );
});

test("Mochi cannot move or Meow with no stamina", () => {
  const exhaustedMove = movePlayer(forest({ player: { stamina: 0 } }), "up");
  assertPosition(exhaustedMove.player, { row: 6, col: 0 }, "exhausted Mochi cannot move");
  assert.equal(exhaustedMove.turn, 1, "failed exhausted move spends no turn");

  const exhaustedMeow = useMeow(forest({ player: { row: 1, col: 0, stamina: 0 } }));
  assert.equal(exhaustedMeow.rescuedSpirits, 0, "exhausted Mochi cannot wake a tree");
  assert.equal(exhaustedMeow.turn, 1, "failed exhausted Meow spends no turn");
});

test("Meow beside a dormant tree awakens it and frees its spirit", () => {
  const state = forest({ player: { row: 1, col: 0 } });
  assert.deepEqual(getAdjacentObjects(state), [{ kind: "tree", id: "tree-1", row: 1, col: 1 }]);

  const meowed = useMeow(state);
  const tree = meowed.trees.find((candidate) => candidate.id === "tree-1");

  assert.equal(tree.awakened, true);
  assert.equal(tree.spiritFreed, true);
  assert.equal(meowed.rescuedSpirits, 1);
  assert.equal(meowed.turn, 2);
});

test("awakenTree and freeSpirit count each spirit exactly once", () => {
  const awakened = awakenTree(forest(), "tree-2");
  const freedOnce = freeSpirit(awakened, "tree-2");
  const freedTwice = freeSpirit(freedOnce, "tree-2");

  assert.equal(freedOnce.rescuedSpirits, 1);
  assert.equal(freedTwice.rescuedSpirits, 1, "a freed spirit is not counted again");
});

test("the shrine gate stays closed until all three spirits are freed", () => {
  const oneFreed = useMeow(forest({ player: { row: 1, col: 0 } }));
  assert.equal(oneFreed.rescuedSpirits, 1);
  assert.equal(oneFreed.shrineGate.open, false);
  assert.equal(checkForestCompletion(oneFreed).shrineGate.open, false);
});

test("freeing the third spirit opens the central shrine gate", () => {
  const twoAlreadyFreed = forest({
    player: { row: 4, col: 3 },
    rescuedSpirits: 2,
    trees: [
      { id: "tree-1", row: 1, col: 1, awakened: true, spiritFreed: true },
      { id: "tree-2", row: 1, col: 5, awakened: true, spiritFreed: true },
      { id: "tree-3", row: 5, col: 3, awakened: false, spiritFreed: false },
    ],
  });

  const finalMeow = useMeow(twoAlreadyFreed);
  assert.equal(finalMeow.rescuedSpirits, 3);
  assert.equal(finalMeow.shrineGate.open, true);
});

test("entering the open shrine gate transitions to the Sealed Land", () => {
  const ready = forest({ player: { row: 2, col: 3 }, shrineGate: { open: true } });
  const transported = movePlayer(ready, "down");

  assert.equal(transported.phase, "sealedLand");
  assert.equal(transported.status, "playing");
  assertPosition(transported.player, { row: 8, col: 4 });
  assert.equal(transported.obelisks.length, 4);
});

test("a closed gate cannot be entered", () => {
  const blocked = movePlayer(forest({ player: { row: 2, col: 3 } }), "down");
  assert.equal(blocked.phase, "forest");
  assertPosition(blocked.player, { row: 2, col: 3 });
  assert.equal(enterShrineGate(forest()).phase, "forest");
});

test("the Sealed Land is an open arena Mochi can cross", () => {
  const state = createSealedLandState();
  assert.equal(state.phase, "sealedLand");
  assertPosition(state.player, { row: 8, col: 4 });
  assert.equal(state.boss.alive, true);
  assert.equal(canMoveTo(state, 6, 4), true);

  const moved = movePlayer(state, ["up", "up"]);
  assertPosition(moved.player, { row: 6, col: 4 });
  assert.equal(moved.turn, 2);
});

test("the Sealed Land includes extra fish cookies and tombstone hazards", () => {
  const state = createSealedLandState();

  assert.equal(state.fishCookies.length, 8, "sealed map has generous stamina refills");
  assert.equal(state.tombstones.length, 10, "sealed map has more tombstone hazards");
  assert.ok(
    state.fishCookies.some((fish) => fish.row === 8 && fish.col === 2),
    "bottom-left route refill remains available",
  );
  assert.ok(
    state.fishCookies.some((fish) => fish.row === 2 && fish.col === 7),
    "top-right route refill remains available",
  );
  assert.ok(
    state.tombstones.some((tombstone) => tombstone.row === 6 && tombstone.col === 4),
    "central lower tombstone creates a visible hazard",
  );
});

test("Meowing beside an obelisk destroys it and silences the boss for five turns", () => {
  const direct = destroyObelisk(sealed({ boss: { silencedTurns: 0 } }), "obelisk-3");
  assert.equal(direct.obelisks.find((o) => o.id === "obelisk-3").destroyed, true);
  assert.equal(direct.destroyedObelisks, 1);
  assert.equal(direct.boss.silencedTurns, 5);

  const viaMeow = useMeow(sealed({ player: { row: 8, col: 1 } }));
  assert.equal(viaMeow.destroyedObelisks, 1, "Meow beside obelisk-3 at I1 breaks it");
});

test("the boss targets the tile Mochi stands on when it is awake", () => {
  const awake = sealed({ player: { row: 2, col: 2 }, boss: { silencedTurns: 0, targetedTile: null } });
  const targeted = selectBossTarget(awake);
  assertPosition(targeted.boss.targetedTile, { row: 2, col: 2 });

  const silenced = selectBossTarget(sealed({ boss: { silencedTurns: 3 } }));
  assert.equal(silenced.boss.targetedTile, null, "a silenced boss marks no tile");
});

test("staying on the targeted tile at turn end is fatal", () => {
  const doomed = sealed({
    player: { row: 3, col: 3 },
    boss: { silencedTurns: 0, targetedTile: { row: 3, col: 3 } },
  });
  const resolved = endTurn(doomed);
  assert.equal(resolved.status, "lost");
});

test("escaping the targeted tile turns it to void instead", () => {
  const escaped = sealed({
    player: { row: 5, col: 3 },
    boss: { silencedTurns: 0, targetedTile: { row: 6, col: 3 } },
  });
  const resolved = resolveBossTurn(escaped);

  assert.equal(resolved.status, "playing");
  assert.ok(resolved.destroyedTiles.some((tile) => tile.row === 6 && tile.col === 3));
  assert.equal(resolved.boss.targetedTile.row, 5, "the boss then marks Mochi's new tile");
});

test("void tiles cannot be stepped on", () => {
  const state = sealed({
    player: { row: 4, col: 3 },
    boss: { silencedTurns: 5 },
    destroyedTiles: [{ row: 5, col: 3 }],
  });
  assert.equal(canMoveTo(state, 5, 3), false);

  const blocked = movePlayer(state, "down");
  assertPosition(blocked.player, { row: 4, col: 3 }, "Mochi cannot walk onto the void");
});

test("stepping on a tombstone forces one recovery turn", () => {
  const cursed = movePlayer(sealed({ player: { row: 3, col: 2 } }), "right");

  assertPosition(cursed.player, { row: 3, col: 3 }, "Mochi can step onto a tombstone");
  assert.equal(cursed.player.stunnedTurns, 1, "tombstone marks Mochi as recovering");

  const blockedAction = movePlayer(cursed, "right");
  assertPosition(blockedAction.player, { row: 3, col: 3 }, "stunned Mochi cannot move");
  assert.equal(blockedAction.turn, cursed.turn, "blocked stunned action spends no turn");

  const recovered = endTurn(cursed);
  assert.equal(recovered.player.stunnedTurns, 0, "ending the turn clears the tombstone effect");
});

test("destroying the fourth obelisk defeats the boss and reaches the ending", () => {
  const onLastObelisk = sealed({
    player: { row: 8, col: 7 },
    boss: { silencedTurns: 5 },
    destroyedObelisks: 3,
    obelisks: [
      { id: "obelisk-1", row: 0, col: 0, destroyed: true },
      { id: "obelisk-2", row: 0, col: 8, destroyed: true },
      { id: "obelisk-3", row: 8, col: 0, destroyed: true },
      { id: "obelisk-4", row: 8, col: 8, destroyed: false },
    ],
  });
  const finished = useMeow(onLastObelisk);

  assert.equal(finished.status, "won");
  assert.equal(finished.phase, "ending");
});

test("checkBossDefeat and transitionToEnding finish the rescue", () => {
  const allBroken = checkBossDefeat(sealed({
    destroyedObelisks: 4,
    obelisks: [
      { id: "obelisk-1", row: 0, col: 0, destroyed: true },
      { id: "obelisk-2", row: 0, col: 8, destroyed: true },
      { id: "obelisk-3", row: 8, col: 0, destroyed: true },
      { id: "obelisk-4", row: 8, col: 8, destroyed: true },
    ],
  }));
  assert.equal(allBroken.status, "won");
  assert.equal(allBroken.boss.alive, false);
  assert.equal(transitionToEnding(allBroken).phase, "ending");
});

test("a full play route can complete the game from intro to ending", () => {
  let state = startGame(createInitialState());

  const take = (action) => {
    state = action === "meow" ? useMeow(state) : movePlayer(state, action);
    assert.notEqual(state.status, "lost", `route should not lose after ${JSON.stringify(action)}`);
  };

  [
    ["right", "right"],
    "up",
    "meow",
    ["up", "up"],
    ["up", "up"],
    ["up", "left"],
    "meow",
    ["right", "right"],
    ["right", "right"],
    "meow",
    "right",
    ["down", "down"],
    ["left", "left"],
    "left",
    "down",
  ].forEach(take);

  assert.equal(state.phase, "sealedLand", "the forest route should enter the Sealed Land");

  [
    ["left", "left"],
    "left",
    "meow",
    ["right", "right"],
    ["right", "right"],
    ["right", "right"],
    "meow",
    ["up", "up"],
    ["up", "up"],
    ["up", "up"],
    ["up", "up"],
    "meow",
    "down",
    ["left", "left"],
    ["left", "left"],
    ["left", "left"],
    "left",
    "meow",
  ].forEach(take);

  assert.equal(state.status, "won");
  assert.equal(state.phase, "ending");
  assert.equal(state.destroyedObelisks, 4);
});
