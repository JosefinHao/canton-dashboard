# Kairo FA Assessment — Data Summary for Tokenomics Committee

---

## Executive Summary

Kairo has held Featured App status since December 16, 2025. A second FeaturedAppRight contract was created on April 21, 2026; the associated on-chain vote reason references a reinstatement with a compliance deadline of April 20, 2026.

Kairo ranks #47 among all Featured Apps with 25.65M cumulative CC, compared to the top 5 which range from 495M to 2B CC. All reward coupons are tagged `featured = true` (zero unfeatured coupons).

Kairo has zero unique external wallets across its entire on-chain history. The ledger shows 620,172 `AmuletRules_Transfer` events where Kairo is the acting party. On all of these, Kairo is the sender and the receivers array is empty — no external wallets participate in any of them. These receiverless transfers still generate `AppRewardCoupon` contracts because Kairo holds Featured App status.

Four wallets share the same key fingerprint (`1220516244...`), forming an AngelHack wallet network: `kairo-mainnet`, `angelhack-mainnet-1`, `kairo-dex-lp-1`, and `kairo-dex-lp-2`. Earned rewards flow from `kairo-mainnet` to `angelhack-mainnet-1` (which also earns SV and validator rewards independently) and onward to external parties. The largest single outflow was ~40M CC to an anonymous wallet on February 8, 2026. Combined current holdings across all four wallets total ~3.5M CC — approximately 14% of the 25.65M cumulative FA CC earned.

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
- **Receivers** (`$.transfer.receivers`): NULL (field absent from payload — no recipient exists)
- **Output amount** (`$.summary.outputAmuletAmount`): NULL
- **Sender fee** (`$.summary.senderChangeFee`): 0
- **Input amount** (`$.summary.inputAmuletAmount`): ~2.4–2.6M CC per transfer
- **Provider**: Kairo (as Featured App)

Sample of verified transfer exercise results:

| Input Amount (CC) | Output Amount | Sender Fee | Receivers |
|-------------------|---------------|------------|-----------|
| 2,582,463 | NULL | 0 | NULL |
| 2,413,470 | NULL | 0 | NULL |
| 2,579,753 | NULL | 0 | NULL |
| 2,554,626 | NULL | 0 | NULL |
| 2,567,943 | NULL | 0 | NULL |

Each of these 620,172 receiverless transfers generated an `AppRewardCoupon` tagged `featured = true`. This is the sole source of Kairo's ~44.2M CC in cumulative rewards.

## 6. Wallet Network and Flow of Funds

### 6.1 AngelHack Wallet Network

Four wallets share the same key fingerprint (`1220516244...`), indicating a single controlling entity:

| Wallet | Role | Balance (CC) | ~USD |
|--------|------|-------------|------|
| `kairo-mainnet` | FA reward generator | 2,566,014 | $382,000 |
| `angelhack-mainnet-1` | SV beneficiary + validator | 837,821 | $125,000 |
| `kairo-dex-lp-1` | LP wallet | 51,092 | $8,000 |
| `kairo-dex-lp-2` | LP wallet | 55,171 | $8,000 |
| **Total held** | | **3,510,098** | **$523,000** |

Balances queried via Scan API `/v0/holdings/summary` on 2026-06-03.

### 6.2 Income Sources

**kairo-mainnet** earns FA app rewards only (25.65M cumulative CC from leaderboard).

**angelhack-mainnet-1** independently earns SV and validator rewards and actively purchases network traffic:

| Metric | Value |
|--------|-------|
| Cumulative validator rewards | 3,521,811 CC |
| Cumulative app rewards | 0 |
| SvRewardCoupon events | 25,343 (total weight 633,575,000) |
| ValidatorRewardCoupon events | 19,681 |
| Cumulative traffic CC spent | 17,666,162 CC |
| Traffic purchase count | 12,010 |

Note: `angelhack-mainnet-1` spends 17.7M CC on network traffic while `kairo-mainnet` purchases zero.

### 6.3 Outflows from kairo-mainnet

94 outbound transfers via `TransferPreapproval_Send`/`SendV2` between January 26 and June 1, 2026. Exercise result metadata labels these as `"Transfer via direct TransferFactory (internal)"`.

**Recipients from kairo-mainnet:**

| Recipient | Total CC (approx) | Period |
|-----------|------------------|--------|
| `angelhack-mainnet-1` (same key) | Millions across ~70 transfers | Jan–Jun 2026 |
| `1220d54a...` (anonymous) | ~7,554,000 | Mar 9 + Apr 28, 2026 |
| `3182da19...` (anonymous) | ~130,000 | Multiple dates |
| `kairo-dex-lp-1` (same key) | ~50,000 | Apr 2, 2026 |
| `kairo-dex-lp-2` (same key) | ~50,000 | Apr 2, 2026 |

### 6.4 Outflows from angelhack-mainnet-1

**Recipients from angelhack-mainnet-1:**

| Date | Recipient | CC Amount |
|------|-----------|-----------|
| 2026-02-08 | `1220c3cece...` (anonymous) | **~40,067,000** |
| 2026-01-27 | `12206f27...` (anonymous) | ~5,000,000 |
| 2026-05-14 | `qcpTradingME-validator-1` | ~750,000 |
| 2026-05-14 | `qcpTradingPteLtd-validator-1` | ~547,500 |
| Multiple | `3182da19...` (anonymous) | ~112,000 |
| 2026-01-21 | `2d06f92d...` (anonymous) | ~2,600 |

The February 8 transfer of ~40M CC to anonymous wallet `1220c3cece...` is the largest single outflow. The transfer reason field contains `"E2182132FA527DDD221D"`.

### 6.5 Balance Summary

| Metric | CC | ~USD |
|--------|-----|------|
| Cumulative FA rewards earned (kairo-mainnet) | 25,650,297 | $3,822,000 |
| Current balance across all 4 wallets | 3,510,098 | $523,000 |
| **No longer held** | **~22,140,000** | **~$3,299,000** |

Approximately 86% of cumulative FA-earned CC is no longer held by any AngelHack-controlled wallet.

## 7. Network Traffic

| Metric | Value |
|--------|-------|
| Cumulative traffic purchased | 0 |
| Cumulative traffic CC spent | 0 |
| Traffic num purchases | 0 |

Sampled at rounds 78,649 through 98,649 (covering Kairo's full FA lifetime). Every sample returned zero.

## 8. On-Chain Activity

**Choice frequency (all choices exercised by Kairo):**

| Choice | Count |
|--------|-------|
| `FeaturedAppRight_CreateActivityMarker` | 5,150,586 |
| `AmuletRules_Transfer` | 620,172 |
| `Allocation_ExecuteTransfer` | 469,604 |
| `Archive` | 395,848 |
| `AmuletRules_ComputeFees` | 124,518 |
| `AllocationFactory_Allocate` | 124,518 |
| `LockedAmulet_Unlock` | 124,437 |
| `BatchedMarkersProxy_CreateMarkers` | 21,059 |
| `Allocation_Withdraw` | 4,447 |
| `BatchedMarkersProxy_CreateMarkersV2` | 4,168 |
| `Allocation_Cancel` | 173 |
| `TransferFactory_Transfer` | 93 |
| `TransferPreapproval_Send` | 84 |
| `LockedAmulet_OwnerExpireLock` | 81 |
| `TransferPreapproval_SendV2` | 10 |

The dominant activity is `FeaturedAppRight_CreateActivityMarker` (5.15M events), which drives reward coupon generation. The only choices involving external parties are `TransferFactory_Transfer` (93) and `TransferPreapproval_Send/V2` (94) — outbound transfers to `angelhack-mainnet-1` and other recipients (see Section 6).

**Contract templates where Kairo appears as a party:**

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
- **`POST /v0/holdings/summary`** — `summaries[].party_id`, `.total_unlocked_coin`, `.total_locked_coin`, `.total_coin_holdings`

### BigQuery

Project `governence-483517`, table `transformed.events_parsed`. All queries filtered `effective_at >= '2025-12-01'`.

- **Party matching**: `signatories`, `witness_parties`, `acting_parties`, `observers` (ARRAY<STRING>)
- **Reward extraction**: `JSON_VALUE(payload, '$.provider')`, `'$.amount'`, `'$.featured'`, `'$.round.number'`
- **Transfer extraction**: `JSON_VALUE(payload, '$.transfer.sender')`, `JSON_VALUE(payload, '$.transfer.receivers[0].party')`, `JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount')`
- **Choice frequency**: `choice`, `COUNT(*)` grouped by choice, filtered by `acting_parties`
- **Outbound transfers**: `exercise_result` → `$.result.summary.balanceChanges`, `$.meta.values` for `TransferPreapproval_SendV2` events
