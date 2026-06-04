# Kairo FA Assessment — Data Summary for Tokenomics Committee

---

## Key Findings

1. **16 wallets share the same namespace root key, operated by the same entity.** Wallets include `kairo-mainnet`, `angelhack-mainnet-1`, `kairo-dex-executor`, `kairo-dex-lp-1`, `kairo-dex-lp-2`, `sanctum-mainnet`, `sanc-oct`, `sanc-octlabs`, and others (Section 1). Source: BigQuery, filtered by namespace key fingerprint `12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060`.

2. **779,030 receiverless self-transfers across all entity wallets.** Every `AmuletRules_Transfer` event across all 16 wallets has zero receivers — verified across 100% of transfers (BigQuery) and independently confirmed via Scan API (Section 2). Source: BigQuery entity-wide query, `choice = 'AmuletRules_Transfer'`, `transfers = receiverless_transfers` on every row.

3. **These transfers generated 19,405,516 CC in FA rewards.** Only `kairo-mainnet` earned AppRewardCoupons. 732,710 coupons, all tagged `featured = true`, zero unfeatured (Section 3). Source: Scan API `top-providers-by-app-rewards` and `round-party-totals` at round 98,727; BigQuery `AppRewardCoupon` created events filtered by provider.

4. **Traffic purchased by `angelhack-mainnet-1` correlates with FA reward generation.** Both rise and fall together month-over-month (Section 4). Source: BigQuery, monthly traffic events and AppRewardCoupon events joined by month.

5. **Zero DEX-specific contracts on-chain.** All contract templates are standard Splice/Amulet infrastructure. Zero external (non-entity) parties appear as witnesses or observers. All 775,587 `Allocation_ExecuteTransfer` events have zero receivers (Section 5). Source: BigQuery, `template_id` and `witness_parties`/`observers` queries.

6. **Transfer activity migrated across wallets around the Apr 20, 2026 compliance deadline.** `kairo-mainnet` volume dropped from 126,075/week (week of Mar 16) to 218/week (week of Apr 13), while `kairo-dex-executor` appeared with 40,482 transfers that same week (Section 6). Source: BigQuery, weekly transfer counts by wallet.

7. **Kairo's FA has been removed.** Not present in the current `featured-apps` list (154 FAs exist as of June 4, 2026). Source: Scan API `GET /v0/featured-apps`.

| Metric | Value | Source |
|--------|-------|--------|
| FA Approval Date | 2025-12-16 | Scan API `featured-apps` |
| FA Status (June 4, 2026) | Removed | Scan API `featured-apps` |
| Entity wallets (same namespace key) | 16 | BigQuery |
| Entity-wide receiverless transfers | 779,030 | BigQuery |
| Cumulative CC credited (kairo-mainnet) | 19,405,516 | Scan API `top-providers-by-app-rewards`, round 98,727 |
| Cumulative traffic CC spent (angelhack) | 17,666,162 | Scan API `round-party-totals` |
| Current holdings (4 wallets, June 3) | 3,510,098 | Scan API `holdings/summary` |

The on-chain vote reason for Kairo's FA grant states:

> "Tokenomics has agreed to reinstate the FA rights for the Kairo app and give them the same opportunity as all other apps to be fully compliant with the existing FA Guidelines by Monday, Apr 20th 2026, 5 pm ET."

---

## 1. Entity Structure

16 wallets share the namespace key fingerprint `12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060`:

| Wallet | Role |
|--------|------|
| `kairo-mainnet` | FA provider, primary transfer wallet |
| `angelhack-mainnet-1` | Validator, traffic purchaser |
| `kairo-dex-executor` | Receiverless transfers (Apr–May 2026) |
| `kairo-dex-lp-1` | Receiverless transfers (Apr 2026) |
| `kairo-dex-lp-2` | Receiverless transfers (Apr–May 2026) |
| `sanctum-mainnet` | Receiverless transfers (Apr–May 2026) |
| `sanc-oct` | Receiverless transfers (May 2026) |
| `sanc-octlabs` | Receiverless transfers (May–Jun 2026) |
| `sanc-zod` | No transfer activity in observation period |
| `sanctum-collection` | Receiverless transfers (May 2026) |
| `kairo-distro` | No transfer activity in observation period |
| `kairo-faucet-0` | No transfer activity in observation period |
| `kairo-funding-wallet` | No transfer activity in observation period |
| `23020500-79eb-...` | No transfer activity in observation period |
| `6a5eaaa6-7418-...` | No transfer activity in observation period |
| `c862121b-3dfc-...` | Receiverless transfers (May 2026, 4 events) |

Source: BigQuery, all distinct parties matching the namespace key across `signatories`, `acting_parties`, `witness_parties`, and `observers` arrays, `effective_at >= '2025-12-01'`.

On the Canton Network, a party ID has the format `name::fingerprint`. The fingerprint is the SHA-256 hash of the namespace root public key. Parties sharing the same fingerprint were created under the same root key, meaning the root key holder retains administrative control over all parties in that namespace ([source](https://docs.daml.com/canton/usermanual/identity_management.html)).

**Balances** (Scan API `holdings/summary`, June 3, 2026):

| Wallet | Balance (CC) |
|--------|-------------|
| `kairo-mainnet` | 2,566,014 |
| `angelhack-mainnet-1` | 837,821 |
| `kairo-dex-lp-1` | 51,092 |
| `kairo-dex-lp-2` | 55,171 |
| **Total** | **3,510,098** |

DEX and sanctum wallets returned null from Scan API `round-party-totals` (rounds 98,830–98,874, queried June 4, 2026), indicating zero cumulative rewards and zero traffic purchases for those wallets.

## 2. Transfer Pattern

779,030 `AmuletRules_Transfer` events across all entity wallets. Every one has zero receivers (`transfers` = `receiverless_transfers` on every row).

**Monthly breakdown by wallet** (BigQuery, entity-wide query):

| Month | angelhack | kairo-mainnet | dex-executor | dex-lp-1 | dex-lp-2 | Others | Total |
|-------|-----------|--------------|-------------|----------|----------|--------|-------|
| 2025-12 | 4,345 | 265 | — | — | — | — | 4,610 |
| 2026-01 | 4,429 | 6,556 | — | — | — | — | 10,985 |
| 2026-02 | 3,448 | 109,743 | — | — | — | — | 113,191 |
| 2026-03 | 2,365 | 386,128 | — | — | — | — | 388,493 |
| 2026-04 | 3,142 | 70,232 | 98,295 | 42,081 | 36,728 | 1 | 250,479 |
| 2026-05 | 3,673 | 2,571 | 2,991 | — | 374 | 892 | 10,501 |
| 2026-06 | 363 | 190 | — | — | — | 218 | 771 |
| **Total** | **21,765** | **575,685** | **101,286** | **42,081** | **37,102** | **1,111** | **779,030** |

"Others" includes `sanctum-mainnet` (81), `sanc-octlabs` (862), `sanc-oct` (161), `sanctum-collection` (3), `c862121b` (4).

Every transfer has:
- **Sender** (`$.transfer.sender`): entity wallet's own party ID
- **Receivers** (`$.transfer.receivers`): NULL
- **Output amount** (`$.summary.outputAmuletAmount`): NULL
- **Sender fee** (`$.summary.senderChangeFee`): 0

### 2.1 Independent Verification via Scan API

The receiverless transfer pattern was independently confirmed via Scan API (`/v0/activities`) on June 3, 2026. Raw response for a Kairo transfer at round 98,729:

```json
{
  "activity_type": "transfer",
  "date": "2026-06-03T15:47:04.969682Z",
  "round": 98729,
  "transfer": {
    "sender": {
      "party": "kairo-mainnet::122051624456...",
      "input_amulet_amount": "2589357.5956765744",
      "input_app_reward_amount": "551.7205892748",
      "sender_change_amount": "2589909.3162658492",
      "sender_change_fee": "0.0000000000",
      "sender_fee": "0.0000000000",
      "holding_fees": "0.0000000000"
    },
    "receivers": []
  }
}
```

`sender_change_amount` (2,589,909.32) = `input_amulet_amount` (2,589,357.60) + `input_app_reward_amount` (551.72). The full input returns to Kairo.

For comparison, a transfer from a different app in the same round:

```json
{
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
```

| Source | Scope | Result |
|--------|-------|--------|
| BigQuery | 100% of 779,030 entity transfers | All receivers NULL |
| Scan API (`/v0/activities`) | Live sample, June 3, 2026 | `receivers: []` |

As of June 4, 2026, zero entity transfers appear in the latest 1,000 network-wide activities (Scan API `/v0/activities`).

## 3. Reward Generation

**Total credited CC: 19,405,516** (Scan API, `top-providers-by-app-rewards` and `round-party-totals` at round 98,727).

Only `kairo-mainnet` earned AppRewardCoupons across the entity. No other entity wallet appears as a reward coupon provider (BigQuery, `AppRewardCoupon` created events filtered by namespace key in `$.provider`).

| Metric | Value | Source |
|--------|-------|--------|
| Total reward coupons | 732,710 | BigQuery, `AppRewardCoupon` created events |
| Total coupon amount (Amulet units) | 44,376,891 | BigQuery, `SUM($.amount)` |
| Featured coupons | 732,710 (100%) | BigQuery, `$.featured = 'true'` |
| Unfeatured coupons | 0 | BigQuery |
| First coupon | 2025-12-19 | BigQuery |
| Last coupon | 2026-06-03 | BigQuery |

Monthly coupon breakdown (BigQuery):

| Month | Reward Coupons | Coupon Amount (Amulet units) |
|-------|---------------|------------------------------|
| 2025-12 | 737 | 5,565 |
| 2026-01 | 36,443 | 265,065 |
| 2026-02 | 214,134 | 4,671,441 |
| 2026-03 | 442,771 | 20,544,805 |
| 2026-04 | 34,689 | 10,305,771 |
| 2026-05 | 3,650 | 8,081,166 |
| 2026-06 (partial) | 286 | 503,079 |
| **Total** | **732,710** | **44,376,891** |

## 4. Traffic-to-Reward Correlation

`angelhack-mainnet-1` is the only entity wallet purchasing traffic. `kairo-mainnet` has zero traffic purchases (Scan API `round-party-totals`).

Traffic is purchased via `AmuletRules_BuyMemberTraffic` (BigQuery). Each purchase buys traffic for the shared participant node. The `trafficAmount` is in sequencer bytes. The inputs include `InputAmulet`, `InputSvRewardCoupon`, and `InputValidatorRewardCoupon` (BigQuery, sample payload from March 15, 2026).

**Monthly comparison** (BigQuery, traffic events by entity namespace key joined with AppRewardCoupon created events by kairo-mainnet provider):

| Month | Traffic Events | Traffic Amount (bytes) | Reward Coupons | Reward Coupon Amount |
|-------|---------------|----------------------|----------------|---------------------|
| 2025-12 | 3 | 5,999,400 | 737 | 5,565 |
| 2026-01 | 51 | 101,989,800 | 36,443 | 265,065 |
| 2026-02 | 2,995 | 5,989,401,000 | 214,134 | 4,671,441 |
| 2026-03 | 10,461 | 22,840,467,600 | 442,771 | 20,544,805 |
| 2026-04 | 2,433 | 13,377,600,000 | 34,689 | 10,305,771 |
| 2026-05 | 2,197 | 12,975,600,000 | 3,650 | 8,081,166 |
| 2026-06 | 163 | 978,000,000 | 286 | 503,079 |

**CC-level comparison** (Scan API `round-party-totals`, round 98,727):

| Metric | CC | Source |
|--------|-----|--------|
| Traffic CC spent (angelhack-mainnet-1) | 17,666,162 | `round-party-totals` |
| FA rewards credited (kairo-mainnet) | 19,405,516 | `top-providers-by-app-rewards` |
| Validator rewards credited (angelhack-mainnet-1) | 3,521,811 | `round-party-totals` |

## 5. On-Chain Contract Analysis

**All contract templates involving entity wallets** (BigQuery, all events where entity namespace key appears in `signatories` or `acting_parties`, `effective_at >= '2025-12-01'`):

| Template | Events |
|----------|--------|
| `Splice.Amulet:FeaturedAppRight` | 5,148,684 |
| `Splice.Amulet:Amulet` | 1,170,935 |
| `Splice.AmuletAllocation:AmuletAllocation` | 947,697 |
| `Splice.AmuletRules:AmuletRules` | 976,516 |
| `Splice.Amulet:LockedAmulet` | 334,510 |
| `Splice.ExternalPartyAmuletRules:ExternalPartyAmuletRules` | 159,389 |
| `Splice.Util.FeaturedApp.BatchedMarkersProxy:BatchedMarkersProxy` | 25,325 |
| `Splice.Amulet:ValidatorRewardCoupon` | 19,699 |
| `Splice.Round:OpenMiningRound` | 18,303 |
| `Splice.ValidatorLicense:ValidatorLicense` | 21,550 |
| `Splice.Amulet:SvRewardCoupon` | 25,036 |
| `Splice.AmuletRules:TransferPreapproval` | 1,576 |
| `Splice.AmuletRules:ExternalPartySetupProposal` | 235 |
| `Splice.Amulet:ValidatorRight` | 232 |
| `Splice.ExternalPartyAmuletRules:TransferCommand` | 26 |
| `Splice.AmuletTransferInstruction:AmuletTransferInstruction` | 3 |

Every template is standard Splice/Amulet infrastructure. Zero application-specific or DEX-specific contracts exist.

**External party interaction:** Zero non-entity, non-DSO parties appear as `witness_parties` or `observers` on any event where the entity is the `acting_party` (BigQuery).

**Allocation activity** (BigQuery, `Allocation%` choices where entity is acting party):

| Choice | Events | Unique Receivers | Unique Providers |
|--------|--------|-----------------|-----------------|
| AllocationFactory_Allocate | 167,253 | 0 | 0 |
| Allocation_ExecuteTransfer | 775,587 | 0 | 0 |
| Allocation_Withdraw | 4,684 | 0 | 0 |
| Allocation_Cancel | 173 | 0 | 0 |

All allocation events have zero receivers and zero providers in the payload (`$.receiver` and `$.provider` are NULL).

## 6. Activity Around Compliance Deadline

The on-chain vote set a compliance deadline of April 20, 2026, 5 PM ET.

**Weekly transfer volume by wallet** (BigQuery, `AmuletRules_Transfer` events, Mar 15 – May 15, 2026):

| Week | Dates (approx) | kairo-mainnet | dex-executor | dex-lp-1 | dex-lp-2 | angelhack | Entity Total |
|------|----------------|--------------|-------------|----------|----------|-----------|-------------|
| 11 | Mar 16–22 | 126,075 | — | — | — | 515 | 126,590 |
| 12 | Mar 23–29 | 113,931 | — | — | — | 522 | 114,453 |
| 13 | Mar 30–Apr 5 | 71,334 | — | 38,921 | 26,278 | 632 | 137,166 |
| 14 | Apr 6–12 | 2,106 | 21,096 | 1,219 | 2,633 | 738 | 27,792 |
| 15 | Apr 13–19 | 218 | 40,482 | 1,941 | 3,430 | 730 | 46,801 |
| **16** | **Apr 20–26** | 228 | 25,567 | — | 3,140 | 917 | 29,852 |
| 17 | Apr 27–May 3 | 97 | 12,523 | — | 1,414 | 730 | 14,764 |
| 18 | May 4–10 | 405 | 1,618 | — | 207 | 904 | 3,136 |
| 19 | May 11–17 | 401 | — | — | — | 634 | 1,051 |

Week 16 (starting Apr 20) is the compliance deadline week. `kairo-mainnet` dropped from 126,075 transfers/week (week 11) to 218 (week 15). `kairo-dex-executor` appeared in week 14 with 21,096 transfers and peaked at 40,482 in week 15. `kairo-dex-lp-1` and `kairo-dex-lp-2` appeared in week 13.

All transfers across all wallets and all weeks are 100% receiverless.

## 7. Flow of Funds

### 7.1 Income Sources

| Wallet | Source | Cumulative CC | Source |
|--------|--------|--------------|--------|
| `kairo-mainnet` | App rewards | 19,405,516 | Scan API `top-providers-by-app-rewards`, round 98,727 |
| `kairo-mainnet` | Validator rewards | 0 | Scan API `round-party-totals` |
| `kairo-mainnet` | Traffic purchased | 0 | Scan API `round-party-totals` |
| `angelhack-mainnet-1` | Validator rewards | 3,521,811 | Scan API `round-party-totals` |
| `angelhack-mainnet-1` | Traffic CC spent | 17,666,162 | Scan API `round-party-totals` |

### 7.2 Outflows from kairo-mainnet

28 outbound transfers to `angelhack-mainnet-1` totaling 13,700,262 CC (BigQuery `exercise_result` `balanceChanges`). Additional transfers via `TransferPreapproval_Send` (84 events) and `TransferPreapproval_SendV2` (10 events) between January 26 and June 1, 2026.

**Recipients** (BigQuery `exercise_result` balanceChanges):

| Recipient | Total CC Sent | Transfers | Period |
|-----------|--------------|-----------|--------|
| `angelhack-mainnet-1` (same namespace key) | 13,700,262 | 28 | Jan–Jun 2026 |
| `1220d54a...` (anonymous) | 7,554,000 | 2 | Mar 9 + Apr 28, 2026 |
| `3182da19...` | 130,000 | Multiple | Multiple dates |
| `kairo-dex-lp-1` (same namespace key) | 50,000 | 1 | Apr 2, 2026 |
| `kairo-dex-lp-2` (same namespace key) | 50,000 | 1 | Apr 2, 2026 |

### 7.3 Outflows from angelhack-mainnet-1

**Recipients** (BigQuery `exercise_result` data):

| Date | Recipient | CC Amount |
|------|-----------|-----------|
| 2026-02-08 | `1220c3cece...` (anonymous) | 40,067,000 |
| 2026-01-27 | `12206f27...` (anonymous) | 5,000,000 |
| 2026-05-14 | `qcpTradingME-validator-1` | 750,000 |
| 2026-05-14 | `qcpTradingPteLtd-validator-1` | 547,500 |
| Multiple | `3182da19...` (anonymous) | 112,000 |
| 2026-01-21 | `2d06f92d...` (anonymous) | 2,600 |

The transfer reason field for the February 8 transfer contains `"E2182132FA527DDD221D"`.

### 7.4 Balance Summary

| Metric | CC | Source |
|--------|-----|--------|
| Cumulative FA rewards credited (kairo-mainnet) | 19,405,516 | Scan API, round 98,727 |
| Cumulative validator rewards (angelhack-mainnet-1) | 3,521,811 | Scan API, round 98,727 |
| Current balance across 4 wallets | 3,510,098 | Scan API, June 3, 2026 |

---

## Data Sources

### Canton Scan API

Primary SV: `scan.sv-2.global.canton.network.digitalasset.com/api/scan`. Endpoints used:

- **`GET /v0/featured-apps`** — FA status, provider. Queried June 3 and June 4, 2026.
- **`GET /v0/top-providers-by-app-rewards`** — Leaderboard rank, cumulative rewards. Queried at round 98,727.
- **`POST /v0/round-party-totals`** — Cumulative app/validator rewards, traffic purchased. Queried at round 98,727 for kairo-mainnet and angelhack-mainnet-1; rounds 98,830–98,874 for DEX/sanctum wallets (returned null).
- **`POST /v0/holdings/summary`** — Wallet balances. Queried June 3, 2026.
- **`POST /v0/activities`** — Live transfer data with sender, receivers, amounts. Queried June 3 and June 4, 2026.

### BigQuery

Project `governence-483517`, table `transformed.events_parsed`. Partitioned by `DATE(effective_at)`, clustered by `template_id, event_type, migration_id`. All queries filtered `effective_at >= '2025-12-01'`.

Key queries:

- **Entity wallets**: All distinct parties matching namespace key `12205162...060` across `signatories`, `acting_parties`, `witness_parties`, `observers` arrays.
- **Entity-wide activity**: Monthly transfer counts, traffic events, reward coupons per wallet. Filtered by namespace key in `acting_parties` or `signatories`, grouped by `SPLIT(party, '::')[OFFSET(0)]` as wallet name.
- **Reward coupons**: `template_id LIKE '%AppRewardCoupon%' AND event_type = 'created'`, filtered by `JSON_VALUE(payload, '$.provider')` matching namespace key.
- **Traffic-reward comparison**: `AmuletRules_BuyMemberTraffic` events by entity wallets joined with `AppRewardCoupon` events by kairo-mainnet provider, grouped by month.
- **Contract templates**: All `template_id` values on events involving entity wallets.
- **External users**: `witness_parties` and `observers` on entity events, excluding entity namespace key and DSO parties.
- **Allocation activity**: `Allocation%` choices, `COUNT(DISTINCT JSON_VALUE(payload, '$.receiver'))` and `COUNT(DISTINCT JSON_VALUE(payload, '$.provider'))`.
- **Weekly breakdown**: `AmuletRules_Transfer` events by wallet, `FORMAT_TIMESTAMP('%Y-%W', effective_at)`, Mar 15 – May 15, 2026.

### Reference Price

The CC/USD price on the query date (June 3, 2026) was **$0.149/CC**. All amounts in this report are in CC. Multiply by $0.149 for approximate USD equivalents at the query date; actual prices at the time of each transaction may have differed.

### Query Dates

- BigQuery entity queries: June 3–4, 2026
- Scan API balances: June 3, 2026
- Scan API FA status check: June 4, 2026
- Scan API activity verification: June 3 and June 4, 2026
