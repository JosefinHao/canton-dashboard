# Canton Scan API — Useful Commands

Practical reference for querying the Canton Network Scan API directly via `curl`. Based on commands used and verified during the Kairo FA investigation (Jun 3–4, 2026).

**Base URL:** `https://scan.sv-2.global.canton.network.digitalasset.com/api/scan`

---

## Get Latest Round

```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/round-of-latest-data/0" | jq '.'
```

The `0` is the migration ID for the current network epoch. Returns the latest round number, which is needed for several other queries.

---

## Featured Apps

**List all featured apps:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/featured-apps" | jq '.featured_apps'
```

**Count total FAs:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/featured-apps" | jq '.featured_apps | length'
```

**Find a specific FA by provider namespace key:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/featured-apps" \
  | jq '.featured_apps[] | select(.payload.provider | contains("1220516244"))'
```

**Find a specific FA by app name:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/featured-apps" \
  | jq '.featured_apps[] | select(.payload.provider | contains("kairo"))'
```

> **Note:** Response structure is `{"featured_apps": [...]}`, not a raw array. Always access `.featured_apps` first.

**Key response fields:**
- `.payload.provider` — Party ID of the FA provider
- `.created_at` — When FA status was granted

---

## Top Providers by App Rewards

**Get leaderboard at a specific round:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/top-providers-by-app-rewards?round=98727" | jq '.'
```

**Filter for a specific provider:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/top-providers-by-app-rewards?round=98727" \
  | jq '.top_providers[] | select(.provider | contains("kairo"))'
```

> **Note:** May return "No top providers found" for very recent rounds. Use a round slightly before the latest.

---

## Round Party Totals

Cumulative per-party statistics (rewards, traffic, transfers) at a specific round range.

**Single round query:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/round-party-totals" \
  -H "Content-Type: application/json" \
  -d '{
    "party_id": "kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060",
    "start_round": 98727,
    "end_round": 98727
  }' | jq '.'
```

**Key response fields:**
- `.cumulative_app_rewards` — Total app rewards credited (CC)
- `.cumulative_validator_rewards` — Total validator rewards (CC)
- `.cumulative_traffic_cc_spent` — Total CC spent on traffic
- `.cumulative_num_transfers` — Total transfer count

> **Limit:** Cannot request more than 50 rounds at a time. Use narrow ranges (e.g., `start_round: 98830, end_round: 98874`).

> **Null responses:** If a party has zero activity tracked by the Scan API, the response may return null for all fields.

---

## Holdings Summary

Wallet balances at a point in time.

```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/holdings/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "migration_id": 4,
    "record_time": "2026-06-03T00:00:00Z",
    "owner_party_ids": [
      "kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060"
    ]
  }' | jq '.'
```

**Multiple wallets in one query:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/holdings/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "migration_id": 4,
    "record_time": "2026-06-03T00:00:00Z",
    "owner_party_ids": [
      "kairo-mainnet::12205162...",
      "angelhack-mainnet-1::12205162...",
      "kairo-dex-lp-1::12205162...",
      "kairo-dex-lp-2::12205162..."
    ]
  }' | jq '.'
```

**Required parameters:**
- `migration_id` — Current network migration ID (4 as of Jun 2026)
- `record_time` — ISO 8601 timestamp
- `owner_party_ids` — Array of full party IDs

> **Note:** `record_time_match: "before"` is not accepted. The `record_time` must be an exact ACS snapshot time, or omit `record_time_match` entirely.

---

## Activities

Live transfer data with full sender/receiver details.

**Latest network-wide activities:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/activities" \
  -H "Content-Type: application/json" \
  -d '{"page_size": 100}' | jq '.'
```

**Filter for a specific party (client-side):**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/activities" \
  -H "Content-Type: application/json" \
  -d '{"page_size": 1000}' \
  | jq '[.activities[] | select(.transfer.sender.party | contains("kairo"))]'
```

> **Note:** The `party_id` request parameter does not filter server-side. Always use client-side `jq` filtering.

**Key response fields per activity:**
- `.activity_type` — `"transfer"`, `"tap"`, etc.
- `.date` — ISO 8601 timestamp
- `.round` — Round number
- `.transfer.sender.party` — Sender party ID
- `.transfer.sender.input_amulet_amount` — Amulet input
- `.transfer.sender.input_app_reward_amount` — App reward input
- `.transfer.sender.sender_change_amount` — Change returned to sender
- `.transfer.sender.sender_change_fee` — Fee on change
- `.transfer.receivers[]` — Array of receivers (empty = receiverless transfer)
- `.transfer.receivers[].party` — Receiver party ID
- `.transfer.receivers[].amount` — CC received

**Example: receiverless transfer (Kairo):**
```json
{
  "transfer": {
    "sender": {
      "party": "kairo-mainnet::122051624456...",
      "input_amulet_amount": "2589357.5956765744",
      "input_app_reward_amount": "551.7205892748",
      "sender_change_amount": "2589909.3162658492"
    },
    "receivers": []
  }
}
```

**Example: normal transfer (different app):**
```json
{
  "transfer": {
    "sender": {
      "input_amulet_amount": "1428981010.0727602883",
      "sender_change_amount": "1428980910.0727602883"
    },
    "receivers": [
      {
        "party": "auxilary-1::1220b8301e...",
        "amount": "100.0000000000"
      }
    ]
  }
}
```

---

## Vote Results

Governance vote history.

```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/vote-results" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}' | jq '.'
```

> **Note:** The `limit` parameter is required.

---

## Common Patterns

### Look up an entity's full on-chain profile

**1. Check FA status:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/featured-apps" \
  | jq '.featured_apps[] | select(.payload.provider | contains("kairo"))'
```

**2. Get cumulative rewards:**
```bash
curl -s "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/top-providers-by-app-rewards?round=98727" \
  | jq '.top_providers[] | select(.provider | contains("kairo"))'
```

**3. Get per-party totals:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/round-party-totals" \
  -H "Content-Type: application/json" \
  -d '{
    "party_id": "kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060",
    "start_round": 98727,
    "end_round": 98727
  }' | jq '.'
```

**4. Get current balance:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/holdings/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "migration_id": 4,
    "record_time": "2026-06-03T00:00:00Z",
    "owner_party_ids": ["kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060"]
  }' | jq '.'
```

**5. Check recent activity:**
```bash
curl -s -X POST "https://scan.sv-2.global.canton.network.digitalasset.com/api/scan/v0/activities" \
  -H "Content-Type: application/json" \
  -d '{"page_size": 1000}' \
  | jq '[.activities[] | select(.transfer.sender.party | contains("kairo"))]'
```

---

## BigQuery Queries

The Scan API does not support namespace-level queries or bulk historical analysis. Use BigQuery for those.

**Table:** `governence-483517.transformed.events_parsed`
**Partitioned by:** `DATE(effective_at)` — always filter on `effective_at` to control scan cost.
**Clustered by:** `template_id, event_type, migration_id`

### Identify all wallets sharing a namespace key

```sql
SELECT DISTINCT party
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS party
WHERE party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
ORDER BY party
```

For comprehensive coverage, also check `signatories`, `witness_parties`, and `observers`:

```sql
SELECT DISTINCT party
FROM `governence-483517.transformed.events_parsed`,
UNNEST(
  ARRAY_CONCAT(
    IFNULL(signatories, []),
    IFNULL(acting_parties, []),
    IFNULL(witness_parties, []),
    IFNULL(observers, [])
  )
) AS party
WHERE party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
ORDER BY party
```

### Transfer counts by sender wallet (monthly)

Uses `payload → $.transfer.sender` for accurate per-wallet attribution (avoids double-counting from `acting_parties` UNNEST).

```sql
SELECT
  FORMAT_TIMESTAMP('%Y-%m', effective_at) AS month,
  SPLIT(JSON_VALUE(payload, '$.transfer.sender'), '::')[OFFSET(0)] AS wallet,
  COUNT(*) AS transfers
FROM `governence-483517.transformed.events_parsed`
WHERE choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
GROUP BY ROLLUP(month, wallet)
ORDER BY month, transfers DESC
```

> **Important:** Do NOT use `UNNEST(acting_parties)` for transfer counts — a single transfer event can have multiple entity wallets in `acting_parties`, inflating counts. Always use `JSON_VALUE(payload, '$.transfer.sender')` for sender attribution.

### Transfer counts by sender wallet (weekly)

```sql
SELECT
  FORMAT_TIMESTAMP('%Y-%W', effective_at) AS week,
  SPLIT(JSON_VALUE(payload, '$.transfer.sender'), '::')[OFFSET(0)] AS wallet,
  COUNT(*) AS transfers
FROM `governence-483517.transformed.events_parsed`
WHERE choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<namespace_key_fingerprint>'
  AND effective_at BETWEEN '2026-03-15' AND '2026-05-15'
GROUP BY week, wallet
ORDER BY week, transfers DESC
```

### Verify all transfers are receiverless

```sql
SELECT
  COUNT(*) AS total_transfers,
  COUNTIF(JSON_VALUE(payload, '$.transfer.receivers[0].party') IS NOT NULL) AS with_receivers,
  COUNTIF(JSON_VALUE(payload, '$.transfer.receivers[0].party') IS NULL) AS receiverless
FROM `governence-483517.transformed.events_parsed`
WHERE choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
```

### Reward coupons by provider (monthly)

```sql
SELECT
  FORMAT_TIMESTAMP('%Y-%m', effective_at) AS month,
  COUNT(*) AS reward_coupons,
  SUM(CAST(JSON_VALUE(payload, '$.amount') AS NUMERIC)) AS coupon_amount
FROM `governence-483517.transformed.events_parsed`
WHERE template_id LIKE '%AppRewardCoupon%'
  AND event_type = 'created'
  AND JSON_VALUE(payload, '$.provider') LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
GROUP BY ROLLUP(month)
ORDER BY month
```

### Traffic purchases by entity

```sql
SELECT
  FORMAT_TIMESTAMP('%Y-%m', effective_at) AS month,
  SPLIT(party, '::')[OFFSET(0)] AS wallet,
  COUNT(*) AS traffic_events,
  SUM(CAST(JSON_VALUE(payload, '$.trafficAmount') AS INT64)) AS traffic_bytes
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS party
WHERE choice = 'AmuletRules_BuyMemberTraffic'
  AND party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
GROUP BY month, wallet
ORDER BY month
```

### All contract templates for an entity

```sql
SELECT template_id, COUNT(*) AS events
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS party
WHERE party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
GROUP BY template_id
ORDER BY events DESC
```

### External party interaction check

```sql
SELECT DISTINCT ext_party
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS actor,
UNNEST(ARRAY_CONCAT(IFNULL(witness_parties, []), IFNULL(observers, []))) AS ext_party
WHERE actor LIKE '%<namespace_key_fingerprint>'
  AND ext_party NOT LIKE '%<namespace_key_fingerprint>'
  AND ext_party NOT LIKE '%DSO%'
  AND effective_at >= '2025-12-01'
```

Returns zero rows if the entity has no external users.

### Allocation activity

```sql
SELECT
  choice,
  COUNT(*) AS events,
  COUNT(DISTINCT JSON_VALUE(payload, '$.receiver')) AS unique_receivers,
  COUNT(DISTINCT JSON_VALUE(payload, '$.provider')) AS unique_providers
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS party
WHERE choice LIKE 'Allocation%'
  AND party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
GROUP BY choice
ORDER BY events DESC
```

### Outbound transfers (flow of funds)

```sql
SELECT
  DATE(effective_at) AS date,
  JSON_VALUE(exercise_result, '$.balanceChanges[0].party') AS recipient,
  CAST(JSON_VALUE(exercise_result, '$.balanceChanges[0].amount') AS NUMERIC) AS cc_amount
FROM `governence-483517.transformed.events_parsed`
WHERE choice IN ('AmuletRules_Transfer', 'TransferPreapproval_Send', 'TransferPreapproval_SendV2')
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<namespace_key_fingerprint>'
  AND JSON_VALUE(payload, '$.transfer.receivers[0].party') IS NOT NULL
  AND effective_at >= '2025-12-01'
ORDER BY effective_at
```
