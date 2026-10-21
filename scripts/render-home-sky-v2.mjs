// Image-generated layers -> one continuous, silent cinematic background loop.
// No browser data, credentials, account records or third-party footage involved.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export const DURATION = 120;
export const FPS = 30;
export const ROTATION = `2*PI*t/${DURATION}`;
export const OUTPUT = "public/images/visual-pilot/home-sky-v2";
export const SOURCES = ["design/home-sky-v2/starfield-source.png", "design/home-sky-v2/observatory-frame-source.png"];
export const FILTER = `[0:v]scale=2304:2304:flags=lanczos,rotate='${ROTATION}':ow=iw:oh=ih:fillcolor=0x061820,crop=1920:1080[sky];[1:v]scale=1920:1080:flags=lanczos[frame];[sky][frame]overlay=0:0:format=auto,format=yuv420p[out]`;

function run(args) {
  const result = spawnSync(process.env.FFMPEG_BIN || "/opt/homebrew/bin/ffmpeg", ["-hide_banner", "-nostdin", "-n", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Media render failed (${result.status}); original assets retained`);
}

if (process.argv[1]?.endsWith("render-home-sky-v2.mjs")) {
  for (const source of SOURCES) if (!existsSync(source)) throw new Error(`Missing original image-generated layer: ${source}`);
  run(["-loop", "1", "-framerate", String(FPS), "-i", SOURCES[0], "-loop", "1", "-framerate", String(FPS), "-i", SOURCES[1], "-filter_complex_threads", "2", "-filter_complex", FILTER,
    "-map", "[out]", "-frames:v", String(DURATION * FPS), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "24", "-threads", "4", "-g", "90", "-movflags", "+faststart", `${OUTPUT}/observatory-loop-1080.mp4`]);
  run(["-i", `${OUTPUT}/observatory-loop-1080.mp4`, "-vf", "scale=1280:720:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "25", "-threads", "4", "-g", "90", "-movflags", "+faststart", `${OUTPUT}/observatory-loop-720.mp4`]);
  run(["-i", `${OUTPUT}/observatory-loop-1080.mp4`, "-frames:v", "1", "-q:v", "2", `${OUTPUT}/observatory-poster.jpg`]);
}
