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

## Legal and compliance notes

Not legal advice; these are the places a demo recording most often causes trouble.

- **Personal data (GDPR, CCPA/CPRA and similar).** A video shows whatever is on screen. Names, emails, avatars, IDs and
  tokens in a recording are personal data. Record against **synthetic or consented** data, never real customer data,
  and keep recordings (and the `.srt`, which repeats caption text) under the same retention rules as the data itself.
- **Terms of service and automation law.** Driving someone else's website with a script can breach its terms and, in
  some jurisdictions, computer-misuse law (for example the US CFAA or the UK Computer Misuse Act). Only automate
  systems you own or are explicitly authorised to test. Respect `robots.txt` and rate limits on third-party sites.
- **Copyright and trademarks in the footage.** Logos, fonts, stock images and third-party content visible in a take
  keep their owners' rights. Make sure you may publish them.
- **Credentials.** Use `${env:NAME}` for tokens and throwaway accounts. Treat a published video as permanent.
- **Accessibility.** Many jurisdictions expect captions on published video (for example the ADA, EN 301 549 and the
  European Accessibility Act for covered services). Showrunner exports every caption as `.srt` so you can attach it.
- **Disclosure.** If a demo uses seeded or simulated data, say so; presenting staged data as real customer results
  can be misleading advertising in many jurisdictions.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (**Security -> Report a vulnerability**) on this repository.
Please do not open a public issue for security problems. I aim to acknowledge within 7 days.
