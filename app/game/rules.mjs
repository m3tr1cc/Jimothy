export const INITIAL_SPEED = 360;
export const MAX_SPEED = 780;
export const TOUCH_DUCK_DISTANCE = 18;
export const TOUCH_TAP_DISTANCE = 12;
export const TOUCH_TAP_MAX_DURATION = 350;
export const PIGEON_FLAP_FPS = 12;
export const PIGEON_FLIGHT_GAPS = Object.freeze([18, 21, 24]);
export const OBSTACLE_SIZES = Object.freeze({
  trash: { w: 30, h: 38 },
  dumpster: { w: 68, h: 46 },
  pigeon: { w: 48, h: 33 },
});

export function formatScore(value) {
  const normalized = Math.max(0, Math.floor(value)) % 100000;
  return normalized.toString().padStart(5, "0");
}

export function speedForScore(score) {
  const increase = Math.floor(Math.max(0, score) / 100) * 15;
  return Math.min(MAX_SPEED, INITIAL_SPEED + increase);
}

export function obstacleWeights(score) {
  if (score < 400) return { trash: 0.8, dumpster: 0, pigeon: 0.2 };
  if (score < 700) return { trash: 0.58, dumpster: 0.24, pigeon: 0.18 };
  return { trash: 0.52, dumpster: 0.23, pigeon: 0.25 };
}

export function chooseObstacle(score, roll) {
  const weights = obstacleWeights(score);
  if (roll < weights.trash) return "trash";
  if (roll < weights.trash + weights.dumpster) return "dumpster";
  return "pigeon";
}

export function spacingForSpeed(speed, roll) {
  return 180 + speed * 0.45 + roll * 140;
}

export function isDownwardDuckGesture(startX, startY, currentX, currentY) {
  const horizontalDistance = Math.abs(currentX - startX);
  const downwardDistance = currentY - startY;
  return downwardDistance >= TOUCH_DUCK_DISTANCE && downwardDistance >= horizontalDistance * 0.75;
}

export function isTapGesture(startX, startY, currentX, currentY, durationMs) {
  return (
    Math.hypot(currentX - startX, currentY - startY) <= TOUCH_TAP_DISTANCE &&
    durationMs <= TOUCH_TAP_MAX_DURATION
  );
}

const PIGEON_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 1]);

export function pigeonFrameForTime(animationTime, phaseOffset = 0) {
  const step = Math.floor((animationTime + phaseOffset) * PIGEON_FLAP_FPS);
  const sequenceIndex = ((step % PIGEON_FRAME_SEQUENCE.length) + PIGEON_FRAME_SEQUENCE.length) % PIGEON_FRAME_SEQUENCE.length;
  return PIGEON_FRAME_SEQUENCE[sequenceIndex];
}

export function rectanglesIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function playerCollisionBox({ x, y, width, height, ducking, groundY, duckHeight }) {
  const onGround = y >= groundY - height - 0.5;
  if (ducking && onGround) {
    return {
      x: x + width * 0.14,
      y: groundY - duckHeight + duckHeight * 0.18,
      w: width * 0.72,
      h: duckHeight * 0.7,
    };
  }

  return {
    x: x + width * 0.17,
    y: y + height * 0.2,
    w: width * 0.66,
    h: height * 0.72,
  };
}

export function obstacleCollisionBox(obstacle) {
  if (obstacle.kind === "pigeon") {
    return {
      x: obstacle.x + obstacle.w * 0.16,
      y: obstacle.y + obstacle.h * 0.2,
      w: obstacle.w * 0.68,
      h: obstacle.h * 0.6,
    };
  }

  if (obstacle.kind === "dumpster") {
    return {
      x: obstacle.x + obstacle.w * 0.08,
      y: obstacle.y + obstacle.h * 0.05,
      w: obstacle.w * 0.84,
      h: obstacle.h * 0.9,
    };
  }

  return {
    x: obstacle.x + obstacle.w * 0.13,
    y: obstacle.y + obstacle.h * 0.08,
    w: obstacle.w * 0.74,
    h: obstacle.h * 0.88,
  };
}

export function makeSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
