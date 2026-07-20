import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseObstacle,
  formatScore,
  makeSeededRandom,
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

test("obstacles unlock at the requested score thresholds", () => {
  assert.equal(chooseObstacle(399, 0.99), "trash");
  assert.equal(chooseObstacle(400, 0.75), "dumpster");
  assert.equal(chooseObstacle(700, 0.9), "pigeon");
});

test("seeded runs and spacing are reproducible and fair", () => {
  const first = makeSeededRandom(1234);
  const second = makeSeededRandom(1234);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  assert.ok(spacingForSpeed(360, 0) >= 340);
  assert.ok(spacingForSpeed(780, 1) >= 670);
});
