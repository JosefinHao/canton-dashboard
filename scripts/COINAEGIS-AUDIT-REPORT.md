# CoinAegis Audit Report

---

## Executive Summary

CoinAegis accumulated app rewards on the Canton Network using **44 party IDs** all controlled by the same cryptographic key, through two mechanisms across three phases:

**Phase 1 — Activity Marker Weight Inflation (goldacorn, Apr 24–25):** The goldacorn FA exercised `FeaturedAppRight_CreateActivityMarker` to create 919 FeaturedAppActivityMarkers with a cumulative weight of 318,898 (avg 347 per marker), designating `cryptolegacy-validator-1` as the beneficiary. Those markers generated 855 AppRewardCoupons worth 2,090,600 CC (all claimed). Within hours, 1.1M CC was transferred via quokka intermediaries to ByBit and Gate.io.

**Phase 2 — Self-Transfers + Markers (aevumWallet FA, May 9–28):** 39 `auth0_*` party IDs (same key) executed 312,696 self-transfers, moving tiny amounts (0.1–4 CC) between each other. During this period, 44,618 FeaturedAppActivityMarkers were created for the aevumWallet FA, generating 78,717 AppRewardCoupons worth 3,292,568 CC. 694,376 CC was claimed; the remaining 2,598,192 CC (78.9%) expired unclaimed.

**Phase 3 — Activity Marker Weight Inflation (coinaegisVault, May 27–Jun 3):** The coinaegisVault FA created 154 markers with a cumulative weight of 351,876 (avg 2,285 per marker), designating `cryptolegacy-validator-1` as the beneficiary. These generated 154 AppRewardCoupons worth 2,372,553 CC, but only 7,564 CC (0.3%) was claimed — the remaining 99.7% expired unclaimed. The FA was granted May 1 but had zero activity for 26 days; all markers appeared May 27 – Jun 3. This FA was not revoked until June 3, 6 days after the aevumWallet pause.

**Protocol vulnerability exploited:** The old Splice protocol had no validation that marker weights corresponded to actual app activity — the FA provider passed an arbitrary `weight` parameter when exercising `FeaturedAppRight_CreateActivityMarker` and the protocol accepted it. This vulnerability was acknowledged in **CIP-0104** (approved Feb 12, 2026), which noted "roughly 150% of weight is claimed via markers compared to actual traffic burned" and proposed replacing markers with deterministic traffic-based measurement. The fix was **not deployed** during CoinAegis's active window (April–May 2026).

The entity registered multiple FA grants under different names (CoinAegis, Aevum Wallet, Goldacorn), created 39 additional `auth0_*` party IDs, and harvested the majority of rewards through its validator node (`cryptolegacy-validator-1`), which was the designated `beneficiary` in goldacorn activity markers (verified via BigQuery exercise payloads). 1,065,002 CC was sent to ByBit and 700,001 CC to Gate.io — partially routed through quokka-controlled intermediary wallets. All four FAs have been revoked: goldacorn (Apr 25), aevumWallet (May 28), coinaegis (May 29), and coinaegisVault (Jun 3).

---

## Key Fingerprint

All party IDs share the same key:
```
122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3
```

This proves single-entity control over all 44 party IDs.

---

## Timeline

| Date | Event | Impact |
|---|---|---|
| Apr 20 | **3 FAs granted** on the same day: `coinaegis`, `aevumWallet`, `goldacorn` — all same key | Entity gains 3 Featured App slots in one vote cycle |
| Apr 24 17:32 – Apr 25 01:47 | **goldacorn: 919 markers created** with inflated weights (cumulative 318,898, avg 347/marker) | Generates 855 coupons worth **2,090,601 CC** — all claimed |
| Apr 24 21:26 | **Goldacorn revoke vote initiated** by Tokenomics Committee | |
| Apr 24 23:27 – Apr 25 05:14 | **1.1M CC transferred** from `cryptolegacy-validator-1` to quokka intermediaries (7 transfers) | CC moved out within hours of revoke vote |
| Apr 25 06:35 | **Goldacorn FA revoked** (9 for / 0 against) | |
| Apr 25 07:30 – Apr 26 14:21 | **Quokka forwards** 650K CC → ByBit, 450K CC → Gate.io | 1.1M CC reaches exchanges |
| May 1 | **coinaegisVault FA granted** ("2nd partyID" for CoinAegis) | FA sits dormant for 26 days |
| May 9 | **aevumWallet self-transfers begin**: 39 auth0 party IDs start shuffling 0.1–4 CC between each other | |
| May 9–28 | **312,696 self-transfers** executed + **44,618 markers** submitted for aevumWallet | Generates 78,717 coupons worth **3,292,568 CC** (694K claimed, 2.6M expired) |
| May 22 | **Peak day #1**: 100,135 self-transfers in a single day | |
| May 27 | **coinaegisVault activated**: 154 markers with inflated weights begin (cumulative 351,876, avg 2,285/marker) | Generates 154 coupons worth **2,372,553 CC** (7.5K claimed, 2.4M expired) |
| May 27 08:45–15:18 | **26 small transfers** from coinaegisVault to `quokka-validator-1` (4,234 CC total) | |
| May 28 | **Peak day #2**: 103,294 self-transfers — day of governance vote | |
| May 28 20:00 | **AevumWallet revoke vote initiated** by Tokenomics Committee | |
| May 28 21:41 | **AevumWallet FA revoked** (10 for / 0 against) | Self-transfers drop from 103K to 59 next day |
| May 28 22:03–22:12 | **~665K CC consolidated** into single holdings | |
| May 29 09:15 | **Coinaegis revoke vote initiated** | |
| May 29 10:38–10:45 | **Final cash-out**: 415K CC → ByBit + 250K CC → Gate.io (3 transfers in 7 minutes) | |
| May 29 20:49 | **Coinaegis FA revoked** (9 for / 0 against) | |
| May 27 – Jun 3 | **coinaegisVault continues generating coupons** — unrevoked for 6 days after aevumWallet pause | 99.7% of coupons expire unclaimed |
| Jun 3 15:22 | **CoinaegisVault FA revoked** (9 for / 0 against) | Last CoinAegis FA removed |

---

## Consolidated Party Summary

| Party | Role | Phase | Method | Transfers | Markers | Total Weight | Coupons | CC Created | CC Claimed | CC Expired |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `goldacorn` | Featured App (provider) | 1 (Apr 24–25) | **Unvalidated marker weights** | — | 919 | 318,898 | 855 | 2,090,600.71 | 2,090,600.71 | 0 |
| `aevumWallet` | Featured App (provider) | 2 (May 9–28) | **Self-transfers between auth0 parties** | 650 | 44,618 | 464,705 | 78,717 | 3,292,568.37 | 694,375.99 | 2,598,192.38 |
| `coinaegis` | Featured App (provider) | Minor | Not verified | — | 11 | 1,892 | 11 | 11,979.16 | 11,979.16 | 0 |
| `coinaegisVault` | Featured App (provider) | 3 (May 27–Jun 3) | **Inflated marker weights** (avg 2,285/marker) | — | 154 | 351,876 | 154 | 2,372,552.66 | 7,564.14 | 2,364,988.52 |
| `cryptolegacy-validator-1` | Validator + designated marker `beneficiary` | Both | Reward harvesting | — | — | — | — | — | 2,598,113.64 (harvested) | — |
| 39 `auth0_*` parties | Self-transfer counterparties | 2 | Self-transfer recipients | 312,696 self-transfers | — | — | — | — | ~39,001 (harvested) | — |
| **TOTAL** | | | | | **45,702** | **1,137,371** | **79,737** | **7,767,700.90** | **2,804,520.00** | **4,963,180.90** |

**Key observations:**
- 100% of AppRewardCoupons are `featured=true` — all rewards came through the FeaturedAppActivityMarker mechanism, not directly from transfers
- Claim/expire status verified via BigQuery exercise choice: "Archive" = claimed, "AppRewardCoupon_DsoExpire" = expired
- Of 7,767,701 CC generated in coupons, only 2,804,520 CC (36.1%) was claimed. 4,963,181 CC (63.9%) expired unclaimed — primarily from aevumWallet (2.6M CC expired) and coinaegisVault (2.4M CC expired)
- coinaegisVault used inflated marker weights (avg 2,285 per marker) — the same technique as goldacorn (avg 347) — to generate 2.37M CC in coupons, but claimed only 7,564 CC (0.3%)
- The Scan API's `v0/top-providers-by-app-rewards` attributes 2,598,114 CC to `cryptolegacy-validator-1` because that validator HARVESTED the rewards (via transfers and BuyMemberTraffic). The FAs that GENERATED the coupons were aevumWallet, goldacorn, and coinaegisVault

---

## auth0 Party Breakdown

The 39 `auth0_*` party IDs collectively harvested ~39,001 CC in app rewards (BigQuery-verified via `exercise_result.summary.inputAppRewardAmount`):

| Group | Count | Total CC |
|---|---:|---:|
| `auth0_007c69eb*` | 3 | ~4,012 |
| `auth0_007c6a003e*` | 1 | ~1,293 |
| `auth0_007c6a003f*` | 6 | ~7,704 |
| `auth0_007c6a03c*` | 5 | ~6,060 |
| `auth0_007c6a066ea*` | 10 | ~9,290 |
| `auth0_007c6a07b6*` | 14 | ~10,641 |
| **Total auth0** | **39** | **~39,001** |

---

## Current Holdings (What Remains in Wallets)

| Party | Holdings (CC) | Contract Created |
|---|---:|---|
| `cryptolegacy-validator-1` | 8,723.16 | 2026-05-29 |
| `aevumWallet` | 1,000.00 | 2026-05-29 |
| `coinaegis` | 1,000.00 | 2026-05-28 |
| `coinaegisVault` | 199.99 | 2026-05-27 |
| **Total remaining** | **~10,923 CC** | |

All contracts were created May 27-29. Only 0.3% of earned CC remains.

---

## Governance Timeline

| Date | Event | Details |
|---|---|---|
| 2026-04-20 | FA granted: `coinaegis` | "Dual-Vault RWA yield engine" |
| 2026-04-20 | FA granted: `aevumWallet` | "Aevum Extension Wallet" — same key as CoinAegis |
| 2026-04-20 | FA granted: `goldacorn` | "Goldacorn OTC/P2P swapping platform" — same key. 13 SVs voted yes, 0 against |
| 2026-04-24 21:26:31 | **Goldacorn revoke vote initiated** | Requester: Global-Synchronizer-Foundation. Reason: "Recent on-chain activity associated with the Goldacorn Protocol App requires further review. The Tokenomics Committee voted to pause it." URL: https://lists.sync.global/g/tokenomics-announce/message/316 |
| 2026-04-24 23:27–Apr 25 05:14 | **1.1M CC transferred to quokka** | 7 transfers from `cryptolegacy-validator-1` to quokka-controlled auth0 parties (see Money Trail Phase 1) |
| 2026-04-25 06:35:24 | **Goldacorn FA revoked** | Vote threshold reached: 9 for / 0 against, 4 abstaining (C7-Technology-Services-Limited, Proof-Group-1, SV-Nodeops-Limited, Tradeweb-Markets-1). Effective immediately. Last vote: Digital-Asset-1 at 06:35:15 |
| 2026-05-01 | FA granted: `coinaegisVault` | "2nd partyID" for CoinAegis |
| 2026-05-28 20:00:01 | **AevumWallet pause vote initiated** | Requester: Global-Synchronizer-Foundation. "Tokenomics Committee has voted to pause the AevumWallet App due to recent on-chain activity that needs further investigation" |
| 2026-05-28 21:41:43 | **AevumWallet FA revoked** | 10 for / 0 against, 3 abstaining (C7-Technology-Services-Limited, SV-Nodeops-Limited, Tradeweb-Markets-1) |
| 2026-05-28 21:42:17 | Last aevumWallet AppRewardCoupon | Round 97923 |
| 2026-05-28 22:03–22:12 | ~665K CC consolidated | Two transfers merging amulets + reward coupons into single holdings |
| 2026-05-29 09:15:17 | **Coinaegis revoke vote initiated** | Requester: Global-Synchronizer-Foundation. "Tokenomics Committee has voted to pause the Coinaegis App due to recent on-chain activity that needs further investigation" |
| 2026-05-29 10:38–10:45 | **Final transfers to exchanges** | 415K to ByBit + 250K to Gate in 7 minutes |
| 2026-05-29 20:49:56 | **Coinaegis FA revoked** | 9 for / 0 against, 4 abstaining (Cumberland-1, Cumberland-2, Digital-Asset-1, SV-Nodeops-Limited) |
| 2026-06-03 15:22:33 | **CoinaegisVault FA revoked** | 9 for / 0 against, 4 abstaining (Digital-Asset-1, Proof-Group-1, SV-Nodeops-Limited, Tradeweb-Markets-1). Last CoinAegis FA revoked |

---

## Mining Timeline (cryptolegacy-validator-1)

This validator was the designated `beneficiary` in goldacorn FA markers (verified via BigQuery exercise payloads), and earned 92.6% of all CoinAegis app rewards:

| Date (approx) | Round | Cumulative App CC | Cumulative Val CC | Note |
|---|---:|---:|---:|---|
| ~Mar 11 | 87000 | **0** | 7,604 | Validator rewards only |
| ~Apr 9 | 91000 | **0** | 26,197 | Still just validator |
| ~Apr 23 | 93000 | **0** | 33,587 | FA grants were Apr 20 |
| ~May 15 | 96000 | **1,142,873** | 50,072 | 1.1M app CC appeared |
| ~May 22 | 97000 | 1,432,292 | 152,543 | Val CC also tripled |
| ~May 28 | 97900 | 2,249,579 | 290,087 | **Day of first pause** |
| ~May 29 | 98000 | ~2,300,000 | ~295,000 | **Day of second pause** |
| Jun 1 | 98443 | **2,598,114** | >292,000 (last measured 292,142 at round 97910) | **Still mining** |

---

## Post-Pause Reward Harvesting

### After aevumWallet revoke (May 28 21:41:43 UTC)

The governance vote stopped new AppRewardCoupon generation. However, previously-generated coupons could still be harvested during transfers and BuyMemberTraffic:

| Party | CC harvested after May 28 pause | Source |
|---|---:|---|
| `cryptolegacy-validator-1` (app rewards) | ~348,535 | Pre-existing coupons claimed via transfers/BuyMemberTraffic |
| `aevumWallet` | ~5,610 | Pre-existing coupons claimed |
| `coinaegisVault` (active until Jun 3) | ≤7,564.14 (lifetime total; pre/post-pause split unknown) | FA remained active until Jun 3; generated 154 coupons / 2,372,553 CC, 99.7% expired |
| auth0 parties | unknown portion | Pre-existing coupons claimed |
| **Minimum post-pause total** | **~354,145 CC** | |

Note: `coinaegisVault` FA was not revoked until June 3 and generated 154 AppRewardCoupons worth 2,372,553 CC during May 27 – Jun 3 (the FA was granted May 1 but generated zero coupons for 26 days). However, 99.7% of those coupons expired unclaimed — only 7,564 CC was actually claimed. All other post-pause CC came from coupons generated BEFORE the pause but harvested after.

---

## Violations Identified

### 1. Multiple FA Applications Under Different Names (Same Key)
The same entity (same key) applied for and received FA status under at least 3 different identities:
- CoinAegis ("Dual-Vault RWA yield engine")
- Aevum Extension Wallet ("non-custodial browser gateway")
- Goldacorn ("OTC/P2P swapping platform")

Each application had a distinct name, description, and URL in the governance vote reasons.

### 2. Activity Marker Weight Inflation

FeaturedAppActivityMarkers had a protocol-level weakness in how weights were validated. When an FA provider exercises `FeaturedAppRight_CreateActivityMarker` (a choice on its `FeaturedAppRight` contract), it passes a `weight` parameter that determines the FA's share of the network reward pool. The old Splice protocol **did not validate** that this weight corresponded to actual app activity — it accepted whatever value the provider submitted.

**goldacorn marker data (BigQuery-verified):**

The goldacorn FA created 919 markers with a cumulative weight of 318,898 (avg 347 per marker, effective_at Apr 24–25), designating `cryptolegacy-validator-1` as the beneficiary. The same technique was later used by coinaegisVault (154 markers, cumulative weight 351,876, avg 2,285 per marker, May 27 – Jun 3). The protocol accepted these weights without validation — the `weight` parameter was passed directly by the FA provider and not cross-checked against any on-chain activity.

**Marker payload structure** (from BigQuery exercise events):
```json
{
  "beneficiaries": [{"beneficiary": "cryptolegacy-validator-1::1220...", "weight": "1.0"}],
  "weight": "376.0"
}
```
The outer `weight` (376.0) is the value the FA provider submitted per marker — with no corresponding transfer activity. The `beneficiary` is `cryptolegacy-validator-1`, which is where the resulting AppRewardCoupons were attributed.

**CIP-0104 context:** This vulnerability was acknowledged in Canton Improvement Proposal CIP-0104 (approved Feb 12, 2026), which stated "roughly 150% of weight is claimed via markers compared to actual traffic burned." The fix replaced the marker-based system with deterministic traffic-based measurement (`BuyMemberTraffic` amounts). However, CIP-0104 was **not deployed** during CoinAegis's active window (April–May 2026), leaving the protocol open to arbitrary weight claims.

### 3. Wash Trading — Self-Transfers (Phase 2 — aevumWallet)
Created 39 `auth0_*` party IDs all controlled by the same key. Used them to execute **312,696 self-transfers** shuffling tiny amounts (0.1–4 CC) between their own parties. The CC never left CoinAegis's control — it circled between their 44 party IDs. During this period, 44,618 FeaturedAppActivityMarkers were created for aevumWallet, and 78,717 AppRewardCoupons worth 3,292,568 CC were generated.

**Daily wash trading volume (BigQuery-verified):**

| Date | Self-Transfers | CC Volume | Note |
|---|---:|---:|---|
| May 9 | 25 | 39 | First day |
| May 10–17 | 21,832 | 175,731 | Ramp-up |
| May 18 | 17,819 | 161,239 | First big burst |
| May 19–21 | 6,155 | 40,694 | Quiet period |
| **May 22** | **100,135** | **675,031** | **Peak day #1** |
| May 23–27 | 4,078 | 21,892 | Low activity |
| **May 28** | **103,294** | **472,427** | **Peak day #2 — day of governance vote** |
| May 29 | 59 | 8,687 | FA revoked — activity stopped |

~65% of all self-transfers occurred on just two days (May 22 and May 28). On May 29, after the FA pause, activity dropped to 59 transfers.

Note: The daily breakdown above sums to 253,397. The corrected total of 312,696 was obtained using `JSON_VALUE(payload, '$.transfer.sender')` which identifies senders directly from transfer payloads. The daily breakdown used a different query method (`UNNEST(acting_parties)`) which missed transfers where the auth0 sender was not listed in `acting_parties`.

**Sample wash trade pattern** (May 9, BigQuery):
```
auth0_...a4a1 → auth0_...adde   0.10 CC
auth0_...a4a1 → auth0_...a3ac   3.00 CC
auth0_...adde → auth0_...a4a1   0.71 CC
auth0_...a4a1 → auth0_...a3ac   1.00 CC
auth0_...a3ac → auth0_...adde   1.00 CC
auth0_...adde → auth0_...a3ac   0.20 CC
```

### 4. Validator Used as Primary Reward Harvester
`cryptolegacy-validator-1` earned **2.6M CC in app rewards** (92.6% of CoinAegis total claimed) despite never being an FA — it was the designated `beneficiary` in goldacorn markers (BigQuery-verified). After the Tokenomics Committee revoked two FAs (May 28-29), at least **~354,000 CC** in pre-existing coupons continued to be harvested through the validator (never paused). Additionally, `coinaegisVault` was not revoked until Jun 3 and used inflated marker weights (154 markers, avg weight 2,285) to generate 2,372,553 CC in coupons (May 27 – Jun 3), though 99.7% expired unclaimed.

### 5. Complete Money Trail
56.4% of all CC (~1.77M CC) was transferred to external parties — 1,065,002 CC to fba188 (ByBit), 700,001 CC to Gate (Gate.io), and 4,234 CC to quokka-validator-1. An additional 41.5% (~1.3M CC) was consumed via BuyMemberTraffic. 1.7% (~54K CC) was consumed by holding fees (demurrage). Only 0.3% (~10.9K CC) remains in wallets.

#### Transfer Destinations (BigQuery-confirmed)

Transfers to external parties occurred in three phases, with `quokka-validator-1` as an intermediary in Phase 1:

**Phase 1 — Via quokka intermediary (Apr 24-25, 2026):**

CoinAegis (`cryptolegacy-validator-1`) transferred CC to two auth0 party IDs controlled by quokka's key (`12200587db65aee55ac8d877208df0903c0dc9795909ee91347b0d1b6f7b43aa124e`). These quokka auth0 parties then forwarded to final destinations.

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 1 | 2026-04-24 23:27:55 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 10.00 | quokka-validator-1 | `1220034729...4ade:2` |
| 2 | 2026-04-24 23:35:20 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 200,000.00 | quokka-validator-1 | `1220eb2848...e4bb:2` |
| 3 | 2026-04-24 23:36:53 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 250,000.00 | quokka-validator-1 | `1220ff6134...97b9:2` |
| 4 | 2026-04-25 04:54:14 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 20.00 | quokka-validator-1 | `1220a6ebc8...18c4:2` |
| 5 | 2026-04-25 04:59:27 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 200,000.00 | quokka-validator-1 | `1220e2d296...5aaa:2` |
| 6 | 2026-04-25 05:00:48 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 200,000.00 | quokka-validator-1 | `122049c22b...1793:2` |
| 7 | 2026-04-25 05:14:14 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 250,000.00 | quokka-validator-1 | `12207dd007...d612:2` |
| | | | **Phase 1 subtotal** | **1,100,030.00** | | |

Quokka intermediary forwarding (Apr 25–26). Note the small transactions (1 CC, 2 CC) before large transfers:

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 1a | 2026-04-25 07:30:14 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 1.00 | gate-mainnet-1 | `1220fd47...00e7:2` |
| 1b | 2026-04-25 08:12:43 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 250,000.00 | gate-mainnet-1 | `122006bc...5fa1:2` |
| 1c | 2026-04-25 11:37:37 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 200,000.00 | gate-mainnet-1 | `12202c75...1f7e:2` |
| | | | **Subtotal → Gate** | **450,001.00** | | |
| 1d | 2026-04-25 12:09:00 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 2.00 | **ByBit-MainNetValidator-1** | `12207bdd...a665:2` |
| 1e | 2026-04-25 12:29:41 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 50,000.00 | **ByBit-MainNetValidator-1** | `122059c4...79d0:2` |
| 1f | 2026-04-25 13:08:12 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220dd36...9b96:2` |
| 1g | 2026-04-25 17:08:23 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `12200977...323f:2` |
| 1h | 2026-04-26 14:20:35 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220b6ab...a4f1:2` |
| | | | **Subtotal → fba188** | **650,002.00** | | |

**Phase 2 — Small drip transfers to quokka (May 27, 2026):**

`coinaegisVault` and one auth0 party sent 26 small transfers (1–207 CC each) to `quokka-validator-1` over ~6.5 hours (08:45–15:18 UTC). **Phase 2 subtotal: 4,233.76 CC.**

**Phase 3 — Direct large transfers to exchanges (May 29, 2026):**

Three transfers in a 7-minute window, the day `coinaegis` FA was revoked:

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 34 | 2026-05-29 10:38:47 | `cryptolegacy-validator-1` | `fba188` (ByBit wallet) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220aadeb4...96ba:2` |
| 35 | 2026-05-29 10:43:12 | `cryptolegacy-validator-1` | `Gate` (Gate.io) | 250,000.00 | gate-mainnet-1 | `122056fd6a...137a:2` |
| 36 | 2026-05-29 10:45:48 | `cryptolegacy-validator-1` | `fba188` (ByBit wallet) | 215,000.00 | **ByBit-MainNetValidator-1** | `1220cb1006...fdc8:2` |
| | | | **Phase 3 subtotal** | **665,000.00** | | |

#### Aggregated Destinations

| Final Destination | Total CC | Route |
|---|---:|---|
| **fba188** (ByBit-hosted wallet) | **1,065,002** | 415K direct + 650K via intermediary |
| **Gate** (Gate.io exchange) | **700,001** | 250K direct + 450K via intermediary |
| **quokka-validator-1** | **4,233.76** | Small direct transfers |
| Retained by intermediary wallets | 27.00 | Test amounts not forwarded |
| **Total left CoinAegis control** | **1,769,263.76** | BigQuery verified (36 transfers to 5 recipients) |

#### Complete CC Accounting (BigQuery-verified)

| Item | CC | Verification |
|---|---:|---|
| App rewards claimed | 2,804,520 | Canton Scan API + BigQuery cross-check (1,971,768 via transfers + 832,752 via BuyMemberTraffic) |
| Validator rewards claimed | 294,746 | BigQuery `exercise_result.summary` (135,345 via transfers + 159,401 via BuyMemberTraffic) |
| Faucet rewards claimed | 36,897 | BigQuery `exercise_result.summary` (36,893 via transfers + 4 via BuyMemberTraffic) |
| **Total CC entered system** | **~3,136,163** | |
| | | |
| Transferred to external parties | -1,769,264 | BigQuery (36 transfers to 5 recipients) |
| Consumed by BuyMemberTraffic | -1,301,539 | BigQuery (see breakdown below) |
| Remaining in wallets | -10,923 | Canton Scan API |
| Holding fees (demurrage) | ~-54,437 | Residual (~1.7% of total) |
| **Balance** | **~0** | **Fully reconciled** |

All app rewards (2,804,520 CC) have been fully claimed into amulets — confirmed by summing `inputAppRewardAmount` across all transfer and traffic purchase events: 1,971,768 CC (via transfers) + 832,752 CC (via BuyMemberTraffic) = **2,804,520 CC exact**.

#### Transfer Fees Are Zero

The Canton Network protocol config confirms `transferFee.initialRate: "0E-10"` — transfer fees are zero by design. The `senderChangeFee` field in every sampled exercise result (self-transfers, consolidations, and external transfers to exchanges) is `0E-10`. No CC was burned by transfer fees.

#### Network Traffic Consumption (BuyMemberTraffic)

CoinAegis executed 1,929 `BuyMemberTraffic` operations consuming ~1.3M CC. These events consumed CC from multiple sources:

| Input Source | CC |
|---|---:|
| Existing amulets (`inputAmuletAmount`) | 153,004,392 (recycled) |
| App reward coupons (`inputAppRewardAmount`) | 832,752 (freshly claimed) |
| Validator reward coupons (`inputValidatorRewardAmount`) | 159,401 (freshly claimed) |
| Validator faucet coupons (`inputValidatorFaucetAmount`) | 4 |
| **Total input** | **153,996,549** |
| Returned as change (`senderChangeAmount`) | -152,695,010 |
| **Net CC consumed for traffic** | **1,301,539** |

#### Key Entity: fba188

- **Full party ID:** `fba188::1220b5c7e1c4c31c691712a9e660bc611ad91ee0aad58580108db04b84b560b3aa31`
- **Hosted on:** ByBit-MainNetValidator-1 (confirmed by `provider` field in transfer payloads)
- **Status:** Frozen (per internal report from ByBit)
- **Received:** ~1,065,002 CC from CoinAegis (largest single recipient)

#### Key Entity: Gate

- **Full party ID:** `Gate::1220660fcee9042e5d36a50eccee8b6ff3e79cc3612ad41b7ec056c5c6cddacf864b`
- **Hosted on:** gate-mainnet-1
- **Received:** ~700,001 CC from CoinAegis

#### Key Entity: quokka-validator-1 (Intermediary)

- **Full party ID:** `quokka-validator-1::12200587db65aee55ac8d877208df0903c0dc9795909ee91347b0d1b6f7b43aa124e`
- **Role:** Intermediary — received 1,100,030 CC from CoinAegis on Apr 24-25, forwarded 1,100,003 CC to fba188 and Gate on Apr 25-26
- **Also controls auth0 parties** used as hop addresses:
  - `auth0_007c69ec1703012e7f3c0b7f056d::quokka-key` (forwarded 650,002 to fba188)
  - `auth0_007c69ebf59ab2450880196fff52::quokka-key` (forwarded 450,001 to Gate)

---

## Data Sources

All data queried from Canton Scan API and BigQuery on 2026-06-01 through 2026-06-03:

**Canton Scan API:**
- `v0/round-of-latest-data` — current round (98443)
- `v0/featured-apps` — on-chain FA status (156 active)
- `v0/top-providers-by-app-rewards` — cumulative CC per provider
- `v0/admin/sv/voteresults` — governance vote history
- `v0/holdings/summary` — current wallet balances
- `v0/holdings/state` — active contract details
- `v0/round-party-totals` — per-round cumulative rewards timeline
- `v0/admin/validator/licenses` — ByBit node discovery (8 nodes confirmed)

**BigQuery (governence-483517.transformed.events_parsed):**
- Transfer tracing via `AmuletRules_Transfer` exercised events
- Fee verification via `exercise_result.summary.senderChangeFee` (confirmed zero)
- Reward harvesting via `exercise_result.summary.inputAppRewardAmount`, `inputValidatorRewardAmount`, `inputValidatorFaucetAmount`
- Traffic consumption via `AmuletRules_BuyMemberTraffic` input/output analysis
- Protocol config via `AmuletRules_Fetch` exercise results (`transferFee.initialRate: "0E-10"`, `holdingFee.rate: 0.0000190259`)
- Activity counts verified: `choice` column grouped by type, filtered on `acting_parties` containing CoinAegis key
- External recipient verification: `payload.transfer.outputs[0].receiver` grouped by receiver, excluding CoinAegis key
- **Activity marker analysis** via `FeaturedAppRight_CreateActivityMarker` exercise events — weight parameter, beneficiary, provider, creation frequency
- **Marker weight validation** via cross-referencing marker weight against transfer count per FA provider
- Template: `c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules`
- Date range: 2026-04-20 to 2026-06-03, migration_id = 4
- Verification queries: `scripts/bigquery-fee-burn-verification.sql`

**Canton Improvement Proposals:**
- CIP-0104 (approved 2026-02-12): "Replace Splice Featured App Rewards with Activity-based Rewards" — confirms that the old marker weight system was vulnerable to inflation and that the protocol did not validate weights against actual activity

SV endpoints used: Cumberland (`scan.sv-1.global.canton.network.cumberland.io`)
