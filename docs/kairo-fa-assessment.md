# Kairo FA Assessment — Data Summary for Tokenomics Committee

---

## Key Findings

1. **All 620,172 transfers have zero receivers.** Every `AmuletRules_Transfer` exercised by Kairo sends CC to no counterparty — `receivers` is NULL across 100% of transfers (BigQuery) and independently confirmed as `receivers: []` via live Scan API query (Section 1). The full input amount returns to Kairo on every transfer.

2. **These receiverless transfers generated 19,405,516 CC in Featured App rewards.** Each transfer triggers an `AppRewardCoupon` because Kairo holds FA status. All 732,612 coupons are tagged `featured = true`. Zero unfeatured coupons exist (Section 2).

3. **Zero network traffic purchased.** Kairo has purchased no network traffic across the entire observation period — cumulative traffic is 0 CC (`round-party-totals`, rounds 78,649–98,649).

4. **No application-specific contracts.** The only contract templates associated with Kairo are standard Amulet infrastructure: `Splice.Amulet:Amulet`, `Splice.Amulet:LockedAmulet`, and `Splice.AmuletAllocation:AmuletAllocation` (Section 4).

5. **Earned CC was transferred out to related and external wallets.** Four wallets share the same namespace root key (`1220516244...`). From `kairo-mainnet`, 13,700,262 CC flowed to `angelhack-mainnet-1`, with additional transfers to anonymous wallets and DEX liquidity pools. From `angelhack-mainnet-1`, 40,067,000 CC was sent to an anonymous wallet on a single transfer (Section 3).

6. **141 unique `kairo::` parties appear on-chain but none receive CC.** These parties are signatories and acting parties on kairo-mainnet events, but zero of them appear as transfer recipients, witnesses, or observers (BigQuery, `acting_parties` and `signatories` arrays).

| Metric | Value | Source |
|--------|-------|--------|
| FA Approval Date | 2025-12-16 | `featured-apps` |
| Leaderboard Rank | #47 of all Featured Apps | `top-providers-by-app-rewards` |
| Cumulative CC credited | 19,405,516 | `top-providers-by-app-rewards` and `round-party-totals`, round 98,727 |
| Network traffic purchased | 0 | `round-party-totals`, rounds 78,649–98,649 |
| Current holdings (4 wallets) | 3,510,098 | Scan API, June 3 2026 |

The on-chain vote reason for Kairo's FA grant states:

> "Tokenomics has agreed to reinstate the FA rights for the Kairo app and give them the same opportunity as all other apps to be fully compliant with the existing FA Guidelines by Monday, Apr 20th 2026, 5 pm ET."

## 1. Transfer Pattern

Kairo is the `acting_party` on 620,172 `AmuletRules_Transfer` events. On every transfer, `$.transfer.sender` is Kairo's own party ID and `$.transfer.receivers` is NULL.

| Month | Transfer Events |
|-------|----------------|
| 2025-12 | 265 |
| 2026-01 | 6,596 |
| 2026-02 | 109,980 |
| 2026-03 | 386,141 |
| 2026-04 | 114,506 |
| 2026-05 | 2,571 |
| 2026-06 (partial) | 113 |
| **Total** | **620,172** |

Kairo's `AppRewardCoupon` contracts are generated as a side effect of these `AmuletRules_Transfer` executions. On the Canton Network, exercising this choice triggers reward coupon creation for the provider when the provider holds Featured App status.

In Kairo's case, every transfer has:
- **Sender** (`$.transfer.sender`): Kairo's own party ID
- **Receivers** (`$.transfer.receivers`): NULL
- **Output amount** (`$.summary.outputAmuletAmount`): NULL
- **Sender fee** (`$.summary.senderChangeFee`): 0

Sample of transfer exercise results (BigQuery):

| Input Amount (CC) | Output Amount | Sender Fee | Receivers |
|-------------------|---------------|------------|-----------|
| 2,582,463 | NULL | 0 | NULL |
| 2,413,470 | NULL | 0 | NULL |
| 2,579,753 | NULL | 0 | NULL |
| 2,554,626 | NULL | 0 | NULL |
| 2,567,943 | NULL | 0 | NULL |

### 1.1 Independent Verification via Scan API

The receiverless transfer pattern was independently confirmed via a live Scan API query (`/v0/activities`) on June 3, 2026. Raw response for a Kairo transfer at round 98,729:

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

The `receivers` array is empty. `sender_change_amount` (2,589,909.32) equals `input_amulet_amount` (2,589,357.60) + `input_app_reward_amount` (551.72). The full input returns to Kairo.

For comparison, a transfer from a different app in the same API response (round 98,729):

```json
{
  "sender": {
    "input_amulet_amount": "1428981010.0727602883",
    "sender_change_amount": "1428980910.0727602883"
  },
  "receivers": [
    {
      "party": "auxilary-1::1220b8301e...",
      "amount": "100.0000000000",
      "receiver_fee": "0.0000000000"
    }
  ]
}
```

**Data sources cross-referenced:**

| Source | Scope | Result |
|--------|-------|--------|
| BigQuery (`events_parsed`) | 100% of 620,172 transfers | All receivers NULL |
| Scan API (`/v0/activities`) | Live sample, June 3 2026 | `receivers: []` |

## 2. App Rewards

**Total credited CC: 19,405,516** (Scan API, both `top-providers-by-app-rewards` and `round-party-totals` at round 98,727).

All reward coupons are tagged `featured = true`. Zero unfeatured coupons exist.

Monthly coupon breakdown (BigQuery `AppRewardCoupon` created events):

| Month | Reward Coupons | Coupon Amount (Amulet units) |
|-------|---------------|------------------------------|
| 2025-12 | 737 | 5,565 |
| 2026-01 | 36,443 | 265,065 |
| 2026-02 | 214,134 | 4,671,441 |
| 2026-03 | 442,771 | 20,544,805 |
| 2026-04 | 34,689 | 10,305,771 |
| 2026-05 | 3,650 | 8,081,166 |
| 2026-06 (partial) | 188 | 345,621 |
| **Total** | **732,612** | **44,219,434** |

## 3. Wallet Network and Flow of Funds

### 3.1 Wallets Sharing Namespace Key Fingerprint

Four wallets share the same namespace key fingerprint (`1220516244...`):

| Wallet | Balance (CC) |
|--------|-------------|
| `kairo-mainnet` | 2,566,014 |
| `angelhack-mainnet-1` | 837,821 |
| `kairo-dex-lp-1` | 51,092 |
| `kairo-dex-lp-2` | 55,171 |
| **Total** | **3,510,098** |

Balances queried via Scan API `/v0/holdings/summary` on 2026-06-03.

On the Canton Network, a party ID has the format `name::fingerprint`. The fingerprint is the SHA-256 hash of the namespace root public key. Parties sharing the same fingerprint were created under the same root key, meaning the root key holder retains administrative control over all parties in that namespace ([source](https://docs.daml.com/canton/usermanual/identity_management.html)).

### 3.2 Income Sources

| Wallet | Source | Cumulative CC | Notes |
|--------|--------|--------------|-------|
| `kairo-mainnet` | App rewards | 19,405,516 | FA rewards from receiverless transfers |
| `kairo-mainnet` | Validator rewards | 0 | |
| `kairo-mainnet` | Traffic purchased | 0 | |
| `angelhack-mainnet-1` | Validator rewards | 3,521,811 | |
| `angelhack-mainnet-1` | Traffic CC spent | 17,666,162 | 12,010 purchases |

Source: `top-providers-by-app-rewards`, `round-party-totals`, BigQuery.

### 3.3 Outflows from kairo-mainnet

28 outbound transfers to `angelhack-mainnet-1` totaling 13,700,482 CC received (from BigQuery `balanceChanges`). Additional transfers to other recipients via `TransferPreapproval_Send` (84 total) and `TransferPreapproval_SendV2` (10 total) between January 26 and June 1, 2026. Additionally, 93 `TransferFactory_Transfer` events (these contain no `balanceChanges` data; the corresponding `TransferPreapproval_Send` event holds the transfer details).

**Recipients from kairo-mainnet (from BigQuery `exercise_result` balanceChanges):**

| Recipient | Total CC Sent | Transfers | Period |
|-----------|--------------|-----------|--------|
| `angelhack-mainnet-1` (same namespace key) | 13,700,262 | 28 | Jan–Jun 2026 |
| `1220d54a...` (anonymous) | 7,554,000 | 2 | Mar 9 + Apr 28, 2026 |
| `3182da19...` | 130,000 | Multiple | Multiple dates |
| `kairo-dex-lp-1` (same namespace key) | 50,000 | 1 | Apr 2, 2026 |
| `kairo-dex-lp-2` (same namespace key) | 50,000 | 1 | Apr 2, 2026 |

### 3.4 Outflows from angelhack-mainnet-1

**Recipients from angelhack-mainnet-1 (from BigQuery `exercise_result` data):**

| Date | Recipient | CC Amount |
|------|-----------|-----------|
| 2026-02-08 | `1220c3cece...` (anonymous) | 40,067,000 |
| 2026-01-27 | `12206f27...` (anonymous) | 5,000,000 |
| 2026-05-14 | `qcpTradingME-validator-1` | 750,000 |
| 2026-05-14 | `qcpTradingPteLtd-validator-1` | 547,500 |
| Multiple | `3182da19...` (anonymous) | 112,000 |
| 2026-01-21 | `2d06f92d...` (anonymous) | 2,600 |

The transfer reason field for the February 8 transfer contains `"E2182132FA527DDD221D"`.

### 3.5 Balance Summary

| Metric | CC | Source |
|--------|-----|--------|
| Cumulative FA rewards credited (kairo-mainnet) | 19,405,516 | `top-providers-by-app-rewards` and `round-party-totals` at round 98,727 |
| Cumulative validator rewards (angelhack-mainnet-1) | 3,521,811 | `round-party-totals` |
| Current balance across all 4 wallets | 3,510,098 | Scan API, June 3 2026 |

## 4. On-Chain Activity

**Contract templates where Kairo appears as a party (BigQuery):**

| Template | Active Months |
|----------|--------------|
| `Splice.Amulet:Amulet` | Dec 2025 – Jun 2026 |
| `Splice.Amulet:LockedAmulet` | Feb – Apr 2026 |
| `Splice.AmuletAllocation:AmuletAllocation` | Feb – Apr 2026 |

No application-specific contract templates exist. All three templates are standard Amulet infrastructure.

---

## Data Sources

### Canton Scan API

Endpoints used (any healthy SV; primary: `digitalasset.com`, fallback: `sync.global`):

- **`GET /v0/featured-apps`** — FA status, provider, appName, created_at
- **`GET /v0/top-providers-by-app-rewards`** — leaderboard rank, cumulative rewards
- **`POST /v0/round-party-totals`** — cumulative app/validator rewards, traffic purchased
- **`POST /v0/admin/sv/voteresults`** — vote reason, completedAt
- **`POST /v0/holdings/summary`** — wallet balances (unlocked, locked, total)
- **`POST /v0/activities`** — live transfer data with sender, receivers, amounts

### BigQuery

Project `governence-483517`, table `transformed.events_parsed`. All queries filtered `effective_at >= '2025-12-01'`.

### Reference Price

The CC/USD price on the query date (June 3, 2026) was **$0.149/CC**. All amounts in this report are in CC. Multiply by $0.149 for approximate USD equivalents at the query date; actual prices at the time of each transaction may have differed.

### Query Date

All data queried on June 3, 2026 unless otherwise noted.
