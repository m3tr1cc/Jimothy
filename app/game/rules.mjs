export const INITIAL_SPEED = 360;
export const MAX_SPEED = 780;

export function formatScore(value) {
  const normalized = Math.max(0, Math.floor(value)) % 100000;
  return normalized.toString().padStart(5, "0");
}

export function speedForScore(score) {
  const increase = Math.floor(Math.max(0, score) / 100) * 15;
  return Math.min(MAX_SPEED, INITIAL_SPEED + increase);
}

export function obstacleWeights(score) {
  if (score < 400) return { trash: 1, dumpster: 0, pigeon: 0 };
  if (score < 700) return { trash: 0.7, dumpster: 0.3, pigeon: 0 };
  return { trash: 0.55, dumpster: 0.25, pigeon: 0.2 };
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
