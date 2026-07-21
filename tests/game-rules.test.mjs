import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseObstacle,
  formatScore,
  makeSeededRandom,
  OBSTACLE_SIZES,
  obstacleCollisionBox,
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
