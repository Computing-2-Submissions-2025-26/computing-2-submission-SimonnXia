# Mochi's Sakura Garden Unit Test Specification

The tests describe observable game behaviour. They do not depend on private
helper functions or reproduce the implementation.

## 1. Initial state

**Given** a new game
**When** the initial state is created
**Then** the board is 7 x 7, Mochi starts with 8 energy and 2 action points,
three trees and two spirits are required, and the game is in the player turn.
The fixed map places damaged trees at A1, C4, and G7, a blossom tree at A7,
spirits at B3 and E7, the tanuki at A6, and the crow at C7. Connected route
tiles at C1, D1, D5, F3, and F5 keep every objective reachable. The extra
petal pile is at D6 rather than D5 so the C3-to-B4 corridor stays visibly open.

## 2. Valid movement

**Given** Mochi has an action point and a walkable adjacent tile
**When** Mochi walks onto that tile
**Then** Mochi changes position and spends one action point.

## 3. Invalid movement

**Given** a playing state
**When** an unsupported direction is supplied
**Then** Mochi stays in place, spends no action point, and receives feedback.

## 4. Moving outside the board

**Given** Mochi is at the board edge
**When** Mochi attempts to walk beyond the edge
**Then** Mochi stays inside the board and spends no action point.

## 5. Pond and rock blocking

**Given** a pond or rock is adjacent to Mochi
**When** Mochi tries to enter it
**Then** movement is blocked and no action point is spent.

**Given** the shrine is adjacent but any tree or spirit objective is incomplete
**When** Mochi tries to enter the shrine tile
**Then** Mochi stays in place, spends no action point, and receives a clear
message describing the remaining objectives.

**Given** all trees and spirits are complete
**When** Mochi enters the shrine tile
**Then** the shrine allows entry and the game completes.

## 6. Occupied creature blocking

**Given** a shy spirit, sleeping tanuki, or crow occupies an adjacent tile
**When** Mochi tries to enter that tile
**Then** movement is blocked.

## 7. Petal collection

**Given** at least one spirit has been calmed and a visible petal pile is on a
walkable destination
**When** Mochi walks onto it
**Then** three petals are added and the tile becomes grass.

**Given** no spirit has been calmed
**When** Mochi walks onto a visible petal pile
**Then** movement spends one action point, but the pile remains and no petals
are added.

**Given** a locked petal pile is adjacent
**When** movement availability is checked
**Then** the tile remains walkable and is not treated as blocking terrain.

**Given** Mochi is at C3 while the B3 spirit and C4 tree block the direct steps
**When** Mochi follows D3, D4, D5, C5, B5, and B4
**Then** Mochi reaches the A4 lantern interaction position without crossing a
creature, tree, or petal pile.

## 8. Tea collection

**Given** Mochi has missing energy and tea is on the destination
**When** Mochi walks onto the tea
**Then** energy is restored up to the maximum and the tile becomes grass.

## 9. Fish snack collection

**Given** Mochi has missing energy and a fish snack is on the destination
**When** Mochi walks onto the snack
**Then** two energy is restored up to the maximum and the tile becomes grass.

## 10. Meow calming spirit

**Given** a shy sakura spirit is adjacent, its nearby lantern is lit, and Mochi
has energy
**When** Meow is used
**Then** the spirit becomes a follower, one energy is spent, and one action
point is spent.

**Given** a shy spirit is adjacent but its nearby lantern is still off
**When** Meow is used
**Then** the spirit stays shy, no energy or action point is spent, and the
message directs Mochi to the lantern.

## 11. Meow revealing hidden petals

**Given** hidden petals are adjacent and a spirit has been calmed
**When** Meow is used
**Then** the hidden tile becomes a visible petal pile.

## 12. Meow waking tanuki

**Given** the sleeping tanuki is adjacent and at least one tree is restored
**When** Meow is used
**Then** the tanuki wakes and no longer blocks movement.

## 13. Tanuki remaining asleep before requirement is met

**Given** the sleeping tanuki is adjacent and no tree is restored
**When** Meow is used
**Then** the tanuki remains asleep and the message explains the requirement.

## 14. Restore tree requirements

**Given** a spirit has been calmed, but Mochi lacks three petals or has no
adjacent damaged tree
**When** Restore is attempted
**Then** no tree changes, no petals are spent, and no action point is spent.

**Given** Mochi has three petals and an adjacent damaged tree but no spirit has
been calmed
**When** Restore is attempted
**Then** restoration remains locked, resources are unchanged, and the message
explains the required quest order.

## 15. Tree restoration

**Given** a spirit has been calmed and Mochi has three petals while standing
beside a damaged tree
**When** Restore is used
**Then** the tree becomes restored, three petals and one action point are spent,
and the restored-tree count increases.

## 16. Spirit following

**Given** a calmed spirit is following Mochi
**When** the garden turn runs
**Then** the spirit moves at most one open orthogonal tile closer to Mochi.

## 17. Spirit becoming helped

**Given** a following spirit is adjacent to a restored tree
**When** spirit following is updated
**Then** the spirit becomes helped, stops following, and the helped count
increases exactly once.

**Given** Mochi and a following spirit are adjacent, and Mochi is beside a
restored tree
**When** spirit following is updated
**Then** the spirit is delivered to that tree without another permanent action.

## 18. Crow movement

**Given** a spirit has unlocked petals, and a crow has at least one reachable
visible petal pile
**When** the crow moves
**Then** it moves one open orthogonal tile toward the nearest pile using
deterministic tie-breaking.

**Given** no spirit has been calmed
**When** the garden attempts to move the crow
**Then** the crow waits and leaves every petal pile unchanged.

## 19. Crow collecting a petal pile

**Given** a visible petal pile is one step from the crow
**When** the crow moves onto it
**Then** the crow changes position and the pile becomes grass.

**Given** the crow has already collected one petal pile
**When** later garden turns run
**Then** the satisfied crow stays in place and leaves remaining petals for
Mochi, ensuring the garden remains completable.

## 20. Rest restoring energy

**Given** Mochi has missing energy and an action point
**When** Rest is used
**Then** up to two energy is restored and one action point is spent.

## 21. Action point spending

**Given** Mochi has one action point
**When** a valid action is used
**Then** the action point reaches zero and further actions are blocked until the
turn ends.

## 22. End turn behaviour

**Given** it is the player turn
**When** the player ends the turn
**Then** garden behaviour resolves, the round increases, control returns to the
player, and action points reset to two.

## 23. Completion condition

**Given** all three trees are restored and both spirits are helped
**When** Mochi reaches the shrine
**Then** the game becomes completed and a star rating is stored.

**Given** any objective is incomplete
**When** Mochi reaches the shrine
**Then** the game remains in progress.

## 24. Star rating

**Given** completion occurs by turn 16, by turn 24, or later
**When** the rating is calculated
**Then** the result is respectively three, two, or one star.

## 25. Actions blocked after completion

**Given** the game is completed
**When** Walk, Meow, Restore, Rest, or End Turn is attempted
**Then** gameplay values do not change and completion is preserved.

## Additional quality checks

- Reset returns independent board, player, and creature objects.
- Game actions do not mutate their input state.
- Lanterns change from off to on through contextual Meow.
- Each spirit requires its paired nearby lantern before it can be calmed.
- Petal collection and tree restoration remain locked until a spirit is
  calmed.
- Meow pushes the crow away when a valid open tile exists.
- Meow prefers not to push the crow onto a petal pile.
- After the crow collects one pile, at least nine visible petals remain, so all
  three trees can still be restored without finding the optional hidden pile.
- Invalid garden-turn calls provide feedback without resolving behaviour.
- A strict ordered action sequence from the real initial state lights both
  lanterns, calms and helps both spirits, restores all three trees, and reaches
  the shrine on turn 23 for two stars. Every action is also checked to spend
  AP, so a blocked step cannot silently pass.

## Intentional fault checks

For each main behaviour group, one rule was temporarily changed to an incorrect
version. The related test failed, showing that it could detect the fault. The
correct rule was then restored and the same test passed.
