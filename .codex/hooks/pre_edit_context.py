import json
import sys


event = json.load(sys.stdin)
path = str((event.get("tool_input") or {}).get("path") or "").replace("\\", "/").lower()

if path.endswith((".ts", ".tsx", ".js", ".jsx", ".rs", ".py")):
    print(json.dumps({"systemMessage": "Before product-code edits, read AGENTS.md, docs/PLAN.md, docs/PROGRESS.md, docs/DECISIONS.md, and the relevant .agents/workflows file."}, separators=(",", ":")))
