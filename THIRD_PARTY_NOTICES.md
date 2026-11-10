# Third-party notices

Showrunner's own code is PolyForm Noncommercial 1.0.0 (see `LICENSE`). **No third-party code is bundled or copied into this
repository**: the packages below are fetched by `npm install` from the npm registry and keep their own licenses.

| Package | Version | License | Optional |
|---|---|---|---|
| `@derhuerst/http-basic` | 8.2.4 | MIT | yes |
| `@types/node` | 10.17.60 | MIT | yes |
| `agent-base` | 6.0.2 | MIT | yes |
| `buffer-from` | 1.1.2 | MIT | yes |
| `caseless` | 0.12.0 | Apache-2.0 | yes |
| `concat-stream` | 2.0.0 | MIT | yes |
| `debug` | 4.4.3 | MIT | yes |
| `env-paths` | 2.2.1 | MIT | yes |
| `ffmpeg-static` | 5.3.0 | GPL-3.0-or-later | yes |
| `http-response-object` | 3.0.2 | MIT | yes |
| `https-proxy-agent` | 5.0.1 | MIT | yes |
| `inherits` | 2.0.4 | ISC | yes |
| `ms` | 2.1.3 | MIT | yes |
| `parse-cache-control` | 1.0.1 | BSD-3-Clause (declared as `BSD` in its legacy `licenses` field; text in the package's LICENSE) | yes |
| `playwright-core` | 1.65.0 | Apache-2.0 | no |
| `progress` | 2.0.3 | MIT | yes |
| `readable-stream` | 3.6.2 | MIT | yes |
| `safe-buffer` | 5.2.1 | MIT | yes |
| `string_decoder` | 1.3.0 | MIT | yes |
| `typedarray` | 0.0.6 | MIT | yes |
| `util-deprecate` | 1.0.2 | MIT | yes |

## Notes

- **`ffmpeg-static` is GPL-3.0-or-later** and ships an ffmpeg binary built under the GPL. Showrunner keeps it at arm's length on purpose: it is an *optional* dependency, Showrunner locates the binary by file path and runs it as a **separate process**, and it never imports that package's JavaScript. If you redistribute a bundle that *includes* ffmpeg, you are responsible for GPL compliance for that bundle (source offer, license text). Using your own ffmpeg via the `FFMPEG` environment variable avoids this entirely.
- **`playwright-core` is Apache-2.0**. Its license and NOTICE are in its npm package.
- **Google Chrome** is not included. Showrunner drives a browser you already have installed, under Google's terms.
- Product and company names are trademarks of their owners and are used only to describe compatibility.
