# Data Pipeline Diagrams

## Table of Contents

1. [End-to-End Pipeline Flow](#1-end-to-end-pipeline-flow) — Complete data journey from Canton Scan API through GCS to BigQuery tables and views
2. [BigQuery Dataset Architecture](#2-bigquery-dataset-architecture) — How raw, transformed, and view layers relate within BigQuery
3. [Daily Refresh Process](#3-daily-refresh-process) — Step-by-step logic of the scheduled incremental load at 03:00 UTC
4. [Monitoring & Alerting](#4-monitoring--alerting) — Three-layer monitoring system with alert routing to Slack and email
5. [Data Type Transform](#5-data-type-transform) — How raw Parquet types are converted to BigQuery-native types
6. [Incident Recovery Workflow](#6-incident-recovery-workflow) — Steps to diagnose and recover from data gaps

---

## 1. End-to-End Pipeline Flow

```mermaid
flowchart LR
    A[Canton Scan API] -->|v2/updates| B[fetch-updates.js]
    B -->|Parquet + ZSTD| C[GCS: canton-bucket]
    C -->|External tables| D[BigQuery raw]
    D -->|Transform| E[BigQuery transformed]
    E -->|Views| F[Bronze Views]

    B -.->|Slack webhook| G[#pipeline-alerts]

    subgraph "governance-dashboard"
        B
    end

    subgraph "GCS"
        C
    end

    subgraph "BigQuery: governence-483517"
        D
        E
        F
    end
```

## 2. BigQuery Dataset Architecture

```mermaid
flowchart TD
    subgraph RAW["raw (external, zero cost)"]
        RE[raw.events<br/>3.6B+ rows]
        RU[raw.updates<br/>250M+ rows]
    end

    subgraph TRANSFORM["02-transform-raw-data.sql"]
        T1[SAFE.PARSE_TIMESTAMP]
        T2[UNNEST field.list]
        T3[SAFE.PARSE_JSON]
    end

    subgraph MATERIALIZED["transformed (materialized)"]
        EP[events_parsed<br/>Partitioned: DATE effective_at<br/>Clustered: template_id, event_type, migration_id]
        UP[updates_parsed<br/>Partitioned: DATE effective_at<br/>Clustered: update_type, migration_id]
    end

    subgraph VIEWS["transformed (views, zero cost)"]
        V1[parsed_app_reward_coupon]
        V2[parsed_sv_reward_coupon]
        V3[sv_weight_history]
        V4[daily_activity]
        V5[daily_mint_burn]
        V6[governance_action_summary]
    end

    RE --> T1 --> EP
    RU --> T1 --> UP
    RE --> T2 --> EP
    RU --> T2 --> UP
    RE --> T3 --> EP
    RU --> T3 --> UP

    EP --> V1
    EP --> V2
    EP --> V3
    UP --> V4
    EP --> V5
    EP --> V6
```

## 3. Daily Refresh Process

```mermaid
flowchart TD
    A[03:00 UTC: Scheduled query starts] --> B[Read INFORMATION_SCHEMA.PARTITIONS<br/>Get latest loaded date<br/>Cost: free]
    B --> C[Set lookback = latest - 1 day]
    C --> D{load_date < today?}
    D -->|Yes| E[SELECT from raw WHERE<br/>year/month/day = load_date]
    E --> F[INSERT WHERE NOT EXISTS<br/>Dedup on event_id + DATE effective_at]
    F --> G[Advance load_date + 1]
    G --> D
    D -->|No| H[Done]

    H --> I[04:00 UTC: Health check starts]
    I --> J[Read INFORMATION_SCHEMA.PARTITIONS<br/>Get latest partition dates<br/>Cost: free]
    J --> K{Latest >= yesterday?}
    K -->|Yes| L[Pass — no action]
    K -->|No| M[RAISE: STALE DATA<br/>Triggers email + Slack alert]
```

## 4. Monitoring & Alerting

```mermaid
flowchart TD
    subgraph LAYER1["Layer 1: Live Ingestion"]
        INGEST[canton-live-ingest.service] --> ALERTJS[alert.js]
    end

    subgraph EVENTS1["Alert Types"]
        INFO[INFO: ingestion_started]
        WARN[WARNING: stall, cursor_stuck]
        CRIT[CRITICAL: endpoints_down,<br/>gcs_backup_failed, decode_failures]
        FATAL[FATAL: max_errors,<br/>uncaught_exception, crash]
    end

    subgraph LAYER2["Layer 2: BigQuery Refresh"]
        REFRESH_E[daily-refresh-events<br/>03:00 UTC]
        REFRESH_U[daily-refresh-updates<br/>03:00 UTC]
    end

    subgraph LAYER3["Layer 3: Health Check"]
        HEALTH[daily-health-check<br/>04:00 UTC]
    end

    subgraph MONITORING["GCP Cloud Monitoring"]
        LOGALERT[Log-based alert<br/>BigQuery Pipeline Failure<br/>Rate: 1/hour, Auto-close: 7 days]
    end

    subgraph CHANNELS["Alert Channels"]
        SLACK[Slack #pipeline-alerts]
        EMAIL[Email notification]
    end

    ALERTJS --> INFO
    ALERTJS --> WARN
    ALERTJS --> CRIT
    ALERTJS --> FATAL

    INFO --> SLACK
    WARN --> SLACK
    CRIT --> SLACK
    FATAL --> SLACK

    REFRESH_E -->|On failure| EMAIL
    REFRESH_U -->|On failure| EMAIL
    HEALTH -->|On failure| EMAIL

    REFRESH_E -->|Error logs| LOGALERT
    REFRESH_U -->|Error logs| LOGALERT
    HEALTH -->|Error logs| LOGALERT
    LOGALERT --> SLACK
```

## 5. Data Type Transform

```mermaid
flowchart LR
    subgraph PARQUET["Raw Parquet (DuckDB-written)"]
        P1["effective_at: VARCHAR<br/>'2025-01-15T00:00:04.164Z'"]
        P2["signatories: VARCHAR[]<br/>Parquet LIST struct with .list"]
        P3["payload: VARCHAR<br/>JSON as plain string"]
        P4["migration_id: BIGINT"]
        P5["consuming: BOOLEAN"]
    end

    subgraph BIGQUERY["BigQuery transformed"]
        B1["effective_at: TIMESTAMP<br/>2025-01-15 00:00:04.164 UTC"]
        B2["signatories: ARRAY‹STRING›"]
        B3["payload: JSON<br/>Supports JSON_VALUE queries"]
        B4["migration_id: INT64"]
        B5["consuming: BOOL"]
    end

    P1 -->|"SAFE.PARSE_TIMESTAMP<br/>('%Y-%m-%dT%H:%M:%E*SZ')"| B1
    P2 -->|"ARRAY(SELECT element<br/>FROM UNNEST(field.list))"| B2
    P3 -->|"SAFE.PARSE_JSON()"| B3
    P4 -->|"CAST AS INT64"| B4
    P5 -->|"CAST AS BOOL"| B5
```

## 6. Incident Recovery Workflow

```mermaid
flowchart TD
    A[Alert received:<br/>data gap suspected] --> B[Check BigQuery partition counts<br/>INFORMATION_SCHEMA.PARTITIONS<br/>Cost: free]
    B --> C{Counts match<br/>raw vs transformed?}
    C -->|No| D[BigQuery backfill needed<br/>DELETE + INSERT for affected days]
    C -->|Yes| E{Raw count matches<br/>expected daily volume?}
    E -->|Yes| F[Data is intact<br/>No action needed]
    E -->|No| G[GCS gap: verify against Scan API]
    G --> H[Run verify-scan-completeness.js<br/>--migration=4 --date=YYYY-MM-DD]
    H --> I{GCS matches<br/>Scan API?}
    I -->|Yes| J[GCS intact<br/>Issue is elsewhere]
    I -->|No| K[Reingest from Scan API]
    K --> L[reingest-updates.js<br/>--start=DATE --end=DATE<br/>--migration=4 --clean]
    L --> M[Check adjacent partitions<br/>for *-ri-* duplicate files]
    M --> N[Re-verify counts]
    N --> D

    style A fill:#e74c3c,color:#fff
    style F fill:#2ecc71,color:#fff
    style J fill:#2ecc71,color:#fff
```
