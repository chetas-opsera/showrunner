---
name: showrunner
description: Record a polished product-demo video (mp4 + subtitles + chapters) of a web app from a JSON scenario, using a scripted headless Chrome with captions, title cards and a visible cursor. Use when the user asks for a demo video, product walkthrough, screen recording, or "record the UI changes" for a web app they can run locally or on staging.
---

# Showrunner

Turns "make me a demo video of this app" into a repeatable, reviewable file. CLI: `node ~/.showrunner/bin/showrunner.mjs`
(or `showrunner` if linked). Install once with `./install-skill.sh` from the repo.

## When to use

The user wants a video of a **web UI** that you can open in a browser: a product demo, a feature walkthrough, a
"show what changed" recording, a tutorial. Not for native desktop apps or anything needing audio narration.

## Protocol: think first, then execute

1. **Confirm it is safe to record.** Local, staging or throwaway data only. Never record production with real customer
   data. Never put tokens in the scenario; use `${env:NAME}`.
2. **Get the app running and seed realistic data.** Empty states make a poor demo. Create the records the story needs
   (a success case, a failure case, an in-progress case).
3. **Write the storyboard before the JSON.** A demo under 4 minutes: title card, 8-12 scenes of 8-20 s, closing summary
   card. One idea per scene. Captions say *what the viewer should notice*, not what the mouse is doing.
4. **Find targets with `probe`.** `showrunner probe <url>` for each page; paste the `{role,name}` objects it prints.
   Prefer roles and visible names over CSS.
5. **Validate then dry-run.** `showrunner check s.json`, then `showrunner run s.json --fast --strict`. A dry run is
   about a quarter of the real length. Fix every reported step before the real take.
6. **Record the real take** (`showrunner run s.json --out out`). It runs in real time, so start it in the background
   and wait for it; do not block a tool call for minutes.
7. **Review the frames.** `showrunner sheet out/<name>.mp4 --every 5`, then open the PNG. Look for: caption covering the
   subject (use `"position": "left"`), a scene that errored, popups or tours leaking in, the wrong theme.
8. **Report** the path, duration, resolution, the scene list, and anything that did not work. Do not commit or push the
   video unless asked.

## Traps that cost real time

| Symptom | Cause | Fix |
|---|---|---|
| Run hangs for minutes | One wrong selector with a 30 s default timeout, repeated | Showrunner defaults to 8 s and abandons the scene; run `--fast --strict` first |
| A link or button "is not visible" | Sidebar collapses or a menu is closed in that state | `goto` a known page first, or target the page URL directly |
| First-run tour pops up mid-video | App shows onboarding to new users | Set the app's "tour seen" keys in `storage`, or list a Skip button in `dismiss` |
| `getByText` matches a hidden duplicate | Text appears in a hidden node too | Use `{ "role": "button", "name": "/^ITEM-1\\b/" }` |
| Docs sidebar items do nothing | They are `<button>`s, not links | Target `{ "role": "button", ... }` |
| Caption hides the drawer or form | Bottom-centre caption overlaps a side panel | `"position": "left"` or `"right"` |
| Take dies when the shell exits | Backgrounded job tied to the terminal | Run it as a proper background task and poll for completion |
| Video is blank or tiled | Capturing an IDE-embedded browser | Use Showrunner's own headless Chrome, not a webview |
| Subtitles drift slightly | Cues are timed from page creation | Fine for review; not frame-exact |

## Scenario cheat-sheet

```json
{
  "name": "demo", "baseUrl": "http://127.0.0.1:3000", "viewport": {"width":1440,"height":900},
  "storage": { "token": "${env:DEMO_TOKEN}" },
  "dismiss": ["text=Skip"],
  "scenes": [
    { "name": "Title", "steps": [ {"goto":"/"}, {"card":{"title":"Acme","text":"Demo","hold":3000}} ] },
    { "name": "Create", "steps": [
      {"caption":{"title":"1 · Create","text":"One click.","position":"left","hold":1500}},
      {"click":{"role":"button","name":"New"}},
      {"type":{"into":{"label":"Name"},"text":"Launch plan"}},
      {"press":"Enter"}, {"wait":1500}
    ]},
    { "name": "Summary", "steps": [ {"caption":null}, {"card":{"title":"Summary","items":["A","B"],"hold":4000,"keep":true}} ] }
  ]
}
```

Actions: `goto click hover type press scroll wait waitFor caption card storage` (+ `"optional": true` on any step).
Full reference: the repository README.

## Safety

- Scenarios are data: no code execution, no shell. Caption text is escaped.
- A failing step abandons only its scene; `--strict` makes the exit code 1.
- Never commit, push or share the video unless the user asks.
