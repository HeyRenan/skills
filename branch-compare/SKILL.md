---
name: branch-compare
description: Visually and functionally compares two versions of a web project (git ref vs ref, ref vs working tree, or two URLs): pixel diffs, text changes, new console or network errors, and hover or click animation GIFs. Use when the user wants to see what changed on a site between branches, review a branch visually, or get before/after of a page, section or animation.
argument-hint: [refA] [refB | url urlB] [--only=text]
---

Run from inside the project repo. The script does all the work: do not take screenshots yourself.

## Setup

- Missing modules (`Cannot find package`): `npm install --prefix ~/.claude/skills/branch-compare`. GIFs need `ffmpeg`.
- Config: `.branch-compare.json` in the repo root. If it is missing, create it from [references/config.md](references/config.md): find how the project serves (package scripts, README), pick the key pages and the hover or click motions worth comparing, and list dynamic elements to hide.

## Run

```bash
node ~/.claude/skills/branch-compare/compare.mjs [refA] [refB] [--only=text] [--no-motion] [--no-static] [--fresh] [--no-open]
node ~/.claude/skills/branch-compare/compare.mjs <urlA> <urlB>     # two live URLs
node ~/.claude/skills/branch-compare/compare.mjs --clean           # remove worktrees and .compare-out
```

- `refA` defaults to `base` from the config (`main`). `refB` defaults to `live`: the working tree, uncommitted changes included.
- `--only=text` keeps pages whose path (or motions whose name) contains `text`. Use it to go fast.
- `--fresh` ignores cached shots. Needed after changing content outside the code, because the cache only tracks code.
- The HTML report opens in the browser when something differs.

## Read the result

About 20 lines. Do not open images unless the user asks. Report the summary lines and the report path.

- `DIFF <page> @<width> <pct>% rows a-b`: pixel difference; `rows` is the vertical range that changed. `size A->B`: page height changed.
- `ERR+`: new console error or failed request in B only.
- `TEXT changed`: visible text differs.
- `DIFF motion <name>`: GIF at `.compare-out/run/motion/<name>.gif`, panels A | B | diff.
- `FAIL`: capture failed (selector missing, timeout, server not reachable).
