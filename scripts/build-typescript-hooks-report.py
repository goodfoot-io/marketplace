#!/usr/bin/env python3
import csv
import json
import subprocess
import sys
import time
from collections import defaultdict


def gh_api_json(endpoint: str) -> dict | None:
    result = subprocess.run(
        ["gh", "api", endpoint],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def wait_for_core_budget() -> None:
    limits = gh_api_json("/rate_limit")
    if not limits:
        return
    core = limits.get("resources", {}).get("core", {})
    remaining = core.get("remaining")
    reset = core.get("reset")
    if isinstance(remaining, int) and remaining < 10 and isinstance(reset, int):
        sleep_for = max(reset - int(time.time()) + 5, 5)
        time.sleep(sleep_for)


def main() -> int:
    in_path = "reports/hook-repositories.filtered.csv"
    out_path = "reports/hook-repositories.typescript.csv"

    repo_paths: dict[str, set[str]] = defaultdict(set)
    with open(in_path, newline="") as infile:
        reader = csv.reader(infile)
        for row in reader:
            if len(row) < 2:
                continue
            repo, path = row[0].strip(), row[1].strip()
            if repo and path:
                repo_paths[repo].add(path)

    repo_meta: list[tuple[str, int]] = []
    call_count = 0
    for repo in repo_paths:
        call_count += 1
        if call_count % 50 == 0:
            wait_for_core_budget()

        info = gh_api_json(f"/repos/{repo}")
        if not info:
            continue
        stars = info.get("stargazers_count")
        if not isinstance(stars, int):
            stars = 0

        call_count += 1
        if call_count % 50 == 0:
            wait_for_core_budget()
        languages = gh_api_json(f"/repos/{repo}/languages") or {}
        if not isinstance(languages, dict):
            continue

        if "TypeScript" in languages or "JavaScript" in languages:
            repo_meta.append((repo, stars))

    repo_meta.sort(key=lambda item: item[1], reverse=True)

    with open(out_path, "w", newline="") as outfile:
        writer = csv.writer(outfile)
        for repo, _stars in repo_meta:
            for path in sorted(repo_paths[repo]):
                writer.writerow([repo, path])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
