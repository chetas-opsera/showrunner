// Showrunner - Copyright (c) 2026 Chetas P. PolyForm Noncommercial 1.0.0.
// Real-browser tests. Skipped (not failed) when Chrome or ffmpeg is unavailable.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { loadScenario } from "../src/scenario.js";
import { record } from "../src/recorder.js";
import { durationOf, findFfmpeg } from "../src/encode.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, "examples/hello/scenario.json");

let skip = false;
try { const b = await chromium.launch({ channel: "chrome", headless: true }); await b.close(); } catch { skip = "Google Chrome is not available"; }
const ffmpeg = await findFfmpeg();
if (!ffmpeg) skip = skip || "ffmpeg is not available";
const quiet = () => {};

test("records the bundled example end to end: mp4, chapters, subtitles, no failing steps", { skip }, async () => {
  const out = mkdtempSync(join(tmpdir(), "sr-e2e-"));
  const r = await record(loadScenario(example), { outDir: out, fast: true, log: quiet });
  assert.deepEqual(r.errors, []);
  assert.ok(existsSync(r.mp4), "mp4 exists");
  assert.ok(durationOf(ffmpeg, r.mp4) > 4, "video has real length");
  assert.deepEqual(r.chapters.map((c) => c.name), ["Title", "Landing page", "Using the app", "Summary", "End"]);
  assert.ok(r.cues.length >= 3, "captions became subtitle cues");
  assert.match(readFileSync(join(out, "orbit-demo.srt"), "utf8"), /-->/);
  assert.ok(!readdirSync(out).some((f) => f.startsWith(".rec-")), "temp recording dir is cleaned up");
});

test("a broken selector fails only its own scene; later scenes still record", { skip }, async () => {
  const out = mkdtempSync(join(tmpdir(), "sr-e2e-"));
  const file = join(out, "s.json");
  writeFileSync(file, JSON.stringify({
    name: "broken", baseUrl: join(root, "examples/hello/site"), timeout: 1500, viewport: { width: 800, height: 500 },
    scenes: [
      { name: "bad", steps: [{ goto: "index.html" }, { click: "text=This button does not exist" }, { click: "text=Neither does this one" }] },
      { name: "optional", steps: [{ click: { role: "button", name: "nope" }, optional: true }, { wait: 200 }] },
      { name: "good", steps: [{ goto: "app.html" }, { click: { role: "tab", name: "Done" } }] },
    ],
  }));
  const t = Date.now();
  const r = await record(loadScenario(file), { outDir: out, fast: true, mp4: false, log: quiet });
  assert.equal(r.errors.length, 1, "the scene is abandoned at the first failure, so the second bad click never runs");
  assert.match(r.errors[0], /bad \/ step 2 \(click\)/);
  assert.deepEqual(r.chapters.map((c) => c.name), ["bad", "optional", "good", "End"]);
  assert.ok(Date.now() - t < 30000, "a wrong selector must not stall the run (short timeout, scene abandoned)");
  assert.equal(r.mp4, null);
  assert.ok(existsSync(r.webm));
});

test("scenario text is shown as text, never parsed as HTML", { skip }, async () => {
  // Probe the overlay directly on a page that has it installed.
  const { overlayInit } = await import("../src/overlay.js");
  const b = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await (await b.newContext()).newPage();
    await page.addInitScript(overlayInit, { storage: {}, cursor: true });
    await page.goto("file://" + join(root, "examples/hello/site/index.html"));
    await page.evaluate(() => window.__sr.cap("<img src=x onerror=window.__pwned=1>", "<b>x</b>"));
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.equal(await page.locator("#__sr_cap img").count(), 0);
    assert.match(await page.locator("#__sr_cap b").innerText(), /<img/);
  } finally { await b.close(); }
});
