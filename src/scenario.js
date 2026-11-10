// Showrunner - Copyright (c) 2026 Chetas P. PolyForm Noncommercial 1.0.0.
// Scenario loading, validation and small pure helpers. No browser, no I/O beyond reading the scenario file.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ACTIONS = ["goto", "card", "caption", "click", "hover", "type", "press", "scroll", "wait", "waitFor", "storage"];

export const DEFAULTS = Object.freeze({
  name: "demo",
  viewport: { width: 1440, height: 900 },
  theme: "light",
  pace: 1,
  cursor: true,
  timeout: 8000,
  settle: 800,
  baseUrl: "",
  storage: {},
  dismiss: [],
  browser: { channel: "chrome" },
});

/** Replace ${env:NAME} with process.env.NAME. Missing variables are an error, never an empty string. */
export function expandEnv(value, env = process.env) {
  if (typeof value === "string") {
    return value.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
      if (env[name] === undefined) throw new Error(`environment variable ${name} is not set (referenced as \${env:${name}})`);
      return env[name];
    });
  }
  if (Array.isArray(value)) return value.map((v) => expandEnv(v, env));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandEnv(v, env)]));
  return value;
}

/** "/^approve$/i" -> RegExp, anything else stays a string. */
export function parseMatcher(s) {
  if (typeof s !== "string") return s;
  const m = s.match(/^\/(.+)\/([a-z]*)$/);
  return m ? new RegExp(m[1], m[2]) : s;
}

/** Resolve a goto target against baseUrl. Absolute URLs pass through; file: bases treat "/x" as relative. */
export function resolveUrl(base, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
  if (!base) throw new Error(`cannot open "${target}": the scenario has no baseUrl`);
  const b = base.startsWith("file:") && !base.endsWith("/") ? base + "/" : base;
  return new URL(b.startsWith("file:") ? target.replace(/^\//, "") : target, b).href;
}

/** Base URL: http(s)/file URLs are kept; anything else is a directory relative to the scenario file. */
export function resolveBase(baseUrl, scenarioDir) {
  if (!baseUrl) return "";
  if (/^(https?|file):/i.test(baseUrl)) return baseUrl;
  const href = pathToFileURL(resolve(scenarioDir, baseUrl)).href;
  return href.endsWith("/") ? href : href + "/";
}

function isTarget(t) {
  if (typeof t === "string") return t.length > 0;
  return !!t && typeof t === "object" && ["role", "text", "testId", "label"].some((k) => typeof t[k] === "string");
}

/** Returns a list of human-readable problems. Empty list means valid. */
export function validate(sc) {
  const errs = [];
  if (!sc || typeof sc !== "object") return ["scenario must be a JSON object"];
  if (!Array.isArray(sc.scenes) || sc.scenes.length === 0) errs.push("`scenes` must be a non-empty array");
  if (sc.pace !== undefined && !(typeof sc.pace === "number" && sc.pace > 0 && sc.pace <= 10)) errs.push("`pace` must be a number in (0, 10]");
  if (sc.theme !== undefined && !["light", "dark"].includes(sc.theme)) errs.push("`theme` must be \"light\" or \"dark\"");
  const vp = sc.viewport;
  if (vp !== undefined && !(vp && Number.isInteger(vp.width) && Number.isInteger(vp.height) && vp.width >= 320 && vp.height >= 240)) errs.push("`viewport` needs integer width >= 320 and height >= 240");
  (sc.scenes || []).forEach((scene, i) => {
    const where = `scenes[${i}]${scene?.name ? ` (${scene.name})` : ""}`;
    if (!scene || typeof scene.name !== "string" || !scene.name) errs.push(`${where}: \`name\` is required`);
    if (!Array.isArray(scene?.steps) || scene.steps.length === 0) { errs.push(`${where}: \`steps\` must be a non-empty array`); return; }
    scene.steps.forEach((step, j) => {
      const at = `${where}.steps[${j}]`;
      const keys = Object.keys(step || {}).filter((k) => ACTIONS.includes(k));
      if (keys.length !== 1) { errs.push(`${at}: needs exactly one action of ${ACTIONS.join(", ")} (found ${keys.length})`); return; }
      const a = keys[0], v = step[a];
      if (a === "goto" && typeof v !== "string") errs.push(`${at}: goto expects a string`);
      if (["click", "hover", "waitFor"].includes(a) && !isTarget(v)) errs.push(`${at}: ${a} expects a selector string or {role|text|testId|label}`);
      if (a === "type" && !(v && isTarget(v.into) && typeof v.text === "string")) errs.push(`${at}: type expects {into, text}`);
      if (a === "press" && typeof v !== "string") errs.push(`${at}: press expects a key string such as "Control+k"`);
      if (a === "wait" && !(typeof v === "number" && v >= 0)) errs.push(`${at}: wait expects milliseconds`);
      if (a === "scroll" && !(typeof v === "number" || (v && typeof v.by === "number"))) errs.push(`${at}: scroll expects a number or {by, duration}`);
      if (a === "card" && v && typeof v === "object" && typeof v.title !== "string") errs.push(`${at}: card expects {title, text?, items?, hold?}`);
      if (a === "caption" && v && typeof v === "object" && typeof v.title !== "string") errs.push(`${at}: caption expects {title, text?, position?, hold?} or null to clear`);
      if (a === "storage" && !(v && typeof v === "object" && !Array.isArray(v))) errs.push(`${at}: storage expects an object of key/value strings`);
    });
  });
  return errs;
}

/** Read, expand ${env:...}, validate, and fill defaults. Throws one Error listing every problem. */
export function loadScenario(file, env = process.env) {
  const abs = resolve(file);
  let raw;
  try { raw = JSON.parse(readFileSync(abs, "utf8")); } catch (e) { throw new Error(`cannot read scenario ${abs}: ${e.message}`); }
  const problems = validate(raw);
  if (problems.length) throw new Error(`invalid scenario ${abs}:\n  - ${problems.join("\n  - ")}`);
  const sc = expandEnv({ ...DEFAULTS, ...raw, viewport: { ...DEFAULTS.viewport, ...raw.viewport }, browser: { ...DEFAULTS.browser, ...raw.browser } }, env);
  sc.baseUrl = resolveBase(sc.baseUrl, dirname(abs));
  sc.file = abs;
  return sc;
}

export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, w) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
}

/** cues: [{start, end, title, text}] in seconds -> SubRip text. Zero-length cues are dropped. */
export function toSrt(cues) {
  return cues
    .filter((c) => c.end - c.start > 0.05)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.title}${c.text ? `\n${c.text}` : ""}\n`)
    .join("\n");
}
