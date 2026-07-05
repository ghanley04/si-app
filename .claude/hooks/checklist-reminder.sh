#!/bin/bash
# UserPromptSubmit hook: injects the pre-flight/post-flight checklist as
# additionalContext so it's re-applied on every task in this repo.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKLIST="$(cat "$SCRIPT_DIR/checklist.md")"

jq -n --arg text "$CHECKLIST" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $text
  }
}'
