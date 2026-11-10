#!/usr/bin/env node
// Showrunner - Copyright (c) 2026 Chetas P. MIT License.
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadScenario } from "../src/scenario.js";
import { findFfmpeg, run, sheetArgs } from "../src/encode.js";

const HELP = `showrunner - record polished product-demo videos from a scenario file

Usage
  showrunner run <scenario.json> [--out DIR] [--fast] [--headed] [--no-mp4] [--strict]
  showrunner check <scenario.json>        validate a scenario without opening a browser
  showrunner probe <url> [--json]         list clickable/typeable targets on a page
  showrunner sheet <video> [--every S] [--cols N] [--rows N] [--out FILE]
                                          contact sheet of frames, for reviewing a take
  showrunner setup                        download the recorder's ffmpeg (one time)
  showrunner doctor                       check Node, Chrome, ffmpeg

Options
  --fast     quarter-speed waits: a quick dry run to catch broken selectors
  --strict   exit 1 if any scene had a failing step (CI)
  --headed   show the browser window while recording
`;

function parse(argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (["out", "every", "cols", "rows"].includes(k)) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}

const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };
const { flags, pos } = parse(process.argv.slice(2));
const cmd = pos.shift();

switch (cmd) {
  case "run": {
    if (!pos[0]) fail(HELP, 2);
    let sc;
    try { sc = loadScenario(pos[0]); } catch (e) { fail(e.message, 2); }
    const { record } = await import("../src/recorder.js");
    const outDir = resolve(flags.out || "showrunner-out");
    const t = Date.now();
    let r;
    try { r = await record(sc, { outDir, fast: !!flags.fast, headed: !!flags.headed, mp4: !flags["no-mp4"] }); } catch (e) { fail(e.message); }
    console.log(`\nrecorded ${r.seconds.toFixed(0)}s of video in ${((Date.now() - t) / 1000).toFixed(0)}s`);
    console.log(`  video:    ${r.mp4 || r.webm}`);
    console.log(`  chapters: ${join(outDir, sc.name + ".chapters.json")}`);
    if (r.cues.length) console.log(`  captions: ${join(outDir, sc.name + ".srt")}`);
    if (r.errors.length) {
      console.log(`\n${r.errors.length} scene(s) had a failing step:`);
      for (const e of r.errors) console.log(`  - ${e}`);
      if (flags.strict) process.exit(1);
    }
    break;
  }
  case "check": {
    if (!pos[0]) fail(HELP, 2);
    try { const sc = loadScenario(pos[0]); const n = sc.scenes.reduce((a, s) => a + s.steps.length, 0); console.log(`ok: ${sc.scenes.length} scenes, ${n} steps`); } catch (e) { fail(e.message, 2); }
    break;
  }
  case "probe": {
    if (!pos[0]) fail(HELP, 2);
    const { probe } = await import("../src/probe.js");
    const r = await probe(pos[0]).catch((e) => fail(`probe failed: ${String(e.message).split("\n")[0]}`));
    if (flags.json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`${r.title} - ${r.url}`);
      for (const k of ["headings", "links", "buttons", "tabs", "inputs", "testIds"]) {
        if (!r[k].length) continue;
        console.log(`\n${k}:`);
        for (const x of r[k]) console.log("  " + (typeof x === "string" ? JSON.stringify(x) : JSON.stringify(x)));
      }
    }
    break;
  }
  case "sheet": {
    if (!pos[0]) fail(HELP, 2);
    const ff = await findFfmpeg();
    if (!ff) fail("no ffmpeg found (run `npm install`)");
    const out = flags.out || pos[0].replace(/\.[^.]+$/, "") + ".sheet.png";
    run(ff, sheetArgs(pos[0], out, { every: Number(flags.every || 10), cols: Number(flags.cols || 4), rows: Number(flags.rows || 3) }));
    console.log(out);
    break;
  }
  case "setup": {
    const req = createRequire(import.meta.url);
    const cli = join(dirname(req.resolve("playwright-core/package.json")), "cli.js");
    const r = spawnSync(process.execPath, [cli, "install", "ffmpeg"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
    break;
  }
  case "doctor": {
    let ok = true;
    const line = (good, name, extra = "") => { ok &&= good; console.log(`[${good ? "ok" : "FAIL"}] ${name}${extra ? "  " + extra : ""}`); };
    line(Number(process.versions.node.split(".")[0]) >= 18, "node >= 18", process.version);
    const chrome = ["/Applications/Google Chrome.app", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);
    line(!!chrome, "Google Chrome", chrome || "not found: install it, or set browser.executablePath in the scenario");
    const ff = await findFfmpeg();
    line(!!ff, "ffmpeg for mp4 encoding", ff || "not found: run `npm install` (ffmpeg-static) or install ffmpeg");
    const cache = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(process.env.HOME || "", "Library/Caches/ms-playwright"), join(process.env.HOME || "", ".cache/ms-playwright")].filter(Boolean);
    const pw = cache.some((d) => existsSync(d) && ls(d).some((n) => n.startsWith("ffmpeg")));
    line(pw, "Playwright video encoder", pw ? "" : "not installed: run `showrunner setup`");
    process.exit(ok ? 0 : 1);
    break;
  }
  default:
    console.log(HELP);
    process.exit(cmd && cmd !== "help" && cmd !== "--help" ? 2 : 0);
}

function ls(d) {
  try { return readdirSync(d); } catch { return []; }
}
