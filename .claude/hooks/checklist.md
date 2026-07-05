# Pre-Flight / Post-Flight Checklist

## Before starting any task
- Restate the task in one sentence -- confirm you understood the actual ask, not an adjacent one
- Identify which files/panels/hooks this touches. If it's more than 2-3 files or you're unsure of the approach, propose a plan first (use plan mode) instead of jumping straight to edits
- Check for existing patterns before introducing new ones (e.g. don't add a new shared context if a local useState matches existing conventions in this repo)
- Note what's explicitly out of scope -- don't touch it

## While working
- Prefer the smallest diff that solves the problem. No drive-by refactors, renames, or "while I'm here" cleanups unless asked
- Preserve existing behavior outside the affected path
- Return complete files, not partial snippets with sections omitted, unless told otherwise

## Before saying "done"
- Run typecheck: npm run typecheck (or tsc --noEmit)
- Run the relevant test(s) -- not the whole suite unless the change is broad
- Run lint: npm run lint
- Re-read the diff (git diff --stat + skim actual changes) -- does it match the stated scope?
- Check for leftover debug code, console.logs, commented-out blocks
- If touching shared state (context, refs, queues) -- confirm cleanup/unmount paths are still handled
- State explicitly what was NOT tested or verified, if anything

## Red flags to self-report, not silently proceed past
- Any file you edited but didn't actually re-read after editing
- Any test you skipped running
- Any assumption you made because a spec was ambiguous
