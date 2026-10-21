import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const binaryRoot = process.env.MEDIA_BIN_DIRECTORY || "/opt/homebrew/bin";
const target = "public/images/visual-pilot/home-sky-v2/observatory-loop-1080.mp4";
const probe = JSON.parse(execFileSync(`${binaryRoot}/ffprobe`, ["-v", "error", "-show_streams", "-show_format", "-of", "json", target], { encoding: "utf8" }));
const stream = probe.streams.find((row) => row.codec_type === "video");
if (stream?.width !== 1920 || stream.height !== 1080 || stream.r_frame_rate !== "30/1" || Number(stream.nb_frames) !== 3600 || Number(probe.format.duration) !== 120)
  throw new Error("Expected 120-second Full HD 30 fps complete cycle");
if (probe.streams.some((row) => row.codec_type === "audio")) throw new Error("Decorative media must be silent");

function frame(time) {
  return execFileSync(`${binaryRoot}/ffmpeg`, ["-v", "error", "-ss", String(time), "-i", target, "-frames:v", "1", "-vf", "scale=480:270", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 1024 * 1024 });
}
function difference(a, b) {
  if (a.length !== 480 * 270 * 3 || a.length !== b.length) throw new Error("Decoded frame evidence missing");
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}
const first = frame(0);
const next = frame(.02);
const beforeLast = frame(119.91);
const last = frame(119.95);
const quarter = frame(30);
const seamDifference = difference(last, first);
const ordinaryFrameDifference = Math.max(difference(first, next), difference(beforeLast, last));
const quarterTurnDifference = difference(first, quarter);
if (seamDifference > ordinaryFrameDifference * 1.6 + .3) throw new Error("Loop seam exceeds an ordinary frame's movement");
if (quarterTurnDifference < ordinaryFrameDifference * 2) throw new Error("No meaningful starfield movement detected");
const file = readFileSync(target);
if (file.indexOf(Buffer.from("moov")) > file.indexOf(Buffer.from("mdat"))) throw new Error("Fast-start metadata must precede video payload");
console.log(JSON.stringify({ duration: 120, fps: 30, width: 1920, height: 1080, frames: 3600, silent: true, fastStart: true,
  seamDifference, ordinaryFrameDifference, quarterTurnDifference, seamlessWithinNormalFrameMotion: true }, null, 2));
