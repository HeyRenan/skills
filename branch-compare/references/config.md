# Config reference

`.branch-compare.json` in the repo root. It is git-excluded automatically.

## Contents
- Modes
- Options
- Motion scenarios
- How it works

## Modes

Pick one. Two URLs on the command line override it.

**serve** (any project). Each ref is checked out in its own git worktree, built, and served on a free port:

```json
{
  "serve": { "command": "npx serve -l {port} dist", "cwd": ".", "ready": "/" },
  "build": ["npm ci", "npm run build"],
  "base": "main",
  "viewports": [375, 768, 1440],
  "hide": [".cookie-banner"],
  "pages": ["/", { "path": "/contact/", "selector": ".form-section" }],
  "motion": [
    { "name": "menu-open", "page": "/", "viewport": 375, "action": { "click": ".nav-toggle" }, "region": "viewport" },
    { "name": "btn-hover", "page": "/", "action": { "hover": ".btn" } }
  ]
}
```

- `serve.command`: starts the server. `{port}` is replaced and also set as `PORT`. Must stay in the foreground.
- `serve.cwd`: folder inside the checkout to run it in. `serve.ready`: path polled until the server answers (default `/`). `serve.env`: extra variables.
- `live` (the working tree) is served from the repo itself and is not built: build it yourself first.

**urls**: `compare.mjs https://a.example https://b.example`. Both sides are already running, for example staging against local. No caching.

**wordpress-theme**: for a WordPress theme repo served by one local site. Set `"mode": "wordpress-theme"` and `"baseUrl": "http://site.test"` (local `.test` or `.localhost` hosts only). A mu-plugin is installed once and switches the active theme per request by cookie, so both versions share one database and one server.

## Options

| Key | Default | Meaning |
| --- | --- | --- |
| `base` | `main` | default `refA` |
| `build` | `[]` | commands run once inside each ref's worktree |
| `viewports` | `[375, 768, 1440]` | widths for static shots |
| `pages` | `["/"]` | paths, or `{ path, selector, name }` to shoot one element |
| `hide` | `[]` | selectors set to `visibility:hidden` (banners, sliders, dynamic content) |
| `watch` | `["build", "dist"]` | folders whose file times invalidate the cache for `live` |
| `concurrency` | `3` | parallel captures |
| `minDiffPx` | `50` | pixels that count as a difference |

## Motion scenarios

Keys: `name`, `page`, `action`, optional `setup` (steps run first), `region` (selector or `"viewport"`, default = the action target), `pad`, `viewport`, `duration` (ms, default 500), `frames` (default 12), `fps` (default 8), `realtime`.

Steps: `hover`, `click`, `focus`, `press`, `fill` (`[selector, value]`), `scroll`, `wait`.

By default CSS transitions and animations are sought frame by frame, which is deterministic. For animations driven by JavaScript set `"realtime": true`. The summary warns when no CSS animation was found.

## How it works

- Each ref gets a worktree named `<repo>__cmp-<sha7>`, built once and reused (`--clean` removes them).
- Third-party requests are blocked and lazy images forced to load, so shots are stable.
- A diff is only reported if it survives a second capture.
- Shots are cached under `.compare-out/cache/` by commit, plus the dirty state for the working tree.
