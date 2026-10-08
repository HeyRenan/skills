---
name: handoff
description: Saves a compact file with the current state of this conversation so it can be resumed later in a fresh chat. Use when the user wants to wrap up, pause, hand off or continue later, or asks to save the session, a handoff or a summary for the next chat.
---

Write a handoff file from this conversation. A fresh chat with no memory must be able to continue from the file alone.

Include only what is true now and what the next chat needs to continue. Leave out everything else that the conversation history no longer needs.

## Sections

- TASK: the goal, one line.
- DONE: what is finished.
- NEXT: what to do next, each item actionable without more context.
- DECISIONS: choices in force and why.
- OPEN: unresolved questions or things waiting on someone.
- REFS: anything the next chat must look up or reuse.

Skip a section with nothing to say. Never write "N/A" or "none".

## Format

Plain `.txt`, no markdown. One uppercase label and a colon per section, then terse content, one item per line. No filler.

## File

Name: `handoff-<topic>-<YYYYMMDD-HHmm>.txt` in the current directory. `<topic>` is 2 to 4 lowercase words from the task, joined by `-`. Get the time with `date +%Y%m%d-%H%M`.

When done, print only the file path.
