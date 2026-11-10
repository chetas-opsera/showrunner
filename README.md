# Showrunner

**Directed by JSON. Shot in Chrome.**

Showrunner records polished product-demo videos from a declarative scenario file. It drives a real, headless Chrome through your app with a **visible cursor and click ripple**, lays **captions and title cards** over the page, and hands you an **H.264 `.mp4`**, a **`.srt` subtitle file** and **chapter timestamps**, from one `showrunner run`.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933)
![Tests](https://img.shields.io/badge/tests-15%20passing-brightgreen)
![Output](https://img.shields.io/badge/output-mp4%20%2B%20srt%20%2B%20chapters-f59e0b)

[![Watch the example](docs/poster.png)](docs/example.mp4)

*Click to watch [`docs/example.mp4`](docs/example.mp4): 33 seconds, recorded by Showrunner from [`examples/hello/scenario.json`](examples/hello/scenario.json). Subtitles: [`docs/example.srt`](docs/example.srt).*

---

## Why

Product demos are usually either a screen recording of you fumbling through the app, or a pile of manual video editing. Both rot the moment the UI changes. Showrunner makes the demo **a file you can re-run**:

| Hand-recorded demo | Showrunner |
|---|---|
| Re-shoot after every UI tweak | Edit one JSON line, re-run |
| Stutters, typos, wrong tab | Deterministic: same clicks, same pacing, every take |
| Captions added in an editor | Captions are steps in the scenario, and also exported as `.srt` |
| "Where was the cursor?" | Visible cursor + click ripple baked in |
| Hard to review in a PR | A scenario is a diffable text file; run it in CI with `--strict` |

## Install

Requirements: **Node 18+** and **Google Chrome** (or any Chromium via `executablePath`). ffmpeg is bundled through `ffmpeg-static`.

```bash
git clone https://github.com/chetas-opsera/showrunner.git
cd showrunner
npm install
npm run setup       # one time: downloads Playwright's small video encoder
npm run doctor      # checks node, Chrome, ffmpeg
npm run example     # records the bundled example to examples/hello/out/
```

Use it from anywhere with `npm link` (gives you a `showrunner` command), or call `node /path/to/showrunner/bin/showrunner.mjs`.

## Quick start

Write a scenario. Targets are *what a person would see*: roles and visible names, not brittle CSS.

```json
{
  "name": "my-demo",
  "baseUrl": "http://127.0.0.1:3000",
  "scenes": [
    { "name": "Intro", "steps": [
      { "goto": "/" },
      { "card": { "title": "Acme", "text": "Product demo", "hold": 3000 } }
    ]},
    { "name": "Create a project", "steps": [
      { "caption": { "title": "1 · New project", "text": "One click to start.", "hold": 1500 } },
      { "click": { "role": "button", "name": "New project" } },
      { "type": { "into": { "label": "Name" }, "text": "Launch plan" } },
      { "press": "Enter" },
      { "wait": 1500 }
    ]}
  ]
}
```

```bash
showrunner check my-scenario.json              # validate, no browser
showrunner run   my-scenario.json --fast       # quarter-speed dry run: catches broken selectors in seconds
showrunner run   my-scenario.json --out out    # the real take
showrunner sheet out/my-demo.mp4 --every 5     # contact sheet to review the take at a glance
```

Outputs, next to each other in `--out`:

| File | What |
|---|---|
| `<name>.mp4` | H.264, yuv420p, 30 fps, `faststart`. Plays in browsers, QuickTime, Slack, GitHub |
| `<name>.webm` | The raw recording (kept for re-encoding) |
| `<name>.srt` | Every caption as a timed subtitle |
| `<name>.chapters.json` | Scene start times, ready for a video description |

## Scenario reference

### Top level

| Field | Default | Meaning |
|---|---|---|
| `name` | `demo` | Output file stem |
| `baseUrl` | none | `http(s)://` or `file://` URL, **or a directory relative to the scenario file** (served as `file://`) |
| `viewport` | `1440x900` | Also the video size |
| `theme` | `light` | `light` or `dark`: sets the browser `prefers-color-scheme` |
| `pace` | `1` | Multiplier for every wait and hold (`1.5` = slower). `--fast` multiplies by 0.25 |
| `cursor` | `true` | Draw the visible cursor and click ripple |
| `timeout` | `8000` | Per-action timeout in ms. Short on purpose: Playwright's 30 s default stalls a run on one wrong selector |
| `settle` | `800` | Extra wait after each `goto` so the page finishes painting |
| `storage` | `{}` | `localStorage` entries set on every page load. Supports `${env:NAME}` |
| `dismiss` | `[]` | Selectors clicked (if visible) after every `goto`, for tours and cookie banners |
| `browser` | `{channel:"chrome"}` | Or `{ "executablePath": "/path/to/chromium" }` |
| `scenes` | required | `[{ "name": "...", "steps": [ ... ] }]` |

### Steps

Each step has **exactly one** action. Add `"optional": true` to log-and-continue instead of failing the scene.

| Action | Value | Does |
|---|---|---|
| `goto` | `"/path"` or full URL | Navigate, wait for network idle, settle, run `dismiss` |
| `click` | target | Glide the cursor to it, press, release |
| `hover` | target | Glide and rest |
| `type` | `{ into, text, delay? }` | Click the field, type with real keystrokes |
| `press` | `"Control+k"` | A key or chord |
| `scroll` | `400` or `{ by, duration? }` | Smooth-scroll the largest scrollable area (negative scrolls up) |
| `wait` | milliseconds | Pause (scaled by `pace`) |
| `waitFor` | target | Wait until visible |
| `caption` | `{ title, text?, position?, hold? }` or `null` | Lower-third caption. `position`: `center` (default), `left`, `right`. `null` clears it. Captions clear at the end of a scene |
| `card` | `{ title, text?, items?, hold?, keep? }` or `null` | Full-screen title card. Fades out after `hold` unless `keep: true` (use for a closing card) |
| `storage` | `{ key: "value" }` | Set `localStorage` now (for example, sign in part-way through a demo) |

### Targets

A string is a Playwright selector (`"#save"`, `"text=Sign in"`). An object is human-friendly:

```json
{ "role": "button", "name": "Approve" }
{ "role": "link",   "name": "/^open the app$/i" }
{ "label": "New task" }
{ "text": "Needs your attention" }
{ "testId": "approval-record" }
```

`name`/`text`/`label` accept `"/regex/flags"`. The first match is used.

### Secrets

Never put tokens in a scenario. Use `${env:NAME}`; a missing variable is an error, not an empty string:

```json
{ "storage": { "auth_token": "${env:DEMO_TOKEN}" } }
```

```bash
DEMO_TOKEN=... showrunner run scenario.json
```

## CLI

```text
showrunner run <scenario.json> [--out DIR] [--fast] [--headed] [--no-mp4] [--strict]
showrunner check <scenario.json>
showrunner probe <url> [--json]
showrunner sheet <video> [--every S] [--cols N] [--rows N] [--out FILE]
showrunner setup
showrunner doctor
```

- `probe` opens a page and prints the buttons, links, tabs, inputs and test ids it can see, as ready-to-paste targets. This is the fastest way to write a scenario for an app you did not build.
- `--strict` exits `1` if any scene had a failing step, so a demo can be a CI check that fails when the UI drifts.
- A failing step **abandons only its own scene**. The rest still records, and failures are listed at the end.

## Authoring workflow that works

1. **Seed realistic data first.** Empty states make poor demos. Create the records you want on screen.
2. `showrunner probe <url>` on each page to find targets.
3. `showrunner check`, then `showrunner run --fast --strict`. Fix every reported step.
4. The real take. Run it in the background and wait if your tool has a timeout; a take is real-time.
5. `showrunner sheet` and look at the frames. Check that captions do not cover the thing they describe (`position: "left"` fixes most overlaps).

## Use it as a Cursor skill

`./install-skill.sh` links this repo to `~/.showrunner` and `skill/` to `~/.cursor/skills/showrunner`. The skill teaches an agent the whole workflow above, including the traps that cost real time (see [`skill/SKILL.md`](skill/SKILL.md)).

## Design

Small on purpose: about 500 lines of plain ESM, two dependencies (`playwright-core`, `ffmpeg-static`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how recording, the overlay, timing and encoding work, and why.

## Limitations

- **Real time.** A 3-minute demo takes about 3 minutes to record. There is no frame-by-frame rendering.
- **No audio.** Subtitles are exported; add narration in an editor if you want it.
- **The cursor and captions are DOM overlays.** Native OS widgets (a `<select>` popup, a file dialog) are not captured by headless Chrome and will not appear.
- **iframes:** targets do not pierce iframes.
- **Subtitle timing** is measured from the start of the page and is accurate to a fraction of a second, not frame-exact.
- Tested on macOS with Node 22 and Google Chrome. Linux should work; Windows is untested.

## Development

```bash
npm test     # 15 tests, ~20 s: unit tests + real-browser end-to-end (skipped if Chrome is missing)
```

## License

[MIT](LICENSE). Copyright (c) 2026 Chetas P. All rights reserved except as granted by the license.
