# Kairo FA Assessment — Data Summary for Tokenomics Committee

---

## Executive Summary

Kairo has held Featured App status since December 16, 2025. A second FeaturedAppRight contract was created on April 21, 2026; the associated on-chain vote reason references a reinstatement with a compliance deadline of April 20, 2026.

Kairo ranks #47 among all Featured Apps with 25.65M cumulative CC, compared to the top 5 which range from 495M to 2B CC. All reward coupons are tagged `featured = true` (zero unfeatured coupons).

Kairo has zero unique external wallets across its entire on-chain history. The ledger shows 620,172 `AmuletRules_Transfer` events where Kairo is the acting party. On all of these, Kairo is the sender and the receivers array is empty — no external wallets participate in any of them. These receiverless transfers still generate `AppRewardCoupon` contracts because Kairo holds Featured App status.

Kairo has purchased zero network traffic across all sampled rounds. The only contract templates associated with Kairo are `Splice.Amulet:Amulet`, `Splice.Amulet:LockedAmulet`, and `Splice.AmuletAllocation:AmuletAllocation` — all related to amulet reward distribution.

---

## 1. FA Status

| Metric | Value |
|--------|-------|
| FA Approval Date | 2025-12-16 |
| Days as FA | 168 |
| Leaderboard Rank | #47 of all Featured Apps |
| Cumulative CC | 25,650,297 |
| Pre-FA CC | 0 |

The on-chain vote reason for Kairo's FA grant states:

> "Tokenomics has agreed to reinstate the FA rights for the Kairo app and give them the same opportunity as all other apps to be fully compliant with the existing FA Guidelines by Monday, Apr 20th 2026, 5 pm ET."

Two `FeaturedAppRight` contracts were created for Kairo: one on 2025-12-16 and a second on 2026-04-21.

## 2. Active Wallets

**Zero unique external wallets have interacted with Kairo across its entire lifetime.**

All parties appearing in `signatories`, `acting_parties`, and `observers` arrays on Kairo-related events were queried. Excluding Kairo's own party ID and DSO system parties, both the all-time and per-month queries returned empty result sets.

## 3. Monthly Transfer Volume

Kairo is the `acting_party` on 620,172 `AmuletRules_Transfer` events. On every one of these transfers, `$.transfer.sender` is Kairo's own party ID and the `$.transfer.receivers` array is empty (NULL at `$.transfer.receivers[0].party`). Zero external wallets participate in any of them.

| Month | Transfer Events | Unique Senders | Unique Receivers |
|-------|----------------|----------------|------------------|
| 2025-12 | 265 | 0 | 0 |
| 2026-01 | 6,596 | 0 | 0 |
| 2026-02 | 109,980 | 0 | 0 |
| 2026-03 | 386,141 | 0 | 0 |
| 2026-04 | 114,506 | 0 | 0 |
| 2026-05 | 2,571 | 0 | 0 |
| 2026-06 (3 days) | 113 | 0 | 0 |
| **Total** | **620,172** | **0** | **0** |

## 4. Monthly App Rewards Earned

All reward coupons are tagged `featured = true`. Zero unfeatured coupons exist.

| Month | Reward Coupons | CC Earned | ~USD (at current $0.149/CC) |
|-------|---------------|-----------|----------------------------|
| 2025-12 | 737 | 5,565 | $830 |
| 2026-01 | 36,443 | 265,065 | $39,529 |
| 2026-02 | 214,134 | 4,671,441 | $696,647 |
| 2026-03 | 442,771 | 20,544,805 | $3,063,826 |
| 2026-04 | 34,689 | 10,305,771 | $1,536,889 |
| 2026-05 | 3,650 | 8,081,166 | $1,205,136 |
| 2026-06 (3 days) | 188 | 345,621 | $51,542 |
| **Total** | **732,612** | **~44.2M** | **~$6.6M** |

Note: USD estimates use the current amulet price for all months; actual values at the time of each reward may differ.

## 5. Reward Generation Mechanism

Kairo's `AppRewardCoupon` contracts are generated as a side effect of `AmuletRules_Transfer` choice executions. On the Canton Network, exercising this choice on the `AmuletRules` contract triggers reward coupon creation for the provider when the provider holds Featured App status.

In Kairo's case, every transfer has:
- **Sender** (`$.transfer.sender`): Kairo's own party ID
- **Receivers** (`$.transfer.receivers`): empty array (no recipient)
- **Provider**: Kairo (as Featured App)

Each of these 620,172 receiverless transfers generated an `AppRewardCoupon` tagged `featured = true`. This is the sole source of Kairo's ~44.2M CC in cumulative rewards.

## 6. Network Traffic

| Metric | Value |
|--------|-------|
| Cumulative traffic purchased | 0 |
| Cumulative traffic CC spent | 0 |
| Traffic num purchases | 0 |

Sampled at rounds 78,649 through 98,649 (covering Kairo's full FA lifetime). Every sample returned zero.

## 7. On-Chain Activity

The only contract templates where Kairo appears as a party:

| Template | Active Months |
|----------|--------------|
| `Splice.Amulet:Amulet` | Dec 2025 – Jun 2026 |
| `Splice.Amulet:LockedAmulet` | Feb – Apr 2026 |
| `Splice.AmuletAllocation:AmuletAllocation` | Feb – Apr 2026 |

All three are related to amulet reward distribution.

---

## Data Sources

### Canton Scan API

`https://scan.sv-1.global.canton.network.sync.global/api/scan`

- **`GET /v0/featured-apps`** — `featured_apps[].payload.provider`, `.appName`, `.created_at`
- **`GET /v0/top-providers-by-app-rewards`** — `providersAndRewards[].provider`, `.rewards`
- **`POST /v0/round-party-totals`** — `entries[].party`, `.cumulative_app_rewards`, `.cumulative_validator_rewards`, `.cumulative_traffic_purchased`, `.cumulative_traffic_num_purchases`
- **`POST /v0/admin/sv/voteresults`** — `dso_rules_vote_results[].request.reason.body`, `.completedAt`

### BigQuery

Project `governence-483517`, table `transformed.events_parsed`. All queries filtered `effective_at >= '2025-12-01'`.

- **Party matching**: `signatories`, `witness_parties`, `acting_parties`, `observers` (ARRAY<STRING>)
- **Reward extraction**: `JSON_VALUE(payload, '$.provider')`, `'$.amount'`, `'$.featured'`, `'$.round.number'`
- **Transfer extraction**: `JSON_VALUE(payload, '$.transfer.sender')`, `JSON_VALUE(payload, '$.transfer.receivers[0].party')`, `JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount')`
