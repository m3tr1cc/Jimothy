"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseCodefairState,
  requestCodefairLogin,
  requestCodefairState,
  submitCodefairScore,
  type CodefairState,
} from "./codefair";
import {
  chooseObstacle,
  formatScore,
  makeSeededRandom,
  spacingForSpeed,
  speedForScore,
} from "./game/rules.mjs";

type GameState = "waiting" | "running" | "dead";
type ObstacleKind = "trash" | "dumpster" | "pigeon";
type Rect = { x: number; y: number; w: number; h: number };
type Obstacle = Rect & { id: number; kind: ObstacleKind; frameOffset: number };
type GroundMark = { x: number; y: number; kind: number; size: number };

type Engine = {
  state: GameState;
  score: number;
  highScore: number;
  speed: number;
  runStartedAt: number;
  runId: string;
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

const idleFrames: Sprite[] = [
  { x: 33, y: 55, w: 96, h: 64 },
  { x: 143, y: 55, w: 100, h: 64 },
  { x: 255, y: 55, w: 101, h: 64 },
  { x: 367, y: 55, w: 101, h: 64 },
];

const runFrames: Sprite[] = [
  { x: 32, y: 174, w: 101, h: 64 },
  { x: 144, y: 174, w: 101, h: 64 },
  { x: 255, y: 174, w: 102, h: 64 },
  { x: 367, y: 174, w: 101, h: 64 },
  { x: 477, y: 174, w: 101, h: 64 },
  { x: 585, y: 174, w: 103, h: 64 },
];

const jumpFrames: Sprite[] = [
  { x: 32, y: 290, w: 100, h: 66 },
  { x: 143, y: 288, w: 104, h: 68 },
  { x: 255, y: 290, w: 101, h: 66 },
];

const trashSprite: Sprite = { x: 625, y: 172, w: 91, h: 75 };
const dumpsterSprite: Sprite = { x: 777, y: 94, w: 169, h: 154 };
const pigeonFrames: Sprite[] = [
  { x: 975, y: 132, w: 75, h: 69 },
  { x: 1066, y: 132, w: 80, h: 69 },
  { x: 1156, y: 132, w: 78, h: 69 },
];

const initialCodefairState: CodefairState = { user: null, entries: [] };

function makeRunId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
    runStartedAt: 0,
    runId: makeRunId(),
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

function intersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerHitbox(engine: Engine): Rect {
  const duckHeight = engine.ducking && engine.playerY >= GROUND_Y - PLAYER_H - 0.5 ? DUCK_H : PLAYER_H;
  const visibleY = GROUND_Y - duckHeight;
  return {
    x: PLAYER_X + PLAYER_W * 0.15,
    y: visibleY + duckHeight * 0.18,
    w: PLAYER_W * 0.7,
    h: duckHeight * 0.75,
  };
}

function obstacleHitbox(obstacle: Obstacle): Rect {
  if (obstacle.kind === "pigeon") {
    return { x: obstacle.x + 7, y: obstacle.y + 6, w: obstacle.w - 14, h: obstacle.h - 12 };
  }
  const inset = obstacle.kind === "dumpster" ? 5 : 3;
  return { x: obstacle.x + inset, y: obstacle.y + inset, w: obstacle.w - inset * 2, h: obstacle.h - inset };
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

function spawnAhead(engine: Engine) {
  const farthest = engine.obstacles.reduce((value, obstacle) => Math.max(value, obstacle.x + obstacle.w), WIDTH + 80);
  if (farthest > WIDTH + 520) return;

  const startX = farthest + spacingForSpeed(engine.speed, engine.random());
  const kind = chooseObstacle(engine.score, engine.random()) as ObstacleKind;

  if (kind === "trash") {
    const clusterRoll = engine.random();
    const count = clusterRoll > 0.88 ? 3 : clusterRoll > 0.68 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      engine.obstacles.push({
        id: engine.nextObstacleId++,
        kind,
        x: startX + index * 35,
        y: GROUND_Y - 31,
        w: 24,
        h: 31,
        frameOffset: 0,
      });
    }
    return;
  }

  if (kind === "dumpster") {
    engine.obstacles.push({
      id: engine.nextObstacleId++,
      kind,
      x: startX,
      y: GROUND_Y - 58,
      w: 67,
      h: 58,
      frameOffset: 0,
    });
    return;
  }

  const heights = [35, 58, 82];
  const height = heights[Math.floor(engine.random() * heights.length)];
  engine.obstacles.push({
    id: engine.nextObstacleId++,
    kind,
    x: startX,
    y: GROUND_Y - height - 14,
    w: 44,
    h: 28,
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
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const completionHandledRef = useRef("");
  const lastVisibleScoreRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [visibleScore, setVisibleScore] = useState(0);
  const [visibleHighScore, setVisibleHighScore] = useState(0);
  const [codefair, setCodefair] = useState<CodefairState>(initialCodefairState);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [scoreNotice, setScoreNotice] = useState("");
  const codefairRef = useRef(codefair);
  const leaderboardOpenRef = useRef(leaderboardOpen);

  useEffect(() => {
    codefairRef.current = codefair;
  }, [codefair]);

  useEffect(() => {
    leaderboardOpenRef.current = leaderboardOpen;
  }, [leaderboardOpen]);

  const startRun = useCallback((jump = true) => {
    const highScore = engineRef.current?.highScore ?? 0;
    const engine = makeEngine(highScore);
    engine.state = "running";
    engine.runStartedAt = performance.now();
    engine.playerVelocity = jump ? -270 : 0;
    engineRef.current = engine;
    completionHandledRef.current = "";
    lastVisibleScoreRef.current = 0;
    setVisibleScore(0);
    setGameState("running");
    setScoreNotice("");
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
    requestAnimationFrame(() => setVisibleHighScore(highScore));

    const image = new Image();
    image.src = "/jimothy-sprites.jpg";
    image.onload = () => {
      atlasRef.current = createAtlas(image, [78, 78, 76]);
    };
  }, []);

  useEffect(() => {
    requestCodefairState();
    const onMessage = (event: MessageEvent) => {
      const state = parseCodefairState(event.data);
      if (!state) return;
      setCodefair(state);
      if (state.user && completionHandledRef.current) setScoreNotice("SCORE SAVED");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (leaderboardOpenRef.current) {
        if (event.code === "Escape") setLeaderboardOpen(false);
        return;
      }
      if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
      if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
      if (event.code === "ArrowDown") setDuck(true);
      if (event.code === "KeyL" && !event.repeat) setLeaderboardOpen((value) => !value);
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
        const collision = engine.obstacles.some((obstacle) => intersect(playerBox, obstacleHitbox(obstacle)));
        if (collision) {
          engine.state = "dead";
          engine.frozenFrame = Math.floor(engine.animationTime * 12) % runFrames.length;
          engine.highScore = Math.max(engine.highScore, Math.floor(engine.score));
          localStorage.setItem("jimothy_highscore", String(engine.highScore));
          setVisibleHighScore(engine.highScore);
          setVisibleScore(Math.floor(engine.score));
          setGameState("dead");
          audioRef.current?.death();

          if (completionHandledRef.current !== engine.runId) {
            completionHandledRef.current = engine.runId;
            if (codefairRef.current.user) {
              submitCodefairScore(engine.score, engine.runId, time - engine.runStartedAt);
              setScoreNotice("SAVING SCORE...");
              setTimeout(requestCodefairState, 500);
            } else {
              setScoreNotice("log in to save your score");
            }
          }
        }

        const nextVisibleScore = Math.floor(engine.score);
        if (nextVisibleScore !== lastVisibleScoreRef.current) {
          lastVisibleScoreRef.current = nextVisibleScore;
          setVisibleScore(nextVisibleScore);
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
          const frame = Math.floor((engine.animationTime + obstacle.frameOffset) * 12) % pigeonFrames.length;
          drawSprite(context, atlasRef.current, pigeonFrames[frame], obstacle);
        }
      }

      const onGround = engine.playerY >= GROUND_Y - PLAYER_H - 0.5;
      let playerSprite: Sprite;
      let destination: Rect;
      if (engine.state === "waiting") {
        playerSprite = idleFrames[Math.floor(engine.animationTime * 6) % idleFrames.length];
        destination = { x: PLAYER_X, y: engine.playerY, w: PLAYER_W, h: PLAYER_H };
      } else if (!onGround) {
        const frame = engine.playerVelocity < -50 ? 0 : engine.playerVelocity > 100 ? 2 : 1;
        playerSprite = jumpFrames[frame];
        destination = { x: PLAYER_X, y: engine.playerY, w: PLAYER_W, h: PLAYER_H };
      } else {
        const frame = engine.state === "dead" ? engine.frozenFrame : Math.floor(engine.animationTime * 12) % runFrames.length;
        playerSprite = runFrames[frame];
        destination = engine.ducking
          ? { x: PLAYER_X - 2, y: GROUND_Y - DUCK_H, w: PLAYER_W + 5, h: DUCK_H }
          : { x: PLAYER_X, y: GROUND_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
      }
      drawSprite(context, atlasRef.current, playerSprite, destination);

      if (engine.state === "waiting") {
        context.fillStyle = "#4e4e4c";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "14px var(--font-geist-mono), monospace";
        context.fillText("SPACE OR TAP TO RUN", WIDTH / 2, 78);
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

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const lowerHalf = event.clientY - bounds.top > bounds.height * 0.67;
    if (lowerHalf && gameState === "running") setDuck(true);
    else jump();
  };

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="wordmark" aria-label="Jimothy alley run">
          <span className="wordmark-mark" aria-hidden="true">J</span>
          <span>JIMOTHY</span>
          <span className="wordmark-slash">{"//"}</span>
          <span className="wordmark-sub">ALLEY RUN</span>
        </div>
        <button className="leaderboard-toggle" type="button" onClick={() => setLeaderboardOpen(true)}>
          <span aria-hidden="true">▥</span> GLOBAL TOP 10
        </button>
      </header>

      <section className="game-stage" aria-label="Jimothy runner game">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={() => setDuck(false)}
          onPointerCancel={() => setDuck(false)}
          aria-label="Jimothy runs through an alley. Press Space or Arrow Up to jump and Arrow Down to duck."
          role="img"
        />
        {gameState === "dead" && scoreNotice && (
          <div className={`score-notice${!codefair.user ? " anonymous" : ""}`} role="status">
            <span>{scoreNotice}</span>
            {!codefair.user && (
              <button type="button" onClick={requestCodefairLogin}>LOG IN</button>
            )}
          </div>
        )}
      </section>

      <footer className="game-footer">
        <div className="control-hint"><kbd>SPACE</kbd><kbd>↑</kbd><span>JUMP</span></div>
        <div className="status-line" aria-live="polite">
          <span>{gameState === "waiting" ? "READY" : gameState === "running" ? "RUNNING" : "RUN ENDED"}</span>
          <span className="status-dot" aria-hidden="true">•</span>
          <span>SCORE {formatScore(visibleScore)}</span>
          <span className="status-dot" aria-hidden="true">•</span>
          <span>HI {formatScore(visibleHighScore)}</span>
        </div>
        <div className="control-hint"><kbd>↓</kbd><span>DUCK</span></div>
      </footer>

      {leaderboardOpen && (
        <div className="leaderboard-backdrop" role="presentation" onPointerDown={() => setLeaderboardOpen(false)}>
          <aside className="leaderboard-panel" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="leaderboard-heading">
              <div>
                <p>CODEFAIR GLOBAL</p>
                <h2 id="leaderboard-title">TOP RUNNERS</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setLeaderboardOpen(false)} aria-label="Close leaderboard">×</button>
            </div>
            {codefair.entries.length > 0 ? (
              <ol className="leaderboard-list">
                {codefair.entries.slice(0, 10).map((entry) => (
                  <li key={`${entry.userId}-${entry.rank}`} className={entry.isCurrentUser ? "current-runner" : ""}>
                    <span className="rank">{String(entry.rank).padStart(2, "0")}</span>
                    <span className="runner-name">{entry.displayName}</span>
                    <strong>{formatScore(entry.score)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="leaderboard-empty">
                <span aria-hidden="true">—</span>
                <p>NO RANKED RUNS YET</p>
                <small>Scores appear here when the game is running inside Codefair.</small>
              </div>
            )}
            <div className="leaderboard-you">
              {codefair.user ? (
                <><span>PLAYING AS</span><strong>{codefair.user.displayName}</strong></>
              ) : (
                <><span>YOUR RUN IS LOCAL</span><button type="button" onClick={requestCodefairLogin}>LOG IN TO RANK</button></>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
