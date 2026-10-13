import json
import sys


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))


event = json.load(sys.stdin)
command = str((event.get("tool_input") or {}).get("command") or "").lower()
blocked = ("rm -rf /", "git reset --hard", "git clean -fd", "remove-item -recurse -force")

if any(item in command for item in blocked):
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Vectr policy blocks broad destructive commands. Use a narrow, explicit target with owner approval."}})
