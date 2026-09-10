"use client";

import Link from "next/link";
import { ArrowLeft, Globe2, RotateCcw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  TIAO_RUNNER_FIXED_STEP_SECONDS,
  TIAO_RUNNER_TARGET_FPS,
  TIAO_RUNNER_WORLD,
  TIAO_SPRITE_CELL,
  createTiaoRunnerState,
  formatTiaoRunnerScore,
  getTiaoRunnerPlayerRenderBox,
  restartTiaoRunner,
  setTiaoRunnerDucking,
  startOrJumpTiaoRunner,
  stepTiaoRunner,
  type TiaoRunnerObstacle,
  type TiaoRunnerState,
  type TiaoRunnerStatus,
} from "@/lib/games/tiao-runner";
import { withBasePath } from "@/lib/base-path";
import {
  getYaleRunGlobalHighScore,
  submitYaleRunGlobalHighScore,
} from "@/lib/supabase/yale-run";
import styles from "./tiao-runner.module.css";

const HIGH_SCORE_STORAGE_KEY = "econmind:tiao-run:high-score";

type RunnerHud = {
  status: TiaoRunnerStatus;
  score: number;
  highScore: number;
};

type RunnerController = {
  jump: () => void;
  restart: () => void;
  duck: (ducking: boolean) => void;
};

function readHighScore() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY) ?? "0", 10);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

function persistHighScore(highScore: number) {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(highScore));
  } catch {
    // Private browsing or storage restrictions should never stop a round.
  }
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawCactus(context: CanvasRenderingContext2D, obstacle: TiaoRunnerObstacle) {
  const { x, y, width, height } = obstacle;
  const trunkWidth = Math.max(12, width * 0.36);
  const trunkX = x + (width - trunkWidth) / 2;
  const branchWidth = Math.max(8, trunkWidth * 0.6);
  const branchHeight = Math.max(20, height * 0.35);

  context.fillStyle = "#68c681";
  context.strokeStyle = "#d2f6d8";
  context.lineWidth = 2;
  roundedRect(context, trunkX, y, trunkWidth, height, trunkWidth / 2);
  context.fill();
  context.stroke();

  roundedRect(context, trunkX - branchWidth, y + height * 0.46, branchWidth, branchHeight, branchWidth / 2);
  context.fill();
  context.stroke();
  roundedRect(context, trunkX - branchWidth, y + height * 0.34, branchWidth * 0.5, branchHeight * 0.38, branchWidth / 3);
  context.fill();
  context.stroke();

  if (width > 48) {
    roundedRect(context, trunkX + trunkWidth, y + height * 0.24, branchWidth, branchHeight, branchWidth / 2);
    context.fill();
    context.stroke();
    roundedRect(context, trunkX + trunkWidth + branchWidth * 0.48, y + height * 0.16, branchWidth * 0.5, branchHeight * 0.42, branchWidth / 3);
    context.fill();
    context.stroke();
  }
}

function drawBat(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, flap: number) {
  context.fillStyle = "#1a2930";
  context.strokeStyle = "#abc4ca";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y + height * 0.64);
  context.quadraticCurveTo(x + width * 0.16, y + height * 0.08 + flap, x + width * 0.36, y + height * 0.5);
  context.quadraticCurveTo(x + width * 0.43, y + height * 0.62, x + width * 0.5, y + height * 0.47);
  context.quadraticCurveTo(x + width * 0.57, y + height * 0.62, x + width * 0.64, y + height * 0.5);
  context.quadraticCurveTo(x + width * 0.84, y + height * 0.08 - flap, x + width, y + height * 0.64);
  context.lineTo(x + width * 0.8, y + height * 0.58);
  context.lineTo(x + width * 0.66, y + height * 0.92);
  context.lineTo(x + width * 0.58, y + height * 0.68);
  context.lineTo(x + width * 0.5, y + height);
  context.lineTo(x + width * 0.42, y + height * 0.68);
  context.lineTo(x + width * 0.34, y + height * 0.92);
  context.lineTo(x + width * 0.2, y + height * 0.58);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "#f7dc95";
  context.beginPath();
  context.arc(x + width * 0.55, y + height * 0.57, 1.8, 0, Math.PI * 2);
  context.fill();
}

function drawBatFlock(context: CanvasRenderingContext2D, obstacle: TiaoRunnerObstacle, animationSeconds: number) {
  const count = obstacle.batCount ?? 1;
  const batWidth = 58;
  const spacing = count > 1 ? (obstacle.width - batWidth) / (count - 1) : 0;

  for (let index = 0; index < count; index += 1) {
    const flap = Math.sin(animationSeconds * 18 + index * 1.7) * 5;
    const rise = index % 2 === 0 ? 0 : 5;
    drawBat(context, obstacle.x + spacing * index, obstacle.y + rise, batWidth, obstacle.height - rise, flap);
  }
}

function drawObstacle(context: CanvasRenderingContext2D, obstacle: TiaoRunnerObstacle, animationSeconds: number) {
  if (obstacle.kind === "cactus") drawCactus(context, obstacle);
  else drawBatFlock(context, obstacle, animationSeconds);
}

function drawSpritePlaceholder(context: CanvasRenderingContext2D, state: TiaoRunnerState) {
  const box = getTiaoRunnerPlayerRenderBox(state);
  context.fillStyle = "#f5823a";
  context.beginPath();
  context.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width * 0.35, box.height * 0.42, 0, 0, Math.PI * 2);
  context.fill();
}

function spriteFrameFor(state: TiaoRunnerState) {
  if (state.status === "game-over") return { row: 5, column: Math.min(7, Math.floor(state.animationSeconds * 8) % 8) };
  // Keep the tiger facing right throughout a jump instead of rotating through
  // the atlas's general-purpose jumping poses.
  if (state.player.y > 0.01) return { row: 1, column: 0 };
  if (state.status === "ready") return { row: 0, column: Math.min(6, Math.floor(state.animationSeconds * 4) % 7) };
  return { row: 1, column: Math.floor(state.animationSeconds * 14) % 8 };
}

function drawTiao(context: CanvasRenderingContext2D, state: TiaoRunnerState, sprite: HTMLImageElement, spriteReady: boolean) {
  if (!spriteReady) {
    drawSpritePlaceholder(context, state);
    return;
  }
  const { row, column } = spriteFrameFor(state);
  const box = getTiaoRunnerPlayerRenderBox(state);
  context.drawImage(
    sprite,
    column * TIAO_SPRITE_CELL.width,
    row * TIAO_SPRITE_CELL.height,
    TIAO_SPRITE_CELL.width,
    TIAO_SPRITE_CELL.height,
    box.x,
    box.y,
    box.width,
    box.height,
  );
}

function drawGameOverlay(context: CanvasRenderingContext2D, state: TiaoRunnerState) {
  const centerX = TIAO_RUNNER_WORLD.width / 2;
  if (state.status === "ready") {
    context.fillStyle = "#eff8f1";
    context.textAlign = "center";
    context.font = "800 28px Arial, sans-serif";
    context.fillText("Y A L E   R U N", centerX, 108);
    context.fillStyle = "#b9d7c2";
    context.font = "600 15px Arial, sans-serif";
    context.fillText("Press SPACE, ↑ or click to start", centerX, 140);
    return;
  }
  if (state.status === "game-over") {
    context.fillStyle = "rgba(4, 18, 11, .82)";
    roundedRect(context, centerX - 155, 86, 310, 92, 15);
    context.fill();
    context.strokeStyle = "rgba(255, 208, 111, .75)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#ffe0a1";
    context.textAlign = "center";
    context.font = "800 24px Arial, sans-serif";
    context.fillText("ROUND OVER", centerX, 122);
    context.fillStyle = "#d2ead9";
    context.font = "600 14px Arial, sans-serif";
    context.fillText("Click, press SPACE or tap Restart", centerX, 150);
  }
}

function renderRunner(context: CanvasRenderingContext2D, state: TiaoRunnerState, sprite: HTMLImageElement, spriteReady: boolean, devicePixelRatio: number) {
  const { width, height, groundY } = TIAO_RUNNER_WORLD;
  const night = Math.floor(state.score / 500) % 2 === 1;
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, night ? "#06120c" : "#0b2819");
  sky.addColorStop(0.7, night ? "#0a2116" : "#123b25");
  sky.addColorStop(1, "#07170f");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = night ? "#f6e8b0" : "#a4e1a9";
  context.beginPath();
  context.arc(width - 112, 73, night ? 19 : 22, 0, Math.PI * 2);
  context.fill();
  if (night) {
    context.fillStyle = "#06120c";
    context.beginPath();
    context.arc(width - 104, 66, 18, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = night ? "rgba(218, 246, 226, .7)" : "rgba(217, 250, 224, .5)";
  for (let index = 0; index < 16; index += 1) {
    const x = (index * 127 + Math.floor(state.animationSeconds * (10 + index))) % width;
    const y = 34 + ((index * 47) % 156);
    context.fillRect(x, y, index % 3 === 0 ? 3 : 2, index % 3 === 0 ? 3 : 2);
  }

  context.strokeStyle = "rgba(184, 237, 193, .78)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, groundY + 1);
  context.lineTo(width, groundY + 1);
  context.stroke();
  context.strokeStyle = "rgba(113, 180, 123, .7)";
  context.lineWidth = 2;
  const groundOffset = (state.animationSeconds * state.speed) % 52;
  for (let x = -groundOffset; x < width; x += 52) {
    context.beginPath();
    context.moveTo(x, groundY + 13);
    context.lineTo(x + 30, groundY + 13);
    context.stroke();
  }

  drawTiao(context, state, sprite, spriteReady);
  for (const obstacle of state.obstacles) drawObstacle(context, obstacle, state.animationSeconds);

  context.textAlign = "right";
  context.font = "800 19px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#c8e4ce";
  context.fillText(`HI ${formatTiaoRunnerScore(state.highScore)}  ${formatTiaoRunnerScore(state.score)}`, width - 28, 35);
  context.textAlign = "left";
  context.font = "700 11px Arial, sans-serif";
  context.fillStyle = "#9fd0aa";
  context.fillText(`${TIAO_RUNNER_TARGET_FPS} FPS · ECONMIND LEAGUE`, 28, 35);

  drawGameOverlay(context, state);
}

export function TiaoRunner() {
  const { configured, openAuth, user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<RunnerController | null>(null);
  const globalHighScoreRef = useRef(0);
  const globalSubmissionInFlightRef = useRef(false);
  const submitGlobalScoreRef = useRef<(score: number) => void>(() => {});
  const [hud, setHud] = useState<RunnerHud>({ status: "ready", score: 0, highScore: 0 });
  const [globalHighScore, setGlobalHighScore] = useState<number | null>(null);
  const [globalScoreStatus, setGlobalScoreStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const jump = useCallback(() => controllerRef.current?.jump(), []);
  const restart = useCallback(() => controllerRef.current?.restart(), []);
  const setDuck = useCallback((ducking: boolean) => controllerRef.current?.duck(ducking), []);

  useEffect(() => {
    let active = true;
    if (!configured) {
      globalHighScoreRef.current = 0;
      queueMicrotask(() => {
        if (!active) return;
        setGlobalHighScore(null);
        setGlobalScoreStatus("unavailable");
      });
      return () => { active = false; };
    }

    queueMicrotask(() => { if (active) setGlobalScoreStatus("loading"); });
    void getYaleRunGlobalHighScore()
      .then((score) => {
        if (!active || score === null) return;
        globalHighScoreRef.current = score;
        setGlobalHighScore(score);
        setGlobalScoreStatus("ready");
      })
      .catch(() => {
        if (active) setGlobalScoreStatus("unavailable");
      });

    return () => { active = false; };
  }, [configured]);

  useEffect(() => {
    submitGlobalScoreRef.current = (score) => {
      if (!configured || !user || score <= globalHighScoreRef.current || globalSubmissionInFlightRef.current) return;

      globalSubmissionInFlightRef.current = true;
      void submitYaleRunGlobalHighScore(score)
        .then((nextGlobalHighScore) => {
          globalHighScoreRef.current = nextGlobalHighScore;
          setGlobalHighScore(nextGlobalHighScore);
          setGlobalScoreStatus("ready");
        })
        .catch(() => setGlobalScoreStatus("unavailable"))
        .finally(() => { globalSubmissionInFlightRef.current = false; });
    };
  }, [configured, user]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const state = createTiaoRunnerState(readHighScore());
    const sprite = new window.Image();
    let spriteReady = false;
    let active = true;
    let frameId = 0;
    let lastTimestamp = 0;
    let accumulator = 0;
    let hudSteps = 0;
    let devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const publishHud = () => {
      setHud({
        status: state.status,
        score: Math.floor(state.score),
        highScore: state.highScore,
      });
    };

    const resizeCanvas = () => {
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(TIAO_RUNNER_WORLD.width * devicePixelRatio);
      canvas.height = Math.round(TIAO_RUNNER_WORLD.height * devicePixelRatio);
      renderRunner(context, state, sprite, spriteReady, devicePixelRatio);
    };

    const controls: RunnerController = {
      jump: () => {
        const wasOver = state.status === "game-over";
        startOrJumpTiaoRunner(state);
        if (wasOver) persistHighScore(state.highScore);
        publishHud();
      },
      restart: () => {
        restartTiaoRunner(state);
        publishHud();
      },
      duck: (ducking) => setTiaoRunnerDucking(state, ducking),
    };
    controllerRef.current = controls;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        controls.jump();
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        controls.duck(true);
      }
      if (event.code === "KeyR" && state.status === "game-over") {
        event.preventDefault();
        controls.restart();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowDown") {
        event.preventDefault();
        controls.duck(false);
      }
    };

    const animate = (timestamp: number) => {
      if (!active) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      accumulator += Math.min((timestamp - lastTimestamp) / 1_000, 0.1);
      lastTimestamp = timestamp;
      let drewFrame = false;

      while (accumulator >= TIAO_RUNNER_FIXED_STEP_SECONDS) {
        const previousStatus = state.status;
        stepTiaoRunner(state, TIAO_RUNNER_FIXED_STEP_SECONDS);
        accumulator -= TIAO_RUNNER_FIXED_STEP_SECONDS;
        hudSteps += 1;
        drewFrame = true;
        if (previousStatus !== "game-over" && state.status === "game-over") {
          persistHighScore(state.highScore);
          submitGlobalScoreRef.current(Math.floor(state.score));
          publishHud();
          hudSteps = 0;
        }
      }

      if (drewFrame) {
        renderRunner(context, state, sprite, spriteReady, devicePixelRatio);
        if (hudSteps >= 6) {
          publishHud();
          hudSteps = 0;
        }
      }
      frameId = window.requestAnimationFrame(animate);
    };

    sprite.onload = () => {
      spriteReady = true;
      renderRunner(context, state, sprite, spriteReady, devicePixelRatio);
    };
    sprite.src = withBasePath("/games/tiao/spritesheet.webp");
    resizeCanvas();
    publishHud();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      sprite.onload = null;
      if (controllerRef.current === controls) controllerRef.current = null;
    };
  }, []);

  const actionLabel = hud.status === "game-over" ? "Restart run" : hud.status === "ready" ? "Start run" : "Jump";
  const statusLabel = hud.status === "game-over" ? "Round over" : hud.status === "ready" ? "Ready" : "Running";
  const globalHighScoreLabel = globalScoreStatus === "ready" && globalHighScore !== null
    ? formatTiaoRunnerScore(globalHighScore)
    : globalScoreStatus === "loading" ? "·····" : "—";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link href="/" className={styles.backLink}><ArrowLeft size={15} /> Back to EconMind</Link>
            <p className={styles.eyebrow}>EconMind League arcade</p>
            <h1>Yale Run</h1>
            <p className={styles.intro}>The familiar offline-runner rules, now led by Tiao the tiger.</p>
          </div>
          <dl className={styles.scoreboard}>
            <div><dt>Score</dt><dd>{formatTiaoRunnerScore(hud.score)}</dd></div>
            <div><dt><Trophy size={13} /> Best</dt><dd>{formatTiaoRunnerScore(hud.highScore)}</dd></div>
            <div><dt><Globe2 size={13} /> Global high</dt><dd>{globalHighScoreLabel}</dd></div>
          </dl>
        </header>

        <section className={styles.gameCard} aria-label="Yale Run game">
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onClick={jump}
            role="button"
            tabIndex={0}
            aria-label="Yale Run. Click or press Space to jump. Hold Arrow Down to duck."
          />
          <p className={styles.screenReaderStatus} aria-live="polite">{statusLabel}. Score {hud.score}. Best score {hud.highScore}. Global high {globalHighScore ?? "unavailable"}.</p>
        </section>

        <div className={styles.controls}>
          <button type="button" className={styles.primaryControl} onClick={hud.status === "game-over" ? restart : jump}>{hud.status === "game-over" ? <RotateCcw size={17} /> : null}{actionLabel}</button>
          <button
            type="button"
            className={styles.secondaryControl}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDuck(true); }}
            onPointerUp={() => setDuck(false)}
            onPointerCancel={() => setDuck(false)}
            onLostPointerCapture={() => setDuck(false)}
            onKeyDown={(event) => { if (event.code === "Space" || event.code === "Enter") setDuck(true); }}
            onKeyUp={(event) => { if (event.code === "Space" || event.code === "Enter") setDuck(false); }}
          >Hold to duck</button>
          <p><b>Controls:</b> Space / ↑ / click to jump · hold ↓ to duck · R to restart</p>
        </div>
        <p className={styles.performanceNote}>Physics and sprite animation run in fixed {TIAO_RUNNER_TARGET_FPS} FPS steps. {user ? "New records update Global High automatically." : "Sign in to set a Global High."}</p>
        {configured && !user ? <button type="button" className={styles.globalSignIn} onClick={() => openAuth("sign-in")}>Sign in to set Global High</button> : null}
      </div>
    </main>
  );
}
