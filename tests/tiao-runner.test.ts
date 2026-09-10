import { describe, expect, it } from "vitest";
import {
  TIAO_RUNNER_FIXED_STEP_SECONDS,
  TIAO_RUNNER_TARGET_FPS,
  TIAO_RUNNER_WORLD,
  createTiaoRunnerState,
  restartTiaoRunner,
  setTiaoRunnerDucking,
  startOrJumpTiaoRunner,
  stepTiaoRunner,
} from "@/lib/games/tiao-runner";

describe("Tiao Run engine", () => {
  it("uses a 60 FPS fixed simulation step", () => {
    expect(TIAO_RUNNER_TARGET_FPS).toBe(60);
    expect(TIAO_RUNNER_FIXED_STEP_SECONDS).toBeCloseTo(1 / 60, 12);
  });

  it("starts from a single jump input and returns the tiger to the ground", () => {
    const state = createTiaoRunnerState();
    startOrJumpTiaoRunner(state);

    expect(state.status).toBe("running");
    expect(state.player.velocity).toBeGreaterThan(0);

    state.nextObstacleDistance = Number.POSITIVE_INFINITY;
    let peakHeight = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      stepTiaoRunner(state);
      peakHeight = Math.max(peakHeight, state.player.y);
    }

    expect(peakHeight).toBeGreaterThan(195);
    expect(state.player.y).toBe(0);
    expect(state.player.velocity).toBe(0);
    expect(state.score).toBeGreaterThan(0);
    expect(state.speed).toBeGreaterThan(312);
  });

  it("keeps ducking on the ground and records a collision as a high score", () => {
    const state = createTiaoRunnerState(12);
    restartTiaoRunner(state);
    setTiaoRunnerDucking(state, true);
    expect(state.player.ducking).toBe(true);

    state.player.y = 20;
    setTiaoRunnerDucking(state, true);
    expect(state.player.ducking).toBe(false);

    state.player.y = 0;
    state.score = 43;
    state.obstacles = [{
      id: 1,
      kind: "cactus",
      x: TIAO_RUNNER_WORLD.playerX + 35,
      y: TIAO_RUNNER_WORLD.groundY - 82,
      width: 44,
      height: 82,
    }];

    stepTiaoRunner(state);

    expect(state.status).toBe("game-over");
    expect(state.highScore).toBeGreaterThanOrEqual(43);
  });
});
