# Security Policy

## Threat model

Showrunner launches a real browser **with your permissions** and replays a scenario file against a URL you choose.

| Risk | Mitigation | Residual |
|---|---|---|
| A malicious scenario executes code | Scenarios are JSON data. There is no `eval`, script hook or shell step. Only navigate / click / type / press / scroll / wait / set `localStorage` | A scenario can still *click and type* in whatever app you point it at, with whatever session that app has |
| Markup injection through captions or cards | All overlay text is inserted as escaped text (covered by a mutation-checked test) | None known |
| Secrets in scenario files | `${env:NAME}` substitution; a missing variable is an error, never an empty string | You must not paste a token into the file yourself |
| Secrets in the video | None. The video shows whatever the page shows | **Do not record production data or real credentials.** Review the video before sharing |
| Arbitrary file reads via `file://` base URLs | The browser can open local files you point it at | Only run scenarios you trust; they choose the URLs |

## Advice

- Record against local or staging environments with throwaway accounts.
- Treat a scenario from someone else like a script: read it first.
- The video and `.srt` may contain anything visible on screen. Review before publishing.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (**Security -> Report a vulnerability**) on this repository.
Please do not open a public issue for security problems. I aim to acknowledge within 7 days.
