# skills

Personal Claude Code skills. Each folder is one skill with a `SKILL.md`.

| Skill | What it does |
| --- | --- |
| [env-sync](env-sync/SKILL.md) | Make the local machine match a reference environment, from any source (task, review request, branch, file, text). Generic by design. |
| [gitlab-mr-comment](gitlab-mr-comment/SKILL.md) | Post a review thread or nit on a GitLab MR in a fixed pattern, with optional screenshot. Specific to GitLab MR comments only. |
| [gitlab-mr-setup](gitlab-mr-setup/SKILL.md) | Set up the machine to run a GitLab MR's branch. Specific to GitLab MRs only. |

## Install

Link a skill into the user-level skills folder:

```bash
for s in env-sync gitlab-mr-comment gitlab-mr-setup; do ln -s "$PWD/$s" ~/.claude/skills/$s; done
```
