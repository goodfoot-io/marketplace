#!/usr/bin/env bash
set -euo pipefail

out_path="${1:-reports/hook-repositories.csv}"

terms=(
  "PermissionRequest"
  "PostToolUse"
  "Notification"
  "UserPromptSubmit"
  "Stop"
  "SubagentStop"
  "PreCompact"
  "SessionStart"
  "Persisting"
  "SessionEnd"
)

mkdir -p "$(dirname "$out_path")"

wait_for_code_search_budget() {
  while true; do
    local limits remaining reset now sleep_for
    limits="$(gh api -X GET /rate_limit)"
    remaining="$(jq -r '.resources.code_search.remaining' <<<"$limits")"
    reset="$(jq -r '.resources.code_search.reset' <<<"$limits")"
    now="$(date +%s)"

    if [[ "$remaining" -gt 0 ]]; then
      return 0
    fi

    sleep_for=$((reset - now + 10))
    if [[ "$sleep_for" -lt 1 ]]; then
      sleep_for=1
    fi
    echo "Rate limit exhausted, sleeping ${sleep_for}s until reset..." >&2
    sleep "$sleep_for"
  done
}

search_term() {
  local term="$1"
  local per_page=100
  local page=1
  local max_pages=10
  local min_delay=7

  while [[ "$page" -le "$max_pages" ]]; do
    wait_for_code_search_budget
    set +e
    response="$(gh api -X GET /search/code -f q="$term filename:hooks.json" -f per_page="$per_page" -f page="$page" 2>/dev/null)"
    status=$?
    set -e
    if [[ "$status" -ne 0 || -z "$response" ]]; then
      echo "Hit secondary rate limit, backing off 60s..." >&2
      sleep 60
      continue
    fi
    jq -r '.items[] | [.repository.full_name, ("/" + .path)] | @csv' <<<"$response" >> "$out_path"

    if [[ "$(jq -r '.items | length' <<<"$response")" -lt "$per_page" ]]; then
      break
    fi
    page=$((page + 1))
    sleep "$min_delay"
  done
}

for term in "${terms[@]}"; do
  search_term "$term"
done
