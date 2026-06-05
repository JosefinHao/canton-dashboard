# Canton Scan API — Useful Commands

Practical reference for querying the Canton Network Scan API directly via `curl`. Based on commands used during the Kairo FA investigation (Jun 2026).

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

```bash
PARTY="kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060"
ROUND=98727

# 1. Check FA status
curl -s ".../v0/featured-apps" | jq --arg p "$PARTY" '.featured_apps[] | select(.payload.provider == $p)'

# 2. Get cumulative rewards
curl -s ".../v0/top-providers-by-app-rewards?round=$ROUND" | jq --arg p "$PARTY" '.top_providers[] | select(.provider == $p)'

# 3. Get per-party totals (rewards, traffic, transfers)
curl -s -X POST ".../v0/round-party-totals" -H "Content-Type: application/json" \
  -d "{\"party_id\": \"$PARTY\", \"start_round\": $ROUND, \"end_round\": $ROUND}" | jq '.'

# 4. Get current balance
curl -s -X POST ".../v0/holdings/summary" -H "Content-Type: application/json" \
  -d "{\"migration_id\": 4, \"record_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"owner_party_ids\": [\"$PARTY\"]}" | jq '.'

# 5. Check recent activity
curl -s -X POST ".../v0/activities" -H "Content-Type: application/json" \
  -d '{"page_size": 1000}' | jq --arg p "$PARTY" '[.activities[] | select(.transfer.sender.party == $p)]'
```

### Identify all wallets sharing a namespace key

Use BigQuery (not available via Scan API):
```sql
SELECT DISTINCT party
FROM `governence-483517.transformed.events_parsed`,
UNNEST(acting_parties) AS party
WHERE party LIKE '%<namespace_key_fingerprint>'
  AND effective_at >= '2025-12-01'
ORDER BY party
```

The Scan API does not support namespace-level queries. To find all wallets under a shared key, query BigQuery across `signatories`, `acting_parties`, `witness_parties`, and `observers`.
