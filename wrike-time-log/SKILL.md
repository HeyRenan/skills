---
name: wrike-time-log
description: Calculates the time spent on a Wrike task from its status history and adds it to the task's Duration field, rounded to 30-minute steps. Counts work time and review time, and always adds to the duration already on the task, never replaces it. Use when the user hands a task over for review, completes it, reviews it, or asks to log, add or calculate time on a Wrike task.
argument-hint: <wrike link | task id> [work|review] [duration or start time]
---

Calculate the time spent on the Wrike task in `$ARGUMENTS` and add it to the task's **Duration** field. Understand the history before you count anything.

## 1. Load

One `ToolSearch` loads the Wrike tools you need, including `update_items`. Build the id as `w:itm:N` from `open.htm?id=N`. In one turn, fetch: task details, history (`requestedChanges: ["STATUS", "DURATION", "START_DATE"]`), comments, and the current user (`get_users` with `me=true`). Get the current time with `date +%Y-%m-%dT%H:%M:%S%z`.

## 2. Understand the statuses

Teams use statuses with a meaning. Read the history to learn how this team moves tasks, then map each status by meaning, in any language. Default meaning:

| Status | Meaning | Clock |
| --- | --- | --- |
| New | not started | off |
| In progress | someone is working on it | **on** |
| On hold | handed over, waiting for review | off |
| Red (needs response) | blocked until someone answers | off |
| Completed | finished | off |

If a status is not in the table, infer its meaning from its name, workflow group and position in the sequence. If still unclear, take the most likely meaning. Never ask.

## 3. Build the time

**Work time** = every interval in **In progress** that opened by the current user's status change, from entering it to leaving it. If the task is still In progress and the user is handing it over or completing it now, the interval closes at the current time. Intervals in any other status do not count.

**Review time** = time the user spent reviewing: from when the review started to now. Default start: the first message of this conversation. Use a duration or start time the user gave in `$ARGUMENTS` instead if present. If you cannot tell, use the default start. Never ask.

**Current duration.** The task details do not show it. Read it from the latest `DURATION` change in the history (`newValue.durationInMinutes`); no change means no duration yet (0). It already holds the time of earlier work, so you add to it and never replace it.

**Do not count time twice.** If the current user already changed the `DURATION` after an interval started, count only the part after that change.

## 4. Round

- Round each entry (work, review) to the nearest 30 minutes. Exactly 15 past rounds up.
- Minimum 30 minutes per entry. Zero time means no entry.

Examples: 10 min → 0.5h, 40 min → 0.5h, 50 min → 1h, 1h20 → 1.5h.

## 5. Record

Always write it, every time. Never show the sum first, never ask for a yes, never offer a choice.

New duration in minutes = current duration + all rounded entries. Write it with `update_items`, `dates: { startDate, duration }`:

- Pass the task's current start date-time (latest `START_DATE` value in the history) as `startDate`. Do not pass only a date, because that can move the start time.
- Never pass `duration` alone with a different start, and never send the new entry alone: a lone 30 would overwrite the existing 2h.
- Wrike moves the due date to follow the duration. That is expected.

Do not change the task's status, assignees or description. Never mention the status. Do not post a comment unless the user asks for one.

## 6. Report

Check the new value in the history (`DURATION` change), not in the task details. If it matches, reply with exactly one word: `done`. Nothing else: no sum, no table, no notes about status or due date. If the write failed or the value does not match, print the error instead.
