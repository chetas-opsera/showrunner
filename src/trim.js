// Showrunner - Copyright (c) 2026 Chetas P. PolyForm Noncommercial 1.0.0.
// Collapse long stretches of near-identical frames (spinners, progress bars frozen) after recording.
import { run } from "./encode.js";

/**
 * ffmpeg mpdecimate drops duplicate-ish frames; setpts retimes the remainder so playback stays natural.
 * Tuned for UI screen capture at 30fps — lowers duration without cutting intentional motion.
 */
export function trimIdleArgs(input, output, { hi = 768, lo = 320, frac = 0.33, crf = 20, preset = "medium" } = {}) {
  const vf = `mpdecimate=hi=${hi}:lo=${lo}:frac=${frac},setpts=N/FRAME_RATE/TB`;
  return [
    "-y", "-loglevel", "error", "-i", input,
    "-vf", vf,
    "-c:v", "libx264", "-preset", preset, "-crf", String(crf),
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", output,
  ];
}

export function trimIdle(ffmpeg, input, output, opts = {}) {
  run(ffmpeg, trimIdleArgs(input, output, opts));
}
