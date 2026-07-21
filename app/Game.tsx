"use client";

import { useCallback, useEffect, useRef } from "react";
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
} from "./game/rules.mjs";

type GameState = "waiting" | "running" | "dead";
type ObstacleKind = "trash" | "dumpster" | "pigeon";
type Rect = { x: number; y: number; w: number; h: number };
type Obstacle = Rect & { id: number; kind: ObstacleKind; frameOffset: number };
type GroundMark = { x: number; y: number; kind: number; size: number };
type TouchGesture = { pointerId: number; startX: number; startY: number; startedAt: number; ducking: boolean };

type Engine = {
  state: GameState;
  score: number;
  highScore: number;
  speed: number;
  playerY: number;
  playerVelocity: number;
  ducking: boolean;
  animationTime: number;
  frozenFrame: number;
  obstacles: Obstacle[];
  ground: GroundMark[];
  nextObstacleId: number;
  random: () => number;
  lastMilestone: number;
  scoreFlash: number;
};

type Sprite = { x: number; y: number; w: number; h: number };

const WIDTH = 800;
const HEIGHT = 200;
const GROUND_Y = 157;
const PLAYER_X = 128;
const PLAYER_W = 58;
const PLAYER_H = 43;
const DUCK_H = 27;
const PLAYER_SPRITE_SCALE = 0.66;

const idleFrames: Sprite[] = [
  { x: 37, y: 63, w: 88, h: 43 },
  { x: 153, y: 62, w: 87, h: 44 },
  { x: 266, y: 61, w: 87, h: 45 },
  { x: 379, y: 61, w: 87, h: 45 },
];

const runFrames: Sprite[] = [
  { x: 40, y: 180, w: 85, h: 44 },
  { x: 151, y: 180, w: 85, h: 45 },
  { x: 251, y: 179, w: 75, h: 49 },
  { x: 337, y: 180, w: 74, h: 48 },
  { x: 422, y: 179, w: 70, h: 46 },
  { x: 507, y: 178, w: 73, h: 49 },
];

const jumpFrames: Sprite[] = [
  { x: 42, y: 302, w: 84, h: 45 },
  { x: 153, y: 288, w: 87, h: 52 },
  { x: 263, y: 300, w: 83, h: 46 },
];

const trashSprite: Sprite = { x: 645, y: 180, w: 41, h: 52 };
const dumpsterSprite: Sprite = { x: 788, y: 103, w: 135, h: 134 };
const pigeonFrames: Sprite[] = [
  { x: 974, y: 137, w: 68, h: 52 },
  { x: 1062, y: 139, w: 68, h: 51 },
  { x: 1154, y: 155, w: 69, h: 49 },
];

function createGround(random: () => number): GroundMark[] {
  return Array.from({ length: 30 }, (_, index) => ({
    x: index * 32 + random() * 26,
    y: GROUND_Y + 5 + random() * 18,
    kind: Math.floor(random() * 3),
    size: 1 + Math.floor(random() * 3),
  }));
}

function makeEngine(highScore: number): Engine {
  const random = makeSeededRandom((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  return {
    state: "waiting",
    score: 0,
    highScore,
    speed: 360,
    playerY: GROUND_Y - PLAYER_H,
    playerVelocity: 0,
    ducking: false,
    animationTime: 0,
    frozenFrame: 0,
    obstacles: [],
    ground: createGround(random),
    nextObstacleId: 1,
    random,
    lastMilestone: 0,
    scoreFlash: 0,
  };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
}

function playerHitbox(engine: Engine): Rect {
  return playerCollisionBox({
    x: PLAYER_X,
    y: engine.playerY,
    width: PLAYER_W,
    height: PLAYER_H,
    ducking: engine.ducking,
    groundY: GROUND_Y,
    duckHeight: DUCK_H,
  });
}

function obstacleHitbox(obstacle: Obstacle): Rect {
  return obstacleCollisionBox(obstacle);
}

function drawSprite(
  context: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement | null,
  sprite: Sprite,
  destination: Rect,
) {
  if (!atlas) return;
  context.drawImage(atlas, sprite.x, sprite.y, sprite.w, sprite.h, destination.x, destination.y, destination.w, destination.h);
}

function fittedSpriteDestination(sprite: Sprite, bounds: Rect): Rect {
  const scale = Math.min(bounds.w / sprite.w, bounds.h / sprite.h);
  const width = Math.round(sprite.w * scale);
  const height = Math.round(sprite.h * scale);
  return {
    x: Math.round(bounds.x + (bounds.w - width) / 2),
    y: Math.round(bounds.y + bounds.h - height),
    w: width,
    h: height,
  };
}

function fittedPlayerDestination(sprite: Sprite, top: number): Rect {
  const width = Math.round(sprite.w * PLAYER_SPRITE_SCALE);
  const height = Math.round(sprite.h * PLAYER_SPRITE_SCALE);
  return {
    x: Math.round(PLAYER_X + (PLAYER_W - width) / 2),
    y: Math.round(top + PLAYER_H - height),
    w: width,
    h: height,
  };
}

function spawnAhead(engine: Engine) {
  const farthest = engine.obstacles.reduce((value, obstacle) => Math.max(value, obstacle.x + obstacle.w), WIDTH + 80);
  if (farthest > WIDTH + 520) return;

  const startX = farthest + spacingForSpeed(engine.speed, engine.random());
  const kind = chooseObstacle(engine.score, engine.random()) as ObstacleKind;

  if (kind === "trash") {
    const size = OBSTACLE_SIZES.trash;
    const clusterRoll = engine.random();
    const count = clusterRoll > 0.88 ? 3 : clusterRoll > 0.68 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      engine.obstacles.push({
        id: engine.nextObstacleId++,
        kind,
        x: startX + index * (size.w + 14),
        y: GROUND_Y - size.h,
        ...size,
        frameOffset: 0,
      });
    }
    return;
  }

  if (kind === "dumpster") {
    const size = OBSTACLE_SIZES.dumpster;
    engine.obstacles.push({
      id: engine.nextObstacleId++,
      kind,
      x: startX,
      y: GROUND_Y - size.h,
      ...size,
      frameOffset: 0,
    });
    return;
  }

  const size = OBSTACLE_SIZES.pigeon;
  const groundGap = PIGEON_FLIGHT_GAPS[Math.floor(engine.random() * PIGEON_FLIGHT_GAPS.length)];
  engine.obstacles.push({
    id: engine.nextObstacleId++,
    kind,
    x: startX,
    y: GROUND_Y - groundGap - size.h,
    ...size,
    frameOffset: engine.random() * 0.2,
  });
}

function createAtlas(image: HTMLImageElement, color: [number, number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const lightness = (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
    pixels.data[index] = color[0];
    pixels.data[index + 1] = color[1];
    pixels.data[index + 2] = color[2];
    pixels.data[index + 3] = lightness < 205 ? 255 : 0;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function makeAudio() {
  let context: AudioContext | null = null;
  const tone = (frequency: number, duration: number, type: OscillatorType = "square", volume = 0.035) => {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };
  return {
    jump: () => tone(420, 0.055),
    land: () => tone(130, 0.035, "square", 0.018),
    milestone: () => tone(760, 0.08, "square", 0.03),
    death: () => tone(85, 0.22, "sawtooth", 0.045),
    restart: () => tone(240, 0.04, "square", 0.02),
  };
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const atlasRef = useRef<HTMLCanvasElement | null>(null);
  const pigeonAtlasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const touchGestureRef = useRef<TouchGesture | null>(null);

  const startRun = useCallback((jump = true) => {
    const highScore = engineRef.current?.highScore ?? 0;
    const engine = makeEngine(highScore);
    engine.state = "running";
    engine.playerVelocity = jump ? -270 : 0;
    engineRef.current = engine;
    audioRef.current?.restart();
    if (jump) audioRef.current?.jump();
  }, []);

  const jump = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.state === "waiting") {
      startRun(true);
      return;
    }
    if (engine.state === "dead") {
      startRun(false);
      return;
    }
    const onGround = engine.playerY >= GROUND_Y - PLAYER_H - 0.5;
    if (onGround && !engine.ducking) {
      engine.playerVelocity = -270;
      audioRef.current?.jump();
    }
  }, [startRun]);

  const setDuck = useCallback((ducking: boolean) => {
    const engine = engineRef.current;
    if (!engine || engine.state !== "running") return;
    const onGround = engine.playerY >= GROUND_Y - PLAYER_H - 0.5;
    engine.ducking = ducking && onGround;
  }, []);

  useEffect(() => {
    const saved = Number.parseInt(localStorage.getItem("jimothy_highscore") ?? "0", 10);
    const highScore = Number.isFinite(saved) ? Math.max(0, saved) : 0;
    engineRef.current = makeEngine(highScore);
    audioRef.current = makeAudio();

    const image = new Image();
    image.src = "/jimothy-sprites.jpg";
    image.onload = () => {
      atlasRef.current = createAtlas(image, [78, 78, 76]);
    };

    const pigeonImage = new Image();
    pigeonImage.src = "/jimothy-pigeon-sprites.jpg";
    pigeonImage.onload = () => {
      pigeonAtlasRef.current = createAtlas(pigeonImage, [78, 78, 76]);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
      if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
      if (event.code === "ArrowDown") setDuck(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowDown") setDuck(false);
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [jump, setDuck]);

  useEffect(() => {
    let animationFrame = 0;
    let lastTime = performance.now();

    const draw = (time: number) => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !engine || !context) {
        animationFrame = requestAnimationFrame(draw);
        return;
      }

      const delta = Math.min((time - lastTime) / 1000, 0.034);
      lastTime = time;
      context.imageSmoothingEnabled = false;

      if (engine.state !== "dead") engine.animationTime += delta;

      if (engine.state === "running") {
        const wasOnGround = engine.playerY >= GROUND_Y - PLAYER_H - 0.5;
        engine.score += (engine.speed / 36) * delta;
        engine.speed = speedForScore(engine.score);
        engine.scoreFlash = Math.max(0, engine.scoreFlash - delta);

        const milestone = Math.floor(engine.score / 100) * 100;
        if (milestone > engine.lastMilestone) {
          engine.lastMilestone = milestone;
          engine.scoreFlash = 0.18;
          if (milestone > 0) audioRef.current?.milestone();
        }

        if (!wasOnGround || engine.playerVelocity < 0) {
          engine.playerVelocity += 675 * delta;
          engine.playerY += engine.playerVelocity * delta;
          if (engine.playerY >= GROUND_Y - PLAYER_H) {
            engine.playerY = GROUND_Y - PLAYER_H;
            engine.playerVelocity = 0;
            audioRef.current?.land();
          }
        }

        for (const obstacle of engine.obstacles) obstacle.x -= engine.speed * delta;
        engine.obstacles = engine.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -20);
        for (const mark of engine.ground) {
          mark.x -= engine.speed * delta;
          if (mark.x < -10) mark.x += WIDTH + 80 + engine.random() * 80;
        }
        spawnAhead(engine);

        const playerBox = playerHitbox(engine);
        const collision = engine.obstacles.some((obstacle) => rectanglesIntersect(playerBox, obstacleHitbox(obstacle)));
        if (collision) {
          engine.state = "dead";
          engine.frozenFrame = Math.floor(engine.animationTime * 12) % runFrames.length;
          engine.highScore = Math.max(engine.highScore, Math.floor(engine.score));
          localStorage.setItem("jimothy_highscore", String(engine.highScore));
          audioRef.current?.death();
        }
      }

      context.fillStyle = "#f7f7f3";
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.fillStyle = "#4e4e4c";
      context.font = "16px var(--font-geist-mono), monospace";
      context.textAlign = "right";
      context.textBaseline = "top";
      const scoreText = `${engine.highScore > 0 ? `HI ${formatScore(engine.highScore)}  ` : ""}${formatScore(engine.score)}`;
      if (engine.scoreFlash > 0 && Math.floor(engine.scoreFlash * 45) % 2 === 0) context.globalAlpha = 0.25;
      context.fillText(scoreText, WIDTH - 22, 18);
      context.globalAlpha = 1;

      context.strokeStyle = "#666663";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, GROUND_Y + 0.5);
      context.lineTo(WIDTH, GROUND_Y + 0.5);
      context.stroke();

      context.fillStyle = "#777772";
      for (const mark of engine.ground) {
        if (mark.kind === 0) context.fillRect(Math.floor(mark.x), Math.floor(mark.y), mark.size * 2, 1);
        if (mark.kind === 1) {
          context.fillRect(Math.floor(mark.x), Math.floor(mark.y), 2, 2);
          context.fillRect(Math.floor(mark.x + 4), Math.floor(mark.y - 1), 1, 1);
        }
        if (mark.kind === 2) {
          context.beginPath();
          context.moveTo(mark.x, mark.y);
          context.lineTo(mark.x + 4, mark.y - 3);
          context.lineTo(mark.x + 8, mark.y);
          context.stroke();
        }
      }

      for (const obstacle of engine.obstacles) {
        if (obstacle.kind === "trash") drawSprite(context, atlasRef.current, trashSprite, obstacle);
        if (obstacle.kind === "dumpster") drawSprite(context, atlasRef.current, dumpsterSprite, obstacle);
        if (obstacle.kind === "pigeon") {
          const frame = pigeonFrameForTime(engine.animationTime, obstacle.frameOffset);
          const sprite = pigeonFrames[frame];
          drawSprite(context, pigeonAtlasRef.current, sprite, fittedSpriteDestination(sprite, obstacle));
        }
      }

      const onGround = engine.playerY >= GROUND_Y - PLAYER_H - 0.5;
      let playerSprite: Sprite;
      let destination: Rect;
      if (engine.state === "waiting") {
        playerSprite = idleFrames[Math.floor(engine.animationTime * 6) % idleFrames.length] ?? idleFrames[0];
        destination = fittedPlayerDestination(playerSprite, engine.playerY);
      } else if (!onGround) {
        const frame = engine.playerVelocity < -50 ? 0 : engine.playerVelocity > 100 ? 2 : 1;
        playerSprite = jumpFrames[frame] ?? jumpFrames[1];
        destination = fittedPlayerDestination(playerSprite, engine.playerY);
      } else {
        const frame = engine.state === "dead" ? engine.frozenFrame : Math.floor(engine.animationTime * 12) % runFrames.length;
        playerSprite = runFrames[frame] ?? runFrames[0];
        destination = engine.ducking
          ? { x: PLAYER_X - 3, y: GROUND_Y - DUCK_H, w: PLAYER_W + 6, h: DUCK_H }
          : fittedPlayerDestination(playerSprite, GROUND_Y - PLAYER_H);
      }
      drawSprite(context, atlasRef.current, playerSprite, destination);

      if (engine.state === "waiting") {
        context.fillStyle = "#4e4e4c";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "14px var(--font-geist-mono), monospace";
        context.fillText("SPACE OR TAP ANYWHERE TO RUN", WIDTH / 2, 78);
      }

      if (engine.state === "dead") {
        context.fillStyle = "#4e4e4c";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "22px var(--font-geist-mono), monospace";
        context.fillText("G A M E  O V E R", WIDTH / 2, 77);
        roundedRect(context, WIDTH / 2 - 19, 98, 38, 30, 3);
        context.stroke();
        context.font = "22px sans-serif";
        context.fillText("↻", WIDTH / 2, 113);
      }

      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const onGamePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      if (event.button !== 0) return;
      jump();
      return;
    }
    if (!event.isPrimary || touchGestureRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      ducking: false,
    };
  };

  const onGamePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = touchGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.ducking) return;
    if (isDownwardDuckGesture(gesture.startX, gesture.startY, event.clientX, event.clientY)) {
      gesture.ducking = true;
      setDuck(true);
    }
  };

  const finishTouchGesture = (event: React.PointerEvent<HTMLElement>, cancelled = false) => {
    const gesture = touchGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.ducking) setDuck(false);
    else if (
      !cancelled &&
      isTapGesture(
        gesture.startX,
        gesture.startY,
        event.clientX,
        event.clientY,
        performance.now() - gesture.startedAt,
      )
    ) {
      jump();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    touchGestureRef.current = null;
  };

  return (
    <main
      className="game-shell"
      onPointerDown={onGamePointerDown}
      onPointerMove={onGamePointerMove}
      onPointerUp={(event) => finishTouchGesture(event)}
      onPointerCancel={(event) => finishTouchGesture(event, true)}
      onLostPointerCapture={(event) => finishTouchGesture(event, true)}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={WIDTH}
        height={HEIGHT}
        aria-label="Jimothy runs through an alley. Press Space or Arrow Up, click, or tap anywhere to jump. Swipe down anywhere and hold to duck. After a collision, press Space or tap to restart."
        role="img"
      />
    </main>
  );
}
