---
name: wrike-time-log
description: Calculates the time spent on a Wrike task from its status history and records it, rounded to 30-minute steps and dated today. Counts work time and review time, and adds to time already recorded. Use when the user hands a task over for review, completes it, reviews it, or asks to log, add or calculate time on a Wrike task.
argument-hint: <wrike link | task id> [work|review] [duration or start time]
---

Calculate and record the time spent on the Wrike task in `$ARGUMENTS`. Understand the history before you count anything.

## 1. Load

One `ToolSearch` loads the Wrike tools you need. Build the id as `w:itm:N` from `open.htm?id=N`. In one turn, fetch: task details, status history (`requestedChanges: ["STATUS"]`), comments, and the current user (`get_users` with `me=true`). Get the current time with `date +%Y-%m-%dT%H:%M:%S%z`.

## 2. Understand the statuses

Teams use statuses with a meaning. Read the history to learn how this team moves tasks, then map each status by meaning, in any language. Default meaning:

| Status | Meaning | Clock |
| --- | --- | --- |
| New | not started | off |
| In progress | someone is working on it | **on** |
| On hold | handed over, waiting for review | off |
| Red (needs response) | blocked until someone answers | off |
| Completed | finished | off |

If a status is not in the table, infer its meaning from its name, workflow group and position in the sequence. If still unclear, ask once.

## 3. Build the time

**Work time** = every interval in **In progress** that opened by the current user's status change, from entering it to leaving it. If the task is still In progress and the user is handing it over or completing it now, the interval closes at the current time. Intervals in any other status do not count.

**Review time** = time the user spent reviewing: from when the review started to now. Default start: the first message of this conversation. Use a duration or start time the user gave in `$ARGUMENTS` instead if present. If you cannot tell, ask once.

**Already recorded.** Do not count time twice:
- If a native time-log tool exists, read its entries and count only what is not covered.
- Otherwise read the task comments for earlier entries written by this skill (format in step 5). Count only time after the latest `through` stamp.

## 4. Round

- Round each entry (work, review) to the nearest 30 minutes. Exactly 15 past rounds up.
- Minimum 30 minutes per entry. Zero time means no entry.
- Entry date is **today**, even if the work spanned several days.

Examples: 10 min → 0.5h, 40 min → 0.5h, 50 min → 1h, 1h20 → 1.5h.

## 5. Record

Show one line per entry (type, hours, date, intervals used) and wait for the user's yes. Never post before that.

- **Native time-log tool, if any**: add the entry with today's date and the rounded hours. Existing time stays; this adds to it.
- **Otherwise** post one comment per entry, exactly this shape, so the next run can sum it:

  `Time log | 2026-10-08 | work | 1.5h | through 2026-10-08T14:30:00-0300`

  Type is `work` or `review`. `through` is the end of the last interval counted.

Do not change the task's status or dates. If the user is handing over or completing, mention that the status change is theirs to ask for.

## 6. Report

Entries recorded, total time on the task so far (earlier entries plus new), and anything you could not determine.
