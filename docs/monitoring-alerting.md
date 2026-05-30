# Monitoring & Alerting

## Overview

The data pipeline has three independent monitoring layers. Each layer
can detect and alert on failures independently — no single point of failure.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Live Ingestion Alerts                                  │
│  Process: canton-live-ingest.service (systemd)                   │
│  Module:  scripts/ingest/alert.js                                │
│  Channel: Slack #pipeline-alerts (direct webhook)                │
│  Scope:   GCS ingestion health — stalls, crashes, API failures   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼  Data lands in GCS
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: BigQuery Daily Refresh                                 │
│  Queries: daily-refresh-events / daily-refresh-updates           │
│  Schedule: 03:00 UTC                                             │
│  Alert:   Email on failure (BigQuery built-in)                   │
│  Scope:   Transform + load new data into events/updates_parsed   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼  Data should be current in BigQuery
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Health Check + Cloud Monitoring                        │
│  Query:   daily-health-check-pipeline (04:00 UTC)                │
│  Monitor: GCP Cloud Monitoring log-based alert                   │
│  Channel: Slack #pipeline-alerts + Email                         │
│  Scope:   Stale data detection, all BigQuery query failures      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Live Ingestion Alerts

**Process**: `canton-live-ingest.service` (systemd on governance-dashboard)

**Module**: `scripts/ingest/alert.js`

**Configuration**:
- `ALERT_SLACK_WEBHOOK_URL` — Set in `~/.gcs_hmac_env.systemd`
- `ALERT_RATE_LIMIT_MS` — Minimum interval between same-type alerts (default: 5 min)
- `ALERT_HOSTNAME` — Host identifier (default: `os.hostname()`)

**Alert types**:

| Severity | Alert | Trigger |
|----------|-------|---------|
| INFO | `ingestion_started` | Service starts/restarts |
| WARNING | `ingestion_stall` | No progress for extended period |
| WARNING | `cursor_stuck` | Cursor not advancing, page size reduced |
| CRITICAL | `gcs_cursor_backup_failed` | GCS cursor backup failing repeatedly |
| CRITICAL | `all_endpoints_unreachable` | All 13 Scan API endpoints down |
| CRITICAL | `decode_failures` | Decode errors blocking cursor advancement |
| FATAL | `max_transient_errors` | Max transient error threshold reached, ingestion stopped |
| FATAL | `too_many_nontransient_errors` | Repeated non-transient errors, ingestion stopped |
| FATAL | `uncaught_exception` | Unhandled crash |
| FATAL | `unhandled_rejection` | Unhandled promise rejection |

**Slack message format**:
- Color-coded by severity (blue/orange/red/dark red)
- Includes: host, timestamp, cursor position, migration ID, error details
- Rate limited: same alert type suppressed for 5 minutes

**Verifying it works**:
```bash
# Check alerting is enabled
journalctl -u canton-live-ingest -n 50 | grep -i 'ALERTING'
# Should show: ALERTING: slack | rate_limit=300s

# Restart service to trigger INFO alert
sudo systemctl restart canton-live-ingest
# Check Slack for "Ingestion pipeline started" message
```

---

## Layer 2: BigQuery Daily Refresh

**Scheduled queries** (BigQuery console → Scheduled queries):

| Query name | Schedule | Purpose |
|------------|----------|---------|
| `daily-refresh-events-parsed` | 03:00 UTC | INSERT NOT EXISTS into events_parsed |
| `daily-refresh-updates-parsed` | 03:00 UTC | INSERT NOT EXISTS into updates_parsed |

**Scripts**: `scripts/bigquery/scheduled/daily-refresh-events.sql` and
`daily-refresh-updates.sql`

**Built-in failure notifications**: Email enabled on both queries.
When a query fails, BigQuery sends an email to the query owner automatically.

**How it works**:
1. Reads latest partition from `INFORMATION_SCHEMA.PARTITIONS` (free)
2. Lookback 1 day before latest (catches late-arriving data)
3. Loops day-by-day through yesterday
4. `INSERT ... WHERE NOT EXISTS` — dedup on event_id/update_id + partition date
5. `DECLARE`'d date variables enable partition pruning

**Cost**: ~$0.16/day (~$4.80/month)

**Verifying it works**:
```
BigQuery console → Scheduled queries → click query → Runs tab
Check: all runs show SUCCESS, bytes processed ~20 GB (events) / ~11 GB (updates)
```

---

## Layer 3: Health Check + Cloud Monitoring

### BigQuery Health Check Query

**Query name**: `daily-health-check-pipeline`

**Schedule**: 04:00 UTC (1 hour after daily refresh)

**Script**: `scripts/bigquery/scheduled/daily-health-check.sql`

**Logic**:
1. Reads latest partition dates from `INFORMATION_SCHEMA.PARTITIONS` (free)
2. Compares against yesterday's date
3. If either `events_parsed` or `updates_parsed` is behind:
   `RAISE USING MESSAGE = 'STALE DATA: events=... updates=... expected>=...'`
4. The intentional failure triggers both email notification and Cloud Monitoring alert

**Cost**: Zero (INFORMATION_SCHEMA is metadata-only)

### GCP Cloud Monitoring Alert

**Alert name**: `BigQuery Pipeline Failure`

**Type**: Log-based alert

**Log query**:
```
resource.type="bigquery_resource"
protoPayload.serviceData.jobCompletedEvent.job.jobStatus.state="DONE"
protoPayload.serviceData.jobCompletedEvent.job.jobStatus.error.message!=""
```

**Notification**: Slack `#pipeline-alerts` channel

**Rate limit**: 1 notification per hour

**Incident auto-close**: 7 days

**Scope**: Catches ALL BigQuery scheduled query failures — both the daily
refresh queries and the health check. Any query failure in the project
triggers a Slack alert.

**Verifying it works**:
```
GCP Console → Monitoring → Alerting → Policies
Check: "BigQuery Pipeline Failure" policy is enabled
```

---

## Failure Scenarios

| Scenario | Detected by | Alert channel | Recovery |
|----------|------------|---------------|----------|
| Live ingest crashes | Layer 1 (alert.js) | Slack (FATAL) | systemd auto-restarts; check logs |
| Live ingest stalls | Layer 1 (alert.js) | Slack (WARNING) | Check Scan API endpoints; restart service |
| All Scan API endpoints down | Layer 1 (alert.js) | Slack (CRITICAL) | Wait for endpoints; service auto-retries |
| Daily refresh fails | Layer 2 (email) + Layer 3 (Slack) | Email + Slack | Check BigQuery scheduled query logs; rerun manually |
| Daily refresh succeeds but data stale | Layer 3 (health check) | Email + Slack | Check GCS for missing data; may need reingest |
| BigQuery itself down | Layer 3 (Cloud Monitoring) | Slack | Wait for BigQuery; refresh will auto-catch-up |
| Governance-dashboard VM down | Layer 3 (health check detects stale data next day) | Email + Slack | Restart VM; ingest auto-resumes from cursor |

---

## Slack Channel

**Channel**: `#pipeline-alerts`

**App**: Canton Pipeline Alerts

**Webhook URL**: Configured in `~/.gcs_hmac_env.systemd` on governance-dashboard
as `ALERT_SLACK_WEBHOOK_URL` (used by live ingest alert.js)

**GCP Cloud Monitoring**: Separate Slack integration via GCP notification channel
(configured in GCP Console → Monitoring → Alerting → Notification channels)

**Expected messages**:

| Message | Frequency | Meaning |
|---------|-----------|---------|
| `[INFO] Ingestion pipeline started` | On service restart | Normal — service (re)started |
| `[WARNING] Ingestion stall detected` | Rare | Live ingest not progressing — investigate |
| `[CRITICAL] All Scan API endpoints unreachable` | Rare | Network or Scan API issue |
| `[FATAL] Ingestion crashed` | Rare | Unhandled error — check logs |
| `BigQuery Pipeline Failure` (Cloud Monitoring) | On any BQ query failure | Check scheduled query runs |

---

## Configuration Reference

### Environment Variables (governance-dashboard)

Set in `~/.gcs_hmac_env.systemd` (loaded by systemd service):

| Variable | Purpose | Required |
|----------|---------|----------|
| `ALERT_SLACK_WEBHOOK_URL` | Slack incoming webhook URL | Yes (for Slack alerts) |
| `ALERT_RATE_LIMIT_MS` | Min interval between same-type alerts (default: 300000 = 5 min) | No |
| `ALERT_HOSTNAME` | Host identifier in alert messages (default: hostname) | No |
| `ALERT_EMAIL_ENABLED` | Enable email alerts via SMTP (default: false) | No |
| `ALERT_SMTP_HOST` | SMTP server host | Only if email enabled |
| `ALERT_SMTP_PORT` | SMTP port (default: 587) | Only if email enabled |
| `ALERT_SMTP_USER` | SMTP username | Only if email enabled |
| `ALERT_SMTP_PASS` | SMTP password | Only if email enabled |
| `ALERT_EMAIL_TO` | Comma-separated recipient addresses | Only if email enabled |

### BigQuery Scheduled Queries

| Query | Schedule | Email on failure |
|-------|----------|-----------------|
| `daily-refresh-events-parsed` | 03:00 UTC | Yes |
| `daily-refresh-updates-parsed` | 03:00 UTC | Yes |
| `daily-health-check-pipeline` | 04:00 UTC | Yes |

### GCP Cloud Monitoring

| Setting | Value |
|---------|-------|
| Alert policy name | `BigQuery Pipeline Failure` |
| Type | Log-based alert |
| Notification channel | Slack `#pipeline-alerts` |
| Rate limit | 1 per hour |
| Auto-close | 7 days |
