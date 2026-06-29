#!/usr/bin/env bash
# Verify that a specific commit reached a "live" deploy on a Render service.
#
# Usage:
#   verify-render-deploy.sh <label> <service-id> <commit-sha>
#
# Required env:
#   RENDER_API_KEY  Render account API key
#
# Behavior:
#   - Polls Render's /v1/services/{id}/deploys API for up to ~10 minutes.
#   - If a deploy whose commit.id equals <commit-sha> reaches status=live,
#     exits 0.
#   - If that deploy enters a terminal failure state
#     (build_failed | update_failed | pre_deploy_failed | canceled),
#     exits 1.
#   - If after the first minute no deploy has been registered for this SHA,
#     assumes Render's Build Filter skipped this commit and exits 0.
#     The post-script health probe still asserts the live service is healthy.
#   - If RENDER_API_KEY is unset or service-id is empty, exits 0 (verification
#     is opt-in / per-service).

set -uo pipefail

label="${1:?usage: $0 <label> <service-id> <commit-sha>}"
sid="${2:?service-id required (use empty string to skip)}"
sha="${3:?commit-sha required}"

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "[$label] RENDER_API_KEY not set; skipping Render deploy verification"
  exit 0
fi

if [ -z "$sid" ]; then
  echo "[$label] service id not configured; skipping"
  exit 0
fi

api="https://api.render.com/v1/services/$sid/deploys?limit=20"
no_match=0
body=""

for i in $(seq 1 60); do
  if ! body=$(curl -fsS -H "Authorization: Bearer $RENDER_API_KEY" "$api" 2>&1); then
    echo "[$label] attempt $i: Render API call failed: $body"
    sleep 10
    continue
  fi

  match=$(printf '%s' "$body" \
    | jq -c --arg sha "$sha" '[.[] | select(.deploy.commit.id == $sha)] | first // empty' 2>/dev/null \
    || echo "")

  if [ -z "$match" ]; then
    no_match=$((no_match + 1))
    if [ "$no_match" -ge 6 ]; then
      echo "[$label] no deploy registered for ${sha:0:7} after ~60s"
      echo "[$label] assuming Render Build Filter skipped this commit; continuing"
      exit 0
    fi
    echo "[$label] attempt $i: no deploy yet for ${sha:0:7}"
    sleep 10
    continue
  fi

  status=$(printf '%s' "$match" | jq -r '.deploy.status // "unknown"')
  did=$(printf '%s'    "$match" | jq -r '.deploy.id     // "unknown"')

  case "$status" in
    live)
      echo "[$label] OK   deploy $did is live (commit ${sha:0:7})"
      exit 0
      ;;
    build_failed|update_failed|pre_deploy_failed|canceled)
      echo "[$label] FAIL deploy $did terminated with status=$status"
      printf '%s\n' "$match" | jq .
      exit 1
      ;;
    deactivated)
      # A newer deploy superseded this one before it could go live.
      # That's fine for our purposes; the gate is about "this commit
      # didn't break things", not "this exact deploy is still serving".
      echo "[$label] NOTE deploy $did was deactivated (superseded); treating as OK"
      exit 0
      ;;
    *)
      echo "[$label] attempt $i: deploy $did status=$status, waiting..."
      sleep 10
      ;;
  esac
done

echo "[$label] FAIL timed out after ~10 minutes waiting for deploy to reach 'live'"
echo "[$label] last response:"
printf '%s\n' "${body:-<empty>}" | jq . 2>/dev/null || echo "${body:-<empty>}"
exit 1
