# Canton Network Investigation Playbook

Lessons learned from the CoinAegis forensic audit (June 2026). This document captures non-obvious payload structures, query pitfalls, and proven investigation patterns for BigQuery and the Scan API.

---

## BigQuery Gotchas — What Will Silently Break Your Queries

### 1. Use the top-level `choice` column, NOT `JSON_VALUE(payload, '$.choice')`

The `payload` JSON does **not** contain a `$.choice` field. Using `JSON_VALUE(payload, '$.choice')` returns NULL for every row — your query runs, returns zero results, and you won't get an error.

```sql
-- WRONG — silently returns nothing
WHERE JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'

-- CORRECT — use the top-level column
WHERE choice = 'AmuletRules_Transfer'
```

This was the single most time-consuming mistake in the CoinAegis investigation. The table has 321,410 matching rows but the wrong query returned zero.

### 2. Summary fields live in `exercise_result`, NOT `payload`

Transfer and traffic exercise results (fees, reward amounts, balance changes) are in the `exercise_result` JSON column, not `payload`.

```sql
-- WRONG — returns NULL
JSON_VALUE(payload, '$.summary.inputAppRewardAmount')

-- CORRECT
JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount')
```

### 3. Coupon amounts use `$.amount`, NOT `$.amount.initialAmount`

When querying AppRewardCoupon created events:

```sql
-- WRONG — returns NULL
CAST(JSON_VALUE(payload, '$.amount.initialAmount') AS FLOAT64)

-- CORRECT
CAST(JSON_VALUE(payload, '$.amount') AS FLOAT64)
```

### 4. Cannot CAST `exercise_result` directly to STRING

```sql
-- WRONG — BigQuery error
CAST(exercise_result AS STRING)

-- CORRECT
TO_JSON_STRING(exercise_result)
```

### 5. Use `JSON_VALUE(payload, '$.transfer.sender')` for transfer counts, NOT `UNNEST(acting_parties)`

A single transfer event can have multiple entity wallets in `acting_parties` (e.g., both sender and receiver if same key), inflating counts. The sender field gives exact attribution.

```sql
-- WRONG — overcounts when sender/receiver share a key
SELECT COUNT(*) FROM ... , UNNEST(acting_parties) AS ap
WHERE choice = 'AmuletRules_Transfer' AND ap LIKE '%<key>%'

-- CORRECT — one row per transfer, attributed to actual sender
SELECT COUNT(*) FROM ...
WHERE choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<key>%'
```

In the CoinAegis case, this difference was 253,397 vs 312,696 transfers.

### 6. Marker exercise payloads do NOT have a `$.provider` field

FeaturedAppActivityMarker exercise payloads have this structure:

```json
{
  "beneficiaries": [{"beneficiary": "validator-name::1220...", "weight": "1.0"}],
  "weight": "376.0"
}
```

There is **no** `$.provider` field in the exercise payload. To determine which FA a marker belongs to, use `acting_parties`:

```sql
-- WRONG — $.provider does not exist in marker exercise payloads, returns NULL
WHERE JSON_VALUE(payload, '$.provider') LIKE '%goldacorn%'

-- CORRECT — the FA's party ID is in acting_parties
WHERE EXISTS (
  SELECT 1 FROM UNNEST(acting_parties) AS ap
  WHERE ap LIKE '%goldacorn%'
)
```

This mistake caused 165 markers (coinaegisVault + coinaegis) to be misattributed to aevumWallet in the initial analysis.

### 7. AppRewardCoupon `$.provider` field exists on CREATED events, not exercise events

When looking at coupon creation, `$.provider` works. When looking at how a coupon was exercised (claimed/expired), the payload structure is different.

```sql
-- Coupon creation — $.provider works
WHERE template_id LIKE '%AppRewardCoupon%'
  AND event_type = 'created'
  AND JSON_VALUE(payload, '$.provider') LIKE '%<key>%'

-- Coupon exercise (claim/expire) — check choice name
WHERE template_id LIKE '%AppRewardCoupon%'
  AND event_type = 'exercised'
  AND choice IN ('Archive', 'AppRewardCoupon_DsoExpire')
```

---

## Key Payload Structures (exercise_result.summary)

### AmuletRules_Transfer exercise_result.summary

```json
{
  "inputAmuletAmount": "1234.5678",
  "inputAppRewardAmount": "100.0",
  "inputValidatorRewardAmount": "50.0",
  "inputValidatorFaucetAmount": "0.0",
  "senderChangeAmount": "1184.5678",
  "senderChangeFee": "0E-10",
  "amuletPrice": "1.234",
  "balanceChanges": [
    {
      "party": "receiver-name::1220...",
      "changeToInitialAmountAsOfRoundZero": "100.0"
    }
  ]
}
```

Key fields:
- `senderChangeFee`: Transfer fee (currently `0E-10` — zero by protocol config)
- `inputAppRewardAmount`: CC claimed from app reward coupons during this transfer
- `inputValidatorRewardAmount`: CC claimed from validator reward coupons
- `inputValidatorFaucetAmount`: CC claimed from faucet coupons
- `senderChangeAmount`: CC returned to sender as change
- `balanceChanges[].party`: Receiver party ID (for tracing destinations)

### AmuletRules_BuyMemberTraffic exercise_result.summary

Same structure as transfer. Net CC consumed = sum of all inputs - senderChangeAmount.

```sql
SUM(
  CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)
  + CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)
  + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)
  + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorFaucetAmount') AS FLOAT64)
  - CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeAmount') AS FLOAT64)
) AS net_cc_consumed
```

The `inputAmuletAmount` is gross (recycled CC goes in and comes back as change). Only the net difference is actual consumption.

### FeaturedAppRight_CreateActivityMarker payload

```json
{
  "beneficiaries": [{"beneficiary": "validator-name::1220...", "weight": "1.0"}],
  "weight": "376.0"
}
```

- `weight`: The value the FA provider submitted — determines share of the app reward pool. Pre-CIP-0104, this was unvalidated.
- `beneficiaries[].beneficiary`: Party that receives the resulting AppRewardCoupons.
- No `provider` field — use `acting_parties` to identify the FA.

### AppRewardCoupon payload (created event)

```json
{
  "dso": "DSO::1220...",
  "provider": "fa-name::1220...",
  "amount": "12345.6789",
  "featured": true,
  "round": {"number": "97500"}
}
```

- `amount`: Direct field, not nested under `initialAmount`
- `featured`: Whether the coupon came from the FeaturedAppActivityMarker mechanism
- `provider`: The FA that generated this coupon

### AppRewardCoupon exercise choices

- `Archive` = coupon was claimed (consumed during a transfer or BuyMemberTraffic)
- `AppRewardCoupon_DsoExpire` = coupon expired unclaimed (DSO archived it)

---

## Proven Investigation Queries

### Complete CC accounting for an entity

Sum all reward inputs across both transfer and traffic events to get total CC claimed:

```sql
SELECT
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)) AS app_rewards,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)) AS val_rewards,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorFaucetAmount') AS FLOAT64)) AS faucet_rewards
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '<start>' AND '<end>'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND choice IN ('AmuletRules_Transfer', 'AmuletRules_BuyMemberTraffic')
  AND EXISTS (
    SELECT 1 FROM UNNEST(acting_parties) AS ap
    WHERE ap LIKE '%<namespace_key>%'
  )
```

Run this once for transfers and once for BuyMemberTraffic to break down where rewards were claimed. The sum across both should match the Scan API's `v0/top-providers-by-app-rewards` figure.

### Distinguish self-transfers from external transfers

```sql
SELECT
  CASE
    WHEN ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) = 0
      THEN 'consolidation_no_outputs'
    WHEN CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) = 0
      THEN 'consolidation_zero_amount'
    WHEN JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%<key>%'
      THEN 'self_transfer'
    ELSE 'external_transfer'
  END AS transfer_type,
  COUNT(*) AS count,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS total_fee
FROM `governence-483517.transformed.events_parsed`
WHERE choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<key>%'
  AND DATE(effective_at) BETWEEN '<start>' AND '<end>'
  AND event_type = 'exercised' AND migration_id = 4
GROUP BY transfer_type
```

### Activity markers per FA (attributed via acting_parties)

```sql
SELECT
  SPLIT(ap, '::')[OFFSET(0)] AS fa_name,
  COUNT(*) AS marker_count,
  SUM(CAST(JSON_VALUE(payload, '$.weight') AS FLOAT64)) AS total_weight,
  AVG(CAST(JSON_VALUE(payload, '$.weight') AS FLOAT64)) AS avg_weight
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS ap
WHERE choice = 'FeaturedAppRight_CreateActivityMarker'
  AND event_type = 'exercised' AND migration_id = 4
  AND DATE(effective_at) BETWEEN '<start>' AND '<end>'
  AND ap LIKE '%<key>%'
  AND ap NOT LIKE '%DSO%'
GROUP BY fa_name
ORDER BY marker_count DESC
```

### Daily outflow timeline (transfers + traffic)

```sql
WITH daily_transfers AS (
  SELECT DATE(effective_at) AS d, 'transfer_out' AS type, COUNT(*) AS n,
    SUM(CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64)) AS cc
  FROM `governence-483517.transformed.events_parsed`
  WHERE choice = 'AmuletRules_Transfer' AND event_type = 'exercised' AND migration_id = 4
    AND DATE(effective_at) BETWEEN '<start>' AND '<end>'
    AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%<key>%'
    AND JSON_VALUE(payload, '$.transfer.outputs[0].receiver') NOT LIKE '%<key>%'
    AND ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) > 0
    AND CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) > 0
  GROUP BY d
),
daily_traffic AS (
  SELECT DATE(effective_at) AS d, 'buy_traffic' AS type, COUNT(*) AS n,
    SUM(
      CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorFaucetAmount') AS FLOAT64)
      - CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeAmount') AS FLOAT64)
    ) AS cc
  FROM `governence-483517.transformed.events_parsed`
  WHERE choice = 'AmuletRules_BuyMemberTraffic' AND event_type = 'exercised' AND migration_id = 4
    AND DATE(effective_at) BETWEEN '<start>' AND '<end>'
    AND EXISTS (SELECT 1 FROM UNNEST(acting_parties) AS ap WHERE ap LIKE '%<key>%')
  GROUP BY d
)
SELECT * FROM daily_transfers UNION ALL SELECT * FROM daily_traffic
ORDER BY d, type
```

### Coupon claim/expire breakdown per FA

```sql
SELECT
  SPLIT(JSON_VALUE(payload, '$.provider'), '::')[OFFSET(0)] AS fa_name,
  choice AS outcome,
  COUNT(*) AS coupon_count,
  SUM(CAST(JSON_VALUE(payload, '$.amount') AS FLOAT64)) AS total_cc
FROM `governence-483517.transformed.events_parsed`
WHERE template_id LIKE '%AppRewardCoupon%'
  AND event_type = 'exercised' AND migration_id = 4
  AND JSON_VALUE(payload, '$.provider') LIKE '%<key>%'
  AND DATE(effective_at) BETWEEN '<start>' AND '<end>'
GROUP BY fa_name, outcome
ORDER BY fa_name, outcome
```

---

## Canton Protocol Concepts for Investigators

### Party IDs and Keys

- Format: `<display_name>::<key_fingerprint>` (e.g., `cryptolegacy-validator-1::1220abcd...`)
- The fingerprint (`1220...`) is derived from the party's cryptographic key
- **Same fingerprint = same key = same entity** — this is the primary way to link parties
- One entity can control many party IDs (CoinAegis had 44)
- `auth0_*` prefixed parties are created via Auth0 authentication

### Featured Apps (FAs)

- A `FeaturedAppRight` contract grants an app provider featured status
- Granted/revoked via DSO governance votes
- The FA **provider** exercises `FeaturedAppRight_CreateActivityMarker` — not the validator
- The validator can be listed as the **beneficiary** in the marker (receives the rewards)
- Same entity can control both the FA and the validator

### Reward Flow

1. FA provider exercises `FeaturedAppRight_CreateActivityMarker` with a `weight` parameter
2. Protocol calculates reward share based on weight proportion across all FAs for each round
3. `AppRewardCoupon` contracts are created (one per round per FA)
4. Coupons are **claimed** when consumed during `AmuletRules_Transfer` or `AmuletRules_BuyMemberTraffic` (shows up as `inputAppRewardAmount` in exercise_result)
5. Unclaimed coupons are **expired** by the DSO (`AppRewardCoupon_DsoExpire`)

### Mining Rounds

- Canton uses "mining rounds" (OpenMiningRound, IssuingMiningRound, ClosedMiningRound) — this is the protocol's own terminology, not proof-of-work
- Rounds occur approximately every 10 minutes (~1,440/day)
- Rewards are issued per round based on `issuanceConfig` (annual budget split between app/validator/SV rewards)

### Transfers

- `senderChangeFee` = transfer fee (currently zero: `0E-10`)
- Consolidation = transfer with no outputs (or zero-amount outputs) — merges multiple amulet contracts
- Holding fees (demurrage) are charged per round on amulet balances at rate `holdingFee.rate`

### BuyMemberTraffic

- Purchases network bandwidth by consuming CC
- Gross input (`inputAmuletAmount`) is much larger than net consumption — most CC comes back as `senderChangeAmount`
- Net CC consumed = sum of all inputs - change returned
- This is the mechanism CIP-0104 uses to replace marker weights (actual traffic = actual activity)

---

## Scan API Tips

### Useful Endpoints

| Endpoint | Method | Use |
|---|---|---|
| `v0/featured-apps` | GET | List all current FAs, find FA by provider key |
| `v0/top-providers-by-app-rewards?round=N` | GET | Cumulative app rewards per provider at round N |
| `v0/round-party-totals` | POST | Per-round cumulative stats (rewards, traffic, transfers) for a party |
| `v0/holdings/summary` | POST | Current wallet balances for party IDs |
| `v0/holdings/state` | POST | Active contract details (amulet contracts with amounts) |
| `v0/activities` | POST | Recent transfer activity (client-side filtering only) |
| `v0/vote-results` | POST | Governance vote history (FA grants, revocations) |
| `v0/admin/validator/licenses` | GET | Discover validator nodes (e.g., find which node hosts a party) |
| `v0/round-of-latest-data/0` | GET | Current round number |

### Key Scan API Gotchas

- `v0/activities` does **not** filter server-side by party — always use `jq` client-side
- `v0/round-party-totals` has a **50-round limit** per request
- `v0/top-providers-by-app-rewards` attributes CC to the **harvester** (beneficiary), not the FA that generated the coupons
- `v0/holdings/summary` requires exact `record_time` — `record_time_match: "before"` is not accepted
- `v0/vote-results` requires a `limit` parameter

### Scan API vs BigQuery

| Need | Use |
|---|---|
| Current balances, live FA status | Scan API |
| Cumulative rewards at a point in time | Scan API (`round-party-totals`) |
| Historical transfer tracing | BigQuery |
| Bulk analysis (all transfers by key) | BigQuery |
| Marker/coupon analysis | BigQuery |
| CC flow accounting | BigQuery |
| Cross-referencing multiple parties | BigQuery |

---

## Investigation Workflow

### Phase 1: Identify the entity

1. Start with a party ID or key fingerprint
2. **Scan API**: `v0/featured-apps` — check FA status
3. **Scan API**: `v0/top-providers-by-app-rewards` — check reward magnitude
4. **BigQuery**: Find all party IDs sharing the same key fingerprint
5. **BigQuery**: `template_id` grouped by `acting_parties` — see what contract types the entity touches

### Phase 2: Quantify activity

1. **BigQuery**: Count transfers (use `$.transfer.sender`, not `acting_parties`)
2. **BigQuery**: Count markers per FA (use `acting_parties`, not `$.provider`)
3. **BigQuery**: Sum reward coupons created/claimed/expired per FA
4. **BigQuery**: Classify transfers (self vs external, consolidation vs real)

### Phase 3: Follow the money

1. **BigQuery**: Sum all reward inputs across transfers + BuyMemberTraffic
2. **BigQuery**: Identify external recipients (receivers not matching entity key)
3. **BigQuery**: Build daily outflow timeline (transfers out + traffic consumed)
4. **BigQuery**: Verify total accounting: rewards in - transfers out - traffic - remaining - fees ≈ 0
5. **Scan API**: `v0/holdings/summary` — check what remains in wallets

### Phase 4: Verify protocol config

1. **BigQuery**: `AmuletRules_Fetch` exercise results contain protocol config (transfer fee rate, holding fee rate)
2. **BigQuery**: Sample exercise results to verify fee fields match protocol config
3. Cross-reference marker weights against actual transfer/traffic activity for the FA

---

## BigQuery Table Reference

**Table:** `governence-483517.transformed.events_parsed`

| Column | Type | Notes |
|---|---|---|
| `event_id` | STRING | Unique event identifier |
| `event_type` | STRING | `created`, `exercised`, `archived` |
| `template_id` | STRING | Full template ID (e.g., `...Splice.Amulet:AppRewardCoupon`) |
| `choice` | STRING | Top-level column — exercise choice name. **Use this, not payload.** |
| `payload` | JSON | Exercise arguments (transfer details, marker weights, coupon amounts) |
| `exercise_result` | JSON | Exercise output (summary with fees, reward inputs, balance changes) |
| `effective_at` | TIMESTAMP | When the event took effect (partition column — always filter on this) |
| `recorded_at` | TIMESTAMP | When the event was recorded |
| `acting_parties` | ARRAY<STRING> | Parties that authorized the exercise |
| `signatories` | ARRAY<STRING> | Contract signatories |
| `witness_parties` | ARRAY<STRING> | Witnesses to the event |
| `observers` | ARRAY<STRING> | Contract observers |
| `migration_id` | INT64 | Data migration version (use `4` as of Jun 2026) |

Always include in WHERE clauses:
- `DATE(effective_at) BETWEEN ...` (partition filter — controls scan cost)
- `event_type = 'exercised'` (for choice exercises)
- `migration_id = 4` (current migration)
