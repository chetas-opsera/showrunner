// Showrunner - Copyright (c) 2026 Chetas P. PolyForm Noncommercial 1.0.0.
// ffmpeg helpers: locate a binary, build argument lists (pure, unit-tested), run it.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Order: $FFMPEG, an `ffmpeg-static` binary if one was installed, then `ffmpeg` on PATH. Returns null if none works.
 * The bundled binary is located by file path only: its JavaScript is never imported, and the binary runs as a
 * separate process. ffmpeg-static is GPL-3.0-or-later; keeping it at arm's length keeps this project's license separate.
 */
export async function findFfmpeg(env = process.env) {
  const candidates = [];
  if (env.FFMPEG) candidates.push(env.FFMPEG);
  try {
    const dir = dirname(createRequire(import.meta.url).resolve("ffmpeg-static/package.json"));
    candidates.push(join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"));
  } catch { /* optional dependency not installed */ }
  candidates.push("ffmpeg");
  for (const c of candidates) {
    const r = spawnSync(c, ["-version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  return null;
}

/** webm (VP8 from Playwright) -> universally playable H.264 mp4. yuv420p + faststart = plays in browsers, QuickTime, Slack. */
export function mp4Args(input, output, { fps = 30, crf = 20, preset = "medium" } = {}) {
  return ["-y", "-loglevel", "error", "-i", input, "-r", String(fps), "-c:v", "libx264", "-preset", preset, "-crf", String(crf),
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", output];
}

/** Evenly spaced contact sheet for QA: one frame every `every` seconds, tiled cols x rows. */
export function sheetArgs(input, output, { every = 10, cols = 4, rows = 3, width = 480 } = {}) {
  return ["-y", "-loglevel", "error", "-i", input, "-vf", `fps=1/${every},scale=${width}:-1,tile=${cols}x${rows}`, "-frames:v", "1", output];
}

export function run(ffmpeg, args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}): ${(r.stderr || "").trim().split("\n").slice(-3).join(" | ")}`);
}

/** Duration in seconds parsed from `ffmpeg -i` output, or null. */
export function durationOf(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
