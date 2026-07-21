import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseObstacle,
  formatScore,
  isDownwardDuckGesture,
  isTapGesture,
  makeSeededRandom,
  OBSTACLE_SIZES,
  obstacleCollisionBox,
  PIGEON_FLIGHT_GAPS,
  pigeonFrameForTime,
  playerCollisionBox,
  rectanglesIntersect,
  spacingForSpeed,
  speedForScore,
} from "../app/game/rules.mjs";

test("formats scores as five digits and rolls over", () => {
  assert.equal(formatScore(42.9), "00042");
  assert.equal(formatScore(99999), "99999");
  assert.equal(formatScore(100000), "00000");
});

test("speed increases every hundred points and stays capped", () => {
  assert.equal(speedForScore(0), 360);
  assert.equal(speedForScore(99), 360);
  assert.equal(speedForScore(100), 375);
  assert.equal(speedForScore(2800), 780);
  assert.equal(speedForScore(99999), 780);
});

test("pigeons add variety from the start while dumpsters unlock at 400", () => {
  assert.equal(chooseObstacle(0, 0.79), "trash");
  assert.equal(chooseObstacle(0, 0.81), "pigeon");
  assert.equal(chooseObstacle(400, 0.7), "dumpster");
  assert.equal(chooseObstacle(700, 0.9), "pigeon");
});

test("pigeons visibly flap through each wing pose", () => {
  assert.deepEqual(
    [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75].map((time) => pigeonFrameForTime(time)),
    [0, 3, 1, 3, 2, 3, 0],
  );
});

test("every pigeon height requires standing Jimothy to duck", () => {
  const standing = playerCollisionBox({
    x: 128,
    y: 114,
    width: 58,
    height: 43,
    ducking: false,
    groundY: 157,
    duckHeight: 27,
  });
  const ducking = playerCollisionBox({
    x: 128,
    y: 114,
    width: 58,
    height: 43,
    ducking: true,
    groundY: 157,
    duckHeight: 27,
  });

  for (const groundGap of PIGEON_FLIGHT_GAPS) {
    const pigeon = obstacleCollisionBox({
      kind: "pigeon",
      x: 128,
      y: 157 - groundGap - OBSTACLE_SIZES.pigeon.h,
      ...OBSTACLE_SIZES.pigeon,
    });
    assert.equal(rectanglesIntersect(standing, pigeon), true);
    assert.equal(rectanglesIntersect(ducking, pigeon), false);
  }
});

test("seeded runs and spacing are reproducible and fair", () => {
  const first = makeSeededRandom(1234);
  const second = makeSeededRandom(1234);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  assert.ok(spacingForSpeed(360, 0) >= 340);
  assert.ok(spacingForSpeed(780, 1) >= 670);
});

test("a jumping player carries its collision box above a ground obstacle", () => {
  const player = playerCollisionBox({
    x: 128,
    y: 65,
    width: 58,
    height: 43,
    ducking: false,
    groundY: 157,
    duckHeight: 27,
  });
  const trash = obstacleCollisionBox({ kind: "trash", x: 142, y: 119, w: 30, h: 38 });

  assert.ok(player.y + player.h < trash.y);
  assert.equal(rectanglesIntersect(player, trash), false);
});

test("the same player collides with the trash can when grounded", () => {
  const player = playerCollisionBox({
    x: 128,
    y: 114,
    width: 58,
    height: 43,
    ducking: false,
    groundY: 157,
    duckHeight: 27,
  });
  const trash = obstacleCollisionBox({ kind: "trash", x: 142, y: 119, w: 30, h: 38 });

  assert.equal(rectanglesIntersect(player, trash), true);
});

test("Jimothy can physically clear the resized dumpster at jump apex", () => {
  const player = playerCollisionBox({
    x: 128,
    y: 60,
    width: 58,
    height: 43,
    ducking: false,
    groundY: 157,
    duckHeight: 27,
  });
  const dumpster = obstacleCollisionBox({
    kind: "dumpster",
    x: 142,
    y: 157 - OBSTACLE_SIZES.dumpster.h,
    ...OBSTACLE_SIZES.dumpster,
  });

  assert.ok(player.y + player.h < dumpster.y);
  assert.equal(rectanglesIntersect(player, dumpster), false);
});

test("mobile gestures distinguish taps from downward hold gestures", () => {
  assert.equal(isTapGesture(100, 100, 106, 106, 180), true);
  assert.equal(isTapGesture(100, 100, 106, 106, 500), false);
  assert.equal(isTapGesture(100, 100, 100, 119, 180), false);
  assert.equal(isDownwardDuckGesture(100, 100, 105, 119), true);
  assert.equal(isDownwardDuckGesture(100, 100, 125, 108), false);
  assert.equal(isDownwardDuckGesture(100, 100, 100, 82), false);
});
