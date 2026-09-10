export const TIAO_RUNNER_TARGET_FPS = 60;
export const TIAO_RUNNER_FIXED_STEP_SECONDS = 1 / TIAO_RUNNER_TARGET_FPS;

export const TIAO_RUNNER_WORLD = {
  width: 960,
  height: 430,
  groundY: 356,
  playerX: 112,
} as const;

export const TIAO_SPRITE_CELL = {
  width: 192,
  height: 208,
} as const;

export type TiaoRunnerStatus = "ready" | "running" | "game-over";
export type TiaoObstacleKind = "cactus" | "pterodactyl";

export type TiaoRunnerObstacle = {
  id: number;
  kind: TiaoObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TiaoRunnerPlayer = {
  /** Height above the ground, in game pixels. */
  y: number;
  /** Positive values move the player upward. */
  velocity: number;
  ducking: boolean;
};

export type TiaoRunnerState = {
  status: TiaoRunnerStatus;
  score: number;
  highScore: number;
  speed: number;
  animationSeconds: number;
  player: TiaoRunnerPlayer;
  obstacles: TiaoRunnerObstacle[];
  nextObstacleDistance: number;
  nextObstacleId: number;
};

export type TiaoRunnerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const BASE_SPEED = 312;
const MAX_SPEED = 660;
const SCORE_PER_SECOND = 10;
const GRAVITY = 2_360;
// A longer arc gives Tiao enough time to clear the wider cactus clusters.
const JUMP_VELOCITY = 1_000;

const standingSprite = {
  width: 126,
  height: 136,
  hitbox: { x: 25, y: 17, width: 73, height: 113 },
} as const;

const duckingSprite = {
  width: 142,
  height: 91,
  hitbox: { x: 28, y: 21, width: 96, height: 61 },
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createTiaoRunnerState(highScore = 0): TiaoRunnerState {
  return {
    status: "ready",
    score: 0,
    highScore: Math.max(0, Math.floor(highScore)),
    speed: BASE_SPEED,
    animationSeconds: 0,
    player: { y: 0, velocity: 0, ducking: false },
    obstacles: [],
    nextObstacleDistance: 420,
    nextObstacleId: 1,
  };
}

function resetRound(state: TiaoRunnerState) {
  state.status = "running";
  state.score = 0;
  state.speed = BASE_SPEED;
  state.player.y = 0;
  state.player.velocity = 0;
  state.player.ducking = false;
  state.obstacles = [];
  state.nextObstacleDistance = 420;
  state.nextObstacleId = 1;
}

export function restartTiaoRunner(state: TiaoRunnerState) {
  resetRound(state);
}

export function startOrJumpTiaoRunner(state: TiaoRunnerState) {
  if (state.status !== "running") resetRound(state);
  if (state.player.y <= 0.01) {
    state.player.y = 0;
    state.player.velocity = JUMP_VELOCITY;
    state.player.ducking = false;
  }
}

export function setTiaoRunnerDucking(state: TiaoRunnerState, ducking: boolean) {
  state.player.ducking = state.status === "running" && state.player.y <= 0.01 && ducking;
}

export function isTiaoRunnerDucking(state: TiaoRunnerState) {
  return state.status === "running" && state.player.y <= 0.01 && state.player.ducking;
}

export function getTiaoRunnerPlayerRenderBox(state: TiaoRunnerState): TiaoRunnerRect {
  const sprite = isTiaoRunnerDucking(state) ? duckingSprite : standingSprite;
  return {
    x: TIAO_RUNNER_WORLD.playerX,
    y: TIAO_RUNNER_WORLD.groundY - sprite.height - state.player.y,
    width: sprite.width,
    height: sprite.height,
  };
}

export function getTiaoRunnerPlayerHitbox(state: TiaoRunnerState): TiaoRunnerRect {
  const sprite = isTiaoRunnerDucking(state) ? duckingSprite : standingSprite;
  const renderBox = getTiaoRunnerPlayerRenderBox(state);
  return {
    x: renderBox.x + sprite.hitbox.x,
    y: renderBox.y + sprite.hitbox.y,
    width: sprite.hitbox.width,
    height: sprite.hitbox.height,
  };
}

export function rectanglesOverlap(first: TiaoRunnerRect, second: TiaoRunnerRect) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

function spawnObstacle(state: TiaoRunnerState, random: () => number) {
  const pterodactylEligible = state.score >= 450;
  const isPterodactyl = pterodactylEligible && random() > 0.72;

  if (isPterodactyl) {
    const lowFlight = random() > 0.45;
    state.obstacles.push({
      id: state.nextObstacleId++,
      kind: "pterodactyl",
      x: TIAO_RUNNER_WORLD.width + 34,
      y: TIAO_RUNNER_WORLD.groundY - (lowFlight ? 118 : 172),
      width: 72,
      height: 38,
    });
  } else {
    const variants = [
      { width: 37, height: 71 },
      { width: 56, height: 101 },
      { width: 77, height: 83 },
    ] as const;
    const variant = variants[Math.min(variants.length - 1, Math.floor(random() * variants.length))];
    state.obstacles.push({
      id: state.nextObstacleId++,
      kind: "cactus",
      x: TIAO_RUNNER_WORLD.width + 34,
      y: TIAO_RUNNER_WORLD.groundY - variant.height,
      ...variant,
    });
  }

  const congestionReduction = Math.min(state.score * 0.09, 115);
  state.nextObstacleDistance = clamp(360 + random() * 310 - congestionReduction, 235, 660);
}

export function stepTiaoRunner(
  state: TiaoRunnerState,
  elapsedSeconds = TIAO_RUNNER_FIXED_STEP_SECONDS,
  random: () => number = Math.random,
) {
  const elapsed = clamp(elapsedSeconds, 0, 0.1);
  state.animationSeconds += elapsed;
  if (state.status !== "running") return;

  state.player.velocity -= GRAVITY * elapsed;
  state.player.y += state.player.velocity * elapsed;
  if (state.player.y <= 0) {
    state.player.y = 0;
    state.player.velocity = 0;
  }

  state.score += SCORE_PER_SECOND * elapsed;
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.score * 0.36);
  state.nextObstacleDistance -= state.speed * elapsed;
  if (state.nextObstacleDistance <= 0) spawnObstacle(state, random);

  for (const obstacle of state.obstacles) obstacle.x -= state.speed * elapsed;
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -24);

  const playerHitbox = getTiaoRunnerPlayerHitbox(state);
  const collision = state.obstacles.some((obstacle) => rectanglesOverlap(playerHitbox, obstacle));
  if (!collision) return;

  state.status = "game-over";
  state.player.y = 0;
  state.player.velocity = 0;
  state.player.ducking = false;
  state.highScore = Math.max(state.highScore, Math.floor(state.score));
}

export function formatTiaoRunnerScore(score: number) {
  return Math.max(0, Math.floor(score)).toString().padStart(5, "0");
}
