// Showrunner - Copyright (c) 2026 Chetas P. MIT License.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandEnv, loadScenario, parseMatcher, resolveBase, resolveUrl, srtTime, toSrt, validate } from "../src/scenario.js";
import { mp4Args, sheetArgs } from "../src/encode.js";

const ok = () => ({ scenes: [{ name: "a", steps: [{ goto: "/x" }] }] });

test("expandEnv substitutes ${env:NAME} recursively", () => {
  assert.deepEqual(expandEnv({ a: "t-${env:TOK}", b: ["${env:TOK}"], n: 3 }, { TOK: "123" }), { a: "t-123", b: ["123"], n: 3 });
});

test("expandEnv refuses a missing variable instead of writing an empty secret", () => {
  assert.throws(() => expandEnv("${env:NOPE}", {}), /NOPE is not set/);
});

test("parseMatcher turns /re/flags into a RegExp and leaves strings alone", () => {
  assert.ok(parseMatcher("/^approve$/i").test("Approve"));
  assert.equal(parseMatcher("Approve"), "Approve");
  assert.equal(parseMatcher("a/b"), "a/b");
});

test("resolveUrl handles http bases, file bases and absolute targets", () => {
  assert.equal(resolveUrl("http://127.0.0.1:3000", "/dashboard"), "http://127.0.0.1:3000/dashboard");
  assert.equal(resolveUrl("file:///tmp/site/", "/app.html"), "file:///tmp/site/app.html");
  assert.equal(resolveUrl("file:///tmp/site", "index.html"), "file:///tmp/site/index.html");
  assert.equal(resolveUrl("http://a", "https://b/c"), "https://b/c");
  assert.throws(() => resolveUrl("", "/x"), /no baseUrl/);
});

test("resolveBase keeps URLs and resolves directories relative to the scenario", () => {
  assert.equal(resolveBase("https://example.test", "/s"), "https://example.test");
  assert.equal(resolveBase("site", "/tmp/s"), "file:///tmp/s/site/");
  assert.equal(resolveBase("", "/tmp/s"), "");
});

test("validate accepts a minimal scenario", () => {
  assert.deepEqual(validate(ok()), []);
});

test("validate reports every problem with a path", () => {
  const errs = validate({
    pace: 0,
    theme: "blue",
    scenes: [
      { name: "", steps: [{ click: "" }] },
      { name: "b", steps: [{ goto: "/a", click: "#x" }, { wait: -1 }, { type: { text: "x" } }, { nope: 1 }, { press: 5 }] },
      { name: "c", steps: [] },
    ],
  });
  const text = errs.join("\n");
  for (const needle of ["pace", "theme", "scenes[0]", "`name` is required", "exactly one action", "wait expects milliseconds", "type expects", "press expects", "`steps` must be a non-empty array"]) {
    assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), needle);
  }
});

test("validate allows null to clear a caption or card", () => {
  assert.deepEqual(validate({ scenes: [{ name: "a", steps: [{ caption: null }, { card: null }] }] }), []);
});

test("loadScenario fills defaults, expands env and resolves baseUrl", () => {
  const dir = mkdtempSync(join(tmpdir(), "sr-"));
  const file = join(dir, "s.json");
  writeFileSync(file, JSON.stringify({ baseUrl: "site", storage: { token: "${env:SR_T}" }, ...ok() }));
  const sc = loadScenario(file, { SR_T: "abc" });
  assert.equal(sc.storage.token, "abc");
  assert.equal(sc.theme, "light");
  assert.equal(sc.viewport.width, 1440);
  assert.match(sc.baseUrl, /^file:\/\/.*\/site\/$/);
});

test("loadScenario reports invalid JSON and invalid scenarios clearly", () => {
  const dir = mkdtempSync(join(tmpdir(), "sr-"));
  const bad = join(dir, "bad.json");
  writeFileSync(bad, "{ nope");
  assert.throws(() => loadScenario(bad), /cannot read scenario/);
  writeFileSync(bad, JSON.stringify({ scenes: [] }));
  assert.throws(() => loadScenario(bad), /non-empty array/);
});

test("srt timing and cue filtering", () => {
  assert.equal(srtTime(3723.456), "01:02:03,456");
  const srt = toSrt([{ start: 1, end: 3, title: "A", text: "b" }, { start: 4, end: 4.01, title: "dropped", text: "" }]);
  assert.match(srt, /^1\n00:00:01,000 --> 00:00:03,000\nA\nb\n/);
  assert.doesNotMatch(srt, /dropped/);
});

test("ffmpeg arguments produce a universally playable mp4", () => {
  const a = mp4Args("in.webm", "out.mp4");
  for (const f of ["libx264", "yuv420p", "+faststart", "-an"]) assert.ok(a.includes(f), f);
  assert.deepEqual(a.slice(-1), ["out.mp4"]);
  assert.ok(sheetArgs("v.mp4", "s.png", { every: 5, cols: 3, rows: 2 }).join(" ").includes("fps=1/5,scale=480:-1,tile=3x2"));
});
