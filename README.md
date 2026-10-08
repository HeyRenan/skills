# skills

Personal Claude Code skills. Each folder is one skill with a `SKILL.md`.

| Skill | What it does |
| --- | --- |
| [env-sync](env-sync/SKILL.md) | Make the local machine match a reference environment, from any source (task, review request, branch, file, text). Generic by design. |
| [gitlab-mr-comment](gitlab-mr-comment/SKILL.md) | Post a review thread or nit on a GitLab MR in a fixed pattern, with optional screenshot. Specific to GitLab MR comments only. |
| [gitlab-mr-setup](gitlab-mr-setup/SKILL.md) | Set up the machine to run a GitLab MR's branch. Specific to GitLab MRs only. |
| [ui-check](ui-check/SKILL.md) | Verify a web page's UI with the fewest tokens: DOM and style checks first, small screenshots only when needed. Generic. |
| [handoff](handoff/SKILL.md) | Save the current state of a conversation to a compact file so a fresh chat can resume it. Generic by design. |

## Install

Link a skill into the user-level skills folder:

```bash
for s in env-sync gitlab-mr-comment gitlab-mr-setup handoff ui-check; do ln -s "$PWD/$s" ~/.claude/skills/$s; done
```
