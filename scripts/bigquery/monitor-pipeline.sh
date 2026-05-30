#!/usr/bin/env bash
set -euo pipefail

# BigQuery Pipeline Health Monitor
# Runs via cron after the daily refresh (e.g., 04:00 UTC)
# Checks that transformed tables have data through yesterday
# Alerts via Slack webhook if data is stale
#
# Crontab entry:
#   0 4 * * * /home/josefin/amulet-scan-port/scripts/bigquery/monitor-pipeline.sh
#
# Requires: bq CLI, ALERT_SLACK_WEBHOOK_URL env var or ~/.gcs_hmac_env.systemd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
  local details="$3"

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
        \"pretext\": \":$emoji: *[$( echo "$severity" | tr '[:lower:]' '[:upper:]')] BigQuery Pipeline Monitor*\",
        \"title\": \"$title\",
        \"fields\": [
          {\"title\": \"Host\", \"value\": \"$(hostname)\", \"short\": true},
          {\"title\": \"Time\", \"value\": \"$NOW\", \"short\": true},
          $details
        ],
        \"footer\": \"bigquery-pipeline-monitor\"
      }]
    }" > /dev/null 2>&1
}

# Check latest partition dates via INFORMATION_SCHEMA (free)
RESULT=$(bq query --project_id="$PROJECT_ID" --use_legacy_sql=false --format=json --max_rows=10 "
  SELECT
    table_name,
    MAX(partition_id) AS latest_partition
  FROM \`$PROJECT_ID.transformed.INFORMATION_SCHEMA.PARTITIONS\`
  WHERE table_name IN ('events_parsed', 'updates_parsed')
    AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
  GROUP BY 1
  ORDER BY 1
" 2>/dev/null)

if [[ -z "$RESULT" || "$RESULT" == "[]" ]]; then
  send_slack "critical" "BigQuery health check failed" \
    "{\"title\": \"Error\", \"value\": \"Could not query INFORMATION_SCHEMA\", \"short\": false}"
  exit 1
fi

EVENTS_LATEST=$(echo "$RESULT" | python3 -c "import sys,json; data=json.load(sys.stdin); print(next(r['latest_partition'] for r in data if r['table_name']=='events_parsed'))")
UPDATES_LATEST=$(echo "$RESULT" | python3 -c "import sys,json; data=json.load(sys.stdin); print(next(r['latest_partition'] for r in data if r['table_name']=='updates_parsed'))")

ISSUES=0
DETAIL=""

if [[ "$EVENTS_LATEST" < "$YESTERDAY" ]]; then
  ISSUES=$((ISSUES + 1))
  DETAIL="$DETAIL{\"title\": \"events_parsed\", \"value\": \"Latest: ${EVENTS_LATEST}, expected: ${YESTERDAY}\", \"short\": false},"
fi

if [[ "$UPDATES_LATEST" < "$YESTERDAY" ]]; then
  ISSUES=$((ISSUES + 1))
  DETAIL="$DETAIL{\"title\": \"updates_parsed\", \"value\": \"Latest: ${UPDATES_LATEST}, expected: ${YESTERDAY}\", \"short\": false},"
fi

if [[ $ISSUES -gt 0 ]]; then
  # Remove trailing comma
  DETAIL="${DETAIL%,}"
  send_slack "critical" "BigQuery daily refresh may have failed — data is stale" "$DETAIL"
  echo "ALERT: $ISSUES table(s) behind. Events: $EVENTS_LATEST, Updates: $UPDATES_LATEST, Expected: $YESTERDAY"
  exit 1
else
  echo "OK: Events: $EVENTS_LATEST, Updates: $UPDATES_LATEST, Expected: >= $YESTERDAY"
fi
