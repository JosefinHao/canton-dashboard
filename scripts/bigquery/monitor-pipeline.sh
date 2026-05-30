#!/usr/bin/env bash
set -euo pipefail

# BigQuery Pipeline Health Monitor
# Checks that transformed tables have data through yesterday
# Uses compute engine metadata token for auth (no SDK or bq CLI needed)
# Alerts via Slack webhook if data is stale or check fails
#
# Setup:
#   systemd timer (see monitor-pipeline.timer / monitor-pipeline.service)
#   or crontab: 0 4 * * * /home/josefin/amulet-scan-port/scripts/bigquery/monitor-pipeline.sh

PROJECT_ID="governence-483517"
SLACK_WEBHOOK="${ALERT_SLACK_WEBHOOK_URL:-}"

# Load webhook from systemd env if not set
if [[ -z "$SLACK_WEBHOOK" && -f "$HOME/.gcs_hmac_env.systemd" ]]; then
  SLACK_WEBHOOK=$(grep ALERT_SLACK_WEBHOOK_URL "$HOME/.gcs_hmac_env.systemd" | cut -d= -f2-)
fi

if [[ -z "$SLACK_WEBHOOK" ]]; then
  echo "ERROR: ALERT_SLACK_WEBHOOK_URL not set"
  exit 1
fi

YESTERDAY=$(date -u -d "yesterday" +%Y%m%d)
YESTERDAY_DISPLAY=$(date -u -d "yesterday" +%Y-%m-%d)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

send_slack() {
  local severity="$1"
  local title="$2"
  local message="$3"

  local emoji="large_blue_circle"
  local color="#2196F3"
  case "$severity" in
    warning)  emoji="warning"; color="#FF9800" ;;
    critical) emoji="red_circle"; color="#F44336" ;;
  esac

  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$color\",
        \"pretext\": \":$emoji: *[$(echo "$severity" | tr '[:lower:]' '[:upper:]')] BigQuery Pipeline Monitor*\",
        \"title\": \"$title\",
        \"fields\": [
          {\"title\": \"Host\", \"value\": \"$(hostname)\", \"short\": true},
          {\"title\": \"Time\", \"value\": \"$NOW\", \"short\": true},
          {\"title\": \"Details\", \"value\": \"$message\", \"short\": false}
        ],
        \"footer\": \"bigquery-pipeline-monitor\"
      }]
    }" > /dev/null 2>&1
}

# Get access token from compute engine metadata service
TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/access-token" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
  send_slack "critical" "Monitor auth failed" "Could not get compute engine access token"
  echo "ERROR: Failed to get access token from metadata service"
  exit 1
}

# Query INFORMATION_SCHEMA via BigQuery REST API (free metadata query)
QUERY="SELECT table_name, MAX(partition_id) AS latest_partition FROM \`${PROJECT_ID}.transformed.INFORMATION_SCHEMA.PARTITIONS\` WHERE table_name IN ('events_parsed', 'updates_parsed') AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__') GROUP BY 1"

RESPONSE=$(curl -sf -X POST \
  "https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"configuration\": {
      \"query\": {
        \"query\": \"$QUERY\",
        \"useLegacySql\": false
      }
    }
  }" 2>/dev/null) || {
  send_slack "critical" "Monitor query failed" "Could not submit BigQuery job"
  echo "ERROR: BigQuery job submission failed"
  exit 1
}

JOB_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobReference']['jobId'])" 2>/dev/null)

# Poll for job completion (should be instant for metadata queries)
for i in $(seq 1 10); do
  sleep 2
  JOB_RESULT=$(curl -sf \
    "https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/jobs/${JOB_ID}?location=US" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  STATUS=$(echo "$JOB_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status']['state'])" 2>/dev/null)

  if [[ "$STATUS" == "DONE" ]]; then
    break
  fi
done

if [[ "$STATUS" != "DONE" ]]; then
  send_slack "critical" "Monitor query timeout" "BigQuery job did not complete in 20 seconds"
  echo "ERROR: BigQuery job timed out"
  exit 1
fi

# Extract results
QUERY_RESULTS=$(curl -sf \
  "https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries/${JOB_ID}?location=US" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

EVENTS_LATEST=$(echo "$QUERY_RESULTS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for row in data.get('rows', []):
  if row['f'][0]['v'] == 'events_parsed':
    print(row['f'][1]['v'])
" 2>/dev/null)

UPDATES_LATEST=$(echo "$QUERY_RESULTS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for row in data.get('rows', []):
  if row['f'][0]['v'] == 'updates_parsed':
    print(row['f'][1]['v'])
" 2>/dev/null)

if [[ -z "$EVENTS_LATEST" || -z "$UPDATES_LATEST" ]]; then
  send_slack "critical" "Monitor parse failed" "Could not parse partition dates from BigQuery response"
  echo "ERROR: Failed to parse results"
  exit 1
fi

# Compare against expected
ISSUES=""
if [[ "$EVENTS_LATEST" < "$YESTERDAY" ]]; then
  ISSUES="${ISSUES}events_parsed: latest=${EVENTS_LATEST}, expected>=${YESTERDAY}. "
fi
if [[ "$UPDATES_LATEST" < "$YESTERDAY" ]]; then
  ISSUES="${ISSUES}updates_parsed: latest=${UPDATES_LATEST}, expected>=${YESTERDAY}. "
fi

if [[ -n "$ISSUES" ]]; then
  send_slack "critical" "BigQuery daily refresh may have failed — data is stale" "$ISSUES"
  echo "ALERT: $ISSUES"
  exit 1
else
  echo "OK: events=${EVENTS_LATEST}, updates=${UPDATES_LATEST}, expected>=${YESTERDAY}"
fi
