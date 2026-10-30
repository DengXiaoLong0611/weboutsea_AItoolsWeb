# Drawing Loading Feedback Implementation Plan

**Goal:** Implement the approved drawing animation, indeterminate sliding bar and elapsed timer.
**Architecture:** Extend the existing static HTML/CSS/JS; no dependencies or API changes. Start feedback immediately on submit and clean up on every completion path. Use wall-clock elapsed time and a gentle long-wait message after 60 seconds. Respect reduced motion.
**Scope:** Preserve existing prompts, trial handling, downloads, and user edits.

- [x] Add lifecycle tests for pending feedback, elapsed time, success/error cleanup and repeat submissions.
- [x] Add a warm paper-and-pencil illustration, indeterminate progress bar, accessible labels and reduced-motion styling.
- [x] Wire feedback and timer into the existing submit lifecycle; restore button text in finally.
- [x] Run UI tests, related hand-drawn tests and syntax checks. Review changes.

Validation: 10 related tests pass; JavaScript syntax and whitespace checks pass. No paid image generation was invoked. Browser visual verification has not been performed.
