// Showrunner - Copyright (c) 2026 Chetas P. PolyForm Noncommercial 1.0.0.
// Plays a validated scenario in a real (headless) Chrome with video recording on, and returns the artefacts.
import { chromium } from "playwright-core";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { overlayInit } from "./overlay.js";
import { ACTIONS, parseMatcher, resolveUrl, toSrt } from "./scenario.js";
import { findFfmpeg, mp4Args, run } from "./encode.js";

export function locatorFor(page, t) {
  if (typeof t === "string") return page.locator(t).first();
  if (t.role) return page.getByRole(t.role, { name: parseMatcher(t.name), exact: t.exact }).first();
  if (t.text) return page.getByText(parseMatcher(t.text), { exact: t.exact }).first();
  if (t.testId) return page.getByTestId(t.testId).first();
  if (t.label) return page.getByLabel(parseMatcher(t.label), { exact: t.exact }).first();
  throw new Error("unusable target");
}

export function describeTarget(t) {
  return typeof t === "string" ? t : JSON.stringify(t);
}

/**
 * @returns {{webm:string, mp4:string|null, chapters:object[], cues:object[], errors:string[], seconds:number}}
 */
export async function record(sc, { outDir, fast = false, headed = false, mp4 = true, log = console.log } = {}) {
  const pace = sc.pace * (fast ? 0.25 : 1);
  const T = (ms) => Math.round(ms * pace);
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(join(outDir, ".rec-"));

  const launch = { headless: !headed };
  if (sc.browser.executablePath) launch.executablePath = sc.browser.executablePath; else launch.channel = sc.browser.channel;
  let browser;
  try { browser = await chromium.launch(launch); } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`cannot start the browser (${sc.browser.executablePath || sc.browser.channel}): ${String(e.message).split("\n")[0]}\n` +
      `Install Google Chrome, or set "browser": {"executablePath": "/path/to/chromium"} in the scenario. Run \`showrunner doctor\`.`);
  }
  const ctx = await browser.newContext({ viewport: sc.viewport, recordVideo: { dir: tmp, size: sc.viewport }, colorScheme: sc.theme });
  await ctx.addInitScript(overlayInit, { storage: sc.storage, cursor: sc.cursor });
  const page = await ctx.newPage();
  page.setDefaultTimeout(sc.timeout); // Playwright's 30 s default turns one wrong selector into a stalled run

  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const chapters = [];
  const cues = [];
  const errors = [];
  let openCue = null;
  const closeCue = () => { if (openCue) { openCue.end = now(); cues.push(openCue); openCue = null; } };
  const wait = (ms) => page.waitForTimeout(T(ms));

  const setCaption = async (c) => {
    closeCue();
    if (!c) { await page.evaluate(() => window.__sr?.cap()); return; }
    openCue = { start: now(), end: 0, title: c.title, text: c.text || "" };
    await page.evaluate(([a, b, p]) => window.__sr?.cap(a, b, p), [c.title, c.text, c.position]);
  };

  async function glide(box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: fast ? 6 : 28 });
  }
  async function aim(target) {
    const loc = locatorFor(page, target);
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    if (!box) throw new Error(`not visible: ${describeTarget(target)}`);
    await glide(box);
    return loc;
  }
  async function scrollMain(by, duration = 2200) {
    await page.evaluate(async ([d, dur]) => {
      const cands = [...document.querySelectorAll("main, main *, body > div *")].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 40);
      const el = cands.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0] || document.scrollingElement;
      const start = el.scrollTop, t = performance.now();
      await new Promise((res) => { const step = (n) => { const p = Math.min(1, (n - t) / dur); el.scrollTop = start + d * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2); p < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
    }, [by, T(duration)]);
  }

  const actions = {
    async goto(url) {
      await page.goto(resolveUrl(sc.baseUrl, url), { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await wait(sc.settle);
      for (const sel of sc.dismiss) { // first-run tours, cookie banners: skipped quietly so they never appear in the video
        const loc = page.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) { await loc.click().catch(() => {}); await wait(300); }
      }
    },
    async card(c) {
      if (!c) { await page.evaluate(() => window.__sr?.card()); return; }
      await page.evaluate(([a, b, i]) => window.__sr?.card(a, b, i), [c.title, c.text, c.items]);
      await wait(c.hold ?? 3000);
      if (c.keep) return; // closing card: stay on screen until the video ends
      await page.evaluate(() => window.__sr?.card());
      await wait(900);
    },
    async caption(c) { await setCaption(c || null); if (c?.hold) await wait(c.hold); },
    async click(t) { await aim(t); await wait(350); await page.mouse.down(); await page.mouse.up(); await wait(500); },
    async hover(t) { await aim(t); await wait(600); },
    async type({ into, text, delay = 40 }) {
      await actions.click(into);
      await page.keyboard.type(text, { delay: fast ? Math.min(delay, 8) : delay });
      await wait(500);
    },
    async press(key) { await page.keyboard.press(key); await wait(500); },
    async scroll(v) { const o = typeof v === "number" ? { by: v } : v; await scrollMain(o.by, o.duration); },
    async wait(ms) { await wait(ms); },
    async waitFor(t) { await locatorFor(page, t).waitFor({ state: "visible" }); },
    async storage(obj) {
      await page.evaluate((o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, String(v)); }, obj);
    },
  };

  for (const scene of sc.scenes) {
    chapters.push({ name: scene.name, at: Number(now().toFixed(1)) });
    log(`[${String(Math.round(now())).padStart(3)}s] ${scene.name}`);
    for (const [i, step] of scene.steps.entries()) {
      const action = ACTIONS.find((k) => Object.hasOwn(step, k)); // never look up arbitrary keys on `actions`
      try { await actions[action](step[action]); } catch (e) {
        const msg = `${scene.name} / step ${i + 1} (${action}): ${String(e.message).split("\n")[0]}`;
        if (step.optional) { log(`   ~ skipped optional step: ${msg}`); continue; }
        errors.push(msg);
        log(`   ! ${msg}`);
        break; // abandon the rest of this scene, carry on with the next one
      }
    }
    await setCaption(null);
  }
  chapters.push({ name: "End", at: Number(now().toFixed(1)) });
  const seconds = now();

  const video = page.video();
  await ctx.close(); // flushes the recording
  const src = await video.path();
  await browser.close();

  const base = join(outDir, sc.name);
  const webm = `${base}.webm`;
  renameSync(src, webm);
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(`${base}.chapters.json`, JSON.stringify(chapters, null, 2));
  if (cues.length) writeFileSync(`${base}.srt`, toSrt(cues));

  let mp4Path = null;
  if (mp4) {
    const ff = await findFfmpeg();
    if (!ff) log("   ! no ffmpeg found: kept the .webm only (install ffmpeg or `npm install` to get ffmpeg-static)");
    else { mp4Path = `${base}.mp4`; run(ff, mp4Args(webm, mp4Path)); }
  }
  return { webm, mp4: mp4Path, chapters, cues, errors, seconds };
}