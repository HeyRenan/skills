# skills

Personal Claude Code skills. Each folder is one skill with a `SKILL.md`.

| Skill | What it does |
| --- | --- |
| [env-sync](env-sync/SKILL.md) | Make the local machine match a reference environment, from any source (task, review request, branch, file, text). Generic by design. |

## Install

Link a skill into the user-level skills folder:

```bash
for s in env-sync; do ln -s "$PWD/$s" ~/.claude/skills/$s; done
```
