---
name: gitlab-mr-check-fixes
description: Checks whether the review threads reported on a GitLab merge request were actually fixed, by comparing each thread's lines with what changed since it was opened. Reports fixed, partial, not fixed or needs a visual check, per thread, with the thread link. Use when the user asks if the comments, threads or adjustments on an MR were done, fixed or addressed.
argument-hint: <MR iid | url> [all]
---

Check if the threads reported on the MR in `$ARGUMENTS` were fixed. Read-only: never resolve or reply.

## 1. Collect

Run inside the project repo. Default: unresolved threads opened by the current glab user. Add `--all` when the user says `all`: every author, resolved threads included.

```bash
python3 ~/.claude/skills/gitlab-mr-check-fixes/threads.py <iid> [--all]
```

For each thread it prints the link, the comment, the replies, and what changed near the anchored line since the comment (or the later commits, for an unattached thread). Take the iid from a URL or from the current branch's MR.

## 2. Judge each thread

Compare the comment (BODY) with what changed (CHANGE or COMMITS AFTER):

| Verdict | When |
| --- | --- |
| **FIXED** | The change removes the cause the comment names |
| **PARTIAL** | The change touches the cause but leaves part of it |
| **NOT FIXED** | Nothing changed near the lines, or the change is unrelated |
| **CHECK** | Visual or behavior issue that code alone cannot prove. Say what to look at |

A reply that says "done" is a claim, not proof: verify it against the change. If the old commit is missing ("force-push"), judge from the current MR diff (`glab mr diff <iid> --color=never`). Read a file only when the packed change is not enough.

## 3. Report

One line per thread, then stop:

`#1 file:line  FIXED  one-line reason  <link>`

Offer to resolve the FIXED threads or to re-comment the NOT FIXED ones. Do it only on a yes.
