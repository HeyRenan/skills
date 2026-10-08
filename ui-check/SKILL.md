---
name: ui-check
description: Verifies a web page's UI with the fewest tokens: DOM and computed-style checks first, a small cropped screenshot only when visual judgement is needed. Use when the user asks to check, verify, test or confirm a page, layout, component, responsive behavior or visual fix in a browser.
argument-hint: <url> <what to verify>
---

Verify `$ARGUMENTS` in a browser. Screenshots are the most expensive thing you can do: prove with text and numbers first.

## Rules

- Use one browser tool for the whole check: the session's default. Do not switch or mix.
- Write the checks first, one line each (element exists, text, size, color, state, no console errors). Stop when each is answered.
- If login is needed, ask the user. Never enter credentials.

## Order, cheapest first

1. **Load and act in one call.** Batch navigate, clicks and reads when the tool supports batching.
2. **Read facts, not pixels.** Page text or the accessibility tree for content and state. For geometry and style, run a script that returns only what you need:
   ```js
   const el=document.querySelector(SEL), r=el?.getBoundingClientRect(), s=el&&getComputedStyle(el);
   JSON.stringify({found:!!el,w:r?.width,h:r?.height,display:s?.display,color:s?.color})
   ```
3. **Console and network:** errors only.
4. **Screenshot only for visual judgement** (alignment, overlap, color, spacing):
   - smallest region that shows it (the element), not the page;
   - reduced scale (about 0.5) unless fine detail matters;
   - at most one per viewport per issue;
   - never read a saved screenshot back with a file reader: view it once where it is returned.
5. **Responsive:** set the viewport (mobile 375, tablet 768, desktop 1440), re-run steps 2 and 4, then reset it to desktop.
6. **After a fix:** re-run only the failed check. Do not re-shoot what did not change.

## Report

One line per check: pass or fail with the measured value. Attach a screenshot only for failures.
