#!/usr/bin/env python3
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ALLOWED_EVENTS = {
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "Notification",
    "UserPromptSubmit",
    "Stop",
    "SubagentStop",
    "PreCompact",
    "SessionStart",
    "Persisting",
    "SessionEnd",
}


def is_claude_hooks(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    hooks = payload.get("hooks")
    if not isinstance(hooks, dict):
        return False

    for event, entries in hooks.items():
        if event not in ALLOWED_EVENTS:
            continue
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            inner_hooks = entry.get("hooks")
            if not isinstance(inner_hooks, list):
                continue
            for hook in inner_hooks:
                if not isinstance(hook, dict):
                    continue
                hook_type = hook.get("type")
                if hook_type == "command" and isinstance(hook.get("command"), str):
                    return True
                if hook_type == "prompt" and isinstance(hook.get("prompt"), str):
                    return True
    return False


def fetch_raw(repo: str, path: str) -> bytes | None:
    safe_path = urllib.parse.quote(path)
    url = f"https://raw.githubusercontent.com/{repo}/HEAD{safe_path}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "claude-hooks-filter/1.0"}
    )

    for attempt in range(1, 6):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            if err.code in (403, 429):
                remaining = err.headers.get("X-RateLimit-Remaining")
                reset = err.headers.get("X-RateLimit-Reset")
                if remaining == "0" and reset:
                    try:
                        reset_ts = int(reset)
                        sleep_for = max(reset_ts - int(time.time()) + 5, 5)
                    except ValueError:
                        sleep_for = 30
                    time.sleep(sleep_for)
                    continue
                time.sleep(min(2**attempt, 60))
                continue
            return None
        except (urllib.error.URLError, TimeoutError):
            time.sleep(min(2**attempt, 60))
            continue
    return None


def main() -> int:
    if len(sys.argv) > 3:
        print("Usage: filter-claude-hooks.py [input_csv] [output_csv]", file=sys.stderr)
        return 2

    in_path = sys.argv[1] if len(sys.argv) > 1 else "reports/hook-repositories.csv"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "reports/hook-repositories.filtered.csv"

    kept = 0
    with open(in_path, newline="") as infile, open(out_path, "w", newline="") as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)

        for row in reader:
            if len(row) < 2:
                continue
            repo, path = row[0].strip(), row[1].strip()
            if not repo or not path.startswith("/"):
                continue

            raw = fetch_raw(repo, path)
            if raw is None:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if is_claude_hooks(payload):
                writer.writerow([repo, path])
                kept += 1

            # Be polite to raw.githubusercontent.com.
            time.sleep(0.2)

    print(f"Kept {kept} rows in {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
