# skills

Personal Claude Code skills. Each folder is one skill with a `SKILL.md`.

| Skill | What it does |
| --- | --- |
| [env-sync](env-sync/SKILL.md) | Make the local machine match a reference environment, from any source (task, review request, branch, file, text). Generic by design. |
| [gitlab-mr-comment](gitlab-mr-comment/SKILL.md) | Post a review thread or nit on a GitLab MR in a fixed pattern, with optional screenshot. Specific to GitLab MR comments only. |
| [gitlab-mr-check-fixes](gitlab-mr-check-fixes/SKILL.md) | Check whether the review threads reported on a GitLab MR were fixed, comparing each thread's lines with what changed since. Specific to GitLab MRs only. |
| [gitlab-mr-setup](gitlab-mr-setup/SKILL.md) | Set up the machine to run a GitLab MR's branch. Specific to GitLab MRs only. |
| [wrike-task](wrike-task/SKILL.md) | Read a Wrike task, decide its state (to do, in progress, needs changes, waiting review, done) and act on it. Self-sufficient; uses other skills only if present. Specific to Wrike. |
| [wrike-time-log](wrike-time-log/SKILL.md) | Calculate time spent on a Wrike task from its status history (work and review), round to 30-minute steps, dated today, and add to time already recorded. Specific to Wrike. |
| [branch-compare](branch-compare/SKILL.md) | Visually and functionally compare two versions of a web project (refs, working tree or URLs): pixel diffs, text, errors, animation GIFs. Generic; WordPress theme mode included. |
| [lp-export](lp-export/SKILL.md) | Export and adapt a RD Station landing page into the Método Supera WordPress repo. Project-specific (pt-BR), rules kept intact in `references/`. |
| [session-recover](session-recover/SKILL.md) | Recover the context of an earlier session from a handoff file or the saved transcripts, checked against the repo. Generic. |
| [ui-check](ui-check/SKILL.md) | Verify a web page's UI with the fewest tokens: DOM and style checks first, small screenshots only when needed. Generic. |
| [handoff](handoff/SKILL.md) | Save the current state of a conversation to a compact file so a fresh chat can resume it. Generic by design. |

## Install

Link a skill into the user-level skills folder:

```bash
for s in env-sync gitlab-mr-comment gitlab-mr-check-fixes gitlab-mr-setup handoff ui-check wrike-task wrike-time-log branch-compare lp-export session-recover; do ln -s "$PWD/$s" ~/.claude/skills/$s; done
```
